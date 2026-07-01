#!/usr/bin/env python3
"""Resize screenshots for Chrome Web Store upload requirements."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

TARGET_W = 1280
TARGET_H = 800
TARGET_ASPECT = TARGET_W / TARGET_H


def crop_center_to_aspect(image: Image.Image, aspect: float) -> Image.Image:
    width, height = image.size
    current_aspect = width / height

    if current_aspect > aspect:
        new_width = int(round(height * aspect))
        left = (width - new_width) // 2
        return image.crop((left, 0, left + new_width, height))

    new_height = int(round(width / aspect))
    top = (height - new_height) // 2
    return image.crop((0, top, width, top + new_height))


def to_store_png(image: Image.Image, width: int, height: int) -> Image.Image:
    cropped = crop_center_to_aspect(image, width / height)
    resized = cropped.resize((width, height), Image.Resampling.LANCZOS)
    if resized.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", resized.size, (15, 15, 15))
        if resized.mode == "P":
            resized = resized.convert("RGBA")
        background.paste(resized, mask=resized.split()[-1] if "A" in resized.mode else None)
        return background
    return resized.convert("RGB")


def process_screenshot(source: Path, dest: Path) -> None:
    with Image.open(source) as image:
        store_image = to_store_png(image, TARGET_W, TARGET_H)
        dest.parent.mkdir(parents=True, exist_ok=True)
        store_image.save(dest, format="PNG", optimize=True)
    print(f"{source.name} -> {dest} ({TARGET_W}x{TARGET_H}, RGB)")


def process_promo(source: Path, dest: Path, width: int, height: int) -> None:
    with Image.open(source) as image:
        promo = to_store_png(image, width, height)
        dest.parent.mkdir(parents=True, exist_ok=True)
        promo.save(dest, format="PNG", optimize=True)
    print(f"{source.name} -> {dest} ({width}x{height}, RGB)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "sources",
        nargs="*",
        type=Path,
        help="Screenshot files (default: Screenshot-*.png in repo root)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("docs/store-screenshots"),
        help="Output directory for store-ready assets",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    sources = args.sources or sorted(repo_root.glob("Screenshot-*.png"))
    sources = [path.resolve() for path in sources]

    if not sources:
        print("No screenshots found. Add Screenshot-*.png to the repo root.", file=sys.stderr)
        return 1

    out_dir = (repo_root / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    for index, source in enumerate(sources, start=1):
        if not source.exists():
            print(f"Missing file: {source}", file=sys.stderr)
            return 1
        process_screenshot(source, out_dir / f"{index:02d}-screenshot.png")

    first = sources[0]
    process_promo(first, out_dir / "promo-small-440x280.png", 440, 280)
    process_promo(first, out_dir / "promo-marquee-1400x560.png", 1400, 560)

    print(f"\nUpload files from: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
