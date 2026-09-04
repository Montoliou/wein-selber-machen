// Regressionstests: Jeder Test bildet einen dokumentierten Fehler des Jahrgangs 2025 ab.
// Quelle: data/2025-gaerjournal-evidenz.md und data/2025-fehleranalyse.md.
// Bestehen diese Tests, kann die App den jeweiligen Fehler nicht mehr durchwinken.

import { describe, expect, it } from 'vitest'
import type { Behaelter, Charge, Datenstand, Ereignis, Messung } from './typen'
import {
  abfuellGate, ampelFuerCharge, befundeFuerCharge, behaelterVerfuegbar, gaerendeGate,
  stabilitaetsGate, suesseGate, vermischungErlaubt,
} from './regeln'
import { molekularesSo2, naehrsalzPlan, schwefelDosierung, zuckerFuerOechsle } from './oenologie'

let n = 0
const id = () => `t${++n}`

function leererStand(): Datenstand {
  return {
    version: 1, jahrgang: 2026, chargen: [], behaelter: [], messungen: [],
    ereignisse: [], reminder: [], wiki: [], klima: [],
    sensor: { aktiv: false, adapter: 'generisch-json', url: '' }, vorrat: [],
  }
}

function charge(p: Partial<Charge> = {}): Charge {
  return {
    id: 'c1', jahrgang: 2026, name: 'Testcharge', typ: 'vorlauf',
    phase: 'AUSBAU', startdatum: '2026-09-01T10:00:00.000Z',
    gesperrt: false, isoliert: false, ...p,
  }
}

function messung(chargeId: string, typ: Messung['typ'], wert: number | null, zeit: string, text?: string,
                 methode?: Messung['methode']): Messung {
  return { id: id(), chargeId, typ, wert, zeit, text, methode }
}

function ereignis(chargeId: string, e: Partial<Ereignis>): Ereignis {
  return { id: id(), chargeId, zeit: '2026-09-01T10:00:00.000Z', art: 'sonstiges', begruendung: 'Test', ...e }
}

// ---------------------------------------------------------------------------

describe('2025-F1: „Kein Blubbern = Gärende"', () => {
  it('gibt das Gärende-Gate nicht frei, wenn nur die Gäraktivität auf null steht', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    stand.messungen = [messung(c.id, 'gaeraktivitaet', null, '2026-09-10T08:00:00.000Z', 'keine')]

    const gate = gaerendeGate(stand, c)
    expect(gate.freigegeben).toBe(false)
    expect(gate.blocker.length).toBeGreaterThan(0)
  })

  it('verlangt zwei Dichtemessungen mit mindestens 48 Stunden Abstand', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    // Zwei Messungen, aber nur 6 Stunden auseinander
    stand.messungen = [
      messung(c.id, 'sg', 0.995, '2026-09-10T08:00:00.000Z'),
      messung(c.id, 'sg', 0.995, '2026-09-10T14:00:00.000Z'),
    ]
    expect(gaerendeGate(stand, c).freigegeben).toBe(false)
  })

  it('gibt frei, wenn zwei konstante Werte im Abstand von 48 Stunden vorliegen', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'sg', 0.9945, '2026-09-08T08:00:00.000Z'),
      messung(c.id, 'sg', 0.9942, '2026-09-10T09:00:00.000Z'),
    ]
    const gate = gaerendeGate(stand, c)
    expect(gate.freigegeben).toBe(true)
  })

  it('blockiert bei konstanter, aber zu hoher Dichte — stecken gebliebene Gärung', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'sg', 1.020, '2026-09-08T08:00:00.000Z'),
      messung(c.id, 'sg', 1.020, '2026-09-10T09:00:00.000Z'),
    ]
    const gate = gaerendeGate(stand, c)
    expect(gate.freigegeben).toBe(false)
    expect(gate.checks.find(x => x.id === 'gaerende-trocken')?.erfuellt).toBe(false)
  })
})

