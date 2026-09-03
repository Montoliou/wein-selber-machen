import { describe, expect, it } from 'vitest'
import type { Datenstand, Ereignis } from '../domain/typen'
import { erzeugeStartdaten } from '../startdaten'
import {
  APP_DATEN_VERSION,
  fuegeVolumenPunktHinzu,
  loescheEreignisMitVorrat,
  migriereDatenstand,
  speichereEreignisseMitVorrat,
  summeVorratsabgaenge,
  type AppDatenstand,
} from './modell'

function basis(): Datenstand {
  return {
    version: 1,
    jahrgang: 2026,
    chargen: [{
      id: 'b1', jahrgang: 2026, name: 'Bottich 1', typ: 'maische', phase: 'AKTIVE_GAERUNG',
      startdatum: '2026-08-30T15:00:00.000Z', behaelterId: 'fass-1', fuellLiter: 9.2,
      gesperrt: false, isoliert: false,
    }],
    behaelter: [{ id: 'fass-1', name: 'Fass 1', bruttoLiter: 20, material: 'Kunststoff', verschluss: 'Deckel' }],
    messungen: [
      { id: 'm1', chargeId: 'b1', zeit: '2026-09-02T07:00:00.000Z', typ: 'temperatur', wert: 18.3 },
      { id: 'm2', chargeId: 'b1', zeit: '2026-09-02T07:30:00.000Z', typ: 'oechsle', wert: 56, methode: 'spindel' },
    ],
    ereignisse: [
      ...[1, 2, 3, 4].map<Ereignis>(nr => ({ id: `z${nr}`, chargeId: 'b1', zeit: '2026-09-02T11:35:00.000Z', art: 'aufzuckern', mengeWert: 658, mengeEinheit: 'g', begruendung: 'Anreicherung' })),
      ...[0.9, 0.85, 0.9, 0.75].map<Ereignis>((menge, nr) => ({ id: `n${nr}`, chargeId: 'b1', zeit: '2026-09-02T11:35:00.000Z', art: 'naehrsalz', mengeWert: menge, mengeEinheit: 'g', begruendung: 'Portion 1' })),
      ...[1, 2, 3, 4].map<Ereignis>(nr => ({ id: `h${nr}`, chargeId: 'b1', zeit: '2026-09-02T11:35:00.000Z', art: 'hefe', mengeWert: 0.5, mengeEinheit: 'Beutel', begruendung: 'Anstellen' })),
    ],
    reminder: [{ id: 'r1', faellig: '2026-09-03T06:00:00.000Z', titel: 'Kontrolle', beschreibung: 'Prüfen', erledigt: false, quelle: 'manuell' }],
    wiki: [],
    klima: [],
    sensor: { aktiv: false, adapter: 'generisch-json', url: '' },
    vorrat: [
      { id: 'vorrat-naehrsalz', name: 'Hefenährsalz', mengeWert: 56.6, mengeEinheit: 'g' },
      { id: 'vorrat-hefe', name: 'Reinzuchthefe', mengeWert: 2, mengeEinheit: 'Beutel' },
    ],
  }
}

function alsAltstand(): AppDatenstand {
  return {
    ...basis(),
    appMeta: {
      chargenMengenKg: { b1: 13.13 },
      elternChargeIds: { b1: ['ernte-1'] },
    } as unknown as AppDatenstand['appMeta'],
  } as AppDatenstand
}

