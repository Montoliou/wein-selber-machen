---
name: weinbegleiter-stand-2026-09-04
titel: Weinbegleiter — bereinigter Gesamtstand 04.09.2026
erzeugt: 2026-09-04
erzeugt_von: Claude Code — Sitzung "Wein-App Bau"
gueltig: aktuell
typ: datensicherung
projekt: wein-selber-machen
ueberholt: weinbegleiter-stand-2026-09-02
---

Kanonischer Stand nach dem Abgleich der beiden Geräte am 04.09.2026.
Auf beiden Geräten zu importieren (Mehr → JSON-Sicherung importieren).

## Befund: kein Datenverlust, sondern zwei Speicherbereiche

Die iPad-Sicherung enthielt nur den Startdatensatz (26 Messungen, Version 2, kein Sensor).
Erste Diagnose „Website-Daten gelöscht" war falsch — Andi hat nichts gelöscht, die
Home-Bildschirm-App zeigt die Vormittagswerte weiterhin.

Tatsächliche Ursache: Auf iOS hat eine Home-Bildschirm-Web-App eine eigene Datenbank,
getrennt von Safari. Der Export lief vermutlich über Safari, wo die App eine frische
Instanz mit Startdatensatz anlegt.

Die sieben Vormittagswerte wurden aus der iPad-Anzeige übernommen (Duplikate weggelassen),
dazu acht Unterstoßen-Ereignisse vom 03.09. nach Andis Angabe.

## Zweiter Befund: Kennungen im Startdatensatz sind nicht stabil

Die Startdatensätze werden mit einem fortlaufenden Zähler nummeriert (`m-27`, `e-42` …).
Ändert sich `startdaten.ts`, verschieben sich alle folgenden Nummern. Konkret war
`e-42` auf dem iPad das Unterstoßen von Bottich 4, auf dem MacBook das Aufzuckern
von Bottich 3.

**Ein Abgleich über die Kennung führt dadurch unverwandte Datensätze zusammen.**
Für diese Datei war das folgenlos, weil das iPad nichts Eigenes beitrug und der
MacBook-Stand unverändert übernommen wurde. Für den Geräteabgleich aus H5 ist es
ein Risiko und gehört im Review von PR #5 geprüft. Saubere Lösung: inhaltsabgeleitete
statt fortlaufende Kennungen im Startdatensatz.

## Inhalt

50 Messungen (43 vom MacBook, 7 aus der iPad-Anzeige), 28 Ereignisse (20 Seed, 8 Unterstoßen), 4 Chargen,
12 Behälter, 5 Reminder, 7 Wiki-Seiten, 4 Vorratsposten, 1 Klimapunkt,
Sensor-Konfiguration enthalten.