describe('2025-F2: Langzeitausbau mit Kopfraum', () => {
  it('meldet ORANGE bei mehr als 5 Prozent Kopfraum', () => {
    const stand = leererStand()
    const c = charge({ fuellLiter: 20, kopfraumLiter: 3 })   // 15 %
    stand.chargen = [c]
    const befunde = befundeFuerCharge(stand, c, new Date('2026-09-02T10:00:00.000Z'))
    expect(befunde.some(b => b.regelId === 'R-KOPFRAUM' && b.ampel === 'ORANGE')).toBe(true)
    expect(ampelFuerCharge(stand, c, new Date('2026-09-02T10:00:00.000Z'))).not.toBe('GREEN')
  })

  it('behandelt fehlenden Kopfraum im Ausbau als ORANGE, nicht als in Ordnung', () => {
    const stand = leererStand()
    const c = charge({ fuellLiter: undefined, kopfraumLiter: undefined })
    stand.chargen = [c]
    const befunde = befundeFuerCharge(stand, c, new Date('2026-09-02T10:00:00.000Z'))
    expect(befunde.some(b => b.regelId === 'R-KOPFRAUM-FEHLT')).toBe(true)
  })

  it('lässt einen randvollen Ballon grün durchgehen', () => {
    const stand = leererStand()
    const c = charge({ fuellLiter: 5, kopfraumLiter: 0.05 })  // 1 %
    stand.chargen = [c]
    stand.messungen = [messung(c.id, 'so2_frei', 32, '2026-09-02T09:00:00.000Z'), messung(c.id, 'ph', 3.4, '2026-09-02T09:00:00.000Z')]
    expect(ampelFuerCharge(stand, c, new Date('2026-09-02T10:00:00.000Z'))).toBe('GREEN')
  })
})

describe('2025-F3: Monatelange Kontrollpause', () => {
  it('schlägt nach mehr als 42 Tagen ohne Eintrag ORANGE', () => {
    const stand = leererStand()
    const c = charge({ startdatum: '2026-01-01T10:00:00.000Z', fuellLiter: 5, kopfraumLiter: 0.05 })
    stand.chargen = [c]
    const befunde = befundeFuerCharge(stand, c, new Date('2026-06-01T10:00:00.000Z'))
    expect(befunde.some(b => b.regelId === 'R-KONTROLLPAUSE' && b.ampel === 'ORANGE')).toBe(true)
  })
})

describe('2025-F4: Fruchtfliegen und Oberflächenfilm', () => {
  it('setzt bei Fruchtfliegen RED', () => {
    const stand = leererStand()
    const c = charge()
    stand.chargen = [c]
    stand.messungen = [messung(c.id, 'oberflaeche', null, '2026-09-02T09:00:00.000Z', 'Fruchtfliegen')]
    expect(ampelFuerCharge(stand, c, new Date('2026-09-02T10:00:00.000Z'))).toBe('RED')
  })

  it('setzt bei Oberflächenfilm RED und verbietet die Vermischung', () => {
    const stand = leererStand()
    const a = charge({ id: 'a' })
    const b = charge({ id: 'b' })
    stand.chargen = [a, b]
    stand.messungen = [messung('a', 'oberflaeche', null, '2026-09-02T09:00:00.000Z', 'Oberflächenfilm / Kahmhaut')]
    expect(ampelFuerCharge(stand, a, new Date('2026-09-02T10:00:00.000Z'))).toBe('RED')
    expect(vermischungErlaubt(stand, a, b).erlaubt).toBe(false)
  })

  it('blockiert das Abfüll-Gate bei Oberflächenfilm', () => {
    const stand = leererStand()
    const c = charge({ phase: 'ABFUELL_GATE', fuellLiter: 5, kopfraumLiter: 0.05 })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'sg', 0.994, '2026-09-08T09:00:00.000Z'),
      messung(c.id, 'ph', 3.4, '2026-09-08T09:00:00.000Z'),
      messung(c.id, 'so2_frei', 35, '2026-09-08T09:00:00.000Z'),
      messung(c.id, 'oberflaeche', null, '2026-09-09T09:00:00.000Z', 'Oberflächenfilm / Kahmhaut'),
    ]
    expect(abfuellGate(stand, c).freigegeben).toBe(false)
  })
})

describe('2025-F5: H₂S beim Presswein', () => {
  it('setzt bei fauligem Geruch ORANGE und isoliert die Charge', () => {
    const stand = leererStand()
    const c = charge({ typ: 'presswein' })
    stand.chargen = [c]
    stand.messungen = [messung(c.id, 'geruch', null, '2026-09-02T09:00:00.000Z', 'faule Eier (H₂S)')]
    const ampel = ampelFuerCharge(stand, c, new Date('2026-09-02T10:00:00.000Z'))
    expect(['ORANGE', 'RED']).toContain(ampel)
  })

  it('verhindert, dass Presswein still mit dem Vorlauf vereinigt wird', () => {
    const stand = leererStand()
    const vorlauf = charge({ id: 'v', typ: 'vorlauf', fuellLiter: 25, kopfraumLiter: 0.2 })
    const presswein = charge({ id: 'p', typ: 'presswein', fuellLiter: 7, kopfraumLiter: 0.05 })
    stand.chargen = [vorlauf, presswein]
    expect(vermischungErlaubt(stand, vorlauf, presswein).erlaubt).toBe(false)
  })
})

