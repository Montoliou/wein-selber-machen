import { describe, expect, it } from 'vitest'
import type { Messung } from '../domain/typen'
import { fuehreDatenstaendeZusammen } from '../sync'
import { erzeugeStartdaten } from '../startdaten'
import { merkeLoeschung, migriereDatenstand } from './modell'

function standMitMessungen(messungen: Messung[]) {
  const stand = migriereDatenstand(erzeugeStartdaten())
  stand.messungen = messungen
  return stand
}

describe('Geräteabgleich', () => {
  it('bildet je Sammlung die Vereinigungsmenge über die IDs', () => {
    const x: Messung = {
      id: 'messung-x', zuletztGeaendert: '2026-09-03T18:00:00.000Z',
      chargeId: 'charge-bottich-1', zeit: '2026-09-03T18:00:00.000Z', typ: 'temperatur', wert: 22.1,
    }
    const y: Messung = {
      id: 'messung-y', zuletztGeaendert: '2026-09-03T18:05:00.000Z',
      chargeId: 'charge-bottich-2', zeit: '2026-09-03T18:05:00.000Z', typ: 'temperatur', wert: 22.3,
    }
    const geraetA = standMitMessungen([x])
    const geraetB = standMitMessungen([y])

    const aufA = fuehreDatenstaendeZusammen(geraetA, geraetB)
    const aufB = fuehreDatenstaendeZusammen(geraetB, geraetA)

    expect(aufA.messungen.map(messung => messung.id)).toEqual(['messung-x', 'messung-y'])
    expect(aufB.messungen).toEqual(aufA.messungen)
  })

  it('lässt einen neueren Grabstein über einen älteren Datensatz gewinnen', () => {
    const messung: Messung = {
      id: 'messung-geloescht', zuletztGeaendert: '2026-09-03T18:00:00.000Z',
      chargeId: 'charge-bottich-1', zeit: '2026-09-03T18:00:00.000Z', typ: 'ph', wert: 3.2,
    }
    const geraetA = standMitMessungen([])
    merkeLoeschung(geraetA, 'messungen', messung.id, '2026-09-03T19:00:00.000Z')
    const geraetB = standMitMessungen([messung])

    const zusammen = fuehreDatenstaendeZusammen(geraetA, geraetB)

    expect(zusammen.messungen).toEqual([])
    expect(zusammen.geloescht).toContainEqual({
      id: messung.id, sammlung: 'messungen', zeit: '2026-09-03T19:00:00.000Z',
    })
  })

  it('nimmt bei gleicher ID den jüngeren Datensatz und die jüngere Sensor-Konfiguration', () => {
    const alt: Messung = {
      id: 'messung-konflikt', zuletztGeaendert: '2026-09-03T18:00:00.000Z',
      chargeId: 'charge-bottich-1', zeit: '2026-09-03T17:00:00.000Z', typ: 'temperatur', wert: 21,
    }
    const neu: Messung = { ...alt, zuletztGeaendert: '2026-09-03T19:00:00.000Z', wert: 22 }
    const geraetA = standMitMessungen([alt])
    const geraetB = standMitMessungen([neu])
    geraetA.sensor = { aktiv: false, adapter: 'generisch-json', url: '', zuletztGeaendert: '2026-09-03T18:00:00.000Z' }
    geraetB.sensor = {
      aktiv: true, adapter: 'generisch-json', url: 'https://example.test/kellersensor.php?token=test',
      pfadTemperatur: 'temperature', zuletztGeaendert: '2026-09-03T19:00:00.000Z',
    }

    const zusammen = fuehreDatenstaendeZusammen(geraetA, geraetB)

    expect(zusammen.messungen).toContainEqual(neu)
    expect(zusammen.sensor).toEqual(geraetB.sensor)
  })
})
