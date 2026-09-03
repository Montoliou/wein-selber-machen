import { PHASEN_REIHE, type Charge, type Datenstand, type Ereignis, type VolumenPunkt, type Vorratsposten } from '../domain/typen'

export const APP_DATEN_VERSION = 2

export interface AppMeta {
  migrationen: string[]
  [schluessel: string]: unknown
}

export interface AppDatenstand extends Datenstand {
  appMeta: AppMeta
}

interface AppMetaV1 {
  chargenMengenKg?: Record<string, number>
  elternChargeIds?: Record<string, string[]>
  migrationen?: string[]
  [schluessel: string]: unknown
}

type MigrierbarerDatenstand = Omit<AppDatenstand, 'appMeta'> & { appMeta?: AppMetaV1 }

const MIGRATION_V1_V2 = 'datenstand-v1-zu-v2'
const MAISCHPHASEN_OHNE_MESSBARES_VOLUMEN = new Set(PHASEN_REIHE.slice(0, PHASEN_REIHE.indexOf('PRESS_GATE') + 1))

function runde(wert: number): number {
  return Math.round(wert * 1000) / 1000
}

function letzterVolumenPunkt(charge: Charge): VolumenPunkt | undefined {
  return [...(charge.volumenHistorie ?? [])].sort((a, b) => a.zeit.localeCompare(b.zeit)).at(-1)
}

function synchronisiereChargeVolumen(charge: Charge): void {
  const letzter = letzterVolumenPunkt(charge)
  if (!letzter) {
    if (charge.volumenHistorie) {
      charge.fuellLiter = undefined
      charge.kopfraumLiter = undefined
    }
    return
  }
  charge.fuellLiter = letzter.fuellLiter
  charge.kopfraumLiter = letzter.kopfraumLiter
  charge.behaelterId = letzter.behaelterId
}

export function synchronisiereVolumenspiegel(stand: AppDatenstand): void {
  stand.chargen.forEach(synchronisiereChargeVolumen)
}

export function fuegeVolumenPunktHinzu(
  stand: AppDatenstand,
  chargeId: string,
  punkt: VolumenPunkt,
): void {
  const charge = stand.chargen.find(eintrag => eintrag.id === chargeId)
  if (!charge) throw new Error(`Charge ${chargeId} wurde nicht gefunden.`)
  if (!punkt.anlass.trim()) throw new Error('Der Anlass für die Volumenänderung fehlt.')
  for (const [label, wert] of [['Füllvolumen', punkt.fuellLiter], ['Kopfraum', punkt.kopfraumLiter]] as const) {
    if (wert !== undefined && (!Number.isFinite(wert) || wert < 0)) throw new Error(`${label} muss eine Zahl ab 0 sein.`)
  }
  charge.volumenHistorie ??= []
  charge.volumenHistorie.push({ ...punkt })
  synchronisiereChargeVolumen(charge)
}

function pruefeVorratsbuchungen(stand: AppDatenstand, ereignisse: Ereignis[]): Map<Vorratsposten, number> {
  const abgaenge = new Map<Vorratsposten, number>()
  for (const ereignis of ereignisse) {
    if (!ereignis.vorratId) continue
    const posten = stand.vorrat.find(eintrag => eintrag.id === ereignis.vorratId)
    if (!posten) throw new Error(`Der Vorratsposten ${ereignis.vorratId} wurde nicht gefunden. Das Ereignis wurde nicht gespeichert.`)
    if (ereignis.mengeWert === undefined || !Number.isFinite(ereignis.mengeWert) || ereignis.mengeWert < 0) {
      throw new Error(`Für ${posten.name} fehlt eine gültige Ereignismenge. Das Ereignis wurde nicht gespeichert.`)
    }
    if (ereignis.mengeEinheit !== posten.mengeEinheit) {
      throw new Error(`Einheit stimmt nicht überein: ${posten.name} wird in ${posten.mengeEinheit} geführt, das Ereignis in ${ereignis.mengeEinheit ?? 'keiner Einheit'}. Das Ereignis wurde nicht gespeichert.`)
    }
    abgaenge.set(posten, runde((abgaenge.get(posten) ?? 0) + ereignis.mengeWert))
  }
  for (const [posten, abgang] of abgaenge) {
    if (abgang > posten.mengeWert) {
      throw new Error(`Vorrat reicht nicht: ${runde(abgang)} ${posten.mengeEinheit} ${posten.name} werden benötigt, vorhanden sind ${posten.mengeWert} ${posten.mengeEinheit}. Nichts wurde gespeichert.`)
    }
  }
  return abgaenge
}

