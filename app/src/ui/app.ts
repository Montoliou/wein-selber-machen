import {
  AMPEL_LABEL,
  AMPEL_RANG,
  EREIGNIS_LABEL,
  MESS_DEFINITIONEN,
  PHASEN_LABEL,
  PHASEN_REIHE,
  type Ampel,
  type Charge,
  type Ereignis,
  type EreignisArt,
  type Foto,
  type MessDefinition,
  type MessMethode,
  type MessTyp,
  type Messung,
  type Phase,
  type Reminder,
  type SensorKonfig,
  type WikiSeite,
} from '../domain/typen'
import { alkoholPotenzial, naehrsalzPlan, NAEHRSALZ_MAX_G_PRO_100L, NAEHRSALZ_PORTIONEN, oechsleAusSg, sgAusOechsle, schwefelDosierung, zuckerFuerOechsle } from '../domain/oenologie'
import { ampelFuerCharge, befundeFuerCharge, gateFuerPhase, GRENZEN, pressGate, vermischungErlaubt } from '../domain/regeln'
import { kalenderAlsIcs, reminderAlsIcs } from '../ics'
import { alsKlimapunkt, ladeSensorverlauf, ladeSensorwert, pruefeSensorKonfiguration, type SensorVerlaufPunkt } from '../sensor'
import { ersetzeFotos, speichereDatenstand, speichereFoto } from '../speicher/indexeddb'
import {
  aktualisiereEreignisMitVorrat,
  fuegeVolumenPunktHinzu,
  istAppDatenstand,
  loescheEreignisMitVorrat,
  markiereGeaendert,
  merkeLoeschung,
  migriereDatenstand,
  pruefeEreignisseMitVorrat,
  speichereEreignisseMitVorrat,
  summeVorratsabgaenge,
  type AppDatenstand,
} from '../speicher/modell'
import { gleicheMitServerAb } from '../sync'
import { alsCsv, alsMarkdown, alsSicherung, baueZip, fotoAusSicherung, istSicherung, ladeDatei } from './export'
import { dateiname, datetimeLocalWert, datumFormat, datumZeitFormat, formatiereZahl, html, id, isoAusDatetimeLocal, kurzDatumFormat, parseDeZahl, zahlFormat } from './format'
import { icon } from './icons'
import { layoutKlasse, type LayoutKlasse } from './layout'
import {
  faelligeZugabeReminder,
  globalerReminderIstFuerAlleChargenErfasst,
  passendeVorratsZuordnung,
  zugabeArtFuerReminder,
  zugabeArtenFuerPhase,
  zugabeVorschlag,
  type RundenZugabeArt,
} from './runden-zugaben'

declare const __BUILD_TIMESTAMP__: string
declare const __BUILD_COMMIT__: string

type Ansicht = 'heute' | 'runde' | 'journal' | 'charge' | 'erfassen' | 'messung-bearbeiten' | 'ereignis-bearbeiten' | 'rechner' | 'gate' | 'termine' | 'wiki' | 'wiki-seite' | 'wiki-editor' | 'mehr' | 'umverteilen'
type ChargeTab = 'befunde' | 'messungen' | 'ereignisse' | 'gefaess' | 'fotos'
type RechnerTyp = 'schwefeln' | 'aufzuckern' | 'naehrsalz'
type ErfassenModus = 'messung' | 'ereignis'
type MessErfassungModus = 'charge' | 'messgroesse'
type DesktopKurveTyp = 'gaerung' | 'temperatur' | 'kellerklima'
type DesktopZeitraum = 'sieben-tage' | 'gaerung' | 'alles'

interface MessEntwurf {
  eingabe: string
  methode: MessMethode
}

interface MessRundeErfolg {
  chargeId: string
  typen: MessTyp[]
}

interface RundenZugabeEntwurf {
  aktiv: boolean
  menge: string
  einheit: string
  stoff: string
  begruendung: string
  begruendungAutomatisch: boolean
}

interface RundenEntwurf {
  messwerte: Partial<Record<MessTyp, MessEntwurf>>
  untergestossen: boolean
  zugaben: Partial<Record<RundenZugabeArt, RundenZugabeEntwurf>>
}

interface ReminderVorher {
  reminderId: string
  erledigt: boolean
  faellig: string
}

interface RundenSpeicherung {
  chargeId: string
  zeit: string
  typen: MessTyp[]
  messungIds: string[]
  ereignisIds: string[]
  reminderAenderungen: ReminderVorher[]
  ampelVorher: Ampel
  ampelNachher: Ampel
  volumenVorher: {
    fuellLiter?: number
    kopfraumLiter?: number
    volumenHistorie: NonNullable<Charge['volumenHistorie']>
  }
}

const DICHTE_TYPEN: MessTyp[] = ['oechsle', 'sg', 'brix']
const DICHTE_KURVEN_TYPEN: MessTyp[] = ['oechsle', 'sg']
const CHARGEN_FARBEN = ['#d44e69', '#e79a68', '#d8b86e', '#91a6d3', '#70b5a0', '#bf86d6']
const RUNDEN_PRIMAER: Partial<Record<Phase, MessTyp[]>> = {
  KALTMAZERATION: ['temperatur', 'geruch', 'gaeraktivitaet'],
  AKTIVE_GAERUNG: ['temperatur', 'oechsle', 'geruch', 'gaeraktivitaet'],
  PRESS_GATE: ['temperatur', 'oechsle', 'geruch', 'gaeraktivitaet'],
  NACHGAERUNG: ['temperatur', 'oechsle', 'geruch', 'gaeraktivitaet'],
  GAERENDE_GATE: ['temperatur', 'oechsle', 'geruch', 'gaeraktivitaet'],
  ERSTER_ABSTICH: ['oberflaeche', 'geruch', 'kopfraum', 'volumen'],
  AUSBAU: ['oberflaeche', 'geruch', 'kopfraum', 'volumen'],
  STABILITAETS_GATE: ['oberflaeche', 'geruch', 'kopfraum', 'volumen'],
  SUESSE_GATE: ['oberflaeche', 'geruch', 'kopfraum', 'volumen'],
  ABFUELL_GATE: ['oberflaeche', 'geruch', 'kopfraum', 'volumen'],
}
const ZUGABE_ARTEN: EreignisArt[] = ['schwefeln', 'aufzuckern', 'naehrsalz', 'hefe', 'suessen', 'stabilisieren']
const VOLUMEN_EREIGNIS_ARTEN: EreignisArt[] = ['pressen', 'abstich', 'umfuellen', 'auffuellen']
const VORRAT_NACH_ART: Partial<Record<EreignisArt, string>> = {
  schwefeln: 'vorrat-kps', aufzuckern: 'vorrat-zucker', naehrsalz: 'vorrat-naehrsalz', hefe: 'vorrat-hefe',
}
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const BUILD_ZEIT_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

const PHASEN_MESS_TYPEN: Partial<Record<Phase, MessTyp[]>> = {
  KALTMAZERATION: ['temperatur', 'geruch', 'gaeraktivitaet'],
  AKTIVE_GAERUNG: ['temperatur', 'oechsle', 'geruch', 'gaeraktivitaet'],
  NACHGAERUNG: ['temperatur', 'oechsle', 'geruch', 'gaeraktivitaet'],
  AUSBAU: ['ph', 'so2_frei', 'kopfraum', 'oberflaeche', 'geruch', 'geschmack'],
  STABILITAETS_GATE: ['ph', 'so2_frei', 'kopfraum', 'oberflaeche', 'geruch', 'geschmack'],
  SUESSE_GATE: ['ph', 'so2_frei', 'kopfraum', 'oberflaeche', 'geruch', 'geschmack'],
  ABFUELL_GATE: ['ph', 'so2_frei', 'kopfraum', 'oberflaeche', 'geruch', 'geschmack'],
}

export function erhalteMessChargenAuswahl(ausgewaehlt: string[], aktiveChargeIds: string[]): string[] {
  const aktiv = new Set(aktiveChargeIds)
  return [...new Set(ausgewaehlt)].filter(chargeId => aktiv.has(chargeId))
}

const PHASEN_FUEHRUNG: Record<Phase, { beschreibung: string; aufgabe: string }> = {
  ERNTE: { beschreibung: 'Die Trauben kommen aus dem Weinberg.', aufgabe: 'Gewicht und Lesezeit dokumentieren.' },
  SORTIEREN: { beschreibung: 'Du entfernst beschädigte und unreife Trauben.', aufgabe: 'Ausschuss getrennt wiegen und festhalten.' },
  ENTRAPPEN: { beschreibung: 'Du trennst Beeren und Stiele.', aufgabe: 'Die Menge der entrappten Maische erfassen.' },
  MOSTANALYSE: { beschreibung: 'Die ersten Messwerte bestimmen den Ausbauplan.', aufgabe: 'Mostgewicht, Temperatur und pH messen.' },
  KALTMAZERATION: { beschreibung: 'Die kühle Maische löst Farbe und Aroma aus den Schalen.', aufgabe: 'Täglich Temperatur, Geruch und Oberfläche prüfen.' },
  ANSTELLEN: { beschreibung: 'Die Reinzuchthefe wird auf die Maische verteilt.', aufgabe: 'Temperatur angleichen und jede Zugabe protokollieren.' },
  AKTIVE_GAERUNG: { beschreibung: 'Die Hefe verwandelt Zucker in Alkohol und Kohlensäure.', aufgabe: `Hut unterstoßen, Temperatur unter ${GRENZEN.gaertemperaturRotMax} °C halten und Dichte verfolgen.` },
  PRESS_GATE: { beschreibung: 'Die Messwerte entscheiden, ob die Maische gepresst werden darf.', aufgabe: 'Dichte mit der Spindel messen und das Gate vollständig prüfen.' },
  NACHGAERUNG: { beschreibung: 'Vorlauf und Presswein gären in ihren Gefäßen weiter.', aufgabe: 'Dichte verfolgen und jeden Behälter mit seinem Füllvolumen erfassen.' },
  GAERENDE_GATE: { beschreibung: 'Zwei Spindelmessungen müssen das Gärende bestätigen.', aufgabe: 'Im Abstand von mindestens 48 Stunden messen und das Gate prüfen.' },
  ERSTER_ABSTICH: { beschreibung: 'Du trennst den Wein vom groben Hefedepot.', aufgabe: 'Füllvolumen, Kopfraum und Zielgefäß beim Abstich erfassen.' },
  AUSBAU: { beschreibung: 'Der Wein reift geschützt im möglichst vollen Gefäß.', aufgabe: 'Kopfraum, Oberfläche, Geruch und Temperatur regelmäßig prüfen.' },
  STABILITAETS_GATE: { beschreibung: 'Die Messwerte zeigen, ob der Wein stabil genug ist.', aufgabe: 'pH, freien SO₂ und Restzucker prüfen.' },
  SUESSE_GATE: { beschreibung: 'Vor einer Süßung muss die mikrobiologische Stabilität feststehen.', aufgabe: 'Nur mit bestandenem Gate fortfahren.' },
  ABFUELL_GATE: { beschreibung: 'Die letzte Prüfung schützt vor einer erneuten Flaschengärung.', aufgabe: 'Dichte, Restzucker, Oberfläche und Kopfraum prüfen.' },
  FLASCHE: { beschreibung: 'Der Wein ist abgefüllt und entwickelt sich in der Flasche.', aufgabe: 'Abfülldatum und Flaschenbestand dokumentieren.' },
}

const ZEITSTRAHL_MARKEN: Array<{ phase: Phase; label: string }> = [
  { phase: 'ERNTE', label: 'Ernte' },
  { phase: 'KALTMAZERATION', label: 'Mazer.' },
  { phase: 'ANSTELLEN', label: 'Anstellen' },
  { phase: 'AKTIVE_GAERUNG', label: 'Gärung' },
  { phase: 'PRESS_GATE', label: 'Presse' },
  { phase: 'ERSTER_ABSTICH', label: 'Abstich' },
  { phase: 'AUSBAU', label: 'Ausbau' },
  { phase: 'FLASCHE', label: 'Flasche' },
]

interface UiZustand {
  ansicht: Ansicht
  chargeId: string
  chargeTab: ChargeTab
  erfassenModus: ErfassenModus
  messErfassungModus: MessErfassungModus
  messTyp: MessTyp
  messChargeIds: string[]
  messEntwuerfe: Partial<Record<MessTyp, MessEntwurf>>
  messZeit: string
  messNotiz: string
  messRundeErfolg: MessRundeErfolg | null
  editMessungId: string | null
  editEreignisId: string | null
  rechnerTyp: RechnerTyp
  wikiId: string | null
  wikiFilter: string
  wikiTag: string | null
  rundenChargeIds: string[]
  rundenIndex: number
  rundenZeit: string
  rundenEntwuerfe: Record<string, RundenEntwurf>
  rundenErgebnisse: RundenSpeicherung[]
  rundenGespeichert: RundenSpeicherung | null
  rundenUndoBis: number | null
  rundenAbgeschlossen: boolean
  zuckerZielJeCharge: Record<string, number>
  gateCheckIndex: number
  desktopKurveTyp: DesktopKurveTyp
  desktopZeitraum: DesktopZeitraum
  updateVerfuegbar: boolean
  status: { art: 'erfolg' | 'fehler'; text: string } | null
}

export class WeinbegleiterApp {
  private readonly root: HTMLElement
  private stand: AppDatenstand
  private fotos: Foto[]
  private ui: UiZustand
  private layout: LayoutKlasse
  private fotoUrls: string[] = []
  private sensorVerlauf: SensorVerlaufPunkt[] = []
  private syncLaeuft = false
  private syncErneut = false
  private syncFehler = navigator.onLine === false
  private rundenTouchStart: { x: number; y: number; interaktiv: boolean } | null = null
  private rundenUndoTimer: number | undefined

  constructor(root: HTMLElement, stand: AppDatenstand, fotos: Foto[]) {
    this.root = root
    this.stand = stand
    this.fotos = fotos
    this.layout = layoutKlasse(window.innerWidth)
    this.root.dataset.layout = this.layout
    const ersteAktiveChargeId = stand.chargen.find(charge => !charge.archiviert)?.id ?? ''
    this.ui = {
      ansicht: 'heute',
      chargeId: ersteAktiveChargeId,
      chargeTab: 'befunde',
      erfassenModus: 'messung',
      messErfassungModus: 'charge',
      messTyp: 'temperatur',
      messChargeIds: ersteAktiveChargeId ? [ersteAktiveChargeId] : [],
      messEntwuerfe: {},
      messZeit: datetimeLocalWert(),
      messNotiz: '',
      messRundeErfolg: null,
      editMessungId: null,
      editEreignisId: null,
      rechnerTyp: 'schwefeln',
      wikiId: null,
      wikiFilter: '',
      wikiTag: null,
      rundenChargeIds: [],
      rundenIndex: 0,
      rundenZeit: datetimeLocalWert(),
      rundenEntwuerfe: {},
      rundenErgebnisse: [],
      rundenGespeichert: null,
      rundenUndoBis: null,
      rundenAbgeschlossen: false,
      zuckerZielJeCharge: {},
      gateCheckIndex: 0,
      desktopKurveTyp: 'gaerung',
      desktopZeitraum: 'gaerung',
      updateVerfuegbar: false,
      status: null,
    }
    this.root.addEventListener('click', event => void this.behandleKlick(event))
    this.root.addEventListener('submit', event => void this.behandleSubmit(event))
    this.root.addEventListener('change', event => void this.behandleAenderung(event))
    this.root.addEventListener('input', event => this.behandleEingabe(event))
    this.root.addEventListener('keydown', event => this.behandleTaste(event))
    this.root.addEventListener('touchstart', event => this.beginneRundenWischen(event), { passive: true })
    this.root.addEventListener('touchend', event => this.beendeRundenWischen(event), { passive: true })
    window.addEventListener('resize', () => this.aktualisiereLayout())
    window.addEventListener('popstate', event => {
      const route = event.state as { weinbegleiter?: boolean; ui?: Partial<UiZustand> } | null
      if (!route?.weinbegleiter || !route.ui) return
      this.ui = { ...this.ui, ...route.ui, status: this.ui.status }
      this.render()
    })
    window.addEventListener('online', () => { this.syncFehler = false; void this.aktualisiereAbgleichBeimStart() })
    window.addEventListener('offline', () => { this.syncFehler = true; if (this.ui.ansicht === 'mehr') this.render() })
  }

  start(): void {
    this.uebernehmeTiefenLink()
    this.schreibeHistory(true)
    this.render()
  }

  zeigeUpdateHinweis(): void {
    if (this.ui.updateVerfuegbar) return
    this.ui.updateVerfuegbar = true
    this.render()
  }

  async aktualisiereAbgleichBeimStart(): Promise<void> {
    await this.starteAbgleich()
  }

  async aktualisiereSensorBeimStart(): Promise<void> {
    const konfig = this.stand.sensor
    if (!konfig.aktiv || navigator.onLine === false || pruefeSensorKonfiguration(konfig)) return
    const [messwert, verlauf] = await Promise.allSettled([
      ladeSensorwert(konfig),
      ladeSensorverlauf(konfig),
    ])
    if (messwert.status === 'fulfilled') {
      this.stand.klima.push(alsKlimapunkt(messwert.value, 'sensor'))
      try {
        await this.speichereLokalUndStarteAbgleich()
      } catch (fehler) {
        console.warn('Automatischer Sensorwert konnte nicht gespeichert werden.', fehler)
      }
    }
    if (verlauf.status === 'fulfilled') this.sensorVerlauf = verlauf.value
    if (messwert.status === 'fulfilled' || verlauf.status === 'fulfilled') this.render()
  }

  private aktualisiereLayout(): void {
    const naechste = layoutKlasse(window.innerWidth)
    if (naechste === this.layout) return
    this.layout = naechste
    this.root.dataset.layout = naechste
    this.render()
  }

