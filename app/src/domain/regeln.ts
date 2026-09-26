// Deterministische Regelengine. Entscheidet Ampel und Gates ohne LLM.
// Jede Regel trägt eine ID, damit Regressionstests einzeln darauf zeigen können.

import type { Ampel, Behaelter, Charge, Datenstand, Ereignis, Messung, MessTyp, Phase } from './typen'
import { AMPEL_RANG } from './typen'
import { kopfraumAnteil, molekularesSo2, NAEHRSALZ_MAX_G_PRO_100L } from './oenologie'

export interface Befund {
  regelId: string
  ampel: Ampel
  titel: string
  text: string
  massnahme?: string
}

export interface GateCheck {
  id: string
  frage: string
  erfuellt: boolean | null      // null = unbekannt, blockiert wie false, wird aber anders dargestellt
  begruendung: string
}

export interface GateErgebnis {
  gate: Phase
  titel: string
  freigegeben: boolean
  checks: GateCheck[]
  blocker: string[]
}

/** Grenzwerte an einer Stelle, damit Tests und UI dieselbe Wahrheit lesen. */
export const GRENZEN = {
  kopfraumGelb: 0.02,        // 2 % des Füllvolumens
  kopfraumOrange: 0.05,      // 5 %
  gaerendeMaxSg: 0.9960,     // Restzucker praktisch durchgegoren
  gaerendeMaxDeltaSg: 0.0010,
  gaerendeMindestabstandStunden: 48,
  /** 14 Tage: der Rhythmus, den Andi seit 21.09.2026 im Kalender hat (vorher 21). */
  kontrollintervallAusbauTage: 14,
  /** Nutzvolumen eines Ballons relativ zum Nennvolumen. Gemessen 26.09.2026: 5 L bis in den Hals ≈ 5,3 L. */
  fuellfaktorHals: 1.06,
  /** Bis zur Schulter: 4,9 kg im 5-L-Ballon am 06.09.2026. */
  fuellfaktorSchulter: 0.98,
  /** Erwarteter Verlust beim Abstich. 26.09.2026 lag er deutlich unter den früher angesetzten 10 %. */
  abstichTrubAnteil: 0.05,
  /** Ein Gefäß gilt als „voll genug", wenn es zu mindestens 90 % seines Nutzvolumens gefüllt ist. */
  fuellplanMindestFuellung: 0.9,
  /** So viel Rest darf in Auffüllflaschen gehen, bevor die Gefäße als nicht ausreichend gelten. */
  fuellplanMaxRestLiter: 1.5,
  gaertemperaturRotMin: 18,
  gaertemperaturRotMax: 28,
  maischeKaltMin: 4,
  maischeKaltMax: 10,
  kaltmazerationMaxStunden: 96,
}

function letzteMessung(stand: Datenstand, chargeId: string, typ: MessTyp): Messung | undefined {
  return stand.messungen
    .filter(m => m.chargeId === chargeId && m.typ === typ)
    .sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
}

function ereignisse(stand: Datenstand, chargeId: string, art: Ereignis['art']): Ereignis[] {
  return stand.ereignisse
    .filter(e => e.chargeId === chargeId && e.art === art)
    .sort((a, b) => b.zeit.localeCompare(a.zeit))
}

/** Dichte einer Messung als SG, egal ob als °Oe oder SG erfasst. */
function alsSg(m: Messung | undefined): number | null {
  if (!m || m.wert === null) return null
  if (m.typ === 'sg') return m.wert
  if (m.typ === 'oechsle') return 1 + m.wert / 1000
  return null
}

/**
 * Dichtereihe für Gärbeurteilungen. Refraktometerwerte fliegen bewusst raus:
 * sobald Alkohol im Spiel ist, zeigt ein Refraktometer zu hoch an. Ein damit
 * gemessenes "Gärende" wäre derselbe Selbstbetrug wie "kein Blubbern = fertig".
 */
function dichtereihe(stand: Datenstand, chargeId: string): Messung[] {
  return stand.messungen
    .filter(m => (m.typ === 'sg' || m.typ === 'oechsle') && m.chargeId === chargeId)
    .filter(m => m.methode !== 'refraktometer')
    .sort((a, b) => b.zeit.localeCompare(a.zeit))
}

/** Gärt die Charge bereits oder ist sie durch die Gärung durch? Dann kein Refraktometer. */
function alkoholVorhanden(phase: Charge['phase']): boolean {
  return ['AKTIVE_GAERUNG', 'PRESS_GATE', 'NACHGAERUNG', 'GAERENDE_GATE', 'ERSTER_ABSTICH',
    'AUSBAU', 'STABILITAETS_GATE', 'SUESSE_GATE', 'ABFUELL_GATE', 'FLASCHE'].includes(phase)
}

function stundenZwischen(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 36e5
}

function tageSeit(iso: string, jetzt: Date): number {
  return (jetzt.getTime() - new Date(iso).getTime()) / 864e5
}

// ---------------------------------------------------------------------------
// Befunde je Charge
// ---------------------------------------------------------------------------

