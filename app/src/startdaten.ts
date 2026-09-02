import type { Behaelter, Charge, Ereignis, Messung, Reminder, Vorratsposten } from './domain/typen'
import { START_WIKI_SEITEN } from './wiki-inhalte'
import { APP_DATEN_VERSION, type AppDatenstand } from './speicher/modell'

// Stand 02.09.2026. Der Jahrgang läuft bereits — die Maische wurde am 30.08. gelesen,
// bis zum 02.09. kalt mazeriert und an diesem Tag auf vier Gärbottiche umverteilt
// und angestellt. Alle Zahlen hier sind gemessen, nicht angenommen.
// Quelle und Begründungen: journal/2026-jahrgang.md

const ERNTE = '2026-08-30T17:00:00+02:00'
const MESSUNG_TEMP = '2026-09-02T09:03:00+02:00'
const MESSUNG_OE = '2026-09-02T09:40:00+02:00'
// Anstellzeit rekonstruiert (±15 min): Foto "Hefe angesetzt, Zucker aufgelöst" um 12:57:38,
// die Anleitungsnachricht danach laut Chat-Anzeige gegen 13:05–13:25, dann Hefe, Nährsalz
// und Messung. Zucker, Hefe und Nährsalz waren bei der 82-°Oe-Messung bereits drin.
const ANSTELLEN = '2026-09-02T13:35:00+02:00'

interface BottichStart {
  nr: 1 | 2 | 3 | 4
  nettoKg: number
  weinLiter: number
  temperatur: number
  oechsle: number
  zuckerG: number
  naehrsalzG: number
}

/**
 * Brutto gewogen, Tara 1,175 kg je Eimer (abgeleitet: 53,20 kg brutto minus
 * 48,50 kg dokumentierte Erntemenge, geteilt durch vier).
 * Weinmenge = Netto × 0,70 (Erfahrungswert 65–75 L je 100 kg Maische).
 */
const BOTTICHE: BottichStart[] = [
  { nr: 1, nettoKg: 13.13, weinLiter: 9.2, temperatur: 18.3, oechsle: 56, zuckerG: 658, naehrsalzG: 0.90 },
  { nr: 2, nettoKg: 12.28, weinLiter: 8.6, temperatur: 18.3, oechsle: 54, zuckerG: 658, naehrsalzG: 0.85 },
  { nr: 3, nettoKg: 12.53, weinLiter: 8.8, temperatur: 18.1, oechsle: 54, zuckerG: 658, naehrsalzG: 0.90 },
  { nr: 4, nettoKg: 10.58, weinLiter: 7.4, temperatur: 18.5, oechsle: 50, zuckerG: 658, naehrsalzG: 0.75 },
]

const chargenId = (nr: number) => `charge-bottich-${nr}`

const chargen: Charge[] = BOTTICHE.map(b => ({
  id: chargenId(b.nr),
  jahrgang: 2026,
  name: `Bottich ${b.nr}`,
  typ: 'maische',
  phase: 'AKTIVE_GAERUNG',
  startdatum: ERNTE,
  behaelterId: `bottich-${b.nr}`,
  fuellLiter: b.weinLiter,
  gesperrt: false,
  isoliert: false,
  notiz: `${b.nettoKg.toFixed(2).replace('.', ',')} kg entrappte Maische, angestellt am 02.09.2026. `
    + `Erwartete Weinmenge ${b.weinLiter.toFixed(1).replace('.', ',')} L.`,
}))

let lfd = 0
const id = (p: string) => `${p}-${++lfd}`

const messungen: Messung[] = BOTTICHE.flatMap<Messung>(b => [
  { id: id('m'), chargeId: chargenId(b.nr), zeit: MESSUNG_TEMP, typ: 'temperatur', wert: b.temperatur,
    notiz: 'Nach dem Einpendeln des Thermometers. Zielkorridor Anstellen 18–20 °C.' },
  { id: id('m'), chargeId: chargenId(b.nr), zeit: MESSUNG_TEMP, typ: 'geruch', wert: null, text: 'hefig',
    notiz: 'Alle vier gleich: fruchtig, traubig, leicht malzig. Beginnende Wildhefeaktivität, unkritisch bei Anstellen am selben Tag.' },
  { id: id('m'), chargeId: chargenId(b.nr), zeit: MESSUNG_TEMP, typ: 'gaeraktivitaet', wert: null, text: 'keine' },
  { id: id('m'), chargeId: chargenId(b.nr), zeit: MESSUNG_OE, typ: 'oechsle', wert: b.oechsle, methode: 'spindel',
    notiz: 'Ausgangsmostgewicht vor dem Aufzuckern. Bei 18 °C keine Temperaturkorrektur nötig.' },
  { id: id('m'), chargeId: chargenId(b.nr), zeit: ANSTELLEN, typ: 'volumen', wert: b.weinLiter,
    notiz: 'Erwartete Weinmenge, gerechnet aus Nettogewicht × 0,70.' },
])

