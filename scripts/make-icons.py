"""Generates the Home Screen icons in public/. Run: python3 scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ACCENT = (15, 107, 92)  # --accent in app.css
INK = (255, 255, 255)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
OUT = Path(__file__).resolve().parent.parent / "public"


def icon(size: int, rounded: bool) -> Image.Image:
    # Drawn at 4x and scaled down for smooth edges. Full-bleed (no transparency) so iOS and
    # maskable crops never show black corners; `rounded` is only for the 192 px browser icon.
    s = size * 4
    img = Image.new("RGB", (s, s), ACCENT)
    if rounded:
        img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle((0, 0, s - 1, s - 1), radius=s // 5, fill=ACCENT)
    draw = ImageDraw.Draw(img)
    # A "K" inside the maskable safe zone (central 80%), with a road line under it.
    font = ImageFont.truetype(FONT, int(s * 0.5))
    box = draw.textbbox((0, 0), "K", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1] - s * 0.05), "K", font=font, fill=INK)
    y = s * 0.74
    draw.rounded_rectangle((s * 0.3, y, s * 0.7, y + s * 0.045), radius=s // 40, fill=INK)
    return img.resize((size, size), Image.LANCZOS)


icon(192, rounded=True).save(OUT / "icon-192.png", optimize=True)
icon(512, rounded=False).save(OUT / "icon-512.png", optimize=True)
icon(180, rounded=False).save(OUT / "apple-touch-icon.png", optimize=True)
print("wrote", *(p.name for p in sorted(OUT.glob("*.png"))))
