---
id: wein-h5-geraetesync
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Datenabgleich zwischen MacBook, iPhone und iPad. Bisher lebt der gesamte Zustand in der IndexedDB des jeweiligen Geraets; es gibt keinerlei Abgleich. Neu kommt ein Sync-Endpunkt auf montolio.de (PHP ueber einer JSON-Datei, keine Datenbank) und ein Sync-Modul in der App, das beim Start und nach jedem Speichern zusammenfuehrt. Offline-Faehigkeit bleibt vollstaendig erhalten. Kein Eingriff in die Regelengine.
allowed_paths: ["app/src/ui/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/domain/typen.ts", "app/src/main.ts", "app/src/sensor.ts", "app/index.html", "app/public/**", "app/README.md", "proxy/sync.php", "proxy/sync-config.beispiel.php"]
forbidden_paths: ["app/src/domain/regeln.ts", "app/src/domain/oenologie.ts", "app/src/domain/regressionen-2025.test.ts", "app/src/startdaten.ts", "proxy/kellersensor.php", "proxy/kellersensor-config.php", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE bestehenden Tests bleiben gruen (31 Regressionen, 6 Migration, 2 UI), OHNE dass regeln.ts, oenologie.ts oder die Regressionsdatei angefasst wird."
  - "S1 ZUSAMMENFUEHREN STATT UEBERSCHREIBEN: Der Abgleich bildet je Sammlung (chargen, behaelter, messungen, ereignisse, reminder, wiki, klima, vorrat) die VEREINIGUNGSMENGE ueber die id. Bei gleicher id gewinnt der Datensatz mit dem juengeren 'zuletztGeaendert'. Es darf NIEMALS ein ganzer Stand einen anderen ersetzen. Ein Test deckt ab: Geraet A hat Messung X, Geraet B hat Messung Y, nach dem Abgleich haben beide X und Y."
  - "S2 ZEITSTEMPEL: Jeder Datensatz bekommt ein Feld 'zuletztGeaendert' (ISO). Es wird beim Anlegen und bei jeder Aenderung gesetzt. Die Migration auf die neue Datenstand-Version fuellt es bei vorhandenen Datensaetzen aus dem fachlichen Zeitfeld (messung.zeit, ereignis.zeit) beziehungsweise aus charge.startdatum."
  - "S3 GRABSTEINE: Geloeschte Datensaetze verschwinden nicht ersatzlos, sondern hinterlassen einen Eintrag { id, sammlung, zeit } in einer Liste 'geloescht'. Beim Zusammenfuehren gewinnt ein Grabstein ueber einen aelteren Datensatz gleicher id. OHNE DAS KOMMT JEDE GELOESCHTE MESSUNG BEIM NAECHSTEN ABGLEICH ZURUECK. Ein Test deckt genau das ab."
  - "S4 ENDPUNKT: proxy/sync.php nimmt per POST den Stand eines Geraets entgegen, fuehrt ihn serverseitig mit der kanonischen JSON-Datei zusammen, schreibt sie zurueck und liefert den zusammengefuehrten Stand als Antwort. Die App uebernimmt die Antwort als neuen lokalen Stand. Zugriff ueber denselben Token-Mechanismus wie beim Kellersensor (Token als Query-Parameter, eigene Konfigurationsdatei sync-config.php nach dem Muster von kellersensor-config.php). KEINE Datenbank."
  - "S4 SCHREIBSICHERHEIT: Der serverseitige Schreibvorgang laeuft unter einer Dateisperre (flock) und schreibt erst in eine temporaere Datei, die danach umbenannt wird. Bei jedem Schreiben wird die vorherige Fassung als sync-<zeitstempel>.json behalten, die letzten zehn davon. Ein abgebrochener Abgleich darf den Bestand niemals beschaedigen."
  - "S5 WANN ABGEGLICHEN WIRD: beim Start der App und nach jedem erfolgreichen Speichern, jeweils nur wenn online. Der Abgleich laeuft im Hintergrund und blockiert die Oberflaeche nicht. Schlaegt er fehl, arbeitet die App unveraendert lokal weiter und zeigt einen dezenten Hinweis 'Zuletzt abgeglichen: <Zeit>' beziehungsweise 'Nicht abgeglichen'. Ein fehlgeschlagener Abgleich darf NIE eine Eingabe verhindern oder Daten verwerfen."
  - "S6 OFFLINE BLEIBT VOLLWERTIG: Ohne Netz ist die App vollstaendig benutzbar - erfassen, ansehen, Gates pruefen. Der Abgleich holt beim naechsten Start nach. Das ist die urspruengliche Anforderung (Erfassen im Keller ohne Empfang) und wird durch den Sync NICHT eingeschraenkt."
  - "S7 SENSOR-KONFIGURATION WIRD MITGEGLICHEN: Die Sensor-Einstellung ist Teil des Stands und damit nach einmaliger Einrichtung auf allen Geraeten vorhanden. Anlass: Andi musste sie bisher je Geraet von Hand eintragen."
  - "S8 FOTOS SIND IN DIESEM AUFTRAG NICHT DABEI. Fotos liegen als Blob in einem eigenen Speicher und wuerden den Abgleich um Groessenordnungen aufblaehen. Sie bleiben geraetelokal; im PR ist unter '## Offene Punkte' zu vermerken, dass das offen bleibt. Nicht heimlich mitsynchronisieren, nicht heimlich weglassen."
  - "S9 ANZEIGE: Unter 'Mehr' steht neben der Fassungszeile eine Zeile 'Abgleich: <Zeit>' oder 'Abgleich: noch nie' mit einem Knopf 'Jetzt abgleichen'. Damit ist ohne Raten erkennbar, ob ein Geraet aktuell ist."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine externen Requests, keine Laufzeit-Abhaengigkeit, keine Datenbank."
---

# Auftrag H5 — Die drei Geräte müssen dasselbe sehen

## Der Anlass, unmissverständlich

Andi am 03.09.2026:

> „Wir haben keine Datensynchronität zwischen MacBook iPhone und iPad. Das ist ein Bug,
> kein Feature."

**Er hat recht.** Und es ist keine Designentscheidung, die sich verteidigen ließe.

Am 02.09. stand in meiner eigenen Antwort an ihn wörtlich: *„Was dazukommen soll: Ein
schlanker PHP-Endpunkt auf montolio.de, an den die App ihren Stand hochlädt… Aber nicht
in H1. Der Sync wird H2."* Dann wurde H2 die Nutzerführung plus Datenmodell, H3 die
Erfassung, H4 die Korrigierbarkeit. **Der Sync ist stillschweigend liegengeblieben.**

Praktische Folge heute: Die Sensor-Konfiguration musste auf jedem Gerät neu eingetragen
werden, und die Messungen vom iPad existieren nirgendwo sonst. Das ist untragbar für eine
App, die ein Jahr lang die einzige Aufzeichnung eines Weinjahrgangs ist.

## Warum keine Datenbank

Weil die Datenform es nicht braucht. Der Bestand ist fast reines Anhängen: Messungen und
Ereignisse kommen hinzu, jedes trägt eine eindeutige `id` und einen Zeitstempel.
Zusammenführen heißt dann Vereinigungsmenge über die ids — ein paar Dutzend Zeilen über
einer JSON-Datei. Volumen: wenige tausend Datensätze im Jahr.

Eine Datenbank brächte Schema, Migrationen und Betriebsaufwand und löste kein Problem,
das die Datei nicht auch löst.

## Die Stelle, an der ein naiver Sync kaputtgeht

**Löschungen.** Seit H4 kann Andi Messungen löschen. Ein Abgleich, der nur
Vereinigungsmengen bildet, holt jede gelöschte Messung beim nächsten Durchgang vom Server
zurück — und der Nutzer löscht sie wieder, und wieder.

Deshalb S3: Grabsteine. Wer löscht, hinterlässt einen Eintrag, und der Grabstein gewinnt
über einen älteren Datensatz gleicher id.

## Die zweite Stelle: der Abgleich darf nie im Weg stehen

Die ursprüngliche Anforderung bleibt in Kraft: **Erfassen im Keller, ohne Empfang.**
Der Sync ist eine zweite Schicht, keine Voraussetzung. Schlägt er fehl, merkt Andi das an
einer Zeile unter „Mehr" — und arbeitet unverändert weiter. Kein Ladebalken vor einer
Eingabe, kein verworfener Datensatz, keine Fehlermeldung, die eine Messung verhindert.

## Was bewusst NICHT dazugehört

Fotos. Sie liegen als Blob in einem eigenen Speicher und würden den Abgleich um
Größenordnungen aufblähen. Sie bleiben vorerst gerätelokal — **und das gehört unter
`## Offene Punkte` in den PR**, nicht stillschweigend weggelassen.

## Constraints

- Vanilla TypeScript, keine Laufzeit-Abhängigkeit, keine Datenbank.
- `proxy/kellersensor.php` und dessen Konfiguration sind tabu — der neue Endpunkt ist
  eine eigene Datei.
- Bei fachlicher Unklarheit: `## Offene Punkte` im PR. Nicht raten, nicht weglassen.

## Nach dem Bau

Screenshots in den PR, 375 px: die Abgleich-Zeile unter „Mehr", der Zustand „Nicht
abgeglichen" ohne Netz. Dazu im PR-Text ein Absatz, wie das Zusammenführen bei
gleichzeitiger Änderung derselben id entscheidet — das ist die Stelle, an der ich beim
Review zuerst hinschaue.
