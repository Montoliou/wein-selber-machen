# Weinbegleiter 2026

Mobile, offlinefähige PWA für den Weinjahrgang 2026. Die Fachentscheidungen liegen ausschließlich in `src/domain/`; die UI ruft diese Regel- und Rechenfunktionen auf.

## Lokal starten

```bash
cd app
npm ci
npm run dev
```

Vite zeigt die lokale URL im Terminal. Für die Bedienung mit iPhone-Breite kann die Browseransicht auf 375 px gestellt werden.

## Oberfläche nach Situation

Die App ordnet ihre Oberfläche über `layoutKlasse()` in drei Klassen ein: Telefon unter 600 px, Tablet ab 600 px und Schreibtisch ab 1.200 px. Die Klasse steht als `data-layout` am App-Wurzelelement und wird bei einer Größenänderung neu gesetzt. Ein iPad im Querformat bleibt dadurch in der Tablet-Ansicht.

„Heute“ zeigt auf dem Telefon eine Spalte und auf dem Tablet zwei Spalten. Die Runde öffnet ein Gefäß je Bildschirm, verwendet einen gemeinsamen Zeitpunkt und wartet nach dem Speichern auf den Knopf „Weiter“. Wischen wechselt erst ab 80 px horizontaler Strecke und nur dann, wenn die Bewegung deutlich horizontaler als vertikal ist. Beginnt die Berührung auf einem Eingabefeld oder Bedienelement, löst sie keinen Gefäßwechsel aus.

Jede Rundeneingabe wird zuerst lokal in IndexedDB gespeichert. Fällt die Verbindung während der Runde aus, bleibt die Erfassung benutzbar; der Abgleich startet beim nächsten Speichern oder beim nächsten Online-Ereignis erneut. Die Rücknahmefrist entfernt genau die zuletzt gespeicherten Messungen und Ereignisse und legt dafür Sync-Grabsteine an.

Gate-Prüfungen laufen einzeln nacheinander. Eine fehlende Messung kann direkt in der betreffenden Prüfung erfasst werden. Nach bestandenem Press-Gate legt der geführte Press-Schritt Vorlauf und Presswein als getrennte Nachgärungs-Chargen mit Eltern-ID, Volumenpunkt, Kopfraum und Behälter an und archiviert die Maische-Charge.

Ab 1.200 px zeigt der Schreibtisch links Navigation und Gefäße, in der Mitte Status, Kurven, Kellerklima und Phase sowie rechts Messungen und Ereignisse des gewählten Gefäßes. Die Zeilen im rechten Bereich öffnen die vorhandenen Bearbeitungsansichten.

## Messungen erfassen

Die Messerfassung öffnet im Modus „Ein Bottich / viele Werte“. Die App zeigt zuerst die Messgrößen, die zur aktuellen Phase der gewählten Charge gehören. „Weitere Messgrößen“ enthält die übrigen Felder. Jede ausgefüllte Messgröße erzeugt einen Datensatz; leere Felder werden ignoriert. Alle Datensätze einer Eingabe verwenden denselben sichtbaren und änderbaren Zeitpunkt.

Nach dem Speichern nennt die App die erfassten Messgrößen. „Weiter zu Bottich N“ öffnet die nächste aktive Charge mit leeren Messwerten und demselben Zeitpunkt. Nach der letzten aktiven Charge bleibt „Runde beenden“ als Abschluss.

Der Modus „Ein Wert / alle Bottiche“ erfasst eine Messgröße für mehrere ausgewählte Chargen. Die Chargenauswahl und bereits eingegebene Werte bleiben bei einem Wechsel der Messgröße erhalten. Jede ausgewählte Charge erhält weiterhin einen eigenen Messdatensatz.

## Prüfen und bauen

```bash
cd app
npx tsc --noEmit
npx vitest run
npm run build
```

Der Build erzeugt `dist/index.html` als gebündelte Einzeldatei. `sw.js`, `manifest.webmanifest` und die beiden PWA-Icons werden aus `public/` ergänzt. Die App lädt keine Schrift, Bibliothek oder andere Ressource von einem CDN.

## Installation und Offline-Betrieb

Die gebaute App muss über HTTPS ausgeliefert werden. Auf dem iPhone wird sie in Safari über „Teilen“ und „Zum Home-Bildschirm“ installiert. Der Service Worker hält App-Hülle, Manifest und Icons im Cache. Fach- und Nutzdaten liegen in IndexedDB; Fotos liegen als Blobs in einem getrennten Object Store.

Erfassen, Anzeigen und Gate-Prüfungen funktionieren ohne Netz. Die App gleicht den Stand beim nächsten Start oder Speichern ab, sobald das Gerät wieder online ist. Ein fehlgeschlagener Abgleich verändert den lokalen Stand nicht.

## Geräteabgleich