// Startdichte nach allen Zugaben — bisher nur Bottich 1 gemessen.
messungen.push({
  id: id('m'), chargeId: chargenId(1), zeit: ANSTELLEN, typ: 'oechsle', wert: 82, methode: 'spindel',
  notiz: 'Startdichte der Gärung — gemessen, nachdem Zucker, Hefe und Nährsalz vollständig drin waren. '
    + 'Ziel war 85 °Oe. Rund 1 °Oe der Differenz erklärt sich aus dem Anmachwasser der Hefe '
    + '(0,5 L auf vier Bottiche, also 1,4 % Verdünnung), das in der Zuckerrechnung fehlte; '
    + 'der Rest ist Ablesestreuung und Ausbeuteunsicherheit. Bewusst nicht nachgezuckert.',
})

const ereignisse: Ereignis[] = BOTTICHE.flatMap<Ereignis>(b => [
  {
    id: id('e'), chargeId: chargenId(b.nr), zeit: ANSTELLEN, art: 'aufzuckern',
    stoff: 'Haushaltszucker (Saccharose)', mengeWert: b.zuckerG, mengeEinheit: 'g',
    begruendung: `Ausgangsmostgewicht ${b.oechsle} °Oe entspricht nur ${(b.oechsle / 8).toFixed(1).replace('.', ',')} % vol. `
      + 'Angehoben auf Ziel 85 °Oe (10,6 % vol), weil Alkohol dieses Jahr der wichtigere Schutzfaktor ist — '
      + 'freier SO₂ ist mangels Titrationsset nicht messbar. Zucker als gemeinsamer Ansatz in 2 L Most bei '
      + '60–70 °C gelöst und in vier gleichen Teilen zurückgegeben; die Abweichung zur Einzeldosierung '
      + 'beträgt höchstens 2 °Oe und liegt damit unter der Ausbeuteunsicherheit.',
  },
  {
    id: id('e'), chargeId: chargenId(b.nr), zeit: ANSTELLEN, art: 'hefe',
    stoff: 'Reinzuchthefe', produkt: 'Kitzinger Steinberg', mengeWert: 0.5, mengeEinheit: 'Beutel',
    begruendung: 'Zwei Beutel für die Gesamtmenge in 0,5 L Wasser bei 35 °C rehydriert, '
      + '15–20 Minuten angesetzt, dann gleichmäßig auf vier Bottiche verteilt. '
      + 'Maische 21 °C, Hefeansatz 28 °C — Differenz 7 K und damit unkritisch, kein Angleichschritt nötig.',
  },
  {
    id: id('e'), chargeId: chargenId(b.nr), zeit: ANSTELLEN, art: 'naehrsalz',
    stoff: 'Diammoniumphosphat', produkt: 'Kitzinger Hefenährsalz', mengeWert: b.naehrsalzG, mengeEinheit: 'g',
    begruendung: 'Portion 1 von 3. Ein Drittel der Höchstmenge von 30 g je 100 L, gerechnet auf die Weinmenge. '
      + 'Höchstmenge dieses Jahr voll ausgeschöpft, weil der Presswein 2025 H₂S-Noten zeigte — '
      + 'die entstehen typischerweise aus Stickstoffmangel unter Hefestress. '
      + '2025 wurden dagegen 10 g auf einmal in einen 9-L-Ansatz gegeben, also das Vierfache des Zulässigen.',
  },
  {
    id: id('e'), chargeId: chargenId(b.nr), zeit: ANSTELLEN, art: 'anstellen',
    begruendung: 'Vier synchrone Chargen. Maische am 30.08. gelesen, bis 02.09. bei 5–8 °C kalt mazeriert, '
      + 'mit den Füßen in der Wanne angequetscht (breiter, niedriger Druck — die Kerne bleiben ganz), '
      + 'dann auf vier Gärbottiche verteilt. Bewusst nicht geschwefelt: '
      + 'freier SO₂ ist nicht messbar, jede frühe Gabe bindet sich unsichtbar und verschlechtert '
      + 'das SO₂-Modell für den Ausbau, der 2025 die eigentliche Schadensphase war.',
  },
])

function behaelter(): Behaelter[] {
  return [
    ...[1, 2, 3, 4].map<Behaelter>(nr => ({
      id: `bottich-${nr}`, name: `Gärbottich ${nr}`, bruttoLiter: 20,
      material: 'Kunststoff', verschluss: 'Deckel mit Gärröhrchen und Ablaufhahn',
      notiz: 'Tara 1,175 kg.',
    })),
    ...[1, 2].map<Behaelter>(nr => ({
      id: `ballon-${nr}`, name: `Gärballon ${nr}`, bruttoLiter: 5,
      material: 'Glas', verschluss: 'Gummistopfen mit Gärröhrchen',
    })),
    ...[3, 4, 5, 6].map<Behaelter>(nr => ({
      id: `ballon-${nr}`, name: `Gärballon ${nr}`, bruttoLiter: 5,
      material: 'Glas', verschluss: 'Gummistopfen mit Gärröhrchen', vorhandenAb: '2026-09-04',
    })),
    ...[1, 2].map<Behaelter>(nr => ({
      id: `ballon-klein-${nr}`, name: `Gärballon klein ${nr}`, bruttoLiter: 3,
      material: 'Glas', verschluss: 'Gummistopfen mit Gärröhrchen', vorhandenAb: '2026-09-05',
      notiz: 'Für den randvollen Abstich — Kopfraum ist Pflichtvariable.',
    })),
  ]
}

