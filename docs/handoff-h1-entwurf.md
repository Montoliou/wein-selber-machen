---
id: wein-h1-app-mvp
repo: wein-selber-machen
host: mac
priority: hoch
scope: MVP der PWA "Weinbegleiter 2026" gegen die bereits vorhandene, getestete Domänen-Regelengine bauen. UI, Persistenz (IndexedDB), PWA-Hülle, Import des Startdatensatzes 2026, Reminder mit .ics-Export, Wiki, Export. Die Domänenschicht ist Spezifikation und wird NICHT verändert.
allowed_paths: ["app/src/ui/**", "app/src/speicher/**", "app/src/main.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "app/src/ics.ts", "app/src/sensor.ts", "app/index.html", "app/public/**", "app/vite.config.ts", "app/package.json", "app/README.md", ".ftp-credentials.vorlage"]
forbidden_paths: ["app/src/domain/regeln.ts", "app/src/domain/oenologie.ts", "app/src/domain/regressionen-2025.test.ts", "inputs/**", "outputs/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 27 Regressionstests in app/src/domain/regressionen-2025.test.ts bleiben gruen. Wer eine Regel abschwaechen will, schreibt das in '## Offene Punkte' des PR statt den Test anzupassen."
  - "npm run build erzeugt EINE app/dist/index.html (vite-plugin-singlefile) plus sw.js und manifest.webmanifest. Keine externen Requests, keine CDN-Referenzen, relative Pfade."
  - "PWA: auf dem iPhone ueber Safari 'Zum Home-Bildschirm' installierbar, laeuft danach vollstaendig offline. Service Worker cached die App-Huelle."
  - "Persistenz in IndexedDB. Kein Datenverlust bei Reload oder Offline-Nutzung. Fotos werden als Blob gespeichert."
  - "Startdatensatz 2026 ist beim ersten Start sofort da: drei Chargen (Bottich 1 11,0 kg / Wanne 1 23,5 kg / Wanne 2 14,0 kg), Phase KALTMAZERATION, Startzeit 30.08.2026 17:00; Behaelter: Gaerbottich 1 (20 L, vorhanden), Gaerbottich 2-4 (20 L, vorhandenAb 2026-09-02), Gaerballon 1-2 (5 L, vorhanden), Gaerballon 3-6 (5 L, vorhandenAb 2026-09-04); Vorrat: Kaliumpyrosulfit 4 g, Hefenaehrsalz 60 g, Reinzuchthefe Steinberg 4 Beutel."
  - "Ampel und Befunde kommen AUSSCHLIESSLICH aus domain/regeln.ts (befundeFuerCharge, ampelFuerCharge). Keine zweite Regelquelle in der UI, keine hartkodierten Schwellenwerte im Frontend."
  - "Gates werden ueber gateFuerPhase() gerendert. Ein nicht freigegebenes Gate deaktiviert den Weiter-Button sichtbar. 'Unbekannt' (erfuellt === null) wird optisch anders dargestellt als 'nicht erfuellt' (false), blockiert aber gleichermassen."
  - "Rechner fuer Schwefeln, Aufzuckern und Naehrsalz nutzen oenologie.ts. Jedes Ergebnis zeigt Formel und Sicherheitsgrad (gemessen/gerechnet/geschaetzt) an. Beim Schwefeln wird zusaetzlich der Restvorrat gegengerechnet und gewarnt, wenn die Zugabe ihn uebersteigt."
  - "Jede Zugabe wird als Ereignis mit Stoff, Menge, Einheit, Zeitpunkt, Charge und PFLICHT-Begruendung gespeichert (Audit-Regel 13). Ohne Begruendung kein Speichern."
  - "Reminder: Die App erzeugt eine .ics-Datei je Termin und eine Sammel-.ics fuer den Jahrgang (VEVENT mit VALARM, DTSTART lokal, deutscher SUMMARY und DESCRIPTION). Download ueber Blob-URL. KEIN eigenes Push-/Benachrichtigungssystem bauen."
  - "Wiki: durchsuchbare Seiten mit Tags, Markdown-Teilmenge (Ueberschriften, Fett, Listen, Links), eigene Seiten anlegbar und editierbar, in IndexedDB persistiert. Mindestens die sechs im Mockup gezeigten Startseiten sind mit echtem Fachinhalt gefuellt."
  - "Seite '2025 Post-Mortem' trennt sichtbar in GESICHERT / WAHRSCHEINLICH / OFFEN, uebernommen aus data/2025-fehleranalyse.md. Keine erfundene Root Cause, keine Zusammenfuehrung der drei Kategorien."
  - "Export: Markdown (Jahrgang lesbar), CSV (Messreihen), JSON (Vollsicherung, wieder importierbar), ZIP inkl. Fotos."
  - "Kellersensor: konfigurierbarer HTTPS-Endpunkt mit Adaptern shelly-cloud / govee / generisch-json. Manuelle Eingabe funktioniert IMMER und ist der Default. Bei HTTP-URL klare Fehlermeldung wegen Mixed Content statt stillem Fehlschlag."
  - "UI durchgehend deutsch, Datumsformat DD.MM.YYYY, Dezimaltrennzeichen Komma, mobile-first ab 360 px. Optisch am abgenommenen Mockup outputs/mockup-weinbegleiter-v1.html orientiert."
  - "app/README.md beschreibt Start (npm run dev), Build, Deploy-Weg ueber den sftp-deploy-Skill und die Datenstruktur."
---

# Auftrag H1 — Weinbegleiter 2026, MVP

## Was schon da ist (NICHT anfassen)

`app/src/domain/` enthaelt die fertige, getestete Fachschicht. Sie ist die Spezifikation
dieses Auftrags, kein Vorschlag:

| Datei | Inhalt |
|---|---|
| `typen.ts` | Datenmodell, 16 Phasen, Messgroessen, Ampel. Darf um Felder ERWEITERT werden. |
| `oenologie.ts` | SO₂ molekular, Zuckerzugabe, Naehrsalzplan, Kopfraum, Ausbeute. Read-only. |
| `regeln.ts` | Befunde, Ampel, fuenf Gates. Read-only. |
| `regressionen-2025.test.ts` | 27 Tests, je einem Fehler aus 2025 zugeordnet. Read-only. |

Stand bei Uebergabe: 27 von 27 Tests gruen (`npx vitest run`).

## Warum das so streng ist

Der Jahrgang 2025 ist verloren gegangen: der rote Hauptwein durch monatelangen Ausbau mit
Kopfraum ohne Kontrolle, der suesse Weisswein durch Refermentation in der Flasche.
Die Regeln in `domain/` sind die Gegenmassnahme. Eine UI, die sie umgeht oder eigene
Schwellenwerte mitbringt, macht die App wertlos.

Quellen (im Repo unter `inputs/handoff-2026-08-30/wein-app-handoff-2026/`):
`data/2025-gaerjournal-evidenz.md` · `data/2025-fehleranalyse.md` ·
`data/2026-inventur-und-startdaten.md` · `docs/app-anforderungen.md` · `docs/audit-regeln.md`

## Design-Soll

`outputs/mockup-weinbegleiter-v1.html` — von Andi abgenommen. Klickbares Mockup mit
sieben Ansichten. Farbwelt, Kartenaufbau, Ampeldarstellung, Gate-Checkliste und
Rechner-Ausgabe (grosse Zahl, Merker fuer Sicherheitsgrad, Formelzeile, Warnbox)
sind als Soll zu verstehen, nicht als Anregung.

## Bauen

1. **Persistenzschicht** `src/speicher/` — IndexedDB-Wrapper fuer `Datenstand` plus
   getrennten Foto-Store. Migrationen ueber `version`.
2. **Startdaten** `src/startdaten.ts` — Seed aus der Inventur, siehe done_criteria.
3. **UI** `src/ui/` — Ansichten Heute, Charge, Messung erfassen, Rechner, Gate,
   Termine, Wiki, Mehr. Navigation wie im Mockup.
4. **ICS** `src/ics.ts` — VEVENT-Erzeugung, Sammel- und Einzelexport.
5. **Wiki** `src/wiki-inhalte.ts` — sechs Startseiten mit echtem Fachinhalt plus
   die Post-Mortem-Seite.
6. **Sensor** `src/sensor.ts` — Adapter, HTTPS-Pflicht, manueller Fallback.
7. **PWA** — `public/manifest.webmanifest`, `public/sw.js`, Icons.
8. **Export** — Markdown, CSV, JSON, ZIP.

## Constraints

- Vanilla TypeScript, kein React, keine Runtime-Dependency. Nur die vorhandenen
  Dev-Dependencies (vite, typescript, vitest, vite-plugin-singlefile).
- Kein Netzwerkzugriff ausser dem optional konfigurierten Sensor-Endpunkt.
- Kein LLM-Aufruf. Alle Entscheidungen kommen deterministisch aus `domain/`.
- Bei fachlicher Unklarheit: `## Offene Punkte` im PR. **Nicht raten, nicht Regeln aufweichen.**

## Nach dem Bau

Screenshots der sieben Ansichten in den PR (iPhone-Breite 375 px), damit Claude
gegen das Mockup reviewen kann.
