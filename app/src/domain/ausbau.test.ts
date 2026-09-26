// Ausbau-Logik (26.09.2026): Füllplan, Abstich-Gate, Füllstand als Stufe, Werte jenseits der
// Skala, Schwefel in Millilitern Stammlösung. Die Zahlen stammen aus dem echten Jahrgang 2026.

import { describe, expect, it } from 'vitest'
import type { Behaelter, Charge, Datenstand, Messung } from './typen'
import { abstichGate, befundeFuerCharge, fuellplan, gaerendeGate } from './regeln'
import { stammloesungMl } from './oenologie'

let zaehler = 0
const id = (): string => `t-${++zaehler}`

function leererStand(): Datenstand {
  return {
    version: 1, jahrgang: 2026, chargen: [], behaelter: [], messungen: [],
    ereignisse: [], reminder: [], wiki: [], klima: [],
    sensor: { aktiv: false, adapter: 'generisch-json', url: '' }, vorrat: [],
  }
}

function charge(p: Partial<Charge> = {}): Charge {
  return {
    id: id(), jahrgang: 2026, name: 'Vorlauf 2026 · Ballon 1', typ: 'vorlauf', los: 'Vorlauf 2026',
    phase: 'AUSBAU', startdatum: '2026-09-26T10:00:00.000Z', gesperrt: false, isoliert: false, ...p,
  }
}

function messung(chargeId: string, p: Partial<Messung>): Messung {
  return { id: id(), chargeId, typ: 'oechsle', wert: null, zeit: '2026-09-26T10:00:00.000Z', ...p }
}

function ballon(nr: number, liter = 5): Behaelter {
  return { id: `ballon-${nr}`, name: `Ballon ${nr}`, bruttoLiter: liter, material: 'Glas', verschluss: 'Gärröhrchen' }
}

// ---------------------------------------------------------------------------

describe('Schwefel in Millilitern Stammlösung', () => {
  it('trifft die am 26.09.2026 tatsächlich dosierten Mengen', () => {
    expect(stammloesungMl(5, 3.28).wert).toBeCloseTo(15.9, 1)
    expect(stammloesungMl(5, 3.17).wert).toBeCloseTo(12.4, 1)
  })

  it('nennt die Grammzahl und kennzeichnet die Dosis als Rechnung', () => {
    const r = stammloesungMl(5, 3.28)
    expect(r.sicherheit).toBe('gerechnet')
    expect(r.hinweise.join(' ')).toContain('0,16 g')
    expect(r.formel).toContain('18,3 mg/L')
  })
})

describe('Füllplan', () => {
  it('verteilt den echten Abstich vom 26.09.2026 auf fünf volle 5-L-Ballons, der 3-L-Ballon bleibt frei', () => {
    const plan = fuellplan(27.73, [1, 2, 3, 4, 5].map(n => ({ behaelterId: `b${n}`, bruttoLiter: 5 }))
      .concat({ behaelterId: 'b6', bruttoLiter: 3 }))
    expect(plan.befuellt).toHaveLength(5)
    expect(plan.frei).toEqual(['b6'])
    expect(plan.restLiter).toBe(0)
    expect(plan.reichtNicht).toBe(false)
    expect(Math.min(...plan.befuellt.map(b => b.anteil))).toBeGreaterThanOrEqual(0.9)
  })

  it('meldet zu wenig Gefäße, statt einen Ballon zu überfüllen', () => {
    const plan = fuellplan(27.73, [1, 2, 3, 4].map(n => ({ behaelterId: `b${n}`, bruttoLiter: 5 })))
    expect(plan.reichtNicht).toBe(true)
  })

  it('legt einen kleinen Rest als Auffüllvorrat in Flaschen statt in ein halbleeres Gefäß', () => {
    // 23,4 L vor dem Abstich → 22,23 L; vier volle 5-L-Ballons fassen 21,2 L, Rest rund 1 L
    const plan = fuellplan(23.4, [1, 2, 3, 4, 5].map(n => ({ behaelterId: `b${n}`, bruttoLiter: 5 })))
    expect(plan.befuellt).toHaveLength(4)
    expect(plan.restLiter).toBeGreaterThan(0)
    expect(plan.restLiter).toBeLessThanOrEqual(1.5)
    expect(plan.reichtNicht).toBe(false)
  })

  it('warnt, wenn ein Gefäß nur teilweise voll wird', () => {
    // 24,5 L → 23,28 L; 4 × 5 L = 21,2 L, der Rest von gut 2 L geht in den 3-L-Ballon
    const plan = fuellplan(24.5, [1, 2, 3, 4].map(n => ({ behaelterId: `b${n}`, bruttoLiter: 5 }))
      .concat({ behaelterId: 'b6', bruttoLiter: 3 }))
    expect(plan.reichtNicht).toBe(false)
    expect(plan.hinweise.join(' ')).toContain('Kopfraum')
  })

  it('rechnet vor dem Gärende mit Füllung bis zur Schulter', () => {
    expect(fuellplan(10, [{ behaelterId: 'b1', bruttoLiter: 5 }, { behaelterId: 'b2', bruttoLiter: 5 }],
      { zielFuellung: 'schulter' }).zielFuellung).toBe('schulter')
  })
})

