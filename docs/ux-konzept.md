# Weinbegleiter — UX-Konzept v1

Stand 04.09.2026. Entwurf zur Abnahme durch Andi, **vor** jedem Mockup.

## Warum dieses Dokument

Die App bis H4 ist eine Liste von Funktionen, in Bildschirme übersetzt. Alles ist da,
alles funktioniert, alles liegt auf einer Spalte, die auf dem iPad zur Briefmarke wird.
Nie aufgeschrieben wurde: **Wer steht wo, mit was in der Hand, und will in diesem Moment
was?** Andi am 04.09.: *„…während er eine Spindel in den Messbehälter jongliert, klebrige
Finger hat und darüber nachdenkt, ob er die Gärstopfen noch nachfüllen muss."*

Dieses Dokument dreht die Reihenfolge um: erst die Situationen, dann je Situation der
eine Bildschirm, der sie bedient, dann das Gerät, das ihn trägt. Bildschirme, die keiner
Situation dienen, gibt es nicht.

## Die fünf Situationen (von Andi bestätigt am 04.09.)

| # | Situation | Wann · wo · womit | Was in diesem Moment zählt |
|---|---|---|---|
| 1 | **Runde am Bottich** | 2× täglich, iPad (iPhone), Keller, eine Hand frei, evtl. ohne Netz | Welcher Bottich? 2–4 Werte in Sekunden. Weiter zum nächsten. Sofort sehen: ist der okay, was hatte er gestern? |
| 2 | **Blick vom Sofa** | abends, 30 Sekunden, iPhone/iPad | Sind alle grün? Liegt die Kurve auf Plan? Was ist morgen fällig? Keller? |
| 3 | **Presstag / Gate** | selten, iPad am Bottich | Prüfungen abhaken, Volumen erfassen, Charge teilen — Schritt für Schritt |
| 4 | **Ausbau-Kontrolle** | alle 3 Wochen über Monate, iPhone am Ballon | Riechen, schauen, Kopfraum. Die App muss ihn *holen* — 2025 kam niemand |
| 5 | **Am Schreibtisch** | MacBook, großer Bildschirm, Zeit | Bottiche nebeneinander, volle Kurven, Journal, Wiki, Export, Planung |

Situation 1 und 4 sind **dieselbe Bewegung** — eine Runde an Gefäßen entlang, je Gefäß
wenige Werte — mit anderen Feldern. Das ist ein Bildschirm in zwei Konfigurationen.

## Die Bildschirme

### A · Die Runde (Situationen 1 und 4)

**Ein Gefäß füllt den Bildschirm.** Kein Reiter, keine Navigationsleiste, die um
Aufmerksamkeit konkurriert. Oben groß: Name, Nummer, „2 von 4". Darunter die
Vergleichswerte der letzten Messung — was hatte er gestern —, damit Andi nichts im Kopf
behalten muss. Darunter die drei bis vier Felder, die in dieser Phase zählen, groß, mit
Zahlenblock. Ein Speichern-Knopf, den man mit dem Daumen trifft.

| Element | Entscheidung | Begründung |
|---|---|---|
| Gefäßwechsel | **Wischen links/rechts**, zusätzlich Pfeile am Rand | Eine Hand frei; Wischen geht mit dem Daumen der haltenden Hand |
| Nach dem Speichern | Großer Knopf „Weiter →", **kein automatischer Sprung** | Ein Fehltipp mit klebrigem Finger darf keinen Bottich überspringen |
| Zeitstempel | Einer für die ganze Runde, beim Start gesetzt | Niemand setzt am Bottich viermal die Uhrzeit |
| Rückgängig | „Letzte Eingabe zurück" für 30 Sekunden sichtbar | Fehltipp-Sicherung ohne Dialog |
| Felder | Phasenabhängig: Gärung → Temperatur, Mostgewicht, Geruch, Gäraktivität. Ausbau → Oberfläche, Geruch, Kopfraum, Füllstand. Rest unter „Weitere" | Weniger gleichzeitig zeigen, nicht weniger können |
| Ampel | Sofort nach dem Speichern, groß, mit Ein-Satz-Befund | Der Rückkanal am Bottich, nicht erst zu Hause |
| Rundenende | Zusammenfassung: was erfasst, welche Ampel sich änderte, was fällig ist | Der Moment, in dem man noch vor den Bottichen steht |
| Offline | Dezenter Punkt „nicht abgeglichen", sonst nichts | Kein Hinweis darf eine Eingabe stören |

**Einstieg:** Von „Heute" über einen großen Knopf **„Runde starten"**, wenn eine fällig ist.
Situation 4 ist dieselbe Runde über die Ausbaugefäße, ausgelöst durch die Erinnerung —
tippt Andi die Erinnerung an, steht er direkt im ersten Gefäß, nicht auf einer Übersicht.

