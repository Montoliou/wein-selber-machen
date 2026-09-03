---
id: wein-h4-version-korrektur-klimakurve
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Fünf Punkte aus dem Betrieb der ersten Tage. (1) Die App zeigt nirgends ihre Version und merkt nicht, wenn eine neue da ist. (2) Messungen lassen sich weder korrigieren noch löschen. (3) Der Kellersensor wird nur auf Knopfdruck abgefragt, obwohl serverseitig eine lückenlose Kurve mitgeschrieben wird. (4) Für den Fehler F1 aus H3 fehlt der zugesagte Test, weil es keine DOM-Testumgebung gibt. (5) Kleinigkeiten aus dem Review. Kein Eingriff in die Regelengine.
allowed_paths: ["app/src/ui/**", "app/src/speicher/**", "app/src/domain/typen.ts", "app/src/sensor.ts", "app/src/main.ts", "app/vite.config.ts", "app/package.json", "app/public/**", "app/index.html", "app/README.md"]
forbidden_paths: ["app/src/domain/regeln.ts", "app/src/domain/oenologie.ts", "app/src/domain/regressionen-2025.test.ts", "app/src/startdaten.ts", "proxy/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE bestehenden Tests bleiben gruen (31 Regressionen, 6 Migrationstests), OHNE dass regeln.ts, oenologie.ts oder die Regressionsdatei angefasst wird."
  - "P1 VERSIONSANZEIGE: Der Build traegt eine sichtbare Kennung. Vite schreibt Zeitstempel und kurzen Git-Commit ueber `define` in den Bundle; die App zeigt sie unter 'Mehr' in einer Zeile 'Fassung vom TT.MM.JJJJ, HH:MM (abc1234)'. Andi muss damit ohne Rueckfrage sagen koennen, welcher Stand auf seinem Geraet laeuft."
  - "P1 UPDATE-HINWEIS: Die App registriert den Service Worker und horcht auf 'updatefound' beziehungsweise einen wartenden Worker. Ist eine neue Fassung da, erscheint eine stehenbleibende Meldung 'Neue Fassung verfuegbar' mit einem Knopf, der skipWaiting ausloest und neu laedt. Ohne Antippen wird NICHTS neu geladen — eine Aktualisierung mitten in einer Eingabe am Gaerbottich darf keine Daten kosten."
  - "P2 MESSUNG KORRIGIEREN UND LOESCHEN: In der Messungsliste einer Charge ist jeder Eintrag antippbar. Bearbeiten erlaubt Wert, Zeitpunkt, Messmethode und Notiz zu aendern; Loeschen fragt einmal zurueck. Dasselbe fuer Ereignisse — dort bucht das Loeschen den Vorratsabgang zurueck (die Kopplung aus H2). Anlass: Am 03.09. sind Doppeleintraege und eine Fehlzuordnung entstanden, die Andi nicht mehr korrigieren konnte."
  - "P3 SENSOR BEIM OEFFNEN: Ist ein Kellersensor konfiguriert und das Geraet online, holt die App beim Start EINMAL automatisch einen Wert und legt ihn als Klimapunkt ab. Schlaegt das fehl, erscheint keine Fehlermeldung, sondern der zuletzt bekannte Wert mit seinem Zeitstempel. Anlass: Andi hat erwartet, dass die Temperatur einfach dasteht — sie erschien nur nach 'Verbindung testen'."
  - "P3 KELLERKURVE: Der Proxy liefert unter '<endpunkt>&verlauf=1&n=500' eine Liste { punkte: [{ t, temp, hum, bat }] }. Die App zeigt daraus auf 'Heute' eine Kellerklima-Kurve im selben Stil wie die Gaerverlaufskurve (Inline-SVG, keine Bibliothek). Die URL wird aus der vorhandenen Sensor-Konfiguration abgeleitet, es kommt KEIN zweites Konfigurationsfeld dazu. Antwortet der Endpunkt nicht, wird die Kurve weggelassen und die manuell erfassten Klimapunkte bleiben die Anzeige — die Seite darf nie wegen des Sensors kaputtgehen."
  - "P4 TESTUMGEBUNG: vitest bekommt eine DOM-Umgebung (jsdom oder happy-dom als devDependency). Damit wird der in H3 zugesagte, aber nicht gelieferte Test nachgeholt: Die Chargenauswahl in Modus B ueberlebt einen Wechsel der Messgroesse. Dazu ein Test, dass in Modus A leere Felder keinen Datensatz erzeugen."
  - "P5 BATTERIEWARNUNG: Der Proxy liefert 'battery' in Prozent. Faellt der Wert unter 20, erscheint bei der Sensoranzeige ein Hinweis. Ein leerer Sensor hoert sonst still auf zu melden, und die Luecke faellt erst Tage spaeter auf."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine externen Requests, keine Laufzeit-Abhaengigkeit. jsdom/happy-dom sind reine devDependencies und landen nicht im Bundle."
  - "Der netzwerk-zuerst-Service-Worker bleibt in seiner Strategie unveraendert; ergaenzt wird nur, was fuer die Update-Erkennung noetig ist. Die CACHE-Version wird erhoeht."
---

# Auftrag H4 — Was der Betrieb der ersten Tage gezeigt hat

## Der Anlass

Andi führt seit dem 02.09.2026 einen echten Weinjahrgang mit dieser App. Vier Gärbottiche,
zweimal täglich Messungen. Nach zwei Tagen sind fünf Dinge aufgefallen — keines davon
ist ein Baufehler, alle sind Lücken in der Spezifikation.

## P1 ist der wichtigste, und er hat heute Zeit gekostet

Am 03.09. meldete Andi: *„Wie aktualisiere ich das iPad? Der will die Temperatur nicht
zeigen."* Und **niemand konnte beantworten, welche Fassung auf dem Gerät lief** — die App
zeigt keine Version, und sie sagt auch nicht, wenn eine neue bereitsteht. Die Diagnose
wurde zum Ratespiel zwischen „alter Stand im Cache" und „Bedienung anders als erwartet".

Zwei Dinge beheben das dauerhaft: eine sichtbare Build-Kennung und ein Hinweis, wenn
eine neue Fassung da ist.

**Wichtig beim Update-Hinweis:** Es wird nichts automatisch nachgeladen. Andi steht mit
klebrigen Fingern am Gärbottich; ein Neuladen mitten in einer Eingabe wäre schlimmer als
eine veraltete Fassung. Der Hinweis bleibt stehen, bis er ihn antippt.

## P2 — was nicht korrigierbar ist, wird irgendwann falsch

Am 03.09. entstanden beim Kampf mit dem alten Formular Doppeleinträge, und eine Messung
landete bei der falschen Charge. Beides ließ sich nicht mehr richten: **Die App kann
Messungen weder ändern noch löschen.**

Bei identischen Werten ist das harmlos. Beim nächsten echten Zahlendreher steht ein
falscher Wert dauerhaft im Journal — und dieses Journal ist die Grundlage, auf der
Gates entscheiden.

Beim Löschen eines Ereignisses muss der Vorratsabgang zurückgebucht werden. Die
Kopplung dafür existiert seit H2.

## P3 — die Daten sind schon da, sie kommen nur nicht an

Seit dem 03.09. läuft ein Job auf dem Mac Mini, der alle 15 Minuten den Kellersensor
abfragt. Ein PHP-Proxy auf montolio.de schreibt die Werte fort. **Es entsteht also
bereits eine lückenlose Kellerkurve — die App zeigt sie nur nicht.**

Gleichzeitig fragt die App den Sensor nur auf Knopfdruck ab. Andi erwartete
verständlicherweise, dass die Temperatur einfach dasteht.

Beides gehört zusammen: beim Öffnen einmal holen, und den Verlauf als Kurve zeigen.

**Der Endpunkt ist bereits fertig und getestet:**

```
GET <endpunkt>&verlauf=1&n=500
→ { "punkte": [ { "t": "2026-09-03T18:48:07+02:00", "temp": 21.2, "hum": 62, "bat": 100 } ], "anzahl": 1 }
```

Die Basis-URL steht in der Sensor-Konfiguration der App. **Kein zweites Feld anlegen.**

Und: Wenn der Endpunkt nicht antwortet, verschwindet nur die Kurve. Die Seite darf
niemals wegen eines Sensors kaputtgehen.

## P4 — eine Zusage aus H3, die stillschweigend fallengelassen wurde

Der Spec zu H3 verlangte einen Test, der absichert, dass die Chargenauswahl einen
Wechsel der Messgröße überlebt. Der Test fehlt; die Testzahl blieb bei 37.

Der Grund ist nachvollziehbar — es gibt keine DOM-Testumgebung, ein solcher Test
braucht erst jsdom. **Aber genau dafür steht in jedem Spec der Satz, es unter
`## Offene Punkte` in den PR zu schreiben.** Das ist nicht passiert, und damit ging
die Information verloren, bis sie beim Review auffiel.

Diesmal also: erst die Umgebung, dann der Test.

## Constraints

- Vanilla TypeScript. Neue Abhängigkeiten ausschließlich als devDependency für Tests.
- `app/src/startdaten.ts` und `proxy/**` sind tabu.
- Bei fachlicher Unklarheit: `## Offene Punkte` im PR. **Nicht raten, nicht stillschweigend weglassen.**

## Nach dem Bau

Screenshots in den PR, 375 px: die Versionszeile unter „Mehr", der Update-Hinweis,
die Bearbeiten-Ansicht einer Messung, die Kellerkurve auf „Heute".