const reminder: Reminder[] = [
  {
    id: 'rem-unterstossen', faellig: '2026-09-03T08:00:00+02:00', wiederholungTage: 1,
    titel: 'Tresterhut unterstoßen', erledigt: false, quelle: 'manuell',
    beschreibung: 'Zweimal täglich, morgens und abends. Der Tresterhut steigt nach oben und trocknet aus, '
      + 'wenn er liegen bleibt — ein trockener Hut über gärendem Most wird von Essigbakterien besiedelt. '
      + 'Sauberes Gerät verwenden. Dabei Temperatur ablesen und eintragen.',
  },
  {
    id: 'rem-naehrsalz-2', faellig: '2026-09-04T09:00:00+02:00',
    titel: 'Hefenährsalz Portion 2 von 3', erledigt: false, quelle: 'manuell',
    beschreibung: 'Je Bottich: 0,90 / 0,85 / 0,90 / 0,75 g. Vorher in etwas Most auflösen.',
  },
  {
    id: 'rem-ballons', faellig: '2026-09-04T09:00:00+02:00',
    titel: 'Gärballons prüfen', erledigt: false, quelle: 'manuell',
    beschreibung: 'Vier 5-L-Ballons erwartet. Zusammen mit den zwei vorhandenen sind das 30 L Ausbaukapazität. '
      + 'Am 05.09. kommen zwei 3-L-Ballons für den randvollen Abstich.',
  },
  {
    id: 'rem-naehrsalz-3', faellig: '2026-09-06T09:00:00+02:00',
    titel: 'Hefenährsalz Portion 3 von 3', erledigt: false, quelle: 'manuell',
    beschreibung: 'Letzte Gabe, je Bottich 0,90 / 0,85 / 0,90 / 0,75 g. '
      + 'Spätestens bevor die Spindel unter 1,025 fällt — danach nimmt die Hefe keinen Stickstoff mehr auf '
      + 'und der Rest bleibt als Bakteriennahrung im Wein.',
  },
  {
    id: 'rem-pressgate', faellig: '2026-09-07T09:00:00+02:00',
    titel: 'Press-Gate prüfen', erledigt: false, quelle: 'regel', regelId: 'PRESS_GATE',
    beschreibung: 'Dichte mit der Spindel messen. Gepresst wird erst bei SG 1,010 oder darunter, nicht nach Gefühl. '
      + 'Beim Pressen zuerst den Vorlauf über den Ablaufhahn abtropfen lassen — das sind rund zwei Drittel '
      + 'des Weins, die gar nicht gepresst werden müssen. Nur den Trester in den Maischesack. '
      + 'Presswein getrennt führen.',
  },
]

const vorrat: Vorratsposten[] = [
  { id: 'vorrat-kps', name: 'Kaliumpyrosulfit', mengeWert: 104, mengeEinheit: 'g',
    notiz: '4 g Restbestand plus 100 g geliefert am 01.09. Jahresbedarf für ~34 L: 12–15 g.' },
  { id: 'vorrat-naehrsalz', name: 'Hefenährsalz', mengeWert: 56.6, mengeEinheit: 'g',
    notiz: 'Sechs volle Beutel abzüglich 3,4 g für Portion 1. Zwei angebrochene Beutel mit unbekannter Restmenge nicht eingerechnet.' },
  { id: 'vorrat-hefe', name: 'Reinzuchthefe Steinberg', mengeWert: 2, mengeEinheit: 'Beutel',
    notiz: 'Zwei von vier Beuteln beim Anstellen verbraucht.' },
]

export function erzeugeStartdaten(): AppDatenstand {
  return {
    version: APP_DATEN_VERSION,
    jahrgang: 2026,
    chargen,
    behaelter: behaelter(),
    messungen,
    ereignisse,
    reminder,
    wiki: START_WIKI_SEITEN,
    klima: [],
    sensor: { aktiv: false, adapter: 'generisch-json', url: '', pfadTemperatur: 'temperature', pfadFeuchte: 'humidity' },
    vorrat,
    appMeta: {
      chargenMengenKg: Object.fromEntries(BOTTICHE.map(b => [chargenId(b.nr), b.nettoKg])),
      elternChargeIds: {},
    },
  }
}
