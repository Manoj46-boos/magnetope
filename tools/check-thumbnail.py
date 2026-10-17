"""Checks a store thumbnail against the PRD 6.6 spec and Poki's guidance.

    python tools/check-thumbnail.py thumbnails/static/scrapyard-04-0108.png

Exit status is non-zero when a rule fails. Rules: square and at least 628 px, no
transparent corners (Poki rounds them), no letterbox bars, and no meaningful share
of the Poki playground background colour (#83FFE7 and its neighbours).
"""
import colorsys
import sys

from PIL import Image

POKI_BACKGROUND = (0x83, 0xFF, 0xE7)
HUE_TOLERANCE = 0.045
MAX_SHARE = 0.01
BAR_TOLERANCE = 3


def hls(rgb):
    return colorsys.rgb_to_hls(*(c / 255 for c in rgb))


def near_poki(rgb, target_h):
    h, l, s = hls(rgb)
    return abs(h - target_h) < HUE_TOLERANCE and l > 0.62 and s > 0.55


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


def main():
    path = sys.argv[1]
    image = Image.open(path)
    failures = []
    width, height = image.size
    if width != height:
        failures.append(f"not square: {width} x {height}")
    if min(width, height) < 628:
        failures.append(f"smaller than 628 px: {width} x {height}")

    rgba = image.convert("RGBA")
    for corner in [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]:
        if rgba.getpixel(corner)[3] < 255:
            failures.append(f"corner {corner} is not opaque")

    rgb = image.convert("RGB")
    pixels = rgb.load()
    for edge in ("top", "bottom", "left", "right"):
        if width == height and uniform_edge(pixels, width, edge):
            failures.append(f"flat {edge} edge: looks like a bar")

    target_h = hls(POKI_BACKGROUND)[0]
    sample = rgb.resize((157, 157), Image.BILINEAR)
    flagged = sum(1 for p in sample.get_flattened_data() if near_poki(p, target_h))
    share = flagged / (157 * 157)
    if share > MAX_SHARE:
        failures.append(f"{share:.1%} of pixels sit near Poki's #83FFE7 (limit {MAX_SHARE:.0%})")

    print(f"{path}: {width} x {height}, {share:.2%} near #83FFE7")
    for failure in failures:
        print(f"FAIL {failure}")
    if not failures:
        print("PASS")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
