"""Generates the Home Screen icons in public/: the booklet's navy cover with a white Barlow "K" and a
violet stamp-ink rule (colours from DESIGN.md). Needs Pillow built with WOFF2 support (pip install Pillow).
Run: python3 scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ACCENT = (36, 48, 94)  # --navy in app.css: the booklet cover
INK = (255, 255, 255)
STAMP = (107, 63, 160)  # --violet: stamp ink
ROOT = Path(__file__).resolve().parent.parent
FONT = str(ROOT / "public/fonts/barlow-700-latin.woff2")
OUT = ROOT / "public"


def icon(size: int, rounded: bool) -> Image.Image:
    # Drawn at 4x and scaled down for smooth edges. Full-bleed (no transparency) so iOS and
    # maskable crops never show black corners; `rounded` is only for the 192 px browser icon.
    s = size * 4
    if rounded:
        img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle((0, 0, s - 1, s - 1), radius=s // 5, fill=ACCENT)
    else:
        img = Image.new("RGB", (s, s), ACCENT)
    draw = ImageDraw.Draw(img)
    # A "K" inside the maskable safe zone (central 80%), with a stamp-ink rule under it.
    font = ImageFont.truetype(FONT, int(s * 0.56))
    box = draw.textbbox((0, 0), "K", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1] - s * 0.05), "K", font=font, fill=INK)
    y = s * 0.735
    draw.rounded_rectangle((s * 0.3, y, s * 0.7, y + s * 0.06), radius=s // 60, fill=STAMP)
    return img.resize((size, size), Image.LANCZOS)


icon(192, rounded=True).save(OUT / "icon-192.png", optimize=True)
icon(512, rounded=False).save(OUT / "icon-512.png", optimize=True)
icon(180, rounded=False).save(OUT / "apple-touch-icon.png", optimize=True)
print("wrote", *(p.name for p in sorted(OUT.glob("*.png"))))
