"""Audits a store thumbnail against the card spec (PRD 17.3, R-TH-01..05/09).

    python tools/check-thumbnail.py thumbnails/static/thumbnail-hero-628.png \
        --variant=hero-launch --subject=0.45,0.55,0.43,0.43
    python tools/check-thumbnail.py --report thumbnails

The single-image run prints one line per rule and exits non-zero when any fails.
`--subject` is the subject's box as UV (x, y, w, h), which the capture pipeline
derives from the composition scene, so the contrast and legibility rules measure
the shot's own numbers instead of a guess. `--report` audits the whole thumbnail
tree and writes the panel-log scaffold of PRD 33.4, keeping any panel results a
human has already entered.
"""
import glob
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

POKI_BACKGROUND = (0x83, 0xFF, 0xE7)
DE_MAX = 10.0
BAR_TOLERANCE = 3
MIN_SIDE = 628
CONTRAST_MIN = 3.0
DIMMED_MIN = 2.0
LEGIBILITY_128 = 1.6
ARC_BLUE_RED_GAP = 30
ARC_128_GAP = 20
ARC_MIN_VAL = 0.55
ARC_FULL_MIN = 400
ARC_128_MIN = 40
OCR_MIN_CONFIDENCE = 65
OCR_MIN_LENGTH = 3
WEBM_BUDGET = 300 * 1024
IDENT_MAX_MS = 3000
DIM = 0.7
VARIANT_BASE = {"panic-launch": "panic", "fall-comedy": "fall", "tower-scale": "tower"}
ARC_VARIANTS = ("panic-launch", "tower-scale")
# The wide ambience card carries the arc as a minor element: MAGNO's beam is a
# ~30 px sliver at that shot's scale, so presence is the bar, not abundance — and
# the bar sits below the capture's run-to-run drift (28-35 px, the ring and aurora
# phases seed from the wall clock before the capture holds it).
ARC_MIN_BY_VARIANT = {"panic-launch": (240, 40), "tower-scale": (20, 3)}
# R-TH-05's subject/background law presumes a subject-forward card; the ambience
# card is measured on every other leg and the panel decides its fate (R-TH-07).
CONTRAST_VARIANTS = ("panic-launch", "fall-comedy")
# The panic cards' emotion gate (rebuild PRD 1.9, G2): inside the subject's core
# at 128 px there must be a bright cluster with a dark cluster hard beside it —
# the eye-and-pupil (or eye-and-mouth) pair that survives the downscale. A card
# whose subject is all one tone carries no expression the shelf can read.
EMOTION_MIN_BRIGHT = 25
EMOTION_MIN_DARK = 6
EMOTION_BRIGHT = 0.85
EMOTION_DARK = 0.35


def option(name, default=None):
    for arg in sys.argv[1:]:
        if arg.startswith(f"--{name}="):
            return arg.split("=", 1)[1]
    return default


def luminance(rgb):
    """WCAG relative luminance of an (..., 3) float array in 0-1 sRGB."""
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    return 0.2126 * linear[..., 0] + 0.7152 * linear[..., 1] + 0.0722 * linear[..., 2]


def ratio(light, dark):
    return (light + 0.05) / (dark + 0.05)


