"""Encrypt the vocabulary and its media into vocab/ for GitHub Pages.

Book material must not be readable in this public repo. The source lives in
the private folder ../englisch-quelle (OneDrive, never committed):
  vokabeln.json            cards, sorted into books and sets
  medien/audio/<id>-w.mp3  headword audio      (tools/make_vocab_audio.py)
  medien/audio/<id>-s.mp3  example sentence    (tools/make_vocab_audio.py)
  medien/bilder/<id>.webp  picture             (tools/make_vocab_images.py)
  passwort.txt             the password (created on first run)
  schluessel.json          salt for the key (created on first run, keep it)

Output, all AES-256-GCM (12-byte IV + ciphertext with tag):
  vocab/key.json   salt and iteration count (public, needed to derive the key)
  vocab/data.bin   all cards as JSON
  vocab/m/<x>.bin  one file per media item. The name is an HMAC of the content,
                   so nothing about the word leaks and unchanged media keep their
                   name (no churn in git).

The app derives the same key with PBKDF2-SHA256 from the password the parent
types in once. Changing the password: delete passwort.txt AND schluessel.json,
run again; every device then needs the new password.

Usage: python3 tools/build_vocab.py
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "englisch-quelle"
OUT = ROOT / "vocab"
ITER = 600_000
# Random password, typed once per device: 12 characters from 31 unambiguous
# lowercase letters and digits (about 59 bits), in groups of four.
ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def safe(card_id):
    return re.sub(r"[^a-z0-9~-]+", "_", card_id.lower())


def get_key():
    pw_file, salt_file = SRC / "passwort.txt", SRC / "schluessel.json"
    if not pw_file.exists():
        raw = "".join(secrets.choice(ALPHABET) for _ in range(12))
        pw = "-".join(raw[k:k + 4] for k in range(0, 12, 4))
        pw_file.write_text(pw + "\n", encoding="utf-8")
        print("Neues Passwort angelegt:", pw)
    pw = pw_file.read_text(encoding="utf-8").strip()
    if not salt_file.exists():
        salt_file.write_text(json.dumps({"salt": secrets.token_hex(16), "iter": ITER}), encoding="utf-8")
    meta = json.loads(salt_file.read_text(encoding="utf-8"))
    key = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(meta["salt"]), meta["iter"], 32)
    return key, meta


def seal(aes, data: bytes) -> bytes:
    iv = os.urandom(12)
    return iv + aes.encrypt(iv, data, None)


def main():
    data = json.loads((SRC / "vokabeln.json").read_text(encoding="utf-8"))
    key, meta = get_key()
    aes = AESGCM(key)
    OUT.mkdir(exist_ok=True)
    (OUT / "m").mkdir(exist_ok=True)
    (OUT / "key.json").write_text(json.dumps({"salt": meta["salt"], "iter": meta["iter"], "v": 1}), encoding="utf-8")

    used = set()
    stats = {"karten": 0, "audio": 0, "bilder": 0, "neu": 0}

    def media(path: Path):
        if not path.exists():
            return None
        raw = path.read_bytes()
        name = hmac.new(key, hashlib.sha256(raw).digest(), "sha256").hexdigest()[:24]
        used.add(name)
        target = OUT / "m" / f"{name}.bin"
        if not target.exists():
            target.write_bytes(seal(aes, raw)); stats["neu"] += 1
        return name

    out_books = []
    for book in data["buecher"]:
        sets = []
        for s in book["sets"]:
            cards = []
            for c in s["karten"]:
                sid = safe(c["id"])
                card = {k: c[k] for k in ("id", "en", "de") }
                for k in ("ipa", "ex", "exDe", "note", "sec", "say"):
                    if c.get(k) and not (k == "say" and c["say"] == c["en"]):
                        card[k] = c[k]
                a = media(SRC / "medien" / "audio" / f"{sid}-w.mp3")
                e = media(SRC / "medien" / "audio" / f"{sid}-s.mp3") if c.get("ex") else None
                i = media(SRC / "medien" / "bilder" / f"{sid}.webp") if c.get("bild") else None
                if a: card["a"] = a; stats["audio"] += 1
                if e: card["s"] = e; stats["audio"] += 1
                if i: card["i"] = i; stats["bilder"] += 1
                cards.append(card); stats["karten"] += 1
            sets.append({"id": s["id"], "titel": s["titel"], "emoji": s.get("emoji", "📘"), "art": s.get("art", "unit"), "karten": cards})
        out_books.append({"id": book["id"], "titel": book["titel"], "sets": sets})

    payload = json.dumps({"v": 1, "buecher": out_books}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    (OUT / "data.bin").write_bytes(seal(aes, payload))

    removed = 0
    for f in (OUT / "m").glob("*.bin"):
        if f.stem not in used:
            f.unlink(); removed += 1
    print(f"{stats['karten']} Karten, {stats['audio']} Audios, {stats['bilder']} Bilder, "
          f"{stats['neu']} Medien neu verschlüsselt, {removed} alte entfernt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