export function pruefeEreignisseMitVorrat(stand: AppDatenstand, ereignisse: Ereignis[]): void {
  pruefeVorratsbuchungen(stand, ereignisse)
}

export function speichereEreignisseMitVorrat(stand: AppDatenstand, ereignisse: Ereignis[]): void {
  const abgaenge = pruefeVorratsbuchungen(stand, ereignisse)
  for (const [posten, abgang] of abgaenge) posten.mengeWert = runde(posten.mengeWert - abgang)
  stand.ereignisse.push(...ereignisse)
}

export function aktualisiereEreignisMitVorrat(stand: AppDatenstand, ereignisId: string, ersatz: Ereignis): void {
  const index = stand.ereignisse.findIndex(ereignis => ereignis.id === ereignisId)
  if (index < 0) throw new Error('Das Ereignis wurde nicht gefunden.')
  const aktualisiert = { ...ersatz, id: ereignisId }
  const pruefstand: AppDatenstand = {
    ...stand,
    ereignisse: stand.ereignisse.map(ereignis => ({ ...ereignis })),
    vorrat: stand.vorrat.map(posten => ({ ...posten })),
  }
  loescheEreignisMitVorrat(pruefstand, ereignisId)
  speichereEreignisseMitVorrat(pruefstand, [aktualisiert])
  stand.vorrat = pruefstand.vorrat
  stand.ereignisse[index] = aktualisiert
}

export function loescheEreignisMitVorrat(stand: AppDatenstand, ereignisId: string): Ereignis {
  const index = stand.ereignisse.findIndex(ereignis => ereignis.id === ereignisId)
  if (index < 0) throw new Error('Das Ereignis wurde nicht gefunden.')
  const ereignis = stand.ereignisse[index]!
  if (ereignis.vorratId) {
    const posten = stand.vorrat.find(eintrag => eintrag.id === ereignis.vorratId)
    if (!posten) throw new Error(`Der verknüpfte Vorratsposten ${ereignis.vorratId} wurde nicht gefunden. Das Ereignis wurde nicht gelöscht.`)
    if (ereignis.mengeEinheit !== posten.mengeEinheit || ereignis.mengeWert === undefined) {
      throw new Error('Die Vorratsbuchung des Ereignisses ist nicht konsistent. Das Ereignis wurde nicht gelöscht.')
    }
    posten.mengeWert = runde(posten.mengeWert + ereignis.mengeWert)
  }
  stand.ereignisse.splice(index, 1)
  return ereignis
}

export function summeVorratsabgaenge(stand: AppDatenstand, vorratId: string): number {
  return runde(stand.ereignisse
    .filter(ereignis => ereignis.vorratId === vorratId)
    .reduce((summe, ereignis) => summe + (ereignis.mengeWert ?? 0), 0))
}

export function istAppDatenstand(wert: unknown): wert is AppDatenstand {
  if (!wert || typeof wert !== 'object') return false
  const kandidat = wert as Partial<AppDatenstand>
  return typeof kandidat.version === 'number'
    && typeof kandidat.jahrgang === 'number'
    && Array.isArray(kandidat.chargen)
    && Array.isArray(kandidat.behaelter)
    && Array.isArray(kandidat.messungen)
    && Array.isArray(kandidat.ereignisse)
    && Array.isArray(kandidat.reminder)
    && Array.isArray(kandidat.wiki)
    && Array.isArray(kandidat.klima)
    && Array.isArray(kandidat.vorrat)
    && Boolean(kandidat.sensor)
}

