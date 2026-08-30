---
name: regelspezifikation-2026
titel: Önologische Regelspezifikation mit Regressionstests
erzeugt: 2026-08-30
erzeugt_von: Claude Code — Sitzung "Wein-App Bau"
gueltig: aktuell
typ: spezifikation
projekt: wein-selber-machen
ablage: app/src/domain/
---

Die verbindliche Fachwahrheit der App, als ausführbarer TypeScript-Code plus Tests.
Nicht die App selbst — die baut Codex dagegen.

Dateien:
- `app/src/domain/typen.ts` — Datenmodell, Phasen, Messgrößen, Ampel
- `app/src/domain/oenologie.ts` — Rechnungen (SO₂ molekular, Zuckerzugabe, Nährsalz,
  Kopfraum, Ausbeute). Jede Funktion liefert Formel und Sicherheitsgrad mit,
  damit die UI Unsicherheit sichtbar machen kann (Audit-Regel 15).
- `app/src/domain/regeln.ts` — Befunde, Ampel, fünf Gates
- `app/src/domain/regressionen-2025.test.ts` — 27 Tests, je einem dokumentierten
  Fehler des Jahrgangs 2025 zugeordnet (F1–F10)

Stand 30.08.2026: 27 von 27 Tests grün.

Zentrale Konstanten: SO₂-Anteil Kaliumpyrosulfit 57,64 % · pKa 1,81 ·
Zielkorridor molekulares SO₂ 0,5–0,8 mg/L · Gärende SG ≤ 0,9960 bei zwei Messungen
im Abstand ≥ 48 h · Kopfraum gelb ab 2 %, orange ab 5 % · Nährsalz max. 30 g/100 L.
