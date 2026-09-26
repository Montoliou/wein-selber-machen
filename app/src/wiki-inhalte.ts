import type { WikiSeite } from './domain/typen'

const AKTUALISIERT = '2026-08-30T17:00:00+02:00'
const PLAYBOOKS_AKTUALISIERT = '2026-09-26T18:00:00+02:00'

export const START_WIKI_SEITEN: WikiSeite[] = [
  {
    id: 'wiki-kopfraum', slug: 'kopfraum', titel: 'Warum Kopfraum Wein gefährdet',
    tags: ['Grundlagen', 'Ausbau', 'Fehlerbilder'], aktualisiert: AKTUALISIERT,
    inhalt: `# Warum Kopfraum Wein gefährdet

Kopfraum bringt Wein mit Sauerstoff in Kontakt. Im Ausbau begünstigt das Oxidation, Kahmhefen und Essigbakterien. Beim Hauptwein 2025 waren über Monate Kopfraum und ein Gärspund vorhanden; am 29.08.2026 fanden sich Fruchtfliegen und Schlieren beziehungsweise ein möglicher Oberflächenfilm.

## Was dokumentiert wird

- Füllvolumen des Gefäßes
- Kopfraum in Litern
- Zustand von Deckel, Stopfen und Gärspund
- Oberfläche und Geruch bei jeder Kontrolle

Im Weinbegleiter entscheidet die Regelengine anhand der erfassten Werte. Fehlende Werte bleiben als unbekannt sichtbar.`,
  },
  {
    id: 'wiki-so2', slug: 'so2', titel: 'Freier, gebundener und molekularer SO₂',
    tags: ['Schwefel', 'Ausbau', 'Grundlagen'], aktualisiert: AKTUALISIERT,
    inhalt: `# Freier, gebundener und molekularer SO₂

**Freier SO₂** ist der messbare Anteil, der noch nicht an Zucker, Acetaldehyd oder Farbstoffe gebunden ist. **Gebundener SO₂** trägt nicht im selben Maß zum mikrobiologischen Schutz bei. **Molekularer SO₂** ist der wirksame Anteil; er hängt vom pH-Wert ab.

## Konsequenz für 2026

- pH und freier SO₂ müssen getrennt erfasst werden.
- Ohne Titration bleibt freier SO₂ unbekannt.
- Eine Rechenangabe ohne gemessenen Istwert ist als Schätzung gekennzeichnet.
- Kaliumpyrosulfit vor der Zugabe in wenig Wein oder Wasser lösen.

Der Schwefel-Rechner zeigt Formel, Sicherheitsgrad und den verbleibenden Vorrat.`,
  },
  {
    id: 'wiki-gaerende', slug: 'gaerende', titel: 'Gärende richtig feststellen',
    tags: ['Gärung', 'Grundlagen', 'Fehlerbilder'], aktualisiert: AKTUALISIERT,
    inhalt: `# Gärende richtig feststellen

Ein ruhender Gärspund beweist kein Gärende. Das Gefäß kann undicht sein oder die Gärung kann langsam weiterlaufen.

## Belastbarer Nachweis

- Dichte mit der Spindel messen.
- Nach dem von der App vorgegebenen Mindestabstand erneut messen.
- Beide Messwerte müssen konstant und im von der Regelengine geprüften Bereich liegen.

Refraktometerwerte werden nach Gärbeginn nicht zur Gärende-Beurteilung herangezogen, weil Ethanol den Brechungsindex verändert. Der süße Weißwein 2025 refermentierte in der Flasche; deshalb blockiert das Gärende-Gate bei fehlender Evidenz.`,
  },
  {
    id: 'wiki-naehrsalz', slug: 'naehrsalz', titel: 'Hefenährsalz richtig dosieren',
    tags: ['Gärung', 'Grundlagen'], aktualisiert: AKTUALISIERT,
    inhalt: `# Hefenährsalz richtig dosieren

Die vorhandene Herstellerangabe nennt höchstens 30 g je 100 L und drei Portionen in der ersten Gärwoche. Jede Portion wird vorher in etwa 100 ml Most oder Saft gelöst.

Nach ungefähr zwei Dritteln des Gärverlaufs nimmt die Hefe keinen Stickstoff mehr auf. Eine späte Gabe kann als Nährstoff für Bakterien im Wein bleiben.

2025 wurden 10 g auf einmal in einen kleinen Ansatz gegeben. 2026 berechnet der Rechner die Portion je Charge aus dem erfassten Volumen; jede Zugabe braucht eine Begründung.`,
  },
  {
    id: 'wiki-h2s', slug: 'h2s', titel: 'H₂S erkennen und behandeln',
    tags: ['Gärung', 'Fehlerbilder'], aktualisiert: AKTUALISIERT,
    inhalt: `# H₂S erkennen und behandeln

Ein Geruch nach faulen Eiern weist auf Schwefelwasserstoff hin. Beim Presswein 2025 trat eine reduktive, faulige Note früh auf. Die endgültige Ursache ist nicht belegt.

## Vorgehen

- Charge isoliert führen.
- Sofort belüftend abziehen.
- Geruch erneut prüfen und dokumentieren.
- Bleibt die Note bestehen, einen kontrollierten Bench Trial vorbereiten.

Eine Münze gehört nicht in den Wein. Ohne kontrollierte Dosierung wäre weder die Kupfermenge noch die Wirkung nachvollziehbar.`,
  },
  {
    id: 'wiki-fraktionen', slug: 'vorlauf-presswein', titel: 'Vorlauf und Presswein getrennt führen',
    tags: ['Gärung', 'Ausbau', 'Grundlagen'], aktualisiert: AKTUALISIERT,
    inhalt: `# Vorlauf und Presswein getrennt führen

Vorlauf fließt ohne Pressdruck ab. Presswein entsteht unter Druck und enthält gewöhnlich mehr Trub, Gerbstoffe und Hefebelastung. Diese Fraktionen können sich sensorisch und mikrobiologisch unterschiedlich entwickeln.

2025 entwickelte der Presswein früh reduktive Noten. Deshalb führt der Weinbegleiter Presswein als eigene Charge. Eine Vermischung wird blockiert, solange die fachlichen Voraussetzungen nicht erfüllt sind.`,
  },
  {
    id: 'wiki-postmortem-2025', slug: '2025-post-mortem', titel: '2025 Post-Mortem',
    tags: ['Fehlerbilder', 'Jahrgang 2025'], aktualisiert: AKTUALISIERT,
    inhalt: `# GESICHERT

- Der rote Hauptwein war nach der Gärung zunächst sensorisch brauchbar.
- Der Presswein entwickelte früh reduktive oder faulige Noten.
- Der Hauptwein lag lange in einem Ausbaugefäß mit Gärspund und Kopfraum.
- pH und freier SO₂ wurden nicht systematisch kontrolliert.
- Beim Öffnen am 29.08.2026 waren Fruchtfliegen und Schlieren beziehungsweise ein möglicher Oberflächenfilm vorhanden.
- Der Hauptwein war sensorisch gekippt und wurde verworfen.
- Der süße Weißwein hatte Restzucker, baute Druck und CO₂ in der Flasche auf und war danach nicht mehr süß.

# WAHRSCHEINLICH

- Beim Hauptwein waren langer Ausbau mit Kopfraum, fehlende pH- und SO₂-Kontrolle, eine lange Kontrollpause und der warme Sommer maßgebliche Risikofaktoren.
- Fruchtfliegen sprechen für Undichtigkeit oder Kontamination.
- Beim Weißwein ist Refermentation sehr wahrscheinlich. Restzucker und ein mikrobiologisch nicht gesicherter Gärstopp erklären den beobachteten Druck und den Verlust der Süße.

# OFFEN

- Die exakten kumulativen Kaliumpyrosulfitmengen je Charge und Zeitpunkt fehlen.
- Kopfraumvolumen und Dichtigkeit der Verschlüsse wurden nicht gemessen.
- Ein lückenloser Temperaturverlauf des Ausbaus fehlt.
- Flüchtige Säure beziehungsweise Essigsäure wurden nicht bestimmt.
- Oberflächenfilm, H₂S und Acetobacter wurden mikrobiologisch nicht bestätigt.
- Für die frühe Entwicklung des Pressweins liegt keine endgültige Diagnose vor.`,
  },
  {
    id: 'wiki-abziehen', slug: 'abziehen', titel: 'Abziehen: Wein vom Trub nehmen',
    tags: ['Playbook', 'Ausbau'], aktualisiert: PLAYBOOKS_AKTUALISIERT,
    inhalt: `# Abziehen: Wein vom Trub nehmen

Beim Abziehen wandert der Wein in ein sauberes Gefäß, der Bodensatz bleibt zurück. Kein anderer Schritt im Jahr bringt so viel Luft an den Wein. Deshalb zählt jeder Handgriff, der Plätschern vermeidet.

## Wann

- Presswein vier bis sieben Tage nach dem Pressen. Er hat viel schweren Trub, und darauf bildet sich Schwefelwasserstoff. 2025 roch der Presswein genau deshalb faulig.
- Vorlauf ein bis drei Wochen nach dem Gärende. Länger als vier Wochen sollte er nicht auf dem Grobtrub liegen.
- Am Tag davor nichts aufrühren, damit sich der Trub setzt.

## Ablauf

1. Ballons heiß ausspülen und handwarm abkühlen lassen. Heißes Glas kann springen, wenn kühler Wein hineinläuft.
2. Volles Gefäß hoch stellen, Zielgefäß tief.
3. Schlauchheber mit Gitterfilter 3 bis 5 cm über dem Boden halten. Den Trub zurücklassen.
4. Das Schlauchende auf den Boden des Zielgefäßes legen. So läuft der Wein unter der Oberfläche ein und plätschert nicht.
5. Vorlauf und Presswein nie zusammenlaufen lassen.

## Ohne freien Ballon

Über einen heiß ausgespülten 20-Liter-Gärbottich als Zwischengefäß: alle Ballons hinein, Ballons ausspülen, zurückfüllen. Ein Bottich fasst etwa 18 Liter Wein, für mehr braucht es einen zweiten.

## Wie voll

- Solange die Gärung läuft: bis zur Schulter. Sonst drückt der Schaum den Wein ins Gärröhrchen.
- Nach dem Gärende: bis in den Hals. Ab jetzt entsteht kein CO₂ mehr, das den Kopfraum schützt.
- Mit Gärröhrchen ist ein voller Ballon auch bei einer leisen Restgärung sicher, weil das Gas entweichen kann. Gefährlich wird Restzucker erst in der fest verschlossenen Flasche.
- Kein halbvolles Gefäß stehen lassen. Den Rest in kleinere Gefäße oder Flaschen bis ganz oben füllen und als Auffüllvorrat nutzen.

## Nebenbei messen

Den Messzylinder beim Zurückfüllen kurz in den Strahl aus dem Schlauch halten, Spindel hinein, ablesen, Inhalt in den Ballon kippen. Im Bottich schwimmt die Spindel auch frei.

## Erfahrung 2026

Am 26.09. gingen 27,73 Liter Vorlauf durch den ersten Abstich. Es blieben fünf volle 5-Liter-Ballons, der Trubverlust lag deutlich unter den angesetzten zehn Prozent.`,
  },
  {
    id: 'wiki-schwefeln', slug: 'schwefeln-stammloesung', titel: 'Schwefeln mit Stammlösung',
    tags: ['Playbook', 'Schwefel', 'Ausbau'], aktualisiert: PLAYBOOKS_AKTUALISIERT,
    inhalt: `# Schwefeln mit Stammlösung

Für 5 Liter Wein braucht es rund ein Zehntelgramm Kaliumpyrosulfit. So eine Menge lässt sich nicht verlässlich abwiegen, ein Teil bleibt am Löffel. Deshalb wird eine Lösung mit bekannter Stärke angesetzt und in Millilitern dosiert.

## Stammlösung ansetzen

1. 1,00 g Kaliumpyrosulfit auf der Feinwaage abwiegen.
2. In etwa 80 ml kaltem Wasser vollständig lösen.
3. Auf 100 ml auffüllen. Die Lösung enthält jetzt 10 mg Kaliumpyrosulfit je Milliliter.

Fällt zu viel Pulver ins Glas, das Wasser im selben Verhältnis erhöhen: 1,5 g auf 150 ml ergibt dieselbe Stärke, und die Dosis in Millilitern bleibt gleich.

Beim Lösen steigt Schwefeldioxid auf. Es riecht stechend nach Streichholz und reizt die Atemwege. Nicht über das Glas beugen, Fenster öffnen.

## Dosis nach pH

Den Wein schützt der molekulare Anteil des Schwefels, und dieser Anteil hängt am pH. Ziel sind 0,6 mg/L molekular. Milliliter Stammlösung je Ballon:

- pH 3,0: 9 ml je 5 Liter, 5 ml je 3 Liter
- pH 3,1: 11 ml je 5 Liter, 6 ml je 3 Liter
- pH 3,2: 13 ml je 5 Liter, 8 ml je 3 Liter
- pH 3,3: 17 ml je 5 Liter, 10 ml je 3 Liter
- pH 3,4: 21 ml je 5 Liter, 12 ml je 3 Liter
- pH 3,5: 26 ml je 5 Liter, 16 ml je 3 Liter
- pH 3,6: 33 ml je 5 Liter, 20 ml je 3 Liter

Zwischenwerte dazwischen schätzen. 2026 ergab pH 3,28 beim Vorlauf 16 ml je 5 Liter, pH 3,17 beim Presswein 12 ml.

## Zugeben

- Die Milliliter mit einer Einwegspritze abmessen. Ohne Spritze auf der Küchenwaage abwiegen: 12 ml wiegen 12 g.
- In den Ballon geben und vorsichtig kreisen lassen, nicht schütteln.
- Den Rest der Lösung wegschütten. Sie verliert mit der Zeit an Stärke.
- In der App als Kaliumpyrosulfit eintragen, in Gramm: Milliliter mal 0,01. 16 ml sind 0,16 g.

## Wann

- Direkt nach einem Abstich, weil der Wein dabei Luft bekommen hat.
- Erst wenn die Gärung sicher durch ist. Schwefel auf eine laufende Gärung stoppt die Hefe, bevor der Zucker verbraucht ist. Später kann die Gärung in der Flasche wieder anspringen, so wie 2025 beim Weißwein.
- Ohne biologischen Säureabbau ist das Schwefeln Pflicht, denn der Schwefel blockiert auch einen Abbau, der sonst von selbst beginnen könnte.

## Grenze der Rechnung

Freier Schwefel wird 2026 nicht gemessen, es gibt kein Titrationsset. Die Dosis ist eine Rechnung ohne Messbeleg. Ein Teil des Schwefels bindet sich im Wein und schützt dann nicht mehr.`,
  },
  {
    id: 'wiki-messgeraete', slug: 'messgeraete', titel: 'Messgeräte richtig einsetzen',
    tags: ['Playbook', 'Grundlagen', 'Gärung'], aktualisiert: PLAYBOOKS_AKTUALISIERT,
    inhalt: `# Messgeräte richtig einsetzen

## Mostwaage (Spindel 0 bis 130 °Oe)

Für Most und Gärverlauf. Sie löst etwa einen Grad Oechsle auf. Die Mostwaage von 2026 reicht bis −3 °Oe, das entspricht einer Dichte von 0,997. Was leichter ist, sinkt unter den letzten Strich.

## Feinspindel (0,990 bis 1,020)

Für das Gärende und vor dem Abfüllen. Sie misst nur diesen engen Bereich, dafür zehnmal feiner. Am Gärende ist der Ablesefehler der Mostwaage so groß wie das ganze Entscheidungsfenster. Feinspindeln sind oft 35 cm lang, der Messzylinder muss dazu passen.

## Refraktometer

Für Most: zwei Tropfen statt 250 ml Probe, auch direkt an der Rebe, um die Reife zu prüfen. Sobald Alkohol im Wein ist, zeigt es zu viel Zucker an. In der App die Methode auf Refraktometer stellen, dann bleibt der Wert bei der Gärende-Prüfung außen vor.

## pH-Meter

- Vor jeder Messreihe mit den Lösungen 7,00 und 4,01 kalibrieren. Die 10er-Lösung verschlechtert die Genauigkeit im Weinbereich.
- Die Probe ins Glas ziehen, das Gerät nicht in den Ballon halten.
- Die Elektrode mit destilliertem Wasser spülen und nicht abwischen.

## Spindel ablesen

1. Erst den Zylinder füllen, dann die Spindel mit einer leichten Drehung hineingleiten lassen. Ein Handtuch unter dem Zylinder fängt einen Fall ab.
2. Die Probe vorher schwenken. Bläschen an der Spindel tragen sie nach oben und sind der größte Einzelfehler.
3. Auf Höhe der Flüssigkeitsoberfläche ablesen.
4. Hat die Spindel im Zylinder zu wenig Tiefgang, im Bottich oder in einem hohen Gefäß messen.

## Spindel prüfen

Leitungswasser auf etwa 20 Grad bringen, Spindel hinein: Sie muss 1,000 anzeigen. Bei 21,5 Grad ist Wasser etwas leichter, dann ist knapp unter 1,000 richtig.

## Was die Zahl am Gärende bedeutet

Die Spindel misst Dichte, nicht Zucker. Alkohol drückt die Dichte unter die von Wasser. Ein trockener, säurereicher Rotwein mit 11 Prozent liegt bei −4 bis −6 °Oe; wie tief genau, hängt von Säure und Extrakt ab. Eine Einzelmessung beweist deshalb kein Gärende, erst zwei gleiche Werte im Abstand von mindestens 48 Stunden.

## Nicht gekauft

Elektronische Schwimmspindeln wie Tilt oder RAPT Pill kosten 150 bis 200 Euro und passen kaum durch den Hals eines 5-Liter-Ballons. Für drei Messungen im Jahr lohnen sie nicht.`,
  },
  {
    id: 'wiki-vorlauf-pressen', slug: 'vorlauf-pressen', titel: 'Vorlauf abziehen und pressen',
    tags: ['Playbook', 'Gärung'], aktualisiert: PLAYBOOKS_AKTUALISIERT,
    inhalt: `# Vorlauf abziehen und pressen

## Zeitpunkt

Abgezogen wird bei 5 bis 10 °Oe, kurz vor dem Gärende. Die Restgärung im Ballon schützt den Wein dann noch mit CO₂. Wartet der Most länger auf der Maische, müssen die Deckel fest zu sein und der Hut zweimal täglich untergestoßen werden, weil mit der Gärung auch der CO₂-Schutz endet.

## Vorlauf ohne Presse

Der Vorlauf braucht keine Presse. Er läuft mit dem Schlauchheber ab und macht rund zwei Drittel der Menge aus.

1. Am Tag davor nicht mehr unterstoßen. Der Hut setzt sich, darunter steht klarer Most.
2. Bottich hoch stellen und den Hut vorsichtig zur Seite schieben. Untermischen würde den abgesetzten Trub wieder aufwirbeln.
3. Schlauchheber mit Filter 3 bis 5 cm über dem Boden ansetzen und den Schlauch an einem Holzstab festbinden.
4. Ablaufen lassen, bis der Pegel den Filter erreicht. Die trüben letzten Zentimeter gehen mit in die Presse.
5. Ballons nur bis zur Schulter füllen, die Gärung läuft noch.

## Trester bis zum Pressen

Den Trester in möglichst wenige Bottiche zusammenlegen, flach andrücken, Deckel zu, Gärröhrchen drauf. Weniger Gefäße heißt weniger Oberfläche an der Luft. Länger als drei Tage sollte er nicht warten.

## Pressen

- Eine neue Holzpresse am Vortag heiß ausspülen und mit Wasser gefüllt stehen lassen, damit die Latten quellen.
- Sanft pressen und nach jedem Nachziehen einige Minuten warten.
- Aufhören, sobald der Saft deutlich dunkler und trüber wird. Danach kommen vor allem Bitterstoffe aus den Kernen.
- Den Presswein als eigene Charge führen.

## Ohne Presse

Trester portionsweise in ein großes Sieb über einem Topf geben, 30 Minuten abtropfen lassen, dann einen Teller auflegen und beschweren. So kommt etwa die Hälfte des Pressweins heraus, und zwar der feinere Teil.

## Zahlen 2026

- Vorlauf: 0,57 kg je kg entrappter Trauben. Planwert für künftige Jahre: 0,55.
- Presswein: 6,5 L oder 19 Prozent der Gesamtmenge. Auf die letzten zwei bis drei Liter aus hartem Pressen wurde bewusst verzichtet.
- Gesamt: 0,71 L Wein je kg entrappter Trauben.`,
  },
  {
    id: 'wiki-weisswein', slug: 'weisswein', titel: 'Weißwein: was anders läuft',
    tags: ['Playbook', 'Gärung', 'Grundlagen'], aktualisiert: PLAYBOOKS_AKTUALISIERT,
    inhalt: `# Weißwein: was anders läuft

Beim Rotwein gärt der Most mit den Schalen und wird danach gepresst. Beim Weißwein wird zuerst gepresst und nur der Saft vergoren. Der Weinbegleiter bildet diese Reihenfolge noch nicht ab, er kennt bisher nur die Maischegärung.

## Ablauf

1. Trauben lesen, abbeeren und am selben Tag pressen. Liegen sie länger, zieht der Saft Farbe und Gerbstoff aus den Schalen.
2. Den Most über Nacht kühl stehen lassen, damit sich der Trub absetzt, und am Morgen klar abziehen.
3. Mostgewicht messen, wegen der kleinen Mengen am besten mit dem Refraktometer.
4. Hefe zugeben. Nährsalz in drei Portionen wie beim Rotwein, 0,1 g je Liter und Portion.
5. Im Ballon vergären, von Anfang an mit Gärröhrchen.

## Temperatur

Weißwein gärt am besten bei 15 bis 18 Grad. Wärmer vergoren verliert er Frucht. Der Keller liegt bei 20 bis 21 Grad. Ein einzelner Ballon passt aber in einen Kühlschrank, den ein Steckdosenthermostat auf 16 Grad hält.

## Süß ist 2026 gesperrt

Der freie Schwefel ist nicht messbar. Damit lässt sich nicht belegen, dass ein süßer Wein in der Flasche stabil bleibt. Der süße Weißwein von 2025 hat genau so in der Flasche nachgegoren und seine Süße verloren. Der Weg: trocken ausbauen und bei Bedarf im Glas süßen.

## Vor der Lese zu klären

- Wie viel Lesegut? 2025 waren es etwa 3 bis 4 kg, also 2 bis 3 Liter Most und ein einzelner 5-Liter-Ballon.
- Wird der Most beim Pressen geschwefelt? Beim Weißwein schützt das vor Bräunung, hemmt aber die Hefe. Das wird vor der Lese entschieden.
- Welche Hefe? Für Weißwein gibt es eigene Stämme.`,
  },
]
