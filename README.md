# Lernkiste

Eine kleine Lern-App fürs Handy, gebaut wie ein Lernpfad mit Kisten und Stickern:
kurze Lektionen, jede mit einer gesprochenen Erklärung, Aufgaben mit kleinen
Zahlen, am Ende eine Kiste mit Belohnung.

Live: https://herrohlsen.github.io/lernkiste/

Aktueller Inhalt: Mathe Klasse 5, „Mal und Geteilt" (Fachbegriffe, Zahlenmauern,
Punkt vor Strich, Rechengesetze und Rechentricks, Überschlag, schriftliches
Multiplizieren, Sachaufgaben). Weitere Fächer und Themen kommen als eigene
Dateien unter `content/` dazu.

## Wie es funktioniert

- Jede Lektion erzeugt ihre Aufgaben zufällig neu (`make()`), kann also beliebig
  oft gespielt werden.
- Die Erklärung jeder Lektion liegt als Audio unter `audio/<lektion>.mp3`
  (erzeugt mit Gemini TTS) und wird beim ersten Start automatisch abgespielt.
  Fehlt die Datei, liest die Sprachausgabe des Handys den Text vor.
- Aufgabentexte und Tipps werden auf Wunsch vorgelesen (Lautsprecher-Knopf,
  automatisch einschaltbar unter „Ich").
- Belohnung: 10 XP pro Aufgabe (5, wenn ein zweiter Versuch nötig war),
  Level aus XP, Muscheln und eine Kiste pro Lektion. Ohne Fehler ist die Kiste
  golden und enthält immer einen Sticker, legendäre Sticker gibt es nur dort.
- Fortschritt liegt in `localStorage` auf dem Gerät. Unter „Ich" lässt er sich
  als Datei sichern und auf einem anderen Gerät laden.
- Lektionen schalten sich nacheinander frei. Unter „Ich" können Eltern
  „Alle Lektionen offen" einschalten.

## Aufs Handy

Seite im Browser öffnen, dann „Zum Startbildschirm hinzufügen". Danach startet
sie wie eine App im Vollbild.

## Entwickeln

```
python3 -m http.server 8765      # dann http://localhost:8765/
python3 tools/make_audio.py      # fehlende Audios rendern (GEMINI_API_KEY nötig)
```

Dateien:

- `index.html`, `css/app.css`: Oberfläche
- `js/engine.js`: Aufgabentypen (choice, input, highlight, wall, match, schriftlich)
- `js/app.js`: Pfad, Lektion, Kiste, Sammlung, Einstellungen, Speicher
- `content/mathe/multiplizieren.js`: Inhalt (Einheiten, Lektionen, Generatoren, Sprechtexte)
- `tools/make_audio.py`: Erklärungen rendern und per Rück-Transkription prüfen
