#!/usr/bin/env python3
"""
Build the AgriCapital browser icons from the NDH Open Gateway master mark.

Run from the repository root, with Pillow available:

    python3 scripts/build-brand-icons.py

Writes:
    public/favicon.png         64×64   browser tab icon
    public/apple-touch-icon.png 180×180 iOS home-screen icon (navy plate)

Both carry the Open Gateway master mark with this property's agricultural
sector badge — the same emerald sprout the header and footer lockup wears — so
the tab, the bookmark and the home screen all sign the platform the same way.
The navy plate is part of the icon because the master mark contains white
shapes, which would vanish against a white browser tab.

The crisp vector twin lives in public/favicon.svg, authored by hand from the
same geometry.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

NAVY = (10, 26, 48, 255)
EMERALD = (16, 185, 129, 255)
WHITE = (255, 255, 255, 255)

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "src/assets/brand/ndh-gateway-mark.png"


def draw_sprout(
    canvas: Image.Image, cx: int, cy: int, radius: int, colour: tuple[int, int, int, int]
) -> None:
    """
    The sprout sector glyph: a single stem with one leaf either side.

    Drawn large inside the badge and then scaled, so the silhouette stays
    readable at 16 px in a browser tab: two clearly separated leaves, a clean
    stem, and a little air between them.
    """
    scale = 8  # supersample, then downscale — small discs alias badly otherwise
    w = h = radius * 2 * scale
    tile = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)

    r = radius * scale
    ox = oy = r  # centre of the tile

    stem_w = max(1, round(r * 0.13))
    draw.rounded_rectangle(
        [ox - stem_w / 2, oy - r * 0.08, ox + stem_w / 2, oy + r * 0.66],
        radius=stem_w / 2,
        fill=colour,
    )

    blade_w = r * 0.72
    blade_h = r * 0.5
    for direction, angle in ((-1, 34), (1, -34)):
        blade = Image.new("RGBA", (round(blade_w), round(blade_h)), (0, 0, 0, 0))
        ImageDraw.Draw(blade).ellipse([0, 0, round(blade_w) - 1, round(blade_h) - 1], fill=colour)
        blade = blade.rotate(angle, resample=Image.BICUBIC, expand=True)
        left = round(ox + direction * r * 0.30 - blade.width / 2)
        top = round(oy - r * 0.50 - blade.height / 2)
        tile.alpha_composite(blade, (left, top))

    tile = tile.resize((radius * 2, radius * 2), Image.LANCZOS)
    canvas.alpha_composite(tile, (cx - radius, cy - radius))


def build(size: int, plate: bool) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    if plate:
        ImageDraw.Draw(canvas).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=round(size * 0.215), fill=NAVY
        )

    mark = Image.open(MARK).convert("RGBA")
    mark = mark.crop(mark.getbbox())
    box = round(size * 0.78)
    mark = mark.resize((box, box), Image.LANCZOS)
    offset = round((size - box) / 2)
    canvas.alpha_composite(mark, (offset, offset))

    # Sector badge, bottom-right, with a collar so it reads on any tab colour.
    radius = round(size * 0.235)
    cx = size - radius - round(size * 0.045)
    cy = size - radius - round(size * 0.045)
    collar = max(1, round(size * 0.03))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse(
        [cx - radius - collar, cy - radius - collar, cx + radius + collar, cy + radius + collar],
        fill=NAVY,
    )
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=EMERALD)
    draw_sprout(canvas, cx, cy, radius, WHITE)

    return canvas


def build_svg(size: int = 64) -> str:
    """
    The crisp vector twin of the tab icon.

    A browser takes an SVG favicon as a single self-contained file — it will not
    fetch a second resource for it — so the master mark is embedded as a small
    base64 PNG (a downscale of the same asset) while the plate, the sector
    badge and the sprout are real paths that stay sharp at any tab size.
    """
    import base64
    from io import BytesIO

    box = round(size * 0.78)
    mark = Image.open(MARK).convert("RGBA").crop(Image.open(MARK).convert("RGBA").getbbox())
    mark = mark.resize((box, box), Image.LANCZOS)
    buffer = BytesIO()
    mark.save(buffer, "PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    radius = round(size * 0.235, 2)
    collar = round(radius + size * 0.03, 2)
    cx = cy = round(size - radius - size * 0.045, 2)
    offset = round((size - box) / 2, 2)

    blade_w = round(radius * 0.72, 2)
    blade_h = round(radius * 0.5, 2)
    leaf_cx = round(radius * 0.30, 2)
    leaf_cy = round(cy - radius * 0.5, 2)
    stem_w = round(radius * 0.13, 2)
    stem_top = round(cy - radius * 0.08, 2)
    stem_h = round(radius * 0.74, 2)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="NDH AgriCapital">
  <title>NDH AgriCapital — the Open Gateway mark with the agricultural sprout badge</title>
  <rect width="{size}" height="{size}" rx="{round(size * 0.215, 2)}" fill="#0A1A30"/>
  <image x="{offset}" y="{offset}" width="{box}" height="{box}" href="data:image/png;base64,{encoded}"/>
  <circle cx="{cx}" cy="{cy}" r="{collar}" fill="#0A1A30"/>
  <circle cx="{cx}" cy="{cy}" r="{radius}" fill="#10B981"/>
  <g fill="#FFFFFF">
    <rect x="{round(cx - stem_w / 2, 2)}" y="{stem_top}" width="{stem_w}" height="{stem_h}" rx="{round(stem_w / 2, 2)}"/>
    <ellipse cx="0" cy="0" rx="{round(blade_w / 2, 2)}" ry="{round(blade_h / 2, 2)}" transform="translate({round(cx - leaf_cx, 2)},{leaf_cy}) rotate(-34)"/>
    <ellipse cx="0" cy="0" rx="{round(blade_w / 2, 2)}" ry="{round(blade_h / 2, 2)}" transform="translate({round(cx + leaf_cx, 2)},{leaf_cy}) rotate(34)"/>
  </g>
</svg>
"""


def main() -> None:
    # Both icons carry the navy plate: the master mark contains white shapes,
    # which would disappear on a white browser tab or a light home screen.
    favicon = build(64, plate=True)
    favicon.save(ROOT / "public/favicon.png", "PNG", optimize=True)

    touch = build(180, plate=True).convert("RGB")
    touch.save(ROOT / "public/apple-touch-icon.png", "PNG", optimize=True)

    (ROOT / "public/favicon.svg").write_text(build_svg(), encoding="utf-8")

    print(
        "wrote public/favicon.png (64×64), public/apple-touch-icon.png (180×180) "
        "and public/favicon.svg"
    )


if __name__ == "__main__":
    main()
