import type { Behaelter, Charge, Reminder, Vorratsposten } from './domain/typen'
import { START_WIKI_SEITEN } from './wiki-inhalte'
import { APP_DATEN_VERSION, type AppDatenstand } from './speicher/modell'

const START = '2026-08-30T17:00:00+02:00'

const chargen: Charge[] = [
  { id: 'charge-bottich-1', jahrgang: 2026, name: 'Bottich 1', typ: 'maische', phase: 'KALTMAZERATION', startdatum: START, behaelterId: 'bottich-1', gesperrt: false, isoliert: false, notiz: '11,0 kg entrappte Maische.' },
  { id: 'charge-wanne-1', jahrgang: 2026, name: 'Wanne 1', typ: 'maische', phase: 'KALTMAZERATION', startdatum: START, gesperrt: false, isoliert: false, notiz: '23,5 kg entrappte Maische.' },
  { id: 'charge-wanne-2', jahrgang: 2026, name: 'Wanne 2', typ: 'maische', phase: 'KALTMAZERATION', startdatum: START, gesperrt: false, isoliert: false, notiz: '14,0 kg entrappte Maische.' },
]

function behaelter(): Behaelter[] {
  const liste: Behaelter[] = [
    { id: 'bottich-1', name: 'Gärbottich 1', bruttoLiter: 20, material: 'Kunststoff', verschluss: 'Deckel mit Gärspund' },
    ...[2, 3, 4].map<Behaelter>(nr => ({ id: `bottich-${nr}`, name: `Gärbottich ${nr}`, bruttoLiter: 20, material: 'Kunststoff', verschluss: 'Deckel mit Gärspund', vorhandenAb: '2026-09-02' })),
    ...[1, 2].map<Behaelter>(nr => ({ id: `ballon-${nr}`, name: `Gärballon ${nr}`, bruttoLiter: 5, material: 'Glas', verschluss: 'Gärstopfen' })),
    ...[3, 4, 5, 6].map<Behaelter>(nr => ({ id: `ballon-${nr}`, name: `Gärballon ${nr}`, bruttoLiter: 5, material: 'Glas', verschluss: 'Gärstopfen', vorhandenAb: '2026-09-04' })),
    ...[1, 2].map<Behaelter>(nr => ({ id: `ballon-klein-${nr}`, name: `Gärballon klein ${nr}`, bruttoLiter: 3, material: 'Glas', verschluss: 'Gärstopfen', vorhandenAb: '2026-09-04' })),
  ]
  return liste
}

const reminder: Reminder[] = [
  { id: 'rem-kaltkontrolle', faellig: '2026-08-31T08:00:00+02:00', titel: 'Tageskontrolle Kaltmazeration', beschreibung: 'Temperatur, Geruch und Gäraktivität je Charge erfassen.', erledigt: false, wiederholungTage: 1, quelle: 'manuell' },
  { id: 'rem-bottiche', faellig: '2026-09-02T09:00:00+02:00', titel: 'Gärbottiche prüfen und Hauptmenge anstellen', beschreibung: 'Drei Gärbottiche prüfen und die Maische auf vier Bottiche umverteilen.', erledigt: false, quelle: 'manuell' },
  { id: 'rem-ballons', faellig: '2026-09-04T09:00:00+02:00', titel: 'Gärballons prüfen', beschreibung: 'Vier 5-L- und zwei 3-L-Gärballons werden erwartet.', erledigt: false, quelle: 'manuell' },
  { id: 'rem-pressgate', faellig: '2026-09-06T09:00:00+02:00', titel: 'Press-Gate prüfen', beschreibung: 'Dichte mit der Spindel messen und Press-Gate je Charge öffnen.', erledigt: false, quelle: 'regel', regelId: 'PRESS_GATE' },
]

const vorrat: Vorratsposten[] = [
  { id: 'vorrat-kps', name: 'Kaliumpyrosulfit', mengeWert: 4, mengeEinheit: 'g', notiz: 'Vorhandener Vorrat.' },
  { id: 'vorrat-kps-bestellt', name: 'Kaliumpyrosulfit (bestellt)', mengeWert: 100, mengeEinheit: 'g', notiz: 'Bestellt, noch nicht als verfügbar gerechnet.' },
  { id: 'vorrat-naehrsalz', name: 'Hefenährsalz', mengeWert: 60, mengeEinheit: 'g', notiz: 'Sechs volle Beutel; zwei angebrochene Beutel mit unbekannter Restmenge nicht eingerechnet.' },
  { id: 'vorrat-hefe', name: 'Reinzuchthefe Steinberg', mengeWert: 4, mengeEinheit: 'Beutel' },
]

export function erzeugeStartdaten(): AppDatenstand {
  return {
    version: APP_DATEN_VERSION,
    jahrgang: 2026,
    chargen,
    behaelter: behaelter(),
    messungen: [],
    ereignisse: [],
    reminder,
    wiki: START_WIKI_SEITEN,
    klima: [],
    sensor: { aktiv: false, adapter: 'generisch-json', url: '', pfadTemperatur: 'temperature', pfadFeuchte: 'humidity' },
    vorrat,
    appMeta: {
      chargenMengenKg: { 'charge-bottich-1': 11, 'charge-wanne-1': 23.5, 'charge-wanne-2': 14 },
      elternChargeIds: {},
    },
  }
}
