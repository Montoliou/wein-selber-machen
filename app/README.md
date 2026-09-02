# Weinbegleiter 2026

Mobile, offlinefähige PWA für den Weinjahrgang 2026. Die Fachentscheidungen liegen ausschließlich in `src/domain/`; die UI ruft diese Regel- und Rechenfunktionen auf.

## Lokal starten

```bash
cd app
npm ci
npm run dev
```

Vite zeigt die lokale URL im Terminal. Für die Bedienung mit iPhone-Breite kann die Browseransicht auf 375 px gestellt werden.

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

## Datenstruktur

- `Datenstand`: Jahrgang, Chargen, Behälter, Messungen, Ereignisse, Reminder, Wiki, Klima, Sensor und Vorrat.
- `Charge.mengeKg` und `Charge.elternChargeId`: Menge und direkte Abstammung liegen im Chargenmodell.
- `Charge.volumenHistorie`: Pressen, Abstiche und Gefäßwechsel hängen einen neuen Volumenpunkt an. `fuellLiter` und `kopfraumLiter` spiegeln den jüngsten Punkt.
- `Ereignis.vorratId`: Verknüpfte Zugaben vermindern den Vorrat; beim Löschen bucht die Speicherschicht die Menge zurück.
- IndexedDB-Store `datenstand`: aktiver Datenstand. Beim Laden migriert die App Version 1 auf Version 2 und schreibt die Migration zurück.
- IndexedDB-Store `fotos`: getrennte `Foto`-Objekte mit Blob.

Der erste Start legt drei Ausgangschargen, den Behälter- und Materialbestand, Termine sowie sieben Fachwiki-Seiten an. Danach wird der gespeicherte IndexedDB-Stand geladen; ein Seed überschreibt keine vorhandenen Daten.

## Sicherung und Kalender

Unter „Mehr“ stehen Markdown-, CSV-, JSON- und ZIP-Export bereit. Die JSON-Vollsicherung kann wieder importiert werden und enthält auch Fotos. Der ZIP-Export enthält zusätzlich einzelne Fotodateien. Termine lassen sich einzeln oder gesammelt als `.ics` mit `VALARM` laden; die App erzeugt keine eigenen Push-Benachrichtigungen.