describe('Abstich-Gate', () => {
  it('blockiert, wenn Presswein und Vorlauf zusammenlaufen würden', () => {
    const stand = leererStand()
    const v = charge(); const p = charge({ typ: 'presswein', los: 'Presswein 2026' })
    stand.chargen = [v, p]
    const g = abstichGate(stand, { quellen: [v, p], ziele: [1, 2, 3, 4, 5, 6, 7].map(n => ballon(n)),
      volumenLiter: 10, ballonsAbgekuehlt: true })
    expect(g.checks.find(c => c.id === 'abstich-getrennt')?.erfuellt).toBe(false)
    expect(g.freigegeben).toBe(false)
  })

  it('erlaubt bewusstes Vorziehen, füllt dann aber nur bis zur Schulter und sperrt den Schwefel', () => {
    const stand = leererStand()
    const v = charge()
    stand.chargen = [v]
    const g = abstichGate(stand, { quellen: [v], ziele: [ballon(1), ballon(2)], volumenLiter: 9,
      ballonsAbgekuehlt: true, vorziehenBegruendung: 'Der Wein liegt seit vier Wochen auf dem Grobtrub.' })
    expect(g.checks.find(c => c.id === 'abstich-gaerende')?.erfuellt).toBe(true)
    expect(g.zielFuellung).toBe('schulter')
    expect(g.schwefelFreigegeben).toBe(false)
  })

  it('bleibt offen, solange niemand bestätigt, dass die Ballons abgekühlt sind', () => {
    const stand = leererStand()
    const v = charge()
    stand.chargen = [v]
    const g = abstichGate(stand, { quellen: [v], ziele: [ballon(1), ballon(2)], volumenLiter: 9,
      ballonsAbgekuehlt: null, vorziehenBegruendung: 'Test' })
    expect(g.checks.find(c => c.id === 'abstich-abgekuehlt')?.erfuellt).toBeNull()
    expect(g.freigegeben).toBe(false)
  })
})

describe('Werte jenseits der Skala (26.09.2026: Mostwaage endet bei −3 °Oe)', () => {
  it('beweist mit zwei Werten „unter −3" keinen Stillstand', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, { wert: -3, grenze: 'unter', zeit: '2026-09-26T10:00:00.000Z' }),
      messung(c.id, { wert: -3, grenze: 'unter', zeit: '2026-09-29T19:00:00.000Z' }),
    ]
    const g = gaerendeGate(stand, c)
    expect(g.checks.find(x => x.id === 'gaerende-konstant')?.erfuellt).toBeNull()
    expect(g.checks.find(x => x.id === 'gaerende-trocken')?.erfuellt).toBeNull()
    expect(g.freigegeben).toBe(false)
  })

  it('gibt mit zwei gleichen lesbaren Werten unter der Grenze frei', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, { wert: -4, zeit: '2026-09-26T10:00:00.000Z' }),
      messung(c.id, { wert: -4, zeit: '2026-09-29T19:00:00.000Z' }),
    ]
    expect(gaerendeGate(stand, c).freigegeben).toBe(true)
  })
})

describe('Füllstand als Stufe statt Liter', () => {
  const jetzt = new Date('2026-10-01T10:00:00.000Z')
  function befunde(stufe: string): string[] {
    const stand = leererStand()
    const c = charge()
    stand.chargen = [c]
    stand.messungen = [messung(c.id, { typ: 'fuellstand', text: stufe, zeit: '2026-09-30T10:00:00.000Z' })]
    return befundeFuerCharge(stand, c, jetzt).map(b => `${b.regelId}:${b.ampel}`)
  }

  it('„im Hals" genügt als Kopfraum-Angabe', () => {
    const b = befunde('im Hals')
    expect(b.some(x => x.startsWith('R-KOPFRAUM'))).toBe(false)
  })
  it('„an der Schulter" ist im Ausbau GELB', () => {
    expect(befunde('an der Schulter')).toContain('R-KOPFRAUM:YELLOW')
  })
  it('„darunter" ist im Ausbau ORANGE', () => {
    expect(befunde('darunter')).toContain('R-KOPFRAUM:ORANGE')
  })
})

describe('Kontrollintervall im Ausbau: 14 Tage', () => {
  it('wird nach 16 Tagen ohne Eintrag GELB', () => {
    const stand = leererStand()
    const c = charge({ startdatum: '2026-09-26T10:00:00.000Z' })
    stand.chargen = [c]
    stand.messungen = [messung(c.id, { typ: 'fuellstand', text: 'im Hals', zeit: '2026-09-26T10:00:00.000Z' })]
    const b = befundeFuerCharge(stand, c, new Date('2026-10-12T10:00:00.000Z'))
    expect(b.some(x => x.regelId === 'R-KONTROLLPAUSE' && x.ampel === 'YELLOW')).toBe(true)
  })
})
