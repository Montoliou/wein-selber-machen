import type { Charge, EreignisArt, Messung, Phase, Reminder, Vorratsposten } from '../domain/typen'
import {
  naehrsalzPlan,
  NAEHRSALZ_MAX_G_PRO_100L,
  NAEHRSALZ_PORTIONEN,
  oechsleAusSg,
  schwefelDosierung,
  zuckerFuerOechsle,
} from '../domain/oenologie'
import type { AppDatenstand } from '../speicher/modell'
import { datumZeitFormat, formatiereZahl } from './format'

export type RundenZugabeArt = 'naehrsalz' | 'aufzuckern' | 'schwefeln' | 'sonstiges'

export interface RundenZugabeVorschlag {
  art: RundenZugabeArt
  ereignisArt: EreignisArt
  label: string
  stoff: string
  einheit: string
  menge: string
  herkunft: string
  begruendung: string
  portion?: number
  gesamtMax?: number
  bisherGesamt?: number
}

export interface VorratsZuordnung {
  posten?: Vorratsposten
  hinweis: string
  warnung: boolean
}

const ZUGABEN_NACH_PHASE: Partial<Record<Phase, RundenZugabeArt[]>> = {
  AKTIVE_GAERUNG: ['naehrsalz', 'aufzuckern'],
  NACHGAERUNG: ['naehrsalz', 'aufzuckern'],
  AUSBAU: ['schwefeln'],
  STABILITAETS_GATE: ['schwefeln'],
  SUESSE_GATE: ['schwefeln'],
  ABFUELL_GATE: ['schwefeln'],
}

const VORRAT_ID_NACH_ART: Partial<Record<RundenZugabeArt, string>> = {
  naehrsalz: 'vorrat-naehrsalz',
  aufzuckern: 'vorrat-zucker',
  schwefeln: 'vorrat-kps',
}

function letzteMessung(stand: AppDatenstand, chargeId: string, typ: Messung['typ']): Messung | undefined {
  return stand.messungen
    .filter(messung => messung.chargeId === chargeId && messung.typ === typ)
    .sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
}

function letzteDichteInOechsle(stand: AppDatenstand, chargeId: string): number | undefined {
  const messung = stand.messungen
    .filter(eintrag => eintrag.chargeId === chargeId && (eintrag.typ === 'oechsle' || eintrag.typ === 'sg') && eintrag.wert !== null)
    .sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
  if (messung?.wert == null) return undefined
  return messung.typ === 'sg' ? oechsleAusSg(messung.wert) : messung.wert
}

function rundenKontext(zeit: string): string {
  return `während der Runde am ${datumZeitFormat.format(new Date(zeit))}`
}

function fehlendeWerteHinweis(fehlend: string[]): string {
  return `Kein Mengenvorschlag: ${fehlend.join(' und ')} ${fehlend.length === 1 ? 'fehlt' : 'fehlen'}.`
}

export function zugabeArtenFuerPhase(phase: Phase): RundenZugabeArt[] {
  return [...(ZUGABEN_NACH_PHASE[phase] ?? []), 'sonstiges']
}

