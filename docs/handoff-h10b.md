---
id: wein-h10b-review-nachbesserung
repo: wein-selber-machen
host: mac
base_branch: feature/wein-h10-ausbau-lose-abstich
priority: hoch
scope: Nachbesserung von PR #12 (H10) nach dem Review vom 04.10.2026. Der Review lief im Browser mit echten Klicks und Andis echten Zahlen. Die Domänenfehler sind bereits behoben und in den H10-Branch zusammengeführt; hier geht es um sieben Oberflächenbefunde, darunter zwei rote Tests.
allowed_paths: ["app/src/ui/**", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE Tests gruen, auch die zwei derzeit roten in app.test.ts ('fuehrt beim Abstich fuenf Chargen weiter…' und 'zeigt nach dem Abstich fuer 5,3 L…'). domain/ wird NICHT angefasst."
  - "B1 ROTE TESTS: fuehreAbstichBisZumSpeichern klickt fest viermal auf 'abstich-weiter'. Seit der neuen Pruefung 'abstich-ausbaugefaess' hat das Gate sechs Pruefungen. Die Hilfsfunktion klickt 'abstich-weiter', solange der Knopf existiert, statt eine Anzahl anzunehmen. Kein Test darf die Zahl der Gate-Pruefungen fest kodieren."
  - "B2 PRESS-FORMULAR BLOCKIERT ECHTE DATEN: In speicherePressTeilung steht `if (plan.reichtNicht) return null` vor der Auswertung der eingegebenen Liter, und die Meldung lautet pauschal 'vollstaendig eintragen'. Das Press-Formular dokumentiert, was bereits passiert ist. Neu: Massgeblich sind die eingegebenen Literzahlen je Gefaess. Liegt ihre Summe ueber dem Gesamtvolumen, Fehler mit genau diesem Grund. Bleibt ein Rest, wird er als Auffuellflasche im volumenHistorie-Anlass vermerkt. plan.reichtNicht ist im Press-Formular nur ein sichtbarer Hinweis, kein Abbruch. Jede Fehlermeldung nennt den konkreten Grund (welche Fraktion, was fehlt oder was nicht passt). Testfall: Presswein 6,5 L in einen 5-L-Ballon mit 5,0 L eingetragen wird gespeichert."
  - "B3 ZWISCHENGEFAESSE NICHT VORANKREUZEN: Im Abstich sind derzeit alle Gefaesse vorab angehakt, auch die vier Gaerbottiche. Vorab angehakt werden nur die Gefaesse des Loses, und nur solche, fuer die istAusbaugefaess() aus domain/regeln.ts true liefert. Weitere freie Gefaesse stehen zur Wahl, Gaerbottiche mit dem Zusatz 'nur Zwischengefaess'."
  - "B4 SCHWEFEL MIT EIGENEM ZEITPUNKT: Der Schwefelschritt nach dem Abstich uebernimmt den Zeitpunkt des Abstichs. Beim Nachtragen stimmt das nicht: Abstich am 26.09.2026, Schwefel am 04.10.2026. Der Schwefelschritt bekommt ein eigenes Zeitfeld, vorbelegt mit dem Abstichzeitpunkt, aenderbar."
  - "B5 'MENGE OFFEN' TROTZ FUELLLITER: Die Chargenkarten unter 'Heute' und der Kopf der Chargenseite zeigen fuer jede Los-Charge 'Menge offen', obwohl fuellLiter gesetzt ist. Bei Chargen mit fuellLiter wird '<fuellLiter> L' angezeigt; mengeKg nur bei Maische."
  - "B6 FUNKTIONSNAME IN DER OBERFLAECHE: Im Press-Formular steht 'Die App verteilt die Gesamtmenge mit fuellplan()'. Neu: 'Die App schlaegt eine Verteilung ohne halbvolles Gefaess vor. Die Liter sind aenderbar.' Allgemein: keine Funktions- oder Feldnamen in Texten, die Andi liest."
  - "B7 KONFLIKT FRUEHER ZEIGEN: Ein Gefaess laesst sich im Press-Formular gleichzeitig beim Vorlauf und beim Presswein ankreuzen; erst das Absenden meldet den Konflikt. Ist ein Gefaess bei einer Fraktion gewaehlt, wird es bei der anderen deaktiviert und mit 'beim Vorlauf gewaehlt' bzw. 'beim Presswein gewaehlt' beschriftet."
  - "T1 TESTS ueber echte Klicks fuer B2, B3, B4, B5 und B7."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Der PR enthaelt '## Offene Punkte'."
---

# Auftrag H10b — Nachbesserung nach dem Review von H10

## Wie der Review lief

Lokal gebaut aus `main` + H11 + H10, im Browser durchgeklickt mit den echten Zahlen des
Jahrgangs: Press-Gate wie am 09.09.2026 (Vorlauf 27,73 L in fünf 5-L-Ballons und einen
3-L-Ballon, Presswein 6,5 L), danach der Abstich wie am 26.09.2026.

**Was funktioniert:** Lose mit einer Charge je Gefäß, richtige Namen und Herkunft, Zeitpunkt
übernommen, Maische archiviert. Konflikt zwischen Vorlauf und Presswein wird beim Absenden
abgefangen. Abstich mit allen Prüfungen, Füllplan, Füllstand „im Hals", Schwefelvorschlag in
Millilitern mit Rechenweg, sauber gespeichert. Fünf neue Tests über echte Klicks.

## Was nicht funktionierte und schon behoben ist (Domäne)

1. Das Gärende wurde für jedes Gefäß einzeln verlangt. Andi misst ein Gefäß stellvertretend.
   Jetzt `gaerendeGateFuerLos()`.
2. Der Füllplan legte 18,23 L in einen 20-L-Gärbottich. Jetzt `istAusbaugefaess()`;
   Kunststoffbottiche gehen nicht in den Füllplan, eigene Prüfung `abstich-ausbaugefaess`.
3. Die Restgrenze für Auffüllflaschen war mit 1,5 L zu knapp für den echten Presswein.

Diese Korrekturen sind per Merge-Commit `6a37900` im H10-Branch. Die neue sechste Prüfung
ist der Grund für die zwei roten Tests (B1).

## Was hier zu tun ist

Die sieben Punkte B1 bis B7 oben. B2 ist der wichtigste: Ohne ihn kann Andi seinen echten
Presswein vom 09.09. nicht nachtragen, und genau das war der Zweck von H10.
