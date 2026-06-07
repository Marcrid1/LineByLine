from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MOCKUP_BASE = ASSETS / "poster-mockup-base.png"
POSTER_SOURCE = ASSETS / "poster-example.png"
OUTPUT = ASSETS / "poster-screenshot.png"

# Full poster sheet in mockup – covers old design completely, keeps side props visible
POSTER_BOX = (385, 50, 1135, 915)
FILL_COLOR = (255, 248, 244)


def main() -> None:
    if not MOCKUP_BASE.exists():
        raise SystemExit(f"Missing mockup base: {MOCKUP_BASE}")
    if not POSTER_SOURCE.exists():
        raise SystemExit(f"Missing poster source: {POSTER_SOURCE}")

    mockup = Image.open(MOCKUP_BASE).convert("RGB")
    poster = Image.open(POSTER_SOURCE).convert("RGB")

    left, top, right, bottom = POSTER_BOX
    target_w = right - left
    target_h = bottom - top
    poster = poster.resize((target_w, target_h), Image.Resampling.LANCZOS)

    result = mockup.copy()
    draw = ImageDraw.Draw(result)
    draw.rectangle(POSTER_BOX, fill=FILL_COLOR)
    result.paste(poster, (left, top))
    result.save(OUTPUT, optimize=True)
    print(f"Saved {OUTPUT}")


if __name__ == "__main__":
    main()
