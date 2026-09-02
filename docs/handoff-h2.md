---
id: wein-h2-fuehrung-und-datenmodell
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Zwei Teile. (a) Nutzerführung nach dem abgenommenen Mockup v2 — Statusband, Gärverlaufskurve, Phasen-Zeitstrahl, zugeklappte Erklärschubladen, stehenbleibende Meldungen, erklärende Animationen. (b) Vier Reparaturen am Datenmodell, die vor dem Pressen fertig sein müssen — Bedeutung von fuellLiter, fehlende Volumenhistorie, Entkopplung von Vorrat und Zugaben, Chargen-Abstammung als Seitentabelle. Die Regelengine bleibt unangetastet.
allowed_paths: ["app/src/ui/**", "app/src/speicher/**", "app/src/domain/typen.ts", "app/src/main.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "app/src/ics.ts", "app/src/sensor.ts", "app/index.html", "app/public/**", "app/README.md"]
forbidden_paths: ["app/src/domain/regeln.ts", "app/src/domain/oenologie.ts", "app/src/domain/regressionen-2025.test.ts", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 31 Regressionstests bleiben gruen, OHNE dass regeln.ts, oenologie.ts oder die Testdatei angefasst werden. Das ist der Beweis, dass die Modellaenderung die Fachregeln nicht verschiebt. Wer dafuer eine Regel anfassen will, schreibt das unter '## Offene Punkte' in den PR."
  - "MIGRATION OHNE DATENVERLUST: Auf dem Geraet von Andi liegen bereits echte Messungen in der IndexedDB (Datenstand-Version 1). Die Migration auf Version 2 muss diese Daten vollstaendig erhalten und die neuen Felder aus den vorhandenen ableiten. Ein Test deckt das ab: alter Datenstand rein, neuer raus, keine Messung und kein Ereignis verloren."
  - "M1 fuellLiter: Das Feld bedeutet ab jetzt ausschliesslich das AKTUELLE Fuellvolumen im Gefaess. Die erwartete Weinausbeute bekommt ein eigenes Feld erwarteteWeinLiter. Im Startdatensatz steht die erwartete Ausbeute derzeit faelschlich in fuellLiter — das wird korrigiert (Bottich 1-4: 9,2 / 8,6 / 8,8 / 7,4 L erwartet). Waehrend der Maischegaerung ist fuellLiter undefiniert, weil die Maische kein messbares Fluessigkeitsvolumen hat; die UI zeigt dort 'noch nicht bestimmbar' statt einer Zahl."
  - "M2 VOLUMENHISTORIE: Neue Struktur VolumenPunkt { zeit, fuellLiter, kopfraumLiter, behaelterId, anlass } und Charge.volumenHistorie als Liste davon. Beim Pressen und bei jedem Abstich wird ein Punkt angehaengt statt ein Wert ueberschrieben. Charge.fuellLiter und Charge.kopfraumLiter bleiben als abgeleitete Felder bestehen und tragen IMMER den juengsten Eintrag der Historie — dadurch liest regeln.ts unveraendert weiter und muss nicht angefasst werden. Die Pflege uebernimmt die Speicherschicht, nicht die UI."
  - "M3 VORRAT KOPPELN: Ereignis bekommt ein optionales Feld vorratId. Ist es gesetzt, verringert das Speichern des Ereignisses den zugehoerigen Vorratsposten um die Ereignismenge (Einheiten muessen uebereinstimmen, sonst Fehlermeldung und kein Abzug). Loeschen eines Ereignisses bucht zurueck. Die Vorratsansicht zeigt je Posten den aktuellen Bestand und die Summe der Abgaenge. Die bereits erfassten Zugaben vom 02.09. (2,63 kg Zucker, 3,4 g Naehrsalz, 2 Beutel Hefe) werden in der Migration verknuepft."
  - "M4 ABSTAMMUNG INS MODELL: appMeta.chargenMengenKg und appMeta.elternChargeIds entfallen. Die Menge wandert als Charge.mengeKg ins Modell, die Abstammung nutzt das bereits vorhandene Charge.elternChargeId. appMeta wird dabei nicht ersatzlos geloescht, sondern migriert."
  - "UI-1 STATUSBAND ganz oben auf 'Heute': vier Kennzahlen in einer Zeile — Anzahl Chargen, schlechteste Ampel ueber alle Chargen, Tag der aktuellen Phase, Anzahl offener Aufgaben. Das ist der Zwei-Sekunden-Blick und steht IMMER vor allem anderen. Vor dem Statusband darf nichts stehen."
  - "UI-2 GAERVERLAUFSKURVE auf 'Heute' und je Charge: gemessene Dichtewerte als durchgezogene Linie, erwarteter Verlauf gestrichelt, Pressfenster (SG <= 1,010) als farbiges Band. Inline-SVG, keine Diagrammbibliothek. Bei weniger als zwei Messwerten wird statt der Kurve ein Hinweis gezeigt, kein leeres Diagramm."
  - "UI-3 PHASEN-ZEITSTRAHL mit Knoten je Phase, abgeschlossene gefuellt, aktuelle hervorgehoben und pulsierend, Gates als Ring erkennbar. Darunter ein Klartextsatz, was gerade in der Charge passiert und was zu tun ist — je Phase hinterlegt, nicht generisch."
  - "UI-4 ERKLAERSCHUBLADEN als <details>, ZUGEKLAPPT als Standard, an Kurve, Aufgabe, Ampel und Zeitstrahl. Andis Auflage woertlich: der kurze schnelle Ueberblick darf nicht leiden. Keine Erklaerung darf oberhalb einer Zahl stehen oder Platz einnehmen, solange sie zu ist."
  - "UI-5 MELDUNGEN BLEIBEN STEHEN, bis sie weggetippt werden — kein Auto-Ausblenden. Anlass: Am 02.09.2026 hat die App eine Vollsicherung korrekt abgelehnt und es gemeldet, aber das Statusband blendete weg; Andi hielt den Import fuer erfolgreich und arbeitete mit falschen Daten weiter. Fehlermeldungen nennen zusaetzlich, WAS erwartet wurde (beim Import: das Format { schema, exportiert, datenstand, fotos })."
  - "UI-6 ANIMATIONEN, die etwas erklaeren: Kurve zeichnet sich, Tresterhut hebt und senkt sich mit aufsteigenden Blaeschen, aktuelle Phase pulsiert, Gate-Pruefungen laufen nacheinander ein. Jede unter 600 ms. prefers-reduced-motion wird respektiert und schaltet alle ab."
  - "Design-Soll ist outputs/mockup-weinbegleiter-v2.html, von Andi am 02.09.2026 abgenommen. Farbwelt, Statusband, Kurvendarstellung, Zeitstrahl und Schubladen sind als Soll zu verstehen. Was in v2 nicht vorkommt (Termine, Wiki, Erfassen, Mehr), bleibt funktional wie in H1 und wird nur an die neue Meldungslogik angepasst."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine externen Requests, keine Diagramm- oder Animationsbibliothek. Der netzwerk-zuerst-Service-Worker aus main bleibt unveraendert."
---

# Auftrag H2 — Nutzerführung und vier Datenmodell-Reparaturen

## Warum dieser Auftrag existiert

Andi hat die App am 02.09.2026 einen Tag lang im Keller benutzt, während er vier Gärbottiche
angestellt hat. Sein Urteil danach: *„So gaaaanz verstehe ich die App nämlich noch nicht."*

Das ist kein Schönheitsfehler. Die App soll ihn durch einen Jahrgang führen, an dessen
Vorgänger er einen kompletten Wein verloren hat — weil über Monate niemand hingeschaut hat.
Eine App, die Daten anzeigt, aber nicht erklärt, worauf es wann ankommt, wird im Alltag
nicht benutzt. Und nicht benutzt ist genau der Fehler von 2025.

**Seine Auflage, wörtlich:** *„der kurze schnelle Überblick sollte nicht dadurch leiden."*
Das ist die zentrale Spannung dieses Auftrags. Erklärung darf nie vor Information stehen.
Die Lösung im abgenommenen Mockup: Zahlen oben und dicht, Erklärungen darunter und zugeklappt.

## Der zweite Teil ist zeitkritisch

Am 06.–07.09.2026 wird gepresst. Dabei wird jede Charge in Vorlauf und Presswein geteilt,
Volumen ändern sich, Gefäße wechseln. Das aktuelle Modell kann das nicht:

| | Befund | Folge beim Pressen |
|---|---|---|
| **M1** | `fuellLiter` bedeutet zwei Dinge — im Startdatensatz die erwartete Ausbeute, im Modell das Füllvolumen | Die Kopfraumregel rechnet mit der falschen Größe |
| **M2** | Volumen ist ein einzelnes Feld ohne Historie | Der Wert vor dem Pressen ist danach verloren |
| **M3** | Vorrat und Zugaben sind entkoppelt | 2,63 kg Zucker zugegeben, Bestand unverändert — die Anzeige driftet von der Wirklichkeit weg |
| **M4** | Mengen und Abstammung liegen in `appMeta` statt im Modell | Beim Aufteilen in zwei Chargen fehlt die saubere Verknüpfung |

Diese vier Punkte müssen **vor dem Pressen** stehen.

## Die entscheidende Konstruktionsvorgabe

`app/src/domain/` bleibt tabu — auch bei M1 und M2. Die Regelengine liest
`charge.fuellLiter` und `charge.kopfraumLiter`. Halte diese beiden Felder als
**abgeleitete Spiegel des jüngsten Eintrags der Volumenhistorie**, gepflegt in der
Speicherschicht. Dann bleibt `regeln.ts` unberührt und die 31 Tests sind der Beweis,
dass die Umstellung nichts verschoben hat.

Wenn du zu dem Schluss kommst, dass das nicht geht, **baue es nicht anders — schreib es
unter `## Offene Punkte` in den PR.** Die Regelspezifikation ist der teuerste Teil des
Projekts und wird nicht nebenbei geändert.

## Quellen

- Design-Soll: `outputs/mockup-weinbegleiter-v2.html` (abgenommen 02.09.2026)
- Vorgänger: `outputs/mockup-weinbegleiter-v1.html`, umgesetzt in H1
- Fachliche Herleitung und Entscheidungen: `journal/2026-jahrgang.md`
- 2025er Fehler: `inputs/handoff-2026-08-30/wein-app-handoff-2026/data/`
- Leitplanken: `AGENTS.md` im Repo-Wurzelverzeichnis

## Nach dem Bau

Screenshots in den PR, iPhone-Breite 375 px: Heute mit geschlossenen und mit geöffneten
Schubladen, Charge-Detail mit Kurve, Gate, und eine stehengebliebene Fehlermeldung.
Dazu ein Satz, wie du M2 gelöst hast — das ist die Stelle, an der ich beim Review
zuerst hinschaue.
