# wein-selber-machen — Projektvertrag (angelegt 2026-08-30 via Projekt-Anmeldung)

**Zweck:** Eine Begleitung für die Weinherstellung. Von der Rebe bis zum fertigen Wein
**Cluster:** privat · **Wiki-Seite:** `~/SynologyDrive/Mission-Control-Wissen/projekte/wein-selber-machen.md`

Diese Datei lädt in jeder Claude-Sitzung automatisch (App + Code). Für Codex gilt die
inhaltsgleiche `AGENTS.md` daneben. Die Regeln reisen mit dem Projekt — sie gelten in
allen vier Arbeitskontexten.

## Vor dem Bauen (Doppelbau- und Kollisions-Schutz)

1. **Gibt es das Ergebnis schon?** EIN Befehl, alle Domänen:
   `python3 ~/Documents/Appentwicklung/Claude/MissionControl/automation-ops/ergebnis-register.py --suche "<begriff>"`
2. **Arbeitet gerade jemand hier?** Prüfen, dann Marke setzen:
   `bash ~/Documents/Appentwicklung/Claude/MissionControl/automation-ops/arbeitsmarke.sh pruefen "/Users/Montolio/Documents/Appentwicklung/wein-selber-machen"`
   `bash ~/Documents/Appentwicklung/Claude/MissionControl/automation-ops/arbeitsmarke.sh setzen "<Chat-Name>" "/Users/Montolio/Documents/Appentwicklung/wein-selber-machen"`

## Nach dem Erzeugen (Gedächtnis-Konvention)

- Ergebnisse gehören nach `outputs/`; **zu jedem Artefakt `<name>` eine Begleitdatei
  `<name>.meta.md` daneben** (Vorlage: `CLAUDE.md` im `outputs/`-Ordner einer MC-Domäne,
  z. B. `Claude/MissionControl/beratung-protokolle/outputs/CLAUDE.md`).
- Überholtes NIE löschen/umbenennen — `gueltig: ueberholt` + `ueberholt_durch` setzen.
- Vor Versand einfrieren:
  `bash ~/Documents/Appentwicklung/Claude/MissionControl/automation-ops/versand-einfrieren.sh <pfad> "<Empfänger>"`

## Ereignis-Rückschreibung (die Lehre vom 14.08.2026)

Passiert in der echten Welt etwas, das eine Anzeige oder Wahrheitsdatei betrifft — **Deploy,
Versand, Zustellung, Abschluss, Statuswechsel** — wird die Quelle SOFORT in derselben Sitzung
nachgeführt, nicht „später":

- **Deploy/erreichbar unter URL** → `url:`-Feld im Frontmatter der Wiki-Seite eintragen
  (sonst fehlt der Kachel der Live-Knopf).
- **Statuswechsel** (aktiv/pausiert/abgeschlossen) → `status:` auf der Wiki-Seite.
- **Domänen-Ereignis** (z. B. „versendet", „zugestellt") → die jeweilige Status-/Datendatei
  des Projekts, aus der Kacheln oder Exporte lesen.
- **Architektur-Karte, Projekt-Register und Kacheln pflegt NIEMAND von Hand** — sie werden
  nächtlich aus Wiki-Seite, Ordner und `.meta.md` erzeugt. Wer die Karte ändern will, ändert
  die Wiki-Seite. Dafür KEINEN Handoff an Codex schreiben (Fall Mediziner_Akquise, 17.08.2026).

## Harte Regeln (Mission-Control-weit)

- Datenebene ist LOKAL; Kundennamen nur als Kürzel (Auflösung ausschließlich
  `beratung-protokolle/inputs/kuerzel-register.md`, nie exportieren).
- Keine externe Kommunikation in Andis Namen senden — nur Entwürfe.
- `inputs/`-Ordner sind menschlich gepflegt und werden nie automatisch überschrieben.

---

# Arbeitsgedächtnis

