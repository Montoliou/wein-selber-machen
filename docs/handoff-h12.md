---
id: wein-h12-keller-kontrolle
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Keller-Startbildschirm und Kontrolle am Ballon nach Mockup v4, Bildschirme 1 und 2. Setzt H10 voraus (Lose, eine Charge je Gefäß). Die erste Ausbau-Kontrolle ist am 10.10.2026.
allowed_paths: ["app/src/ui/**", "app/src/main.ts", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE bestehenden Tests bleiben gruen. domain/ wird NICHT angefasst."
  - "K1 KELLER ALS STARTBILDSCHIRM: Sobald keine aktive Charge mehr vor ERSTER_ABSTICH steht und mindestens eine im AUSBAU ist, zeigt 'Heute' den Keller statt der Gaerkurve. Die Gaerkurve bleibt ueber die Charge erreichbar. Steht eine neue Charge in der Gaerung (Oktoberlese), zeigt 'Heute' beides: oben die Gaerung, darunter den Keller."
  - "K2 DAS REGAL nach outputs/mockup-v4-ausbau.html, Bildschirm 1: je Gefaess ein Ballon-Umriss mit Pegel nach der juengsten fuellstand-Messung ('im Hals' / 'an der Schulter' / 'darunter'), Nummer, Losname, zwei Plaketten 'Gaerende' und 'SO₂' (gruen = bestaetigt bzw. geschwefelt, gelb = offen). Reihenfolge nach Behaelter.regalPosition, fehlt sie, nach Namen. Leere, nicht ausgemusterte Gefaesse blass daneben. Tippen auf einen Ballon oeffnet die Kontrolle an diesem Ballon. Die Regalposition ist in der Gefaessverwaltung aenderbar."
  - "K3 LOSE: je Los eine Karte mit Menge (Summe fuellLiter), Gefaessen, juengstem pH, juengster Dichte (Werte mit grenze als '< −3 °Oe'), Gaerende-Status (gaerendeGate auf den Chargen des Loses) und Schwefelstatus (juengstes Kaliumpyrosulfit-Ereignis mit Datum und ml)."
  - "K4 WAS ANSTEHT: offene Reminder der App plus je Los die naechste faellige Kontrolle (juengster Eintrag + GRENZEN.kontrollintervallAusbauTage). Keine erfundenen Termine."
  - "K5 KELLERKLIMA: juengster Wert, Spanne der letzten 7 Tage aus stand.klima, ein Band mit dem Ausbau-Ziel 12–16 °C und der Ist-Marke. Liegt der Wert ueber 16 °C, ein Satz: '<n> Grad ueber dem Ziel. Fuer den Ausbau ueber Monate zu warm.'"
  - "K6 KONTROLLE AM BALLON nach Bildschirm 2: die bestehende Runde in Ausbau-Konfiguration, ein Gefaess je Bild, Wischen wie bisher. Felder als grosse Tippflaechen (mindestens 44 px hoch): Fuellstand (im Hals / an der Schulter / darunter), Oberflaeche, Geruch, Gaerroehrchen (Wasser drin / nachgefuellt — 'nachgefuellt' erzeugt ein Ereignis). Dichte freiwillig, mit dem Schalter 'unter der Skala' aus H10. Links 'Zuletzt' mit den Werten der letzten Kontrolle. Die Kachel 'Schwefel' zeigt die Milliliter aus stammloesungMl(); zugeben ist nur moeglich, wenn gaerendeGate freigegeben ist, sonst steht der Grund daneben."
  - "K7 BEFUND: Nach dem Speichern der Befund aus der Regelengine wie in der Garrunde. 'darunter' ergibt ORANGE, 'an der Schulter' GELB — das rechnet befundeFuerCharge() bereits."
  - "T1 TESTS (happy-dom), ueber echte Klicks: (a) nach H10-Abstich zeigt 'Heute' das Regal mit fuenf befuellten und einem leeren Gefaess; (b) Tippen auf 'darunter' und Speichern ergibt einen ORANGE-Befund; (c) 'nachgefuellt' beim Gaerroehrchen erzeugt ein Ereignis; (d) die Schwefel-Kachel ist ohne bestaetigtes Gaerende gesperrt und nennt den Grund."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine neue Abhaengigkeit. Der PR enthaelt '## Offene Punkte' und Screenshots von Keller und Kontrolle in iPad-Breite (1180 px) neben den Mockup-Bildschirmen."
---

# Auftrag H12 — Keller und Kontrolle am Ballon

Setzt H10 voraus. Vorlage ist `outputs/mockup-v4-ausbau.html`, von Andi am 26.09.2026
abgenommen, Bildschirme 1 und 2.

## Warum der Keller Startbildschirm wird

Im Ausbau gibt es keine Gärkurve mehr, die man ansehen müsste. Was zählt, ist, ob jedes Gefäß
voll ist, ob die Oberfläche sauber ist und wann die nächste Kontrolle ansteht. Der 2025er
Hauptwein ist genau daran gescheitert: Kopfraum über Monate, niemand hat nachgesehen, beim
Öffnen waren Fruchtfliegen und ein Film auf der Oberfläche.

## Warum Füllstand als Stufe

Am Ballon schätzt niemand Kopfraum in Litern. „Im Hals", „an der Schulter", „darunter" kann
jeder mit einem Blick beantworten. Die Regelengine bewertet die Stufe seit 26.09.2026.

## Was die App nicht tut

Sie legt keine Kalendertermine an. Das kann sie nur als `.ics`-Datei, und eine solche Datei
ist am 10.09.2026 nie importiert worden. Die Kalendertermine pflegt Lucius direkt im
Google-Kalender; die App zeigt fällige Kontrollen an, wenn sie offen ist.
