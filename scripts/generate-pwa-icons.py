"""Draw the original WebBand fader mark at install icon sizes."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    scale = 4
    side = size * scale
    image = Image.new("RGBA", (side, side), "#111827")
    draw = ImageDraw.Draw(image)

    def rect(bounds, radius, fill, outline=None, width=1):
        draw.rounded_rectangle(tuple(round(value * scale) for value in bounds),
                               radius=round(radius * scale), fill=fill,
                               outline=outline, width=round(width * scale))

    if maskable:
        # The essential sliders stay inside the central 80% safe circle.
        rect((80, 80, 432, 432), 72, "#162334", "#314458", 4)
        x_positions = (160, 224, 288, 352)
        tops = (180, 145, 168, 150)
        bottoms = (335, 365, 340, 360)
        knobs = (211, 285, 196, 278)
        line_width, knob_radius = 20, 19
    else:
        unit = size / 512
        rect((48 * unit, 48 * unit, 464 * unit, 464 * unit), 86 * unit,
             "#162334", "#314458", max(1, 4 * unit))
        x_positions = tuple(value * unit for value in (128, 214, 300, 386))
        tops = tuple(value * unit for value in (150, 115, 144, 126))
        bottoms = tuple(value * unit for value in (348, 390, 354, 380))
        knobs = tuple(value * unit for value in (214, 292, 190, 286))
        line_width, knob_radius = 23 * unit, 22 * unit

    for index, x in enumerate(x_positions):
        draw.line((round(x * scale), round(tops[index] * scale), round(x * scale),
                   round(bottoms[index] * scale)), fill="#4bd3eb", width=round(line_width * scale))
        r = knob_radius * scale
        y = knobs[index] * scale
        draw.ellipse((round(x * scale - r), round(y - r), round(x * scale + r), round(y + r)),
                     fill=("#f5b95e", "#9b8af8", "#6ee7b7", "#f27f91")[index])
    return image.resize((size, size), Image.Resampling.LANCZOS).convert("RGB")


for icon_size in (192, 512):
    draw_icon(icon_size).save(OUT / f"icon-{icon_size}.png", optimize=True)
draw_icon(512, maskable=True).save(OUT / "icon-maskable-512.png", optimize=True)
