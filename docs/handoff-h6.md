---
id: wein-h6-oberflaeche-nach-situationen
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Ersatz der Oberflächenschicht nach dem abgenommenen UX-Konzept (docs/ux-konzept.md) und den abgenommenen Mockups v3. Ein Code, drei Layoutklassen nach Bildschirmbreite. Vier Bildschirme aus fünf Situationen: die Runde (iPad), Heute (iPad zweispaltig, Telefon einspaltig), der Gate-Fluss (iPad), der Schreibtisch (Mac/PC dreispaltig). Regelengine, Speicher, Abgleich, Sensor und Startdatensatz bleiben unangetastet. Der Gate-Fluss muss vor dem 07.09.2026 benutzbar sein — an dem Tag wird voraussichtlich gepresst.
allowed_paths: ["app/src/ui/**", "app/src/main.ts", "app/index.html", "app/public/**", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 44 bestehenden Tests bleiben gruen. domain/, speicher/, sync.ts, sensor.ts und startdaten.ts werden nicht angefasst - H5 ist gerade erst gelandet und wird nicht nebenbei bewegt. Braucht die Oberflaeche etwas aus diesen Schichten, das es nicht gibt, steht das unter '## Offene Punkte' im PR."
  - "L1 LAYOUTKLASSEN: Eine reine, getestete Funktion layoutKlasse(breite) liefert 'telefon' (unter 600 px), 'tablet' (600 bis unter 1200 px) oder 'schreibtisch' (ab 1200 px). Ein iPad im Querformat (1000-1180 px) MUSS 'tablet' ergeben. Das Layout haengt ausschliesslich an dieser Funktion; die Klasse steht als data-layout am Wurzelelement und wird bei Groessenaenderung neu bestimmt. Kein max-width:520px mehr auf Tablet und Schreibtisch."
  - "R1 DIE RUNDE (Situation 1 und 4), Soll: outputs/mockup-v3-ipad.html, Ansicht 'Runde'. Ein Gefaess fuellt den Bildschirm, keine Navigationsleiste. Links gross: Nummer, 'n von N', Name, Menge, Phase, Ampel, darunter der Block 'Zuletzt' mit den letzten Werten und ihrem Zeitpunkt (Trendpfeil, wo ein Vorwert existiert). Rechts die phasengerechten Felder aus H3 (Gaerung: Temperatur, Mostgewicht mit Messmethode, Geruch, Gaeraktivitaet; Ausbau: Oberflaeche, Geruch, Kopfraum, Fuellstand), gross, Zahlenblock (inputmode=decimal), 'Weitere Messgroessen' zugeklappt, dazu ein Haken 'Untergestossen', der ein Ereignis der Art unterstossen anlegt."
  - "R2 RUNDE, VERHALTEN: EIN Zeitstempel je Runde, beim Start gesetzt und aenderbar; alle Werte einer Runde tragen ihn. Leere Felder erzeugen keinen Datensatz. Nach dem Speichern wechselt die rechte Seite in den Befund: Ampel und Ein-Satz-Text der Regelengine (befundeFuerCharge/ampelFuerCharge), darunter der grosse Knopf 'Weiter -> <naechstes Gefaess>' und 'Letzte Eingabe zuruecknehmen' mit 30-Sekunden-Zaehler. KEIN automatischer Sprung zum naechsten Gefaess. Wischen nach links/rechts UND Pfeile am Rand wechseln das Gefaess; Wischen braucht eine Mindeststrecke, damit ein Tippen auf ein Feld nicht wechselt. Nach dem letzten Gefaess eine Zusammenfassung: erfasste Werte je Gefaess, Ampelwechsel, Faelliges. Abbrechen oben rechts verwirft nur das noch nicht Gespeicherte."
  - "R3 RUNDE, EINSTIEG: Auf 'Heute' ein primaerer Knopf 'Runde starten', wenn eine Runde faellig ist (Reminder mit Wiederholung oder aelter als 12 Stunden seit der letzten Erfassung in der aktiven Phase); sonst kein primaerer Knopf. Das Antippen einer Erinnerung, die eine Kontrolle verlangt, oeffnet direkt die Runde im ersten betroffenen Gefaess - nicht eine Uebersicht. Die Runde laeuft ueber alle nicht archivierten Chargen in ihrer Reihenfolge."
  - "R4 RUNDE, TESTS (happy-dom): leere Felder erzeugen keinen Datensatz; alle Werte eines Gefaesses tragen denselben Zeitstempel; Speichern springt nicht automatisch weiter; Zuruecknehmen entfernt genau die zuletzt gespeicherten Datensaetze; layoutKlasse(1024) ist 'tablet' und layoutKlasse(1200) ist 'schreibtisch'."
  - "H1 HEUTE AUF DEM TABLET, Soll: outputs/mockup-v3-ipad.html, Ansicht 'Heute'. Zwei Spalten. Links Statusband (Chargen, schlechteste Ampel, Tag der Phase, Anzahl faellig, Kellertemperatur) und darunter die Gaerverlaufskurve GROSS: alle Chargen ueberlagert in je eigener Farbe mit Legende, gestrichelte Erwartung, Pressfenster als Band mit Datum. Rechts: 'Runde starten' bzw. 'Jetzt dran', Kellerklima (Temperatur, Feuchte, Quelle, Zeit, Batterie), Chargen als EINE ZEILE je Gefaess (Ampelpunkt, Name, kg, letzte Dichte, letzte Temperatur, Trend seit Start), Faelliges. Auf dem Telefon bleibt Heute einspaltig wie in H2/H4; nichts davon geht verloren."
  - "G1 GATE-FLUSS (Situation 3): Aus der statischen Pruefliste wird ein gefuehrter Ablauf: eine Pruefung je Bild mit Frage, Begruendung und - wenn eine Messung fehlt - dem Eingabefeld direkt darin. 'Unbekannt' blockiert weiterhin wie 'nicht erfuellt', wird aber als Frage gestellt, nicht als Fehler gezeigt. Sind alle Pruefungen erfuellt, folgt die Handlung. Beim Press-Gate: Vorlauf und Presswein mit Litern erfassen, Gefaesse aus der Behaelterliste waehlen, Kopfraum eintragen; die App legt zwei neue Chargen (typ vorlauf / presswein) mit elternChargeId, Volumenpunkt und Behaelter an, setzt beide auf NACHGAERUNG und archiviert die Maische-Charge. vermischungErlaubt() wird beachtet. Nutzt ausschliesslich Strukturen, die seit H2 existieren."
  - "G2 GATE-FLUSS, FRIST: Gepresst wird voraussichtlich am 07.09.2026. Der Gate-Fluss ist deshalb VOR dem Schreibtisch zu bauen (siehe Reihenfolge unten). Ist er bis dahin nicht fertig, muss die alte Pruefliste samt 'Umverteilen' weiterhin funktionieren - nichts davon darf vorher entfernt werden."
  - "D1 SCHREIBTISCH (Situation 5), Soll: outputs/mockup-v3-desktop.html. Drei Spalten ab 1200 px. Links Seitenleiste mit Navigation (Heute, Runde, Journal, Termine, Wiki, Einstellungen) und Gefaessliste mit Ampelpunkt und letzter Dichte, im Fuss Abgleichzeit und Fassung. Mitte Statusband, Verlauf in voller Breite mit Umschaltung Gaerverlauf / Temperatur / Kellerklima und Zeitraum 7 Tage / Gaerung / Alles, darunter Kellerklima der letzten 48 Stunden aus dem Proxy-Verlauf und die Phasenkarte. Rechts Messtabelle und Ereignisse des gewaehlten Gefaesses; Zeilen oeffnen das Bearbeiten aus H4. Inline-SVG, keine Diagrammbibliothek."
  - "N1 NAVIGATION: Telefon unten mit Heute, Runde, Termine, Mehr (Wiki, Export, Sensor, Einstellungen unter Mehr). Tablet: dieselben Ziele, seitlich einklappbar oder unten; in der Runde ausgeblendet. Schreibtisch: Seitenleiste mit allen Zielen. Tiefe Links (#runde, #charge/<id>, #gate/<id>) bleiben erhalten."
  - "K1 NICHTS VERLIEREN: Alles aus H2 bis H5 bleibt funktional - Erklaerschubladen (zugeklappt), stehenbleibende Meldungen, Versionszeile und Update-Hinweis, Abgleichzeile mit 'Jetzt abgleichen', Sensor beim Start, Kellerkurve, Bearbeiten/Loeschen, beide Erfassungsmodi aus H3 (die Runde ersetzt 'Ein Bottich / viele Werte' und darf ihn ausbauen; 'Ein Wert / alle Bottiche' bleibt erreichbar). Wer etwas entfernt, schreibt es unter '## Offene Punkte'."
  - "T1 TECHNIK: Vanilla TypeScript, keine neue Laufzeit-Abhaengigkeit, keine Bibliothek fuer Gesten oder Diagramme. npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Der Service Worker bleibt netzwerk-zuerst; CACHE-Version wird erhoeht, weil sich die Huelle aendert. prefers-reduced-motion schaltet alle Animationen ab."
  - "P1 PR-TEXT: Der PR enthaelt zwingend einen Abschnitt '## Offene Punkte' - auch wenn er 'keine' lautet. Anlass: In H3 fiel ein zugesagter Test stillschweigend weg, in H5 stand der Fotoausschluss nur in der README. Dazu Screenshots: Runde auf 1024 px (Eingabe und nach dem Speichern), Heute auf 1024 px, Gate-Fluss mit einer offenen Pruefung, Schreibtisch auf 1440 px, Heute auf 375 px."
---

# Auftrag H6 — Die Oberfläche nach Situationen, nicht nach Funktionen

## Warum dieser Auftrag anders ist als H1 bis H5

Andi am 04.09.2026, nach zwei Tagen Betrieb am Gärbottich:

> „Es wirkt als hätte ein Schüler ein Softwareprojekt gebaut. Nicht als hätte jemand
> überlegt: Für was/wen baue ich diese Software? Wann wird sie eingesetzt? Wie baue ich
> sie so, dass der Nutzer möglichst viel Infos bekommt und dabei möglichst bequeme
> Eingaben machen kann, während er eine Spindel in den Messbehälter jongliert, klebrige
> Finger hat und darüber nachdenkt, ob er die Gärstopfen noch nachfüllen muss."

Er hat recht, und der Fehler lag in der Spezifikation, nicht im Bau: H1 hat eine
Funktionsliste in Bildschirme übersetzt, H2 bis H4 haben Symptome geflickt. Dieser
Auftrag ersetzt die Oberflächenschicht. Er flickt nicht.

**Die Grundlage ist abgenommen:** `docs/ux-konzept.md` (fünf Situationen, vier Bildschirme,
drei Geräteklassen) und die Mockups `outputs/mockup-v3-ipad.html` (Runde und Heute) sowie
`outputs/mockup-v3-desktop.html` (Schreibtisch). Für das Telefon gilt weiter
`outputs/mockup-weinbegleiter-v2.html`. Lies zuerst das Konzept — es begründet jede
Entscheidung, die unten nur noch als Kriterium steht.

## Die fünf Situationen in einem Satz

Zweimal täglich steht Andi mit dem iPad am Bottich und erfasst vier Werte je Gefäß
(**Runde**). Abends schaut er dreißig Sekunden aufs Sofa-Gerät, ob alles grün ist
(**Heute**). Etwa alle fünf Tage im Herbst, später alle drei Wochen, muss die App ihn
durch eine Entscheidung führen (**Gate-Fluss**, **Ausbau-Kontrolle** = Runde mit anderen
Feldern). Und am Schreibtisch will er alles nebeneinander sehen (**Schreibtisch**).

Andis Festlegungen: iPad ist das Gerät der Runde, das Telefon bekommt nur Heute und
Termine. Wischen plus „Weiter"-Knopf, **kein** automatischer Sprung. Schreibtisch im Browser.

## Reihenfolge — und warum sie nicht verhandelbar ist

1. **Layoutklassen** (L1) — das Fundament, ohne das nichts anderes richtig sitzt.
2. **Die Runde** (R1–R4) — der tägliche Schmerz.
3. **Heute auf dem Tablet** (H1).
4. **Der Gate-Fluss** (G1) — **vor dem 07.09.2026**, da wird voraussichtlich gepresst.
   Die Dichte in Bottich 1 fiel von 82 auf 68 °Oe in dreißig Stunden; das Pressfenster
   bei SG 1,010 liegt damit um den 07./08.09.
5. **Der Schreibtisch** (D1) — hat keine Frist.

Reicht die Zeit nicht für alles: Der Schreibtisch darf als Ganzes unter „Offene Punkte"
stehen. Ein halb gebauter Gate-Fluss darf es nicht — dann bleibt die alte Prüfliste
samt „Umverteilen" in Betrieb (G2).

## Was bleibt, was geht

| Bleibt unverändert | Wird ersetzt |
|---|---|
| Regelengine, Gates, Ampel (`domain/`) | Layout und Navigation der gesamten Oberfläche |
| Speicher, Migration, Abgleich (H5), Sensor | Erfassen-Formular → die Runde |
| Wiki-Inhalte, Export, Journal | Chargendetail → Gefäßkarte (Tablet) bzw. Schreibtisch |
| Statusband, Kurve, Schubladen, Meldungen (H2), Version und Abgleichzeile (H4/H5) | Gate-Prüfliste → Gate-Fluss |
| Beide Erfassungsmodi (H3) als Fähigkeit | Einspaltigkeit auf Tablet und Schreibtisch |

## Konstruktionshinweise, die Zeit sparen

- Die phasengerechten Felder gibt es seit H3 — die Runde nutzt dieselbe Tabelle.
- Die Aufteilung einer Charge gibt es seit H2 als „Umverteilen" (`elternChargeId`,
  `volumenHistorie`, `vermischungErlaubt`). Der Press-Schritt im Gate-Fluss ist diese
  Funktion mit Führung davor, nicht eine neue.
