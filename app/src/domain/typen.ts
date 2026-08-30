// Domänentypen Weinbegleiter. Reine Daten, keine DOM-Abhängigkeit.

export type Phase =
  | 'ERNTE' | 'SORTIEREN' | 'ENTRAPPEN' | 'MOSTANALYSE' | 'KALTMAZERATION'
  | 'ANSTELLEN' | 'AKTIVE_GAERUNG' | 'PRESS_GATE' | 'NACHGAERUNG'
  | 'GAERENDE_GATE' | 'ERSTER_ABSTICH' | 'AUSBAU' | 'STABILITAETS_GATE'
  | 'SUESSE_GATE' | 'ABFUELL_GATE' | 'FLASCHE'

export const PHASEN_REIHE: Phase[] = [
  'ERNTE', 'SORTIEREN', 'ENTRAPPEN', 'MOSTANALYSE', 'KALTMAZERATION',
  'ANSTELLEN', 'AKTIVE_GAERUNG', 'PRESS_GATE', 'NACHGAERUNG',
  'GAERENDE_GATE', 'ERSTER_ABSTICH', 'AUSBAU', 'STABILITAETS_GATE',
  'SUESSE_GATE', 'ABFUELL_GATE', 'FLASCHE',
]

export const PHASEN_LABEL: Record<Phase, string> = {
  ERNTE: 'Ernte', SORTIEREN: 'Sortieren', ENTRAPPEN: 'Entrappen',
  MOSTANALYSE: 'Mostanalyse', KALTMAZERATION: 'Kaltmazeration',
  ANSTELLEN: 'Anstellen', AKTIVE_GAERUNG: 'Aktive Gärung',
  PRESS_GATE: 'Press-Gate', NACHGAERUNG: 'Nachgärung',
  GAERENDE_GATE: 'Gärende-Gate', ERSTER_ABSTICH: 'Erster Abstich',
  AUSBAU: 'Ausbau', STABILITAETS_GATE: 'Stabilitäts-Gate',
  SUESSE_GATE: 'Süße-Gate', ABFUELL_GATE: 'Abfüll-Gate', FLASCHE: 'Flasche',
}

/** Ampel nach docs/audit-regeln.md. Reihenfolge = Schweregrad. */
export type Ampel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
export const AMPEL_RANG: Record<Ampel, number> = { GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3 }
export const AMPEL_LABEL: Record<Ampel, string> = {
  GREEN: 'Normal', YELLOW: 'Abweichung', ORANGE: 'Charge isolieren', RED: 'Sperre',
}

export type ChargenTyp = 'maische' | 'vorlauf' | 'presswein' | 'verschnitt'

export type MessTyp =
  | 'temperatur' | 'oechsle' | 'sg' | 'brix' | 'ph' | 'gesamtsaeure'
  | 'so2_frei' | 'so2_gesamt' | 'yan' | 'volumen' | 'kopfraum'
  | 'geruch' | 'geschmack' | 'oberflaeche' | 'gaeraktivitaet' | 'restzucker'

export interface MessDefinition {
  typ: MessTyp
  label: string
  einheit: string
  art: 'zahl' | 'auswahl'
  optionen?: string[]
  hinweis?: string
}

export const MESS_DEFINITIONEN: MessDefinition[] = [
  { typ: 'temperatur', label: 'Temperatur', einheit: '°C', art: 'zahl' },
  { typ: 'oechsle', label: 'Mostgewicht', einheit: '°Oe', art: 'zahl', hinweis: 'Messmethode angeben — Refraktometer nur vor Gärbeginn' },
  { typ: 'sg', label: 'Dichte (SG)', einheit: 'g/cm³', art: 'zahl', hinweis: 'Alternative zu °Oe, wird umgerechnet' },
  { typ: 'brix', label: 'Brix', einheit: '°Bx', art: 'zahl', hinweis: 'Refraktometerwert — nur vor Gärbeginn gültig' },
  { typ: 'ph', label: 'pH-Wert', einheit: '', art: 'zahl', hinweis: 'Vor jeder Messreihe kalibrieren' },
  { typ: 'gesamtsaeure', label: 'Gesamtsäure', einheit: 'g/L', art: 'zahl' },
  { typ: 'so2_frei', label: 'Freier SO₂', einheit: 'mg/L', art: 'zahl', hinweis: 'Nur eintragen, wenn wirklich titriert' },
  { typ: 'so2_gesamt', label: 'Gesamt-SO₂', einheit: 'mg/L', art: 'zahl' },
  { typ: 'yan', label: 'YAN (verwertbarer Stickstoff)', einheit: 'mg/L', art: 'zahl' },
  { typ: 'volumen', label: 'Füllvolumen', einheit: 'L', art: 'zahl' },
  { typ: 'kopfraum', label: 'Kopfraum', einheit: 'L', art: 'zahl', hinweis: 'Pflichtvariable — Audit-Regel 5' },
  { typ: 'restzucker', label: 'Restzucker', einheit: 'g/L', art: 'zahl' },
  { typ: 'geruch', label: 'Geruch', einheit: '', art: 'auswahl',
    optionen: ['sauber / fruchtig', 'hefig', 'reduktiv / dumpf', 'faule Eier (H₂S)', 'essigstichig', 'Klebstoff / Lösungsmittel', 'muffig'] },
  { typ: 'geschmack', label: 'Geschmack', einheit: '', art: 'auswahl',
    optionen: ['sauber', 'säuerlich', 'bitter', 'firn / oxidiert', 'essigstichig', 'nicht verkostet'] },
  { typ: 'oberflaeche', label: 'Oberfläche', einheit: '', art: 'auswahl',
    optionen: ['blank', 'Schaumkranz (Gärung)', 'Schlieren', 'Oberflächenfilm / Kahmhaut', 'Fruchtfliegen', 'Schimmel'] },
  { typ: 'gaeraktivitaet', label: 'Gäraktivität', einheit: '', art: 'auswahl',
    optionen: ['keine', 'schwach', 'mittel', 'stark', 'sehr stark'] },
]