export function befundeFuerCharge(stand: Datenstand, charge: Charge, jetzt = new Date()): Befund[] {
  const b: Befund[] = []

  // R-OBERFLAECHE: Fruchtfliegen oder Oberflächenfilm = RED (Audit-Regel 10)
  const oberflaeche = letzteMessung(stand, charge.id, 'oberflaeche')
  if (oberflaeche?.text && ['Oberflächenfilm / Kahmhaut', 'Fruchtfliegen', 'Schimmel'].includes(oberflaeche.text)) {
    b.push({
      regelId: 'R-OBERFLAECHE',
      ampel: 'RED',
      titel: `Oberflächenbefund: ${oberflaeche.text}`,
      text: 'Das ist der Befund, an dem der Hauptwein 2025 gescheitert ist. Kahmhefe und Fruchtfliegen zeigen Luftzutritt und mikrobiologische Besiedlung an.',
      massnahme: 'Charge sperren. Nicht mit anderen Chargen vermischen, nicht abfüllen. Gefäß und Verschluss auf Dichtigkeit prüfen, Wein sensorisch bewerten, im Zweifel verwerfen.',
    })
  }

  // R-H2S: faule Eier = ORANGE (Audit-Regel 9)
  const geruch = letzteMessung(stand, charge.id, 'geruch')
  if (geruch?.text === 'faule Eier (H₂S)') {
    b.push({
      regelId: 'R-H2S',
      ampel: 'ORANGE',
      titel: 'H₂S-Note (faule Eier)',
      text: 'Schwefelwasserstoff entsteht bei Hefestress, meist durch Stickstoffmangel oder zu viel Trub. 2025 trat das beim Presswein auf.',
      massnahme: 'Charge isolieren. Sofort belüftend abziehen (Umpumpen mit Luftkontakt). Wenn die Note bleibt, kontrollierten Bench Trial mit Kupfer ansetzen — niemals eine Münze in den Wein.',
    })
  }
  if (geruch?.text === 'essigstichig') {
    b.push({
      regelId: 'R-ESSIG',
      ampel: 'RED',
      titel: 'Essigstich',
      text: 'Acetobacter arbeitet mit Sauerstoff. Ein Essigstich ist nicht rückführbar.',
      massnahme: 'Charge sperren, nicht vermischen. Ursache ist fast immer Kopfraum oder ein undichter Verschluss.',
    })
  }

  // R-KOPFRAUM: Pflichtvariable (Audit-Regel 5), scharf ab Ausbau.
  // Seit 26.09.2026 genügt die Füllstand-Stufe; sie gilt, wenn sie jünger ist als die letzte Literangabe.
  const inAusbau = ['AUSBAU', 'STABILITAETS_GATE', 'SUESSE_GATE', 'ABFUELL_GATE'].includes(charge.phase)
  if (inAusbau) {
    const stufe = letzteMessung(stand, charge.id, 'fuellstand')
    const letzterVolumenpunkt = [...(charge.volumenHistorie ?? [])].sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
    const stufeGilt = stufe?.text != null && (!letzterVolumenpunkt || stufe.zeit >= letzterVolumenpunkt.zeit
      || charge.fuellLiter == null || charge.kopfraumLiter == null)
    if (stufeGilt) {
      if (stufe!.text === 'darunter') {
        b.push({
          regelId: 'R-KOPFRAUM',
          ampel: 'ORANGE',
          titel: 'Füllstand unter der Schulter — zu viel Kopfraum',
          text: 'Genau diese Konstellation hat den Hauptwein 2025 über den Sommer gekippt: Kopfraum über Monate, Gärspund als Dauerverschluss, keine Kontrolle.',
          massnahme: 'Aus der Auffüllflasche bis in den Hals nachfüllen oder in ein kleineres Gefäß umziehen.',
        })
      } else if (stufe!.text === 'an der Schulter') {
        b.push({
          regelId: 'R-KOPFRAUM',
          ampel: 'YELLOW',
          titel: 'Füllstand an der Schulter',
          text: 'Nach dem Gärende gehört der Wein bis in den Hals. An der Schulter liegt mehr Luft über dem Wein, als ein langer Ausbau verträgt.',
          massnahme: 'Aus der Auffüllflasche bis in den Hals nachfüllen.',
        })
      }
    } else if (charge.fuellLiter == null || charge.kopfraumLiter == null) {
      b.push({
        regelId: 'R-KOPFRAUM-FEHLT',
        ampel: 'ORANGE',
        titel: 'Kopfraum nicht erfasst',
        text: 'Kopfraum ist im Ausbau Pflichtvariable. Ohne diese Angabe lässt sich das Oxidationsrisiko nicht beurteilen.',
        massnahme: 'Füllstand am Gefäß eintragen: im Hals, an der Schulter oder darunter.',
      })
    } else {
      const anteil = kopfraumAnteil(charge.fuellLiter, charge.kopfraumLiter)
      if (anteil > GRENZEN.kopfraumOrange) {
        b.push({
          regelId: 'R-KOPFRAUM',
          ampel: 'ORANGE',
          titel: `Kopfraum ${(anteil * 100).toFixed(1)} % — zu viel für den Ausbau`,
          text: 'Genau diese Konstellation hat den Hauptwein 2025 über den Sommer gekippt: Kopfraum über Monate, Gärspund als Dauerverschluss, keine Kontrolle.',
          massnahme: 'Randvoll auffüllen, in ein kleineres Gefäß umziehen oder den Kopfraum mit Inertgas überschichten.',
        })
      } else if (anteil > GRENZEN.kopfraumGelb) {
        b.push({
          regelId: 'R-KOPFRAUM',
          ampel: 'YELLOW',
          titel: `Kopfraum ${(anteil * 100).toFixed(1)} %`,
          text: 'Noch tolerabel, aber nicht für einen langen Ausbau.',
          massnahme: 'Beim nächsten Abstich in ein passendes Gefäß umziehen.',
        })
      }
    }
  }

  // R-KONTROLLPAUSE: Langzeitausbau ohne Kontrolle (Audit-Regel 11/12)
  if (inAusbau) {
    const letzteAktivitaet = [...stand.messungen, ...stand.ereignisse]
      .filter(x => x.chargeId === charge.id)
      .map(x => x.zeit)
      .sort()
      .pop()
    const basis = letzteAktivitaet ?? charge.startdatum
    const tage = tageSeit(basis, jetzt)
    if (tage > GRENZEN.kontrollintervallAusbauTage * 2) {
      b.push({
        regelId: 'R-KONTROLLPAUSE',
        ampel: 'ORANGE',
        titel: `Seit ${Math.floor(tage)} Tagen keine Kontrolle`,
        text: '2025 lag der Wein viele Monate unkontrolliert. Das war der eigentliche Schaden, nicht die Gärung.',
        massnahme: 'Sofort öffnen: Oberfläche, Geruch, Füllstand, Temperatur prüfen und eintragen.',
      })
    } else if (tage > GRENZEN.kontrollintervallAusbauTage) {
      b.push({
        regelId: 'R-KONTROLLPAUSE',
        ampel: 'YELLOW',
        titel: `Kontrolle überfällig (${Math.floor(tage)} Tage)`,
        text: `Im Ausbau ist ein Intervall von ${GRENZEN.kontrollintervallAusbauTage} Tagen hinterlegt.`,
        massnahme: 'Sichtkontrolle durchführen und protokollieren.',
      })
    }
  }

  // R-SO2-UNBEKANNT: Ausbau ohne SO2-Messung
  if (inAusbau) {
    const frei = letzteMessung(stand, charge.id, 'so2_frei')
    const ph = letzteMessung(stand, charge.id, 'ph')
    if (!frei) {
      b.push({
        regelId: 'R-SO2-UNBEKANNT',
        ampel: 'YELLOW',
        titel: 'Freier SO₂ unbekannt',
        text: ph
          ? `Der pH ist mit ${ph.wert} bekannt, der freie SO₂ nicht. Damit ist der molekulare SO₂ nicht bestimmbar — nur modellierbar.`
          : 'Weder pH noch freier SO₂ liegen vor. Jede Schwefelentscheidung ist damit eine Schätzung.',
        massnahme: 'Als bewusst unbekannt führen und dafür das Kontrollintervall kurz halten. Eine Titration ist die einzige echte Abhilfe.',
      })
    } else if (frei.wert !== null && ph?.wert != null) {
      const mol = molekularesSo2(frei.wert, ph.wert)
      if (mol.wert < 0.5) {
        b.push({
          regelId: 'R-SO2-NIEDRIG',
          ampel: 'ORANGE',
          titel: `Molekularer SO₂ nur ${mol.wert} mg/L`,
          text: `Bei pH ${ph.wert} und ${frei.wert} mg/L freiem SO₂ liegt der Schutz unter dem Korridor 0,5–0,8 mg/L.`,
          massnahme: 'Nachschwefeln. Die App rechnet die Menge im Schwefel-Rechner aus.',
        })
      }
    }
  }

  // R-GAERTEMPERATUR
  if (charge.phase === 'AKTIVE_GAERUNG' || charge.phase === 'NACHGAERUNG') {
    const t = letzteMessung(stand, charge.id, 'temperatur')
    if (t?.wert != null) {
      if (t.wert > GRENZEN.gaertemperaturRotMax) {
        b.push({
          regelId: 'R-GAERTEMPERATUR',
          ampel: 'ORANGE',
          titel: `Gärtemperatur ${t.wert} °C zu hoch`,
          text: 'Über 28 °C leidet das Aroma, die Hefe kann absterben und stecken bleiben.',
          massnahme: 'Kühlen: Gefäß in kaltes Wasser stellen, feuchtes Tuch, kühlerer Raum.',
        })
      } else if (t.wert < GRENZEN.gaertemperaturRotMin) {
        b.push({
          regelId: 'R-GAERTEMPERATUR',
          ampel: 'YELLOW',
          titel: `Gärtemperatur ${t.wert} °C niedrig`,
          text: 'Unter 18 °C wird die Rotweingärung träge, Maischegärung braucht Wärme für die Farbextraktion.',
          massnahme: 'Behutsam anwärmen, nicht über 25 °C.',
        })
      }
    }
  }

  // R-MAISCHE-KALT: Kaltmazeration überwachen
  if (charge.phase === 'KALTMAZERATION') {
    const t = letzteMessung(stand, charge.id, 'temperatur')
    if (t?.wert != null && t.wert > GRENZEN.maischeKaltMax) {
      b.push({
        regelId: 'R-MAISCHE-KALT',
        ampel: 'ORANGE',
        titel: `Maische ${t.wert} °C — zu warm für Kaltmazeration`,
        text: 'Über 10 °C springt Spontangärung an, ohne dass die Reinzuchthefe gesetzt ist.',
        massnahme: 'Kühler stellen oder sofort anstellen.',
      })
    }
    const aktivitaet = letzteMessung(stand, charge.id, 'gaeraktivitaet')
    if (aktivitaet?.text && aktivitaet.text !== 'keine') {
      b.push({
        regelId: 'R-SPONTANGAERUNG',
        ampel: 'ORANGE',
        titel: 'Spontangärung in der Kaltmazeration',
        text: 'Die Maische gärt bereits ohne gesetzte Reinzuchthefe. Wilde Hefen bestimmen dann den Verlauf.',
        massnahme: 'Abbruchkriterium erreicht: sofort mit Reinzuchthefe anstellen, auch wenn noch nicht alle Gärbehälter da sind.',
      })
    }
    const stunden = stundenZwischen(charge.startdatum, jetzt.toISOString())
    if (stunden > GRENZEN.kaltmazerationMaxStunden) {
      b.push({
        regelId: 'R-MAZERATION-LANG',
        ampel: 'YELLOW',
        titel: `Kaltmazeration seit ${Math.floor(stunden)} Stunden`,
        text: 'Über vier Tage ungeschützte Maische steigert das Risiko für wilde Hefen und Essigbakterien deutlich.',
        massnahme: 'Anstellen einplanen.',
      })
    }
  }

  // R-NAEHRSALZ: Überdosierung (2025er Fehler)
  const naehr = ereignisse(stand, charge.id, 'naehrsalz')
  if (naehr.length > 0 && charge.fuellLiter) {
    const summe = naehr.reduce((s, e) => s + (e.mengeWert ?? 0), 0)
    const maxG = (charge.fuellLiter / 100) * NAEHRSALZ_MAX_G_PRO_100L
    if (summe > maxG) {
      b.push({
        regelId: 'R-NAEHRSALZ-MAX',
        ampel: 'ORANGE',
        titel: `Hefenährsalz überdosiert: ${summe} g auf ${charge.fuellLiter} L`,
        text: `Die Herstellerangabe erlaubt höchstens ${maxG.toFixed(1)} g für dieses Volumen. Überschüssiger Stickstoff bleibt als Bakteriennahrung im Wein.`,
        massnahme: 'Keine weitere Gabe. Charge engmaschig auf Fehltöne prüfen.',
      })
    }
  }

  // R-PRESSWEIN: getrennt führen (Audit-Regel 8)
  if (charge.typ === 'presswein') {
    b.push({
      regelId: 'R-PRESSWEIN',
      ampel: 'YELLOW',
      titel: 'Presswein wird getrennt geführt',
      text: 'Presswein trägt mehr Trub, Gerbstoff und Hefebelastung. 2025 entwickelte genau diese Fraktion früh reduktive Noten.',
      massnahme: 'Nicht mit dem Vorlauf vereinigen, bevor beide Chargen über mehrere Wochen sauber sind.',
    })
  }

  // R-REFRAKTOMETER: Refraktometerwert nach Gärbeginn ist systematisch falsch
  if (alkoholVorhanden(charge.phase)) {
    const refra = stand.messungen
      .filter(m => m.chargeId === charge.id && m.methode === 'refraktometer')
      .filter(m => m.typ === 'oechsle' || m.typ === 'sg' || m.typ === 'brix')
      .sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
    if (refra) {
      b.push({
        regelId: 'R-REFRAKTOMETER',
        ampel: 'YELLOW',
        titel: 'Refraktometerwert nach Gärbeginn',
        text: 'Ethanol verändert den Brechungsindex. Sobald Alkohol im Ansatz ist, zeigt ein Refraktometer zu hoch an — der Wein wirkt süßer, als er ist. Der Wert wird für die Gärbeurteilung nicht herangezogen.',
        massnahme: 'Mit der Spindel nachmessen. Das Refraktometer ist ab Gärbeginn nur noch für grobe Trends brauchbar.',
      })
    }
  }

  if (charge.gesperrt) {
    b.push({
      regelId: 'R-SPERRE',
      ampel: 'RED',
      titel: 'Charge ist gesperrt',
      text: 'Manuell gesperrt. Keine Vermischung, keine Abfüllung.',
    })
  }

  return b
}