describe('2025-F6: Süßer Weißwein gärt in der Flasche nach', () => {
  it('blockiert das Süße-Gate ohne Sterilfiltration oder Pasteurisierung', () => {
    const stand = leererStand()
    const c = charge({ phase: 'SUESSE_GATE' })
    stand.chargen = [c]
    expect(suesseGate(stand, c).freigegeben).toBe(false)
  })

  it('erkennt Sorbat als alleinigen Gärstopp und blockiert', () => {
    const stand = leererStand()
    const c = charge({ phase: 'SUESSE_GATE' })
    stand.chargen = [c]
    stand.ereignisse = [ereignis(c.id, { art: 'stabilisieren', stoff: 'Kaliumsorbat', mengeWert: 5, begruendung: 'Gärstopp' })]
    const gate = suesseGate(stand, c)
    expect(gate.freigegeben).toBe(false)
    expect(gate.checks.find(x => x.id === 'suesse-sorbat')?.erfuellt).toBe(false)
  })

  it('blockiert das Abfüll-Gate bei Restzucker ohne Refermentationsschutz', () => {
    const stand = leererStand()
    const c = charge({ phase: 'ABFUELL_GATE', fuellLiter: 5, kopfraumLiter: 0.05 })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'sg', 1.012, '2026-09-08T09:00:00.000Z'),   // Restzucker
      messung(c.id, 'ph', 3.3, '2026-09-08T09:00:00.000Z'),
      messung(c.id, 'so2_frei', 40, '2026-09-08T09:00:00.000Z'),
      messung(c.id, 'oberflaeche', null, '2026-09-08T09:00:00.000Z', 'blank'),
    ]
    const gate = abfuellGate(stand, c)
    expect(gate.freigegeben).toBe(false)
    expect(gate.checks.some(x => x.id === 'abfuell-restzucker' && x.erfuellt === false)).toBe(true)
  })
})

describe('2025-F7: Hefenährsalz — 10 g auf einmal in einen kleinen Ansatz', () => {
  it('meldet die 2025er Dosierung als Überdosierung', () => {
    const stand = leererStand()
    const c = charge({ fuellLiter: 9, phase: 'AKTIVE_GAERUNG' })   // 11 kg Trauben ≈ 9 L
    stand.chargen = [c]
    stand.ereignisse = [ereignis(c.id, { art: 'naehrsalz', mengeWert: 10, mengeEinheit: 'g', begruendung: 'wie 2025' })]
    const befunde = befundeFuerCharge(stand, c, new Date('2026-09-02T10:00:00.000Z'))
    expect(befunde.some(b => b.regelId === 'R-NAEHRSALZ-MAX')).toBe(true)
  })

  it('rechnet die zulässige Menge und die Portionierung korrekt', () => {
    const plan = naehrsalzPlan(9)
    expect(plan.gesamtMax).toBeCloseTo(2.7, 1)     // 30 g/100 L
    expect(plan.proPortion).toBeCloseTo(0.9, 1)
    expect(plan.gesamtMax).toBeLessThan(10)        // 2025 war das Vierfache
  })
})

describe('2025-F8: Schwefeln nach Faustformel ohne pH', () => {
  it('markiert die Dosierung ohne pH als Schätzung', () => {
    const ohne = schwefelDosierung(33, null, null)
    expect(ohne.kpsGramm.sicherheit).toBe('geschaetzt')
    expect(ohne.phBekannt).toBe(false)
    expect(ohne.kpsGramm.hinweise.some(h => /Pauschalziel/.test(h))).toBe(true)
  })

  it('rechnet mit pH den Zielwert für freien SO₂ aus', () => {
    const mit = schwefelDosierung(33, 3.5, 10)
    expect(mit.zielFrei).not.toBeNull()
    // Bei pH 3,5 braucht 0,6 mg/L molekular rund 30 mg/L freien SO2
    expect(mit.zielFrei!.wert).toBeGreaterThan(25)
    expect(mit.zielFrei!.wert).toBeLessThan(35)
  })

  it('zeigt, dass derselbe freie SO₂ bei höherem pH deutlich weniger schützt', () => {
    const bei34 = molekularesSo2(30, 3.4)
    const bei38 = molekularesSo2(30, 3.8)
    expect(bei34.wert).toBeGreaterThan(bei38.wert * 2)
    expect(bei38.wert).toBeLessThan(0.5)   // unter Schutzkorridor
  })
})

