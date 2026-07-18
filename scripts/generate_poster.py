#!/usr/bin/env python3
"""Generate the release poster through the required Aigram transit endpoint."""

import json
import sys
import time
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

API = "https://chat.aiwaves.tech/aigram/api/gen-image"
HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "_qa" / "poster-platform-raw.png"
OUT = ROOT / "public" / "poster.png"
RECORD = ROOT / "doc" / "poster-generation.json"
FONT = Path("/System/Library/Fonts/Supplemental/Impact.ttf")

PROMPT = """
Square 1024x1024 premium mobile game key art, full bleed, no text, no letters,
no logo, no watermark, no UI. A frantic morning rush-hour subway scene shown
as an open-roof cutaway train car in dramatic three-quarter perspective. A
single exhausted office worker in a cream shirt and deep-purple trousers pushes
through a dense, diverse crowd toward one acid-yellow subway door that is
sliding shut. Several passengers stumble sideways like dominoes as the train
violently sways; overhead hand straps all swing in the same direction, bags and
paper tickets fly through the air. The car has detailed green bench seats,
silver poles, hanging straps, windows, route map, advertisements, warning stripes
and a gritty floor. Bold adult American graphic-novel screenprint style: strong
dry-brush black ink contours, coarse halftone shadows, limited off-register
palette of deep aubergine, warm paper cream, acid yellow, carriage green,
cool cyan and tiny vermilion accents. Funny panic, kinetic physical comedy,
family friendly, no injuries, no gore. Strong diagonal depth, clear hero and
clear closing-door objective readable at 160px. Reserve the top 25 percent as
mostly clean deep-aubergine tunnel atmosphere for later title typography; keep
all faces, the hero and the closing door below that safe area. Bottom 20 percent
contains only secondary floor and scattered papers, no face or key object.
Not anime, not photorealistic, not flat vector art, not a screenshot.
""".strip()


def generate() -> tuple[str, dict]:
    payload = {"prompt": PROMPT, "ref_url": "https://yinxinghuan.github.io/games/posters/midnight-verdict.png"}
    data = json.dumps(payload).encode("utf-8")
    last_error: Exception | None = None
    for attempt, delay in enumerate((3, 8, 15), start=1):
        try:
            request = urllib.request.Request(API, data=data, method="POST", headers=HEADERS)
            with urllib.request.urlopen(request, timeout=360) as response:
                body = json.loads(response.read())
            url = body.get("url")
            if not url:
                raise RuntimeError(f"No URL in response: {body}")
            return url, payload
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(delay)
    raise last_error or RuntimeError("poster generation failed")


def download(url: str) -> Image.Image:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return Image.open(BytesIO(response.read())).convert("RGB")


def square(image: Image.Image) -> Image.Image:
    edge = min(image.size)
    left = (image.width - edge) // 2
    top = (image.height - edge) // 2
    return image.crop((left, top, left + edge, top + edge)).resize((1024, 1024), Image.Resampling.LANCZOS)


def add_title(image: Image.Image) -> Image.Image:
    base = image.convert("RGBA")
    scrim = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    # Opaque title field also removes any pseudo-type inherited from the style
    # reference; release art must never carry another game's faint title.
    sd.polygon([(0, 0), (1024, 0), (1024, 245), (0, 300)], fill=(29, 16, 34, 255))
    base = Image.alpha_composite(base, scrim)
    draw = ImageDraw.Draw(base)
    font = ImageFont.truetype(str(FONT), 176)
    subtitle = ImageFont.truetype(str(FONT), 38)
    ink = (29, 16, 34, 255)
    paper = (241, 229, 197, 255)
    yellow = (243, 240, 45, 255)
    red = (237, 74, 55, 255)
    draw.text((66, 50), "GET OFF!", font=font, fill=ink, stroke_width=15, stroke_fill=ink)
    draw.text((52, 34), "GET OFF!", font=font, fill=paper, stroke_width=5, stroke_fill=ink)
    draw.polygon([(58, 218), (496, 207), (503, 265), (64, 276)], fill=red, outline=ink, width=7)
    draw.text((84, 218), "RUSH HOUR PHYSICS", font=subtitle, fill=paper, stroke_width=2, stroke_fill=ink)
    draw.polygon([(795, 184), (962, 160), (973, 234), (808, 252)], fill=yellow, outline=ink, width=7)
    arrow = ImageFont.truetype(str(FONT), 54)
    draw.text((830, 180), "GO!", font=arrow, fill=ink)
    return base.convert("RGB")


def main() -> None:
    if "--reuse-raw" in sys.argv:
        raw = Image.open(RAW).convert("RGB")
        url = json.loads(RECORD.read_text()).get("output_url", "reused-local-platform-output") if RECORD.exists() else "reused-local-platform-output"
        payload = {"prompt": PROMPT, "ref_url": "https://yinxinghuan.github.io/games/posters/midnight-verdict.png"}
    else:
        url, payload = generate()
        raw = square(download(url))
        RAW.parent.mkdir(parents=True, exist_ok=True)
        raw.save(RAW, quality=96)
    final = add_title(raw)
    final.save(OUT, optimize=True)
    RECORD.write_text(json.dumps({"endpoint": API, "origin": HEADERS["Origin"], "request": payload, "output_url": url}, ensure_ascii=False, indent=2) + "\n")
    print(url)
    print(OUT)


if __name__ == "__main__":
    main()