export function migriereDatenstand(stand: MigrierbarerDatenstand): AppDatenstand {
  const altVersion = stand.version
  const altMeta = stand.appMeta ?? {}
  const { chargenMengenKg = {}, elternChargeIds = {}, migrationen = [], ...uebrigeMeta } = altMeta
  const messungen = stand.messungen.map(messung => ({ ...messung }))
  const chargen = stand.chargen.map(altCharge => {
    const charge: Charge = { ...altCharge, volumenHistorie: altCharge.volumenHistorie?.map(punkt => ({ ...punkt })) ?? [] }
    const volumenHistorie = charge.volumenHistorie ??= []
    charge.mengeKg ??= chargenMengenKg[charge.id]
    charge.elternChargeId ??= elternChargeIds[charge.id]?.[0]
    if (!charge.phaseSeit) {
      const ereignisArtNachPhase: Partial<Record<Charge['phase'], Ereignis['art']>> = {
        ANSTELLEN: 'anstellen', AKTIVE_GAERUNG: 'anstellen', PRESS_GATE: 'anstellen',
        NACHGAERUNG: 'pressen', GAERENDE_GATE: 'pressen', ERSTER_ABSTICH: 'abstich',
        AUSBAU: 'abstich', STABILITAETS_GATE: 'abstich', SUESSE_GATE: 'abstich',
        ABFUELL_GATE: 'abstich', FLASCHE: 'abfuellen',
      }
      const ereignisArt = ereignisArtNachPhase[charge.phase]
      charge.phaseSeit = ereignisArt
        ? stand.ereignisse.filter(ereignis => ereignis.chargeId === charge.id && ereignis.art === ereignisArt).sort((a, b) => b.zeit.localeCompare(a.zeit))[0]?.zeit ?? charge.startdatum
        : charge.startdatum
    }

    if (altVersion < 2 && charge.typ === 'maische' && MAISCHPHASEN_OHNE_MESSBARES_VOLUMEN.has(charge.phase)) {
      charge.erwarteteWeinLiter ??= charge.fuellLiter
      volumenHistorie.splice(0)
      charge.fuellLiter = undefined
      charge.kopfraumLiter = undefined
    } else if (volumenHistorie.length === 0 && (charge.fuellLiter !== undefined || charge.kopfraumLiter !== undefined)) {
      const volumenZeiten = messungen
        .filter(messung => messung.chargeId === charge.id && (messung.typ === 'volumen' || messung.typ === 'kopfraum'))
        .map(messung => messung.zeit)
      volumenHistorie.push({
        zeit: volumenZeiten.sort().at(-1) ?? charge.startdatum,
        fuellLiter: charge.fuellLiter,
        kopfraumLiter: charge.kopfraumLiter,
        behaelterId: charge.behaelterId,
        anlass: altVersion < 2 ? 'Migration aus Datenstand v1' : 'Übernommener Volumenstand',
      })
    }
    synchronisiereChargeVolumen(charge)
    return charge
  })

  const vorrat = stand.vorrat.map(posten => ({ ...posten }))
  if (!vorrat.some(posten => posten.id === 'vorrat-zucker')) {
    vorrat.push({
      id: 'vorrat-zucker',
      name: 'Haushaltszucker',
      mengeWert: 0,
      mengeEinheit: 'g',
      notiz: 'Für die Zugabe vom 02.09.2026 angelegt. Ein weiterer Restbestand ist nicht erfasst.',
    })
  }
  const vorratIds = new Set(vorrat.map(posten => posten.id))
  const vorratNachArt: Partial<Record<Ereignis['art'], string>> = {
    schwefeln: 'vorrat-kps',
    aufzuckern: 'vorrat-zucker',
    naehrsalz: 'vorrat-naehrsalz',
    hefe: 'vorrat-hefe',
  }
  const ereignisse = stand.ereignisse.map(altEreignis => {
    const ereignis = { ...altEreignis }
    if (altVersion < 2 && !ereignis.vorratId) {
      const vorratId = vorratNachArt[ereignis.art]
      const posten = vorrat.find(eintrag => eintrag.id === vorratId)
      if (vorratId && posten && vorratIds.has(vorratId) && ereignis.mengeEinheit === posten.mengeEinheit) ereignis.vorratId = vorratId
    }
    return ereignis
  })

  const migrierteMarken = altVersion < 2 && !migrationen.includes(MIGRATION_V1_V2)
    ? [...migrationen, MIGRATION_V1_V2]
    : [...migrationen]
  const migriert: AppDatenstand = {
    ...stand,
    version: APP_DATEN_VERSION,
    chargen,
    messungen,
    ereignisse,
    vorrat,
    appMeta: { ...uebrigeMeta, migrationen: migrierteMarken },
  }
  synchronisiereVolumenspiegel(migriert)
  return migriert
}
