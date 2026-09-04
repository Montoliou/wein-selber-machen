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

## Befund: Datenverlust auf dem iPad

Die iPad-Sicherung enthielt **ausschließlich den Startdatensatz** — 26 Messungen,
alle vom 02.09., keine einzige eigene Kennung, kein Klimapunkt, keine Sensor-
Konfiguration. Die am Vormittag des 03.09. dort erfassten Werte (08:44–09:01)
waren nicht mehr vorhanden.

Ursache mit hoher Wahrscheinlichkeit: der Schritt „Website-Daten löschen" aus einer
Aktualisierungsanleitung von Claude. Das löscht die IndexedDB und damit den gesamten
Bestand; die App legt danach den Startdatensatz neu an.

**Wiederhergestellt** aus `journal/2026-jahrgang.md` und den Screenshots vom 03.09.:
sieben Messungen (Temperatur bei allen vier Bottichen, Mostgewicht bei 2, 3 und 4).
Jede trägt eine Notiz, dass sie rekonstruiert ist. Bottich 1 hatte am Vormittag
kein Mostgewicht — das war schon damals die einzige echte Lücke.

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

50 Messungen (43 vom MacBook, 7 rekonstruiert), 20 Ereignisse, 4 Chargen,
12 Behälter, 5 Reminder, 7 Wiki-Seiten, 4 Vorratsposten, 1 Klimapunkt,
Sensor-Konfiguration enthalten.