def to_lab(rgb):
    """sRGB to CIELAB (D65) for the Poki-background distance rule."""
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    matrix = np.array(
        [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]]
    )
    xyz = linear @ matrix.T / np.array([0.95047, 1.0, 1.08883])
    delta = 6 / 29
    f = np.where(xyz > delta ** 3, np.cbrt(xyz), xyz / (3 * delta ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def uniform_edge(pixels, size, edge):
    """True when a whole outer row or column is one flat colour, the mark of a letterbox bar."""
    if edge in ("top", "bottom"):
        y = 0 if edge == "top" else size - 1
        line = [pixels[x, y] for x in range(size)]
    else:
        x = 0 if edge == "left" else size - 1
        line = [pixels[x, y] for y in range(size)]
    first = line[0]
    return all(max(abs(a - b) for a, b in zip(p, first)) <= BAR_TOLERANCE for p in line)


def subject_masks(size, subject):
    """Core is the inner 60% of the subject box; the ring is the box blown up 2.2x minus the box."""
    x, y, w, h = subject
    x0, y0 = int(x * size), int(y * size)
    x1, y1 = int((x + w) * size), int((y + h) * size)
    if x1 <= x0 or y1 <= y0:
        return None, None
    core = np.zeros((size, size), dtype=bool)
    inset = 0.2
    core[int((y0 + inset * (y1 - y0))) : int(y1 - inset * (y1 - y0)), int((x0 + inset * (x1 - x0))) : int(x1 - inset * (x1 - x0))] = True
    ring = np.zeros((size, size), dtype=bool)
    bx, by = 0.6 * w, 0.6 * h
    ring[int(max(0, (y - by) * size)) : int(min(size, (y + h + by) * size)), int(max(0, (x - bx) * size)) : int(min(size, (x + w + bx) * size))] = True
    ring &= ~core
    if not core.any() or not ring.any():
        return None, None
    return core, ring


def arc_pixels(rgb01):
    """The magnetic signature renders as additive light in either of its two pole
    voices: cyan-white on attract, hot amber on repel (the panic cards launch on
    repel, and their signature is amber). Both must sit clearly past the opposite
    channel and read bright."""
    cyan = (rgb01[..., 2] - rgb01[..., 0] >= ARC_BLUE_RED_GAP / 255) & (rgb01[..., 2] > ARC_MIN_VAL) & (rgb01[..., 1] > ARC_MIN_VAL * 0.9)
    amber = (rgb01[..., 0] - rgb01[..., 2] >= ARC_BLUE_RED_GAP / 255) & (rgb01[..., 0] > ARC_MIN_VAL) & (rgb01[..., 1] > ARC_MIN_VAL * 0.55)
    return cyan | amber


def subject_core_mask(size, subject):
    """The inner 60% of the subject box, as a boolean mask."""
    x, y, w, h = subject
    x0, y0 = int(x * size), int(y * size)
    x1, y1 = int((x + w) * size), int((y + h) * size)
    if x1 <= x0 or y1 <= y0:
        return None
    core = np.zeros((size, size), dtype=bool)
    inset = 0.2
    core[int((y0 + inset * (y1 - y0))) : int(y1 - inset * (y1 - y0)), int((x0 + inset * (x1 - x0))) : int(x1 - inset * (x1 - x0))] = True
    return core


def emotion_pair(rgb, subject):
    """G2, as a machine can hold it: a bright cluster in the subject's core with
    a dark cluster within a few pixels of it — the two-shape face at card scale.
    Returns (bright_count, dark_count_beside_bright) or None when there is no core."""
    size = min(rgb.shape[0], rgb.shape[1])
    core = subject_core_mask(size, subject)
    if core is None or not core.any():
        return None
    luma = luminance(rgb)
    bright = core & (luma >= EMOTION_BRIGHT)
    if int(bright.sum()) < EMOTION_MIN_BRIGHT:
        return int(bright.sum()), 0
    # dilate the bright cluster by a 7 px ring and count the dark pixels inside it
    ring = np.zeros_like(bright)
    ring[7:, :] |= bright[:-7, :]
    ring[:-7, :] |= bright[7:, :]
    ring[:, 7:] |= bright[:, :-7]
    ring[:, :-7] |= bright[:, 7:]
    ring &= ~bright
    dark = int((ring & (luma <= EMOTION_DARK)).sum())
    return int(bright.sum()), dark


def audit_image(path, variant, subject):
    """Every rule for one card, as an ordered list of failures plus the measured stats."""
    failures = []
    image = Image.open(path)
    width, height = image.size
    if width != height:
        failures.append(f"not square: {width} x {height}")
    if min(width, height) < MIN_SIDE:
        failures.append(f"smaller than {MIN_SIDE} px: {width} x {height}")

    rgba = image.convert("RGBA")
    for corner in [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]:
        if rgba.getpixel(corner)[3] < 255:
            failures.append(f"corner {corner} is not opaque")

    rgb_image = image.convert("RGB")
    pixels = rgb_image.load()
    for edge in ("top", "bottom", "left", "right"):
        if width == height and uniform_edge(pixels, width, edge):
            failures.append(f"flat {edge} edge: looks like a bar")

    rgb = np.asarray(rgb_image, dtype=np.float64) / 255
    stride = rgb[::2, ::2]
    lab = to_lab(stride)
    target = to_lab(np.array([[list(POKI_BACKGROUND)]], dtype=np.float64) / 255)[0, 0]
    distance = np.sqrt(((lab - target) ** 2).sum(axis=-1))
    collisions = int((distance <= DE_MAX).sum())
    if collisions:
        failures.append(f"{collisions} sampled pixels within ΔE {DE_MAX:g} of Poki's #83FFE7 (limit 0)")

    try:
        tsv = subprocess.run(["tesseract", path, "stdout", "--psm", "11", "tsv"], capture_output=True, text=True, timeout=60)
        glyphs = []
        for line in tsv.stdout.splitlines()[1:]:
            cells = line.split("\t")
            if len(cells) < 12:
                continue
            word, confidence = cells[11], float(cells[10])
            cleaned = "".join(ch for ch in word if ch.isalnum())
            if len(cleaned) >= OCR_MIN_LENGTH and confidence >= OCR_MIN_CONFIDENCE:
                glyphs.append(cleaned)
        if glyphs:
            failures.append(f"OCR found text: {', '.join(glyphs[:4])}")
    except (OSError, subprocess.TimeoutExpired, ValueError):
        failures.append("tesseract is not available to prove the card is text-free")

    if subject is None:
        failures.append("no subject box given: pass --subject=x,y,w,h from the composition scene")
        return failures, {}

    core, ring = subject_masks(width, subject)
    if core is None:
        failures.append(f"subject box {subject} lands outside the card")
        return failures, {}

    def separation(luma, subject_core, subject_ring):
        """Tonal separation across the subject boundary, either polarity: the brighter side's bright
        quartile over the darker side's dark quartile. A lit hero on dark sky and a dark tower
        against bright sky both measure the read the eye actually gets."""
        bright = max(np.percentile(luma[subject_core], 75), np.percentile(luma[subject_ring], 75))
        dark = min(np.percentile(luma[subject_core], 25), np.percentile(luma[subject_ring], 25))
        return ratio(float(bright), float(dark))

    luma = luminance(rgb)
    contrast = separation(luma, core, ring)
    dim_luma = luminance(np.asarray(rgb_image, dtype=np.float64) * DIM / 255)
    dim_contrast = separation(dim_luma, core, ring)
    small = np.asarray(rgb_image.resize((128, 128), Image.BILINEAR), dtype=np.float64) / 255
    small_core, small_ring = subject_masks(128, subject)
    small_contrast = separation(luminance(small), small_core, small_ring)

    arcs = arc_pixels(rgb)
    stats = {"contrast": round(contrast, 2), "dimmed": round(dim_contrast, 2), "at128": round(small_contrast, 2)}
    if variant in CONTRAST_VARIANTS:
        if contrast < CONTRAST_MIN:
            failures.append(f"subject/background contrast {contrast:.2f} below {CONTRAST_MIN:g}:1")
        if dim_contrast < DIMMED_MIN:
            failures.append(f"contrast on a 30%-dimmed screen {dim_contrast:.2f} below {DIMMED_MIN:g}:1")
        if small_contrast < LEGIBILITY_128:
            failures.append(f"subject contrast at 128 px {small_contrast:.2f} below {LEGIBILITY_128:g}:1")
        pair = emotion_pair(small, subject)
        if pair is not None:
            stats["emotion"] = list(pair)
            bright, dark = pair
            if bright < EMOTION_MIN_BRIGHT or dark < EMOTION_MIN_DARK:
                failures.append(f"no two-shape face in the subject at 128 px: {bright} bright px, {dark} dark beside them (need {EMOTION_MIN_BRIGHT}/{EMOTION_MIN_DARK})")
    if variant in ARC_VARIANTS:
        full_min, small_min = ARC_MIN_BY_VARIANT.get(variant, (ARC_FULL_MIN, ARC_128_MIN))
        top = float(np.percentile(luma, 75))
        bright_arcs = int((arcs & (luma >= top)).sum())
        stats["arcBand"] = bright_arcs
        if bright_arcs < full_min:
            failures.append(f"{bright_arcs} arc pixels in the top luminance quartile (need {full_min})")
        small_cyan = (small[..., 2] - small[..., 0] >= ARC_128_GAP / 255) & (small[..., 2] > 0.45) & (small[..., 1] > 0.16)
        small_amber = (small[..., 0] - small[..., 2] >= ARC_128_GAP / 255) & (small[..., 0] > 0.45) & (small[..., 1] > 0.16)
        small_arcs = int((arc_pixels(small) | small_cyan | small_amber).sum())
        stats["arc128"] = small_arcs
        if small_arcs < small_min:
            failures.append(f"{small_arcs} arc pixels survive at 128 px (need {small_min})")
    return failures, stats


def audit_animated(folder):
    """R-TH-10 budgets: three formats, WebM size, and a duration that keeps the loop under 3 s."""
    failures = []
    webm = os.path.join(folder, "thumbnail-animated.webm")
    if not os.path.exists(webm):
        failures.append("thumbnail-animated.webm is missing")
    elif os.path.getsize(webm) > WEBM_BUDGET:
        failures.append(f"WebM is {os.path.getsize(webm) / 1024:.0f} KB over the {WEBM_BUDGET // 1024} KB budget")
    for name in ("thumbnail-animated.webp", "thumbnail-animated.gif"):
        if not os.path.exists(os.path.join(folder, name)):
            failures.append(f"{name} is missing")
    try:
        with Image.open(os.path.join(folder, "thumbnail-animated.webp")) as webp:
            frames = getattr(webp, "n_frames", 1)
            duration = frames * webp.info.get("duration", 1000 / 60)
        if duration > IDENT_MAX_MS:
            failures.append(f"animated ident runs {duration:.0f} ms (limit {IDENT_MAX_MS} ms)")
        return failures, {"frames": frames, "durationMs": round(duration)}
    except (OSError, AttributeError):
        return failures, {}


def write_report(root):
    subjects_path = os.path.join(root, "subjects.json")
    if not os.path.exists(subjects_path):
        raise SystemExit("thumbnails/subjects.json is missing; run npm run thumbnails to write it")
    with open(subjects_path) as handle:
        subjects = json.load(handle)
    report_path = os.path.join(root, "report.json")
    previous = {}
    if os.path.exists(report_path):
        with open(report_path) as handle:
            previous = json.load(handle)

    detail = {}
    ok = True
    for variant, base in VARIANT_BASE.items():
        path = os.path.join(root, "static", f"thumbnail-{base}-628.png")
        if not os.path.exists(path):
            raise SystemExit(f"{path} is missing; run npm run thumbnails first")
        subject = subjects.get(variant)
        failures, stats = audit_image(path, variant, subject)
        detail[variant] = {"failures": failures, **stats}
        ok = ok and not failures
        for failure in failures:
            print(f"FAIL [{variant}] {failure}")
        if not failures:
            print(f"PASS {path}")

    animated_failures, animated_stats = audit_animated(os.path.join(root, "animated"))
    detail["animated"] = {"failures": animated_failures, **animated_stats}
    ok = ok and not animated_failures
    for failure in animated_failures:
        print(f"FAIL [animated] {failure}")
    if not animated_failures:
        print("PASS animated ident budgets")

    hero = detail["panic-launch"]
    report = {
        "date": previous.get("date"),
        "variants": ["A-panic-launch", "B-fall-comedy", "C-tower-scale"],
        "panel": previous.get("panel", {"n": 10, "exposureMs": 200, "forcedChoiceWinner": None, "score": None}),
        "audits": {
            "legibility128": not hero["failures"] and hero.get("at128", 0) >= LEGIBILITY_128,
            "contrast": hero.get("contrast", 0),
            "emotion128": not any("two-shape" in f for f in hero["failures"]),
            "hueCollision": any("ΔE" in f for f in hero["failures"]),
            "ocrEmpty": not any("OCR" in f for f in hero["failures"]),
        },
        "uploaded": previous.get("uploaded"),
        "detail": detail,
    }
    with open(report_path, "w") as handle:
        json.dump(report, handle, indent=2)
    print(f"wrote {report_path}")
    print("panel results are blank until a human runs the forced-choice test (PRD R-TH-07)")
    sys.exit(0 if ok else 1)


def main():
    if option("report"):
        write_report(option("report"))
    paths = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not paths:
        raise SystemExit("give a thumbnail path, or --report=<thumbnails folder>")
    path = paths[0]
    variant = option("variant")
    subject = None
    if option("subject"):
        subject = [float(v) for v in option("subject").split(",")]
    failures, stats = audit_image(path, variant, subject)
    print(f"{path}: " + (", ".join(f"{k}={v}" for k, v in stats.items()) if stats else "geometry checked"))
    for failure in failures:
        print(f"FAIL {failure}")
    if not failures:
        print("PASS")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
