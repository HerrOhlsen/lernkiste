"""Render the lesson explanations (intro.text) to audio/<lesson-id>.mp3 with
Gemini TTS. Skips files that already exist, unless --force is given.

Usage:  python3 tools/make_audio.py [--voice Puck] [--force] [--only lesson-id]
Needs GEMINI_API_KEY in the environment, the google-genai SDK and ffmpeg.
Afterwards every clip is transcribed again and compared with the script, so a
clip that reads a stage direction aloud or drops a sentence is reported.
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
MODEL = "gemini-3.8-flash-tts"


def lesson_texts():
    """Run the content modules in node and collect {lessonId: introText}."""
    js = """
    global.window = {};
    require(%s); %s
    const out = {};
    for (const c of window.LK.courses) for (const u of c.units) for (const l of u.lessons) out[l.id] = l.intro.text;
    console.log(JSON.stringify(out));
    """ % (json.dumps(str(ROOT / "js" / "util.js")),
           " ".join("require(%s);" % json.dumps(str(p)) for p in sorted((ROOT / "content").rglob("*.js"))))
    res = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def tts(client, text, voice):
    resp = client.models.generate_content(
        model=MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))
            ),
        ),
    )
    data = resp.candidates[0].content.parts[0].inline_data.data
    if data[:4] != b"RIFF":  # raw 24 kHz PCM, wrap it
        import wave, io
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
        data = buf.getvalue()
    return data


def transcribe(client, mp3: Path) -> str:
    resp = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=[types.Part.from_bytes(data=mp3.read_bytes(), mime_type="audio/mpeg"),
                  "Transkribiere das Audio wortgetreu auf Deutsch. Nur der Text, keine Kommentare."],
    )
    return resp.text.strip()


def norm(s):
    return re.sub(r"[^a-z0-9äöüß ]", "", s.lower()).split()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="Puck")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--no-check", action="store_true")
    a = ap.parse_args()
    client = genai.Client()
    AUDIO.mkdir(exist_ok=True)
    texts = lesson_texts()
    for lid, text in texts.items():
        if a.only and lid != a.only:
            continue
        out = AUDIO / f"{lid}.mp3"
        if out.exists() and not a.force:
            print("skip", lid); continue
        print("render", lid, f"({len(text.split())} Wörter)")
        wav = tts(client, text, a.voice)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav); tmp = f.name
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp,
                        "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                        "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", str(out)], check=True)
        Path(tmp).unlink()
        if not a.no_check:
            got = norm(transcribe(client, out)); want = norm(text)
            overlap = len(set(got) & set(want)) / max(1, len(set(want)))
            flag = "" if overlap > 0.85 and abs(len(got) - len(want)) < 0.15 * len(want) else "   <-- PRÜFEN"
            print(f"   check: {overlap:.0%} Wortübereinstimmung, {len(got)} vs {len(want)} Wörter{flag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
