---
id: wein-h7-zugaben-in-der-runde
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Die Runde kann Zugaben nicht erfassen. Andi hat am 04.09.2026 Hefenährsalz Portion 2 während der Runde gegeben und konnte es dort nicht eintragen — er hat nur den Termin auf erledigt gesetzt, die Zugabe fehlte im Journal und der Vorrat stimmte nicht. Neu: Zugaben mit Menge je Gefäß direkt in der Runde, mit vorberechneter Menge aus der Fachschicht, gekoppelt an Vorrat und an den fälligen Termin. Kein Eingriff in Regelengine, Speicher oder Abgleich.
allowed_paths: ["app/src/ui/**", "app/src/main.ts", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 52 bestehenden Tests bleiben gruen. domain/, speicher/, sync.ts, sensor.ts, startdaten.ts werden NICHT angefasst. Alle Rechnungen kommen aus der vorhandenen oenologie.ts (naehrsalzPlan, zuckerFuerOechsle, schwefelDosierung) - keine Formel wird in der Oberflaeche nachgebaut."
  - "Z1 ZUGABEN IN DER RUNDE: Unter den Messfeldern steht ein Abschnitt 'Zugaben'. Er zeigt die Zugabearten, die in der aktuellen Phase vorkommen - AKTIVE_GAERUNG und NACHGAERUNG: Hefenaehrsalz, Haushaltszucker; AUSBAU und die Gates danach: Kaliumpyrosulfit; immer zusaetzlich 'Sonstige Zugabe' mit freiem Stoffnamen. Je Zugabe ein Mengenfeld mit Einheit. Leer bleibende Zugaben erzeugen KEINEN Datensatz - dieselbe Regel wie bei den Messfeldern."
  - "Z2 MENGE VORSCHLAGEN: Das Mengenfeld ist mit dem fachlich richtigen Wert FUER DIESES GEFAESS vorbelegt und aenderbar. Naehrsalz aus naehrsalzPlan(erwarteteWeinLiter) geteilt durch drei Portionen; Schwefel aus schwefelDosierung(...) mit dem letzten pH und dem letzten freien SO2; Zucker aus zuckerFuerOechsle(...) auf das zuletzt verwendete Ziel. Neben dem Feld steht die Herkunft in einer Zeile, zum Beispiel 'Portion 2 von 3 · Hoechstmenge 30 g je 100 L auf 8,6 L'. Fehlen Eingangswerte fuer eine Rechnung, bleibt das Feld leer mit dem Hinweis, welcher Wert fehlt - es wird NICHTS geraten."
  - "Z3 PORTIONSZAEHLUNG: Bei Naehrsalz zaehlt die App die bereits gegebenen Portionen dieser Charge und beschriftet die naechste entsprechend ('Portion 2 von 3'). Ist die Hoechstmenge erreicht oder ueberschritten, wird die Zugabe nicht verboten, aber deutlich gewarnt - die Regel R-NAEHRSALZ-MAX in regeln.ts bleibt die Wahrheit und wird nicht dupliziert."
  - "Z4 BEGRUENDUNG OHNE BLOCKADE: Jede Zugabe braucht laut Audit-Regel 13 eine Begruendung. Am Bottich darf ein Pflichtfeld den Ablauf nicht aufhalten. Deshalb wird die Begruendung aus dem Kontext VORBELEGT (Zugabeart, Portionsnummer, Zeitpunkt der Runde, Rechenweg der Menge) und ist aenderbar. Sie darf nie leer gespeichert werden."
  - "Z5 VORRAT: Jede Zugabe traegt die vorratId des passenden Postens, sodass die Kopplung aus H2 den Bestand abbucht. Passt keine Einheit oder fehlt der Posten, wird die Zugabe trotzdem gespeichert und der Vorrat unveraendert gelassen - mit sichtbarem Hinweis, nicht stillschweigend."
  - "Z6 FAELLIGE AUFGABE AM GEFAESS: Ist ein Reminder faellig, der zu einer Zugabe gehoert, erscheint er in der Runde AM BETROFFENEN GEFAESS als Zeile 'Faellig: Hefenaehrsalz Portion 2 von 3' mit vorbelegter Menge. Wird die Zugabe gespeichert, gilt der Reminder als erledigt - ohne dass Andi ihn separat abhaken muss. Das ist der eigentliche Anlass dieses Auftrags: Am 04.09. hat er die Gabe gemacht, konnte sie nicht erfassen und hat ersatzweise den Termin abgehakt. Ein wiederkehrender Reminder wird dabei auf den naechsten Termin gesetzt, nicht geloescht."
  - "Z7 ZUSAMMENFASSUNG: Die Zusammenfassung am Rundenende listet neben den Messungen auch die Zugaben je Gefaess mit Menge, und welche Termine dadurch erledigt wurden."
  - "Z8 RUECKNAHME: 'Letzte Eingabe zuruecknehmen' entfernt auch die in diesem Schritt angelegten Zugaben, bucht den Vorrat zurueck und setzt einen dadurch erledigten Reminder wieder auf faellig."
  - "T1 TESTS (happy-dom): leeres Mengenfeld erzeugt keine Zugabe; eine gespeicherte Zugabe traegt vorratId, eine nicht leere Begruendung und den Rundenzeitstempel; die Naehrsalzmenge fuer eine Charge mit 8,6 L erwarteter Weinmenge entspricht naehrsalzPlan(8,6).proPortion; ein faelliger Zugabe-Reminder gilt nach dem Speichern als erledigt; die Ruecknahme entfernt Zugabe und Reminder-Erledigung wieder."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine externen Requests, keine neue Abhaengigkeit. Der PR enthaelt zwingend einen Abschnitt '## Offene Punkte', auch wenn er 'keine' lautet."
---

# Auftrag H7 — Zugaben gehören in die Runde

## Der Anlass, wörtlich

Andi am 04.09.2026, nach der Vormittagsrunde:

> „Ich habe Nährsalz Portion 2 heute in der Runde gegeben… Und das auch jeweils in der
> Reihenfolge mit Most gemischt untergerührt. Das konnte ich in der Runde nicht erfassen.
> Und habe deshalb nur den Termin auf erledigt gesetzt."

Das ist eine Lücke in meinem Spec zu H6, kein Baufehler: Ich habe für die Runde nur den
Haken „Untergestoßen" vorgesehen. Zugaben mit einer **Menge, die sich je Gefäß
unterscheidet**, habe ich vergessen.

**Die Folge war real:** Vier Zugaben fehlten im Journal, der Vorratsbestand stand 3,4 g zu
hoch, und ein erledigter Termin behauptete etwas, wofür es keinen Beleg gab. Nachgetragen
wurde das von Hand über den Sync-Endpunkt — genau die Art Handarbeit, die diese App
abschaffen soll.

## Warum das mehr ist als ein weiteres Feld

Am Bottich passiert beides in derselben Bewegung: messen **und** geben. Wer die Runde als
reines Messwerkzeug baut, zwingt den Nutzer, die halbe Arbeit woanders einzutragen — und
genau das passiert dann nicht.

Zwei Dinge machen den Unterschied zwischen „Feld hinzugefügt" und „Situation bedient":

**Die Menge muss dastehen, nicht errechnet werden.** Andi hat 0,90 / 0,85 / 0,90 / 0,75 g
gegeben — vier verschiedene Werte, weil die Bottiche verschieden groß sind. Diese Zahlen
kommen aus `naehrsalzPlan()`, die App kennt sie. Sie gehören ins Feld, bevor er fragt.

**Der fällige Termin gehört ans Gefäß.** Er hat den Termin abgehakt, weil die App ihm keinen
anderen Weg ließ. Richtig ist: Der Termin erscheint in der Runde am betroffenen Bottich,
und die Zugabe erledigt ihn. Abhaken ist dann kein eigener Schritt mehr.

## Konstruktionshinweise

- Alle Mengen kommen aus `oenologie.ts` (`naehrsalzPlan`, `zuckerFuerOechsle`,
  `schwefelDosierung`). **Keine Formel in der Oberfläche nachbauen.**
- Die Vorratskopplung (`vorratId`) und das Zurückbuchen beim Löschen gibt es seit H2.
- Die Begründungspflicht kommt aus Audit-Regel 13 und bleibt. Sie wird vorbelegt, nicht
  abgeschafft — am Bottich tippt niemand einen Absatz.
- Fehlt für eine Rechnung ein Eingangswert (etwa der pH beim Schwefeln), bleibt das Feld
  leer und nennt den fehlenden Wert. **Nicht raten.**

## Constraints

- Vanilla TypeScript, keine neue Abhängigkeit.
- `domain/`, `speicher/`, `sync.ts`, `sensor.ts`, `startdaten.ts` sind tabu.
- Bei fachlicher Unklarheit: `## Offene Punkte` im PR. Nicht stillschweigend weglassen.

## Nach dem Bau

Screenshots auf 1024 px: der Zugaben-Abschnitt mit vorbelegter Nährsalzmenge, ein fälliger
Termin am Gefäß, die Zusammenfassung mit Messungen und Zugaben. Dazu ein Absatz, was
passiert, wenn die Höchstmenge überschritten wird.
