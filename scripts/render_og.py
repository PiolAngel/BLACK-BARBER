#!/usr/bin/env python3
"""Generate BLACK BARBER's 1200x630 social card with anti-aliased typography."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H, SCALE = 1200, 630, 3
BG = "#0e0c0a"
GOLD = "#b3894f"
CREAM = "#f2e9dc"
MUTED = "#a99b84"
FONTS = Path("/usr/share/fonts/truetype/dejavu")
SERIF = FONTS / "DejaVuSerif.ttf"
SANS = FONTS / "DejaVuSans.ttf"

image = Image.new("RGB", (W * SCALE, H * SCALE), BG)
draw = ImageDraw.Draw(image)


def rectangle(bounds, fill=None, outline=None, line=1):
    draw.rectangle(
        tuple(round(p * SCALE) for p in bounds),
        fill=fill, outline=outline, width=line * SCALE,
    )


def centered_text(y, value, font_path, font_size, color, tracking=0):
    font = ImageFont.truetype(str(font_path), font_size * SCALE)
    bounds = draw.textbbox((0, 0), value, font=font)
    if tracking:
        advances = [draw.textlength(character, font=font) for character in value]
        total = sum(advances) + (len(value) - 1) * tracking * SCALE
        x = (W * SCALE - total) / 2
        for character, advance in zip(value, advances):
            draw.text((round(x), round(y * SCALE - bounds[1])),
                      character, fill=color, font=font)
            x += advance + tracking * SCALE
    else:
        x = (W * SCALE - (bounds[2] - bounds[0])) / 2
        draw.text((round(x), round(y * SCALE - bounds[1])),
                  value, fill=color, font=font)


rectangle((34, 34, 1165, 596), outline=GOLD)
rectangle((529, 105, 671, 247), outline=GOLD, line=2)
centered_text(122, "B", SERIF, 98, GOLD)
centered_text(301, "BLACK BARBER", SERIF, 67, CREAM, tracking=0.4)
rectangle((245, 393, 955, 394), fill=GOLD)
centered_text(419, "BARBERÍA PREMIUM  ·  EXPERIENCIA DIGITAL",
              SANS, 17, GOLD, tracking=0.1)
centered_text(539, "PROYECTO DEMOSTRATIVO", SANS, 15, MUTED, tracking=0.1)

output = Path(__file__).resolve().parent.parent / "black-barber-og.png"
image.resize((W, H), Image.Resampling.LANCZOS).save(output, optimize=True)
print(f"Created {output}: 1200x630, RGB, anti-aliased")