describe('Datenstand-Migration v1 auf v2', () => {
  it('führt die vier Bottiche ohne fiktives Füllvolumen', () => {
    const stand = erzeugeStartdaten()

    expect(stand.chargen.map(charge => charge.erwarteteWeinLiter)).toEqual([9.2, 8.6, 8.8, 7.4])
    expect(stand.chargen.every(charge => charge.fuellLiter === undefined && charge.volumenHistorie?.length === 0)).toBe(true)
    expect(stand.chargen.map(charge => charge.mengeKg)).toEqual([13.13, 12.28, 12.53, 10.58])
    expect(summeVorratsabgaenge(stand, 'vorrat-zucker')).toBe(2632)
    expect(summeVorratsabgaenge(stand, 'vorrat-naehrsalz')).toBe(3.4)
    expect(summeVorratsabgaenge(stand, 'vorrat-hefe')).toBe(2)
  })

  it('erhält Messungen und Ereignisse vollständig und leitet die neuen Felder ab', () => {
    const alt = alsAltstand()
    const messungenVorher = structuredClone(alt.messungen)
    const ereignisIdsVorher = alt.ereignisse.map(ereignis => ereignis.id)

    const neu = migriereDatenstand(alt)

    expect(neu.version).toBe(APP_DATEN_VERSION)
    expect(neu.messungen.map(({ zuletztGeaendert: _zeit, ...messung }) => messung)).toEqual(messungenVorher)
    expect(neu.messungen.map(messung => messung.zuletztGeaendert)).toEqual([
      '2026-09-02T07:00:00.000Z',
      '2026-09-02T07:30:00.000Z',
    ])
    expect(neu.ereignisse.map(ereignis => ereignis.id)).toEqual(ereignisIdsVorher)
    expect(neu.reminder.map(({ zuletztGeaendert: _zeit, ...reminder }) => reminder)).toEqual(alt.reminder)
    expect(neu.chargen[0]).toMatchObject({
      mengeKg: 13.13,
      elternChargeId: 'ernte-1',
      erwarteteWeinLiter: 9.2,
      fuellLiter: undefined,
      kopfraumLiter: undefined,
      volumenHistorie: [],
    })
    expect(neu.appMeta).not.toHaveProperty('chargenMengenKg')
    expect(neu.appMeta).not.toHaveProperty('elternChargeIds')
    expect(neu.appMeta.migrationen).toContain('datenstand-v1-zu-v2')
    expect(neu.appMeta.migrationen).toContain('datenstand-v2-zu-v3-sync')
    expect(neu.geloescht).toEqual([])
    expect(summeVorratsabgaenge(neu, 'vorrat-zucker')).toBe(2632)
    expect(summeVorratsabgaenge(neu, 'vorrat-naehrsalz')).toBe(3.4)
    expect(summeVorratsabgaenge(neu, 'vorrat-hefe')).toBe(2)
    expect(neu.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')?.mengeWert).toBe(56.6)
    expect(neu.vorrat.find(posten => posten.id === 'vorrat-hefe')?.mengeWert).toBe(2)
  })

  it('übernimmt ein echtes Füllvolumen als ersten Historienpunkt', () => {
    const alt = alsAltstand()
    alt.chargen[0] = { ...alt.chargen[0]!, typ: 'vorlauf', phase: 'AUSBAU', fuellLiter: 8.4, kopfraumLiter: 0.2 }
    alt.messungen.push({ id: 'm3', chargeId: 'b1', zeit: '2026-09-07T14:00:00.000Z', typ: 'volumen', wert: 8.4 })

    const neu = migriereDatenstand(alt)

    expect(neu.chargen[0]?.volumenHistorie).toEqual([{
      zeit: '2026-09-07T14:00:00.000Z', fuellLiter: 8.4, kopfraumLiter: 0.2,
      behaelterId: 'fass-1', anlass: 'Migration aus Datenstand v1',
    }])
    expect(neu.chargen[0]?.fuellLiter).toBe(8.4)
    expect(neu.chargen[0]?.kopfraumLiter).toBe(0.2)
  })
})

describe('Speicherschicht v2', () => {
  it('hängt Volumenpunkte an und spiegelt immer den jüngsten Punkt', () => {
    const stand = migriereDatenstand(alsAltstand())
    const charge = stand.chargen[0]!
    charge.typ = 'vorlauf'
    charge.phase = 'NACHGAERUNG'

    fuegeVolumenPunktHinzu(stand, charge.id, { zeit: '2026-09-07T12:00:00.000Z', fuellLiter: 8.8, kopfraumLiter: 0.2, behaelterId: 'fass-1', anlass: 'Pressen' })
    fuegeVolumenPunktHinzu(stand, charge.id, { zeit: '2026-09-15T12:00:00.000Z', fuellLiter: 8.2, kopfraumLiter: 0.1, behaelterId: 'fass-2', anlass: 'Abstich' })

    expect(charge.volumenHistorie).toHaveLength(2)
    expect(charge.fuellLiter).toBe(8.2)
    expect(charge.kopfraumLiter).toBe(0.1)
    expect(charge.behaelterId).toBe('fass-2')
  })

  it('bucht Vorrat beim Speichern ab und beim Löschen zurück', () => {
    const stand = migriereDatenstand(alsAltstand())
    const ereignis: Ereignis = { id: 'neu', chargeId: 'b1', zeit: '2026-09-03T09:00:00.000Z', art: 'naehrsalz', mengeWert: 0.9, mengeEinheit: 'g', vorratId: 'vorrat-naehrsalz', begruendung: 'Portion 2' }

    speichereEreignisseMitVorrat(stand, [ereignis])
    expect(stand.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')?.mengeWert).toBe(55.7)

    loescheEreignisMitVorrat(stand, ereignis.id)
    expect(stand.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')?.mengeWert).toBe(56.6)
    expect(stand.ereignisse.some(eintrag => eintrag.id === ereignis.id)).toBe(false)
    expect(stand.geloescht).toContainEqual(expect.objectContaining({ id: ereignis.id, sammlung: 'ereignisse' }))
  })

  it('verändert bei einer falschen Einheit weder Vorrat noch Ereignisse', () => {
    const stand = migriereDatenstand(alsAltstand())
    const anzahl = stand.ereignisse.length
    const bestand = stand.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')!.mengeWert
    const ereignis: Ereignis = { id: 'falsch', chargeId: 'b1', zeit: '2026-09-03T09:00:00.000Z', art: 'naehrsalz', mengeWert: 1, mengeEinheit: 'Beutel', vorratId: 'vorrat-naehrsalz', begruendung: 'Test' }

    expect(() => speichereEreignisseMitVorrat(stand, [ereignis])).toThrow('Einheit stimmt nicht überein')
    expect(stand.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')?.mengeWert).toBe(bestand)
    expect(stand.ereignisse).toHaveLength(anzahl)
  })
})
