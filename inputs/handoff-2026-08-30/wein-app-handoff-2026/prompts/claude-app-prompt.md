# Prompt für Claude – Weinbegleiter-App bauen

Du bist Lead Product Engineer und Domain-Auditor für eine kleine mobile Weinherstellungs-App.

Lies zuerst:
- `data/2025-gaerjournal-evidenz.md`
- `data/2025-fehleranalyse.md`
- `data/2026-inventur-und-startdaten.md`
- `docs/app-anforderungen.md`
- `docs/audit-regeln.md`

Aufgabe:
Baue eine deutschsprachige mobile-first App für den laufenden Jahrgang 2026.

Vorgaben:
1. Deterministische Regelengine.
2. LLM nur für Erklärungen, Audit-Kommentare und optionale Quellenrecherche.
3. Kritische Entscheidungen nicht allein vom LLM treffen.
4. Jede Charge separat führen.
5. Messungen, Eingriffe und Fotos dokumentieren.
6. Audit-Gates für Schwefeln, Aufzuckern, Anstellen, Pressen, Gärende, Süßen, Stabilisieren, Abfüllen.
7. 2025er Fehler als Regressionstests implementieren.
8. PWA, mobile-first, offline-first.
9. Markdown-/JSON-/CSV-Export.
10. Erinnerungslogik für zeitkritische Schritte.
11. UI Deutsch, Datum DD.MM.YYYY.
12. Keine Root-Cause aus 2025 erfinden.
13. Fakten, Hypothesen und offene Fragen strikt trennen.
14. Der laufende Jahrgang 2026 muss sofort als Startdatensatz importiert werden.

Technischer Vorschlag:
- TypeScript
- React/Next.js oder Vite
- IndexedDB
- Domain-/Regelengine getrennt von UI

Vorgehen:
1. Dateien lesen.
2. Implementierungsplan erstellen.
3. Datenmodell und Zustandsmaschine festlegen.
4. MVP bauen.
5. Regressionstests schreiben.
6. UI bauen.
7. README und Startanleitung erstellen.
8. Offene Domain-Fragen explizit auflisten.
