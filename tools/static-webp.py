"""Recompresses the static store cards from PNG to WebP (renewal 19.1/19.2).

The sharp 1256px copies land under 200 KB and the 628px store copies under
80 KB — the packing the chapter's budget table names. Two laws bind at once:
the size line, and the platform law the card audit holds on the PNG (no
sampled pixel within ΔE 10 of Poki's #83FFE7). Lossy WebP quantization can
nudge a mint-adjacent sky pixel across that ΔE line at low quality, so the
ladder climbs quality until BOTH hold — a card that cannot hold both at any
rung fails loudly instead of shipping either law broken. The PNG sources stay
in the tree so the capture pipeline can re-run.

    python tools/static-webp.py
"""

import glob
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "thumbnails", "static")
BUDGETS = {1256: 200 * 1024, 628: 80 * 1024}
QUALITY_LADDER = (80, 88, 92, 95, 100)
POKI_BACKGROUND = (0x83, 0xFF, 0xE7)
DE_MAX = 10.0


def to_lab(rgb):
    """sRGB to CIE Lab, the card audit's own conversion."""
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    matrix = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ])
    xyz = linear @ matrix.T / np.array([0.95047, 1.0, 1.08883])
    delta = 6 / 29
    f = np.where(xyz > delta ** 3, np.cbrt(xyz), xyz / (3 * delta ** 2) + 4 / 29)
    fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], axis=-1)


TARGET = to_lab(np.array(POKI_BACKGROUND, dtype=np.float64) / 255)


def collisions(path):
    """Sampled pixels within ΔE 10 of the platform's background, the audit's stride."""
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255
    lab = to_lab(rgb[::2, ::2])
    return int((np.sqrt(((lab - TARGET) ** 2).sum(axis=-1)) <= DE_MAX).sum())


def main():
    failures = 0
    for png in sorted(glob.glob(os.path.join(ROOT, "thumbnail-*-*.png"))):
        side = int(png.rsplit("-", 1)[1].split(".")[0])
        budget = BUDGETS[side]
        out = png[:-4] + ".webp"
        image = Image.open(png)
        chosen = None
        for quality in QUALITY_LADDER:
            image.save(out, "WEBP", quality=quality, method=6)
            if os.path.getsize(out) <= budget and collisions(out) == 0:
                chosen = (quality, os.path.getsize(out))
                break
        if chosen is None:
            failures += 1
            print(f"FAIL {os.path.basename(out)}: no quality rung holds both the size line and the ΔE law")
        else:
            quality, size = chosen
            print(f"ok {os.path.basename(out)} {size / 1024:.0f} KB of {budget / 1024:.0f} KB (q{quality})")
    if failures:
        raise SystemExit(f"{failures} cards over budget")


if __name__ == "__main__":
    main()
