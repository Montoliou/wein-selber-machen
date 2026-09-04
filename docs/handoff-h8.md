---
id: wein-h8-gefaesse-verwalten
repo: wein-selber-machen
host: mac
base_branch: main
priority: mittel
scope: Gefäße lassen sich in der App überhaupt nicht verwalten. Am 04.09.2026 kamen die Ballons, eines zerbrochen — Andi konnte weder die Lieferung eintragen noch das kaputte Gefäß austragen und hat ersatzweise nur den Termin abgehakt. Dazu ein Anzeigefehler - die Übersicht zeigt gelieferte Gefäße dauerhaft als "ab <Datum>". Neu; eine Gefäßverwaltung, die konsequente Nutzung von behaelterVerfuegbar() und ein Liefertermin, der eingelöst statt abgehakt wird.
allowed_paths: ["app/src/ui/**", "app/src/main.ts", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 57 bestehenden Tests bleiben gruen. domain/ wird NICHT angefasst - behaelterVerfuegbar() und die Felder ausgemustertAm/ausgemustertGrund liegen bereits in regeln.ts bzw. typen.ts."
  - "G1 EINE QUELLE FUER VERFUEGBARKEIT: Jede Stelle, die fragt ob ein Gefaess benutzbar ist, ruft behaelterVerfuegbar(behaelter, heute) aus domain/regeln.ts. Die handgebaute Bedingung in app.ts Zeile 1009 und die abweichende Anzeigelogik in Zeile 1141 werden dadurch ersetzt. Das ist der eigentliche Fehler: Auswahl und Anzeige beantworteten dieselbe Frage verschieden."
  - "G2 ANZEIGEFEHLER: In der Behaelter-Uebersicht steht 'frei', sobald der Liefertag erreicht ist. 'ab <Datum>' erscheint nur noch fuer wirklich zukuenftige Lieferungen, 'ausgemustert · <Grund>' fuer ausgemusterte Gefaesse. Bisher stand 'ab <Datum>' dauerhaft, weil das Datum nie mit heute verglichen wurde."
  - "G3 GEFAESSVERWALTUNG: Unter 'Mehr' gibt es einen Bereich 'Gefaesse'. Er listet alle Gefaesse mit Zustand (frei / belegt durch <Charge> / erwartet ab <Datum> / ausgemustert) und erlaubt: neues Gefaess anlegen (Name, Brutto-Liter, Material, Verschluss, optional erwartet ab), bestehendes bearbeiten, und 'Angekommen' bei einem erwarteten Gefaess - das entfernt vorhandenAb."
  - "G4 AUSMUSTERN STATT LOESCHEN: Ein Gefaess wird NIE geloescht. 'Ausmustern' setzt ausgemustertAm und verlangt einen Grund (ausgemustertGrund, Pflichtfeld, zum Beispiel 'Im Transport zerbrochen'). Grund: volumenHistorie und Ereignisse verweisen dauerhaft auf die id; ein geloeschtes Gefaess reisst die Historie auf. Ausgemusterte Gefaesse verschwinden aus allen Auswahlen, bleiben in der Liste sichtbar und lassen sich zurueckholen."
  - "G5 LIEFERTERMIN WIRD EINGELOEST, NICHT ABGEHAKT: Ein faelliger Reminder, der eine Lieferung ankuendigt, bietet beim Erledigen an, die betroffenen Gefaesse auf 'angekommen' zu setzen - als Liste mit Haken, vorbelegt mit allen Gefaessen, deren vorhandenAb auf oder vor dem Termin liegt. Wer einzelne Haken entfernt, sagt damit 'nicht gekommen'. Das ist derselbe Gedanke wie in H7: Ein Termin, der eine Tatsache ankuendigt, wird eingeloest - Abhaken allein darf nicht die einzige Moeglichkeit sein."
  - "T1 TESTS (happy-dom): ein Gefaess mit vorhandenAb gleich heute wird als 'frei' angezeigt; ein ausgemustertes Gefaess taucht in keiner Zielauswahl auf; Ausmustern ohne Grund wird abgelehnt; 'Angekommen' entfernt vorhandenAb."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine neue Abhaengigkeit. Der PR enthaelt zwingend einen Abschnitt '## Offene Punkte'."
---

# Auftrag H8 — Gefäße verwalten

## Der Anlass

Am 04.09.2026 kamen die bestellten Ballons, einer im Transport zerbrochen. Andi konnte
in der App **weder die Lieferung eintragen noch das kaputte Gefäß austragen** — es gibt
keine Gefäßverwaltung. Er hat ersatzweise den Termin abgehakt und geschrieben:

> „es gibt kein Menü zur Freigabe der Behälter… ich habe den Termin auf erledigt gestellt…
> aber die Behälter bleiben mit Termin stehen"

Das ist **zum zweiten Mal an einem Tag derselbe Fehler**. Am Vormittag konnte er die
Nährsalzgabe nicht erfassen und hat den Termin abgehakt (behoben durch H7). Jetzt die
Lieferung. Beide Male gilt: Die App lässt eine Absicht abhaken, kann die dazugehörige
Tatsache aber nicht aufnehmen.

## Der Anzeigefehler dahinter

`app/src/ui/app.ts` beantwortet dieselbe Frage an zwei Stellen unterschiedlich:

```
Zeile 1009 (Auswahl):  !behaelter.vorhandenAb || behaelter.vorhandenAb <= heute
Zeile 1141 (Anzeige):  behaelter.vorhandenAb ? `ab ${Datum}` : 'frei'
```

Die Auswahl vergleicht mit heute und ist richtig. Die Anzeige vergleicht nicht und zeigt
ein geliefertes Gefäß **für immer** als „ab 04.09.". Funktional war also nichts kaputt —
die vier großen Ballons waren am 04.09. bereits wählbar. Kaputt war nur, was Andi sah.

Deshalb steht in `domain/regeln.ts` jetzt `behaelterVerfuegbar(behaelter, stichtag)`.
**Beide Stellen rufen künftig diese eine Funktion.** Zwei Antworten auf eine Frage sind
die eigentliche Fehlerquelle, nicht die falsche Zeile.

## Warum ausmustern und nicht löschen

`volumenHistorie` und Ereignisse verweisen dauerhaft auf `behaelter.id`. Ein gelöschtes
Gefäß reißt die Historie auf: Der Abstich vom 12.09. zeigt dann auf ein Gefäß, das es
nie gegeben hat. Deshalb `ausgemustertAm` plus Pflichtgrund — die Felder liegen bereits
in `typen.ts`.

## Constraints

- Vanilla TypeScript, keine neue Abhängigkeit.
- `domain/` ist tabu — die Domänenseite ist fertig.
- Bei fachlicher Unklarheit: `## Offene Punkte` im PR.

## Nach dem Bau

Screenshots auf 1024 px: die Gefäßliste mit allen vier Zuständen, der Ausmustern-Dialog,
und ein Liefertermin mit der Häkchenliste.