  private uebernehmeTiefenLink(): void {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''))
    if (!hash) return
    const [ziel, kennung] = hash.split('/')
    if (ziel === 'runde') {
      this.bereiteRundeVor(kennung)
      return
    }
    if ((ziel === 'charge' || ziel === 'gate') && kennung && this.stand.chargen.some(charge => charge.id === kennung)) {
      this.ui.chargeId = kennung
      this.ui.ansicht = ziel
      return
    }
    if (['heute', 'journal', 'termine', 'wiki', 'mehr'].includes(ziel ?? '')) this.ui.ansicht = ziel as Ansicht
  }

  private routeHash(): string {
    if (this.ui.ansicht === 'charge' || this.ui.ansicht === 'gate') return `${this.ui.ansicht}/${this.ui.chargeId}`
    if (this.ui.ansicht === 'runde') return 'runde'
    return this.ui.ansicht
  }

  private aktiveChargen(): Charge[] {
    return this.stand.chargen.filter(charge => !charge.archiviert)
  }

  private aktuelleCharge(): Charge | undefined {
    return this.stand.chargen.find(charge => charge.id === this.ui.chargeId)
  }

  private render(): void {
    this.fotoUrls.forEach(url => URL.revokeObjectURL(url))
    this.fotoUrls = []
    this.root.dataset.layout = this.layout
    this.root.dataset.ansicht = this.ui.ansicht
    const istRunde = this.ui.ansicht === 'runde'
    const inhalt = this.layout === 'schreibtisch' && !istRunde
      ? `<a class="skip-link" href="#hauptinhalt">Zum Inhalt</a><div class="desktop-shell ${this.ui.ansicht === 'heute' ? 'desktop-heute' : ''}">${this.renderDesktopSidebar()}<main id="hauptinhalt" class="desktop-mitte" tabindex="-1">${this.ui.ansicht === 'heute' ? this.renderDesktopMitte() : this.renderSeite()}</main>${this.ui.ansicht === 'heute' ? this.renderDesktopDetail() : ''}</div>`
      : `${istRunde ? '' : this.renderHeader()}<main id="hauptinhalt" class="${istRunde ? 'runden-main' : ''}" tabindex="-1">${this.renderSeite()}</main>${istRunde ? '' : this.renderNavigation()}`
    this.root.innerHTML = `${inhalt}${this.renderUpdateHinweis()}${this.renderStatus()}`
    if (this.ui.ansicht === 'rechner') this.aktualisiereRechner()
    if (this.ui.ansicht === 'erfassen') this.aktualisiereErfassenFormular()
    if (this.ui.ansicht === 'umverteilen') this.aktualisiereZielzeilen()
  }

  private renderHeader(): string {
    return `<a class="skip-link" href="#hauptinhalt">Zum Inhalt</a><header class="app-header"><div class="header-inhalt"><div class="logo">${icon('traube')}</div><div><div class="app-titel">Weinbegleiter</div><div class="app-subtitel">Jahrgang ${this.stand.jahrgang} · Rotwein</div></div><div class="stand">${datumFormat.format(new Date())}<br>${this.aktiveChargen().length} Chargen</div></div></header>`
  }

  private renderNavigation(): string {
    const basis: Array<{ ansicht: Ansicht; label: string; bild: Parameters<typeof icon>[0] }> = [
      { ansicht: 'heute', label: 'Heute', bild: 'traube' },
      { ansicht: 'runde', label: 'Runde', bild: 'runde' },
      { ansicht: 'termine', label: 'Termine', bild: 'kalender' },
      { ansicht: 'mehr', label: 'Mehr', bild: 'mehr' },
    ]
    const aktiv = this.hauptAnsicht()
    return `<nav class="bottom-nav" aria-label="Hauptnavigation">${basis.map(eintrag => `<button class="nav-knopf ${aktiv === eintrag.ansicht ? 'aktiv' : ''}" type="button" data-action="${eintrag.ansicht === 'runde' ? 'runde-start' : 'nav'}" data-view="${eintrag.ansicht}" ${aktiv === eintrag.ansicht ? 'aria-current="page"' : ''}>${icon(eintrag.bild)}<span>${eintrag.label}</span></button>`).join('')}</nav>`
  }

  private hauptAnsicht(): Ansicht {
    if (['charge', 'erfassen', 'messung-bearbeiten', 'ereignis-bearbeiten', 'rechner', 'gate', 'umverteilen'].includes(this.ui.ansicht)) return 'heute'
    if (['wiki-seite', 'wiki-editor'].includes(this.ui.ansicht)) return 'wiki'
    return this.ui.ansicht
  }

  private renderStatus(): string {
    if (!this.ui.status) return ''
    const titel = this.ui.status.art === 'erfolg' ? 'Gespeichert' : 'Fehler'
    return `<div class="statusmeldung meldung ${this.ui.status.art === 'erfolg' ? 'erfolg' : 'fehler'}" role="${this.ui.status.art === 'erfolg' ? 'status' : 'alert'}" aria-live="${this.ui.status.art === 'erfolg' ? 'polite' : 'assertive'}"><div class="meldung-text"><strong>${titel}</strong><span>${html(this.ui.status.text)}</span></div><button class="meldung-schliessen" type="button" data-action="status-schliessen" aria-label="Meldung schließen">×</button></div>`
  }

  private renderUpdateHinweis(): string {
    if (!this.ui.updateVerfuegbar) return ''
    return `<div class="update-hinweis" role="status" aria-live="polite"><strong>Neue Fassung verfügbar</strong><button class="btn btn-haupt btn-klein" type="button" data-action="update-laden">Jetzt aktualisieren</button></div>`
  }

  private renderSeite(): string {
    switch (this.ui.ansicht) {
      case 'heute': return this.renderHeute()
      case 'runde': return this.renderRunde()
      case 'journal': return this.renderJournal()
      case 'charge': return this.renderCharge()
      case 'erfassen': return this.renderErfassen()
      case 'messung-bearbeiten': return this.renderMessungBearbeiten()
      case 'ereignis-bearbeiten': return this.renderEreignisBearbeiten()
      case 'rechner': return this.renderRechner()
      case 'gate': return this.renderGate()
      case 'termine': return this.renderTermine()
      case 'wiki': return this.renderWiki()
      case 'wiki-seite': return this.renderWikiSeite()
      case 'wiki-editor': return this.renderWikiEditor()
      case 'mehr': return this.renderMehr()
      case 'umverteilen': return this.renderUmverteilen()
    }
  }

  private renderHeute(): string {
    const offeneReminder = this.stand.reminder.filter(reminder => !reminder.erledigt).sort((a, b) => a.faellig.localeCompare(b.faellig))
    const faelligeReminder = offeneReminder.filter(reminder => new Date(reminder.faellig).getTime() <= Date.now())
    const naechster = offeneReminder[0]
    const klima = [...this.stand.klima].sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
    const leitCharge = this.aktiveChargen().sort((a, b) => PHASEN_REIHE.indexOf(b.phase) - PHASEN_REIHE.indexOf(a.phase))[0]
    const rundeFaellig = this.istRundeFaellig()
    return `<section class="seite heute-seite" aria-labelledby="heute-titel"><h1 class="sr-only" id="heute-titel">Heute</h1>
      <div class="heute-links">${this.renderStatusband(faelligeReminder.length, klima)}${this.renderGaerkurve(this.aktiveChargen(), 'Gärverlauf aller Chargen')}${leitCharge ? `<h2>Wo der Jahrgang steht</h2><div class="karte">${this.renderZeitstrahl(leitCharge)}</div>` : ''}</div>
      <div class="heute-rechts"><h2>Jetzt dran</h2>
      ${rundeFaellig ? `<div class="karte karte-akzent runden-einstieg"><div class="aktion">${this.renderTresterhut()}<div><strong class="aktion-titel">Runde fällig</strong><div class="aktion-text">${this.aktiveChargen().length} Gefäße · phasengerechte Kontrolle · zuletzt ${html(this.letzteRundenErfassungText())}</div></div></div><button class="btn btn-haupt" type="button" data-action="runde-start">Runde starten</button></div>` : naechster ? `<div class="karte"><button class="aktion aktion-knopf" type="button" data-action="reminder-oeffnen" data-id="${html(naechster.id)}">${naechster.titel.toLocaleLowerCase('de').includes('tresterhut') ? this.renderTresterhut() : icon('kalender')}<span><strong class="aktion-titel">${html(naechster.titel)}</strong><span class="aktion-text">Fällig: ${datumZeitFormat.format(new Date(naechster.faellig))}</span></span></button>${this.renderErklaerschublade('Warum das wichtig ist', naechster.beschreibung)}</div>` : '<div class="karte leer">Keine offenen Aufgaben.</div>'}
      ${this.renderKlimaKarte(klima)}
      <h2>Chargen</h2><div class="karte chargenliste">${this.aktiveChargen().map(charge => this.renderChargenZeile(charge)).join('') || '<div class="leer">Keine aktive Charge.</div>'}</div>
      <h2>Fällig</h2><div class="karte faellig-liste">${offeneReminder.length ? offeneReminder.map(reminder => this.renderFaelligeZeile(reminder)).join('') : '<div class="leer">Keine offenen Aufgaben.</div>'}</div>
      <h2>Weitere Erfassung</h2><div class="balken-actions"><button class="btn" type="button" data-action="erfassen">${icon('messung', 'icon-klein')} Einzelmessung</button><button class="btn" type="button" data-action="messwert-alle">Ein Wert für alle</button><button class="btn" type="button" data-action="nav" data-view="umverteilen">Umverteilen</button></div>
      <h2>Vorrat</h2><div class="karte">${this.stand.vorrat.map(posten => `<div class="vorratsposten"><div class="zeile"><span>${html(posten.name)}</span><b>${zahlFormat.format(posten.mengeWert)} ${html(posten.mengeEinheit)}</b></div><div class="hint">Abgänge: ${zahlFormat.format(summeVorratsabgaenge(this.stand, posten.id))} ${html(posten.mengeEinheit)}</div>${posten.notiz ? `<div class="hint">${html(posten.notiz)}</div>` : ''}</div>`).join('')}</div></div>
    </section>`
  }

  private renderStatusband(offeneAufgaben: number, klima = [...this.stand.klima].sort((a, b) => b.zeit.localeCompare(a.zeit))[0]): string {
    const chargen = this.aktiveChargen()
    const ampel = chargen.map(charge => ampelFuerCharge(this.stand, charge)).sort((a, b) => AMPEL_RANG[b] - AMPEL_RANG[a])[0] ?? 'GREEN'
    const ampelKurz: Record<Ampel, string> = { GREEN: 'grün', YELLOW: 'gelb', ORANGE: 'orange', RED: 'rot' }
    const leitCharge = chargen.sort((a, b) => PHASEN_REIHE.indexOf(b.phase) - PHASEN_REIHE.indexOf(a.phase))[0]
    const tag = leitCharge ? this.tagDerPhase(leitCharge) : null
    return `<div class="statusband" aria-label="Jahrgangsstatus"><div class="statuswert"><strong>${chargen.length}</strong><span>Chargen</span></div><div class="statuswert status-${ampel.toLowerCase()}"><strong>${ampelKurz[ampel]}</strong><span>Ampel</span></div><div class="statuswert"><strong>${tag === null ? '–' : `Tag ${tag}`}</strong><span>${leitCharge ? html(this.phaseKurz(leitCharge.phase)) : 'Phase'}</span></div><div class="statuswert ${offeneAufgaben ? 'status-offen' : ''}"><strong>${offeneAufgaben}</strong><span>fällig</span></div><div class="statuswert"><strong>${klima ? `${formatiereZahl(klima.temperatur)}°` : '–'}</strong><span>Keller</span></div><div class="statuswert status-feuchte"><strong>${klima?.feuchte === undefined ? '–' : `${formatiereZahl(klima.feuchte, 0)} %`}</strong><span>Feuchte</span></div></div>`
  }

  /**
   * Kurzform der Phasenbezeichnung fuer das Statusband. Die Spalte ist schmal,
   * "Aktive Gärung" wurde dort zu "AKTIVE GÄR…" abgeschnitten. Im Zwei-Sekunden-Blick
   * darf nichts abgeschnitten sein — er ist der Zweck des Bandes.
   */
  private phaseKurz(phase: Charge['phase']): string {
    const kurzform: Partial<Record<Charge['phase'], string>> = {
      MOSTANALYSE: 'Analyse', KALTMAZERATION: 'Mazeration', AKTIVE_GAERUNG: 'Gärung',
      PRESS_GATE: 'Press-Gate', NACHGAERUNG: 'Nachgärung', GAERENDE_GATE: 'Gärende',
      ERSTER_ABSTICH: 'Abstich', STABILITAETS_GATE: 'Stabilität',
      SUESSE_GATE: 'Süße', ABFUELL_GATE: 'Abfüllen',
    }
    return kurzform[phase] ?? PHASEN_LABEL[phase]
  }

  private tagDerPhase(charge: Charge): number {
    const differenz = Date.now() - new Date(charge.phaseSeit ?? charge.startdatum).getTime()
    return Math.max(1, Math.floor(differenz / 86_400_000) + 1)
  }

  private letzteErfassungInAktiverPhase(charge: Charge): string | undefined {
    const phaseSeit = new Date(charge.phaseSeit ?? charge.startdatum).getTime()
    return [...this.stand.messungen, ...this.stand.ereignisse]
      .filter(eintrag => eintrag.chargeId === charge.id && new Date(eintrag.zeit).getTime() >= phaseSeit)
      .map(eintrag => eintrag.zeit)
      .sort()
      .at(-1)
  }

  private istRundeFaellig(): boolean {
    const jetzt = Date.now()
    const wiederholungFaellig = this.stand.reminder.some(reminder => !reminder.erledigt
      && reminder.wiederholungTage !== undefined
      && new Date(reminder.faellig).getTime() <= jetzt)
    if (wiederholungFaellig) return true
    return this.aktiveChargen().some(charge => {
      const letzte = this.letzteErfassungInAktiverPhase(charge)
      return !letzte || jetzt - new Date(letzte).getTime() >= 12 * 60 * 60 * 1000
    })
  }

  private letzteRundenErfassungText(): string {
    const zeiten = this.aktiveChargen().map(charge => this.letzteErfassungInAktiverPhase(charge)).filter((zeit): zeit is string => Boolean(zeit)).sort()
    return zeiten.length ? datumZeitFormat.format(new Date(zeiten.at(-1)!)) : 'noch nie'
  }

  private reminderVerlangtRunde(reminder: Reminder): boolean {
    if (reminder.wiederholungTage !== undefined) return true
    return /kontroll|runde|tresterhut|untersto|oberfl|geruch|temperatur|dichte|mostgewicht/i.test(`${reminder.titel} ${reminder.beschreibung}`)
  }

  private aktuelleBatterie(): number | undefined {
    return this.sensorVerlauf.at(-1)?.batterie
      ?? [...this.stand.klima].filter(punkt => punkt.quelle === 'sensor' && punkt.batterie !== undefined).sort((a, b) => a.zeit.localeCompare(b.zeit)).at(-1)?.batterie
  }

  private renderKlimaKarte(klima: AppDatenstand['klima'][number] | undefined): string {
    const batterie = this.aktuelleBatterie()
    return `<h2>Kellerklima</h2><div class="karte klima-karte"><div class="klima-grid"><div class="klima-wert"><small>Temperatur</small><strong>${klima ? `${formatiereZahl(klima.temperatur)} °C` : '–'}</strong><span>${klima ? `${klima.quelle === 'sensor' ? 'Sensor' : 'Manuell'} · ${datumZeitFormat.format(new Date(klima.zeit))}` : 'Noch kein Wert'}</span></div><div class="klima-wert"><small>Feuchte</small><strong>${klima?.feuchte === undefined ? '–' : `${formatiereZahl(klima.feuchte, 0)} %`}</strong><span>${batterie === undefined ? 'Batterie unbekannt' : `Batterie ${formatiereZahl(batterie, 0)} %`}</span></div></div>${this.renderBatteriewarnung()}${this.renderKellerkurve()}</div>`
  }

  private dichteInOechsle(messung: Messung | undefined): number | undefined {
    if (!messung || messung.wert === null) return undefined
    return messung.typ === 'sg' ? oechsleAusSg(messung.wert) : messung.wert
  }

  private renderChargenZeile(charge: Charge): string {
    const ampel = ampelFuerCharge(this.stand, charge)
    const temperatur = this.letzteMessung(charge.id, 'temperatur')
    const dichten = this.stand.messungen.filter(messung => messung.chargeId === charge.id && DICHTE_KURVEN_TYPEN.includes(messung.typ) && messung.methode !== 'refraktometer').sort((a, b) => a.zeit.localeCompare(b.zeit))
    const ersteDichte = this.dichteInOechsle(dichten[0])
    const letzteDichte = this.dichteInOechsle(dichten.at(-1))
    const delta = ersteDichte !== undefined && letzteDichte !== undefined ? letzteDichte - ersteDichte : undefined
    return `<button class="chargen-zeile" type="button" data-action="charge" data-id="${html(charge.id)}"><span class="listen-ampel ampel-${ampel.toLowerCase()}" aria-label="${html(AMPEL_LABEL[ampel])}"></span><span class="chargen-zeile-name"><strong>${html(charge.name)}</strong><small>${charge.mengeKg === undefined ? 'Menge offen' : `${formatiereZahl(charge.mengeKg)} kg`}</small></span><span class="chargen-zeile-wert"><strong>${letzteDichte === undefined ? '–' : formatiereZahl(letzteDichte, 0)}</strong><small>°Oe</small></span><span class="chargen-zeile-wert"><strong>${temperatur?.wert === null || temperatur?.wert === undefined ? '–' : formatiereZahl(temperatur.wert)}</strong><small>°C</small></span><span class="chargen-trend">${delta === undefined ? '–' : `${delta <= 0 ? '↓' : '↑'}${formatiereZahl(Math.abs(delta), 0)}`}<small>seit Start</small></span></button>`
  }

  private renderFaelligeZeile(reminder: Reminder): string {
    const faellig = new Date(reminder.faellig).getTime() <= Date.now()
    return `<button class="faellig-zeile" type="button" data-action="reminder-oeffnen" data-id="${html(reminder.id)}"><strong>${faellig ? 'heute' : kurzDatumFormat.format(new Date(reminder.faellig))}</strong><span>${html(reminder.titel)}</span></button>`
  }

  private renderTresterhut(): string {
    return '<div class="tresterhut" aria-hidden="true"><i class="trester-fluessigkeit"></i><i class="trester-kappe"></i><i class="trester-blase blase-1"></i><i class="trester-blase blase-2"></i><i class="trester-blase blase-3"></i></div>'
  }

  private renderErklaerschublade(titel: string, inhalt: string): string {
    return `<details class="erklaer"><summary><span class="erklaer-pfeil" aria-hidden="true">›</span>${html(titel)}</summary><div class="erklaer-inhalt">${html(inhalt)}</div></details>`
  }

  private dichteAlsSg(messung: Messung): number | null {
    if (messung.wert === null) return null
    if (messung.typ === 'sg') return messung.wert
    if (messung.typ === 'oechsle') return sgAusOechsle(messung.wert)
    if (messung.typ === 'brix') return sgAusOechsle(messung.wert * 4.25)
    return null
  }

  private renderGaerkurve(chargen: Charge[], titel: string, untergrenze = Number.NEGATIVE_INFINITY, abGaerstart = true): string {
    const serien = chargen.map((charge, index) => {
      const gaerstart = this.stand.ereignisse.filter(ereignis => ereignis.chargeId === charge.id && ereignis.art === 'anstellen').sort((a, b) => b.zeit.localeCompare(a.zeit))[0]?.zeit ?? charge.startdatum
      const punkte = this.stand.messungen
        .filter(messung => messung.chargeId === charge.id && DICHTE_KURVEN_TYPEN.includes(messung.typ) && messung.methode !== 'refraktometer' && new Date(messung.zeit).getTime() >= Math.max(abGaerstart ? new Date(gaerstart).getTime() : Number.NEGATIVE_INFINITY, untergrenze))
        .flatMap(messung => { const sg = this.dichteAlsSg(messung); return sg === null ? [] : [{ zeit: messung.zeit, sg }] })
        .sort((a, b) => a.zeit.localeCompare(b.zeit))
      return { charge, punkte, farbe: CHARGEN_FARBEN[index % CHARGEN_FARBEN.length]! }
    }).filter(serie => serie.punkte.length)
    const allePunkte = serien.flatMap(serie => serie.punkte)
    const pressFrage = chargen[0] ? pressGate(this.stand, chargen[0]).checks.find(check => check.id === 'press-restzucker')?.frage : undefined
    const pressTreffer = /SG\s*≤\s*([\d,.]+)/.exec(pressFrage ?? '')
    const pressGrenze = Number((pressTreffer?.[1] ?? '').replace(',', '.'))
    if (!Number.isFinite(pressGrenze)) return `<div class="kurve-karte"><div class="kurve-kopf"><h3>${html(titel)}</h3></div><div class="kurve-hinweis">Das Pressfenster konnte nicht aus dem Press-Gate gelesen werden.</div></div>`
    const pressGrenzeText = formatiereZahl(pressGrenze, 3)
    const erklaerung = `Die durchgezogene Linie zeigt deine Spindelwerte. Die gestrichelte Linie zeigt den erwarteten Verlauf. Das grüne Band beginnt bei SG ${pressGrenzeText}. Dort prüfst du das Press-Gate. Wird die gemessene Linie deutlich flacher, prüfst du Temperatur und Hefenährsalz.`
    if (!allePunkte.length) return `<div class="kurve-karte"><div class="kurve-kopf"><h3>${html(titel)}</h3></div><div class="kurve-hinweis">Noch keine Spindelwerte seit dem Anstellen.</div>${this.renderErklaerschublade('Worauf du bei der Kurve achtest', erklaerung)}</div>`

    const breite = 640
    const links = 44
    const rechts = 624
    const oben = 26
    const unten = 286
    const startMs = Math.min(...allePunkte.map(punkt => new Date(punkt.zeit).getTime()))
    const letzterMs = Math.max(...allePunkte.map(punkt => new Date(punkt.zeit).getTime()))
    const reminderDatum = this.stand.reminder.filter(reminder => !reminder.erledigt && reminder.regelId === 'PRESS_GATE').sort((a, b) => a.faellig.localeCompare(b.faellig))[0]?.faellig
    const pressDatumMs = reminderDatum ? new Date(reminderDatum).getTime() : startMs + 6 * 86_400_000
    const endeMs = Math.max(letzterMs, pressDatumMs, startMs + 7 * 86_400_000)
    const maxSg = Math.max(1.09, ...allePunkte.map(punkt => punkt.sg))
    const minSg = 0.99
    const x = (zeit: string | number) => links + (((typeof zeit === 'number' ? zeit : new Date(zeit).getTime()) - startMs) / Math.max(1, endeMs - startMs)) * (rechts - links)
    const y = (sg: number) => oben + ((maxSg - sg) / (maxSg - minSg)) * (unten - oben)
    const startSg = serien.reduce((summe, serie) => summe + serie.punkte[0]!.sg, 0) / serien.length
    const erwartetPfad = `M${x(startMs).toFixed(1)},${y(startSg).toFixed(1)} L${x(pressDatumMs).toFixed(1)},${y(pressGrenze).toFixed(1)}`
    const pressY = y(pressGrenze)
    const tabellenText = serien.map(serie => `${serie.charge.name}: ${serie.punkte.map(punkt => `${datumZeitFormat.format(new Date(punkt.zeit))} SG ${formatiereZahl(punkt.sg, 4)}`).join(', ')}`).join(' · ')
    const achsen = [90, 70, 50, 30, 10].map(oe => `<line class="klima-raster" x1="${links}" y1="${y(sgAusOechsle(oe)).toFixed(1)}" x2="${rechts}" y2="${y(sgAusOechsle(oe)).toFixed(1)}"></line><text class="achstext" x="6" y="${(y(sgAusOechsle(oe)) + 4).toFixed(1)}">${oe}</text>`).join('')
    const legende = serien.map(serie => `<span><i style="--serienfarbe:${serie.farbe}"></i>${html(serie.charge.name)}</span>`).join('')
    return `<div class="kurve-karte kurve-gross"><div class="kurve-kopf"><h3>${html(titel)}</h3><div class="kurven-legende">${legende}<span><i class="erwartung"></i>Erwartung</span></div></div><svg class="gaerkurve" viewBox="0 0 ${breite} 330" preserveAspectRatio="none" role="img" aria-label="${html(titel)}. ${html(tabellenText)}"><rect class="pressband" x="${links}" y="${pressY.toFixed(1)}" width="${rechts - links}" height="${Math.max(0, unten - pressY).toFixed(1)}"></rect>${achsen}<text class="presslabel" x="${links + 6}" y="${Math.min(unten - 4, pressY + 16).toFixed(1)}">PRESSFENSTER · ${datumFormat.format(new Date(pressDatumMs))} · SG ≤ ${pressGrenzeText}</text><line class="kurvenachse" x1="${links}" y1="${unten}" x2="${rechts}" y2="${unten}"></line><path class="kurve-erwartet" d="${erwartetPfad}"></path>${serien.map(serie => { const pfad = serie.punkte.map((punkt, index) => `${index ? 'L' : 'M'}${x(punkt.zeit).toFixed(1)},${y(punkt.sg).toFixed(1)}`).join(' '); return `<path class="kurve-serie" style="--serienfarbe:${serie.farbe}" d="${pfad}"></path>${serie.punkte.map(punkt => `<circle class="kurvenpunkt" style="--serienfarbe:${serie.farbe}" cx="${x(punkt.zeit).toFixed(1)}" cy="${y(punkt.sg).toFixed(1)}" r="4"><title>${html(serie.charge.name)} · ${datumZeitFormat.format(new Date(punkt.zeit))}: SG ${formatiereZahl(punkt.sg, 4)} (${formatiereZahl(oechsleAusSg(punkt.sg), 0)} °Oe)</title></circle>`).join('')}` }).join('')}<text class="achstext" x="${links}" y="318">${kurzDatumFormat.format(new Date(startMs))}</text><text class="achstext achstext-rechts" x="${rechts}" y="318">${kurzDatumFormat.format(new Date(endeMs))}</text></svg>${this.renderErklaerschublade('Worauf du bei der Kurve achtest', `${erklaerung} Messwerte: ${tabellenText}`)}</div>`
  }

  private renderBatteriewarnung(): string {
    const batterie = this.sensorVerlauf.at(-1)?.batterie
      ?? [...this.stand.klima].filter(punkt => punkt.quelle === 'sensor' && punkt.batterie !== undefined).sort((a, b) => a.zeit.localeCompare(b.zeit)).at(-1)?.batterie
    if (batterie === undefined || batterie >= 20) return ''
    return `<div class="warnbox batteriewarnung"><strong>Sensorbatterie niedrig:</strong> ${formatiereZahl(batterie, 0)} %. Batterie wechseln, damit die Kellerkurve nicht unbemerkt abbricht.</div>`
  }

  private renderKellerkurve(nur48Stunden = false, untergrenze?: number): string {
    const letzterZeitpunkt = this.sensorVerlauf.length ? new Date(this.sensorVerlauf.at(-1)!.zeit).getTime() : 0
    const grenze = untergrenze ?? (nur48Stunden ? letzterZeitpunkt - 48 * 60 * 60 * 1000 : Number.NEGATIVE_INFINITY)
    const punkte = this.sensorVerlauf.filter(punkt => new Date(punkt.zeit).getTime() >= grenze)
    if (!punkte.length) return ''
    const breite = 320
    const oben = 12
    const unten = 106
    const startMs = new Date(punkte[0]!.zeit).getTime()
    const letzterMs = new Date(punkte.at(-1)!.zeit).getTime()
    const endeMs = Math.max(letzterMs, startMs + 60 * 60 * 1000)
    const minRoh = Math.min(...punkte.map(punkt => punkt.temperatur))
    const maxRoh = Math.max(...punkte.map(punkt => punkt.temperatur))
    const abstand = Math.max(0.5, (maxRoh - minRoh) * 0.18)
    const minTemperatur = minRoh - abstand
    const maxTemperatur = maxRoh + abstand
    const x = (zeit: string) => 6 + ((new Date(zeit).getTime() - startMs) / Math.max(1, endeMs - startMs)) * (breite - 12)
    const y = (temperatur: number) => oben + ((maxTemperatur - temperatur) / Math.max(0.1, maxTemperatur - minTemperatur)) * (unten - oben)
    const pfad = punkte.map((punkt, index) => `${index ? 'L' : 'M'}${x(punkt.zeit).toFixed(1)},${y(punkt.temperatur).toFixed(1)}`).join(' ')
    const letzte = punkte.at(-1)!
    const punktSchritt = Math.max(1, Math.ceil(punkte.length / 80))
    const sichtbarePunkte = punkte.filter((_punkt, index) => index % punktSchritt === 0 || index === punkte.length - 1)
    const zusammenfassung = `${punkte.length} Sensorwerte von ${datumZeitFormat.format(new Date(startMs))} bis ${datumZeitFormat.format(new Date(letzterMs))}. Minimum ${formatiereZahl(minRoh)} °C, Maximum ${formatiereZahl(maxRoh)} °C, zuletzt ${formatiereZahl(letzte.temperatur)} °C.`
    return `<div class="kurve-karte klima-kurve"><div class="kurve-kopf"><h3>Kellerklima</h3><div class="kurve-jetzt">zuletzt <strong>${formatiereZahl(letzte.temperatur)} °C</strong></div></div><svg class="gaerkurve" viewBox="0 0 320 132" role="img" aria-label="${html(zusammenfassung)}"><line class="klima-raster" x1="0" y1="12" x2="320" y2="12"></line><line class="klima-raster" x1="0" y1="59" x2="320" y2="59"></line><line class="kurvenachse" x1="0" y1="106" x2="320" y2="106"></line><text class="achstext" x="4" y="9">${formatiereZahl(maxRoh)} °C</text><text class="achstext" x="4" y="103">${formatiereZahl(minRoh)} °C</text><path class="kurve-ist klima-linie" pathLength="1" d="${pfad}"></path>${sichtbarePunkte.map(punkt => `<circle class="kurvenpunkt klima-punkt" cx="${x(punkt.zeit).toFixed(1)}" cy="${y(punkt.temperatur).toFixed(1)}" r="3"><title>${datumZeitFormat.format(new Date(punkt.zeit))}: ${formatiereZahl(punkt.temperatur)} °C${punkt.feuchte === undefined ? '' : ` · ${formatiereZahl(punkt.feuchte, 0)} %`}</title></circle>`).join('')}<text class="achstext" x="4" y="128">${kurzDatumFormat.format(new Date(startMs))}</text><text class="achstext achstext-rechts" x="316" y="128">${kurzDatumFormat.format(new Date(letzterMs))}</text></svg><div class="sr-only">${html(zusammenfassung)}</div></div>`
  }

  private renderAmpel(ampel: Ampel): string {
    return `<span class="ampel ampel-${ampel.toLowerCase()}"><i class="ampel-punkt"></i>${html(AMPEL_LABEL[ampel])}</span>`
  }

  private renderZeitstrahl(charge: Charge): string {
    const phaseIndex = PHASEN_REIHE.indexOf(charge.phase)
    const fuehrung = PHASEN_FUEHRUNG[charge.phase]
    const naechstePhase = PHASEN_REIHE[phaseIndex + 1]
    return `<div class="zeitstrahl" aria-label="Phasen-Zeitstrahl, aktuelle Phase ${html(PHASEN_LABEL[charge.phase])}">${PHASEN_REIHE.map((phase, index) => `<div class="zeitphase ${index < phaseIndex ? 'abgeschlossen' : ''} ${index === phaseIndex ? 'aktuell' : ''} ${phase.includes('GATE') ? 'gate' : ''}" aria-label="${html(PHASEN_LABEL[phase])}: ${index < phaseIndex ? 'abgeschlossen' : index === phaseIndex ? 'aktuell' : 'ausstehend'}"><i aria-hidden="true"></i></div>`).join('')}</div><div class="zeitstrahl-legende" aria-hidden="true">${ZEITSTRAHL_MARKEN.map(marke => `<span class="${marke.phase === charge.phase ? 'aktuell' : ''}">${html(marke.label)}</span>`).join('')}</div><p class="phasen-satz"><strong>${html(PHASEN_LABEL[charge.phase])}, Tag ${this.tagDerPhase(charge)}.</strong> ${html(fuehrung.beschreibung)} Deine Aufgabe: ${html(fuehrung.aufgabe)}</p>${this.renderErklaerschublade('Was als Nächstes kommt', naechstePhase ? `${PHASEN_LABEL[naechstePhase]}: ${PHASEN_FUEHRUNG[naechstePhase].beschreibung} ${PHASEN_FUEHRUNG[naechstePhase].aufgabe}` : 'Dieser Jahrgang hat die letzte Phase erreicht.')}`
  }

  private bereiteRundeVor(startChargeId?: string): void {
    const ids = this.aktiveChargen().map(charge => charge.id)
    const index = startChargeId ? ids.indexOf(startChargeId) : -1
    this.ui.ansicht = 'runde'
    this.ui.rundenChargeIds = ids
    this.ui.rundenIndex = index >= 0 ? index : 0
    this.ui.rundenZeit = datetimeLocalWert()
    this.ui.rundenEntwuerfe = {}
    this.ui.rundenErgebnisse = []
    this.ui.rundenGespeichert = null
    this.ui.rundenUndoBis = null
    this.ui.rundenAbgeschlossen = false
  }

  private starteRunde(startChargeId?: string): void {
    this.bereiteRundeVor(startChargeId)
    this.schreibeHistory()
    this.render()
  }

  private rundenCharge(): Charge | undefined {
    const chargeId = this.ui.rundenChargeIds[this.ui.rundenIndex]
    return this.stand.chargen.find(charge => charge.id === chargeId && !charge.archiviert)
  }

  private rundenEntwurf(chargeId: string): RundenEntwurf {
    const vorhanden = this.ui.rundenEntwuerfe[chargeId]
    if (vorhanden) return vorhanden
    const charge = this.stand.chargen.find(eintrag => eintrag.id === chargeId)
    const zugaben: Partial<Record<RundenZugabeArt, RundenZugabeEntwurf>> = {}
    if (charge) {
      const zeit = isoAusDatetimeLocal(this.ui.rundenZeit)
      for (const art of zugabeArtenFuerPhase(charge.phase)) {
        const vorschlag = zugabeVorschlag(this.stand, charge, art, zeit, this.ui.zuckerZielJeCharge[charge.id])
        zugaben[art] = {
          aktiv: false,
          menge: vorschlag.menge,
          einheit: vorschlag.einheit,
          stoff: vorschlag.stoff,
          begruendung: vorschlag.begruendung,
          begruendungAutomatisch: true,
        }
      }
    }
    const entwurf = { messwerte: {}, untergestossen: false, zugaben }
    this.ui.rundenEntwuerfe[chargeId] = entwurf
    return entwurf
  }

  private rundenDefinitionen(charge: Charge): { primaer: MessDefinition[]; weitere: MessDefinition[] } {
    const primaerTypen = RUNDEN_PRIMAER[charge.phase] ?? PHASEN_MESS_TYPEN[charge.phase] ?? ['temperatur', 'geruch']
    const primaer = primaerTypen.map(typ => MESS_DEFINITIONEN.find(definition => definition.typ === typ)).filter((definition): definition is MessDefinition => Boolean(definition))
    return { primaer, weitere: MESS_DEFINITIONEN.filter(definition => !primaerTypen.includes(definition.typ)) }
  }

  private renderRunde(): string {
    if (this.ui.rundenAbgeschlossen) return this.renderRundenZusammenfassung()
    const charge = this.rundenCharge()
    if (!charge) return `<section class="runde-leer"><h1>Keine aktive Charge</h1><button class="btn" type="button" data-action="runde-abbrechen">Zurück zu Heute</button></section>`
    const { primaer, weitere } = this.rundenDefinitionen(charge)
    const gespeichert = this.ui.rundenErgebnisse.find(ergebnis => ergebnis.chargeId === charge.id) ?? null
    const ampel = ampelFuerCharge(this.stand, charge)
    const entwurf = this.rundenEntwurf(charge.id)
    const naechste = this.stand.chargen.find(eintrag => eintrag.id === this.ui.rundenChargeIds[this.ui.rundenIndex + 1])
    const nichtAbgeglichen = navigator.onLine === false || this.syncFehler
    return `<section class="runde-screen" aria-labelledby="runde-titel"><header class="runde-kopf"><label class="runden-zeit" for="runden-zeit"><strong id="runde-titel">Runde</strong><input id="runden-zeit" type="datetime-local" value="${html(this.ui.rundenZeit)}" data-action="runden-zeit" aria-label="Zeitpunkt der gesamten Runde" ${this.ui.rundenErgebnisse.length ? 'disabled title="Nach der ersten Speicherung gilt dieser Zeitpunkt für die gesamte Runde."' : ''}></label><div class="runden-punkte" aria-label="Gefäß ${this.ui.rundenIndex + 1} von ${this.ui.rundenChargeIds.length}">${this.ui.rundenChargeIds.map((chargeId, index) => `<i class="${this.ui.rundenErgebnisse.some(ergebnis => ergebnis.chargeId === chargeId) ? 'ok' : ''} ${index === this.ui.rundenIndex ? 'aktiv' : ''}"></i>`).join('')}</div><span class="runden-abgleich ${nichtAbgeglichen ? 'offen' : ''}"><i></i>${this.syncLaeuft ? 'Abgleich läuft' : nichtAbgeglichen ? 'Nicht abgeglichen' : 'Lokal bereit'}</span><button class="runde-abbrechen" type="button" data-action="runde-abbrechen">Abbrechen</button></header><div class="runde-inhalt" data-runde-wischbereich>
      <button class="runde-pfeil runde-pfeil-links" type="button" data-action="runde-wechsel" data-richtung="-1" aria-label="Vorheriges Gefäß" ${this.ui.rundenIndex === 0 ? 'disabled' : ''}>‹</button>
      <div class="runde-links"><div class="runde-gefaess"><div class="runde-nummer">${this.ui.rundenIndex + 1}<span>von ${this.ui.rundenChargeIds.length}</span></div><h1>${html(charge.name)}</h1><p>${charge.mengeKg === undefined ? 'Menge offen' : `${formatiereZahl(charge.mengeKg)} kg`} · ${charge.erwarteteWeinLiter === undefined ? 'Ausbeute offen' : `${formatiereZahl(charge.erwarteteWeinLiter)} L erwartet`} · ${html(PHASEN_LABEL[charge.phase])}</p>${this.renderAmpel(ampel)}</div>${this.renderRundenZuletzt(charge, primaer)}<p class="wisch-hinweis">Wischen oder Pfeile wechseln das Gefäß. Ein Feld reagiert erst bei einer deutlichen Wischstrecke.</p></div>
      <div class="runde-rechts">${gespeichert ? this.renderRundenBefund(charge, gespeichert, naechste) : `<form id="runde-form"><div class="runden-felder">${primaer.map(definition => this.renderRundenFeld(charge, definition, entwurf)).join('')}</div><details class="runden-weitere"><summary><span aria-hidden="true">›</span>Weitere Messgrößen</summary><div class="runden-felder">${weitere.map(definition => this.renderRundenFeld(charge, definition, entwurf)).join('')}</div></details>${this.renderRundenZugaben(charge, entwurf)}${['AKTIVE_GAERUNG', 'PRESS_GATE'].includes(charge.phase) && charge.typ === 'maische' ? `<label class="unterstossen"><input type="checkbox" name="untergestossen" data-runde-untergestossen ${entwurf.untergestossen ? 'checked' : ''}><span>Untergestoßen</span><small>legt ein Ereignis mit dem Rundenzeitpunkt an</small></label>` : ''}<div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt runde-speichern" type="submit">Ausgefüllte Werte speichern</button><p class="hint">Leere und nicht markierte Felder erzeugen keinen Datensatz. Alle Eingaben verwenden den Zeitpunkt oben.</p></form>`}</div>
      <button class="runde-pfeil runde-pfeil-rechts" type="button" data-action="runde-wechsel" data-richtung="1" aria-label="Nächstes Gefäß" ${this.ui.rundenIndex >= this.ui.rundenChargeIds.length - 1 ? 'disabled' : ''}>›</button>
    </div></section>`
  }

  private renderRundenFeld(charge: Charge, definition: MessDefinition, entwurf: RundenEntwurf): string {
    const wert = entwurf.messwerte[definition.typ] ?? { eingabe: '', methode: 'spindel' as const }
    const feldId = `runde-${charge.id}-${definition.typ}`
    const feld = definition.art === 'zahl'
      ? `<div class="runden-eingabeblock"><input id="${html(feldId)}" name="runde-${definition.typ}" data-runde-eingabe data-mess-typ="${definition.typ}" inputmode="decimal" value="${html(wert.eingabe)}"><span>${html(definition.einheit)}</span></div>`
      : `<select id="${html(feldId)}" name="runde-${definition.typ}" data-runde-eingabe data-mess-typ="${definition.typ}"><option value="">Nicht erfasst</option>${(definition.optionen ?? []).map(option => `<option value="${html(option)}" ${option === wert.eingabe ? 'selected' : ''}>${html(option)}</option>`).join('')}</select>`
    const methode = DICHTE_TYPEN.includes(definition.typ) ? `<label class="runden-methode" for="runde-methode-${definition.typ}"><span>Messmethode</span><select id="runde-methode-${definition.typ}" name="methode-${definition.typ}" data-runde-methode data-mess-typ="${definition.typ}"><option value="spindel" ${wert.methode === 'spindel' ? 'selected' : ''}>Spindel</option><option value="refraktometer" ${wert.methode === 'refraktometer' ? 'selected' : ''}>Refraktometer</option><option value="sonstige" ${wert.methode === 'sonstige' ? 'selected' : ''}>Sonstige</option></select></label>` : ''
    const label = definition.typ === 'volumen' ? 'Füllstand' : definition.label
    return `<div class="runden-feld"><div class="runden-feld-label"><label for="${html(feldId)}">${html(label)}</label>${definition.hinweis ? `<small>${html(definition.hinweis)}</small>` : ''}</div>${feld}${methode}</div>`
  }

  private renderRundenZugaben(charge: Charge, entwurf: RundenEntwurf): string {
    const zeit = isoAusDatetimeLocal(this.ui.rundenZeit)
    const erinnerungen = faelligeZugabeReminder(this.stand, charge)
    const erinnerungsZeilen = erinnerungen.map(reminder => {
      const art = zugabeArtFuerReminder(reminder)
      const zugabe = art ? entwurf.zugaben[art] : undefined
      const menge = zugabe?.menge.trim() ? ` · ${html(zugabe.menge)} ${html(zugabe.einheit)}` : ''
      return `<div class="runden-zugabe-reminder"><strong>Fällig: ${html(reminder.titel)}</strong><span>${html(charge.name)}${menge}</span></div>`
    }).join('')
    const zeilen = zugabeArtenFuerPhase(charge.phase).map(art => {
      const vorschlag = zugabeVorschlag(this.stand, charge, art, zeit, this.ui.zuckerZielJeCharge[charge.id])
      const zugabe = entwurf.zugaben[art] ?? {
        aktiv: false,
        menge: vorschlag.menge,
        einheit: vorschlag.einheit,
        stoff: vorschlag.stoff,
        begruendung: vorschlag.begruendung,
        begruendungAutomatisch: true,
      }
      return this.renderRundenZugabe(vorschlag, zugabe)
    }).join('')
    return `<section class="runden-zugaben" aria-labelledby="runden-zugaben-titel"><div class="runden-zugaben-kopf"><h2 id="runden-zugaben-titel">Zugaben</h2><span>Nur „Zugegeben“ wird protokolliert</span></div>${erinnerungsZeilen}<div class="runden-zugabe-liste">${zeilen}</div></section>`
  }

  private renderRundenZugabe(vorschlag: ReturnType<typeof zugabeVorschlag>, zugabe: RundenZugabeEntwurf): string {
    const menge = parseDeZahl(zugabe.menge)
    const vorrat = passendeVorratsZuordnung(this.stand, vorschlag.art, zugabe.stoff, zugabe.einheit, menge ?? undefined)
    const gesamtNachEingabe = (vorschlag.bisherGesamt ?? 0) + (menge ?? 0)
    const maxErreicht = vorschlag.gesamtMax !== undefined && gesamtNachEingabe >= vorschlag.gesamtMax
    const feldId = `runden-zugabe-${vorschlag.art}`
    const stoffFeld = vorschlag.art === 'sonstiges'
      ? `<label class="runden-zugabe-stoff" for="${feldId}-stoff"><span>Stoffname</span><input id="${feldId}-stoff" name="zugabe-${vorschlag.art}-stoff" data-runde-zugabe-stoff value="${html(zugabe.stoff)}"></label>`
      : `<strong class="runden-zugabe-name">${html(vorschlag.label)}</strong>`
    const einheit = vorschlag.art === 'sonstiges'
      ? `<select name="zugabe-${vorschlag.art}-einheit" data-runde-zugabe-einheit aria-label="Einheit für sonstige Zugabe">${['g', 'kg', 'ml', 'L', 'Beutel'].map(option => `<option value="${option}" ${option === zugabe.einheit ? 'selected' : ''}>${option}</option>`).join('')}</select>`
      : `<span>${html(zugabe.einheit)}</span>`
    return `<article class="runden-zugabe ${zugabe.aktiv ? 'aktiv' : ''}" data-runde-zugabe data-zugabe-art="${vorschlag.art}"${vorschlag.gesamtMax === undefined ? '' : ` data-zugabe-max="${vorschlag.gesamtMax}" data-zugabe-bisher="${vorschlag.bisherGesamt ?? 0}"`}>
      <label class="runden-zugabe-aktiv"><input type="checkbox" name="zugabe-${vorschlag.art}-aktiv" data-runde-zugabe-aktiv ${zugabe.aktiv ? 'checked' : ''}><span>Zugegeben</span></label>
      <div class="runden-zugabe-inhalt">${stoffFeld}<div class="runden-zugabe-menge"><label for="${feldId}">Menge</label><div><input id="${feldId}" name="zugabe-${vorschlag.art}-menge" data-runde-zugabe-menge inputmode="decimal" value="${html(zugabe.menge)}">${einheit}</div></div><p class="runden-zugabe-herkunft">${html(vorschlag.herkunft)}</p><p class="runden-zugabe-vorrat ${vorrat.warnung ? 'warnung' : ''}" data-runde-zugabe-vorrat>${html(vorrat.hinweis)}</p><div class="warnbox runden-zugabe-max" data-runde-zugabe-maxwarnung ${maxErreicht ? '' : 'hidden'}>Die erfasste Gesamtmenge erreicht oder überschreitet die Höchstmenge aus naehrsalzPlan(). Die Zugabe bleibt möglich; R-NAEHRSALZ-MAX bleibt unverändert die Regelquelle.</div><details class="runden-zugabe-begruendung"><summary>Begründung ansehen oder ändern</summary><textarea name="zugabe-${vorschlag.art}-begruendung" data-runde-zugabe-begruendung aria-label="Begründung für ${html(vorschlag.label)}">${html(zugabe.begruendung)}</textarea></details></div>
    </article>`
  }

  private renderRundenZuletzt(charge: Charge, definitionen: MessDefinition[]): string {
    const letzteJeTyp = definitionen.map(definition => ({ definition, reihe: this.stand.messungen.filter(messung => messung.chargeId === charge.id && messung.typ === definition.typ).sort((a, b) => b.zeit.localeCompare(a.zeit)) }))
    const letzteZeit = letzteJeTyp.map(eintrag => eintrag.reihe[0]?.zeit).filter((zeit): zeit is string => Boolean(zeit)).sort().at(-1)
    const zeilen = letzteJeTyp.map(({ definition, reihe }) => {
      const letzte = reihe[0]
      const davor = reihe[1]
      const anzeige = !letzte ? '–' : letzte.wert === null ? html(letzte.text ?? '–') : `${formatiereZahl(letzte.wert, definition.typ === 'sg' ? 4 : 1)} ${html(definition.einheit)}`
      const trend = letzte?.wert !== null && letzte?.wert !== undefined && davor?.wert !== null && davor?.wert !== undefined
        ? `<span class="runden-trend">${letzte.wert >= davor.wert ? '↑' : '↓'} von ${formatiereZahl(davor.wert, definition.typ === 'sg' ? 4 : 1)}</span>`
        : ''
      return `<div><span>${html(definition.typ === 'volumen' ? 'Füllstand' : definition.label)}</span><strong>${anzeige}${trend}</strong></div>`
    }).join('')
    return `<section class="runden-zuletzt"><h2>Zuletzt · ${letzteZeit ? datumZeitFormat.format(new Date(letzteZeit)) : 'noch nie'}</h2>${zeilen}</section>`
  }

  private renderRundenBefund(charge: Charge, gespeichert: RundenSpeicherung, naechste: Charge | undefined): string {
    const ampel = ampelFuerCharge(this.stand, charge)
    const befund = befundeFuerCharge(this.stand, charge)[0]
    const dichten = this.stand.messungen.filter(messung => messung.chargeId === charge.id && DICHTE_KURVEN_TYPEN.includes(messung.typ) && messung.methode !== 'refraktometer').sort((a, b) => b.zeit.localeCompare(a.zeit))
    const letzte = this.dichteInOechsle(dichten[0])
    const davor = this.dichteInOechsle(dichten[1])
    const normalText = letzte !== undefined && davor !== undefined
      ? `Mostgewicht seit dem letzten Wert um ${formatiereZahl(Math.abs(letzte - davor), 0)} °Oe ${letzte <= davor ? 'gefallen' : 'gestiegen'}. Die Regelengine meldet keine Abweichung.`
      : 'Die Regelengine meldet für die gespeicherten Werte keine Abweichung.'
    const istLetzteSpeicherung = this.ui.rundenGespeichert === gespeichert
    const sekunden = !istLetzteSpeicherung || this.ui.rundenUndoBis === null ? 0 : Math.max(0, Math.ceil((this.ui.rundenUndoBis - Date.now()) / 1000))
    const protokoll = this.rundenProtokollText(gespeichert)
    return `<div class="runden-nachher"><div class="runden-befund befund-${ampel.toLowerCase()}" role="status"><div>${this.renderAmpel(ampel)}<strong>Gespeichert</strong></div><p>${this.fachtext(befund?.text ?? normalText)}</p>${befund?.massnahme ? `<small>${this.fachtext(befund.massnahme)}</small>` : ''}</div><button class="btn btn-haupt runde-weiter" type="button" data-action="runde-weiter">${naechste ? `Weiter → ${html(naechste.name)}` : 'Weiter → Zusammenfassung'}</button>${sekunden > 0 ? `<button class="runde-undo" type="button" data-action="runde-undo">Letzte Eingabe zurücknehmen <strong>· ${sekunden} s</strong></button>` : istLetzteSpeicherung ? '<p class="hint">Die Rücknahmefrist ist abgelaufen.</p>' : ''}<p class="hint">${html(protokoll || 'Keine Werte')} · ${datumZeitFormat.format(new Date(gespeichert.zeit))}</p></div>`
  }

  private rundenProtokollText(ergebnis: RundenSpeicherung): string {
    const ereignisse = ergebnis.ereignisIds
      .map(ereignisId => this.stand.ereignisse.find(ereignis => ereignis.id === ereignisId))
      .filter((ereignis): ereignis is Ereignis => Boolean(ereignis))
    const teile = ergebnis.typen.map(typ => this.messLabel(typ))
    if (ereignisse.some(ereignis => ereignis.art === 'unterstossen')) teile.push('Untergestoßen')
    teile.push(...ereignisse.filter(ereignis => ereignis.mengeWert !== undefined).map(ereignis => `${EREIGNIS_LABEL[ereignis.art]} ${formatiereZahl(ereignis.mengeWert!)} ${ereignis.mengeEinheit ?? ''}`.trim()))
    return teile.join(', ')
  }

  private renderRundenZusammenfassung(): string {
    const offene = this.stand.reminder.filter(reminder => !reminder.erledigt).sort((a, b) => a.faellig.localeCompare(b.faellig))
    const geaenderteReminderIds = [...new Set(this.ui.rundenErgebnisse.flatMap(ergebnis => ergebnis.reminderAenderungen.map(aenderung => aenderung.reminderId)))]
    const geaenderteReminder = geaenderteReminderIds.map(reminderId => this.stand.reminder.find(reminder => reminder.id === reminderId)).filter((reminder): reminder is Reminder => Boolean(reminder))
    return `<section class="runden-zusammenfassung" aria-labelledby="runden-abschluss"><div><span class="abschluss-merker">Runde abgeschlossen</span><h1 id="runden-abschluss">${this.ui.rundenErgebnisse.length} Gefäße erfasst</h1><p>${datumZeitFormat.format(new Date(isoAusDatetimeLocal(this.ui.rundenZeit)))}</p></div><div class="abschluss-grid"><div class="karte"><h2>Messungen und Zugaben</h2>${this.ui.rundenErgebnisse.map(ergebnis => { const charge = this.stand.chargen.find(eintrag => eintrag.id === ergebnis.chargeId); return `<div class="abschluss-zeile"><strong>${html(charge?.name ?? ergebnis.chargeId)}</strong><span>${html(this.rundenProtokollText(ergebnis) || 'Keine Werte')}</span></div>` }).join('') || '<div class="leer">Keine Werte gespeichert.</div>'}</div><div class="karte"><h2>Ampelwechsel</h2>${this.ui.rundenErgebnisse.filter(ergebnis => ergebnis.ampelVorher !== ergebnis.ampelNachher).map(ergebnis => `<div class="abschluss-zeile"><strong>${html(this.stand.chargen.find(charge => charge.id === ergebnis.chargeId)?.name ?? ergebnis.chargeId)}</strong><span>${html(AMPEL_LABEL[ergebnis.ampelVorher])} → ${html(AMPEL_LABEL[ergebnis.ampelNachher])}</span></div>`).join('') || '<div class="leer">Keine Ampel hat gewechselt.</div>'}</div><div class="karte"><h2>Termine</h2>${geaenderteReminder.map(reminder => `<div class="abschluss-zeile"><strong>${reminder.wiederholungTage === undefined ? 'Erledigt' : 'Weitergeführt'}</strong><span>${html(reminder.titel)}${reminder.wiederholungTage === undefined ? '' : ` · nächster Termin ${datumFormat.format(new Date(reminder.faellig))}`}</span></div>`).join('') || '<div class="leer">Keine Termine durch Zugaben erledigt.</div>'}${offene.slice(0, 3).map(reminder => `<div class="abschluss-zeile"><strong>Offen · ${datumFormat.format(new Date(reminder.faellig))}</strong><span>${html(reminder.titel)}</span></div>`).join('')}</div></div><button class="btn btn-haupt" type="button" data-action="runde-beenden">Zu Heute</button></section>`
  }

  private renderDesktopSidebar(): string {
    const nav: Array<{ ansicht: Ansicht; label: string; bild: Parameters<typeof icon>[0] }> = [
      { ansicht: 'heute', label: 'Heute', bild: 'traube' },
      { ansicht: 'runde', label: 'Runde', bild: 'runde' },
      { ansicht: 'journal', label: 'Journal', bild: 'journal' },
      { ansicht: 'termine', label: 'Termine', bild: 'kalender' },
      { ansicht: 'wiki', label: 'Wiki', bild: 'buch' },
      { ansicht: 'mehr', label: 'Einstellungen', bild: 'mehr' },
    ]
    const letzterAbgleich = typeof this.stand.appMeta.letzterAbgleich === 'string' ? this.stand.appMeta.letzterAbgleich : null
    return `<aside class="desktop-seite"><div class="desktop-logo"><span>${icon('traube')}</span><div><strong>Weinbegleiter</strong><small>Jahrgang ${this.stand.jahrgang} · Rotwein</small></div></div><nav aria-label="Hauptnavigation">${nav.map(eintrag => `<button class="desktop-nav-knopf ${this.hauptAnsicht() === eintrag.ansicht ? 'aktiv' : ''}" type="button" data-action="${eintrag.ansicht === 'runde' ? 'runde-start' : 'nav'}" data-view="${eintrag.ansicht}" ${this.hauptAnsicht() === eintrag.ansicht ? 'aria-current="page"' : ''}>${icon(eintrag.bild)}<span>${eintrag.label}</span></button>`).join('')}</nav><h2>Gefäße</h2><div class="desktop-gefaesse">${this.aktiveChargen().map(charge => { const ampel = ampelFuerCharge(this.stand, charge); const dichte = this.dichteInOechsle(this.letzteMessung(charge.id, 'oechsle') ?? this.letzteMessung(charge.id, 'sg')); return `<button class="desktop-gefaess ${charge.id === this.ui.chargeId ? 'aktiv' : ''}" type="button" data-action="desktop-charge" data-id="${html(charge.id)}"><span class="listen-ampel ampel-${ampel.toLowerCase()}"></span><strong>${html(charge.name)}</strong><small>${dichte === undefined ? '–' : `${formatiereZahl(dichte, 0)} °Oe`}</small></button>` }).join('')}</div><div class="desktop-fassung"><span>Abgleich ${letzterAbgleich ? datumZeitFormat.format(new Date(letzterAbgleich)) : 'noch nie'}</span><strong>Fassung vom ${BUILD_ZEIT_FORMAT.format(new Date(__BUILD_TIMESTAMP__))} (${html(__BUILD_COMMIT__)})</strong></div></aside>`
  }

  private renderDesktopMitte(): string {
    const faellige = this.stand.reminder.filter(reminder => !reminder.erledigt && new Date(reminder.faellig).getTime() <= Date.now())
    const klima = [...this.stand.klima].sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
    const charge = this.aktuelleCharge() ?? this.aktiveChargen()[0]
    return `<section class="desktop-dashboard" aria-labelledby="desktop-titel"><h1 class="sr-only" id="desktop-titel">Schreibtisch</h1>${this.renderStatusband(faellige.length, klima)}${this.renderDesktopVerlauf()}<div class="desktop-unten"><div>${this.renderKellerkurve(true)}</div>${charge ? `<div class="karte desktop-phase"><h3>Phase · ${html(charge.name)}</h3>${this.renderZeitstrahl(charge)}</div>` : ''}</div></section>`
  }

  private renderDesktopVerlauf(): string {
    const kurven: Array<[DesktopKurveTyp, string]> = [['gaerung', 'Gärverlauf'], ['temperatur', 'Temperatur'], ['kellerklima', 'Kellerklima']]
    const zeitraeume: Array<[DesktopZeitraum, string]> = [['sieben-tage', '7 Tage'], ['gaerung', 'Gärung'], ['alles', 'Alles']]
    const inhalt = this.ui.desktopKurveTyp === 'gaerung'
      ? this.renderGaerkurve(this.aktiveChargen(), 'Verlauf', this.desktopZeitGrenze(), this.ui.desktopZeitraum === 'gaerung')
      : this.ui.desktopKurveTyp === 'temperatur'
        ? this.renderTemperaturKurve()
        : this.renderKellerkurve(false, this.desktopZeitGrenze())
    return `<div class="desktop-verlauf"><div class="desktop-verlauf-kopf"><h2>Verlauf</h2><div class="umschalter" role="group" aria-label="Kurvenart">${kurven.map(([wert, label]) => `<button class="${wert === this.ui.desktopKurveTyp ? 'aktiv' : ''}" type="button" data-action="desktop-kurve" data-kurve="${wert}">${label}</button>`).join('')}</div><div class="umschalter" role="group" aria-label="Zeitraum">${zeitraeume.map(([wert, label]) => `<button class="${wert === this.ui.desktopZeitraum ? 'aktiv' : ''}" type="button" data-action="desktop-zeitraum" data-zeitraum="${wert}">${label}</button>`).join('')}</div></div>${inhalt}</div>`
  }

  private desktopZeitGrenze(): number {
    if (this.ui.desktopZeitraum === 'alles') return Number.NEGATIVE_INFINITY
    if (this.ui.desktopZeitraum === 'sieben-tage') return Date.now() - 7 * 86_400_000
    const starts = this.aktiveChargen().map(charge => this.stand.ereignisse.filter(ereignis => ereignis.chargeId === charge.id && ereignis.art === 'anstellen').sort((a, b) => a.zeit.localeCompare(b.zeit))[0]?.zeit ?? charge.phaseSeit ?? charge.startdatum)
    return Math.min(...starts.map(zeit => new Date(zeit).getTime()))
  }

  private renderTemperaturKurve(): string {
    const grenze = this.desktopZeitGrenze()
    const serien = this.aktiveChargen().map((charge, index) => ({ charge, farbe: CHARGEN_FARBEN[index % CHARGEN_FARBEN.length]!, punkte: this.stand.messungen.filter(messung => messung.chargeId === charge.id && messung.typ === 'temperatur' && messung.wert !== null && new Date(messung.zeit).getTime() >= grenze).sort((a, b) => a.zeit.localeCompare(b.zeit)) })).filter(serie => serie.punkte.length)
    const punkte = serien.flatMap(serie => serie.punkte)
    if (!punkte.length) return '<div class="kurve-karte"><div class="kurve-hinweis">Im gewählten Zeitraum liegen keine Temperaturmessungen vor.</div></div>'
    const start = Math.min(...punkte.map(punkt => new Date(punkt.zeit).getTime()))
    const ende = Math.max(start + 60 * 60 * 1000, ...punkte.map(punkt => new Date(punkt.zeit).getTime()))
    const werte = punkte.map(punkt => punkt.wert!)
    const min = Math.min(...werte) - 1
    const max = Math.max(...werte) + 1
    const x = (zeit: string) => 44 + ((new Date(zeit).getTime() - start) / Math.max(1, ende - start)) * 580
    const y = (wert: number) => 26 + ((max - wert) / Math.max(1, max - min)) * 260
    const legende = serien.map(serie => `<span><i style="--serienfarbe:${serie.farbe}"></i>${html(serie.charge.name)}</span>`).join('')
    return `<div class="kurve-karte kurve-gross"><div class="kurven-legende">${legende}</div><svg class="gaerkurve" viewBox="0 0 640 330" preserveAspectRatio="none" role="img" aria-label="Temperaturverlauf aller Chargen"><line class="kurvenachse" x1="44" y1="286" x2="624" y2="286"></line><text class="achstext" x="4" y="30">${formatiereZahl(max)} °C</text><text class="achstext" x="4" y="286">${formatiereZahl(min)} °C</text>${serien.map(serie => { const pfad = serie.punkte.map((punkt, index) => `${index ? 'L' : 'M'}${x(punkt.zeit).toFixed(1)},${y(punkt.wert!).toFixed(1)}`).join(' '); return `<path class="kurve-serie" style="--serienfarbe:${serie.farbe}" d="${pfad}"></path>${serie.punkte.map(punkt => `<circle class="kurvenpunkt" style="--serienfarbe:${serie.farbe}" cx="${x(punkt.zeit).toFixed(1)}" cy="${y(punkt.wert!).toFixed(1)}" r="4"><title>${html(serie.charge.name)} · ${datumZeitFormat.format(new Date(punkt.zeit))}: ${formatiereZahl(punkt.wert!)} °C</title></circle>`).join('')}` }).join('')}<text class="achstext" x="44" y="318">${kurzDatumFormat.format(new Date(start))}</text><text class="achstext achstext-rechts" x="624" y="318">${kurzDatumFormat.format(new Date(ende))}</text></svg></div>`
  }

  private renderDesktopDetail(): string {
    const charge = this.aktuelleCharge() ?? this.aktiveChargen()[0]
    if (!charge) return '<aside class="desktop-detail"><div class="leer">Keine aktive Charge.</div></aside>'
    const messungen = this.stand.messungen.filter(messung => messung.chargeId === charge.id).sort((a, b) => b.zeit.localeCompare(a.zeit))
    const ereignisse = this.stand.ereignisse.filter(ereignis => ereignis.chargeId === charge.id).sort((a, b) => b.zeit.localeCompare(a.zeit))
    const ampel = ampelFuerCharge(this.stand, charge)
    return `<aside class="desktop-detail"><div class="desktop-detail-kopf"><div><h2>${html(charge.name)}</h2>${this.renderAmpel(ampel)}</div><button class="btn btn-klein" type="button" data-action="erfassen">Erfassen</button></div><p>${charge.mengeKg === undefined ? 'Menge offen' : `${formatiereZahl(charge.mengeKg)} kg`} · ${charge.erwarteteWeinLiter === undefined ? 'Ausbeute offen' : `${formatiereZahl(charge.erwarteteWeinLiter)} L erwartet`} · ${html(PHASEN_LABEL[charge.phase])}</p><h3>Messungen</h3><div class="desktop-tabelle-wrap"><table class="desktop-tabelle"><thead><tr><th>Zeit</th><th>Größe</th><th>Wert</th></tr></thead><tbody>${messungen.map(messung => `<tr class="mess-tabellenzeile" data-action="messung-bearbeiten" data-id="${html(messung.id)}" tabindex="0"><td>${datumZeitFormat.format(new Date(messung.zeit))}</td><td>${html(this.messLabel(messung.typ))}</td><td>${messung.wert === null ? html(messung.text ?? '–') : `${zahlFormat.format(messung.wert)} ${html(this.messEinheit(messung.typ))}`}</td></tr>`).join('')}</tbody></table></div><h3>Ereignisse</h3><div class="desktop-ereignisse">${ereignisse.map(ereignis => `<button type="button" data-action="ereignis-bearbeiten" data-id="${html(ereignis.id)}"><strong>${html(EREIGNIS_LABEL[ereignis.art])}${ereignis.mengeWert === undefined ? '' : ` · ${zahlFormat.format(ereignis.mengeWert)} ${html(ereignis.mengeEinheit)}`}</strong><small>${datumZeitFormat.format(new Date(ereignis.zeit))} · ${html(ereignis.begruendung)}</small></button>`).join('') || '<div class="leer">Noch keine Ereignisse.</div>'}</div></aside>`
  }

  private renderJournal(): string {
    const eintraege = [
      ...this.stand.messungen.map(messung => ({ zeit: messung.zeit, art: 'messung' as const, id: messung.id, chargeId: messung.chargeId, titel: this.messLabel(messung.typ), text: messung.wert === null ? messung.text ?? '–' : `${zahlFormat.format(messung.wert)} ${this.messEinheit(messung.typ)}` })),
      ...this.stand.ereignisse.map(ereignis => ({ zeit: ereignis.zeit, art: 'ereignis' as const, id: ereignis.id, chargeId: ereignis.chargeId, titel: EREIGNIS_LABEL[ereignis.art], text: ereignis.begruendung })),
    ].sort((a, b) => b.zeit.localeCompare(a.zeit))
    return `<section class="seite journal" aria-labelledby="journal-titel"><h1 class="seiten-titel" id="journal-titel">Journal</h1><div class="karte protokoll-liste">${eintraege.map(eintrag => `<button class="protokoll-eintrag" type="button" data-action="${eintrag.art === 'messung' ? 'messung-bearbeiten' : 'ereignis-bearbeiten'}" data-id="${html(eintrag.id)}"><span>${datumZeitFormat.format(new Date(eintrag.zeit))} · ${html(this.stand.chargen.find(charge => charge.id === eintrag.chargeId)?.name ?? eintrag.chargeId)}</span><b>${html(eintrag.titel)} · ${html(eintrag.text)}</b><small>Antippen zum Bearbeiten</small></button>`).join('') || '<div class="leer">Noch keine Einträge.</div>'}</div></section>`
  }

  private renderCharge(): string {
    const charge = this.aktuelleCharge()
    if (!charge) return this.renderFehlendeCharge()
    const ampel = ampelFuerCharge(this.stand, charge)
    const tabs: Array<[ChargeTab, string]> = [['befunde', 'Befunde'], ['messungen', 'Messungen'], ['ereignisse', 'Ereignisse'], ['gefaess', 'Gefäß'], ['fotos', 'Fotos']]
    const gate = gateFuerPhase(this.stand, charge)
    const phaseIndex = PHASEN_REIHE.indexOf(charge.phase)
    const naechstePhase = PHASEN_REIHE[phaseIndex + 1]
    const elternIds = charge.elternChargeId ? [charge.elternChargeId] : []
    return `<section class="seite" aria-labelledby="charge-titel"><button class="zurueck" type="button" data-action="nav" data-view="heute">${icon('pfeil')}Heute</button><div class="charge-kopf charge-detail-kopf"><div><h1 class="seiten-titel" id="charge-titel">${html(charge.name)}</h1><div class="charge-meta">${charge.mengeKg === undefined ? 'Menge offen' : `${formatiereZahl(charge.mengeKg)} kg`} · ${html(PHASEN_LABEL[charge.phase])} · Tag ${this.tagDerPhase(charge)}</div></div>${this.renderAmpel(ampel)}</div>${this.renderErklaerschublade('Was die Ampel prüft', 'Oberfläche, Geruch, Kopfraum, Temperatur, Kontrollabstand und Zugabemengen fließen in die Bewertung ein. Gelb fordert eine Kontrolle. Orange isoliert die Charge. Rot sperrt Vermischung und Abfüllung.')}
      ${charge.archiviert ? '<div class="info-box">Archivierte Ausgangscharge. Messungen und Ereignisse bleiben unverändert erhalten.</div>' : ''}
      ${elternIds.length ? `<div class="karte"><h2>Herkunft</h2>${elternIds.map(elternId => { const eltern = this.stand.chargen.find(eintrag => eintrag.id === elternId); return `<button class="wiki-eintrag" type="button" data-action="charge" data-id="${html(elternId)}"><strong>${html(eltern?.name ?? elternId)}</strong><small>${eltern ? `${eltern.mengeKg === undefined ? 'Menge offen' : `${formatiereZahl(eltern.mengeKg)} kg`} · ${html(PHASEN_LABEL[eltern.phase])}` : 'Ausgangscharge'}</small></button>` }).join('')}</div>` : ''}
      <h2>Verlauf</h2>${this.renderGaerkurve([charge], `Gärverlauf ${charge.name}`)}
      <h2>Phase</h2><div class="karte">${this.renderZeitstrahl(charge)}</div>
      <div class="tabs" role="tablist" aria-label="Chargendetails">${tabs.map(([id, label]) => `<button class="tab ${this.ui.chargeTab === id ? 'aktiv' : ''}" type="button" role="tab" aria-selected="${this.ui.chargeTab === id}" data-action="charge-tab" data-tab="${id}">${label}</button>`).join('')}</div>
      ${this.renderChargeTab(charge)}
      ${charge.archiviert ? '' : `<div class="button-grid"><button class="btn btn-haupt" type="button" data-action="erfassen">${icon('messung', 'icon-klein')} Erfassen</button><button class="btn" type="button" data-action="nav" data-view="rechner">${icon('rechner', 'icon-klein')} Zugabe berechnen</button><button class="btn" type="button" data-action="nav" data-view="gate">${icon('gate', 'icon-klein')} Gate prüfen</button><button class="btn" type="button" data-action="nav" data-view="umverteilen">Umverteilen</button></div>${naechstePhase ? `<div class="karte"><label for="phase-auswahl">Auf frühere Phase zurücksetzen</label><select id="phase-auswahl" data-action="phase">${PHASEN_REIHE.slice(0, phaseIndex + 1).map(eintrag => `<option value="${eintrag}" ${eintrag === charge.phase ? 'selected' : ''}>${html(PHASEN_LABEL[eintrag])}</option>`).join('')}</select><div class="hint">Vorwärts geht es nur Schritt für Schritt. Dadurch kann kein Gate übersprungen werden.</div>${gate ? `<button class="btn btn-haupt" type="button" data-action="phase-weiter" ${gate.freigegeben && ampel !== 'RED' ? '' : 'disabled'}>Weiter zu ${html(PHASEN_LABEL[naechstePhase])}</button><div class="hint">${ampel === 'RED' ? 'Die rote Ampel sperrt den Phasenwechsel.' : gate.freigegeben ? 'Gate freigegeben.' : 'Gate blockiert. Unbekannt und nicht erfüllt verhindern den Phasenwechsel.'}</div>` : `<button class="btn" type="button" data-action="phase-weiter" ${ampel === 'RED' ? 'disabled' : ''}>Weiter zu ${html(PHASEN_LABEL[naechstePhase])}</button>${ampel === 'RED' ? '<div class="hint">Die rote Ampel sperrt den Phasenwechsel.</div>' : ''}`}</div>` : ''}`}
    </section>`
  }

  private renderChargeTab(charge: Charge): string {
    if (this.ui.chargeTab === 'befunde') {
      const befunde = befundeFuerCharge(this.stand, charge)
      return befunde.length ? befunde.map(befund => `<div class="befund befund-${befund.ampel.toLowerCase()}"><span class="befund-id">${html(befund.regelId)}</span><div class="befund-titel">${this.fachtext(befund.titel)}</div><div class="befund-text">${this.fachtext(befund.text)}</div>${befund.massnahme ? `<div class="befund-massnahme"><strong>Zu tun:</strong> ${this.fachtext(befund.massnahme)}</div>` : ''}</div>`).join('') : `<div class="erfolgbox">Keine Befunde. Die Regelengine meldet für diese Charge aktuell GREEN.${this.renderErklaerschublade('Wie dieser Befund entsteht', 'Alle Fachregeln wurden mit den aktuell gespeicherten Messungen und Ereignissen geprüft. Für diese Charge liegt derzeit keine Abweichung vor.')}</div>`
    }
    if (this.ui.chargeTab === 'messungen') {
      const messungen = this.stand.messungen.filter(m => m.chargeId === charge.id).sort((a, b) => b.zeit.localeCompare(a.zeit))
      return `<div class="karte protokoll-liste">${messungen.length ? messungen.map(m => `<button class="protokoll-eintrag" type="button" data-action="messung-bearbeiten" data-id="${html(m.id)}"><span>${datumZeitFormat.format(new Date(m.zeit))} · ${html(this.messLabel(m.typ))}</span><b>${m.wert === null ? html(m.text ?? '–') : `${zahlFormat.format(m.wert)} ${html(this.messEinheit(m.typ))}`}${m.methode ? ` · ${html(m.methode)}` : ''}</b><small>Antippen zum Bearbeiten</small></button>`).join('') : '<div class="leer">Noch keine Messungen.</div>'}</div>`
    }
    if (this.ui.chargeTab === 'ereignisse') {
      const ereignisse = this.stand.ereignisse.filter(e => e.chargeId === charge.id).sort((a, b) => b.zeit.localeCompare(a.zeit))
      return `<div class="karte protokoll-liste">${ereignisse.length ? ereignisse.map(e => `<button class="protokoll-eintrag ereignis-eintrag" type="button" data-action="ereignis-bearbeiten" data-id="${html(e.id)}"><span>${html(EREIGNIS_LABEL[e.art])} · ${datumZeitFormat.format(new Date(e.zeit))}</span><b>${e.stoff ? `${html(e.stoff)} · ` : ''}${e.mengeWert === undefined ? '' : `${zahlFormat.format(e.mengeWert)} ${html(e.mengeEinheit)} · `}${e.vorratId ? 'Vorrat abgezogen · ' : ''}${html(e.begruendung)}</b><small>Antippen zum Bearbeiten</small></button>`).join('') : '<div class="leer">Noch keine Ereignisse.</div>'}</div>`
    }
    if (this.ui.chargeTab === 'gefaess') {
      if (charge.archiviert) {
        const behaelter = this.stand.behaelter.find(eintrag => eintrag.id === charge.behaelterId)
        return `<div class="karte"><div class="zeile"><span>Behälter</span><b>${html(behaelter?.name ?? 'nicht zugeordnet')}</b></div><div class="zeile"><span>Erwartete Weinausbeute</span><b>${charge.erwarteteWeinLiter === undefined ? 'nicht erfasst' : `${zahlFormat.format(charge.erwarteteWeinLiter)} L`}</b></div><div class="zeile"><span>Füllvolumen</span><b>${this.fuellvolumenText(charge)}</b></div><div class="zeile"><span>Kopfraum</span><b>${charge.kopfraumLiter === undefined ? 'nicht erfasst' : `${zahlFormat.format(charge.kopfraumLiter)} L`}</b></div>${this.renderVolumenHistorie(charge)}</div>`
      }
      return `<form class="karte" id="gefaess-form"><div class="zeile"><span>Erwartete Weinausbeute</span><b>${charge.erwarteteWeinLiter === undefined ? 'nicht erfasst' : `${zahlFormat.format(charge.erwarteteWeinLiter)} L`}</b></div><div class="zeile"><span>Aktuelles Füllvolumen</span><b>${this.fuellvolumenText(charge)}</b></div><label for="charge-gefaess">Behälter</label><select id="charge-gefaess" name="behaelterId"><option value="">Nicht zugeordnet</option>${this.stand.behaelter.map(b => `<option value="${html(b.id)}" ${b.id === charge.behaelterId ? 'selected' : ''}>${html(b.name)} · ${zahlFormat.format(b.bruttoLiter)} L</option>`).join('')}</select><div class="formular-grid zwei"><div><label for="fuell-liter">Neues Füllvolumen in L</label><input id="fuell-liter" name="fuellLiter" inputmode="decimal" value="${charge.fuellLiter === undefined ? '' : html(formatiereZahl(charge.fuellLiter))}" required></div><div><label for="kopfraum-liter">Neuer Kopfraum in L</label><input id="kopfraum-liter" name="kopfraumLiter" inputmode="decimal" value="${charge.kopfraumLiter === undefined ? '' : html(formatiereZahl(charge.kopfraumLiter))}" required></div></div><label for="volumen-anlass">Anlass *</label><input id="volumen-anlass" name="anlass" value="Manuelle Gefäßaktualisierung" required><label for="volumen-zeit">Zeitpunkt</label><input id="volumen-zeit" name="zeit" type="datetime-local" value="${datetimeLocalWert()}" required><button class="btn" type="submit">Volumenpunkt speichern</button>${this.renderVolumenHistorie(charge)}</form>`
    }
    const ereignisFotoIds = new Set(this.stand.ereignisse.filter(e => e.chargeId === charge.id).flatMap(e => e.fotoIds ?? []))
    const chargeFotos = this.fotos.filter(foto => foto.chargeId === charge.id || ereignisFotoIds.has(foto.id))
    return `<div class="karte">${chargeFotos.length ? `<div class="foto-grid">${chargeFotos.map(foto => { const url = URL.createObjectURL(foto.blob); this.fotoUrls.push(url); return `<img src="${url}" alt="Dokumentationsfoto vom ${datumZeitFormat.format(new Date(foto.zeit))}">` }).join('')}</div>` : '<div class="leer">Noch keine Fotos. Fotos können beim Erfassen eines Ereignisses angehängt werden.</div>'}</div>`
  }

  private fuellvolumenText(charge: Charge): string {
    if (charge.fuellLiter !== undefined) return `${zahlFormat.format(charge.fuellLiter)} L`
    const vorPressen = PHASEN_REIHE.indexOf(charge.phase) <= PHASEN_REIHE.indexOf('PRESS_GATE')
    return charge.typ === 'maische' && vorPressen ? 'noch nicht bestimmbar' : 'nicht erfasst'
  }

  private zugabeVolumen(charge: Charge): number | undefined {
    return charge.fuellLiter ?? charge.erwarteteWeinLiter
  }

  private renderVolumenHistorie(charge: Charge): string {
    const historie = [...(charge.volumenHistorie ?? [])].sort((a, b) => b.zeit.localeCompare(a.zeit))
    if (!historie.length) return '<div class="hint volumen-leer">Noch keine Volumenhistorie.</div>'
    return `<details class="erklaer volumen-details"><summary><span class="erklaer-pfeil" aria-hidden="true">›</span>Volumenhistorie (${historie.length})</summary><div class="erklaer-inhalt">${historie.map(punkt => `<div class="volumenpunkt"><strong>${datumZeitFormat.format(new Date(punkt.zeit))} · ${html(punkt.anlass)}</strong><span>${punkt.fuellLiter === undefined ? 'Füllvolumen offen' : `${zahlFormat.format(punkt.fuellLiter)} L`} · ${punkt.kopfraumLiter === undefined ? 'Kopfraum offen' : `${zahlFormat.format(punkt.kopfraumLiter)} L`} · ${html(this.stand.behaelter.find(behaelter => behaelter.id === punkt.behaelterId)?.name ?? 'ohne Gefäß')}</span></div>`).join('')}</div></details>`
  }

  private renderFehlendeCharge(): string {
    return `<section class="seite"><h1 class="seiten-titel">Charge nicht gefunden</h1><button class="btn" type="button" data-action="nav" data-view="heute">Zur Übersicht</button></section>`
  }

  private renderErfassen(): string {
    const charge = this.aktuelleCharge()
    const tabs: Array<[ErfassenModus, string]> = [['messung', 'Messung'], ['ereignis', 'Ereignis / Zugabe']]
    return `<section class="seite" aria-labelledby="erfassen-titel"><button class="zurueck" type="button" data-action="nav" data-view="${charge ? 'charge' : 'heute'}">${icon('pfeil')}${charge ? html(charge.name) : 'Heute'}</button><h1 class="seiten-titel" id="erfassen-titel">Erfassen</h1><div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${this.ui.erfassenModus === id ? 'aktiv' : ''}" type="button" data-action="erfassen-modus" data-mode="${id}">${label}</button>`).join('')}</div>${this.ui.erfassenModus === 'messung' ? this.renderMessForm() : this.renderEreignisForm()}</section>`
  }

  private renderChargenAuswahl(name = 'chargeIds'): string {
    return `<fieldset><legend>Chargen auswählen</legend><div class="checkbox-liste">${this.aktiveChargen().map(charge => `<div class="checkbox-zeile"><input id="auswahl-${html(charge.id)}" name="${name}" value="${html(charge.id)}" type="checkbox" ${name === 'quellen' || charge.id === this.ui.chargeId ? 'checked' : ''}><label for="auswahl-${html(charge.id)}">${html(charge.name)} · ${html(PHASEN_LABEL[charge.phase])}</label></div>`).join('')}</div></fieldset>`
  }

  private renderMessForm(): string {
    return `${this.renderMessModusUmschalter()}${this.ui.messErfassungModus === 'charge' ? this.renderChargeMessForm() : this.renderMessgroesseForm()}`
  }

  private renderMessModusUmschalter(): string {
    const modi: Array<[MessErfassungModus, string]> = [
      ['charge', 'Ein Bottich / viele Werte'],
      ['messgroesse', 'Ein Wert / alle Bottiche'],
    ]
    return `<div class="mess-modus" role="group" aria-label="Art der Messerfassung">${modi.map(([modus, label]) => `<button class="mess-modus-knopf ${this.ui.messErfassungModus === modus ? 'aktiv' : ''}" type="button" data-action="mess-erfassungsmodus" data-mode="${modus}" aria-pressed="${this.ui.messErfassungModus === modus}">${label}</button>`).join('')}</div>`
  }

  private renderChargeMessForm(): string {
    const charge = this.aktuelleCharge() ?? this.aktiveChargen()[0]
    if (!charge) return '<div class="karte leer">Keine aktive Charge.</div>'
    const relevanteTypen = PHASEN_MESS_TYPEN[charge.phase] ?? []
    const relevanteDefinitionen = relevanteTypen.map(typ => MESS_DEFINITIONEN.find(definition => definition.typ === typ)).filter((definition): definition is MessDefinition => Boolean(definition))
    const weitereDefinitionen = MESS_DEFINITIONEN.filter(definition => !relevanteTypen.includes(definition.typ))
    const gruppenTitel = charge.phase === 'KALTMAZERATION'
      ? 'Jetzt in der Kaltmazeration wichtig'
      : charge.phase === 'AKTIVE_GAERUNG' || charge.phase === 'NACHGAERUNG'
        ? 'Jetzt in der Gärung wichtig'
        : relevanteTypen.length ? 'Jetzt im Ausbau wichtig' : 'Messgrößen'
    const erfolg = this.ui.messRundeErfolg?.chargeId === charge.id ? this.ui.messRundeErfolg : null
    return `<form id="mess-form"><fieldset class="mess-bottich-auswahl" ${erfolg ? 'disabled' : ''}><legend>Welcher Bottich</legend><div class="mess-bottiche">${this.aktiveChargen().map(eintrag => `<button class="mess-bottich ${eintrag.id === charge.id ? 'aktiv' : ''}" type="button" data-action="mess-charge" data-id="${html(eintrag.id)}" aria-pressed="${eintrag.id === charge.id}"><span>${html(eintrag.name)}</span><small>${eintrag.mengeKg === undefined ? 'Menge offen' : `${formatiereZahl(eintrag.mengeKg)} kg`}</small></button>`).join('')}</div></fieldset><input type="hidden" name="chargeId" value="${html(charge.id)}"><h2>${html(gruppenTitel)}</h2><div class="karte messfelder">${relevanteDefinitionen.map(definition => this.renderMessFeld(definition)).join('')}${weitereDefinitionen.length ? `<details class="mess-weitere"><summary><span class="erklaer-pfeil" aria-hidden="true">›</span>Weitere Messgrößen</summary><div>${weitereDefinitionen.map(definition => this.renderMessFeld(definition)).join('')}</div></details>` : ''}</div>${this.renderMessZeitfelder()}<div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit" ${erfolg ? 'disabled' : ''}>Ausgefüllte Werte speichern</button><div class="hint">Leere Felder erzeugen keinen Datensatz. Alle ausgefüllten Werte erhalten denselben Zeitpunkt.</div>${erfolg ? this.renderMessRundeErfolg(erfolg) : ''}</form>`
  }

  private renderMessgroesseForm(): string {
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === this.ui.messTyp) ?? MESS_DEFINITIONEN[0]!
    const ausgewaehlt = new Set(erhalteMessChargenAuswahl(this.ui.messChargeIds, this.aktiveChargen().map(charge => charge.id)))
    return `<form class="karte" id="mess-form"><fieldset><legend>Chargen auswählen</legend><div class="checkbox-liste">${this.aktiveChargen().map(charge => `<div class="checkbox-zeile"><input id="mess-auswahl-${html(charge.id)}" name="chargeIds" value="${html(charge.id)}" type="checkbox" ${ausgewaehlt.has(charge.id) ? 'checked' : ''}><label for="mess-auswahl-${html(charge.id)}">${html(charge.name)} · ${html(PHASEN_LABEL[charge.phase])}</label></div>`).join('')}</div></fieldset><label for="mess-typ">Messgröße</label><select id="mess-typ" name="typ" data-action="mess-typ">${MESS_DEFINITIONEN.map(eintrag => `<option value="${eintrag.typ}" ${eintrag.typ === definition.typ ? 'selected' : ''}>${html(eintrag.label)}</option>`).join('')}</select><div class="mess-einzel-feld">${this.renderMessFeld(definition, true)}</div>${this.renderMessZeitfelder()}<div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Für ausgewählte Chargen speichern</button><div class="hint">Pro Charge wird ein eigener Messdatensatz gespeichert.</div></form>`
  }

  private renderMessFeld(definition: MessDefinition, erforderlich = false): string {
    const entwurf = this.ui.messEntwuerfe[definition.typ] ?? { eingabe: '', methode: 'spindel' as const }
    const feldId = `mess-${definition.typ}`
    const eingabe = definition.art === 'zahl'
      ? `<input id="${feldId}" name="${feldId}" data-mess-eingabe data-mess-typ="${definition.typ}" inputmode="decimal" value="${html(entwurf.eingabe)}" ${erforderlich ? 'required' : ''}>`
      : `<select id="${feldId}" name="${feldId}" data-mess-eingabe data-mess-typ="${definition.typ}" ${erforderlich ? 'required' : ''}><option value="">${erforderlich ? 'Bitte wählen' : 'Nicht erfasst'}</option>${(definition.optionen ?? []).map(option => `<option value="${html(option)}" ${entwurf.eingabe === option ? 'selected' : ''}>${html(option)}</option>`).join('')}</select>`
    const methode = DICHTE_TYPEN.includes(definition.typ) ? `<div class="mess-methode"><label for="methode-${definition.typ}">Messmethode</label><select id="methode-${definition.typ}" name="methode-${definition.typ}" data-action="mess-methode" data-mess-typ="${definition.typ}"><option value="spindel" ${entwurf.methode === 'spindel' ? 'selected' : ''}>Spindel</option><option value="refraktometer" ${entwurf.methode === 'refraktometer' ? 'selected' : ''}>Refraktometer</option><option value="sonstige" ${entwurf.methode === 'sonstige' ? 'selected' : ''}>Sonstige</option></select><div class="mess-methode-hinweis" data-refraktometer-hinweis data-mess-typ="${definition.typ}"></div></div>` : ''
    return `<div class="mess-feld"><div class="mess-feld-label"><label for="${feldId}">${html(definition.label)}</label>${definition.hinweis ? `<small>${html(definition.hinweis)}</small>` : ''}</div>${eingabe}<span class="mess-einheit">${html(definition.einheit)}</span>${methode}</div>`
  }

  private renderMessZeitfelder(): string {
    return `<div class="karte mess-zeit"><label for="mess-zeit">Zeitpunkt für alle Werte</label><input id="mess-zeit" name="zeit" type="datetime-local" value="${html(this.ui.messZeit)}" required><label for="mess-notiz">Notiz für alle Werte (freiwillig)</label><textarea id="mess-notiz" name="notiz">${html(this.ui.messNotiz)}</textarea></div>`
  }

  private renderMessRundeErfolg(erfolg: MessRundeErfolg): string {
    const charge = this.stand.chargen.find(eintrag => eintrag.id === erfolg.chargeId)
    if (!charge) return ''
    const naechsteCharge = this.naechsteAktiveCharge(charge.id)
    const anzahlText = erfolg.typen.length === 1 ? '1 Messung' : `${erfolg.typen.length} Messungen`
    const labels = erfolg.typen.map(typ => this.messLabel(typ)).join(', ')
    return `<div class="mess-runde-erfolg" role="status" aria-live="polite" tabindex="-1"><strong>${anzahlText} für ${html(charge.name)} gespeichert.</strong><span>${html(labels)}</span></div><div class="mess-runde-aktionen">${naechsteCharge ? `<button class="btn btn-haupt" type="button" data-action="mess-runde-weiter" data-id="${html(naechsteCharge.id)}">Weiter zu ${html(naechsteCharge.name)}</button>` : ''}<button class="btn" type="button" data-action="mess-runde-beenden">Runde beenden</button></div>`
  }

  private naechsteAktiveCharge(chargeId: string): Charge | undefined {
    const aktiveChargen = this.aktiveChargen()
    const index = aktiveChargen.findIndex(charge => charge.id === chargeId)
    return index < 0 ? undefined : aktiveChargen[index + 1]
  }

  private renderEreignisForm(): string {
    return `<form class="karte" id="ereignis-form">${this.renderChargenAuswahl()}<label for="ereignis-art">Art</label><select id="ereignis-art" name="art" data-action="ereignis-art">${Object.entries(EREIGNIS_LABEL).map(([wert, label]) => `<option value="${wert}">${html(label)}</option>`).join('')}</select><div id="zugabe-felder"></div><label for="ereignis-zeit">Zeitpunkt</label><input id="ereignis-zeit" name="zeit" type="datetime-local" value="${datetimeLocalWert()}" required><label for="ereignis-grund">Begründung *</label><textarea id="ereignis-grund" name="begruendung" required placeholder="Warum wird dieser Schritt jetzt ausgeführt?"></textarea><label for="ereignis-fotos">Fotos (freiwillig)</label><input id="ereignis-fotos" name="fotos" type="file" accept="image/*" multiple><div class="hint">Fotos werden als Blob getrennt vom Datenstand in IndexedDB gespeichert.</div><div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Für ausgewählte Chargen speichern</button><div class="hint">Jede ausgewählte Charge erhält einen eigenen Ereignisdatensatz. Zugabemengen werden aus ihrem jeweiligen Volumen berechnet.</div></form>`
  }

  private renderMessungBearbeiten(): string {
    const messung = this.stand.messungen.find(eintrag => eintrag.id === this.ui.editMessungId)
    if (!messung) return `<section class="seite"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}Zur Charge</button><div class="fehlerbox">Messung nicht gefunden.</div></section>`
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === messung.typ)
    if (!definition) return `<section class="seite"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}Zur Charge</button><div class="fehlerbox">Unbekannte Messgröße.</div></section>`
    const wertFeld = definition.art === 'zahl'
      ? `<label for="messung-edit-wert">Wert in ${html(definition.einheit || 'Zahlen')}</label><input id="messung-edit-wert" name="wert" inputmode="decimal" value="${messung.wert === null ? '' : html(zahlFormat.format(messung.wert))}" required>`
      : `<label for="messung-edit-text">Wert</label><select id="messung-edit-text" name="text" required>${(definition.optionen ?? []).map(option => `<option value="${html(option)}" ${option === messung.text ? 'selected' : ''}>${html(option)}</option>`).join('')}</select>`
    const methodeFeld = DICHTE_TYPEN.includes(messung.typ)
      ? `<label for="messung-edit-methode">Messmethode</label><select id="messung-edit-methode" name="methode"><option value="spindel" ${messung.methode === 'spindel' ? 'selected' : ''}>Spindel</option><option value="refraktometer" ${messung.methode === 'refraktometer' ? 'selected' : ''}>Refraktometer</option><option value="sonstige" ${messung.methode === 'sonstige' ? 'selected' : ''}>Sonstige</option></select>`
      : ''
    return `<section class="seite" aria-labelledby="messung-edit-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(this.stand.chargen.find(charge => charge.id === messung.chargeId)?.name ?? 'Charge')}</button><h1 class="seiten-titel" id="messung-edit-titel">Messung bearbeiten</h1><form class="karte" id="messung-bearbeiten-form"><div class="zeile"><span>Messgröße</span><b>${html(definition.label)}</b></div><label for="messung-edit-charge">Charge</label><select id="messung-edit-charge" name="chargeId" required>${this.stand.chargen.map(charge => `<option value="${html(charge.id)}" ${charge.id === messung.chargeId ? 'selected' : ''}>${html(charge.name)}${charge.archiviert ? ' · archiviert' : ''}</option>`).join('')}</select>${wertFeld}${methodeFeld}<label for="messung-edit-zeit">Zeitpunkt</label><input id="messung-edit-zeit" name="zeit" type="datetime-local" value="${html(datetimeLocalWert(messung.zeit))}" required><label for="messung-edit-notiz">Notiz</label><textarea id="messung-edit-notiz" name="notiz">${html(messung.notiz ?? '')}</textarea><div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Änderungen speichern</button><div class="gefahr-zone"><button class="btn btn-gefahr" type="button" data-action="messung-loeschen" data-id="${html(messung.id)}">Messung löschen</button></div></form></section>`
  }

  private renderEreignisBearbeiten(): string {
    const ereignis = this.stand.ereignisse.find(eintrag => eintrag.id === this.ui.editEreignisId)
    if (!ereignis) return `<section class="seite"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}Zur Charge</button><div class="fehlerbox">Ereignis nicht gefunden.</div></section>`
    return `<section class="seite" aria-labelledby="ereignis-edit-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(this.stand.chargen.find(charge => charge.id === ereignis.chargeId)?.name ?? 'Charge')}</button><h1 class="seiten-titel" id="ereignis-edit-titel">Ereignis bearbeiten</h1><form class="karte" id="ereignis-bearbeiten-form"><label for="ereignis-edit-charge">Charge</label><select id="ereignis-edit-charge" name="chargeId" required>${this.stand.chargen.map(charge => `<option value="${html(charge.id)}" ${charge.id === ereignis.chargeId ? 'selected' : ''}>${html(charge.name)}${charge.archiviert ? ' · archiviert' : ''}</option>`).join('')}</select><label for="ereignis-edit-art">Art</label><select id="ereignis-edit-art" name="art">${Object.entries(EREIGNIS_LABEL).map(([wert, label]) => `<option value="${wert}" ${wert === ereignis.art ? 'selected' : ''}>${html(label)}</option>`).join('')}</select><label for="ereignis-edit-zeit">Zeitpunkt</label><input id="ereignis-edit-zeit" name="zeit" type="datetime-local" value="${html(datetimeLocalWert(ereignis.zeit))}" required><label for="ereignis-edit-stoff">Stoff</label><input id="ereignis-edit-stoff" name="stoff" value="${html(ereignis.stoff ?? '')}"><label for="ereignis-edit-produkt">Produkt</label><input id="ereignis-edit-produkt" name="produkt" value="${html(ereignis.produkt ?? '')}"><div class="formular-grid zwei"><div><label for="ereignis-edit-menge">Menge</label><input id="ereignis-edit-menge" name="mengeWert" inputmode="decimal" value="${ereignis.mengeWert === undefined ? '' : html(zahlFormat.format(ereignis.mengeWert))}"></div><div><label for="ereignis-edit-einheit">Einheit</label><select id="ereignis-edit-einheit" name="mengeEinheit"><option value="">Keine</option>${['g', 'kg', 'ml', 'L', 'Beutel'].map(option => `<option value="${option}" ${option === ereignis.mengeEinheit ? 'selected' : ''}>${option}</option>`).join('')}</select></div></div><label for="ereignis-edit-vorrat">Vorratsposten</label><select id="ereignis-edit-vorrat" name="vorratId"><option value="">Ohne Vorratsbuchung</option>${this.stand.vorrat.map(posten => `<option value="${html(posten.id)}" ${posten.id === ereignis.vorratId ? 'selected' : ''}>${html(posten.name)} · ${zahlFormat.format(posten.mengeWert)} ${html(posten.mengeEinheit)}</option>`).join('')}</select><label for="ereignis-edit-grund">Begründung *</label><textarea id="ereignis-edit-grund" name="begruendung" required>${html(ereignis.begruendung)}</textarea><div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Änderungen speichern</button><div class="gefahr-zone"><button class="btn btn-gefahr" type="button" data-action="ereignis-loeschen" data-id="${html(ereignis.id)}">Ereignis löschen</button></div></form></section>`
  }

  private renderZugabeFelder(art: EreignisArt): string {
    if (VOLUMEN_EREIGNIS_ARTEN.includes(art)) {
      const charge = this.aktuelleCharge()
      return `<div class="formular-grid zwei"><div><label for="ereignis-fuell-liter">Füllvolumen nach dem Vorgang *</label><input id="ereignis-fuell-liter" name="fuellLiter" inputmode="decimal" value="${charge?.fuellLiter === undefined ? '' : html(formatiereZahl(charge.fuellLiter))}" required></div><div><label for="ereignis-kopfraum-liter">Kopfraum nach dem Vorgang *</label><input id="ereignis-kopfraum-liter" name="kopfraumLiter" inputmode="decimal" value="${charge?.kopfraumLiter === undefined ? '' : html(formatiereZahl(charge.kopfraumLiter))}" required></div></div><label for="ereignis-behaelter">Behälter nach dem Vorgang *</label><select id="ereignis-behaelter" name="behaelterId" required><option value="">Bitte wählen</option>${this.stand.behaelter.map(behaelter => `<option value="${html(behaelter.id)}" ${behaelter.id === charge?.behaelterId ? 'selected' : ''}>${html(behaelter.name)} · ${zahlFormat.format(behaelter.bruttoLiter)} L</option>`).join('')}</select><div class="hint">Die App hängt für jede ausgewählte Charge einen neuen Volumenpunkt an.</div>`
    }
    if (!ZUGABE_ARTEN.includes(art)) return '<div class="info-box">Für dieses Ereignis ist keine Zugabemenge erforderlich.</div>'
    const defaults: Partial<Record<EreignisArt, [string, string]>> = {
      schwefeln: ['Kaliumpyrosulfit', 'g'], aufzuckern: ['Haushaltszucker', 'g'], naehrsalz: ['Hefenährsalz', 'g'], hefe: ['Reinzuchthefe Steinberg', 'Beutel'], suessen: ['Zucker', 'g'], stabilisieren: ['Stabilisierungsmittel', 'g'],
    }
    const [stoff, einheit] = defaults[art] ?? ['', 'g']
    const standardVorrat = VORRAT_NACH_ART[art]
    return `<label for="ereignis-stoff">Stoff *</label><input id="ereignis-stoff" name="stoff" value="${html(stoff)}" required><label for="ereignis-produkt">Produkt</label><input id="ereignis-produkt" name="produkt"><div class="formular-grid zwei"><div><label for="ereignis-dosis">Dosierung je Liter *</label><input id="ereignis-dosis" name="dosisProLiter" inputmode="decimal" required></div><div><label for="ereignis-einheit">Einheit *</label><select id="ereignis-einheit" name="mengeEinheit">${['g', 'kg', 'ml', 'L', 'Beutel'].map(option => `<option value="${option}" ${option === einheit ? 'selected' : ''}>${option}</option>`).join('')}</select></div></div><label for="ereignis-vorrat">Vorratsposten</label><select id="ereignis-vorrat" name="vorratId"><option value="">Ohne Vorratsbuchung</option>${this.stand.vorrat.map(posten => `<option value="${html(posten.id)}" ${posten.id === standardVorrat ? 'selected' : ''}>${html(posten.name)} · ${zahlFormat.format(posten.mengeWert)} ${html(posten.mengeEinheit)}</option>`).join('')}</select><div class="hint">Gespeicherte Menge je Charge = Dosierung je Liter × Füllvolumen. Ein verknüpfter Vorratsposten wird automatisch vermindert.</div><div id="zugabe-vorschau"></div>`
  }

  private renderRechner(): string {
    const charge = this.aktuelleCharge()
    if (!charge) return this.renderFehlendeCharge()
    const letztePh = this.letzteMessung(charge.id, 'ph')?.wert
    const tabs: Array<[RechnerTyp, string]> = [['schwefeln', 'Schwefeln'], ['aufzuckern', 'Aufzuckern'], ['naehrsalz', 'Nährsalz']]
    const volumen = this.zugabeVolumen(charge)
    return `<section class="seite" aria-labelledby="rechner-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><h1 class="seiten-titel" id="rechner-titel">Zugabe berechnen</h1><div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${this.ui.rechnerTyp === id ? 'aktiv' : ''}" type="button" data-action="rechner-tab" data-rechner="${id}">${label}</button>`).join('')}</div><form class="karte" id="rechner-form"><label for="rechner-volumen">Rechenvolumen</label><input id="rechner-volumen" name="volumen" inputmode="decimal" value="${volumen === undefined ? '' : html(formatiereZahl(volumen))}" required><div class="hint">Liter · ${charge.fuellLiter === undefined && charge.erwarteteWeinLiter !== undefined ? 'erwartete Weinausbeute, weil das Füllvolumen der Maische noch nicht bestimmbar ist' : 'gemessenes Füllvolumen der Charge'}</div>${this.ui.rechnerTyp === 'schwefeln' ? `<label for="rechner-ph">pH-Wert</label><input id="rechner-ph" name="ph" inputmode="decimal" value="${letztePh == null ? '' : html(formatiereZahl(letztePh, 2))}" placeholder="nicht gemessen"><label for="rechner-frei">Freier SO₂ (Istwert)</label><input id="rechner-frei" name="frei" inputmode="decimal" placeholder="nicht gemessen"><div class="hint">Leer lassen, wenn nicht titriert. Dann liefert die App eine geschätzte Obergrenze.</div>` : ''}${this.ui.rechnerTyp === 'aufzuckern' ? `<label for="rechner-ist">Mostgewicht Ist</label><input id="rechner-ist" name="istOe" inputmode="decimal" required><div class="hint">°Oe · gemessen</div><label for="rechner-ziel">Mostgewicht Ziel</label><input id="rechner-ziel" name="zielOe" inputmode="decimal" required><div id="alkohol-potenzial"></div>` : ''}<div id="rechner-ausgabe"></div></form></section>`
  }

  private renderGate(): string {
    const charge = this.aktuelleCharge()
    if (!charge) return this.renderFehlendeCharge()
    const gate = gateFuerPhase(this.stand, charge)
    if (!gate) return `<section class="seite"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><h1 class="seiten-titel">Gate prüfen</h1><div class="info-box">Für die aktuelle Phase ${html(PHASEN_LABEL[charge.phase])} ist kein Gate definiert. Gates werden ausschließlich in den Gate-Phasen durch <code>gateFuerPhase()</code> erzeugt.</div><button class="btn" type="button" data-action="nav" data-view="charge">Zur Charge</button></section>`
    const phaseIndex = PHASEN_REIHE.indexOf(charge.phase)
    const naechstePhase = PHASEN_REIHE[phaseIndex + 1]
    const chargeGesperrt = ampelFuerCharge(this.stand, charge) === 'RED'
    if (gate.freigegeben && !chargeGesperrt) {
      return `<section class="seite gate-fluss" aria-labelledby="gate-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><div class="gate-kopf"><div><span class="gate-schritt">Prüfungen abgeschlossen</span><h1 class="seiten-titel" id="gate-titel">${html(gate.titel)}</h1></div>${this.renderAmpel('GREEN')}</div><div class="erfolgbox"><strong>Alle ${gate.checks.length} Prüfungen sind erfüllt.</strong> Die Handlung ist freigegeben.</div>${gate.gate === 'PRESS_GATE' ? this.renderPressTeilung(charge) : `<div class="gate-handlung karte"><h2>Handlung</h2><p>${naechstePhase ? `Die Charge kann jetzt in die Phase ${html(PHASEN_LABEL[naechstePhase])} wechseln.` : 'Keine weitere Phase vorhanden.'}</p><button class="btn btn-haupt" type="button" data-action="phase-weiter" ${naechstePhase ? '' : 'disabled'}>${naechstePhase ? `Weiter zu ${html(PHASEN_LABEL[naechstePhase])}` : 'Keine weitere Phase'}</button></div>`}</section>`
    }
    const index = Math.min(Math.max(0, this.ui.gateCheckIndex), Math.max(0, gate.checks.length - 1))
    const check = gate.checks[index]!
    const status = chargeGesperrt ? 'Charge gesperrt' : check.erfuellt === true ? 'Erfüllt' : check.erfuellt === false ? 'Noch nicht erfüllt' : 'Noch offen'
    return `<section class="seite gate-fluss" aria-labelledby="gate-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><div class="gate-kopf"><div><span class="gate-schritt">Prüfung ${index + 1} von ${gate.checks.length}</span><h1 class="seiten-titel" id="gate-titel">${html(gate.titel)}</h1></div>${this.renderAmpel(chargeGesperrt ? 'RED' : 'YELLOW')}</div><div class="gate-fortschritt" aria-hidden="true">${gate.checks.map((eintrag, nummer) => `<i class="${eintrag.erfuellt === true ? 'ok' : ''} ${nummer === index ? 'aktiv' : ''}"></i>`).join('')}</div><article class="gate-frage karte" data-gate-open><span class="gate-status ${check.erfuellt === null ? 'unbekannt' : check.erfuellt ? 'erfuellt' : 'offen'}">${html(status)}</span><h2>${this.fachtext(check.frage)}</h2><p>${this.fachtext(check.begruendung)}</p>${chargeGesperrt ? '<div class="warnbox">Die Regelengine hat diese Charge gesperrt. Das Gate bleibt zu.</div>' : this.renderGateMessForm(check.id, check.erfuellt)}</article><div class="gate-navigation"><button class="btn" type="button" data-action="gate-zurueck" ${index === 0 ? 'disabled' : ''}>Zurück</button><button class="btn" type="button" data-action="gate-weiter" ${index >= gate.checks.length - 1 ? 'disabled' : ''}>Nächste Prüfung</button></div><button class="btn" type="button" data-action="gate-reminder">Erinnerung zur erneuten Prüfung anlegen</button></section>`
  }

  private gateMessTyp(checkId: string): MessTyp | null {
    if (['press-dichte', 'press-restzucker', 'gaerende-zwei-messungen', 'gaerende-konstant', 'gaerende-trocken', 'stab-restzucker'].includes(checkId)) return 'oechsle'
    if (checkId === 'press-geruch') return 'geruch'
    if (checkId === 'stab-ph') return 'ph'
    if (checkId === 'stab-so2' || checkId === 'suesse-so2') return 'so2_frei'
    if (checkId === 'stab-kopfraum') return 'kopfraum'
    if (checkId === 'abfuell-oberflaeche') return 'oberflaeche'
    return null
  }

  private renderGateMessForm(checkId: string, erfuellt: boolean | null): string {
    if (erfuellt === true) return '<div class="gate-belegt">Diese Prüfung ist durch die gespeicherten Daten belegt.</div>'
    const typ = this.gateMessTyp(checkId)
    if (!typ) return '<div class="gate-belegt">Diese Prüfung hängt nicht von einer Messung ab. Prüfe die Begründung und ergänze die fehlende Voraussetzung.</div>'
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === typ)
    if (!definition) return ''
    const letzte = this.letzteMessung(this.ui.chargeId, typ)
    const feld = definition.art === 'zahl'
      ? `<label for="gate-wert">${html(definition.label)} in ${html(definition.einheit || 'Zahlen')}</label><input id="gate-wert" name="wert" inputmode="decimal" placeholder="${letzte?.wert === null || letzte?.wert === undefined ? '' : html(formatiereZahl(letzte.wert, typ === 'sg' ? 4 : 1))}" required>`
      : `<label for="gate-text">${html(definition.label)}</label><select id="gate-text" name="text" required><option value="">Bitte prüfen und wählen</option>${(definition.optionen ?? []).map(option => `<option value="${html(option)}">${html(option)}</option>`).join('')}</select>`
    const fuellLiter = this.aktuelleCharge()?.fuellLiter
    const fuellstand = typ === 'kopfraum' ? `<label for="gate-fuellwert">Füllstand in L</label><input id="gate-fuellwert" name="fuellwert" inputmode="decimal" value="${fuellLiter === undefined ? '' : html(formatiereZahl(fuellLiter))}" required>` : ''
    const methode = DICHTE_TYPEN.includes(typ) ? '<label for="gate-methode">Messmethode</label><select id="gate-methode" name="methode"><option value="spindel">Spindel</option><option value="refraktometer">Refraktometer</option><option value="sonstige">Sonstige</option></select>' : ''
    return `<form id="gate-mess-form"><input type="hidden" name="typ" value="${typ}"><h3>${erfuellt === null ? 'Fehlende Messung hier erfassen' : 'Aktuellen Wert neu erfassen'}</h3>${fuellstand}${feld}${methode}<label for="gate-mess-zeit">Zeitpunkt</label><input id="gate-mess-zeit" name="zeit" type="datetime-local" value="${datetimeLocalWert()}" required><div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Wert speichern und erneut prüfen</button></form>`
  }

  private renderPressTeilung(charge: Charge): string {
    const heute = this.lokalesIsoDatum(new Date())
    const freieBehaelter = this.stand.behaelter.filter(behaelter => (!behaelter.vorhandenAb || behaelter.vorhandenAb <= heute) && !this.stand.chargen.some(eintrag => !eintrag.archiviert && eintrag.id !== charge.id && eintrag.behaelterId === behaelter.id))
    const optionen = freieBehaelter.map(behaelter => `<option value="${html(behaelter.id)}">${html(behaelter.name)} · ${formatiereZahl(behaelter.bruttoLiter)} L</option>`).join('')
    return `<form class="karte press-teilung" id="press-teilung-form"><h2>Pressen dokumentieren</h2><p>Vorlauf und Presswein bleiben getrennte Chargen. Füllvolumen, Kopfraum und Gefäß werden beim Anlegen festgehalten.</p><div class="press-spalten"><fieldset><legend>Vorlauf</legend><label for="vorlauf-liter">Füllvolumen in L</label><input id="vorlauf-liter" name="vorlaufLiter" inputmode="decimal" required><label for="vorlauf-kopfraum">Kopfraum in L</label><input id="vorlauf-kopfraum" name="vorlaufKopfraum" inputmode="decimal" required><label for="vorlauf-behaelter">Gefäß</label><select id="vorlauf-behaelter" name="vorlaufBehaelter" required><option value="">Bitte wählen</option>${optionen}</select></fieldset><fieldset><legend>Presswein</legend><label for="presswein-liter">Füllvolumen in L</label><input id="presswein-liter" name="pressweinLiter" inputmode="decimal" required><label for="presswein-kopfraum">Kopfraum in L</label><input id="presswein-kopfraum" name="pressweinKopfraum" inputmode="decimal" required><label for="presswein-behaelter">Gefäß</label><select id="presswein-behaelter" name="pressweinBehaelter" required><option value="">Bitte wählen</option>${optionen}</select></fieldset></div><label for="press-zeit">Zeitpunkt</label><input id="press-zeit" name="zeit" type="datetime-local" value="${datetimeLocalWert()}" required><div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Zwei Chargen anlegen und Maische archivieren</button></form>`
  }

  private async speichereGateMessung(formular: HTMLFormElement): Promise<void> {
    const charge = this.aktuelleCharge()
    if (!charge || charge.archiviert) return this.formularFehler('Die aktive Charge fehlt.')
    const daten = new FormData(formular)
    const typ = String(daten.get('typ')) as MessTyp
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === typ)
    if (!definition) return this.formularFehler('Unbekannte Messgröße.')
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const geaendert = new Date().toISOString()
    const messungen: Messung[] = []
    if (typ === 'kopfraum') {
      const fuellstand = parseDeZahl(daten.get('fuellwert'))
      const kopfraum = parseDeZahl(daten.get('wert'))
      if (fuellstand === null || kopfraum === null || fuellstand < 0 || kopfraum < 0) return this.formularFehler('Füllstand und Kopfraum vollständig in Litern eintragen.')
      messungen.push(
        { id: id('messung'), zuletztGeaendert: geaendert, chargeId: charge.id, zeit, typ: 'volumen', wert: fuellstand },
        { id: id('messung'), zuletztGeaendert: geaendert, chargeId: charge.id, zeit, typ: 'kopfraum', wert: kopfraum },
      )
    } else if (definition.art === 'zahl') {
      const wert = parseDeZahl(daten.get('wert'))
      if (wert === null) return this.formularFehler('Trage einen gültigen Zahlenwert ein.')
      messungen.push({ id: id('messung'), zuletztGeaendert: geaendert, chargeId: charge.id, zeit, typ, wert, methode: DICHTE_TYPEN.includes(typ) ? String(daten.get('methode') ?? 'spindel') as MessMethode : undefined })
    } else {
      const text = String(daten.get('text') ?? '').trim()
      if (!text) return this.formularFehler('Wähle den geprüften Befund aus.')
      messungen.push({ id: id('messung'), zuletztGeaendert: geaendert, chargeId: charge.id, zeit, typ, wert: null, text })
    }
    this.stand.messungen.push(...messungen)
    this.aktualisiereVolumenAusMessungen(messungen)
    await this.speichereLokalUndStarteAbgleich()
    const gate = gateFuerPhase(this.stand, charge)
    if (!gate?.freigegeben) this.ui.gateCheckIndex = Math.min(this.ui.gateCheckIndex + 1, Math.max(0, (gate?.checks.length ?? 1) - 1))
    this.render()
  }

  private async speicherePressTeilung(formular: HTMLFormElement): Promise<void> {
    const quelle = this.aktuelleCharge()
    if (!quelle || quelle.archiviert || quelle.phase !== 'PRESS_GATE') return this.formularFehler('Die Press-Charge ist nicht mehr aktiv.')
    const gate = gateFuerPhase(this.stand, quelle)
    if (!gate?.freigegeben || ampelFuerCharge(this.stand, quelle) === 'RED') return this.formularFehler('Das Press-Gate ist nicht mehr freigegeben.')
    const mischPruefung = vermischungErlaubt(this.stand, quelle, quelle)
    if (!mischPruefung.erlaubt) return this.formularFehler(mischPruefung.grund)
    const daten = new FormData(formular)
    const vorlaufLiter = parseDeZahl(daten.get('vorlaufLiter'))
    const vorlaufKopfraum = parseDeZahl(daten.get('vorlaufKopfraum'))
    const pressweinLiter = parseDeZahl(daten.get('pressweinLiter'))
    const pressweinKopfraum = parseDeZahl(daten.get('pressweinKopfraum'))
    const vorlaufBehaelter = String(daten.get('vorlaufBehaelter') ?? '')
    const pressweinBehaelter = String(daten.get('pressweinBehaelter') ?? '')
    if (vorlaufLiter === null || pressweinLiter === null || vorlaufKopfraum === null || pressweinKopfraum === null || vorlaufLiter <= 0 || pressweinLiter <= 0 || vorlaufKopfraum < 0 || pressweinKopfraum < 0) return this.formularFehler('Liter und Kopfraum für beide Teilchargen vollständig eintragen.')
    if (!vorlaufBehaelter || !pressweinBehaelter || vorlaufBehaelter === pressweinBehaelter) return this.formularFehler('Wähle zwei verschiedene Gefäße.')
    const pruefeKapazitaet = (behaelterId: string, fuellLiter: number, kopfraumLiter: number) => {
      const behaelter = this.stand.behaelter.find(eintrag => eintrag.id === behaelterId)
      return behaelter && fuellLiter + kopfraumLiter <= behaelter.bruttoLiter + 0.01
    }
    if (!pruefeKapazitaet(vorlaufBehaelter, vorlaufLiter, vorlaufKopfraum) || !pruefeKapazitaet(pressweinBehaelter, pressweinLiter, pressweinKopfraum)) return this.formularFehler('Füllvolumen plus Kopfraum überschreitet die Gefäßgröße.')
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const geaendert = new Date().toISOString()
    const baueCharge = (typ: 'vorlauf' | 'presswein', name: string, fuellLiter: number, kopfraumLiter: number, behaelterId: string): Charge => ({
      id: id('charge'), zuletztGeaendert: geaendert, jahrgang: quelle.jahrgang, name, typ, phase: 'NACHGAERUNG', phaseSeit: zeit, startdatum: quelle.startdatum, elternChargeId: quelle.id, behaelterId, erwarteteWeinLiter: fuellLiter,
      volumenHistorie: [{ zeit, fuellLiter, kopfraumLiter, behaelterId, anlass: typ === 'vorlauf' ? 'Pressen · Vorlauf' : 'Pressen · Presswein' }], fuellLiter, kopfraumLiter, gesperrt: false, isoliert: false,
    })
    const vorlauf = baueCharge('vorlauf', `Vorlauf · ${quelle.name}`, vorlaufLiter, vorlaufKopfraum, vorlaufBehaelter)
    const presswein = baueCharge('presswein', `Presswein · ${quelle.name}`, pressweinLiter, pressweinKopfraum, pressweinBehaelter)
    quelle.archiviert = true
    markiereGeaendert(quelle, geaendert)
    this.stand.chargen.push(vorlauf, presswein)
    this.stand.ereignisse.push({ id: id('ereignis'), zuletztGeaendert: geaendert, chargeId: quelle.id, zeit, art: 'pressen', mengeWert: vorlaufLiter + pressweinLiter, mengeEinheit: 'L', begruendung: 'Press-Gate erfüllt. Vorlauf und Presswein getrennt erfasst.' })
    this.ui.chargeId = vorlauf.id
    this.ui.status = { art: 'erfolg', text: 'Vorlauf und Presswein wurden angelegt; die Maische-Charge ist archiviert.' }
    this.ui.ansicht = 'heute'
    await this.speichereLokalUndStarteAbgleich()
    this.schreibeHistory(true)
    this.render()
  }

  private renderTermine(): string {
    const sortiert = [...this.stand.reminder].sort((a, b) => a.faellig.localeCompare(b.faellig))
    return `<section class="seite" aria-labelledby="termine-titel"><h1 class="seiten-titel" id="termine-titel">Termine & Erinnerungen</h1><div class="karte">${sortiert.length ? sortiert.map(reminder => this.renderReminder(reminder)).join('') : '<div class="leer">Keine Termine.</div>'}</div><button class="btn btn-haupt" type="button" data-action="ics-alle">${icon('download', 'icon-klein')} Alle Termine als .ics</button><form class="karte" id="reminder-form"><h2>Termin anlegen</h2><label for="reminder-titel">Titel</label><input id="reminder-titel" name="titel" required><label for="reminder-beschreibung">Beschreibung</label><textarea id="reminder-beschreibung" name="beschreibung" required></textarea><label for="reminder-faellig">Fällig</label><input id="reminder-faellig" name="faellig" type="datetime-local" value="${datetimeLocalWert()}" required><button class="btn" type="submit">Termin speichern</button></form><div class="info-box">Die App erzeugt Kalenderdateien mit Erinnerung. Sie baut kein eigenes Push- oder Benachrichtigungssystem.</div></section>`
  }

  private renderReminder(reminder: Reminder): string {
    const datum = new Date(reminder.faellig)
    const faellig = !reminder.erledigt && datum.getTime() <= Date.now()
    return `<div class="termin ${faellig ? 'faellig' : ''}"><div class="termin-datum"><strong>${datum.getDate().toString().padStart(2, '0')}</strong><small>${MONATE[datum.getMonth()]}</small></div><div class="termin-inhalt"><button class="termin-oeffnen" type="button" data-action="reminder-oeffnen" data-id="${html(reminder.id)}"><strong>${html(reminder.titel)}${reminder.erledigt ? ' · erledigt' : ''}</strong><small>${html(reminder.beschreibung)}</small></button><div class="termin-aktionen"><button class="text-knopf" type="button" data-action="ics-einzel" data-id="${html(reminder.id)}">In Kalender übernehmen</button><button class="text-knopf" type="button" data-action="reminder-toggle" data-id="${html(reminder.id)}">${reminder.erledigt ? 'Wieder öffnen' : 'Erledigt'}</button></div></div></div>`
  }

  private renderWiki(): string {
    const tags = [...new Set(this.stand.wiki.flatMap(seite => seite.tags))].sort((a, b) => a.localeCompare(b, 'de'))
    return `<section class="seite" aria-labelledby="wiki-titel"><h1 class="seiten-titel" id="wiki-titel">Wiki</h1><div class="wiki-suche">${icon('suche')}<label class="sr-only" for="wiki-suche">Wiki durchsuchen</label><input id="wiki-suche" placeholder="Suchen, zum Beispiel Kopfraum oder SO₂" value="${html(this.ui.wikiFilter)}"></div><div id="wiki-tags"><button class="tag ${this.ui.wikiTag === null ? 'aktiv' : ''}" type="button" data-action="wiki-tag" data-tag="">Alle</button>${tags.map(tag => `<button class="tag ${this.ui.wikiTag === tag ? 'aktiv' : ''}" type="button" data-action="wiki-tag" data-tag="${html(tag)}">${html(tag)}</button>`).join('')}</div><div class="karte" id="wiki-liste">${this.renderWikiListe()}</div><button class="btn" type="button" data-action="wiki-neu">${icon('plus', 'icon-klein')} Eigene Seite anlegen</button></section>`
  }

  private renderWikiListe(): string {
    const suche = this.ui.wikiFilter.trim().toLocaleLowerCase('de')
    const seiten = this.stand.wiki.filter(seite => (!this.ui.wikiTag || seite.tags.includes(this.ui.wikiTag)) && (!suche || `${seite.titel} ${seite.inhalt} ${seite.tags.join(' ')}`.toLocaleLowerCase('de').includes(suche)))
    if (!seiten.length) return '<div class="leer">Keine Seite passt zur Suche.</div>'
    return seiten.map(seite => `<button class="wiki-eintrag" type="button" data-action="wiki-oeffnen" data-id="${html(seite.id)}"><strong>${html(seite.titel)}</strong><small>${html(this.wikiAuszug(seite.inhalt))}</small><div>${seite.tags.map(tag => `<span class="tag">${html(tag)}</span>`).join('')}</div></button>`).join('')
  }

  private renderWikiSeite(): string {
    const seite = this.stand.wiki.find(eintrag => eintrag.id === this.ui.wikiId)
    if (!seite) return `<section class="seite"><button class="zurueck" type="button" data-action="nav" data-view="wiki">${icon('pfeil')}Wiki</button><div class="fehlerbox">Seite nicht gefunden.</div></section>`
    const postMortem = seite.slug === '2025-post-mortem'
    return `<section class="seite" aria-labelledby="wiki-seiten-titel"><button class="zurueck" type="button" data-action="nav" data-view="wiki">${icon('pfeil')}Wiki</button><h1 class="seiten-titel" id="wiki-seiten-titel">${html(seite.titel)}</h1><div>${seite.tags.map(tag => `<span class="tag">${html(tag)}</span>`).join('')}</div>${postMortem ? '<div class="fehlerbox"><strong>Beweisstatus bleibt getrennt:</strong> GESICHERT, WAHRSCHEINLICH und OFFEN werden nicht zusammengeführt.</div>' : ''}<article class="karte markdown">${this.markdown(seite.inhalt)}</article><button class="btn" type="button" data-action="wiki-bearbeiten" data-id="${html(seite.id)}">Seite bearbeiten</button></section>`
  }

  private renderWikiEditor(): string {
    const seite = this.stand.wiki.find(eintrag => eintrag.id === this.ui.wikiId)
    return `<section class="seite" aria-labelledby="wiki-editor-titel"><button class="zurueck" type="button" data-action="nav" data-view="${seite ? 'wiki-seite' : 'wiki'}">${icon('pfeil')}Abbrechen</button><h1 class="seiten-titel" id="wiki-editor-titel">${seite ? 'Wiki-Seite bearbeiten' : 'Wiki-Seite anlegen'}</h1><form class="karte" id="wiki-form"><input type="hidden" name="id" value="${html(seite?.id ?? '')}"><label for="wiki-titel-feld">Titel</label><input id="wiki-titel-feld" name="titel" value="${html(seite?.titel ?? '')}" required><label for="wiki-tags-feld">Tags</label><input id="wiki-tags-feld" name="tags" value="${html(seite?.tags.join(', ') ?? '')}" placeholder="Gärung, Eigene Notizen"><div class="hint">Mit Komma trennen.</div><label for="wiki-inhalt">Inhalt</label><textarea id="wiki-inhalt" name="inhalt" rows="16" required>${html(seite?.inhalt ?? '# Überschrift\n\nText')}</textarea><div class="hint">Unterstützt Überschriften, **Fett**, Listen und Links.</div><button class="btn btn-haupt" type="submit">Wiki-Seite speichern</button></form></section>`
  }

  private renderMehr(): string {
    const sensor = this.stand.sensor
    const letzterAbgleich = typeof this.stand.appMeta.letzterAbgleich === 'string'
      ? this.stand.appMeta.letzterAbgleich
      : null
    const abgleichZeit = letzterAbgleich && Number.isFinite(new Date(letzterAbgleich).getTime())
      ? datumZeitFormat.format(new Date(letzterAbgleich))
      : 'noch nie'
    const abgleichHinweis = this.syncLaeuft
      ? 'Abgleich läuft …'
      : navigator.onLine === false || this.syncFehler
        ? 'Nicht abgeglichen'
        : letzterAbgleich ? `Zuletzt abgeglichen: ${abgleichZeit}` : 'Nicht abgeglichen'
    return `<section class="seite" aria-labelledby="mehr-titel"><h1 class="seiten-titel" id="mehr-titel">Mehr</h1><div class="mehr-ziele"><button class="btn" type="button" data-action="nav" data-view="wiki">${icon('buch', 'icon-klein')} Wiki</button><button class="btn" type="button" data-action="messwert-alle">${icon('messung', 'icon-klein')} Ein Wert für alle Gefäße</button></div><h2>Export & Sicherung</h2><div class="karte button-grid"><button class="btn" type="button" data-action="export-md">Jahrgang als Markdown</button><button class="btn" type="button" data-action="export-csv">Messreihen als CSV</button><button class="btn" type="button" data-action="export-json">Vollsicherung als JSON</button><button class="btn" type="button" data-action="export-zip">ZIP inklusive Fotos</button><label class="btn" for="import-json">JSON-Sicherung importieren</label><input class="sr-only" id="import-json" type="file" accept="application/json,.json" data-action="import-json"></div>
      <h2>Kellersensor</h2><form class="karte" id="sensor-form"><label for="sensor-adapter">Adapter</label><select id="sensor-adapter" name="adapter"><option value="shelly-cloud" ${sensor.adapter === 'shelly-cloud' ? 'selected' : ''}>Shelly Cloud</option><option value="govee" ${sensor.adapter === 'govee' ? 'selected' : ''}>Govee</option><option value="generisch-json" ${sensor.adapter === 'generisch-json' ? 'selected' : ''}>Generisches JSON</option></select><label for="sensor-url">HTTPS-Endpunkt</label><input id="sensor-url" name="url" type="url" value="${html(sensor.url)}" placeholder="https://…"><div class="hint">HTTP wird mit einer klaren Mixed-Content-Meldung blockiert.</div><div class="formular-grid zwei"><div><label for="sensor-token">Token</label><input id="sensor-token" name="token" type="password" value="${html(sensor.token ?? '')}" autocomplete="off"></div><div><label for="sensor-id">Geräte-ID</label><input id="sensor-id" name="geraeteId" value="${html(sensor.geraeteId ?? '')}"></div><div><label for="sensor-temp-pfad">JSON-Pfad Temperatur</label><input id="sensor-temp-pfad" name="pfadTemperatur" value="${html(sensor.pfadTemperatur ?? '')}" placeholder="data.temp"></div><div><label for="sensor-feuchte-pfad">JSON-Pfad Feuchte</label><input id="sensor-feuchte-pfad" name="pfadFeuchte" value="${html(sensor.pfadFeuchte ?? '')}" placeholder="data.humidity"></div></div><div id="sensor-fehler" role="alert"></div><div class="balken-actions"><button class="btn" type="submit" name="sensorAktion" value="speichern">Konfiguration speichern</button><button class="btn btn-haupt" type="submit" name="sensorAktion" value="testen">Verbindung testen</button></div></form>
      <h2>Manueller Klimawert</h2><form class="karte" id="klima-form"><div class="formular-grid zwei"><div><label for="klima-temp">Temperatur in °C</label><input id="klima-temp" name="temperatur" inputmode="decimal" required></div><div><label for="klima-feuchte">Feuchte in %</label><input id="klima-feuchte" name="feuchte" inputmode="decimal"></div></div><button class="btn btn-haupt" type="submit">Manuell speichern</button><div class="hint">Funktioniert immer und bleibt der Standardweg.</div></form>
      <h2>Behälter</h2><div class="karte">${this.stand.behaelter.map(behaelter => { const charge = this.stand.chargen.find(c => c.behaelterId === behaelter.id && !c.archiviert); return `<div class="zeile"><span>${html(behaelter.name)} · ${zahlFormat.format(behaelter.bruttoLiter)} L</span><b>${charge ? `belegt: ${html(charge.name)}` : behaelter.vorhandenAb ? `ab ${datumFormat.format(new Date(`${behaelter.vorhandenAb}T12:00:00`))}` : 'frei'}</b></div>` }).join('')}</div>
      <div class="fassung"><div>Fassung vom ${BUILD_ZEIT_FORMAT.format(new Date(__BUILD_TIMESTAMP__))} (${html(__BUILD_COMMIT__)})</div><div class="abgleich-zeile"><span>Abgleich: ${html(abgleichZeit)}</span><button class="btn btn-klein" type="button" data-action="sync-jetzt" ${this.syncLaeuft ? 'disabled' : ''}>Jetzt abgleichen</button></div><small class="abgleich-hinweis" aria-live="polite">${html(abgleichHinweis)}</small></div>
    </section>`
  }

  private renderUmverteilen(): string {
    return `<section class="seite" aria-labelledby="umverteilen-titel"><button class="zurueck" type="button" data-action="nav" data-view="heute">${icon('pfeil')}Heute</button><h1 class="seiten-titel" id="umverteilen-titel">Chargen umverteilen</h1><div class="info-box">Eine Quelle kann auf mehrere Chargen aufgeteilt werden. Mehrere Quellen können zusammengeführt und in einem Vorgang neu verteilt werden. Ausgangschargen bleiben archiviert und über ihre IDs nachvollziehbar.</div><form class="karte" id="umverteilen-form">${this.renderChargenAuswahl('quellen')}<label for="ziel-anzahl">Anzahl Zielchargen</label><select id="ziel-anzahl" name="zielAnzahl" data-action="ziel-anzahl">${[1, 2, 3, 4, 5, 6].map(nr => `<option value="${nr}" ${nr === 4 ? 'selected' : ''}>${nr}</option>`).join('')}</select><div id="ziel-zeilen"></div><div id="umverteilen-pruefung"></div><label for="umverteilen-grund">Begründung *</label><textarea id="umverteilen-grund" name="begruendung" required placeholder="Zum Beispiel: Anstellen auf vier Gärbottiche"></textarea><button class="btn btn-haupt" type="submit">Umverteilung speichern</button></form></section>`
  }

  private zielZeilen(anzahl: number, gesamt: number, quellen: Charge[]): string {
    const menge = gesamt / anzahl
    const quellIds = new Set(quellen.map(charge => charge.id))
    const heute = this.lokalesIsoDatum(new Date())
    const nutzbar = this.stand.behaelter.filter(behaelter => !this.stand.chargen.some(charge => charge.behaelterId === behaelter.id && !charge.archiviert && !quellIds.has(charge.id)))
    return Array.from({ length: anzahl }, (_, index) => `<div class="ziel-zeile"><div><label for="ziel-name-${index}">Ziel ${index + 1}</label><input id="ziel-name-${index}" name="zielName" value="Gärbottich ${index + 1}" required></div><div><label for="ziel-menge-${index}">kg</label><input id="ziel-menge-${index}" name="zielMenge" inputmode="decimal" value="${html(formatiereZahl(menge, 3))}" required></div><div><label for="ziel-behaelter-${index}">Behälter</label><select id="ziel-behaelter-${index}" name="zielBehaelter"><option value="">Ohne Zuordnung</option>${nutzbar.map(behaelter => { const zukunft = Boolean(behaelter.vorhandenAb && behaelter.vorhandenAb > heute); return `<option value="${html(behaelter.id)}" ${behaelter.id === `bottich-${index + 1}` ? 'selected' : ''} ${zukunft ? 'disabled' : ''}>${html(behaelter.name)}${zukunft ? ` · ab ${datumFormat.format(new Date(`${behaelter.vorhandenAb}T12:00:00`))}` : ''}</option>` }).join('')}</select></div></div>`).join('')
  }

  private sichereRundenEntwurf(formular = this.root.querySelector<HTMLFormElement>('#runde-form')): void {
    const charge = this.rundenCharge()
    if (!formular || !charge) return
    const entwurf = this.rundenEntwurf(charge.id)
    formular.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-runde-eingabe]').forEach(feld => {
      const typ = feld.dataset.messTyp as MessTyp | undefined
      if (!typ) return
      entwurf.messwerte[typ] = { eingabe: feld.value, methode: entwurf.messwerte[typ]?.methode ?? 'spindel' }
    })
    formular.querySelectorAll<HTMLSelectElement>('[data-runde-methode]').forEach(feld => {
      const typ = feld.dataset.messTyp as MessTyp | undefined
      if (!typ) return
      entwurf.messwerte[typ] = { eingabe: entwurf.messwerte[typ]?.eingabe ?? '', methode: feld.value as MessMethode }
    })
    entwurf.untergestossen = Boolean(formular.querySelector<HTMLInputElement>('[data-runde-untergestossen]')?.checked)
    formular.querySelectorAll<HTMLElement>('[data-runde-zugabe]').forEach(zeile => {
      const art = zeile.dataset.zugabeArt as RundenZugabeArt | undefined
      if (!art) return
      const vorhanden = entwurf.zugaben[art]
      entwurf.zugaben[art] = {
        aktiv: Boolean(zeile.querySelector<HTMLInputElement>('[data-runde-zugabe-aktiv]')?.checked),
        menge: zeile.querySelector<HTMLInputElement>('[data-runde-zugabe-menge]')?.value ?? vorhanden?.menge ?? '',
        einheit: zeile.querySelector<HTMLSelectElement>('[data-runde-zugabe-einheit]')?.value ?? vorhanden?.einheit ?? 'g',
        stoff: zeile.querySelector<HTMLInputElement>('[data-runde-zugabe-stoff]')?.value ?? vorhanden?.stoff ?? '',
        begruendung: zeile.querySelector<HTMLTextAreaElement>('[data-runde-zugabe-begruendung]')?.value ?? vorhanden?.begruendung ?? '',
        begruendungAutomatisch: vorhanden?.begruendungAutomatisch ?? true,
      }
    })
    this.ui.rundenEntwuerfe[charge.id] = entwurf
  }

  private aktualisiereRundenZugabeHinweise(): void {
    this.root.querySelectorAll<HTMLElement>('[data-runde-zugabe]').forEach(zeile => {
      const art = zeile.dataset.zugabeArt as RundenZugabeArt | undefined
      if (!art) return
      const aktiv = Boolean(zeile.querySelector<HTMLInputElement>('[data-runde-zugabe-aktiv]')?.checked)
      const menge = parseDeZahl(zeile.querySelector<HTMLInputElement>('[data-runde-zugabe-menge]')?.value ?? null)
      const einheit = zeile.querySelector<HTMLSelectElement>('[data-runde-zugabe-einheit]')?.value ?? 'g'
      const stoff = zeile.querySelector<HTMLInputElement>('[data-runde-zugabe-stoff]')?.value
        ?? (art === 'naehrsalz' ? 'Hefenährsalz' : art === 'aufzuckern' ? 'Haushaltszucker' : art === 'schwefeln' ? 'Kaliumpyrosulfit' : '')
      const zuordnung = passendeVorratsZuordnung(this.stand, art, stoff, einheit, menge ?? undefined)
      const vorrat = zeile.querySelector<HTMLElement>('[data-runde-zugabe-vorrat]')
      if (vorrat) {
        vorrat.textContent = zuordnung.hinweis
        vorrat.classList.toggle('warnung', zuordnung.warnung)
      }
      const max = Number(zeile.dataset.zugabeMax)
      const bisher = Number(zeile.dataset.zugabeBisher)
      const maxWarnung = zeile.querySelector<HTMLElement>('[data-runde-zugabe-maxwarnung]')
      if (maxWarnung) maxWarnung.hidden = !(Number.isFinite(max) && Number.isFinite(bisher) && bisher + (menge ?? 0) >= max)
      zeile.classList.toggle('aktiv', aktiv)
    })
  }

  private aktualisiereAutomatischeRundenBegruendungen(): void {
    const zeit = isoAusDatetimeLocal(this.ui.rundenZeit)
    for (const [chargeId, entwurf] of Object.entries(this.ui.rundenEntwuerfe)) {
      const charge = this.stand.chargen.find(eintrag => eintrag.id === chargeId)
      if (!charge) continue
      for (const art of zugabeArtenFuerPhase(charge.phase)) {
        const zugabe = entwurf.zugaben[art]
        if (!zugabe?.begruendungAutomatisch) continue
        zugabe.begruendung = zugabeVorschlag(this.stand, charge, art, zeit, this.ui.zuckerZielJeCharge[charge.id]).begruendung
        if (charge.id === this.rundenCharge()?.id) {
          const feld = this.root.querySelector<HTMLTextAreaElement>(`[data-zugabe-art="${art}"] [data-runde-zugabe-begruendung]`)
          if (feld) feld.value = zugabe.begruendung
        }
      }
    }
  }

  private wechsleRundenCharge(richtung: number): void {
    this.sichereRundenEntwurf()
    const index = this.ui.rundenIndex + richtung
    if (index < 0 || index >= this.ui.rundenChargeIds.length) return
    this.ui.rundenIndex = index
    this.schreibeHistory(true)
    this.render()
  }

  private beginneRundenWischen(event: TouchEvent): void {
    if (this.ui.ansicht !== 'runde' || event.touches.length !== 1) return
    const touch = event.touches[0]
    if (!touch) return
    const ziel = event.target as HTMLElement
    this.rundenTouchStart = { x: touch.clientX, y: touch.clientY, interaktiv: Boolean(ziel.closest('input, select, textarea, button, label, summary')) }
  }

  private beendeRundenWischen(event: TouchEvent): void {
    const start = this.rundenTouchStart
    this.rundenTouchStart = null
    if (!start || start.interaktiv || this.ui.ansicht !== 'runde' || event.changedTouches.length !== 1) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 80 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    this.wechsleRundenCharge(deltaX < 0 ? 1 : -1)
  }

  private planeRundenUndoTimer(): void {
    if (this.rundenUndoTimer !== undefined) window.clearInterval(this.rundenUndoTimer)
    this.rundenUndoTimer = window.setInterval(() => {
      if (this.ui.ansicht !== 'runde' || this.ui.rundenUndoBis === null) {
        window.clearInterval(this.rundenUndoTimer)
        this.rundenUndoTimer = undefined
        return
      }
      if (Date.now() >= this.ui.rundenUndoBis) {
        window.clearInterval(this.rundenUndoTimer)
        this.rundenUndoTimer = undefined
      }
      this.render()
    }, 1000)
  }

  private rundenZugabenAusEntwurf(charge: Charge, entwurf: RundenEntwurf, zeit: string, geaendert: string): Ereignis[] | string {
    const ereignisse: Ereignis[] = []
    for (const art of zugabeArtenFuerPhase(charge.phase)) {
      const zugabe = entwurf.zugaben[art]
      if (!zugabe?.aktiv) continue
      const rohwert = zugabe.menge.trim()
      if (!rohwert) continue
      const menge = parseDeZahl(rohwert)
      if (menge === null || menge <= 0) return `${zugabeVorschlag(this.stand, charge, art, zeit).label}: Trage eine Menge größer als 0 ein.`
      const vorschlag = zugabeVorschlag(this.stand, charge, art, zeit, this.ui.zuckerZielJeCharge[charge.id])
      const stoff = zugabe.stoff.trim() || vorschlag.stoff
      if (!stoff) return 'Sonstige Zugabe: Trage den Stoffnamen ein.'
      const begruendung = zugabe.begruendungAutomatisch ? vorschlag.begruendung.trim() : zugabe.begruendung.trim() || vorschlag.begruendung.trim()
      const vorrat = passendeVorratsZuordnung(this.stand, art, stoff, zugabe.einheit, menge)
      ereignisse.push({
        id: id('ereignis'),
        zuletztGeaendert: geaendert,
        chargeId: charge.id,
        zeit,
        art: vorschlag.ereignisArt,
        stoff,
        mengeWert: menge,
        mengeEinheit: zugabe.einheit,
        vorratId: vorrat.posten && vorrat.posten.mengeEinheit === zugabe.einheit ? vorrat.posten.id : undefined,
        begruendung: begruendung || `Zugabe während der Runde am ${datumZeitFormat.format(new Date(zeit))}.`,
      })
    }
    return ereignisse
  }

  private erledigeZugabeReminder(charge: Charge, zugaben: Ereignis[], geaendert: string): ReminderVorher[] {
    const aenderungen: ReminderVorher[] = []
    const neueArten = new Set(zugaben.map(ereignis => ereignis.art as RundenZugabeArt))
    for (const reminder of faelligeZugabeReminder(this.stand, charge)) {
      const art = zugabeArtFuerReminder(reminder)
      if (!art || !neueArten.has(art) || !globalerReminderIstFuerAlleChargenErfasst(this.stand, reminder, art)) continue
      aenderungen.push({
        reminderId: reminder.id,
        erledigt: reminder.erledigt,
        faellig: reminder.faellig,
      })
      if (reminder.wiederholungTage !== undefined && reminder.wiederholungTage > 0) {
        const naechsterTermin = new Date(reminder.faellig)
        const referenz = Math.max(Date.now(), ...zugaben.map(ereignis => new Date(ereignis.zeit).getTime()))
        do naechsterTermin.setDate(naechsterTermin.getDate() + reminder.wiederholungTage)
        while (naechsterTermin.getTime() <= referenz)
        reminder.faellig = naechsterTermin.toISOString()
        reminder.erledigt = false
      } else {
        reminder.erledigt = true
      }
      markiereGeaendert(reminder, geaendert)
    }
    return aenderungen
  }

  private async speichereRunde(formular: HTMLFormElement): Promise<void> {
    const charge = this.rundenCharge()
    if (!charge || charge.archiviert) return this.formularFehler('Wähle eine aktive Charge aus.')
    this.sichereRundenEntwurf(formular)
    const entwurf = this.rundenEntwurf(charge.id)
    const zeit = isoAusDatetimeLocal(this.ui.rundenZeit)
    const geaendert = new Date().toISOString()
    const ampelVorher = ampelFuerCharge(this.stand, charge)
    const volumenVorher = {
      ...(charge.fuellLiter === undefined ? {} : { fuellLiter: charge.fuellLiter }),
      ...(charge.kopfraumLiter === undefined ? {} : { kopfraumLiter: charge.kopfraumLiter }),
      volumenHistorie: (charge.volumenHistorie ?? []).map(punkt => ({ ...punkt })),
    }
    const neu: Messung[] = []
    for (const definition of MESS_DEFINITIONEN) {
      const feld = entwurf.messwerte[definition.typ]
      const rohwert = feld?.eingabe.trim() ?? ''
      if (!rohwert) continue
      const wert = definition.art === 'zahl' ? parseDeZahl(rohwert) : null
      if (definition.art === 'zahl' && wert === null) return this.formularFehler(`${definition.label}: Trage einen gültigen Zahlenwert ein.`)
      if ((definition.typ === 'volumen' || definition.typ === 'kopfraum') && wert !== null && wert < 0) return this.formularFehler(`${definition.label} muss mindestens 0 L betragen.`)
      neu.push({ id: id('messung'), zuletztGeaendert: geaendert, chargeId: charge.id, zeit, typ: definition.typ, wert, text: definition.art === 'auswahl' ? rohwert : undefined, methode: DICHTE_TYPEN.includes(definition.typ) ? feld?.methode ?? 'spindel' : undefined })
    }
    const rundenZugaben = this.rundenZugabenAusEntwurf(charge, entwurf, zeit, geaendert)
    if (typeof rundenZugaben === 'string') return this.formularFehler(rundenZugaben)
    const neueEreignisse: Ereignis[] = [
      ...(entwurf.untergestossen ? [{ id: id('ereignis'), zuletztGeaendert: geaendert, chargeId: charge.id, zeit, art: 'unterstossen' as const, begruendung: 'Während der Runde am Gefäß untergestoßen.' }] : []),
      ...rundenZugaben,
    ]
    if (!neu.length && !neueEreignisse.length) return this.formularFehler('Trage mindestens einen Messwert ein, markiere eine Zugabe oder Untergestoßen. Leere Felder werden nicht gespeichert.')
    try {
      pruefeEreignisseMitVorrat(this.stand, neueEreignisse)
    } catch (fehler) {
      return this.formularFehler(fehler instanceof Error ? fehler.message : 'Die Vorratsbuchung konnte nicht geprüft werden.')
    }
    this.stand.messungen.push(...neu)
    speichereEreignisseMitVorrat(this.stand, neueEreignisse)
    this.aktualisiereVolumenAusMessungen(neu)
    const reminderAenderungen = this.erledigeZugabeReminder(charge, rundenZugaben, geaendert)
    const gespeichert: RundenSpeicherung = { chargeId: charge.id, zeit, typen: neu.map(messung => messung.typ), messungIds: neu.map(messung => messung.id), ereignisIds: neueEreignisse.map(ereignis => ereignis.id), reminderAenderungen, ampelVorher, ampelNachher: ampelFuerCharge(this.stand, charge), volumenVorher }
    this.ui.rundenErgebnisse = [...this.ui.rundenErgebnisse.filter(ergebnis => ergebnis.chargeId !== charge.id), gespeichert]
    this.ui.rundenGespeichert = gespeichert
    this.ui.rundenUndoBis = Date.now() + 30_000
    await this.speichereLokalUndStarteAbgleich()
    this.planeRundenUndoTimer()
    this.render()
  }

  private async nehmeLetzteRundenEingabeZurueck(): Promise<void> {
    const gespeichert = this.ui.rundenGespeichert
    if (!gespeichert || this.ui.rundenUndoBis === null || Date.now() >= this.ui.rundenUndoBis) return
    const loeschZeit = new Date().toISOString()
    const messungIds = new Set(gespeichert.messungIds)
    this.stand.messungen = this.stand.messungen.filter(messung => !messungIds.has(messung.id))
    gespeichert.messungIds.forEach(messungId => merkeLoeschung(this.stand, 'messungen', messungId, loeschZeit))
    gespeichert.ereignisIds.forEach(ereignisId => {
      if (this.stand.ereignisse.some(ereignis => ereignis.id === ereignisId)) loescheEreignisMitVorrat(this.stand, ereignisId)
    })
    gespeichert.reminderAenderungen.forEach(vorher => {
      const reminder = this.stand.reminder.find(eintrag => eintrag.id === vorher.reminderId)
      if (!reminder) return
      reminder.erledigt = vorher.erledigt
      reminder.faellig = vorher.faellig
      markiereGeaendert(reminder, loeschZeit)
    })
    const charge = this.stand.chargen.find(eintrag => eintrag.id === gespeichert.chargeId)
    if (charge) {
      charge.volumenHistorie = gespeichert.volumenVorher.volumenHistorie.map(punkt => ({ ...punkt }))
      if (gespeichert.volumenVorher.fuellLiter === undefined) delete charge.fuellLiter
      else charge.fuellLiter = gespeichert.volumenVorher.fuellLiter
      if (gespeichert.volumenVorher.kopfraumLiter === undefined) delete charge.kopfraumLiter
      else charge.kopfraumLiter = gespeichert.volumenVorher.kopfraumLiter
      markiereGeaendert(charge, loeschZeit)
    }
    this.ui.rundenErgebnisse = this.ui.rundenErgebnisse.filter(ergebnis => ergebnis !== gespeichert)
    this.ui.rundenGespeichert = null
    this.ui.rundenUndoBis = null
    if (this.rundenUndoTimer !== undefined) window.clearInterval(this.rundenUndoTimer)
    this.rundenUndoTimer = undefined
    await this.speichereLokalUndStarteAbgleich()
    this.render()
  }

  private async behandleKlick(event: Event): Promise<void> {
    const ziel = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!ziel) return
    const action = ziel.dataset.action
    if (action === 'runde-start') return this.starteRunde(ziel.dataset.id || this.ui.chargeId || undefined)
    if (action === 'runde-abbrechen') {
      this.ui.rundenGespeichert = null
      this.ui.rundenUndoBis = null
      if (this.rundenUndoTimer !== undefined) window.clearInterval(this.rundenUndoTimer)
      this.rundenUndoTimer = undefined
      return this.navigiere('heute')
    }
    if (action === 'runde-wechsel') return this.wechsleRundenCharge(Number(ziel.dataset.richtung ?? 0))
    if (action === 'runde-weiter') {
      if (this.ui.rundenIndex >= this.ui.rundenChargeIds.length - 1) {
        this.ui.rundenAbgeschlossen = true
        this.ui.rundenGespeichert = null
        this.ui.rundenUndoBis = null
        if (this.rundenUndoTimer !== undefined) window.clearInterval(this.rundenUndoTimer)
        this.rundenUndoTimer = undefined
        this.schreibeHistory(true)
        return this.render()
      }
      return this.wechsleRundenCharge(1)
    }
    if (action === 'runde-undo') return this.nehmeLetzteRundenEingabeZurueck()
    if (action === 'runde-beenden') return this.navigiere('heute')
    if (action === 'reminder-oeffnen') {
      const reminder = this.stand.reminder.find(eintrag => eintrag.id === ziel.dataset.id)
      if (reminder && this.reminderVerlangtRunde(reminder)) return this.starteRunde(reminder.chargeId)
      return this.navigiere('termine')
    }
    if (action === 'messwert-alle') {
      this.ui.ansicht = 'erfassen'
      this.ui.erfassenModus = 'messung'
      this.ui.messErfassungModus = 'messgroesse'
      this.ui.messChargeIds = this.aktiveChargen().map(charge => charge.id)
      this.ui.messEntwuerfe = {}
      this.ui.messZeit = datetimeLocalWert()
      this.schreibeHistory()
      return this.render()
    }
    if (action === 'nav') {
      if (ziel.classList.contains('zurueck') && history.length > 1) return history.back()
      return this.navigiere(ziel.dataset.view as Ansicht)
    }
    if (action === 'charge') { this.ui.chargeId = ziel.dataset.id ?? ''; this.ui.ansicht = 'charge'; this.ui.chargeTab = 'befunde'; this.schreibeHistory(); return this.render() }
    if (action === 'desktop-charge') { this.ui.chargeId = ziel.dataset.id ?? this.ui.chargeId; this.schreibeHistory(true); return this.render() }
    if (action === 'charge-tab') { this.ui.chargeTab = ziel.dataset.tab as ChargeTab; return this.render() }
    if (action === 'messung-bearbeiten') { this.ui.editMessungId = ziel.dataset.id ?? null; this.ui.ansicht = 'messung-bearbeiten'; this.schreibeHistory(); return this.render() }
    if (action === 'ereignis-bearbeiten') { this.ui.editEreignisId = ziel.dataset.id ?? null; this.ui.ansicht = 'ereignis-bearbeiten'; this.schreibeHistory(); return this.render() }
    if (action === 'erfassen') {
      this.ui.ansicht = 'erfassen'
      this.ui.erfassenModus = 'messung'
      this.ui.messErfassungModus = 'charge'
      this.ui.messChargeIds = this.ui.chargeId ? [this.ui.chargeId] : []
      this.ui.messEntwuerfe = {}
      this.ui.messZeit = datetimeLocalWert()
      this.ui.messNotiz = ''
      this.ui.messRundeErfolg = null
      this.schreibeHistory()
      return this.render()
    }
    if (action === 'erfassen-modus') {
      this.sichereMessFormularEntwurf()
      this.ui.erfassenModus = ziel.dataset.mode as ErfassenModus
      this.ui.messRundeErfolg = null
      return this.render()
    }
    if (action === 'mess-erfassungsmodus') {
      this.sichereMessFormularEntwurf()
      this.ui.messErfassungModus = ziel.dataset.mode as MessErfassungModus
      this.ui.messRundeErfolg = null
      return this.render()
    }
    if (action === 'mess-charge') {
      const chargeId = ziel.dataset.id ?? ''
      if (chargeId !== this.ui.chargeId) this.leereMessEingaben()
      this.ui.chargeId = chargeId
      this.ui.messRundeErfolg = null
      return this.render()
    }
    if (action === 'mess-runde-weiter') {
      this.ui.chargeId = ziel.dataset.id ?? this.ui.chargeId
      this.leereMessEingaben()
      this.ui.messRundeErfolg = null
      window.scrollTo({ top: 0, behavior: 'auto' })
      return this.render()
    }
    if (action === 'mess-runde-beenden') {
      this.leereMessEingaben()
      this.ui.messRundeErfolg = null
      return this.navigiere('heute')
    }
    if (action === 'rechner-tab') { this.ui.rechnerTyp = ziel.dataset.rechner as RechnerTyp; return this.render() }
    if (action === 'desktop-kurve') { this.ui.desktopKurveTyp = ziel.dataset.kurve as DesktopKurveTyp; return this.render() }
    if (action === 'desktop-zeitraum') { this.ui.desktopZeitraum = ziel.dataset.zeitraum as DesktopZeitraum; return this.render() }
    if (action === 'gate-zurueck') { this.ui.gateCheckIndex = Math.max(0, this.ui.gateCheckIndex - 1); return this.render() }
    if (action === 'gate-weiter') { this.ui.gateCheckIndex += 1; return this.render() }
    if (action === 'phase-weiter') return this.phaseWeiter()
    if (action === 'gate-reminder') return this.legeGateReminderAn()
    if (action === 'ics-einzel') return this.exportiereEinzelIcs(ziel.dataset.id ?? '')
    if (action === 'ics-alle') return this.exportiereAlleIcs()
    if (action === 'reminder-toggle') return this.toggleReminder(ziel.dataset.id ?? '')
    if (action === 'wiki-tag') { this.ui.wikiTag = ziel.dataset.tag || null; return this.render() }
    if (action === 'wiki-oeffnen') { this.ui.wikiId = ziel.dataset.id ?? null; this.ui.ansicht = 'wiki-seite'; this.schreibeHistory(); return this.render() }
    if (action === 'wiki-neu') { this.ui.wikiId = null; this.ui.ansicht = 'wiki-editor'; this.schreibeHistory(); return this.render() }
    if (action === 'wiki-bearbeiten') { this.ui.wikiId = ziel.dataset.id ?? null; this.ui.ansicht = 'wiki-editor'; this.schreibeHistory(); return this.render() }
    if (action === 'status-schliessen') { this.ui.status = null; return this.render() }
    if (action === 'messung-loeschen') return this.loescheMessung(ziel.dataset.id ?? '')
    if (action === 'ereignis-loeschen') return this.loescheEreignis(ziel.dataset.id ?? '')
    if (action === 'sync-jetzt') return this.starteAbgleich()
    if (action === 'update-laden') { window.dispatchEvent(new CustomEvent('weinbegleiter:update-anwenden')); return }
    if (action === 'export-md') return this.exportiereMarkdown()
    if (action === 'export-csv') return this.exportiereCsv()
    if (action === 'export-json') return this.exportiereJson()
    if (action === 'export-zip') return this.exportiereZip()
  }

  private async behandleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const formular = event.target as HTMLFormElement
    if (formular.id === 'runde-form') return this.speichereRunde(formular)
    if (formular.id === 'gate-mess-form') return this.speichereGateMessung(formular)
    if (formular.id === 'press-teilung-form') return this.speicherePressTeilung(formular)
    if (formular.id === 'mess-form') return this.speichereMessungen(formular)
    if (formular.id === 'messung-bearbeiten-form') return this.aktualisiereMessung(formular)
    if (formular.id === 'ereignis-form') return this.speichereEreignisse(formular)
    if (formular.id === 'ereignis-bearbeiten-form') return this.aktualisiereEreignis(formular)
    if (formular.id === 'gefaess-form') return this.speichereGefaess(formular)
    if (formular.id === 'reminder-form') return this.speichereReminder(formular)
    if (formular.id === 'wiki-form') return this.speichereWiki(formular)
    if (formular.id === 'sensor-form') return this.speichereSensor(formular, event.submitter as HTMLButtonElement | null)
    if (formular.id === 'klima-form') return this.speichereKlima(formular)
    if (formular.id === 'umverteilen-form') return this.speichereUmverteilung(formular)
  }

  private async behandleAenderung(event: Event): Promise<void> {
    const ziel = event.target as HTMLInputElement | HTMLSelectElement
    if (ziel.dataset.action === 'runden-zeit') {
      this.ui.rundenZeit = ziel.value
      this.aktualisiereAutomatischeRundenBegruendungen()
      return
    }
    if (ziel.closest('#runde-form')) {
      this.sichereRundenEntwurf()
      this.aktualisiereRundenZugabeHinweise()
    }
    if (ziel.closest('#mess-form')) this.sichereMessFormularEntwurf()
    if (ziel.dataset.action === 'mess-typ') { this.ui.messTyp = ziel.value as MessTyp; return this.render() }
    if (ziel.dataset.action === 'mess-methode') return this.aktualisiereRefraktometerHinweis()
    if (ziel.dataset.action === 'ereignis-art') return this.aktualisiereZugabeFelder(ziel.value as EreignisArt)
    if (ziel.dataset.action === 'phase') return this.setzePhase(ziel.value as Phase)
    if (ziel.dataset.action === 'ziel-anzahl' || ziel.name === 'quellen') return this.aktualisiereZielzeilen()
    if (ziel.dataset.action === 'import-json' && ziel instanceof HTMLInputElement && ziel.files?.[0]) return this.importiereJson(ziel.files[0])
    if (ziel.name === 'chargeIds') {
      this.aktualisiereRefraktometerHinweis()
      this.aktualisiereZugabeVorschau()
    }
    if (ziel.closest('#ereignis-form')) this.aktualisiereZugabeVorschau()
  }

  private behandleEingabe(event: Event): void {
    const ziel = event.target as HTMLInputElement
    if (ziel.closest('#runde-form')) {
      if (ziel.matches('[data-runde-zugabe-menge]')) {
        const zeile = ziel.closest<HTMLElement>('[data-runde-zugabe]')
        const aktiv = zeile?.querySelector<HTMLInputElement>('[data-runde-zugabe-aktiv]')
        if (aktiv) aktiv.checked = true
      }
      if (ziel.matches('[data-runde-zugabe-begruendung]')) {
        const art = ziel.closest<HTMLElement>('[data-runde-zugabe]')?.dataset.zugabeArt as RundenZugabeArt | undefined
        const charge = this.rundenCharge()
        if (art && charge) {
          const zugabe = this.rundenEntwurf(charge.id).zugaben[art]
          if (zugabe) zugabe.begruendungAutomatisch = false
        }
      }
      this.sichereRundenEntwurf()
      this.aktualisiereRundenZugabeHinweise()
    }
    if (ziel.closest('#mess-form')) this.sichereMessFormularEntwurf()
    if (ziel.closest('#rechner-form')) this.aktualisiereRechner()
    if (ziel.closest('#ereignis-form')) this.aktualisiereZugabeVorschau()
    if (ziel.id === 'wiki-suche') {
      this.ui.wikiFilter = ziel.value
      const liste = this.root.querySelector<HTMLElement>('#wiki-liste')
      if (liste) liste.innerHTML = this.renderWikiListe()
    }
    if (ziel.closest('#umverteilen-form') && ziel.name === 'zielMenge') this.pruefeUmverteilung()
  }

  private behandleTaste(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const ziel = (event.target as HTMLElement).closest<HTMLElement>('[data-action][tabindex="0"]')
    if (!ziel) return
    event.preventDefault()
    ziel.click()
  }

  private navigiere(ansicht: Ansicht): void {
    if (ansicht === 'gate') this.ui.gateCheckIndex = 0
    this.ui.ansicht = ansicht
    this.schreibeHistory()
    window.scrollTo({ top: 0, behavior: 'auto' })
    this.render()
    this.root.querySelector<HTMLElement>('#hauptinhalt')?.focus({ preventScroll: true })
  }

  private schreibeHistory(ersetzen = false): void {
    const route = { weinbegleiter: true, ui: { ...this.ui, status: null } }
    const url = `${location.pathname}${location.search}#${this.routeHash()}`
    if (ersetzen) history.replaceState(route, '', url)
    else history.pushState(route, '', url)
  }

  private async persistieren(meldung?: string): Promise<void> {
    await this.speichereLokalUndStarteAbgleich()
    if (meldung) this.zeigeStatus('erfolg', meldung)
  }

  private async speichereLokalUndStarteAbgleich(): Promise<void> {
    await speichereDatenstand(this.stand)
    void this.starteAbgleich()
  }

  private async starteAbgleich(): Promise<void> {
    if (navigator.onLine === false) {
      this.syncFehler = true
      if (this.ui.ansicht === 'mehr') this.render()
      return
    }
    if (this.syncLaeuft) {
      this.syncErneut = true
      return
    }
    this.syncLaeuft = true
    this.syncFehler = false
    if (this.ui.ansicht === 'mehr') this.render()
    try {
      const zusammengefuehrt = await gleicheMitServerAb(this.stand)
      zusammengefuehrt.appMeta.letzterAbgleich = new Date().toISOString()
      this.stand = zusammengefuehrt
      await speichereDatenstand(this.stand)
      this.syncFehler = false
    } catch (fehler) {
      this.syncFehler = true
      console.warn('Datenabgleich fehlgeschlagen; der lokale Stand bleibt erhalten.', fehler)
    } finally {
      this.syncLaeuft = false
      if (this.ui.ansicht === 'mehr' || this.ui.ansicht === 'heute') this.render()
      if (this.syncErneut) {
        this.syncErneut = false
        void this.starteAbgleich()
      }
    }
  }

  private zeigeStatus(art: 'erfolg' | 'fehler', text: string): void {
    this.ui.status = { art, text }
    this.render()
  }

  private gewaehlteChargen(formular: HTMLFormElement, name = 'chargeIds'): Charge[] {
    const ids = new FormData(formular).getAll(name).map(String)
    return ids.map(chargeId => this.stand.chargen.find(charge => charge.id === chargeId)).filter((charge): charge is Charge => Boolean(charge))
  }

  private sichereMessFormularEntwurf(formular = this.root.querySelector<HTMLFormElement>('#mess-form')): void {
    if (!formular) return
    if (this.ui.messErfassungModus === 'messgroesse') {
      this.ui.messChargeIds = erhalteMessChargenAuswahl(
        new FormData(formular).getAll('chargeIds').map(String),
        this.aktiveChargen().map(charge => charge.id),
      )
    }
    formular.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-mess-eingabe]').forEach(feld => {
      const typ = feld.dataset.messTyp as MessTyp | undefined
      if (!typ) return
      const bisher = this.ui.messEntwuerfe[typ]
      this.ui.messEntwuerfe[typ] = { eingabe: feld.value, methode: bisher?.methode ?? 'spindel' }
    })
    formular.querySelectorAll<HTMLSelectElement>('[data-action="mess-methode"]').forEach(feld => {
      const typ = feld.dataset.messTyp as MessTyp | undefined
      if (!typ) return
      const bisher = this.ui.messEntwuerfe[typ]
      this.ui.messEntwuerfe[typ] = { eingabe: bisher?.eingabe ?? '', methode: feld.value as MessMethode }
    })
    this.ui.messZeit = formular.elements.namedItem('zeit') instanceof HTMLInputElement
      ? (formular.elements.namedItem('zeit') as HTMLInputElement).value
      : this.ui.messZeit
    this.ui.messNotiz = formular.elements.namedItem('notiz') instanceof HTMLTextAreaElement
      ? (formular.elements.namedItem('notiz') as HTMLTextAreaElement).value
      : this.ui.messNotiz
  }

  private leereMessEingaben(): void {
    this.ui.messEntwuerfe = Object.fromEntries(Object.entries(this.ui.messEntwuerfe).map(([typ, entwurf]) => [typ, { ...entwurf, eingabe: '' }]))
    this.ui.messNotiz = ''
  }

  private formularFehler(text: string): void {
    const feld = this.root.querySelector<HTMLElement>('#erfassen-fehler')
    if (feld) feld.innerHTML = `<div class="form-fehler">${html(text)}</div>`
    else this.zeigeStatus('fehler', text)
  }

  private async speichereMessungen(formular: HTMLFormElement): Promise<void> {
    this.sichereMessFormularEntwurf(formular)
    if (this.ui.messErfassungModus === 'charge') return this.speichereChargeMessungen(formular)
    return this.speichereMessgroesse(formular)
  }

  private async speichereChargeMessungen(formular: HTMLFormElement): Promise<void> {
    const charge = this.aktuelleCharge()
    if (!charge || charge.archiviert) return this.formularFehler('Wähle eine aktive Charge aus.')
    const daten = new FormData(formular)
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const notiz = String(daten.get('notiz') ?? '').trim() || undefined
    const neu: Messung[] = []
    for (const definition of MESS_DEFINITIONEN) {
      const rohwert = String(daten.get(`mess-${definition.typ}`) ?? '').trim()
      if (!rohwert) continue
      const wert = definition.art === 'zahl' ? parseDeZahl(rohwert) : null
      if (definition.art === 'zahl' && wert === null) return this.formularFehler(`${definition.label}: Trage einen gültigen Zahlenwert ein.`)
      if ((definition.typ === 'volumen' || definition.typ === 'kopfraum') && wert !== null && wert < 0) return this.formularFehler(`${definition.label} muss mindestens 0 L betragen.`)
      const methode = DICHTE_TYPEN.includes(definition.typ) ? String(daten.get(`methode-${definition.typ}`) ?? 'spindel') as MessMethode : undefined
      neu.push({
        id: id('messung'),
        zuletztGeaendert: new Date().toISOString(),
        chargeId: charge.id,
        zeit,
        typ: definition.typ,
        wert,
        text: definition.art === 'auswahl' ? rohwert : undefined,
        methode,
        notiz,
      })
    }
    if (!neu.length) return this.formularFehler('Trage mindestens einen Messwert ein. Leere Felder werden nicht gespeichert.')
    this.stand.messungen.push(...neu)
    this.aktualisiereVolumenAusMessungen(neu)
    await this.speichereLokalUndStarteAbgleich()
    this.ui.messRundeErfolg = { chargeId: charge.id, typen: neu.map(messung => messung.typ) }
    this.render()
    this.root.querySelector<HTMLElement>('.mess-runde-erfolg')?.focus({ preventScroll: true })
  }

  private async speichereMessgroesse(formular: HTMLFormElement): Promise<void> {
    const chargen = this.gewaehlteChargen(formular)
    if (!chargen.length) return this.formularFehler('Wähle mindestens eine Charge aus.')
    const daten = new FormData(formular)
    const typ = String(daten.get('typ')) as MessTyp
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === typ)
    if (!definition) return this.formularFehler('Unbekannte Messgröße.')
    const eingabe = daten.get(`mess-${typ}`)
    const wert = definition.art === 'zahl' ? parseDeZahl(eingabe) : null
    const text = definition.art === 'auswahl' ? String(eingabe ?? '') : undefined
    if (definition.art === 'zahl' && wert === null) return this.formularFehler('Trage einen gültigen Zahlenwert ein.')
    if ((typ === 'volumen' || typ === 'kopfraum') && wert !== null && wert < 0) return this.formularFehler('Volumenwerte müssen mindestens 0 L betragen.')
    if (definition.art === 'auswahl' && !text) return this.formularFehler('Wähle einen Befund aus.')
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const methode = DICHTE_TYPEN.includes(typ) ? String(daten.get(`methode-${typ}`) ?? 'spindel') as MessMethode : undefined
    const notiz = String(daten.get('notiz') ?? '').trim() || undefined
    const geaendert = new Date().toISOString()
    const neu: Messung[] = chargen.map(charge => ({ id: id('messung'), zuletztGeaendert: geaendert, chargeId: charge.id, zeit, typ, wert, text, methode, notiz }))
    this.stand.messungen.push(...neu)
    this.aktualisiereVolumenAusMessungen(neu)
    await this.speichereLokalUndStarteAbgleich()
    this.ui.status = { art: 'erfolg', text: `${neu.length} Messdatensätze gespeichert.` }
    this.ui.ansicht = 'charge'
    this.ui.chargeTab = 'messungen'
    this.schreibeHistory(true)
    this.render()
  }

  private aktualisiereVolumenAusMessungen(messungen: Messung[]): void {
    const chargeIds = [...new Set(messungen.filter(messung => messung.typ === 'volumen' || messung.typ === 'kopfraum').map(messung => messung.chargeId))]
    for (const chargeId of chargeIds) {
      const charge = this.stand.chargen.find(eintrag => eintrag.id === chargeId)
      if (!charge) continue
      const volumen = messungen.find(messung => messung.chargeId === chargeId && messung.typ === 'volumen')
      const kopfraum = messungen.find(messung => messung.chargeId === chargeId && messung.typ === 'kopfraum')
      const definitionen = [volumen, kopfraum].filter((messung): messung is Messung => Boolean(messung)).map(messung => this.messLabel(messung.typ))
      fuegeVolumenPunktHinzu(this.stand, charge.id, {
        zeit: (volumen ?? kopfraum)!.zeit,
        fuellLiter: volumen?.wert ?? charge.fuellLiter,
        kopfraumLiter: kopfraum?.wert ?? charge.kopfraumLiter,
        behaelterId: charge.behaelterId,
        anlass: `${definitionen.join(' und ')} gemessen`,
      })
    }
  }

  private aktualisiereErfassenFormular(): void {
    if (this.ui.erfassenModus === 'ereignis') {
      const art = (this.root.querySelector<HTMLSelectElement>('#ereignis-art')?.value ?? 'schwefeln') as EreignisArt
      this.aktualisiereZugabeFelder(art)
    } else {
      this.aktualisiereRefraktometerHinweis()
    }
  }

  private aktualisiereZugabeFelder(art: EreignisArt): void {
    const container = this.root.querySelector<HTMLElement>('#zugabe-felder')
    if (container) {
      container.innerHTML = this.renderZugabeFelder(art)
      this.aktualisiereZugabeVorschau()
    }
  }

  private aktualisiereZugabeVorschau(): void {
    const formular = this.root.querySelector<HTMLFormElement>('#ereignis-form')
    const container = this.root.querySelector<HTMLElement>('#zugabe-vorschau')
    if (!formular || !container) return
    const daten = new FormData(formular)
    const art = String(daten.get('art')) as EreignisArt
    const dosis = parseDeZahl(daten.get('dosisProLiter'))
    if (!ZUGABE_ARTEN.includes(art) || dosis === null) { container.innerHTML = ''; return }
    const chargen = this.gewaehlteChargen(formular)
    const ohneVolumen = chargen.filter(charge => this.zugabeVolumen(charge) === undefined)
    if (ohneVolumen.length) {
      container.innerHTML = `<div class="warnbox"><strong>Berechnung nicht möglich:</strong> Füllvolumen fehlt bei ${html(ohneVolumen.map(charge => charge.name).join(', '))}.</div>`
      return
    }
    const mengen = chargen.map(charge => ({ charge, menge: dosis * (this.zugabeVolumen(charge) ?? 0) }))
    const summe = mengen.reduce((gesamt, eintrag) => gesamt + eintrag.menge, 0)
    const einheit = String(daten.get('mengeEinheit') ?? 'g')
    let inhalt = `<div class="info-box"><strong>Chargenbezogene Mengen:</strong>${mengen.map(eintrag => `<br>${html(eintrag.charge.name)}: ${zahlFormat.format(eintrag.menge)} ${html(einheit)}`).join('')}</div>`
    const vorratId = String(daten.get('vorratId') ?? '')
    const posten = this.stand.vorrat.find(eintrag => eintrag.id === vorratId)
    if (posten) {
      if (posten.mengeEinheit !== einheit) {
        inhalt += `<div class="fehlerbox"><strong>Einheiten passen nicht.</strong> ${html(posten.name)} wird in ${html(posten.mengeEinheit)} geführt, die Zugabe in ${html(einheit)}. Nichts wird abgebucht.</div>`
      } else {
        inhalt += summe > posten.mengeWert
          ? `<div class="fehlerbox"><strong>Vorrat reicht nicht.</strong> ${zahlFormat.format(summe)} ${html(einheit)} werden benötigt, vorhanden sind ${zahlFormat.format(posten.mengeWert)} ${html(einheit)}.</div>`
          : `<div class="erfolgbox">Bestand nach der Zugabe: ${zahlFormat.format(posten.mengeWert - summe)} ${html(einheit)} ${html(posten.name)}.</div>`
      }
    }
    container.innerHTML = inhalt
  }

  private aktualisiereRefraktometerHinweis(): void {
    const formular = this.root.querySelector<HTMLFormElement>('#mess-form')
    if (!formular) return
    const daten = new FormData(formular)
    const chargen = this.ui.messErfassungModus === 'charge'
      ? [this.aktuelleCharge()].filter((charge): charge is Charge => Boolean(charge))
      : this.gewaehlteChargen(formular)
    this.root.querySelectorAll<HTMLElement>('[data-refraktometer-hinweis]').forEach(container => {
      const typ = container.dataset.messTyp as MessTyp | undefined
      const methode = typ ? daten.get(`methode-${typ}`) : null
      if (!typ || methode !== 'refraktometer') { container.innerHTML = ''; return }
      let befund: ReturnType<typeof befundeFuerCharge>[number] | undefined
      for (const charge of chargen) {
        const probe: Messung = { id: 'vorschau-refra', chargeId: charge.id, zeit: new Date().toISOString(), typ, wert: 0, methode: 'refraktometer' }
        const vorschau = { ...this.stand, messungen: [...this.stand.messungen, probe] }
        befund = befundeFuerCharge(vorschau, charge).find(eintrag => eintrag.regelId === 'R-REFRAKTOMETER')
        if (befund) break
      }
      container.innerHTML = befund ? `<div class="warnbox"><strong>${html(befund.regelId)} · ${this.fachtext(befund.titel)}</strong><br>${this.fachtext(befund.text)} ${befund.massnahme ? this.fachtext(befund.massnahme) : ''}</div>` : ''
    })
  }

  private async speichereEreignisse(formular: HTMLFormElement): Promise<void> {
    const chargen = this.gewaehlteChargen(formular)
    if (!chargen.length) return this.formularFehler('Wähle mindestens eine Charge aus.')
    const daten = new FormData(formular)
    const art = String(daten.get('art')) as EreignisArt
    const begruendung = String(daten.get('begruendung') ?? '').trim()
    if (!begruendung) return this.formularFehler('Die Begründung ist Pflicht. Ohne Begründung wird nichts gespeichert.')
    const istZugabe = ZUGABE_ARTEN.includes(art)
    const istVolumenEreignis = VOLUMEN_EREIGNIS_ARTEN.includes(art)
    if (istVolumenEreignis && chargen.length !== 1) return this.formularFehler('Wähle für Pressen, Abstich oder Umfüllen genau eine Charge. Jeder Behälter braucht einen eigenen Volumenpunkt.')
    const dosis = istZugabe ? parseDeZahl(daten.get('dosisProLiter')) : null
    if (istZugabe && (dosis === null || dosis < 0)) return this.formularFehler('Trage eine gültige Dosierung je Liter ein.')
    const ohneVolumen = istZugabe ? chargen.filter(charge => this.zugabeVolumen(charge) === undefined) : []
    if (ohneVolumen.length) return this.formularFehler(`Rechenvolumen fehlt bei: ${ohneVolumen.map(charge => charge.name).join(', ')}. Zugabemengen werden nicht geschätzt.`)
    const fotoIds: string[] = []
    const neueFotos: Foto[] = []
    const dateien = (formular.elements.namedItem('fotos') as HTMLInputElement | null)?.files
    for (const datei of Array.from(dateien ?? [])) {
      const foto: Foto = { id: id('foto'), zeit: new Date().toISOString(), blob: datei }
      neueFotos.push(foto)
      fotoIds.push(foto.id)
    }
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const stoff = String(daten.get('stoff') ?? '').trim() || undefined
    const produkt = String(daten.get('produkt') ?? '').trim() || undefined
    const mengeEinheit = String(daten.get('mengeEinheit') ?? '').trim() || undefined
    const vorratId = String(daten.get('vorratId') ?? '').trim() || undefined
    const fuellLiter = istVolumenEreignis ? parseDeZahl(daten.get('fuellLiter')) : null
    const kopfraumLiter = istVolumenEreignis ? parseDeZahl(daten.get('kopfraumLiter')) : null
    const behaelterId = istVolumenEreignis ? String(daten.get('behaelterId') ?? '').trim() : ''
    if (istVolumenEreignis && (fuellLiter === null || fuellLiter < 0 || kopfraumLiter === null || kopfraumLiter < 0 || !behaelterId)) {
      return this.formularFehler('Füllvolumen, Kopfraum und Behälter nach dem Vorgang vollständig eintragen.')
    }
    const neu: Ereignis[] = chargen.map(charge => ({
      id: id('ereignis'), chargeId: charge.id, zeit, art, stoff, produkt,
      mengeWert: istZugabe && dosis !== null ? Math.round(dosis * (this.zugabeVolumen(charge) ?? 0) * 1000) / 1000 : undefined,
      mengeEinheit: istZugabe ? mengeEinheit : undefined,
      vorratId: istZugabe ? vorratId : undefined,
      begruendung,
      fotoIds: fotoIds.length ? fotoIds : undefined,
    }))
    try {
      pruefeEreignisseMitVorrat(this.stand, neu)
      for (const foto of neueFotos) await speichereFoto(foto)
      this.fotos.push(...neueFotos)
      speichereEreignisseMitVorrat(this.stand, neu)
    } catch (error) {
      return this.formularFehler(error instanceof Error ? error.message : 'Ereignis konnte nicht gespeichert werden.')
    }
    if (istVolumenEreignis && fuellLiter !== null && kopfraumLiter !== null) {
      chargen.forEach(charge => fuegeVolumenPunktHinzu(this.stand, charge.id, {
        zeit, fuellLiter, kopfraumLiter, behaelterId, anlass: EREIGNIS_LABEL[art],
      }))
    }
    await this.persistieren(`${neu.length} Ereignisdatensätze gespeichert.`)
    this.ui.ansicht = 'charge'
    this.ui.chargeTab = 'ereignisse'
    this.schreibeHistory(true)
    this.render()
  }

  private async speichereGefaess(formular: HTMLFormElement): Promise<void> {
    const charge = this.aktuelleCharge()
    if (!charge) return
    const daten = new FormData(formular)
    const fuellLiter = parseDeZahl(daten.get('fuellLiter'))
    const kopfraumLiter = parseDeZahl(daten.get('kopfraumLiter'))
    const behaelterId = String(daten.get('behaelterId') ?? '') || undefined
    const anlass = String(daten.get('anlass') ?? '').trim()
    if (fuellLiter === null || fuellLiter < 0 || kopfraumLiter === null || kopfraumLiter < 0 || !behaelterId || !anlass) {
      return this.zeigeStatus('fehler', 'Füllvolumen, Kopfraum, Behälter und Anlass vollständig eintragen.')
    }
    fuegeVolumenPunktHinzu(this.stand, charge.id, {
      zeit: isoAusDatetimeLocal(daten.get('zeit')), fuellLiter, kopfraumLiter, behaelterId, anlass,
    })
    await this.persistieren('Volumenpunkt gespeichert.')
  }

  private async aktualisiereMessung(formular: HTMLFormElement): Promise<void> {
    const messung = this.stand.messungen.find(eintrag => eintrag.id === this.ui.editMessungId)
    if (!messung) return this.formularFehler('Die Messung wurde nicht gefunden.')
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === messung.typ)
    if (!definition) return this.formularFehler('Unbekannte Messgröße.')
    const daten = new FormData(formular)
    const chargeId = String(daten.get('chargeId') ?? '')
    if (!this.stand.chargen.some(charge => charge.id === chargeId)) return this.formularFehler('Wähle eine gültige Charge aus.')
    const wert = definition.art === 'zahl' ? parseDeZahl(daten.get('wert')) : null
    const text = definition.art === 'auswahl' ? String(daten.get('text') ?? '') : undefined
    if (definition.art === 'zahl' && wert === null) return this.formularFehler('Trage einen gültigen Zahlenwert ein.')
    if ((messung.typ === 'volumen' || messung.typ === 'kopfraum') && wert !== null && wert < 0) return this.formularFehler('Volumenwerte müssen mindestens 0 L betragen.')
    if (definition.art === 'auswahl' && !text) return this.formularFehler('Wähle einen Wert aus.')
    Object.assign(messung, {
      chargeId,
      zeit: isoAusDatetimeLocal(daten.get('zeit')),
      wert,
      text,
      methode: DICHTE_TYPEN.includes(messung.typ) ? String(daten.get('methode') ?? 'spindel') as MessMethode : undefined,
      notiz: String(daten.get('notiz') ?? '').trim() || undefined,
    })
    markiereGeaendert(messung)
    await this.speichereLokalUndStarteAbgleich()
    this.ui.chargeId = chargeId
    this.ui.chargeTab = 'messungen'
    this.ui.ansicht = 'charge'
    this.ui.editMessungId = null
    this.ui.status = { art: 'erfolg', text: 'Messung aktualisiert.' }
    this.schreibeHistory(true)
    this.render()
  }

  private async loescheMessung(messungId: string): Promise<void> {
    const index = this.stand.messungen.findIndex(eintrag => eintrag.id === messungId)
    if (index < 0) return this.zeigeStatus('fehler', 'Die Messung wurde nicht gefunden.')
    const messung = this.stand.messungen[index]!
    if (!window.confirm(`${this.messLabel(messung.typ)} vom ${datumZeitFormat.format(new Date(messung.zeit))} löschen?`)) return
    this.stand.messungen.splice(index, 1)
    merkeLoeschung(this.stand, 'messungen', messungId)
    await this.speichereLokalUndStarteAbgleich()
    this.ui.chargeId = messung.chargeId
    this.ui.chargeTab = 'messungen'
    this.ui.ansicht = 'charge'
    this.ui.editMessungId = null
    this.ui.status = { art: 'erfolg', text: 'Messung gelöscht.' }
    this.schreibeHistory(true)
    this.render()
  }

  private async aktualisiereEreignis(formular: HTMLFormElement): Promise<void> {
    const ereignis = this.stand.ereignisse.find(eintrag => eintrag.id === this.ui.editEreignisId)
    if (!ereignis) return this.formularFehler('Das Ereignis wurde nicht gefunden.')
    const daten = new FormData(formular)
    const chargeId = String(daten.get('chargeId') ?? '')
    if (!this.stand.chargen.some(charge => charge.id === chargeId)) return this.formularFehler('Wähle eine gültige Charge aus.')
    const begruendung = String(daten.get('begruendung') ?? '').trim()
    if (!begruendung) return this.formularFehler('Die Begründung ist Pflicht.')
    const mengeRoh = String(daten.get('mengeWert') ?? '').trim()
    const mengeWert = mengeRoh ? parseDeZahl(mengeRoh) : null
    if (mengeRoh && (mengeWert === null || mengeWert < 0)) return this.formularFehler('Trage eine gültige Menge ab 0 ein.')
    const aktualisiert: Ereignis = {
      ...ereignis,
      chargeId,
      zeit: isoAusDatetimeLocal(daten.get('zeit')),
      art: String(daten.get('art')) as EreignisArt,
      stoff: String(daten.get('stoff') ?? '').trim() || undefined,
      produkt: String(daten.get('produkt') ?? '').trim() || undefined,
      mengeWert: mengeWert ?? undefined,
      mengeEinheit: String(daten.get('mengeEinheit') ?? '').trim() || undefined,
      vorratId: String(daten.get('vorratId') ?? '').trim() || undefined,
      begruendung,
    }
    try {
      aktualisiereEreignisMitVorrat(this.stand, ereignis.id, aktualisiert)
      await this.speichereLokalUndStarteAbgleich()
    } catch (error) {
      return this.formularFehler(error instanceof Error ? error.message : 'Ereignis konnte nicht aktualisiert werden.')
    }
    this.ui.chargeId = chargeId
    this.ui.chargeTab = 'ereignisse'
    this.ui.ansicht = 'charge'
    this.ui.editEreignisId = null
    this.ui.status = { art: 'erfolg', text: 'Ereignis aktualisiert; die Vorratsbuchung wurde angeglichen.' }
    this.schreibeHistory(true)
    this.render()
  }

  private async loescheEreignis(ereignisId: string): Promise<void> {
    const ereignis = this.stand.ereignisse.find(eintrag => eintrag.id === ereignisId)
    if (!ereignis) return this.zeigeStatus('fehler', 'Das Ereignis wurde nicht gefunden.')
    if (!window.confirm(`${EREIGNIS_LABEL[ereignis.art]} vom ${datumZeitFormat.format(new Date(ereignis.zeit))} löschen? Eine Vorratsbuchung wird zurückgebucht.`)) return
    try {
      loescheEreignisMitVorrat(this.stand, ereignisId)
      await this.speichereLokalUndStarteAbgleich()
      this.ui.chargeId = ereignis.chargeId
      this.ui.chargeTab = 'ereignisse'
      this.ui.ansicht = 'charge'
      this.ui.editEreignisId = null
      this.ui.status = { art: 'erfolg', text: 'Ereignis gelöscht. Eine verknüpfte Vorratsmenge wurde zurückgebucht.' }
      this.schreibeHistory(true)
      this.render()
    } catch (error) {
      this.zeigeStatus('fehler', error instanceof Error ? error.message : 'Ereignis konnte nicht gelöscht werden.')
    }
  }

  private async setzePhase(phase: Phase): Promise<void> {
    const charge = this.aktuelleCharge()
    if (!charge || !PHASEN_REIHE.includes(phase)) return
    const aktuell = PHASEN_REIHE.indexOf(charge.phase)
    const ziel = PHASEN_REIHE.indexOf(phase)
    if (ziel > aktuell) return this.zeigeStatus('fehler', 'Vorwärtswechsel sind nur über den Weiter-Knopf möglich.')
    charge.phase = phase
    charge.phaseSeit = new Date().toISOString()
    markiereGeaendert(charge)
    await this.persistieren('Phase gespeichert.')
  }

  private async phaseWeiter(): Promise<void> {
    const charge = this.aktuelleCharge()
    if (!charge) return
    if (ampelFuerCharge(this.stand, charge) === 'RED') return this.zeigeStatus('fehler', 'Die rote Ampel sperrt den Phasenwechsel. Öffne die Befunde und behebe die Ursache.')
    const gate = gateFuerPhase(this.stand, charge)
    if (gate && !gate.freigegeben) return this.zeigeStatus('fehler', 'Gate nicht freigegeben.')
    const naechste = PHASEN_REIHE[PHASEN_REIHE.indexOf(charge.phase) + 1]
    if (!naechste) return
    charge.phase = naechste
    charge.phaseSeit = new Date().toISOString()
    markiereGeaendert(charge)
    await this.persistieren(`Phase auf ${PHASEN_LABEL[naechste]} gesetzt.`)
  }

  private async legeGateReminderAn(): Promise<void> {
    const charge = this.aktuelleCharge()
    const gate = charge ? gateFuerPhase(this.stand, charge) : null
    if (!charge || !gate) return
    const faellig = new Date(Date.now() + 24 * 60 * 60 * 1000)
    this.stand.reminder.push({ id: id('reminder'), zuletztGeaendert: new Date().toISOString(), chargeId: charge.id, faellig: faellig.toISOString(), titel: `${gate.titel} erneut prüfen`, beschreibung: gate.blocker.join(' · ') || `Gate für ${charge.name} prüfen.`, erledigt: false, quelle: 'regel', regelId: gate.gate })
    await this.persistieren('Erinnerung für morgen angelegt.')
  }

  private aktualisiereRechner(): void {
    const formular = this.root.querySelector<HTMLFormElement>('#rechner-form')
    const ausgabe = this.root.querySelector<HTMLElement>('#rechner-ausgabe')
    if (!formular || !ausgabe) return
    const daten = new FormData(formular)
    const volumen = parseDeZahl(daten.get('volumen'))
    if (volumen === null || volumen <= 0) { ausgabe.innerHTML = '<div class="form-fehler">Füllvolumen in Litern eintragen.</div>'; return }
    if (this.ui.rechnerTyp === 'schwefeln') {
      const ph = parseDeZahl(daten.get('ph'))
      const frei = parseDeZahl(daten.get('frei'))
      const ergebnis = schwefelDosierung(volumen, ph, frei)
      const vorrat = this.stand.vorrat.find(posten => posten.id === 'vorrat-kps')?.mengeWert ?? 0
      const reicht = ergebnis.kpsGramm.wert <= vorrat
      ausgabe.innerHTML = `${this.renderRechenergebnis(ergebnis.kpsGramm.wert, ergebnis.kpsGramm.einheit, ergebnis.kpsGramm.formel, ergebnis.kpsGramm.sicherheit)}${ergebnis.zielFrei ? `<div class="info-box">Zielwert: ${zahlFormat.format(ergebnis.zielFrei.wert)} ${html(ergebnis.zielFrei.einheit)}.</div>` : ''}${ergebnis.kpsGramm.hinweise.map(hinweis => `<div class="warnbox">${this.fachtext(hinweis)}</div>`).join('')}<div class="${reicht ? 'erfolgbox' : 'fehlerbox'}"><strong>Vorrat:</strong> ${zahlFormat.format(vorrat)} g. ${reicht ? `Danach verbleiben ${zahlFormat.format(vorrat - ergebnis.kpsGramm.wert)} g.` : `Die berechnete Zugabe übersteigt den verfügbaren Vorrat um ${zahlFormat.format(ergebnis.kpsGramm.wert - vorrat)} g.`}</div><div class="warnbox">${this.fachtext(ergebnis.bindungshinweis)}</div><button class="btn btn-haupt" type="button" data-action="ergebnis-protokollieren" data-art="schwefeln" data-dosis="${ergebnis.kpsGramm.wert / volumen}" data-stoff="Kaliumpyrosulfit" data-einheit="g">Als Zugabe protokollieren</button>`
      this.bindeRechnerProtokollieren()
      return
    }
    if (this.ui.rechnerTyp === 'aufzuckern') {
      const istOe = parseDeZahl(daten.get('istOe'))
      const zielOe = parseDeZahl(daten.get('zielOe'))
      if (istOe === null || zielOe === null) { ausgabe.innerHTML = '<div class="form-fehler">Ist- und Zielwert in °Oe eintragen.</div>'; return }
      if (this.ui.chargeId) this.ui.zuckerZielJeCharge[this.ui.chargeId] = zielOe
      const ergebnis = zuckerFuerOechsle(volumen, istOe, zielOe)
      const alkohol = alkoholPotenzial(zielOe)
      const alkoholContainer = this.root.querySelector<HTMLElement>('#alkohol-potenzial')
      if (alkoholContainer) alkoholContainer.innerHTML = `<div class="info-box">Alkoholpotenzial: ${zahlFormat.format(alkohol.wert)} ${html(alkohol.einheit)} · ${html(alkohol.sicherheit)} · ${html(alkohol.formel)}</div>`
      ausgabe.innerHTML = `${this.renderRechenergebnis(ergebnis.wert, ergebnis.einheit, ergebnis.formel, ergebnis.sicherheit)}${ergebnis.hinweise.map(hinweis => `<div class="warnbox">${this.fachtext(hinweis)}</div>`).join('')}<button class="btn btn-haupt" type="button" data-action="ergebnis-protokollieren" data-art="aufzuckern" data-dosis="${ergebnis.wert / volumen}" data-stoff="Haushaltszucker" data-einheit="g">Als Zugabe protokollieren</button>`
      this.bindeRechnerProtokollieren()
      return
    }
    const ergebnis = naehrsalzPlan(volumen)
    const formel = `${zahlFormat.format(volumen)} L × ${NAEHRSALZ_MAX_G_PRO_100L} g ÷ 100 L ÷ ${NAEHRSALZ_PORTIONEN}`
    ausgabe.innerHTML = `${this.renderRechenergebnis(ergebnis.proPortion, 'g Hefenährsalz je Portion', formel, 'gerechnet')}<div class="info-box">Gesamthöchstmenge: ${zahlFormat.format(ergebnis.gesamtMax)} g.</div>${ergebnis.hinweise.map(hinweis => `<div class="warnbox">${this.fachtext(hinweis)}</div>`).join('')}<button class="btn btn-haupt" type="button" data-action="ergebnis-protokollieren" data-art="naehrsalz" data-dosis="${ergebnis.proPortion / volumen}" data-stoff="Hefenährsalz" data-einheit="g">Als Zugabe protokollieren</button>`
    this.bindeRechnerProtokollieren()
  }

  private renderRechenergebnis(wert: number, einheit: string, formel: string, sicherheit: 'gemessen' | 'gerechnet' | 'geschaetzt'): string {
    return `<div class="ergebnis"><div class="merker merker-${sicherheit}">${html(sicherheit)}</div><div><span class="ergebnis-zahl">${zahlFormat.format(wert)}</span> <span class="ergebnis-einheit">${html(einheit)}</span></div><div class="formel">${this.fachtext(formel)}</div></div>`
  }

  private bindeRechnerProtokollieren(): void {
    const knopf = this.root.querySelector<HTMLButtonElement>('[data-action="ergebnis-protokollieren"]')
    if (!knopf) return
    knopf.onclick = () => {
      const draft = { art: knopf.dataset.art ?? 'sonstiges', dosis: knopf.dataset.dosis ?? '', stoff: knopf.dataset.stoff ?? '', einheit: knopf.dataset.einheit ?? 'g' }
      this.ui.erfassenModus = 'ereignis'
      this.ui.ansicht = 'erfassen'
      this.schreibeHistory()
      this.render()
      const art = this.root.querySelector<HTMLSelectElement>('#ereignis-art')
      if (art) { art.value = draft.art; this.aktualisiereZugabeFelder(draft.art as EreignisArt) }
      const stoff = this.root.querySelector<HTMLInputElement>('#ereignis-stoff')
      const dosis = this.root.querySelector<HTMLInputElement>('#ereignis-dosis')
      const einheit = this.root.querySelector<HTMLSelectElement>('#ereignis-einheit')
      if (stoff) stoff.value = draft.stoff
      if (dosis) dosis.value = formatiereZahl(Number(draft.dosis), 4)
      if (einheit) einheit.value = draft.einheit
    }
  }

  private async speichereReminder(formular: HTMLFormElement): Promise<void> {
    const daten = new FormData(formular)
    const reminder: Reminder = { id: id('reminder'), zuletztGeaendert: new Date().toISOString(), titel: String(daten.get('titel')), beschreibung: String(daten.get('beschreibung')), faellig: isoAusDatetimeLocal(daten.get('faellig')), erledigt: false, quelle: 'manuell' }
    this.stand.reminder.push(reminder)
    await this.persistieren('Termin gespeichert.')
  }

  private async toggleReminder(reminderId: string): Promise<void> {
    const reminder = this.stand.reminder.find(eintrag => eintrag.id === reminderId)
    if (!reminder) return
    reminder.erledigt = !reminder.erledigt
    markiereGeaendert(reminder)
    await this.persistieren('Terminstatus gespeichert.')
  }

  private exportiereEinzelIcs(reminderId: string): void {
    const reminder = this.stand.reminder.find(eintrag => eintrag.id === reminderId)
    if (!reminder) return
    ladeDatei(new Blob([reminderAlsIcs(reminder)], { type: 'text/calendar;charset=utf-8' }), `${dateiname(reminder.titel)}.ics`)
  }

  private exportiereAlleIcs(): void {
    ladeDatei(new Blob([kalenderAlsIcs(this.stand.reminder)], { type: 'text/calendar;charset=utf-8' }), `weinbegleiter-${this.stand.jahrgang}.ics`)
  }

  private async speichereWiki(formular: HTMLFormElement): Promise<void> {
    const daten = new FormData(formular)
    const seiteId = String(daten.get('id') ?? '')
    const titel = String(daten.get('titel') ?? '').trim()
    const inhalt = String(daten.get('inhalt') ?? '').trim()
    const tags = String(daten.get('tags') ?? '').split(',').map(tag => tag.trim()).filter(Boolean)
    const vorhanden = this.stand.wiki.find(seite => seite.id === seiteId)
    if (vorhanden) {
      Object.assign(vorhanden, { titel, inhalt, tags, aktualisiert: new Date().toISOString() })
      markiereGeaendert(vorhanden)
    }
    else {
      const zeit = new Date().toISOString()
      const neu: WikiSeite = { id: id('wiki'), zuletztGeaendert: zeit, slug: dateiname(titel), titel, inhalt, tags, aktualisiert: zeit }
      this.stand.wiki.push(neu)
      this.ui.wikiId = neu.id
    }
    await this.persistieren('Wiki-Seite gespeichert.')
    this.ui.ansicht = 'wiki-seite'
    this.schreibeHistory(true)
    this.render()
  }

  private async speichereSensor(formular: HTMLFormElement, submitter: HTMLButtonElement | null): Promise<void> {
    const daten = new FormData(formular)
    const konfig: SensorKonfig = {
      zuletztGeaendert: new Date().toISOString(),
      aktiv: true,
      adapter: String(daten.get('adapter')) as SensorKonfig['adapter'],
      url: String(daten.get('url') ?? '').trim(),
      token: String(daten.get('token') ?? '').trim() || undefined,
      geraeteId: String(daten.get('geraeteId') ?? '').trim() || undefined,
      pfadTemperatur: String(daten.get('pfadTemperatur') ?? '').trim() || undefined,
      pfadFeuchte: String(daten.get('pfadFeuchte') ?? '').trim() || undefined,
    }
    const fehler = pruefeSensorKonfiguration(konfig)
    const fehlerFeld = this.root.querySelector<HTMLElement>('#sensor-fehler')
    if (fehler) { if (fehlerFeld) fehlerFeld.innerHTML = `<div class="form-fehler">${html(fehler)}</div>`; return }
    this.stand.sensor = konfig
    if (submitter?.value === 'testen') {
      try {
        submitter.disabled = true
        submitter.textContent = 'Verbindung läuft …'
        const wert = await ladeSensorwert(konfig)
        this.stand.klima.push(alsKlimapunkt(wert, 'sensor'))
        await this.persistieren(`Sensorwert gespeichert: ${formatiereZahl(wert.temperatur)} °C.`)
      } catch (error) {
        if (fehlerFeld) fehlerFeld.innerHTML = `<div class="form-fehler">${html(error instanceof Error ? error.message : 'Sensorabfrage fehlgeschlagen.')}</div>`
        if (submitter) { submitter.disabled = false; submitter.textContent = 'Verbindung testen' }
      }
    } else await this.persistieren('Sensorkonfiguration gespeichert.')
  }

  private async speichereKlima(formular: HTMLFormElement): Promise<void> {
    const daten = new FormData(formular)
    const temperatur = parseDeZahl(daten.get('temperatur'))
    const feuchte = parseDeZahl(daten.get('feuchte'))
    if (temperatur === null) return this.zeigeStatus('fehler', 'Gültige Temperatur eintragen.')
    const zeit = new Date().toISOString()
    this.stand.klima.push({ id: id('klima'), zuletztGeaendert: zeit, zeit, temperatur, feuchte: feuchte ?? undefined, quelle: 'manuell' })
    await this.persistieren('Manueller Klimawert gespeichert.')
  }

  private aktualisiereZielzeilen(): void {
    const formular = this.root.querySelector<HTMLFormElement>('#umverteilen-form')
    const container = this.root.querySelector<HTMLElement>('#ziel-zeilen')
    if (!formular || !container) return
    const anzahl = Number(new FormData(formular).get('zielAnzahl') ?? 4)
    const quellen = this.gewaehlteChargen(formular, 'quellen')
    const gesamt = quellen.reduce((summe, charge) => summe + (charge.mengeKg ?? 0), 0)
    container.innerHTML = this.zielZeilen(anzahl, gesamt, quellen)
    this.pruefeUmverteilung()
  }

  private pruefeUmverteilung(): boolean {
    const formular = this.root.querySelector<HTMLFormElement>('#umverteilen-form')
    const ausgabe = this.root.querySelector<HTMLElement>('#umverteilen-pruefung')
    if (!formular || !ausgabe) return false
    const quellen = this.gewaehlteChargen(formular, 'quellen')
    if (!quellen.length) { ausgabe.innerHTML = '<div class="form-fehler">Mindestens eine Ausgangscharge wählen.</div>'; return false }
    for (let a = 0; a < quellen.length; a += 1) {
      for (let b = a + 1; b < quellen.length; b += 1) {
        const pruefung = vermischungErlaubt(this.stand, quellen[a]!, quellen[b]!)
        if (!pruefung.erlaubt) { ausgabe.innerHTML = `<div class="fehlerbox"><strong>Vermischung blockiert.</strong> ${html(pruefung.grund)}</div>`; return false }
      }
    }
    const daten = new FormData(formular)
    const zielSumme = daten.getAll('zielMenge').reduce((summe, wert) => summe + (parseDeZahl(wert) ?? 0), 0)
    const quellSumme = quellen.reduce((summe, charge) => summe + (charge.mengeKg ?? 0), 0)
    if (Math.abs(zielSumme - quellSumme) > 0.01) { ausgabe.innerHTML = `<div class="form-fehler">Zielsumme ${formatiereZahl(zielSumme, 3)} kg stimmt nicht mit ${formatiereZahl(quellSumme, 3)} kg Ausgangsmenge überein.</div>`; return false }
    const behaelterIds = daten.getAll('zielBehaelter').map(String).filter(Boolean)
    if (new Set(behaelterIds).size !== behaelterIds.length) { ausgabe.innerHTML = '<div class="form-fehler">Jeder Zielcharge muss ein anderer Behälter zugeordnet sein.</div>'; return false }
    ausgabe.innerHTML = `<div class="erfolgbox">Freigegeben durch <code>vermischungErlaubt()</code>. Summe: ${formatiereZahl(quellSumme, 3)} kg.</div>`
    return true
  }

  private async speichereUmverteilung(formular: HTMLFormElement): Promise<void> {
    if (!this.pruefeUmverteilung()) return
    const quellen = this.gewaehlteChargen(formular, 'quellen')
    const daten = new FormData(formular)
    const namen = daten.getAll('zielName').map(String)
    const mengen = daten.getAll('zielMenge').map(wert => parseDeZahl(wert) ?? 0)
    const behaelter = daten.getAll('zielBehaelter').map(String)
    const begruendung = String(daten.get('begruendung') ?? '').trim()
    if (!begruendung) return this.zeigeStatus('fehler', 'Begründung ist Pflicht.')
    const zeit = new Date().toISOString()
    const neueChargen: Charge[] = namen.map((name, index) => ({
      id: id('charge'), zuletztGeaendert: zeit, jahrgang: this.stand.jahrgang, name, typ: quellen[0]?.typ ?? 'maische', phase: 'ANSTELLEN', phaseSeit: zeit, startdatum: zeit,
      elternChargeId: quellen[0]?.id, mengeKg: mengen[index] ?? 0, behaelterId: behaelter[index] || undefined,
      volumenHistorie: [], gesperrt: false, isoliert: false,
      notiz: `Umverteilt aus ${quellen.map(charge => charge.name).join(', ')}. Begründung: ${begruendung}`,
    }))
    quellen.forEach(charge => { charge.archiviert = true; markiereGeaendert(charge, zeit) })
    this.stand.chargen.push(...neueChargen)
    this.ui.chargeId = neueChargen[0]?.id ?? this.ui.chargeId
    await this.persistieren(`${neueChargen.length} Zielchargen angelegt; Ausgangschargen archiviert.`)
    this.ui.ansicht = 'heute'
    this.schreibeHistory(true)
    this.render()
  }

  private exportiereMarkdown(): void {
    ladeDatei(new Blob([alsMarkdown(this.stand)], { type: 'text/markdown;charset=utf-8' }), `jahrgang-${this.stand.jahrgang}.md`)
  }

  private exportiereCsv(): void {
    ladeDatei(new Blob([alsCsv(this.stand)], { type: 'text/csv;charset=utf-8' }), `messreihen-${this.stand.jahrgang}.csv`)
  }

  private async exportiereJson(): Promise<void> {
    const sicherung = await alsSicherung(this.stand, this.fotos)
    ladeDatei(new Blob([JSON.stringify(sicherung, null, 2)], { type: 'application/json;charset=utf-8' }), `weinbegleiter-${this.stand.jahrgang}-vollsicherung.json`)
  }

  private async exportiereZip(): Promise<void> {
    const encoder = new TextEncoder()
    const sicherung = await alsSicherung(this.stand, this.fotos)
    const dateien: Array<{ name: string; daten: Uint8Array }> = [
      { name: `jahrgang-${this.stand.jahrgang}.md`, daten: encoder.encode(alsMarkdown(this.stand)) },
      { name: `messreihen-${this.stand.jahrgang}.csv`, daten: encoder.encode(alsCsv(this.stand)) },
      { name: 'vollsicherung.json', daten: encoder.encode(JSON.stringify(sicherung, null, 2)) },
    ]
    for (const foto of this.fotos) {
      const endung = foto.blob.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'
      dateien.push({ name: `fotos/${foto.id}.${endung}`, daten: new Uint8Array(await foto.blob.arrayBuffer()) })
    }
    ladeDatei(baueZip(dateien), `weinbegleiter-${this.stand.jahrgang}.zip`)
  }

  private async importiereJson(datei: File): Promise<void> {
    try {
      if (!window.confirm('Der Import ersetzt den vollständigen aktuellen Datenstand und alle Fotos. Fortfahren?')) return
      const wert: unknown = JSON.parse(await datei.text())
      if (!istSicherung(wert) || !istAppDatenstand(wert.datenstand)) throw new Error('Die Datei ist keine gültige Weinbegleiter-Vollsicherung.')
      const stand = migriereDatenstand(wert.datenstand)
      const fotos = wert.fotos.map(fotoAusSicherung)
      await speichereDatenstand(stand)
      await ersetzeFotos(fotos)
      this.stand = stand
      this.fotos = fotos
      void this.starteAbgleich()
      this.ui.chargeId = this.aktiveChargen()[0]?.id ?? ''
      this.zeigeStatus('erfolg', `Die App hat die Vollsicherung importiert: ${stand.chargen.length} Chargen, ${stand.messungen.length} Messungen und ${stand.ereignisse.length} Ereignisse.`)
    } catch (error) {
      const grund = error instanceof Error ? error.message : 'Die Datei konnte nicht gelesen werden.'
      this.zeigeStatus('fehler', `Import fehlgeschlagen. Die App erwartet das Format { schema, exportiert, datenstand, fotos }. ${grund}`)
    }
  }

  private letzteMessung(chargeId: string, typ: MessTyp): Messung | undefined {
    return this.stand.messungen.filter(messung => messung.chargeId === chargeId && messung.typ === typ).sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
  }

  private messLabel(typ: MessTyp): string {
    return MESS_DEFINITIONEN.find(eintrag => eintrag.typ === typ)?.label ?? typ
  }

  private messEinheit(typ: MessTyp): string {
    return MESS_DEFINITIONEN.find(eintrag => eintrag.typ === typ)?.einheit ?? ''
  }

  private fachtext(text: string): string {
    return html(text.replace(/(\d)\.(?=\d)/g, '$1,'))
  }

  private lokalesIsoDatum(datum: Date): string {
    const jahr = datum.getFullYear()
    const monat = (datum.getMonth() + 1).toString().padStart(2, '0')
    const tag = datum.getDate().toString().padStart(2, '0')
    return `${jahr}-${monat}-${tag}`
  }

  private wikiAuszug(markdown: string): string {
    return markdown.replace(/^#+\s*/gm, '').replace(/[*#[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150)
  }

  private markdown(text: string): string {
    const zeilen = text.split(/\r?\n/)
    const ausgabe: string[] = []
    let listeOffen = false
    for (const zeile of zeilen) {
      const listenTreffer = /^-\s+(.+)/.exec(zeile)
      if (listenTreffer) {
        if (!listeOffen) { ausgabe.push('<ul>'); listeOffen = true }
        ausgabe.push(`<li>${this.markdownInline(listenTreffer[1] ?? '')}</li>`)
        continue
      }
      if (listeOffen) { ausgabe.push('</ul>'); listeOffen = false }
      const h2 = /^##\s+(.+)/.exec(zeile)
      const h1 = /^#\s+(.+)/.exec(zeile)
      if (h2) ausgabe.push(`<h2>${this.markdownInline(h2[1] ?? '')}</h2>`)
      else if (h1) ausgabe.push(`<h1>${this.markdownInline(h1[1] ?? '')}</h1>`)
      else if (zeile.trim()) ausgabe.push(`<p>${this.markdownInline(zeile)}</p>`)
    }
    if (listeOffen) ausgabe.push('</ul>')
    return ausgabe.join('')
  }

  private markdownInline(text: string): string {
    return html(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_gesamt, label: string, ziel: string) => {
        const dekodiert = ziel.replace(/&amp;/g, '&')
        return /^(https:\/\/|#|\.\/)/i.test(dekodiert) ? `<a href="${ziel}" target="_blank" rel="noreferrer">${label}</a>` : label
      })
  }
}