`proxy/sync.php` wird neben der ausgelieferten App bereitgestellt. Auf dem Server liegt daneben eine nicht versionierte `sync-config.php`, angelegt nach `proxy/sync-config.beispiel.php`. `daten_pfad` verweist auf eine beschreibbare JSON-Datei außerhalb des öffentlichen Web-Verzeichnisses. Der Endpunkt verwendet denselben Proxy-Token wie der Kellersensor.

Ein Gerät übernimmt den Token aus dem Token-Feld oder dem `token`-Parameter seiner Sensor-URL. Ein neues Gerät kann einmalig über `https://www.montolio.de/wein/?sync-token=<TOKEN>` geöffnet werden. Die App speichert den Token lokal und entfernt ihn sofort aus der Adresszeile.

Der Abgleich vereinigt Chargen, Behälter, Messungen, Ereignisse, Reminder, Wiki-Seiten, Klimapunkte und Vorratsposten über ihre IDs. Bei gleicher ID gewinnt der Datensatz mit dem jüngeren `zuletztGeaendert`. Bei exakt gleichem Zeitstempel entscheidet die lexikografisch größere, schlüsselsortierte JSON-Fassung; dadurch treffen Client und Server dieselbe Entscheidung. Grabsteine in `geloescht` verhindern, dass gelöschte Datensätze von einem anderen Gerät zurückkehren. Die Sensor-Konfiguration wird als Teil des Datenstands abgeglichen.

Der Server hält während des gesamten Zusammenführens und Schreibens eine Dateisperre. Er schreibt zuerst eine temporäre Datei, benennt sie danach atomar um und behält die letzten zehn vorherigen Fassungen als `sync-<zeitstempel>.json`.

## Deploy

Der Deploy läuft über den vorhandenen `sftp-deploy`-Skill. Die lokale `.ftp-credentials` wird im Repo-Root aus `.ftp-credentials.vorlage` erzeugt und nicht committed. Der Skill wird aus `app/dist` gestartet, damit die Dateien direkt im Zielverzeichnis landen:

```bash
cp .ftp-credentials.vorlage .ftp-credentials
# Zugangsdaten und FTP_LIVE_URL in .ftp-credentials eintragen
ln -s ../../.ftp-credentials app/dist/.ftp-credentials
cd app/dist
~/.claude/skills/sftp-deploy/deploy.sh
```

Der Link enthält keine Zugangsdaten und liegt im ignorierten Build-Ordner. Ein neuer Build kann ihn entfernen; vor dem nächsten Deploy wird er dann erneut angelegt. `index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.svg` und `icon-512.svg` müssen immer gemeinsam übertragen werden.

`proxy/sync.php` und die serverseitig ausgefüllte `sync-config.php` werden separat in dasselbe Zielverzeichnis übertragen. Die echte Konfigurationsdatei darf nicht ins Repository gelangen.

## Datenstruktur

- `Datenstand`: Jahrgang, Chargen, Behälter, Messungen, Ereignisse, Reminder, Wiki, Klima, Sensor und Vorrat.
- `Charge.mengeKg` und `Charge.elternChargeId`: Menge und direkte Abstammung liegen im Chargenmodell.
- `Charge.volumenHistorie`: Pressen, Abstiche und Gefäßwechsel hängen einen neuen Volumenpunkt an. `fuellLiter` und `kopfraumLiter` spiegeln den jüngsten Punkt.
- `Ereignis.vorratId`: Verknüpfte Zugaben vermindern den Vorrat; beim Löschen bucht die Speicherschicht die Menge zurück.
- IndexedDB-Store `datenstand`: aktiver Datenstand. Beim Laden migriert die App ältere Fassungen auf Version 3, ergänzt Sync-Zeitstempel und schreibt die Migration zurück.
- IndexedDB-Store `fotos`: getrennte `Foto`-Objekte mit Blob.

Der erste Start legt drei Ausgangschargen, den Behälter- und Materialbestand, Termine sowie sieben Fachwiki-Seiten an. Danach wird der gespeicherte IndexedDB-Stand geladen; ein Seed überschreibt keine vorhandenen Daten.

## Sicherung und Kalender

Unter „Mehr“ stehen Markdown-, CSV-, JSON- und ZIP-Export bereit. Die JSON-Vollsicherung kann wieder importiert werden und enthält auch Fotos. Der ZIP-Export enthält zusätzlich einzelne Fotodateien. Termine lassen sich einzeln oder gesammelt als `.ics` mit `VALARM` laden; die App erzeugt keine eigenen Push-Benachrichtigungen.

## Offene Punkte

Fotos bleiben gerätelokal. Sie liegen als Blobs in einem eigenen IndexedDB-Store und sind ausdrücklich nicht Bestandteil des Geräteabgleichs. Ein späterer Fotoabgleich braucht eine eigene Größen-, Übertragungs- und Konfliktstrategie.

H6 bringt keine weiteren offenen Punkte mit. Der Schreibtisch, die Runde, „Heute“ und der Press-Gate-Fluss verwenden ausschließlich die seit H2 bis H5 vorhandenen Datenstrukturen und Fachfunktionen.
