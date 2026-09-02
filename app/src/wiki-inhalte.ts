import type { WikiSeite } from './domain/typen'

const AKTUALISIERT = '2026-08-30T17:00:00+02:00'

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
]
