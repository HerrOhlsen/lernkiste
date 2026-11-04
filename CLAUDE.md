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

Die App zeigt bisher nur `LK.courses[0]`. Beim zweiten Kurs wird eine
Kursauswahl im Pfad nötig.

## Speicher

`localStorage`-Schlüssel `lernkiste-v1`. Nur additiv erweitern, fehlende Felder
kommen aus `DEFAULTS`. Schlüssel nicht umbenennen, sonst ist der Fortschritt weg.

## Testen

Kein Test-Framework. `python3 -m http.server 8765`, dann im Browser bei
Handybreite alle Aufgabentypen durchspielen. Für einen Durchlauf aller
Lektionen gibt es Puppeteer-Skripte in Claudes Sitzungs-Scratchpad, sie
beantworten jede Aufgabe über `box._runner` (Test-Haken in `engine.js`).
