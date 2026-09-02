---
name: weinbegleiter-stand-2026-09-02
titel: Weinbegleiter — Vollsicherung Stand 02.09.2026 abends
erzeugt: 2026-09-02
erzeugt_von: Claude Code — Sitzung "Wein-App Bau"
gueltig: aktuell
typ: datensicherung
projekt: wein-selber-machen
---

Importierbare Vollsicherung für die App unter https://www.montolio.de/wein/
(Mehr → JSON-Sicherung importieren).

Hintergrund: Der Startdatensatz wird beim ersten Öffnen in die IndexedDB des Geräts
geschrieben. Andi hatte die App geöffnet, bevor der Seed auf die echten vier Bottiche
umgestellt war — und ein Deploy überschreibt bestehende Daten grundsätzlich nicht.
Diese Datei stellt den korrekten Stand her, ohne dass Gerätedaten gelöscht werden müssen.

**Korrektur 02.09. abends:** Die erste Fassung war der nackte Datenstand ohne die
Sicherungshülle. Der Import verlangt `{ schema: "weinbegleiter-v1", exportiert, datenstand,
fotos }` und hat die Datei deshalb abgelehnt — die Fehlermeldung erschien nur als kurzes
Statusband und wurde übersehen. Format korrigiert.

Enthält: vier Chargen (Bottich 1–4), 30 Messungen, 20 Ereignisse, 5 Reminder,
Behälterliste, Vorrat und die Wiki-Startseiten. Stand nach der ersten Kontrolle
am 02.09.2026 um 18:15.
