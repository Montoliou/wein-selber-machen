// Deterministische Regelengine. Entscheidet Ampel und Gates ohne LLM.
// Jede Regel trägt eine ID, damit Regressionstests einzeln darauf zeigen können.

import type { Ampel, Charge, Datenstand, Ereignis, Messung, MessTyp, Phase } from './typen'
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
  kontrollintervallAusbauTage: 21,
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

  // R-KOPFRAUM: Pflichtvariable (Audit-Regel 5), scharf ab Ausbau
  const inAusbau = ['AUSBAU', 'STABILITAETS_GATE', 'SUESSE_GATE', 'ABFUELL_GATE'].includes(charge.phase)
  if (inAusbau) {
    if (charge.fuellLiter == null || charge.kopfraumLiter == null) {
      b.push({
        regelId: 'R-KOPFRAUM-FEHLT',
        ampel: 'ORANGE',
        titel: 'Kopfraum nicht erfasst',
        text: 'Kopfraum ist im Ausbau Pflichtvariable. Ohne diese Zahl lässt sich das Oxidationsrisiko nicht beurteilen.',
        massnahme: 'Füllvolumen und Kopfraum am Gefäß eintragen.',
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
  const konstant = zweiMessungen ? Math.abs(sg0! - sg1!) <= GRENZEN.gaerendeMaxDeltaSg : false
  const trocken = sg0 !== null ? sg0 <= GRENZEN.gaerendeMaxSg : false

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
    erfuellt: zweiMessungen ? konstant : null,
    begruendung: zweiMessungen
      ? `Δ = ${Math.abs(sg0! - sg1!).toFixed(4)}.`
      : 'Nicht beurteilbar.',
  })

  checks.push({
    id: 'gaerende-trocken',
    frage: `Ist der Wein durchgegoren (SG ≤ ${GRENZEN.gaerendeMaxSg.toFixed(4)})?`,
    erfuellt: sg0 !== null ? trocken : null,
    begruendung: sg0 === null
      ? 'Keine Dichtemessung.'
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