describe('2025-F9: Aufzuckern auf 85–90 °Oe', () => {
  it('rechnet die Zuckermenge des 2025er Ansatzes nach', () => {
    // 2025: ca. 9 L Most, 74 °Oe auf 87 °Oe
    const r = zuckerFuerOechsle(9, 74, 87)
    expect(r.wert).toBeGreaterThan(250)
    expect(r.wert).toBeLessThan(350)
  })

  it('warnt, wenn das Ziel die Alkoholtoleranz der Hefe übersteigt', () => {
    const r = zuckerFuerOechsle(30, 80, 120)   // 15 % vol
    expect(r.hinweise.some(h => /Toleranz/.test(h))).toBe(true)
  })
})

describe('2025-F10: Spontangärung in der Kaltmazeration', () => {
  it('meldet ORANGE, wenn die Maische vor dem Anstellen gärt', () => {
    const stand = leererStand()
    const c = charge({ phase: 'KALTMAZERATION', typ: 'maische', startdatum: '2026-08-30T17:00:00.000Z' })
    stand.chargen = [c]
    stand.messungen = [messung(c.id, 'gaeraktivitaet', null, '2026-08-31T09:00:00.000Z', 'schwach')]
    const befunde = befundeFuerCharge(stand, c, new Date('2026-08-31T10:00:00.000Z'))
    expect(befunde.some(b => b.regelId === 'R-SPONTANGAERUNG' && b.ampel === 'ORANGE')).toBe(true)
  })

  it('meldet zu warme Maische', () => {
    const stand = leererStand()
    const c = charge({ phase: 'KALTMAZERATION', typ: 'maische', startdatum: '2026-08-30T17:00:00.000Z' })
    stand.chargen = [c]
    stand.messungen = [messung(c.id, 'temperatur', 14, '2026-08-31T09:00:00.000Z')]
    const befunde = befundeFuerCharge(stand, c, new Date('2026-08-31T10:00:00.000Z'))
    expect(befunde.some(b => b.regelId === 'R-MAISCHE-KALT')).toBe(true)
  })

  it('lässt 7 °C ohne Gäraktivität in Ruhe', () => {
    const stand = leererStand()
    const c = charge({ phase: 'KALTMAZERATION', typ: 'maische', startdatum: '2026-08-30T17:00:00.000Z' })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'temperatur', 7, '2026-08-31T09:00:00.000Z'),
      messung(c.id, 'gaeraktivitaet', null, '2026-08-31T09:00:00.000Z', 'keine'),
    ]
    expect(ampelFuerCharge(stand, c, new Date('2026-08-31T10:00:00.000Z'))).toBe('GREEN')
  })
})

describe('Stabilitäts-Gate führt Unsicherheit sichtbar', () => {
  it('gibt ohne gemessenen freien SO₂ nicht frei, markiert ihn aber als unbekannt statt als Fehler', () => {
    const stand = leererStand()
    const c = charge({ phase: 'STABILITAETS_GATE', fuellLiter: 5, kopfraumLiter: 0.05 })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'ph', 3.45, '2026-09-08T09:00:00.000Z'),
      messung(c.id, 'sg', 0.994, '2026-09-08T09:00:00.000Z'),
    ]
    const gate = stabilitaetsGate(stand, c)
    expect(gate.freigegeben).toBe(false)
    const so2Check = gate.checks.find(x => x.id === 'stab-so2')
    expect(so2Check?.erfuellt).toBeNull()          // unbekannt, nicht falsch
    expect(so2Check?.begruendung).toMatch(/unsicher|modelliert/i)
  })
})

