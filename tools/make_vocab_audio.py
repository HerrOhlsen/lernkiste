"""Render British English audio for vocabulary cards with Gemini TTS.

The vocabulary itself is book material and never lives in this repo. This
script reads it from the private source folder next to the repo
(../englisch-quelle/vokabeln.json) and writes MP3s to
../englisch-quelle/medien/audio/. tools/build_vocab.py later encrypts them.

Per card: <id>-w.mp3 (headword, field "say") and, if the card has an example
sentence, <id>-s.mp3. Existing files are skipped unless --force.
Every clip is transcribed again and compared with the text; mismatches are
listed in ../englisch-quelle/medien/audio-pruefung.json.

Usage: python3 tools/make_vocab_audio.py [--sets gl1-welcome,gl1-u1] [--workers 4] [--force]
Needs GEMINI_API_KEY, google-genai and ffmpeg.
"""
import argparse
import io
import json
import re
import subprocess
import sys
import tempfile
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "englisch-quelle"
OUT = SRC / "medien" / "audio"
MODEL = "gemini-3.8-flash-tts"
VOICE = "Erinome"

client = genai.Client()


def safe(card_id):
    return re.sub(r"[^a-z0-9~-]+", "_", card_id.lower())


def example_text(ex):
    # Several example lines become one clip; drop arrows and ellipses.
    s = ex.replace("\n", " ").replace("…", "").replace("↔", ",")
    s = re.sub(r"\s+", " ", s).strip(" ,")
    s = re.sub(r"\b([A-Z]{2,3})\b", lambda m: ".".join(m.group(1)) + "." if m.group(1) != "OK" else m.group(1), s)
    s = s.replace("..", ".")
    if s and s[-1] not in ".!?":
        s += "."
    return s


def word_text(say):
    # A bare lowercase word sometimes makes the model invent a whole sentence;
    # a full stop prevents that. Short all-caps abbreviations are spelled out.
    s = re.sub(r"\b([A-Z]{2,3})\b", lambda m: ".".join(m.group(1)) + "." if m.group(1) not in ("OK",) else m.group(1), say)
    if s and s[-1] not in ".!?…":
        s += "."
    return s


def duration(mp3):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def tts(text):
    sc = types.SpeechConfig(
        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)),
        language_code="en-GB",
    )
    for attempt in range(4):
        try:
            r = client.models.generate_content(
                model=MODEL, contents=text,
                config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=sc))
            data = r.candidates[0].content.parts[0].inline_data.data
            if data[:4] != b"RIFF":
                buf = io.BytesIO()
                with wave.open(buf, "wb") as w:
                    w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
                data = buf.getvalue()
            return data
        except Exception as e:  # rate limits, sporadic content blocks
            if attempt == 3:
                raise
            time.sleep(4 * (attempt + 1))


def to_mp3(wav, out):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav); tmp = f.name
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp,
                    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                           "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                           "adelay=120,loudnorm=I=-19:TP=-2",
                    "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "48k", "-ac", "1", str(out)], check=True)
    Path(tmp).unlink()


def verify(mp3, text):
    """Return None if the clip says the text, else a short description."""
    words = len(text.split())
    dur = duration(mp3)
    if dur > 1.6 + 0.75 * words:
        return f"zu lang ({dur:.1f} s für {words} Wörter)"
    r = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=[types.Part.from_bytes(data=mp3.read_bytes(), mime_type="audio/mpeg"),
                  f"A vocabulary app clip should say exactly: \"{text}\"\n"
                  "Listen. If it says this text (homophones, British/American spelling, digits vs. number words "
                  "and abbreviations spelled out letter by letter all count as a match), answer MATCH. "
                  "If it says anything else, adds or leaves out words, answer MISMATCH: <what you hear>."])
    ans = (r.text or "").strip()
    return None if ans.upper().startswith("MATCH") else ans[:120]


def job(item, force, check, recheck):
    text, out = item
    if out.exists() and not force and not recheck:
        return None
    problem = verify(out, text) if (recheck and out.exists()) else "neu"
    tries = 0
    while problem and tries < 3:
        to_mp3(tts(text), out)
        tries += 1
        problem = verify(out, text) if check else None
    return None if not problem else {"datei": out.name, "soll": text, "ist": problem}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sets", help="comma-separated set ids (default: all)")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--no-check", action="store_true")
    ap.add_argument("--recheck", action="store_true", help="verify existing clips, re-render failures")
    a = ap.parse_args()
    data = json.loads((SRC / "vokabeln.json").read_text(encoding="utf-8"))
    want = set(a.sets.split(",")) if a.sets else None
    OUT.mkdir(parents=True, exist_ok=True)
    items = []
    for book in data["buecher"]:
        for s in book["sets"]:
            if want and s["id"] not in want:
                continue
            for c in s["karten"]:
                items.append((word_text(c["say"]), OUT / f"{safe(c['id'])}-w.mp3"))
                if c.get("ex"):
                    items.append((example_text(c["ex"]), OUT / f"{safe(c['id'])}-s.mp3"))
    todo = [i for i in items if a.force or a.recheck or not i[1].exists()]
    print(f"{len(items)} Clips, davon {len(todo)} neu", flush=True)
    problems, done = [], 0
    with ThreadPoolExecutor(a.workers) as ex:
        for res in ex.map(lambda it: job(it, a.force, not a.no_check, a.recheck), todo):
            done += 1
            if res:
                problems.append(res); print("  PRÜFEN", res, flush=True)
            if done % 25 == 0:
                print(f"  {done}/{len(todo)}", flush=True)
    log = SRC / "medien" / "audio-pruefung.json"
    old = json.loads(log.read_text(encoding="utf-8")) if log.exists() else []
    names = {p["datei"] for p in problems}
    merged = [p for p in old if p["datei"] not in names and not any(p["datei"] == t[1].name for t in todo)] + problems
    log.write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"fertig, {len(problems)} zum Prüfen (siehe {log.name})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
