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
WEBM_BUDGET = 300 * 1024
# The platform's animated deliverables (visual renewal PRD 16.2): WebP and GIF
# both live under 1 MB. The card's saturated sky and additive field lines carry
# far more entropy than a dusk grade, so each encoder climbs its own quality
# ladder until its budget holds — and a card that outgrows the ceiling fails
# the audit loudly instead of shipping over weight.
WEBP_BUDGET = 1024 * 1024
WEBP_QUALITY_LADDER = (72, 64, 56, 48)
WEBP_SIZES = (628, 504, 405)
GIF_BUDGET = 1024 * 1024
GIF_SIZES = (420, 340, 280)
GIF_COLORS = (96, 80, 64)
CRF_FLOOR = 42
CRF_CEILING = 48


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

    # WebP's ladder walks quality first, then frame stride and size: 60 fps is
    # the platform's ceiling, not a floor — a 30 fps loop of the same 3 s reads
    # identically on a portal grid, where the GIF already runs at 20 fps — and
    # the last rung drops to the GIF's own working size before it ever ships
    # over weight.
    webp_path = os.path.join(out, "thumbnail-animated.webp")
    for stride, size in ((1, 628), (2, 628), (2, 504), (2, 405)):
        sequence = [f if size == 628 else f.resize((size, size), Image.LANCZOS) for f in loop[::stride]]
        duration = round(FRAME_MS * stride)
        for quality in WEBP_QUALITY_LADDER:
            sequence[0].save(
                webp_path,
                save_all=True,
                append_images=sequence[1:],
                duration=duration,
                loop=0,
                quality=quality,
                method=4,
            )
            if os.path.getsize(webp_path) <= WEBP_BUDGET:
                break
        if os.path.getsize(webp_path) <= WEBP_BUDGET:
            break

    gif_path = os.path.join(out, "thumbnail-animated.gif")
    for size, colors in zip(GIF_SIZES, GIF_COLORS):
        small = [f.resize((size, size), Image.LANCZOS).quantize(colors=colors, dither=Image.Dither.NONE) for f in loop[::3]]
        small[0].save(
            gif_path,
            save_all=True,
            append_images=small[1:],
            duration=round(FRAME_MS * 3),
            loop=0,
            optimize=True,
            disposal=1,
        )
        if os.path.getsize(gif_path) <= GIF_BUDGET:
            break

    if ffmpeg:
        # The three-second loop must live under the 300 KB budget whatever the
        # card's entropy: the tight panic frame, its saturated sky and the amber
        # field lines through the whole flight carry far more entropy than the
        # dusk card the grade replaced. The encoder starts at the quality floor
        # the audit is happy with and climbs in two-step grades until the
        # budget holds — and a card that outgrows the ceiling still fails the
        # audit loudly instead of shipping over weight.
        import io

        jpegs = []
        for frame in loop:
            buf = io.BytesIO()
            frame.save(buf, format="JPEG", quality=96, subsampling=0)
            jpegs.append(buf.getvalue())
        jpeg = b"".join(jpegs)

        webm_path = os.path.join(out, "thumbnail-animated.webm")
        crf = CRF_FLOOR
        while True:
            subprocess.run(
                [ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "60", "-c:v", "mjpeg", "-i", "pipe:0",
                 "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(crf), "-pix_fmt", "yuv420p", webm_path],
                input=jpeg, check=True,
            )
            if os.path.getsize(webm_path) <= WEBM_BUDGET or crf >= CRF_CEILING:
                break
            crf += 2

    for name in sorted(os.listdir(out)):
        print(f"{name}: {os.path.getsize(os.path.join(out, name)) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
