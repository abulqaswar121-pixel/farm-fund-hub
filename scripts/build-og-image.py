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
body_semibold_path = sys.argv[4] if len(sys.argv) > 4 else "/tmp/ogfonts/dmsans-600.ttf"

display_bold = lambda size: font(display_bold_path, size)  # noqa: E731
body = lambda size: font(body_path, size)  # noqa: E731
body_medium = lambda size: font(body_medium_path, size)  # noqa: E731
body_semibold = lambda size: font(body_semibold_path, size)  # noqa: E731

# ---------------------------------------------------------------- farm photo --
# The right 38% of the card is a real farm photograph, softened into the navy so
# the headline never has to fight it. A share card that shows the product is
# worth more than one that shows a gradient.
PHOTO_LEFT = int(W * 0.60)
photo_path = root / "public/images/farm/hero-catfish-ponds.jpg"
if photo_path.exists():
    photo = Image.open(photo_path).convert("RGB")
    # Cover-fit the strip.
    target_w, target_h = W - PHOTO_LEFT, H
    scale = max(target_w / photo.width, target_h / photo.height)
    photo = photo.resize(
        (round(photo.width * scale) + 1, round(photo.height * scale) + 1), Image.LANCZOS
    )
    left = max(0, (photo.width - target_w) // 2)
    top = max(0, (photo.height - target_h) // 2)
    photo = photo.crop((left, top, left + target_w, top + target_h))

    # Navy 75% wash over the photograph, easing to full navy at the seam so the
    # two halves read as one card rather than a collage.
    wash = Image.new("RGBA", (target_w, target_h), NAVY + (0,))
    px = wash.load()
    for x in range(target_w):
        t = x / max(1, target_w - 1)
        alpha = round(255 * (0.75 - 0.55 * min(1.0, t / 0.45)))
        for y in range(0, target_h, 4):
            for dy in range(4):
                if y + dy < target_h:
                    px[x, y + dy] = NAVY + (alpha,)
    photo = photo.convert("RGBA")
    photo.alpha_composite(wash)
    canvas.paste(photo.convert("RGB"), (PHOTO_LEFT, 0))

# Faint contour grid — the "precision" texture, never loud enough to read as data.
for x in range(0, PHOTO_LEFT, 40):
    draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
for y in range(0, H, 40):
    draw.line([(0, y), (PHOTO_LEFT, y)], fill=(255, 255, 255, 8), width=1)

# Master gradient bar across the top edge, and a cyan hairline down the seam.
for x in range(W):
    t = x / (W - 1)
    if t < 0.5:
        u = t / 0.5
        colour = tuple(round(CYAN[i] + (104 - CYAN[i]) * u) for i in range(3))
    else:
        u = (t - 0.5) / 0.5
        colour = tuple(round(104 + (169 - 104) * u) for i in range(3))
    draw.line([(x, 0), (x, 6)], fill=colour)
draw.line([(PHOTO_LEFT, 0), (PHOTO_LEFT, H)], fill=CYAN + (70,), width=2)

# ------------------------------------------------------------- brand lockup --
#
# The badge geometry is imported from `build-brand-icons.py` rather than
# re-drawn, so the tab icon, the home-screen icon and this unfurl card all wear
# an identical sprout roundel — one definition, three outputs.
MARK_X, MARK_Y, MARK_SIZE = 64, 54, 96
canvas.paste(mark.resize((MARK_SIZE, MARK_SIZE), Image.LANCZOS), (MARK_X, MARK_Y), mark.resize((MARK_SIZE, MARK_SIZE), Image.LANCZOS))

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

draw.text(
    (MARK_X + MARK_SIZE + 22, MARK_Y + 12),
    "NAJEEB DIGITAL HUB",
    font=body_semibold(19),
    fill=CYAN,
)
draw.text(
    (MARK_X + MARK_SIZE + 22, MARK_Y + 44),
    "NDH FarmFund",
    font=display_bold(40),
    fill=PORCELAIN,
)

# ------------------------------------------------------------------ headline --
# The exact share headline the platform is published under. Three fixed lines,
# each measured once so the card never depends on a font metric surprise.
HEADLINE = ["Real farm investments", "with open books."]
# Shrink until the longest line clears the photo seam with a real margin.
head_size = 52
while head_size > 30:
    head_font = display_bold(head_size)
    if max(draw.textlength(line, font=head_font) for line in HEADLINE) <= PHOTO_LEFT - 64 - 34:
        break
    head_size -= 1
line_height = round(head_size * 1.19)
y = 186
for line in HEADLINE:
    draw.text((64, y), line, font=head_font, fill=PORCELAIN)
    y += line_height

# The naira sign is not in the Latin subset the site ships, so it would print
# as an empty box here. "5,000 naira" says the same thing in glyphs that exist.
SUBHEAD = [
    "Back a communal catfish cycle from 5,000 naira,",
    "follow the pond week by week, and share 70% of profit.",
]
sub_size = 25
while sub_size > 14:
    sub_font = body(sub_size)
    if max(draw.textlength(line, font=sub_font) for line in SUBHEAD) <= PHOTO_LEFT - 66 - 26:
        break
    sub_size -= 1
sub_y = y + 22
for line in SUBHEAD:
    draw.text((66, sub_y), line, font=sub_font, fill=SLATE)
    sub_y += round(sub_size * 1.38)

# What is fixed, stated as policy — the platform publishes no figure it cannot prove.
#
# The chips are measured and shrunk to fit rather than hard-coded, so editing the
# wording can never push a chip off the right edge of the card.
chips = ["Cycle 01 · 115 catfish", "70 / 30 split", "Weekly pond logs"]
MARGIN, GAP = 64, 18
available = int(W * 0.58) - MARGIN

chip_size = 22
while chip_size > 13:
    chip_font = body(chip_size)
    widths = [draw.textlength(text, font=chip_font) for text in chips]
    total = sum(widths) + GAP * (len(chips) - 1) + 34 * len(chips)
    if total <= available:
        break
    chip_size -= 1

x = MARGIN
for text, width in zip(chips, widths):
    height = chip_size + 24
    top = 520
    draw.rounded_rectangle(
        [x, top, x + width + 34, top + height],
        radius=height / 2,
        outline=(255, 255, 255, 42),
        width=2,
    )
    draw.text((x + 17, top + height / 2), text, font=chip_font, fill=MINT, anchor="lm")
    x += width + 34 + GAP

draw.text(
    (64, 578),
    "agricapital.ndh.com.ng",
    font=body_medium(24),
    fill=PORCELAIN,
)

out = root / "public/og-agricapital.png"
canvas.save(out, optimize=True)
print("wrote", out, f"{out.stat().st_size / 1024:.0f} KB", canvas.size)
