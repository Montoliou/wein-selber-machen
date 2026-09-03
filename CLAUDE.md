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

## Nachtrag 30.08.2026 (abends)

- **Remote:** https://github.com/Montoliou/wein-selber-machen.git · `main` · privat.
  `.ftp-credentials` und `node_modules` sind in `.gitignore`.
- **Mockup abgenommen** von Andi. Handoff **H1 (Weinbegleiter MVP)** liegt seither im Postfach:
  `Vault/handoffs/inbox/wein-h1-app-mvp.md`.
- **Alle Chargen werden gleichzeitig angestellt** (Andis Entscheidung, Arbeitsaufwand neben
  dem Beruf). Vorgezogener Start von Bottich 1 verworfen. Auflage: Kühlschrank auf 4–5 °C.
- **Vierter Gärbottich bleibt bestellt** — mit dreien läge der Füllgrad bei 73 % statt 55 %.
- **Neue Regel R-REFRAKTOMETER:** Ein Refraktometer zeigt bei Alkohol systematisch zu hoch an.
  `Messung.methode` ('spindel' | 'refraktometer' | 'sonstige') ist neu im Datenmodell;
  Refraktometerwerte sind von der Gärende-Beurteilung ausgeschlossen. 31 Tests grün.
- **Neu im Spec:** Sammelaktionen über mehrere Chargen (vier synchrone Bottiche einmal erfassen)
  und Umverteilen der drei Ausgangschargen auf vier Gärbottiche beim Anstellen.
- **Bestellt:** Kaliumpyrosulfit + 2 × 3-L-Ballons. Offen: pH-Meter mit Kalibrierlösungen.
- **Presse zurückgestellt** — erst Vorlauf abtropfen, dann nur Trester pressen.

## Sitzung 02.09.2026 — Angestellt und deployt

**App live:** https://www.montolio.de/wein/ — PR #1 gemergt, Startdatensatz auf die echten
vier Bottiche umgestellt.

**Serverumgebung montolio.de:** PHP **8.4**, SFTP auf Port 22, Dokumentenwurzel
`/MLP_MultiAccount_App/`. Der Kellersensor-Proxy ist trotzdem 7.4-tauglich geschrieben —
läuft auf 8.4 unverändert, spart aber Nacharbeit, falls er mal woanders liegt.

**Deploy-Falle (kostete zwei Anläufe):** Das Dokumenten-Wurzelverzeichnis von montolio.de ist
`/MLP_MultiAccount_App/`, **nicht** `/`. Richtig ist `FTP_TARGET_DIR=/MLP_MultiAccount_App/`
plus `FTP_SUBDIR=wein`. Ein Upload nach `/wein/` landet außerhalb des ausgelieferten Bereichs
und liefert 404 bei erfolgreichem Upload. Referenz ist immer `Genogramm/.ftp-credentials`.

**Zwei Defekte der Projekt-Anmeldung** (Meldung liegt im `_kanal` an Jarvis): Es werden keine
Deploy-Zugangsdaten hinterlegt, und die ausgelieferte Vorlage benutzt andere Feldnamen als
der `sftp-deploy`-Skill (`HOST=` statt `FTP_HOST=` usw.). Codex hat die Vorlage im PR korrigiert.

**Handoff-Falle:** Der Prozessor läuft auf dem Mini, die Projekte liegen am MacBook. Ein neu
angelegtes Projekt muss auf dem Mini **geklont** werden, sonst schlägt der Handoff mit
„kein Git" fehl — zusätzlich zum Eintrag in `handoffs/repos.json`.

**Jahrgang:** 48,5 kg auf vier Bottiche (13,13/12,28/12,53/10,58 kg netto, Tara 1,175 kg).
Mostgewichte 56/54/54/50 °Oe, volumengewichtet 53,7. Auf 85 °Oe aufgezuckert (2,63 kg
als gemeinsamer Ansatz, geviertelt). **Startdichte 82 °Oe**, gemessen nach Zucker, Hefe
UND Nährsalz. Angestellt bei 21 °C.

**Rechenfehler zum Merken:** Das Anmachwasser der Hefe (0,5 L auf vier Bottiche) fehlte im
Bezugsvolumen der Zuckerrechnung. Das sind 1,4 % Verdünnung und erklärt rund 1 der 3 fehlenden
°Oe. Künftig entweder in Most statt Wasser rehydrieren oder das Wasser mitrechnen.

**Fachliche Entscheidungen:**
- **Ziel 85 statt 80 °Oe** — Andi: „Wir wollen nicht professionell sein, wir wollen einen
  leckeren, nicht zu trockenen Wein." Die 3-%-Anreicherungsgrenze ist Handelsrecht, kein
  Qualitätsmaßstab. Mehr Alkohol gibt einem säurebetonten Wein Körper.
- **Keine Süßreserve.** Restzucker in der Flasche bleibt für 2026 gesperrt. Weg: trocken
  ausbauen, bei Bedarf im Glas süßen.
- **Nicht nachgezuckert** von 82 auf 85: 0,35 % vol liegen unter der Wahrnehmungsschwelle,
  und Zucker direkt nach dem Anstellen belastet die Hefe osmotisch in ihrer empfindlichsten
  Phase. Option auf spätere Staffelgabe (~69 g je Bottich) bleibt offen.
- **Beim Anstellen nicht geschwefelt**, obwohl 100 g geliefert waren: Freier SO₂ ist nicht
  messbar, jede frühe Gabe bindet sich unsichtbar und verschlechtert das Modell für den Ausbau.
- **Erntezeitpunkt ist der Befund des Jahres:** 30.08. statt 12.10. wie 2025, daher 20 °Oe
  weniger. Merkposten 2027: später lesen. Folge: hohe Säure erwartet, biologischer Säureabbau
  nach der Gärung wahrscheinlich richtig — dann nach Gärende **nicht sofort schwefeln**.

**Offener Review-Punkt:** Bei rot gesperrter Charge ist „Weiter zur nächsten Phase" nicht
deaktiviert. Formal vertretbar (kein Gate an der Stelle), aber ein Nachtrag für H2.

**Werkzeuge:** Tauchspindel Notimin und Schlauchheber mit Gitterfilter vorhanden.
pH-Meter mit Kalibrierlösungen 4/7/10 geliefert — kalibriert wird **nur mit 7,00 und 4,01**,
die 10er verschlechtert die Gerade im Weinbereich.