describe('2026-N1: Refraktometer nach Gärbeginn', () => {
  it('lässt das Gärende-Gate nicht auf Refraktometerwerten aufbauen', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    // Zwei saubere, konstante Werte im richtigen Abstand — aber per Refraktometer.
    stand.messungen = [
      messung(c.id, 'oechsle', -5, '2026-09-08T08:00:00.000Z', undefined, 'refraktometer'),
      messung(c.id, 'oechsle', -5, '2026-09-10T09:00:00.000Z', undefined, 'refraktometer'),
    ]
    const gate = gaerendeGate(stand, c)
    expect(gate.freigegeben).toBe(false)
    expect(gate.checks.find(x => x.id === 'gaerende-zwei-messungen')?.erfuellt).toBeNull()
  })

  it('gibt dasselbe Wertepaar frei, wenn es mit der Spindel gemessen wurde', () => {
    const stand = leererStand()
    const c = charge({ phase: 'GAERENDE_GATE' })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'oechsle', -5, '2026-09-08T08:00:00.000Z', undefined, 'spindel'),
      messung(c.id, 'oechsle', -5, '2026-09-10T09:00:00.000Z', undefined, 'spindel'),
    ]
    expect(gaerendeGate(stand, c).freigegeben).toBe(true)
  })

  it('meldet einen Refraktometerwert in der Gärung als Abweichung', () => {
    const stand = leererStand()
    const c = charge({ phase: 'AKTIVE_GAERUNG', fuellLiter: 11 })
    stand.chargen = [c]
    stand.messungen = [messung(c.id, 'oechsle', 40, '2026-09-05T08:00:00.000Z', undefined, 'refraktometer')]
    const befunde = befundeFuerCharge(stand, c, new Date('2026-09-05T10:00:00.000Z'))
    expect(befunde.some(b => b.regelId === 'R-REFRAKTOMETER')).toBe(true)
  })

  it('lässt das Refraktometer vor Gärbeginn unbeanstandet', () => {
    const stand = leererStand()
    const c = charge({ phase: 'KALTMAZERATION', typ: 'maische', startdatum: '2026-08-30T17:00:00.000Z' })
    stand.chargen = [c]
    stand.messungen = [
      messung(c.id, 'oechsle', 78, '2026-08-31T09:00:00.000Z', undefined, 'refraktometer'),
      messung(c.id, 'temperatur', 5, '2026-08-31T09:00:00.000Z'),
      messung(c.id, 'gaeraktivitaet', null, '2026-08-31T09:00:00.000Z', 'keine'),
    ]
    expect(befundeFuerCharge(stand, c, new Date('2026-08-31T10:00:00.000Z'))
      .some(b => b.regelId === 'R-REFRAKTOMETER')).toBe(false)
  })
})

// 2026-N2 — Gelieferte Gefäße wurden dauerhaft als „ab <Datum>" angezeigt, obwohl die
// Auswahl sie längst zuließ. Anzeige und Auswahl beantworteten dieselbe Frage
// unterschiedlich. Seither entscheidet behaelterVerfuegbar() für beide.
describe('2026-N2 — Verfügbarkeit von Gefäßen', () => {
  const gefaess = (felder: Partial<Behaelter>): Behaelter => ({
    id: 'b-test', name: 'Testballon', bruttoLiter: 5,
    material: 'Glas', verschluss: 'Gärröhrchen', ...felder,
  })

  it('gilt am Liefertag selbst als verfügbar', () => {
    expect(behaelterVerfuegbar(gefaess({ vorhandenAb: '2026-09-04' }), '2026-09-04')).toBe(true)
  })

  it('gilt vor dem Liefertag als nicht verfügbar', () => {
    expect(behaelterVerfuegbar(gefaess({ vorhandenAb: '2026-09-05' }), '2026-09-04')).toBe(false)
  })

  it('gilt ohne Liefertermin als verfügbar', () => {
    expect(behaelterVerfuegbar(gefaess({}), '2026-09-04')).toBe(true)
  })

  it('ist ausgemustert nicht mehr verfügbar, auch wenn geliefert', () => {
    const zerbrochen = gefaess({ vorhandenAb: '2026-09-04', ausgemustertAm: '2026-09-04',
      ausgemustertGrund: 'Im Transport zerbrochen' })
    expect(behaelterVerfuegbar(zerbrochen, '2026-09-06')).toBe(false)
  })

  it('verträgt volle Zeitstempel statt reiner Datumsangaben', () => {
    expect(behaelterVerfuegbar(gefaess({ vorhandenAb: '2026-09-04T18:00:00Z' }), '2026-09-04T06:00:00Z')).toBe(true)
  })
})
