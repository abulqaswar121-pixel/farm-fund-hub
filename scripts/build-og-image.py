#!/usr/bin/env python3
"""
Build the Open Graph card for link unfurls (/og-agricapital.png).

Run from the repository root. It reuses the site's own faces rather than
committing them twice — convert the woff2 files the app already ships, then
point the script at them:

    pip install fonttools brotli
    python3 - <<'EOF'
    from fontTools.ttLib import TTFont
    for src, dst in [
        ("public/fonts/space-grotesk-latin-700.woff2", "/tmp/ogfonts/spacegrotesk-700.ttf"),
        ("public/fonts/dm-sans-latin-400.woff2",       "/tmp/ogfonts/dmsans-400.ttf"),
        ("public/fonts/dm-sans-latin-500.woff2",       "/tmp/ogfonts/dmsans-500.ttf"),
    ]:
        f = TTFont(src); f.flavor = None; f.save(dst)
    EOF
    python3 scripts/build-og-image.py

The card states what is fixed and where to look, never a figure: at unfurl time
there are no figures to state honestly.
"""
from __future__ import annotations

import sys
from pathlib import Path

import importlib.util

from PIL import Image, ImageDraw, ImageFont

NAVY = (10, 26, 48)
PORCELAIN = (248, 250, 252)
CYAN = (34, 211, 238)
MINT = (16, 185, 129)
SLATE = (148, 163, 184)
W, H = 1200, 630

root = Path(__file__).resolve().parent.parent

# The sector-badge geometry lives with the browser icons, so both outputs agree.
_spec = importlib.util.spec_from_file_location(
    "build_brand_icons", Path(__file__).resolve().parent / "build-brand-icons.py"
)
assert _spec and _spec.loader
brand_icons = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(brand_icons)
mark = Image.open(root / "src/assets/brand/ndh-gateway-mark.png").convert("RGBA")
mark = mark.crop(mark.getbbox()).resize((150, 150), Image.LANCZOS)

canvas = Image.new("RGB", (W, H), NAVY)
draw = ImageDraw.Draw(canvas, "RGBA")


def font(path: str, size: int):
    return ImageFont.truetype(path, size)


display_bold_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ogfonts/spacegrotesk-700.ttf"
body_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/ogfonts/dmsans-400.ttf"
body_medium_path = sys.argv[3] if len(sys.argv) > 3 else "/tmp/ogfonts/dmsans-500.ttf"

display_bold = lambda size: font(display_bold_path, size)  # noqa: E731
body = lambda size: font(body_path, size)  # noqa: E731
body_medium = lambda size: font(body_medium_path, size)  # noqa: E731

# Faint contour grid — the "precision" texture, never loud enough to read as data.
for x in range(0, W, 40):
    draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
for y in range(0, H, 40):
    draw.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)

# Master gradient bar across the top edge.
for x in range(W):
    t = x / (W - 1)
    if t < 0.5:
        u = t / 0.5
        colour = tuple(round(CYAN[i] + (104 - CYAN[i]) * u) for i in range(3))
    else:
        u = (t - 0.5) / 0.5
        colour = tuple(round(104 + (169 - 104) * u) for i in range(3))
    draw.line([(x, 0), (x, 6)], fill=colour)

# Gateway mark with its agricultural sector badge.
#
# The badge geometry is imported from `build-brand-icons.py` rather than
# re-drawn, so the tab icon, the home-screen icon and this unfurl card all wear
# an identical sprout roundel — one definition, three outputs.
MARK_X, MARK_Y, MARK_SIZE = 72, 84, 150
canvas.paste(mark, (MARK_X, MARK_Y), mark)

ICON_SIZE = MARK_SIZE / 0.78  # the badge is positioned relative to the whole icon
ICON_ORIGIN_X = MARK_X - (ICON_SIZE - MARK_SIZE) / 2
ICON_ORIGIN_Y = MARK_Y - (ICON_SIZE - MARK_SIZE) / 2
BADGE_R = round(ICON_SIZE * 0.235)
COLLAR = max(1, round(ICON_SIZE * 0.03))
BADGE_CX = round(ICON_ORIGIN_X + ICON_SIZE - BADGE_R - ICON_SIZE * 0.045)
BADGE_CY = round(ICON_ORIGIN_Y + ICON_SIZE - BADGE_R - ICON_SIZE * 0.045)

draw.ellipse(
    [
        BADGE_CX - BADGE_R - COLLAR,
        BADGE_CY - BADGE_R - COLLAR,
        BADGE_CX + BADGE_R + COLLAR,
        BADGE_CY + BADGE_R + COLLAR,
    ],
    fill=NAVY,
)
draw.ellipse(
    [BADGE_CX - BADGE_R, BADGE_CY - BADGE_R, BADGE_CX + BADGE_R, BADGE_CY + BADGE_R],
    fill=MINT,
)
# The canvas is opaque RGB, so the sprout is drawn on its own transparent
# layer and pasted through its own alpha channel.
_sprout = Image.new("RGBA", (W, H), (0, 0, 0, 0))
brand_icons.draw_sprout(_sprout, BADGE_CX, BADGE_CY, BADGE_R, (255, 255, 255, 255))
canvas.paste(_sprout, (0, 0), _sprout)

draw.text((72, 258), "NAJEEB DIGITAL HUB", font=body_medium(26), fill=CYAN)

# Lockup.
draw.text((72, 300), "NDH AgriCapital", font=display_bold(84), fill=PORCELAIN)
draw.text(
    (72, 412),
    "Farm capital with the books left open",
    font=body(36),
    fill=SLATE,
)

# What is fixed, stated as policy — the platform publishes no figure it cannot prove.
#
# The chips are measured and shrunk to fit rather than hard-coded, so editing the
# wording can never push a chip off the right edge of the card.
chips = [
    "Rules locked up front",
    "Members paid before profit",
    "Every payout recorded",
]
MARGIN, GAP = 72, 48
available = W - MARGIN * 2

chip_size = 26
while chip_size > 14:
    chip_font = body(chip_size)
    widths = [draw.textlength(text, font=chip_font) for text in chips]
    total = sum(widths) + GAP * (len(chips) - 1) + 40 * len(chips)
    if total <= available:
        break
    chip_size -= 1

x = MARGIN
for text, width in zip(chips, widths):
    height = chip_size + 28
    top = 492 + (54 - height) / 2
    draw.rounded_rectangle(
        [x, top, x + width + 40, top + height],
        radius=height / 2,
        outline=(255, 255, 255, 40),
        width=2,
    )
    draw.text((x + 20, top + height / 2), text, font=chip_font, fill=MINT, anchor="lm")
    x += width + 40 + GAP

draw.text(
    (72, 578),
    "agricapital.ndh.com.ng",
    font=body(28),
    fill=PORCELAIN,
)

out = root / "public/og-agricapital.png"
canvas.save(out, optimize=True)
print("wrote", out, f"{out.stat().st_size / 1024:.0f} KB", canvas.size)
