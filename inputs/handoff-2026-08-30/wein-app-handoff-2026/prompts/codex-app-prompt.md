# Prompt für Codex – Weinbegleiter 2026

Arbeite in diesem Projektordner.

Lies zuerst:
- `data/2025-gaerjournal-evidenz.md`
- `data/2025-fehleranalyse.md`
- `data/2026-inventur-und-startdaten.md`
- `docs/app-anforderungen.md`
- `docs/audit-regeln.md`

Ziel:
Funktionierendes MVP einer deutschsprachigen mobile-first Weinherstellungs-App.

Architektur:
- TypeScript
- React/Next.js oder Vite
- PWA
- IndexedDB/lokale Persistenz
- Regelengine getrennt von UI
- kein API-Zwang im MVP

Muss-Funktionen:
1. Jahrgang anlegen
2. Chargen anlegen/splitten
3. Messungen erfassen
4. Behälter + Füllvolumen + Kopfraum erfassen
5. Ereignisse/Zugaben protokollieren
6. Fotos je Ereignis
7. nächste Aktion
8. Audit-Ampel
9. Audit-Gates
10. Reminder
11. Markdown-/JSON-/CSV-Export
12. 2025er Regressionstests

Kritische Regeln:
- Kein „kein Blubbern = Gärende“
- Kein Süßen ohne Refermentations-Gate
- Kein Langzeitausbau mit großem Kopfraum ohne Warnung
- Kein Abfüllen bei Oberflächenfilm/Fruchtfliegen
- H₂S/faule Eier = Charge isolieren
- pH/freien SO₂ in Stabilitätsentscheidungen berücksichtigen
- Nährsalz nicht blind nach Tütengröße dosieren
- jede Zugabe mit Menge, Zeitpunkt, Charge, Begründung

Vorgehen:
1. Kurzen Plan erstellen.
2. Datenmodell und Zustandsmaschine anlegen.
3. Domain-Regeln mit Tests implementieren.
4. UI implementieren.
5. 2026er Startdaten als Demo-/Default-Jahrgang importieren.
6. Seite „2025 Post-Mortem“ erstellen.
7. README und lokalen Startbefehl erstellen.
8. Smoke-Test durchführen.
9. Offene Domain-Fragen ausgeben.

Keine stillen Annahmen. Fehlende Fachentscheidungen als offen markieren.
