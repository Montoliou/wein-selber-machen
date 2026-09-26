---
id: wein-h10-ausbau-lose-abstich
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Die App kann den Ausbau nicht abbilden. Am 26.09.2026 lag der Vorlauf in fünf Ballons, der Presswein in einem; der Press-Gate kennt aber nur ein Gefäß je Fraktion, und einen Abstich gibt es gar nicht. Neu - Lose mit einer Charge je Gefäß, Press-Gate mit mehreren Gefäßen, Abstich-Fluss nach Mockup v4 Bildschirm 3, Dichte "unter der Skala", Schwefel in Millilitern Stammlösung. Die Domänenlogik ist fertig und getestet; hier geht es nur um Oberfläche und Datenfluss.
allowed_paths: ["app/src/ui/**", "app/src/main.ts", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 90 bestehenden Tests bleiben gruen. domain/ wird NICHT angefasst. Alle Entscheidungen kommen aus der Fachschicht: fuellplan(), abstichGate(), gaerendeGate(), stammloesungMl(), behaelterVerfuegbar(). Keine dieser Rechnungen wird in der Oberflaeche nachgebaut."
  - "L1 LOSE: Chargen mit gleichem Feld `los` gehoeren zusammen (derselbe Wein in mehreren Gefaessen). Je Gefaess genau eine Charge. Chargenname nach dem Muster '<Los> · <Gefaessname>', z. B. 'Vorlauf 2026 · Ballon 1'. `herkunftIds` enthaelt die Chargen, aus denen sie hervorging."
  - "L2 PRESS-GATE MIT MEHREREN GEFAESSEN: Im Formular press-teilung-form waehlt man je Fraktion (Vorlauf, Presswein) MEHRERE Zielgefaesse statt eines. Das Formular schlaegt die Literzahl je Gefaess aus fuellplan(volumen, gefaesse, { zielFuellung: 'schulter', trubAnteil: 0 }) vor; die Werte sind ueberschreibbar. Beim Absenden entsteht je Gefaess eine Charge im Los 'Vorlauf <Jahrgang>' bzw. 'Presswein <Jahrgang>', Phase NACHGAERUNG, herkunftIds = alle Maische-Chargen, volumenHistorie mit fuellLiter je Gefaess. Die Maische-Chargen werden archiviert wie bisher. Der Zeitpunkt bleibt ein Eingabefeld, weil Andi den Stand vom 09.09. nachtraegt."
  - "L3 ABSTICH-FLUSS nach outputs/mockup-v4-ausbau.html, Bildschirm 3. Einstieg: bei jedem Los mit Chargen in NACHGAERUNG, GAERENDE_GATE, ERSTER_ABSTICH oder AUSBAU ein Knopf 'Abstich'. Der Fluss zeigt die Pruefungen aus abstichGate() einzeln wie der bestehende Gate-Fluss; 'Ballons ausgespuelt und abgekuehlt' ist eine Bestaetigung per Tippen; 'bewusst vorziehen' ist ein Textfeld, das nur erscheint, wenn das Gaerende nicht bestaetigt ist. Zielgefaesse: alle Gefaesse des Loses (die werden beim Abstich frei) plus freie Gefaesse nach behaelterVerfuegbar(); Presswein-Gefaesse eines anderen Loses werden nicht angeboten. Darunter der Fuellplan aus AbstichPruefung.plan mit Litern je Gefaess, freien Gefaessen, Rest fuer Auffuellflaschen und den Hinweisen. Zeitpunkt als Eingabefeld (Nachtrag)."
  - "L4 WAS DER ABSTICH SPEICHERT: Die Chargen des Loses werden weitergefuehrt, soweit Gefaesse befuellt werden — die erste Quellcharge uebernimmt das erste befuellte Gefaess und so weiter (behaelterId neu, volumenHistorie-Punkt mit anlass 'Abstich', fuellLiter aus dem Plan, kopfraumLiter 0 bei zielFuellung 'hals'). Quellchargen ohne Zielgefaess werden archiviert. Braucht der Plan mehr Gefaesse als Quellchargen, entstehen neue Chargen im selben Los. Je befuelltem Gefaess eine Messung typ 'fuellstand' mit text 'im Hals' bzw. 'an der Schulter'. Phase danach: AUSBAU, wenn schwefelFreigegeben, sonst NACHGAERUNG. Ein Ereignis art 'abstich' (falls vorhanden, sonst 'sonstiges') mit Begruendung, Plan und Pruefergebnis im Klartext."
  - "L5 DANACH SCHWEFELN im selben Fluss, nur wenn schwefelFreigegeben: Je Gefaess die Milliliter aus stammloesungMl(fuellLiter, pH), pH = juengste pH-Messung irgendeiner Charge des Loses. Anzeige in ml mit der Anleitung '1,00 g Kaliumpyrosulfit in 100 ml Wasser'. Gespeichert als Ereignis Kaliumpyrosulfit mit mengeWert in Gramm (ml × 0,01) und der Formel aus stammloesungMl().formel in der Begruendung. Fehlt der pH: kein Vorschlag, sondern der Hinweis, dass der pH fehlt."
  - "L6 DICHTE 'UNTER DER SKALA': Ueberall, wo Oechsle oder SG erfasst werden (Runde, Erfassen, Gate-Messfeld), ein Schalter 'unter der Skala'. Ist er an, wird die Messung mit grenze 'unter' und wert = Skalenende gespeichert. Das Skalenende ist vorbelegt mit −3 °Oe (die Mostwaage vom 25.09.2026) und aenderbar. Anzeige solcher Werte immer als '< −3 °Oe', nie als '−3 °Oe'."
  - "L7 SCHWEFEL IN ML auch in der Runde: Wo die Runde heute eine Kaliumpyrosulfit-Menge in Gramm vorschlaegt, steht zusaetzlich und zuerst die Milliliterzahl aus stammloesungMl()."
  - "T1 TESTS (happy-dom), jeweils ueber den ECHTEN Klick auf den Absendeknopf, nicht ueber ein kuenstliches SubmitEvent (Lehre aus H8/H9): (a) Press-Gate mit fuenf Vorlauf-Gefaessen und einem Presswein-Gefaess legt sechs Chargen in zwei Losen an; (b) Abstich eines Loses mit fuenf Chargen auf fuenf 5-L-Ballons plus einen 3-L-Ballon fuehrt fuenf Chargen weiter, legt keine neue an und laesst den 3-L-Ballon frei; (c) Abstich mit Presswein und Vorlauf gemischt ist blockiert; (d) eine Dichtemessung mit Schalter 'unter der Skala' wird als grenze 'unter' gespeichert und als '< −3 °Oe' angezeigt; (e) der Schwefelvorschlag nach dem Abstich zeigt fuer pH 3,28 und 5,3 L rund 16,9 ml."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine neue Abhaengigkeit. Der PR enthaelt zwingend einen Abschnitt '## Offene Punkte' und Screenshots der Bildschirme aus L2, L3 und L5 in iPad-Breite (1180 px)."
---

# Auftrag H10 — Ausbau: Lose, Abstich, mehrere Gefäße

## Anlass

Am 26.09.2026 wurde der Vorlauf des ersten Jahrgangs zum ersten Mal abgestochen. Danach lag
er in **fünf** 5-L-Ballons, der Presswein in **einem**. Die App konnte davon nichts aufnehmen:

- Der Press-Gate hat genau ein Auswahlfeld „Gefäß" je Fraktion.
- Einen Abstich gibt es nicht, obwohl er der sauerstoffreichste Schritt des Jahres ist.
- Die Mostwaage endet bei −3 °Oe, der Wein sank darunter. Eine Messung ist nur eine Zahl.
- Geschwefelt wird mit Millilitern einer Stammlösung, die App rechnet in Gramm.

Der ganze Ausbau läuft deshalb derzeit am Kalender vorbei, und die App steht noch bei vier
Maische-Chargen in der Hauptgärung.

## Was fertig ist (nicht anfassen)

In `app/src/domain/` seit 26.09.2026, mit 16 Tests in `ausbau.test.ts`:

- `Charge.los`, `Charge.herkunftIds`, `Behaelter.regalPosition`
- `Messung.grenze` (`'unter' | 'ueber'`) und der Messtyp `fuellstand`
- `fuellplan(volumen, gefaesse, { zielFuellung, trubAnteil })` — kein halbvolles Gefäß
- `abstichGate(stand, eingabe)` → Prüfungen, `zielFuellung`, `schwefelFreigegeben`, `plan`
- `gaerendeGate` behandelt Werte jenseits der Skala als „nicht beweisend"
- `stammloesungMl(liter, ph)` → Milliliter, Formel, Grammzahl
- R-KOPFRAUM akzeptiert die Füllstand-Stufe; Kontrollintervall 14 Tage

## Warum je Gefäß eine Charge

Der Kopfraum ist eine Eigenschaft des Gefäßes, nicht des Weins. Ein Los mit 26 Litern in fünf
Ballons kann vier volle und einen halbleeren haben — und genau der eine kippt. Die Kontrolle
am Ballon (H12) prüft deshalb Gefäß für Gefäß.

## Nachtrag des echten Stands

Nach dem Bau trägt Andi den Jahrgang nach: Press-Gate mit Zeitpunkt 09.09.2026 (Vorlauf in
sechs Gefäße, Presswein in einem), dann den Abstich vom 26.09.2026. Deshalb müssen beide
Flüsse einen änderbaren Zeitpunkt haben.

## Grenzen dieses Auftrags

Der Keller-Startbildschirm und die Kontrolle am Ballon kommen in **H12**, nach dem Merge
dieses Auftrags. Beide ändern dieselbe Datei; getrennt bleibt jeder Bau überschaubar.