## Kürzel-Glossar
- **H1, H2, …** = Handoff n (Bau-Auftrag an Codex im Postfach `Vault/handoffs/inbox/`)
- **Charge** = getrennt geführte Weinmenge; jede Charge hat eigene Phase, Ampel und Historie
- **Gate** = Stop-Punkt vor einem kritischen Schritt; erst nach bestandener Prüfung passierbar
- **°Oe** = Grad Oechsle (Mostgewicht) · **SG** = spezifische Dichte
- **KPS** = Kaliumpyrosulfit (K₂S₂O₅), Schwefelungsmittel
- **Ampel** = GREEN normal · YELLOW Abweichung · ORANGE Charge isolieren · RED Sperre

## Sitzung 30.08.2026 — Projektstart

**Rollen:** Claude plant, spezifiziert und reviewt. **Codex baut.** Diese Grenze wurde in der
Sitzung einmal überschritten und von Andi korrigiert — die Domänen-Regelengine bleibt
Claude-Arbeit (sie ist Spezifikation), UI und Persistenz gehören Codex.

**Entschieden:**
- Messtechnik: **nur pH-Meter**, kein SO₂-Titrationsset. Bewusste Entscheidung von Andi.
  *Folge:* freier SO₂ bleibt dauerhaft unbekannt, molekulares SO₂ ist nur modelliert.
  Süßen und Abfüllen mit Restzucker ist für 2026 gesperrt. Trockener Ausbau ist sauber machbar.
- **Kaltmazeration** bis zum Anstellen statt Sofortstart, mit täglicher Kontrolle und
  klarem Abbruchkriterium (Spontangärung oder Fehlton → sofort anstellen).
- **Bottich 1 (11,0 kg) wird vorgezogen angestellt**, weil die weiteren Gärbottiche erst
  am 02.–03.09. kommen und die Restmenge sonst 96 h ungeschützt läge. Bewusster Startversatz,
  zwei Chargengruppen.
- **Maische heute nicht schwefeln** — der 4-g-Vorrat wird nach Gärende dringender gebraucht,
  und SO₂ vor dem Anstellen hemmt die Reinzuchthefe.
- **Termine** laufen über `.ics` in den macOS-Kalender. Der Morning-Brief von Mission Control
  liest den Kalender per AppleScript aus (`automation-ops/ki-takte/morning-brief/vorlauf.sh`
  → `data/termine-heute.txt`). **Kein zweites Erinnerungssystem bauen.**
- **Technik:** Vite + TypeScript, Regelengine strikt getrennt von der UI, Vitest,
  gebündelt zu einer `index.html` (vite-plugin-singlefile) + Service Worker.
  Passt zum vorhandenen `sftp-deploy`-Skill und zur `.ftp-credentials.vorlage` (`FILES=index.html`).

**Verworfen:**
- Volles Messpaket (~140 €) — Andis Entscheidung.
- Edelstahltank mit Schwimmdeckel gegen Kopfraum — 6 × 5 L Ballons reichen für 30 L.
- Alles gemeinsam am Dienstag anstellen — hinfällig, weil Dienstag nichts geliefert wird.

**Faktenlage korrigiert gegenüber dem ChatGPT-Handoff:**
- Es sind **3** Gärbottiche à 20 L bestellt, nicht 2 (53,97 € ÷ 17,99 €). Mit dem vorhandenen
  also 80 L brutto gegen 62 L Bedarf — die Kapazitätssorge ist erledigt.
- Lieferung Bottiche **02.–03.09.**, nicht Dienstag 01.09. Ballons (4 × 5 L) **04.09.**
- Die 20,5 % Differenz zwischen 61,0 kg brutto und 48,5 kg entrappt ist geklärt:
  Transportboxen mitgewogen plus Handverlesung mit direktem Ausschuss.
  Für 2027: Brutto und Netto getrennt erfassen.

**Offen:**
- **Presse oder Maischesack vorhanden?** Presstermin ~06.–09.09., Lieferzeiten laufen.
- Welcher Internet-Thermometer im Keller? Bestimmt den Sensor-Adapter (Shelly Cloud /
  Govee / generisches JSON). Wichtig: Die App läuft über HTTPS und kann kein
  unverschlüsseltes Gerät im Heimnetz abfragen (Mixed Content).
- Abnahme des Mockups durch Andi → erst danach geht der Handoff an Codex.