- Bearbeiten und Löschen gibt es seit H4; die Messtabelle am Schreibtisch ruft sie auf.
- Die Kellerkurve kommt seit H4 aus `<endpunkt>&verlauf=1&n=…`; der Schreibtisch zeigt
  dieselben Daten nur größer und über 48 Stunden.
- Der Befund nach dem Speichern ist `befundeFuerCharge()` — der erste Befund als Satz,
  sonst „Normal" mit einer Zeile Kontext (z. B. Abbau seit dem letzten Wert).

## Constraints

- Vanilla TypeScript, keine neue Abhängigkeit. Gesten von Hand (touchstart/touchend mit
  Mindeststrecke), Diagramme als Inline-SVG.
- `domain/`, `speicher/`, `sync.ts`, `sensor.ts`, `startdaten.ts` sind tabu. Fehlt der
  Oberfläche dort etwas, steht es unter „Offene Punkte" — nicht raten, nicht umgehen.
- Bei fachlicher Unklarheit: „Offene Punkte". Nicht stillschweigend weglassen.

## Nach dem Bau

Screenshots wie in P1 in den PR. Dazu ein Absatz, wie das Wischen gegen Fehlbedienung
gesichert ist, und einer, was passiert, wenn während einer Runde die Verbindung wegfällt.