export function zugabeVorschlag(
  stand: AppDatenstand,
  charge: Charge,
  art: RundenZugabeArt,
  zeit: string,
  letztesZuckerZiel?: number,
): RundenZugabeVorschlag {
  const kontext = rundenKontext(zeit)
  if (art === 'naehrsalz') {
    const bisher = stand.ereignisse.filter(ereignis => ereignis.chargeId === charge.id && ereignis.art === 'naehrsalz')
    const portion = bisher.length + 1
    const bisherGesamt = bisher.reduce((summe, ereignis) => summe + (ereignis.mengeWert ?? 0), 0)
    if (charge.erwarteteWeinLiter === undefined) {
      const herkunft = fehlendeWerteHinweis(['die erwartete Weinmenge'])
      return {
        art,
        ereignisArt: 'naehrsalz',
        label: 'Hefenährsalz',
        stoff: 'Hefenährsalz',
        einheit: 'g',
        menge: '',
        herkunft,
        begruendung: `Hefenährsalz, Portion ${portion} von ${NAEHRSALZ_PORTIONEN}, ${kontext}. ${herkunft}`,
        portion,
        bisherGesamt,
      }
    }
    const plan = naehrsalzPlan(charge.erwarteteWeinLiter)
    const herkunft = `Portion ${portion} von ${NAEHRSALZ_PORTIONEN} · Höchstmenge ${NAEHRSALZ_MAX_G_PRO_100L} g je 100 L auf ${formatiereZahl(charge.erwarteteWeinLiter)} L`
    return {
      art,
      ereignisArt: 'naehrsalz',
      label: 'Hefenährsalz',
      stoff: 'Hefenährsalz',
      einheit: 'g',
      menge: formatiereZahl(plan.proPortion),
      herkunft,
      begruendung: `Hefenährsalz, Portion ${portion} von ${NAEHRSALZ_PORTIONEN}, ${kontext}. Menge mit naehrsalzPlan(${formatiereZahl(charge.erwarteteWeinLiter)} L) berechnet. Vorgeschlagen sind ${formatiereZahl(plan.proPortion)} g bei einer Höchstmenge von ${formatiereZahl(plan.gesamtMax)} g.`,
      portion,
      gesamtMax: plan.gesamtMax,
      bisherGesamt,
    }
  }

  if (art === 'aufzuckern') {
    const volumen = charge.fuellLiter ?? charge.erwarteteWeinLiter
    const istOe = letzteDichteInOechsle(stand, charge.id)
    const fehlend: string[] = []
    if (volumen === undefined) fehlend.push('das Volumen')
    if (istOe === undefined) fehlend.push('das letzte Mostgewicht')
    if (letztesZuckerZiel === undefined) fehlend.push('das zuletzt verwendete Ziel in °Oe')
    if (fehlend.length || volumen === undefined || istOe === undefined || letztesZuckerZiel === undefined) {
      const herkunft = fehlendeWerteHinweis(fehlend)
      return {
        art,
        ereignisArt: 'aufzuckern',
        label: 'Haushaltszucker',
        stoff: 'Haushaltszucker',
        einheit: 'g',
        menge: '',
        herkunft,
        begruendung: `Haushaltszucker ${kontext}. ${herkunft}`,
      }
    }
    const ergebnis = zuckerFuerOechsle(volumen, istOe, letztesZuckerZiel)
    const herkunft = `zuletzt ${formatiereZahl(istOe, 1)} °Oe · Ziel ${formatiereZahl(letztesZuckerZiel, 1)} °Oe · ${formatiereZahl(volumen)} L`
    return {
      art,
      ereignisArt: 'aufzuckern',
      label: 'Haushaltszucker',
      stoff: 'Haushaltszucker',
      einheit: 'g',
      menge: formatiereZahl(ergebnis.wert),
      herkunft,
      begruendung: `Haushaltszucker ${kontext}. Menge mit zuckerFuerOechsle(${formatiereZahl(volumen)} L, ${formatiereZahl(istOe, 1)} °Oe, Ziel ${formatiereZahl(letztesZuckerZiel, 1)} °Oe) berechnet. Vorgeschlagen sind ${formatiereZahl(ergebnis.wert)} g.`,
    }
  }

  if (art === 'schwefeln') {
    const volumen = charge.fuellLiter ?? charge.erwarteteWeinLiter
    const ph = letzteMessung(stand, charge.id, 'ph')?.wert ?? undefined
    const frei = letzteMessung(stand, charge.id, 'so2_frei')?.wert ?? undefined
    const fehlend: string[] = []
    if (volumen === undefined) fehlend.push('das Volumen')
    if (ph === undefined || ph === null) fehlend.push('der letzte pH-Wert')
    if (frei === undefined || frei === null) fehlend.push('der letzte freie SO₂')
    if (fehlend.length || volumen === undefined || ph == null || frei == null) {
      const herkunft = fehlendeWerteHinweis(fehlend)
      return {
        art,
        ereignisArt: 'schwefeln',
        label: 'Kaliumpyrosulfit',
        stoff: 'Kaliumpyrosulfit',
        einheit: 'g',
        menge: '',
        herkunft,
        begruendung: `Kaliumpyrosulfit ${kontext}. ${herkunft}`,
      }
    }
    const ergebnis = schwefelDosierung(volumen, ph, frei)
    const herkunft = `letzter pH ${formatiereZahl(ph, 2)} · letzter freier SO₂ ${formatiereZahl(frei, 1)} mg/L · ${formatiereZahl(volumen)} L`
    return {
      art,
      ereignisArt: 'schwefeln',
      label: 'Kaliumpyrosulfit',
      stoff: 'Kaliumpyrosulfit',
      einheit: 'g',
      menge: formatiereZahl(ergebnis.kpsGramm.wert),
      herkunft,
      begruendung: `Kaliumpyrosulfit ${kontext}. Menge mit schwefelDosierung(${formatiereZahl(volumen)} L, pH ${formatiereZahl(ph, 2)}, freier SO₂ ${formatiereZahl(frei, 1)} mg/L) berechnet. Vorgeschlagen sind ${formatiereZahl(ergebnis.kpsGramm.wert)} g.`,
    }
  }

  return {
    art,
    ereignisArt: 'sonstiges',
    label: 'Sonstige Zugabe',
    stoff: '',
    einheit: 'g',
    menge: '',
    herkunft: 'Stoff, Menge und Einheit selbst eintragen.',
    begruendung: `Sonstige Zugabe ${kontext}. Menge manuell erfasst.`,
  }
}

