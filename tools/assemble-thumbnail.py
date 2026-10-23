"""Turns a captured frame sequence into the animated thumbnail deliverables.

The last frames are cross-faded into the first so the loop has no jump, then the
sequence is written as an animated WebP, a GIF and (when ffmpeg is given) a 60 fps WebM; the Playwright ffmpeg build reads only piped MJPEG, so the frames go in as near-lossless JPEG.

    python tools/assemble-thumbnail.py <frames-dir> <out-dir> [--ffmpeg=<path>] [--fade=12]
"""
import glob
import os
import subprocess
import sys

from PIL import Image

FRAME_MS = 1000 / 60


def option(name, default):
    for arg in sys.argv[3:]:
        if arg.startswith(f"--{name}="):
            return arg.split("=", 1)[1]
    return default


def looped(frames, fade):
    """Cross-fades the tail into the head, then drops the tail so the cut is invisible."""
    body = frames[: len(frames) - fade]
    for i in range(fade):
        t = (i + 1) / (fade + 1)
        body[i] = Image.blend(frames[len(frames) - fade + i], body[i], t)
    return body


def main():
    source, out = sys.argv[1], sys.argv[2]
    fade = int(option("fade", "12"))
    ffmpeg = option("ffmpeg", "")
    os.makedirs(out, exist_ok=True)
    paths = sorted(glob.glob(os.path.join(source, "*.png")))
    frames = [Image.open(p).convert("RGB") for p in paths]
    loop = looped(frames, fade)

    loop[0].save(
        os.path.join(out, "thumbnail-animated.webp"),
        save_all=True,
        append_images=loop[1:],
        duration=round(FRAME_MS),
        loop=0,
        quality=82,
        method=4,
    )

    small = [f.resize((420, 420), Image.LANCZOS).quantize(colors=96, dither=Image.Dither.NONE) for f in loop[::3]]
    small[0].save(
        os.path.join(out, "thumbnail-animated.gif"),
        save_all=True,
        append_images=small[1:],
        duration=round(FRAME_MS * 3),
        loop=0,
        optimize=True,
        disposal=1,
    )

    if ffmpeg:
        encoder = subprocess.Popen(
            [ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "60", "-c:v", "mjpeg", "-i", "pipe:0",
             "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "33", "-pix_fmt", "yuv420p",
             os.path.join(out, "thumbnail-animated.webm")],
            stdin=subprocess.PIPE,
        )
        for frame in loop:
            frame.save(encoder.stdin, format="JPEG", quality=96, subsampling=0)
        encoder.stdin.close()
        if encoder.wait() != 0:
            raise SystemExit("ffmpeg failed to encode the WebM")

    for name in sorted(os.listdir(out)):
        print(f"{name}: {os.path.getsize(os.path.join(out, name)) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
