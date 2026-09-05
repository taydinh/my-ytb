"""Create transparent PNG and multi-size Windows ICO assets from the source artwork."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def remove_connected_checkerboard(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def looks_like_checkerboard(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return min(red, green, blue) >= 210 and max(red, green, blue) - min(red, green, blue) <= 18

    def enqueue(x: int, y: int) -> None:
        offset = y * width + x
        if not background[offset] and looks_like_checkerboard(x, y):
            background[offset] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    for y in range(height):
        for x in range(width):
            if background[y * width + x]:
                red, green, blue, _ = pixels[x, y]
                pixels[x, y] = (red, green, blue, 0)

    return image


def make_square_icon(image: Image.Image, size: int = 1024, fill_ratio: float = 0.9) -> Image.Image:
    alpha_box = image.getchannel("A").getbbox()
    if alpha_box is None:
        raise ValueError("No foreground was found after background removal")

    artwork = image.crop(alpha_box)
    max_content_size = round(size * fill_ratio)
    artwork.thumbnail((max_content_size, max_content_size), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - artwork.width) // 2
    y = (size - artwork.height) // 2
    canvas.alpha_composite(artwork, (x, y))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Source image containing the checkerboard background")
    parser.add_argument("--output-dir", type=Path, default=Path("assets"))
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(args.source) as source:
        icon = make_square_icon(remove_connected_checkerboard(source))

    png_path = args.output_dir / "icon.png"
    ico_path = args.output_dir / "icon.ico"
    icon.save(png_path, format="PNG", optimize=True)
    icon.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print(f"Wrote {png_path} and {ico_path}")


if __name__ == "__main__":
    main()
