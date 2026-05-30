#!/usr/bin/env python3
"""One-off asset tooling: hero animated WebP, transparent UI art, favicon from crest."""

from __future__ import annotations

import argparse
from pathlib import Path

import imageio.v3 as iio
from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

TRANSPARENT_ASSETS = [
    PUBLIC / "ui" / "captain-seal.webp",
    PUBLIC / "ui" / "quest-fail.webp",
    PUBLIC / "ui" / "quest-success.webp",
    PUBLIC / "ui" / "wax-seal.webp",
    PUBLIC / "crest.webp",
]

HERO_MP4 = PUBLIC / "demo" / "hero.mp4"
HERO_WEBP = PUBLIC / "demo" / "hero.webp"
FAVICON_ICO = PUBLIC / "favicon.ico"
APP_ICON = ROOT / "src" / "app" / "icon.png"


def rgba_to_webp(path: Path, img: Image.Image) -> None:
    img = img.convert("RGBA")
    img.save(path, format="WEBP", lossless=True, method=6)


def remove_background(path: Path) -> None:
    src = Image.open(path).convert("RGBA")
    out = remove(src)
    rgba_to_webp(path, out)
    print(f"transparent: {path.relative_to(ROOT)}")


def hero_to_animated_webp() -> None:
    target_w = 720
    fps_out = 12
    frame_ms = int(1000 / fps_out)
    frames: list[Image.Image] = []
    src_fps = float(iio.immeta(HERO_MP4).get("fps", 24))

    step = max(1, round(src_fps / fps_out))
    for i, frame in enumerate(iio.imiter(HERO_MP4)):
        if i % step != 0:
            continue
        img = Image.fromarray(frame).convert("RGB")
        w, h = img.size
        target_h = max(1, round(h * target_w / w))
        img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        frames.append(img.convert("RGBA"))

    if not frames:
        raise RuntimeError("No frames extracted from hero.mp4")

    frames[0].save(
        HERO_WEBP,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=frame_ms,
        loop=0,
        lossless=False,
        quality=82,
        method=6,
    )
    print(f"animated webp: {HERO_WEBP.relative_to(ROOT)} ({len(frames)} frames)")


def crest_to_favicon() -> None:
    crest = Image.open(PUBLIC / "crest.webp").convert("RGBA")
    sizes = [(16, 16), (32, 32), (48, 48)]
    icons = [crest.resize(s, Image.Resampling.LANCZOS) for s in sizes]
    icons[0].save(
        FAVICON_ICO,
        format="ICO",
        sizes=[(i.width, i.height) for i in icons],
        append_images=icons[1:],
    )
    crest.resize((512, 512), Image.Resampling.LANCZOS).save(APP_ICON, format="PNG")
    print(f"favicon: {FAVICON_ICO.relative_to(ROOT)}")
    print(f"app icon: {APP_ICON.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Regenerate demo hero WebP, transparent UI art, and favicon."
    )
    parser.add_argument(
        "step",
        nargs="?",
        default="all",
        choices=("all", "hero", "transparent", "favicon"),
        help="Which step to run (default: all). Run one step at a time, e.g. "
        "'python3 scripts/process-assets.py transparent' — do not use shell pipes.",
    )
    args = parser.parse_args()
    cmd = args.step

    if cmd in ("all", "hero"):
        hero_to_animated_webp()
    if cmd in ("all", "transparent"):
        for path in TRANSPARENT_ASSETS:
            if not path.exists():
                raise FileNotFoundError(path)
            remove_background(path)
    if cmd in ("all", "favicon"):
        crest_to_favicon()


if __name__ == "__main__":
    main()
