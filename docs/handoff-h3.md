---
id: wein-h3-erfassung-zwei-modi
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Die Messerfassung bekommt zwei Modi. Bisher gibt es nur "eine Messgröße, viele Chargen"; neu kommt "eine Charge, viele Messgrößen" hinzu, weil Andi am Bottich steht und dort alles auf einmal eintragen will. Dazu ein Fehler: beim Wechsel der Messgröße geht die Chargenauswahl verloren. Kein Eingriff in die Regelengine.
allowed_paths: ["app/src/ui/**", "app/src/speicher/**", "app/src/domain/typen.ts", "app/README.md"]
forbidden_paths: ["app/src/domain/regeln.ts", "app/src/domain/oenologie.ts", "app/src/domain/regressionen-2025.test.ts", "app/src/startdaten.ts", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 37 Tests bleiben gruen (31 Regressionen, 6 Migrationstests), OHNE dass regeln.ts, oenologie.ts oder eine Testdatei angefasst wird."
  - "FEHLER F1: Beim Wechsel der Messgroesse bleibt die Auswahl der Chargen erhalten. Aktuell wird das Formular neu gezeichnet und die Auswahl faellt auf die erste Charge zurueck. Auch bereits eingetragene Werte duerfen durch einen Wechsel nicht verlorengehen, soweit die Messgroesse gleich bleibt. Ein Test deckt ab, dass die Auswahl einen Typwechsel ueberlebt."
  - "MODUS A (neu, Standard beim Oeffnen): EINE Charge, VIELE Messgroessen. Oben ein Umschalter mit den vier Bottichen inklusive Menge in kg. Darunter eine Liste von Messfeldern, jedes einzeln befuellbar. Beim Speichern entsteht je ausgefuelltem Feld eine eigene Messung mit demselben Zeitstempel. LEERE FELDER WERDEN IGNORIERT und erzeugen keinen Datensatz."
  - "MODUS A, PHASENGERECHTE FELDER: Angezeigt werden die Messgroessen, die in der aktuellen Phase der Charge zaehlen. Fuer AKTIVE_GAERUNG und NACHGAERUNG: Temperatur, Mostgewicht (mit Messmethode), Geruch, Gaeraktivitaet. Fuer AUSBAU und die Gates danach: pH, freier SO2, Kopfraum, Oberflaeche, Geruch, Geschmack. Fuer KALTMAZERATION: Temperatur, Geruch, Gaeraktivitaet. Alle uebrigen Messgroessen bleiben unter einer zugeklappten Schublade 'Weitere Messgroessen' vollstaendig erreichbar — es darf keine Messgroesse unerreichbar werden."
  - "MODUS A, RUNDE: Nach dem Speichern erscheint eine stehenbleibende Erfolgsmeldung, die aufzaehlt WELCHE Werte gespeichert wurden, plus ein Knopf 'Weiter zu Bottich N' auf die naechste nicht archivierte Charge und ein Knopf 'Runde beenden'. Beim Weitergehen wird das Formular geleert, die Messgroessen-Auswahl und der Zeitstempel bleiben. Nach der letzten Charge entfaellt der Weiter-Knopf."
  - "MODUS B (bestehend, umbenannt): EINE Messgroesse, VIELE Chargen. Funktion bleibt wie bisher, inklusive der Regel, dass je Charge ein eigener Datensatz entsteht und Zugabemengen je Charge aus deren Volumen gerechnet werden. Nur F1 wird behoben."
  - "UMSCHALTER zwischen den Modi als Zweiersegment ganz oben, beschriftet in Klartext: 'Ein Bottich / viele Werte' und 'Ein Wert / alle Bottiche'. Keine Fachbegriffe wie Sammelaktion oder Einzelerfassung als alleinige Beschriftung."
  - "MESSMETHODE bleibt an Mostgewicht, Dichte und Brix gekoppelt und erscheint in Modus A direkt unter dem jeweiligen Feld, nicht als eigener Block am Formularende."
  - "ZEITSTEMPEL: In Modus A gilt EIN Zeitpunkt fuer alle Werte einer Eingabe, sichtbar angezeigt und aenderbar. Kein Feld bekommt einen eigenen Zeitstempel."
  - "F2 KLEINFEHLER: Im Phasen-Zeitstrahl bricht 'Mazeration' auf schmalen Geraeten unschoen um ('Mazerati on'). Labels im Zeitstrahl kuerzen oder Umbruch unterbinden."
  - "Design-Soll: outputs/mockup-erfassen-v3.html. Farbwelt und Aufbau der bestehenden App bleiben unveraendert; dies ist eine Aenderung an EINEM Bildschirm, kein Redesign."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine externen Requests, keine neuen Abhaengigkeiten."
---

# Auftrag H3 — Zwei Wege, eine Messung zu erfassen

## Der Anlass, in Andis eigenen Worten

Am Morgen des 03.09.2026, bei der ersten Messrunde nach dem Anstellen:

> „Ich stelle zum Beispiel auf Bottich eins und will Temperatur erfassen und dann bei
> Bottich zwei Temperatur erfassen und danach will ich in Bottich zwei mal das Mostgewicht
> erfassen und dann springt oben der Haken wieder zurück auf Bottich eins, wenn ich auf
> Mostgewicht umstelle. Mir wäre es lieber, wenn ich zwar auswählen kann, dass ich alle vier
> Bottiche gleichzeitig erfassen möchte, wenn ich aber einzelne Messungen machen möchte,
> dann möchte ich alle Daten in einem Bottich gleichzeitig erfassen können."

Darin stecken zwei verschiedene Sachen.

## Was schiefgelaufen ist

Das Erfassungsformular ist **messgrößen-zentriert** gebaut: eine Größe auswählen, Chargen
ankreuzen, speichern. Das passt für „Temperatur bei allen vieren" — und nur dafür.

Andis tatsächlicher Arbeitsablauf ist ein anderer. Er geht zweimal täglich die Bottiche ab,
stößt den Tresterhut unter und liest dabei ab. Er steht **an einem Bottich** und hat dort
Temperatur, Mostgewicht, Geruch und Gäraktivität gleichzeitig vor sich. Für ihn ist die
Charge die Konstante und die Messgröße die Variable — im Formular ist es umgekehrt.

Das ist ein Fehler in meiner Spezifikation zu H1, nicht in der Umsetzung. Beide Richtungen
sind sinnvoll, also gibt es künftig beide.

Dazu der handfeste Fehler F1: Der Wechsel der Messgröße zeichnet das Formular neu und
wirft die Chargenauswahl weg. Das ist unabhängig vom Zuschnitt einfach kaputt.

## Warum die phasengerechten Felder dazugehören

Sechzehn Messgrößen in einer Liste sind am Bottich unbenutzbar. Die App kennt die Phase
jeder Charge — sie kann die vier zeigen, die jetzt zählen, und den Rest zuklappen.
Das ist derselbe Gedanke wie bei den Erklärschubladen aus H2: **nicht weniger können,
sondern weniger gleichzeitig zeigen.**

Wichtig: Keine Messgröße darf dabei unerreichbar werden. Die Schublade
„Weitere Messgrößen" enthält immer alle übrigen.

## Die Runde

Der Knopf „Weiter zu Bottich N" nach dem Speichern ist der eigentliche Gewinn dieses
Auftrags. Andi macht diese Runde zweimal täglich über Wochen. Jeder Umweg über das Menü
ist ein Grund, es irgendwann sein zu lassen — und nicht dokumentieren ist genau der
Fehler, an dem der Jahrgang 2025 gestorben ist.

## Constraints

- Vanilla TypeScript, keine neuen Abhängigkeiten.
- `app/src/startdaten.ts` ist in diesem Auftrag **tabu** — der Startdatensatz bildet den
  echten Zustand von Andis Jahrgang ab und wird nicht nebenbei angefasst.
- Bei fachlicher Unklarheit: `## Offene Punkte` im PR. Nicht raten.

## Nach dem Bau

Screenshots in den PR, 375 px: Modus A mit ausgefüllten Feldern, die Erfolgsmeldung mit
dem Weiter-Knopf, Modus B nach einem Messgrößenwechsel mit erhaltener Auswahl.
