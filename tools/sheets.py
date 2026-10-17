"""Lays the photographs taken by tools/sweep.ts out as one contact sheet per biome and half.

    python tools/sheets.py playtests/sweep

Each sheet is seven levels wide and four moments of the climb deep.
"""
import json
import os
import sys

from PIL import Image, ImageDraw

TILE_W = 320
COLUMNS = 7
MOMENTS = 4
BIOMES = ["scrapyard", "suburbia", "metropolis", "playground", "stratosphere"]
LABEL_H = 22


def main(folder):
    report = {r["id"]: r for r in json.load(open(os.path.join(folder, "report.json"), encoding="utf8"))}
    out = os.path.join(folder, "sheets")
    os.makedirs(out, exist_ok=True)
    for biome in BIOMES:
        ids = sorted(i for i in report if i.startswith(biome + "-"))
        for half in range(2):
            chunk = ids[half * COLUMNS : (half + 1) * COLUMNS]
            if not chunk:
                continue
            first = Image.open(os.path.join(folder, f"{chunk[0]}-1.jpg"))
            tile_h = round(TILE_W * first.height / first.width)
            sheet = Image.new("RGB", (TILE_W * len(chunk), (tile_h * MOMENTS) + LABEL_H), (14, 16, 22))
            draw = ImageDraw.Draw(sheet)
            for col, level in enumerate(chunk):
                info = report[level]
                mark = "" if info["cleared"] and not info["problems"] else "  !!"
                draw.text((col * TILE_W + 6, 5), f'{level}  {info["seconds"]}s/{info["parSeconds"]}{mark}', fill=(235, 235, 235))
                for row in range(MOMENTS):
                    path = os.path.join(folder, f"{level}-{row + 1}.jpg")
                    if not os.path.exists(path):
                        continue
                    shot = Image.open(path).resize((TILE_W, tile_h), Image.LANCZOS)
                    sheet.paste(shot, (col * TILE_W, LABEL_H + row * tile_h))
            sheet.save(os.path.join(out, f"{biome}-{'ab'[half]}.jpg"), quality=88)
            print("wrote", f"{biome}-{'ab'[half]}.jpg")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "playtests/sweep")
