# Arbeitsanweisungen für dieses Repo

Lern-App für Maltes Sohn (5. Klasse), live unter https://herrohlsen.github.io/lernkiste/
(GitHub Pages baut bei jedem Push auf `main`). Der Name des Kindes steht
nirgends im Repo, er wird nur lokal im Browser gespeichert. So bleibt das.

## Sprache

Deutsch mit echten Umlauten und ß, auch im UI-Text. Keine Gedankenstriche.
Code-Kommentare auf Englisch. Zielgruppe ist ein Zehnjähriger, der ungern liest:
kurze Sätze, Du-Form, keine Fachsprache ohne Erklärung.

## Didaktische Leitplanken

- Kleine Zahlen. Rechenvorteile und Gesetze mit Zahlen, die im Kopf gehen.
- Kleinschrittig: Mehrteilige Aufgaben (Zahlenmauer, schriftlich) fragen
  jeden Schritt einzeln ab und sagen selbst, was gemerkt wird.
- Erst einfach, dann schwerer, innerhalb jeder Lektion und über den Pfad.
- Jede Lektion hat einen gesprochenen Erklärtext (`intro.text`). Wer ihn
  ändert, rendert das Audio neu: `python3 tools/make_audio.py --force --only <id>`.
  Reiner Sprechtext, keine Regieanweisungen (die liest das Modell mit vor).
- Zwei Versuche pro Aufgabe, dann die Lösung. Nie bestrafen, nur weniger XP.

## Inhalt erweitern

Neue Themen oder Fächer als eigene Datei unter `content/<fach>/<thema>.js`,
die sich mit `LK.courses.push({...})` registriert, und in `index.html` per
`<script>` einbinden. Jede Lektion braucht `id` (eindeutig, wird Dateiname des
Audios), `titel`, `intro` (`html` + `text`) und `make()`, das ein Array von
Aufgaben zurückgibt. Aufgabentypen stehen in `js/engine.js`.

Die App zeigt bisher nur `LK.courses[0]` im Mathe-Pfad.

## Englisch-Vokabeln (js/vokabeln.js)

Eigener Reiter „Englisch“: Spaced Repetition wie in VocabFlow (vereinfachtes
FSRS, Karteikarte umdrehen, 4 Bewertungen), dazu beim Wiederholen gemischte
Übungen (hören und Bedeutung wählen, Bild wählen, Englisch tippen, Lückensatz).
Die Intervalle werden als 5 Kisten angezeigt. Lernsets (Units) schaltet das
Kind selbst ein, neue Wörter kommen in Buchreihenfolge.

**Die Vokabeln sind Schulbuch-Material und dürfen nie im Klartext ins Repo.**
- Quelle liegt privat in `../englisch-quelle/` (OneDrive, kein Git):
  `vokabeln.json`, `medien/audio`, `medien/bilder`, `passwort.txt`, `schluessel.json`.
- `tools/make_vocab_audio.py` (Gemini TTS, en-GB, mit Rückprüfung) und
  `tools/make_vocab_images.py` (Gemini-Bilder nach `bildPrompt`) schreiben dorthin.
- `tools/build_vocab.py` verschlüsselt alles (AES-GCM, Schlüssel per PBKDF2
  aus dem Passwort) nach `vocab/`. Nur dieser Ordner wird committet.
- Medien-Dateinamen sind HMACs, nichts verrät das Wort.
- Neue Vokabeln: Fotos abtippen, in `vokabeln.json` ergänzen (feste IDs
  `<set>:<slug>`, nie ändern, sonst ist der Lernstand des Wortes weg),
  Audio und Bilder erzeugen, `build_vocab.py`, committen.

Lernstand liegt unter `state.vocab` im selben `localStorage`-Schlüssel und
reist mit Export/Import. Der abgeleitete Schlüssel liegt separat unter
`lernkiste-schluessel` (nicht im Export).

## Übungstage und Abzeichen

Keine Serie (🔥), sondern Übungstage: `state.days` zählt jeden Tag mit fertiger
Mathe-Lektion oder Vokabelarbeit, ein ausgelassener Tag setzt nichts zurück.
Meilensteine in `MILESTONES` (app.js) mit wachsenden Abständen; erreichte
stehen in `state.badges`, neue werden beim nächsten Bildschirm mit Nav gefeiert.
Statistik, Abzeichen und Kalender stehen unter „Ich“.

## Online-Sicherung (js/sync.js)

Privates Supabase-Projekt (Free) mit `tools/supabase.sql`. Browser-Tests
müssen `*.supabase.co` per Route abfangen, sonst landen Testzeilen in der
echten Tabelle.

## Speicher

`localStorage`-Schlüssel `lernkiste-v1`. Nur additiv erweitern, fehlende Felder
kommen aus `DEFAULTS`. Schlüssel nicht umbenennen, sonst ist der Fortschritt weg.

## Testen

Kein Test-Framework. `python3 -m http.server 8765`, dann im Browser bei
Handybreite alle Aufgabentypen durchspielen. Für einen Durchlauf aller
Lektionen gibt es Puppeteer-Skripte in Claudes Sitzungs-Scratchpad, sie
beantworten jede Aufgabe über `box._runner` (Test-Haken in `engine.js`).
