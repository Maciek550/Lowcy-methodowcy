#!/usr/bin/env python3
"""Faithful high-resolution exports of the existing Łowcy Methodowcy crown-and-fish logo.
Do not redraw or replace the original artwork; PNGs are generated from icon-512.png.
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "brand"
OUT.mkdir(exist_ok=True)
source = Image.open(ROOT / "icon-512.png").convert("RGBA")
if source.size != (512, 512):
    raise SystemExit(f"Unexpected logo source dimensions: {source.size}")

def export(name, size, *, sharpen=False, pad=False):
    im = source.copy()
    if pad:
        # Android adaptive-icon safe zone: entire existing logo fits within 80% canvas.
        inner = round(size * 0.79)
        im = im.resize((inner, inner), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (6, 26, 35, 255))
        canvas.alpha_composite(im, ((size-inner)//2, (size-inner)//2))
        im = canvas
    else:
        im = im.resize((size, size), Image.Resampling.LANCZOS)
    if sharpen and size > 512:
        im = im.filter(ImageFilter.UnsharpMask(radius=1.15, percent=115, threshold=3))
    im.save(OUT / name, "PNG", optimize=True, compress_level=9)

for size in (32, 64, 180, 192, 512, 1024):
    export(f"icon-v217-{size}.png", size, sharpen=size>512)
export("maskable-v217-512.png", 512, pad=True)
export("logo-facebook-v217-2048.png", 2048, sharpen=True)
print("Brand export verified:", [(p.name, Image.open(p).size) for p in sorted(OUT.glob("*.png"))])
