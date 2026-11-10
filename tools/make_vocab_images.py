"""Draw one picture per vocabulary card with the Gemini image model.

Reads ../englisch-quelle/vokabeln.json (private, not in this repo) and draws
every card with "bild": true and a "bildPrompt". Output: 400 px WebP files in
../englisch-quelle/medien/bilder/<id>.webp. Existing files are skipped
unless --force. Look at the pictures before building; a bad one is simply
deleted and drawn again with a better bildPrompt.

Usage: python3 tools/make_vocab_images.py [--sets gl1-u1] [--only <card-id>] [--workers 4] [--force]
"""
import argparse
import json
import re
import io
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from google import genai
from PIL import Image
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "englisch-quelle"
OUT = SRC / "medien" / "bilder"
MODEL = "gemini-3.1-flash-image"
STYLE = ("Children's picture-dictionary illustration in a friendly flat vector style, bold clean shapes, "
         "soft warm colours, gentle shading. One clear subject, centred, filling most of the frame, on a plain "
         "very light cream background. Absolutely no text, no letters, no numbers, no writing anywhere. Subject: ")

client = genai.Client()


def safe(card_id):
    return re.sub(r"[^a-z0-9~-]+", "_", card_id.lower())


def draw(prompt, out):
    for attempt in range(4):
        try:
            r = client.models.generate_content(
                model=MODEL, contents=STYLE + prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="1:1", image_size="1K")))
            part = next(p for p in r.candidates[0].content.parts if p.inline_data)
            img = Image.open(io.BytesIO(part.inline_data.data)).convert("RGB").resize((400, 400), Image.LANCZOS)
            img.save(out, "WEBP", quality=78, method=6)
            return
        except Exception as e:
            if attempt == 3:
                print("  FEHLER", out.name, str(e)[:160], flush=True)
                return
            time.sleep(5 * (attempt + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sets")
    ap.add_argument("--only")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    data = json.loads((SRC / "vokabeln.json").read_text(encoding="utf-8"))
    want = set(a.sets.split(",")) if a.sets else None
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    for book in data["buecher"]:
        for s in book["sets"]:
            if want and s["id"] not in want:
                continue
            for c in s["karten"]:
                if not (c.get("bild") and c.get("bildPrompt")):
                    continue
                if a.only and c["id"] != a.only:
                    continue
                out = OUT / f"{safe(c['id'])}.webp"
                if out.exists() and not a.force:
                    continue
                jobs.append((c["bildPrompt"], out))
    print(f"{len(jobs)} Bilder zu zeichnen", flush=True)
    done = 0
    with ThreadPoolExecutor(a.workers) as ex:
        for _ in ex.map(lambda j: draw(*j), jobs):
            done += 1
            if done % 10 == 0:
                print(f"  {done}/{len(jobs)}", flush=True)
    print("fertig")
    return 0


if __name__ == "__main__":
    sys.exit(main())
