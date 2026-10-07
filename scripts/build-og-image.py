#!/usr/bin/env python3
"""
Build the Open Graph card for link unfurls (/og-agricapital.png).

Run from the repository root. Needs the two brand faces, which are fetched from
the Google Fonts repository (SIL Open Font License) rather than committed twice:

    python3 scripts/build-og-image.py /tmp/ogfonts/spacegrotesk.ttf /tmp/ogfonts/dmsans.ttf

The card states the platform's locked rules, not figures: at unfurl time there
are no figures to state honestly.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

NAVY = (10, 26, 48)
PORCELAIN = (248, 250, 252)
CYAN = (34, 211, 238)
MINT = (16, 185, 129)
SLATE = (148, 163, 184)
W, H = 1200, 630

root = Path(__file__).resolve().parent.parent
mark = Image.open(root / "src/assets/brand/ndh-gateway-mark.png").convert("RGBA")
mark = mark.crop(mark.getbbox()).resize((150, 150), Image.LANCZOS)

canvas = Image.new("RGB", (W, H), NAVY)
draw = ImageDraw.Draw(canvas, "RGBA")


def font(path: str, size: int):
    return ImageFont.truetype(path, size)


display = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ogfonts/spacegrotesk.ttf"
body = sys.argv[2] if len(sys.argv) > 2 else "/tmp/ogfonts/dmsans.ttf"

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

# Gateway mark, top-left.
canvas.paste(mark, (72, 84), mark)
draw.text((72, 252), "NAJEEB DIGITAL HUB", font=font(display, 26), fill=CYAN)

# Lockup.
draw.text((72, 300), "NDH AgriCapital", font=font(display, 84), fill=PORCELAIN)
draw.text(
    (72, 410),
    "Multi-commodity agricultural investment ledger",
    font=font(body, 34),
    fill=SLATE,
)

# Locked rules, stated as policy — the platform publishes no figure it cannot prove.
chips = [
    "Locked 70 / 30 profit split",
    "Four-level waterfall",
    "Equity computed live",
]
x = 72
for text in chips:
    chip_font = font(body, 26)
    width = draw.textlength(text, font=chip_font)
    draw.rounded_rectangle(
        [x, 492, x + width + 40, 546], radius=27, outline=(255, 255, 255, 40), width=2
    )
    draw.text((x + 20, 506), text, font=chip_font, fill=MINT)
    x += width + 64

draw.text(
    (72, 578),
    "agricapital.ndh.com.ng",
    font=font(body, 28),
    fill=PORCELAIN,
)

out = root / "public/og-agricapital.png"
canvas.save(out, optimize=True)
print("wrote", out, f"{out.stat().st_size / 1024:.0f} KB", canvas.size)