/**
 * Wie eine Dichte-/Zuckermessung zustande kam. Entscheidend, weil ein
 * Refraktometer bei Anwesenheit von Alkohol systematisch falsch anzeigt:
 * Ethanol verändert den Brechungsindex, der abgelesene Wert liegt zu hoch.
 * Für das Gärende zählt deshalb ausschließlich die Spindel.
 */
export type MessMethode = 'spindel' | 'refraktometer' | 'sonstige'

export interface Messung {
  id: string
  chargeId: string
  zeit: string          // ISO
  typ: MessTyp
  wert: number | null   // bei art 'auswahl' null
  text?: string         // bei art 'auswahl'
  methode?: MessMethode // nur bei Dichte-/Zuckerwerten relevant
  notiz?: string
}

export type EreignisArt =
  | 'schwefeln' | 'aufzuckern' | 'naehrsalz' | 'hefe' | 'anstellen'
  | 'unterstossen' | 'abstich' | 'pressen' | 'umfuellen' | 'auffuellen'
  | 'suessen' | 'stabilisieren' | 'abfuellen' | 'kontrolle' | 'sonstiges'

export const EREIGNIS_LABEL: Record<EreignisArt, string> = {
  schwefeln: 'Schwefeln', aufzuckern: 'Aufzuckern', naehrsalz: 'Hefenährsalz',
  hefe: 'Hefe zugeben', anstellen: 'Anstellen', unterstossen: 'Untergestoßen',
  abstich: 'Abstich', pressen: 'Pressen', umfuellen: 'Umfüllen',
  auffuellen: 'Auffüllen (Kopfraum)', suessen: 'Süßen', stabilisieren: 'Stabilisieren',
  abfuellen: 'Abfüllen', kontrolle: 'Sichtkontrolle', sonstiges: 'Sonstiges',
}

export interface Ereignis {
  id: string
  chargeId: string
  zeit: string
  art: EreignisArt
  stoff?: string
  produkt?: string
  mengeWert?: number
  mengeEinheit?: string
  begruendung: string     // Audit-Regel 13: Pflicht
  fotoIds?: string[]
}

export interface Behaelter {
  id: string
  name: string
  bruttoLiter: number
  material: string
  verschluss: string
  vorhandenAb?: string   // ISO — für bestellte, noch nicht gelieferte Gefäße
  notiz?: string
}

export interface Charge {
  id: string
  jahrgang: number
  name: string
  typ: ChargenTyp
  phase: Phase
  elternChargeId?: string
  startdatum: string
  behaelterId?: string
  fuellLiter?: number
  kopfraumLiter?: number
  gesperrt: boolean       // RED: keine Vermischung/Abfüllung
  isoliert: boolean       // ORANGE
  notiz?: string
  archiviert?: boolean
}

export interface Reminder {
  id: string
  chargeId?: string
  faellig: string          // ISO
  titel: string
  beschreibung: string
  erledigt: boolean
  wiederholungTage?: number
  quelle: 'regel' | 'manuell'
  regelId?: string
}

export interface WikiSeite {
  id: string
  slug: string
  titel: string
  inhalt: string           // Markdown-Teilmenge
  tags: string[]
  aktualisiert: string
}

export interface Klimapunkt {
  zeit: string
  temperatur: number
  feuchte?: number
  quelle: 'manuell' | 'sensor'
}

export interface SensorKonfig {
  aktiv: boolean
  adapter: 'shelly-cloud' | 'govee' | 'generisch-json'
  url: string
  token?: string
  geraeteId?: string
  pfadTemperatur?: string   // JSON-Pfad für generisch, z.B. "data.temp"
  pfadFeuchte?: string
}

export interface Foto {
  id: string
  zeit: string
  blob: Blob
  chargeId?: string
}

export interface Datenstand {
  version: number
  jahrgang: number
  chargen: Charge[]
  behaelter: Behaelter[]
  messungen: Messung[]
  ereignisse: Ereignis[]
  reminder: Reminder[]
  wiki: WikiSeite[]
  klima: Klimapunkt[]
  sensor: SensorKonfig
  vorrat: Vorratsposten[]
}

export interface Vorratsposten {
  id: string
  name: string
  mengeWert: number
  mengeEinheit: string
  notiz?: string
}