export function ampelFuerCharge(stand: Datenstand, charge: Charge, jetzt = new Date()): Ampel {
  const befunde = befundeFuerCharge(stand, charge, jetzt)
  return befunde.reduce<Ampel>((max, b) => (AMPEL_RANG[b.ampel] > AMPEL_RANG[max] ? b.ampel : max), 'GREEN')
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

export function pressGate(stand: Datenstand, charge: Charge): GateErgebnis {
  const checks: GateCheck[] = []
  const reihe = dichtereihe(stand, charge.id)
  const aktuell = alsSg(reihe[0])

  checks.push({
    id: 'press-dichte',
    frage: 'Liegt eine aktuelle Dichtemessung vor?',
    erfuellt: aktuell !== null ? true : null,
    begruendung: aktuell !== null
      ? `Zuletzt SG ${aktuell.toFixed(4)} (${((aktuell - 1) * 1000).toFixed(0)} °Oe).`
      : 'Ohne Dichtewert lässt sich der Gärfortschritt nicht beurteilen.',
  })

  checks.push({
    id: 'press-restzucker',
    frage: 'Ist der Zucker weit genug abgebaut (SG ≤ 1,010)?',
    erfuellt: aktuell === null ? null : aktuell <= 1.010,
    begruendung: aktuell === null
      ? 'Unbekannt.'
      : aktuell <= 1.010
        ? 'Der Großteil des Zuckers ist vergoren, die Maische kann abgepresst werden.'
        : `SG ${aktuell.toFixed(4)} liegt noch hoch. Zu frühes Pressen bringt die Gärung im Presswein ins Stocken.`,
  })

  const behaelterFrei = stand.behaelter.filter(x => !stand.chargen.some(c => c.behaelterId === x.id && !c.archiviert))
  checks.push({
    id: 'press-gefaesse',
    frage: 'Stehen genug Gefäße für Vorlauf und Presswein bereit?',
    erfuellt: behaelterFrei.length >= 2,
    begruendung: behaelterFrei.length >= 2
      ? `${behaelterFrei.length} freie Gefäße erfasst.`
      : '2025 musste der Presswein mangels Ballons in kleine Flaschen ausweichen. Vorlauf und Presswein brauchen getrennte, passend große Gefäße.',
  })

  const geruch = letzteMessung(stand, charge.id, 'geruch')
  checks.push({
    id: 'press-geruch',
    frage: 'Ist die Maische frei von Fehltönen?',
    erfuellt: geruch ? !['faule Eier (H₂S)', 'essigstichig', 'muffig'].includes(geruch.text ?? '') : null,
    begruendung: geruch ? `Zuletzt erfasst: ${geruch.text}.` : 'Kein Geruchsbefund erfasst.',
  })

  return baueGate('PRESS_GATE', 'Press-Gate', checks)
}

export function gaerendeGate(stand: Datenstand, charge: Charge): GateErgebnis {
  const checks: GateCheck[] = []
  const reihe = dichtereihe(stand, charge.id)
  const m0 = reihe[0]
  const m1 = reihe[1]
  const sg0 = alsSg(m0)
  const sg1 = alsSg(m1)

  // Kernregel: Gärende NIE über "kein Blubbern" (Audit-Regel 3)
  const zweiMessungen = sg0 !== null && sg1 !== null
  const abstandOk = zweiMessungen && m0 && m1
    ? stundenZwischen(m0.zeit, m1.zeit) >= GRENZEN.gaerendeMindestabstandStunden
    : false
  // Werte jenseits der Skala (26.09.2026: Mostwaage endet bei −3 °Oe) beweisen keinen Stillstand.
  const jenseits = Boolean(m0?.grenze || m1?.grenze)
  const konstant = zweiMessungen && !jenseits ? Math.abs(sg0! - sg1!) <= GRENZEN.gaerendeMaxDeltaSg : false
  const trocken = sg0 !== null ? sg0 <= GRENZEN.gaerendeMaxSg : false
  // „unter X" ist nur dann sicher trocken, wenn schon X unter der Grenze liegt.
  const trockenUnbestimmt = m0?.grenze === 'unter' && !trocken

  checks.push({
    id: 'gaerende-zwei-messungen',
    frage: `Zwei Dichtemessungen im Abstand von mindestens ${GRENZEN.gaerendeMindestabstandStunden} Stunden?`,
    erfuellt: zweiMessungen ? abstandOk : null,
    begruendung: !zweiMessungen
      ? 'Es liegen weniger als zwei Dichtemessungen vor.'
      : abstandOk
        ? `Abstand ${Math.floor(stundenZwischen(m0!.zeit, m1!.zeit))} Stunden.`
        : `Abstand nur ${Math.floor(stundenZwischen(m0!.zeit, m1!.zeit))} Stunden — zu kurz, um Stillstand von Trägheit zu unterscheiden.`,
  })

  checks.push({
    id: 'gaerende-konstant',
    frage: `Sind beide Werte konstant (Δ ≤ ${GRENZEN.gaerendeMaxDeltaSg.toFixed(4)})?`,
    erfuellt: zweiMessungen && !jenseits ? konstant : null,
    begruendung: !zweiMessungen
      ? 'Nicht beurteilbar.'
      : jenseits
        ? 'Mindestens ein Wert liegt jenseits der Skala. Ob er sich bewegt hat, ist nicht ablesbar — mit der Feinspindel messen.'
        : `Δ = ${Math.abs(sg0! - sg1!).toFixed(4)}.`,
  })

  checks.push({
    id: 'gaerende-trocken',
    frage: `Ist der Wein durchgegoren (SG ≤ ${GRENZEN.gaerendeMaxSg.toFixed(4)})?`,
    erfuellt: sg0 === null || trockenUnbestimmt ? null : trocken,
    begruendung: sg0 === null
      ? 'Keine Dichtemessung.'
      : trockenUnbestimmt
        ? `Unter SG ${sg0.toFixed(4)}, aber nicht sicher unter ${GRENZEN.gaerendeMaxSg.toFixed(4)}. Die Skala reicht nicht tief genug.`
      : trocken
        ? `SG ${sg0.toFixed(4)} — durchgegoren.`
        : `SG ${sg0.toFixed(4)} weist auf Restzucker hin. Ein Wein mit Restzucker ist nicht am Gärende, sondern womöglich stecken geblieben.`,
  })

  checks.push({
    id: 'gaerende-kein-blubbern',
    frage: 'Wird das Gärende ausschließlich über die Dichte bestimmt?',
    erfuellt: true,
    begruendung: 'Das Gärröhrchen zählt hier bewusst nicht. Ein ruhender Gärspund bedeutet auch bei Restzucker oft nur, dass die Gärung schleicht oder das Gefäß undicht ist.',
  })

  return baueGate('GAERENDE_GATE', 'Gärende-Gate', checks)
}

export function stabilitaetsGate(stand: Datenstand, charge: Charge): GateErgebnis {
  const checks: GateCheck[] = []
  const ph = letzteMessung(stand, charge.id, 'ph')
  const frei = letzteMessung(stand, charge.id, 'so2_frei')
  const restzucker = letzteMessung(stand, charge.id, 'restzucker')
  const sg = alsSg(dichtereihe(stand, charge.id)[0])

  checks.push({
    id: 'stab-ph',
    frage: 'Liegt ein gemessener pH-Wert vor?',
    erfuellt: ph?.wert != null ? true : null,
    begruendung: ph?.wert != null
      ? `pH ${ph.wert}.`
      : 'Ohne pH lässt sich der wirksame, molekulare SO₂ nicht berechnen.',
  })

  checks.push({
    id: 'stab-so2',
    frage: 'Ist der freie SO₂ gemessen?',
    erfuellt: frei?.wert != null ? true : null,
    begruendung: frei?.wert != null
      ? `${frei.wert} mg/L freier SO₂.`
      : 'Nicht gemessen. Der Schutz ist damit modelliert, nicht belegt — die Charge bleibt bewusst als unsicher geführt.',
  })

  if (ph?.wert != null && frei?.wert != null) {
    const mol = molekularesSo2(frei.wert, ph.wert)
    checks.push({
      id: 'stab-molekular',
      frage: 'Liegt der molekulare SO₂ im Schutzkorridor 0,5–0,8 mg/L?',
      erfuellt: mol.wert >= 0.5,
      begruendung: `${mol.wert} mg/L molekular (${mol.formel}).`,
    })
  }

  const restzuckerVorhanden =
    (restzucker?.wert != null && restzucker.wert > 4) ||
    (sg !== null && sg > GRENZEN.gaerendeMaxSg)

  checks.push({
    id: 'stab-restzucker',
    frage: 'Ist der Wein durchgegoren oder der Restzucker sicher beherrscht?',
    erfuellt: restzuckerVorhanden ? false : (sg !== null ? true : null),
    begruendung: restzuckerVorhanden
      ? 'Restzucker vorhanden. Genau daran ist der süße Weißwein 2025 in der Flasche nachgegoren.'
      : sg !== null ? 'Durchgegoren.' : 'Keine Dichtemessung.',
  })

  const kopfraumOk = charge.fuellLiter != null && charge.kopfraumLiter != null
    ? kopfraumAnteil(charge.fuellLiter, charge.kopfraumLiter) <= GRENZEN.kopfraumOrange
    : null
  checks.push({
    id: 'stab-kopfraum',
    frage: 'Ist der Kopfraum erfasst und klein genug?',
    erfuellt: kopfraumOk,
    begruendung: kopfraumOk === null
      ? 'Kopfraum nicht erfasst — Pflichtvariable.'
      : kopfraumOk ? 'Kopfraum im Rahmen.' : 'Kopfraum zu groß für einen stabilen Ausbau.',
  })

  return baueGate('STABILITAETS_GATE', 'Stabilitäts-Gate', checks)
}

export function suesseGate(stand: Datenstand, charge: Charge): GateErgebnis {
  const checks: GateCheck[] = []
  const frei = letzteMessung(stand, charge.id, 'so2_frei')
  const sterilfiltration = stand.ereignisse.some(
    e => e.chargeId === charge.id && e.art === 'stabilisieren' && /sterilfilt|pasteuris/i.test(`${e.stoff ?? ''} ${e.produkt ?? ''} ${e.begruendung}`),
  )
  const sorbat = stand.ereignisse.some(
    e => e.chargeId === charge.id && /sorbat/i.test(`${e.stoff ?? ''} ${e.produkt ?? ''}`),
  )

  checks.push({
    id: 'suesse-verfahren',
    frage: 'Gibt es einen echten Refermentationsschutz (Sterilfiltration oder Pasteurisierung)?',
    erfuellt: sterilfiltration,
    begruendung: sterilfiltration
      ? 'Sterilfiltration oder Pasteurisierung ist protokolliert.'
      : 'Ohne bestätigte mikrobiologische Stabilisierung darf ein Wein mit Restzucker nicht abgefüllt werden (Audit-Regel 6).',
  })

  checks.push({
    id: 'suesse-sorbat',
    frage: 'Wird auf Sorbat als alleinigen Gärstopp verzichtet?',
    erfuellt: !(sorbat && !sterilfiltration),
    begruendung: sorbat && !sterilfiltration
      ? 'Kaliumsorbat verhindert nur die Vermehrung bereits ruhender Hefe und wirkt ausschließlich zusammen mit ausreichend SO₂. Ein Gärstopp ist es nicht (Audit-Regel 7).'
      : 'Kein Sorbat als Alleinlösung im Protokoll.',
  })

  checks.push({
    id: 'suesse-so2',
    frage: 'Ist der freie SO₂ gemessen?',
    erfuellt: frei?.wert != null ? true : null,
    begruendung: frei?.wert != null
      ? `${frei.wert} mg/L.`
      : 'Nicht gemessen. Süßen ohne SO₂-Messung ist der direkte Weg in die Flaschengärung von 2025.',
  })

  return baueGate('SUESSE_GATE', 'Süße-Gate', checks)
}

export function abfuellGate(stand: Datenstand, charge: Charge): GateErgebnis {
  const checks: GateCheck[] = []
  const stab = stabilitaetsGate(stand, charge)
  const oberflaeche = letzteMessung(stand, charge.id, 'oberflaeche')
  const restzucker = letzteMessung(stand, charge.id, 'restzucker')
  const sg = alsSg(dichtereihe(stand, charge.id)[0])
  const hatRestzucker = (restzucker?.wert != null && restzucker.wert > 4) || (sg !== null && sg > GRENZEN.gaerendeMaxSg)

  checks.push({
    id: 'abfuell-stabilitaet',
    frage: 'Ist das Stabilitäts-Gate freigegeben?',
    erfuellt: stab.freigegeben,
    begruendung: stab.freigegeben ? 'Freigegeben.' : `Offen: ${stab.blocker.join(' · ')}`,
  })

  checks.push({
    id: 'abfuell-oberflaeche',
    frage: 'Ist die Oberfläche blank (kein Film, keine Fruchtfliegen)?',
    erfuellt: oberflaeche
      ? !['Oberflächenfilm / Kahmhaut', 'Fruchtfliegen', 'Schimmel'].includes(oberflaeche.text ?? '')
      : null,
    begruendung: oberflaeche ? `Zuletzt: ${oberflaeche.text}.` : 'Kein Oberflächenbefund erfasst.',
  })

  if (hatRestzucker) {
    const suesse = suesseGate(stand, charge)
    checks.push({
      id: 'abfuell-restzucker',
      frage: 'Restzucker vorhanden — ist das Süße-Gate freigegeben?',
      erfuellt: suesse.freigegeben,
      begruendung: suesse.freigegeben
        ? 'Refermentationsschutz belegt.'
        : `Nicht freigegeben: ${suesse.blocker.join(' · ')}`,
    })
  }

  checks.push({
    id: 'abfuell-sperre',
    frage: 'Ist die Charge frei von Sperren?',
    erfuellt: !charge.gesperrt,
    begruendung: charge.gesperrt ? 'Charge ist gesperrt.' : 'Keine Sperre.',
  })

  return baueGate('ABFUELL_GATE', 'Abfüll-Gate', checks)
}

function baueGate(gate: Phase, titel: string, checks: GateCheck[]): GateErgebnis {
  const blocker = checks
    .filter(c => c.erfuellt !== true)
    .map(c => c.frage)
  return { gate, titel, freigegeben: blocker.length === 0, checks, blocker }
}

export function gateFuerPhase(stand: Datenstand, charge: Charge): GateErgebnis | null {
  switch (charge.phase) {
    case 'PRESS_GATE': return pressGate(stand, charge)
    case 'GAERENDE_GATE': return gaerendeGate(stand, charge)
    case 'STABILITAETS_GATE': return stabilitaetsGate(stand, charge)
    case 'SUESSE_GATE': return suesseGate(stand, charge)
    case 'ABFUELL_GATE': return abfuellGate(stand, charge)
    default: return null
  }
}

/** Darf Charge a mit Charge b vereinigt werden? (Audit-Regel 8 und 10) */
export function vermischungErlaubt(stand: Datenstand, a: Charge, b: Charge): { erlaubt: boolean; grund: string } {
  if (a.gesperrt || b.gesperrt) return { erlaubt: false, grund: 'Mindestens eine Charge ist gesperrt.' }
  const ampelA = ampelFuerCharge(stand, a)
  const ampelB = ampelFuerCharge(stand, b)
  if (ampelA === 'RED' || ampelB === 'RED') return { erlaubt: false, grund: 'Rote Ampel: keine Vermischung.' }
  if (ampelA === 'ORANGE' || ampelB === 'ORANGE') return { erlaubt: false, grund: 'Orange Ampel: Charge ist isoliert zu führen.' }
  if (a.typ !== b.typ && (a.typ === 'presswein' || b.typ === 'presswein')) {
    return { erlaubt: false, grund: 'Presswein wird getrennt geführt (Audit-Regel 8). Vereinigung nur nach ausdrücklicher Freigabe.' }
  }
  return { erlaubt: true, grund: 'Keine Regel spricht dagegen.' }
}

/**
 * Ist ein Gefäß am Stichtag benutzbar?
 *
 * Zwei Gründe sprechen dagegen: Es ist noch nicht geliefert (`vorhandenAb` liegt in der
 * Zukunft) oder es ist ausgemustert. Beides wird an genau EINER Stelle beantwortet,
 * damit Auswahl und Anzeige nicht auseinanderlaufen — genau das ist am 04.09.2026
 * passiert: Die Auswahl beim Zuordnen verglich das Datum, die Übersicht nicht, und
 * zeigte gelieferte Ballons dauerhaft als „ab 04.09." statt als „frei".
 */
export function behaelterVerfuegbar(behaelter: Behaelter, stichtagISO: string): boolean {
  const tag = stichtagISO.slice(0, 10)
  if (behaelter.ausgemustertAm && behaelter.ausgemustertAm.slice(0, 10) <= tag) return false
  if (behaelter.vorhandenAb && behaelter.vorhandenAb.slice(0, 10) > tag) return false
  return true
}

// ─── Ausbau: Füllplan und Abstich (26.09.2026) ─────────────────────────────

export interface FuellplanGefaess { behaelterId: string; bruttoLiter: number }

export interface Fuellplan {
  /** Weinmenge nach Abzug des erwarteten Trubs. */
  volumenLiter: number
  zielFuellung: 'hals' | 'schulter'
  befuellt: { behaelterId: string; liter: number; anteil: number }[]
  /** Rest für Auffüllflaschen. */
  restLiter: number
  frei: string[]
  reichtNicht: boolean
  hinweise: string[]
}

const r2 = (x: number): number => Math.round(x * 100) / 100

/**
 * Verteilt eine Weinmenge so auf Gefäße, dass kein halbvolles Gefäß bleibt.
 * Gesucht wird die Auswahl mit dem kleinsten Leerraum, bei der höchstens ein Gefäß
 * nicht ganz voll ist — und das mindestens zu 90 %. Findet sich keine, werden so viele
 * Gefäße wie möglich voll gemacht und der Rest geht in Auffüllflaschen.
 * Beleg 26.09.2026: 27,73 L auf 5 × 5 L + 3 L → fünf 5-L-Ballons, der 3-L-Ballon bleibt frei.
 */
export function fuellplan(
  volumenVorAbstich: number,
  gefaesse: FuellplanGefaess[],
  optionen: { zielFuellung?: 'hals' | 'schulter'; trubAnteil?: number } = {},
): Fuellplan {
  const zielFuellung = optionen.zielFuellung ?? 'hals'
  const trub = optionen.trubAnteil ?? GRENZEN.abstichTrubAnteil
  const faktor = zielFuellung === 'hals' ? GRENZEN.fuellfaktorHals : GRENZEN.fuellfaktorSchulter
  const volumen = r2(volumenVorAbstich * (1 - trub))
  const nutz = gefaesse.map(g => ({ ...g, nutz: g.bruttoLiter * faktor }))
  const n = nutz.length
  const hinweise: string[] = []

  let beste: { maske: number; leer: number; anzahl: number } | null = null
  if (n <= 16) {
    for (let maske = 1; maske < (1 << n); maske++) {
      let kap = 0; let groesste = 0; let anzahl = 0
      for (let i = 0; i < n; i++) if (maske & (1 << i)) { kap += nutz[i]!.nutz; groesste = Math.max(groesste, nutz[i]!.nutz); anzahl++ }
      const leer = kap - volumen
      if (leer < -1e-9 || leer > (1 - GRENZEN.fuellplanMindestFuellung) * groesste + 1e-9) continue
      if (!beste || leer < beste.leer - 1e-9 || (Math.abs(leer - beste.leer) < 1e-9 && anzahl < beste.anzahl)) beste = { maske, leer, anzahl }
    }
  }

  const befuellt: Fuellplan['befuellt'] = []
  let restLiter = 0
  if (beste) {
    const gewaehlt = nutz.filter((_, i) => beste!.maske & (1 << i)).sort((a, b) => b.nutz - a.nutz)
    gewaehlt.forEach((g, i) => {
      const liter = i === 0 ? g.nutz - beste!.leer : g.nutz
      befuellt.push({ behaelterId: g.behaelterId, liter: r2(liter), anteil: r2(liter / g.nutz) })
    })
    if (beste.leer > 0.05) hinweise.push(`Ein Gefäß ist zu ${Math.round((1 - beste.leer / gewaehlt[0]!.nutz) * 100)} % gefüllt — aus der Auffüllflasche nachfüllen.`)
  } else {
    // Keine passende Auswahl: größtmögliche Menge in volle Gefäße, Rest in Flaschen.
    let bestKap = 0; let bestMaske = 0
    if (n <= 16) {
      for (let maske = 1; maske < (1 << n); maske++) {
        let kap = 0
        for (let i = 0; i < n; i++) if (maske & (1 << i)) kap += nutz[i]!.nutz
        if (kap <= volumen + 1e-9 && kap > bestKap) { bestKap = kap; bestMaske = maske }
      }
    }
    nutz.forEach((g, i) => { if (bestMaske & (1 << i)) befuellt.push({ behaelterId: g.behaelterId, liter: r2(g.nutz), anteil: 1 }) })
    restLiter = r2(volumen - bestKap)
    if (restLiter > GRENZEN.fuellplanMaxRestLiter) {
      // Zu viel für Flaschen: in das kleinste freie Gefäß, das den Rest fasst — mit Warnung.
      const kandidat = nutz
        .filter((_, i) => !(bestMaske & (1 << i)))
        .filter(g => g.nutz >= restLiter - 1e-9)
        .sort((a, b) => a.nutz - b.nutz)[0]
      if (kandidat) {
        const anteil = r2(restLiter / kandidat.nutz)
        befuellt.push({ behaelterId: kandidat.behaelterId, liter: restLiter, anteil })
        hinweise.push(`Ein Gefäß ist nur zu ${Math.round(anteil * 100)} % gefüllt — Kopfraum. Mit der Auffüllflasche ausgleichen oder ein kleineres Gefäß wählen.`)
        restLiter = 0
      }
    }
    if (restLiter > 0) hinweise.push(`${restLiter.toFixed(2).replace('.', ',')} L randvoll in Flaschen — das ist der Auffüllvorrat.`)
  }
  const belegt = new Set(befuellt.map(b => b.behaelterId))
  const frei = gefaesse.filter(g => !belegt.has(g.behaelterId)).map(g => g.behaelterId)
  const reichtNicht = restLiter > GRENZEN.fuellplanMaxRestLiter
  if (reichtNicht) hinweise.push('Die gewählten Gefäße reichen nicht. Weitere Gefäße auswählen.')
  return { volumenLiter: volumen, zielFuellung, befuellt, restLiter, frei, reichtNicht, hinweise }
}

export interface AbstichEingabe {
  /** Die Chargen, die abgezogen werden, z. B. Ballon 1–5 eines Loses. */
  quellen: Charge[]
  /** Die gewählten Zielgefäße. */
  ziele: Behaelter[]
  /** Summe der Füllvolumina vor dem Abstich. */
  volumenLiter: number
  /** null = noch nicht bestätigt. */
  ballonsAbgekuehlt: boolean | null
  /** Gärende nicht bestätigt, aber bewusst trotzdem abziehen (z. B. Grobtrub zu lange). */
  vorziehenBegruendung?: string
}

export interface AbstichPruefung extends GateErgebnis {
  zielFuellung: 'hals' | 'schulter'
  /** Schwefel erst, wenn das Gärende bestätigt ist — sonst stoppt er die Hefe vor dem Ziel. */
  schwefelFreigegeben: boolean
  plan: Fuellplan
}

/**
 * Abstich-Gate. Der Abstich ist der sauerstoffreichste Schritt des Jahres und hatte
 * bis 26.09.2026 keine einzige Prüfung.
 */
export function abstichGate(stand: Datenstand, e: AbstichEingabe): AbstichPruefung {
  const checks: GateCheck[] = []
  const gaerendeOk = e.quellen.length > 0 && e.quellen.every(q => gaerendeGate(stand, q).freigegeben)
  const vorgezogen = !gaerendeOk && Boolean(e.vorziehenBegruendung?.trim())
  checks.push({
    id: 'abstich-gaerende',
    frage: 'Ist das Gärende bestätigt?',
    erfuellt: gaerendeOk || vorgezogen ? true : null,
    begruendung: gaerendeOk
      ? 'Zwei konstante Dichtemessungen im Mindestabstand liegen vor.'
      : vorgezogen
        ? `Bewusst vorgezogen: ${e.vorziehenBegruendung!.trim()} Gefüllt wird nur bis zur Schulter, Schwefel bleibt gesperrt, bis das Gärende feststeht.`
        : 'Nicht bestätigt. Entweder zweite Messung abwarten oder den Abstich bewusst vorziehen und begründen.',
  })

  const typen = new Set(e.quellen.map(q => q.typ))
  const getrennt = !(typen.has('presswein') && typen.size > 1)
  checks.push({
    id: 'abstich-getrennt',
    frage: 'Bleiben Vorlauf und Presswein getrennt?',
    erfuellt: getrennt,
    begruendung: getrennt ? 'Alle Quellen gehören zur selben Fraktion.' : 'Presswein und Vorlauf würden zusammenlaufen (Audit-Regel 8).',
  })

  const rot = e.quellen.filter(q => q.gesperrt || ampelFuerCharge(stand, q) === 'RED')
  checks.push({
    id: 'abstich-nicht-gesperrt',
    frage: 'Ist keine Quelle gesperrt?',
    erfuellt: rot.length === 0,
    begruendung: rot.length === 0 ? 'Keine rote Ampel.' : `Gesperrt: ${rot.map(q => q.name).join(', ')}. Erst den Befund klären.`,
  })

  const zielFuellung = gaerendeOk ? 'hals' : 'schulter'
  const plan = fuellplan(e.volumenLiter, e.ziele.map(z => ({ behaelterId: z.id, bruttoLiter: z.bruttoLiter })), { zielFuellung })
  checks.push({
    id: 'abstich-gefaesse',
    frage: 'Reichen die Zielgefäße ohne halbvolles Gefäß?',
    erfuellt: !plan.reichtNicht,
    begruendung: plan.reichtNicht ? plan.hinweise.join(' ') : `${plan.befuellt.length} Gefäße, ${plan.frei.length} bleiben frei.`,
  })

  checks.push({
    id: 'abstich-abgekuehlt',
    frage: 'Sind die Ballons ausgespült und abgekühlt?',
    erfuellt: e.ballonsAbgekuehlt,
    begruendung: e.ballonsAbgekuehlt ? 'Bestätigt.' : 'Heißes Glas kann springen, wenn kühler Wein hineinläuft.',
  })

  return { ...baueGate('ERSTER_ABSTICH', 'Abstich-Gate', checks), zielFuellung, schwefelFreigegeben: gaerendeOk, plan }
}