### B · Heute (Situation 2)

Bleibt in der Substanz, was H2 gebaut hat: Statusband, Gärverlaufskurve, „Jetzt dran",
Kellerklima, Chargenkarten. Ändert sich in **Größe und Anordnung je Gerät**:

- **iPhone:** eine Spalte, Kurve in Kartenbreite — das ist heute schon richtig.
- **iPad:** zwei Spalten. Links Statusband und die Kurve **groß, alle Bottiche überlagert**;
  rechts „Jetzt dran", Kellerklima, Chargen. Die Kurve ist auf dem iPad das Hauptelement,
  nicht ein Streifen.
- Chargenkarten werden **eine Zeile je Bottich** mit Trendpfeil, statt vier Kästen.
- Der primäre Knopf ist „Runde starten", wenn fällig; sonst gibt es keinen.

### C · Gate-Fluss (Situation 3)

Heute eine statische Prüfliste. Wird ein **geführter Ablauf**: eine Prüfung je Bild,
mit der nötigen Messung direkt darin (Dichte fehlt? Feld ist da). Sind alle grün, kommt
die Handlung — beim Press-Gate: Vorlauf und Presswein erfassen, Gefäße wählen, die App
legt die neuen Chargen an und führt die Abstammung. Unbekannt blockiert weiterhin wie
nicht erfüllt, wird aber als Frage gestellt, nicht als Fehler gezeigt.

### D · Schreibtisch (Situation 5)

Eigenes Layout, gleiche Daten. **Drei Spalten:** links Navigation und Gefäßliste, Mitte
Kurven in voller Breite (alle Bottiche überlagert, umschaltbar auf Kellerklima, Zeitraum
wählbar), rechts Messtabelle, Ereignisse, Journalnotizen. Wiki als eigene Vollansicht mit
Editor. Export und Sensor unter Einstellungen. Hier darf Dichte an Information sein —
das ist der Ort zum Nachdenken, nicht zum Erfassen.

Gilt für Mac **und** PC — es ist ein Browserfenster ab etwa 1100 px Breite.

## Geräteklassen — ein Code, drei Layouts

„Nicht eine Seite für alle" heißt **nicht** drei Programme. Es heißt: dieselbe App liest
die Bildschirmbreite und ordnet die Bausteine anders an.

| Klasse | Breite | Navigation | Struktur |
|---|---|---|---|
| **Telefon** | unter 600 px | unten, vier Ziele: Heute · Runde · Termine · Mehr | eine Spalte, Runde bildschirmfüllend |
| **Tablet** | 600–1100 px | seitlich einklappbar oder unten | zwei Spalten auf Heute und im Gate; Runde bildschirmfüllend mit Vergleichswerten neben den Feldern |
| **Schreibtisch** | über 1100 px | Seitenleiste, alle Ziele | drei Spalten, Dashboard |

Wiki wandert auf Telefon und Tablet unter „Mehr". Am Bottich schlägt niemand nach.

## Was ersetzt wird, was bleibt

| Bleibt unverändert | Wird ersetzt |
|---|---|
| Regelengine, Gates, Ampel (`domain/`) | Layout und Navigation der gesamten Oberfläche |
| Speicherschicht, Migration, Abgleich (H5) | Erfassen-Formular → die Runde |
| Sensor, Proxy, Kellerkurve | Chargendetail → Gefäßkarte (mobil) bzw. Schreibtischansicht |
| Wiki-Inhalte, Export, Journal | Gate-Prüfliste → Gate-Fluss |
| Statusband, Kurvenkonzept, Schubladen, stehende Meldungen (H2) | Einspaltigkeit auf allen Geräten |

## Offene Entscheidungen für Andi

1. **Runde: Wischen und „Weiter"-Knopf, kein automatischer Sprung** — einverstanden?
2. **iPhone in der Gärungsrunde** — kommt das vor, oder ist das iPad dort gesetzt?
   Entscheidet, ob das Telefon-Layout der Runde erste oder zweite Priorität hat.
3. **Schreibtisch:** Reicht der Browser, oder soll es als installierte App auf dem
   Mac laufen (geht mit demselben Code)?
4. **Sprache am Bottich:** Andi diktiert ohnehin. Spracheingabe je Feld wäre der nächste
   Schritt nach dieser Stufe — jetzt bewusst nicht dabei, aber als Richtung festhalten?

## Nächste Schritte

1. Andi nimmt dieses Konzept ab oder korrigiert es.
2. Mockups, mit echten Daten: **Runde auf iPad**, **Heute auf iPad**, **Schreibtisch auf Mac**,
   dazu Runde und Heute auf iPhone als Nachweis der Telefonklasse.
3. Abnahme der Mockups, dann Handoff H6 — als Ersatz der Oberflächenschicht, nicht als Flick.