export function passendeVorratsZuordnung(
  stand: AppDatenstand,
  art: RundenZugabeArt,
  stoff: string,
  einheit: string,
  menge?: number,
): VorratsZuordnung {
  const festeId = VORRAT_ID_NACH_ART[art]
  const normalisierterStoff = stoff.trim().toLocaleLowerCase('de')
  const posten = festeId
    ? stand.vorrat.find(eintrag => eintrag.id === festeId)
    : stand.vorrat.find(eintrag => eintrag.name.trim().toLocaleLowerCase('de') === normalisierterStoff)
  if (!posten) return { hinweis: 'Vorrat unverändert: Kein passender Vorratsposten gefunden.', warnung: true }
  if (posten.mengeEinheit !== einheit) {
    return {
      hinweis: `Vorrat unverändert: ${posten.name} wird in ${posten.mengeEinheit} geführt, diese Zugabe in ${einheit}.`,
      warnung: true,
    }
  }
  if (menge !== undefined && menge > posten.mengeWert) {
    return {
      posten,
      hinweis: `Vorrat reicht nicht: ${formatiereZahl(menge)} ${einheit} benötigt, ${formatiereZahl(posten.mengeWert)} ${einheit} vorhanden.`,
      warnung: true,
    }
  }
  return {
    posten,
    hinweis: `Vorrat: ${posten.name} wird beim Speichern um die eingetragene Menge vermindert.`,
    warnung: false,
  }
}

export function zugabeArtFuerReminder(reminder: Reminder): RundenZugabeArt | undefined {
  const text = `${reminder.titel} ${reminder.beschreibung}`
  if (/nährsalz|naehrsalz/i.test(text)) return 'naehrsalz'
  if (/haushaltszucker|aufzucker|zuckerzugabe/i.test(text)) return 'aufzuckern'
  if (/kaliumpyrosulfit|\bkps\b|schwefel/i.test(text)) return 'schwefeln'
  return undefined
}

export function faelligeZugabeReminder(
  stand: AppDatenstand,
  charge: Charge,
  jetzt = Date.now(),
): Reminder[] {
  const verfuegbar = new Set(zugabeArtenFuerPhase(charge.phase))
  return stand.reminder.filter(reminder => {
    const art = zugabeArtFuerReminder(reminder)
    return !reminder.erledigt
      && new Date(reminder.faellig).getTime() <= jetzt
      && (!reminder.chargeId || reminder.chargeId === charge.id)
      && art !== undefined
      && verfuegbar.has(art)
  })
}

export function globalerReminderIstFuerAlleChargenErfasst(
  stand: AppDatenstand,
  reminder: Reminder,
  art: RundenZugabeArt,
): boolean {
  const faellig = new Date(reminder.faellig).getTime()
  if (reminder.chargeId) {
    return stand.ereignisse.some(ereignis => ereignis.chargeId === reminder.chargeId
      && ereignis.art === art && new Date(ereignis.zeit).getTime() >= faellig)
  }
  const relevanteChargen = stand.chargen.filter(charge => !charge.archiviert && zugabeArtenFuerPhase(charge.phase).includes(art))
  return relevanteChargen.length > 0 && relevanteChargen.every(charge => stand.ereignisse.some(ereignis => ereignis.chargeId === charge.id
    && ereignis.art === art && new Date(ereignis.zeit).getTime() >= faellig))
}
