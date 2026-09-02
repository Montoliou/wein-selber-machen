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
import { alsKlimapunkt, ladeSensorwert, pruefeSensorKonfiguration } from '../sensor'
import { ersetzeFotos, speichereDatenstand, speichereFoto } from '../speicher/indexeddb'
import {
  fuegeVolumenPunktHinzu,
  istAppDatenstand,
  loescheEreignisMitVorrat,
  migriereDatenstand,
  pruefeEreignisseMitVorrat,
  speichereEreignisseMitVorrat,
  summeVorratsabgaenge,
  type AppDatenstand,
} from '../speicher/modell'
import { alsCsv, alsMarkdown, alsSicherung, baueZip, fotoAusSicherung, istSicherung, ladeDatei } from './export'
import { dateiname, datetimeLocalWert, datumFormat, datumZeitFormat, formatiereZahl, html, id, isoAusDatetimeLocal, kurzDatumFormat, parseDeZahl, zahlFormat } from './format'
import { icon } from './icons'

type Ansicht = 'heute' | 'charge' | 'erfassen' | 'rechner' | 'gate' | 'termine' | 'wiki' | 'wiki-seite' | 'wiki-editor' | 'mehr' | 'umverteilen'
type ChargeTab = 'befunde' | 'messungen' | 'ereignisse' | 'gefaess' | 'fotos'
type RechnerTyp = 'schwefeln' | 'aufzuckern' | 'naehrsalz'
type ErfassenModus = 'messung' | 'ereignis'

const DICHTE_TYPEN: MessTyp[] = ['oechsle', 'sg', 'brix']
const DICHTE_KURVEN_TYPEN: MessTyp[] = ['oechsle', 'sg']
const ZUGABE_ARTEN: EreignisArt[] = ['schwefeln', 'aufzuckern', 'naehrsalz', 'hefe', 'suessen', 'stabilisieren']
const VOLUMEN_EREIGNIS_ARTEN: EreignisArt[] = ['pressen', 'abstich', 'umfuellen', 'auffuellen']
const VORRAT_NACH_ART: Partial<Record<EreignisArt, string>> = {
  schwefeln: 'vorrat-kps', aufzuckern: 'vorrat-zucker', naehrsalz: 'vorrat-naehrsalz', hefe: 'vorrat-hefe',
}
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

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
  { phase: 'KALTMAZERATION', label: 'Mazeration' },
  { phase: 'ANSTELLEN', label: 'Anstellen' },
  { phase: 'AKTIVE_GAERUNG', label: 'Gärung' },
  { phase: 'PRESS_GATE', label: 'Press-Gate' },
  { phase: 'ERSTER_ABSTICH', label: 'Abstich' },
  { phase: 'AUSBAU', label: 'Ausbau' },
  { phase: 'FLASCHE', label: 'Flasche' },
]

interface UiZustand {
  ansicht: Ansicht
  chargeId: string
  chargeTab: ChargeTab
  erfassenModus: ErfassenModus
  messTyp: MessTyp
  rechnerTyp: RechnerTyp
  wikiId: string | null
  wikiFilter: string
  wikiTag: string | null
  status: { art: 'erfolg' | 'fehler'; text: string } | null
}

export class WeinbegleiterApp {
  private readonly root: HTMLElement
  private stand: AppDatenstand
  private fotos: Foto[]
  private ui: UiZustand
  private fotoUrls: string[] = []

  constructor(root: HTMLElement, stand: AppDatenstand, fotos: Foto[]) {
    this.root = root
    this.stand = stand
    this.fotos = fotos
    this.ui = {
      ansicht: 'heute',
      chargeId: stand.chargen.find(charge => !charge.archiviert)?.id ?? '',
      chargeTab: 'befunde',
      erfassenModus: 'messung',
      messTyp: 'temperatur',
      rechnerTyp: 'schwefeln',
      wikiId: null,
      wikiFilter: '',
      wikiTag: null,
      status: null,
    }
    this.root.addEventListener('click', event => void this.behandleKlick(event))
    this.root.addEventListener('submit', event => void this.behandleSubmit(event))
    this.root.addEventListener('change', event => void this.behandleAenderung(event))
    this.root.addEventListener('input', event => this.behandleEingabe(event))
    window.addEventListener('popstate', event => {
      const route = event.state as { weinbegleiter?: boolean; ui?: Partial<UiZustand> } | null
      if (!route?.weinbegleiter || !route.ui) return
      this.ui = { ...this.ui, ...route.ui, status: this.ui.status }
      this.render()
    })
  }

  start(): void {
    this.schreibeHistory(true)
    this.render()
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
    this.root.innerHTML = `${this.renderHeader()}<main id="hauptinhalt" tabindex="-1">${this.renderSeite()}</main>${this.renderNavigation()}${this.renderStatus()}`
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
      { ansicht: 'termine', label: 'Termine', bild: 'kalender' },
      { ansicht: 'wiki', label: 'Wiki', bild: 'buch' },
      { ansicht: 'mehr', label: 'Mehr', bild: 'mehr' },
    ]
    const aktiv = this.hauptAnsicht()
    return `<nav class="bottom-nav" aria-label="Hauptnavigation">${basis.map(eintrag => `<button class="nav-knopf ${aktiv === eintrag.ansicht ? 'aktiv' : ''}" type="button" data-action="nav" data-view="${eintrag.ansicht}" ${aktiv === eintrag.ansicht ? 'aria-current="page"' : ''}>${icon(eintrag.bild)}<span>${eintrag.label}</span></button>`).join('')}</nav>`
  }

  private hauptAnsicht(): Ansicht {
    if (['charge', 'erfassen', 'rechner', 'gate', 'umverteilen'].includes(this.ui.ansicht)) return 'heute'
    if (['wiki-seite', 'wiki-editor'].includes(this.ui.ansicht)) return 'wiki'
    return this.ui.ansicht
  }

  private renderStatus(): string {
    if (!this.ui.status) return ''
    const titel = this.ui.status.art === 'erfolg' ? 'Gespeichert' : 'Fehler'
    return `<div class="statusmeldung meldung ${this.ui.status.art === 'erfolg' ? 'erfolg' : 'fehler'}" role="${this.ui.status.art === 'erfolg' ? 'status' : 'alert'}" aria-live="${this.ui.status.art === 'erfolg' ? 'polite' : 'assertive'}"><div class="meldung-text"><strong>${titel}</strong><span>${html(this.ui.status.text)}</span></div><button class="meldung-schliessen" type="button" data-action="status-schliessen" aria-label="Meldung schließen">×</button></div>`
  }

  private renderSeite(): string {
    switch (this.ui.ansicht) {
      case 'heute': return this.renderHeute()
      case 'charge': return this.renderCharge()
      case 'erfassen': return this.renderErfassen()
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
    const naechster = offeneReminder[0]
    const klima = [...this.stand.klima].sort((a, b) => b.zeit.localeCompare(a.zeit))[0]
    const leitCharge = this.aktiveChargen().sort((a, b) => PHASEN_REIHE.indexOf(b.phase) - PHASEN_REIHE.indexOf(a.phase))[0]
    return `<section class="seite" aria-labelledby="heute-titel">${this.renderStatusband(offeneReminder.length)}<h1 class="sr-only" id="heute-titel">Heute</h1>
      ${this.renderGaerkurve(this.aktiveChargen(), 'Gärverlauf aller Chargen')}
      <h2>Jetzt dran</h2>
      ${naechster ? `<div class="karte karte-akzent"><div class="aktion">${naechster.titel.toLocaleLowerCase('de').includes('tresterhut') ? this.renderTresterhut() : icon('kalender')}<div><strong class="aktion-titel">${html(naechster.titel)}</strong><div class="aktion-text">Fällig: ${datumZeitFormat.format(new Date(naechster.faellig))}</div></div></div>${this.renderErklaerschublade('Warum das wichtig ist', naechster.beschreibung)}<button class="btn btn-haupt" type="button" data-action="nav" data-view="termine">Aufgabe öffnen</button></div>` : '<div class="karte leer">Keine offenen Aufgaben.</div>'}
      <div class="balken-actions"><button class="btn btn-haupt" type="button" data-action="erfassen">${icon('messung', 'icon-klein')} Sammelaktion</button><button class="btn" type="button" data-action="nav" data-view="umverteilen">Umverteilen</button></div>
      ${leitCharge ? `<h2>Wo der Jahrgang steht</h2><div class="karte">${this.renderZeitstrahl(leitCharge)}</div>` : ''}
      <h2>Chargen</h2>${this.aktiveChargen().map(charge => this.renderChargenKarte(charge)).join('') || '<div class="karte leer">Keine aktive Charge.</div>'}
      <h2>Kellerklima</h2><div class="klima-grid"><div class="klima-wert"><small>Letzte Temperatur</small><strong>${klima ? `${formatiereZahl(klima.temperatur)} °C` : '–'}</strong></div><div class="klima-wert"><small>Feuchte</small><strong>${klima?.feuchte === undefined ? '–' : `${formatiereZahl(klima.feuchte, 0)} %`}</strong></div></div><div class="hint">${klima ? `${klima.quelle === 'sensor' ? 'Sensor' : 'Manuell'} · ${datumZeitFormat.format(new Date(klima.zeit))}` : 'Noch kein Klimawert. Manuelle Eingabe ist unter Mehr jederzeit verfügbar.'}</div>
      <h2>Vorrat</h2><div class="karte">${this.stand.vorrat.map(posten => `<div class="vorratsposten"><div class="zeile"><span>${html(posten.name)}</span><b>${zahlFormat.format(posten.mengeWert)} ${html(posten.mengeEinheit)}</b></div><div class="hint">Abgänge: ${zahlFormat.format(summeVorratsabgaenge(this.stand, posten.id))} ${html(posten.mengeEinheit)}</div>${posten.notiz ? `<div class="hint">${html(posten.notiz)}</div>` : ''}</div>`).join('')}</div>
    </section>`
  }

  private renderStatusband(offeneAufgaben: number): string {
    const chargen = this.aktiveChargen()
    const ampel = chargen.map(charge => ampelFuerCharge(this.stand, charge)).sort((a, b) => AMPEL_RANG[b] - AMPEL_RANG[a])[0] ?? 'GREEN'
    const ampelKurz: Record<Ampel, string> = { GREEN: 'grün', YELLOW: 'gelb', ORANGE: 'orange', RED: 'rot' }
    const leitCharge = chargen.sort((a, b) => PHASEN_REIHE.indexOf(b.phase) - PHASEN_REIHE.indexOf(a.phase))[0]
    const tag = leitCharge ? this.tagDerPhase(leitCharge) : null
    return `<div class="statusband" aria-label="Jahrgangsstatus"><div class="statuswert"><strong>${chargen.length}</strong><span>Chargen</span></div><div class="statuswert status-${ampel.toLowerCase()}"><strong>${ampelKurz[ampel]}</strong><span>Ampel</span></div><div class="statuswert"><strong>${tag === null ? '–' : `Tag ${tag}`}</strong><span>${leitCharge ? html(PHASEN_LABEL[leitCharge.phase]) : 'Phase'}</span></div><div class="statuswert ${offeneAufgaben ? 'status-offen' : ''}"><strong>${offeneAufgaben}</strong><span>offen</span></div></div>`
  }

  private tagDerPhase(charge: Charge): number {
    const differenz = Date.now() - new Date(charge.phaseSeit ?? charge.startdatum).getTime()
    return Math.max(1, Math.floor(differenz / 86_400_000) + 1)
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

  private renderGaerkurve(chargen: Charge[], titel: string): string {
    const ids = new Set(chargen.map(charge => charge.id))
    const gaerstarts = new Map(chargen.map(charge => [charge.id, this.stand.ereignisse
      .filter(ereignis => ereignis.chargeId === charge.id && ereignis.art === 'anstellen')
      .sort((a, b) => b.zeit.localeCompare(a.zeit))[0]?.zeit ?? charge.startdatum]))
    const gruppen = new Map<string, number[]>()
    this.stand.messungen
      .filter(messung => ids.has(messung.chargeId)
        && DICHTE_KURVEN_TYPEN.includes(messung.typ)
        && messung.methode !== 'refraktometer'
        && new Date(messung.zeit).getTime() >= new Date(gaerstarts.get(messung.chargeId) ?? '').getTime())
      .forEach(messung => {
        const sg = this.dichteAlsSg(messung)
        if (sg !== null) gruppen.set(messung.zeit, [...(gruppen.get(messung.zeit) ?? []), sg])
      })
    const punkte = [...gruppen.entries()].map(([zeit, werte]) => ({ zeit, sg: werte.reduce((summe, wert) => summe + wert, 0) / werte.length })).sort((a, b) => a.zeit.localeCompare(b.zeit))
    const pressFrage = chargen[0] ? pressGate(this.stand, chargen[0]).checks.find(check => check.id === 'press-restzucker')?.frage : undefined
    const pressTreffer = /SG\s*≤\s*([\d,.]+)/.exec(pressFrage ?? '')
    const pressGrenze = Number((pressTreffer?.[1] ?? '').replace(',', '.'))
    if (!Number.isFinite(pressGrenze)) return `<div class="kurve-karte"><div class="kurve-kopf"><h3>${html(titel)}</h3></div><div class="kurve-hinweis">Das Pressfenster konnte nicht aus dem Press-Gate gelesen werden.</div></div>`
    const pressGrenzeText = formatiereZahl(pressGrenze, 3)
    const erklaerung = `Die durchgezogene Linie zeigt deine Spindelwerte. Die gestrichelte Linie zeigt den erwarteten Verlauf. Das grüne Band beginnt bei SG ${pressGrenzeText}. Dort prüfst du das Press-Gate. Wird die gemessene Linie deutlich flacher, prüfst du Temperatur und Hefenährsalz.`
    if (punkte.length < 2) return `<div class="kurve-karte"><div class="kurve-kopf"><h3>${html(titel)}</h3></div><div class="kurve-hinweis">Für eine Kurve braucht die App mindestens zwei Dichtemessungen seit dem Anstellen.</div>${this.renderErklaerschublade('Worauf du bei der Kurve achtest', erklaerung)}</div>`

    const breite = 320
    const oben = 8
    const unten = 112
    const startMs = new Date(punkte[0]!.zeit).getTime()
    const endeMs = Math.max(new Date(punkte.at(-1)!.zeit).getTime(), startMs + 7 * 86_400_000)
    const maxSg = Math.max(1.09, ...punkte.map(punkt => punkt.sg))
    const minSg = 0.99
    const x = (zeit: string) => 6 + ((new Date(zeit).getTime() - startMs) / Math.max(1, endeMs - startMs)) * (breite - 12)
    const y = (sg: number) => oben + ((maxSg - sg) / (maxSg - minSg)) * (unten - oben)
    const istPfad = punkte.map((punkt, index) => `${index ? 'L' : 'M'}${x(punkt.zeit).toFixed(1)},${y(punkt.sg).toFixed(1)}`).join(' ')
    const erwartungsEnde = new Date(endeMs).toISOString()
    const erwartetPfad = `M${x(punkte[0]!.zeit).toFixed(1)},${y(punkte[0]!.sg).toFixed(1)} L${x(erwartungsEnde).toFixed(1)},${y(GRENZEN.gaerendeMaxSg).toFixed(1)}`
    const pressY = y(pressGrenze)
    const letzte = punkte.at(-1)!
    const tabellenText = punkte.map(punkt => `${datumZeitFormat.format(new Date(punkt.zeit))}: SG ${formatiereZahl(punkt.sg, 4)}`).join(' · ')
    return `<div class="kurve-karte"><div class="kurve-kopf"><h3>${html(titel)}</h3><div class="kurve-jetzt">jetzt <strong>SG ${formatiereZahl(letzte.sg, 4)}</strong></div></div><svg class="gaerkurve" viewBox="0 0 320 132" role="img" aria-label="${html(titel)}. ${html(tabellenText)}"><rect class="pressband" x="0" y="${pressY.toFixed(1)}" width="320" height="${Math.max(0, unten - pressY).toFixed(1)}"></rect><text class="presslabel" x="5" y="${Math.min(unten - 3, pressY + 12).toFixed(1)}">PRESSFENSTER · SG ≤ ${pressGrenzeText}</text><line class="kurvenachse" x1="0" y1="112" x2="320" y2="112"></line><path class="kurve-erwartet" d="${erwartetPfad}"></path><path class="kurve-ist" pathLength="1" d="${istPfad}"></path>${punkte.map(punkt => `<circle class="kurvenpunkt" cx="${x(punkt.zeit).toFixed(1)}" cy="${y(punkt.sg).toFixed(1)}" r="3.5"><title>${datumZeitFormat.format(new Date(punkt.zeit))}: SG ${formatiereZahl(punkt.sg, 4)} (${formatiereZahl(oechsleAusSg(punkt.sg), 0)} °Oe)</title></circle>`).join('')}<text class="achstext" x="4" y="128">${kurzDatumFormat.format(new Date(startMs))}</text><text class="achstext achstext-rechts" x="316" y="128">${kurzDatumFormat.format(new Date(endeMs))}</text></svg>${this.renderErklaerschublade('Worauf du bei der Kurve achtest', `${erklaerung} Messwerte: ${tabellenText}`)}</div>`
  }

  private renderChargenKarte(charge: Charge): string {
    const ampel = ampelFuerCharge(this.stand, charge)
    const letzteTemp = this.letzteMessung(charge.id, 'temperatur')
    const letzteDichte = this.letzteMessung(charge.id, 'oechsle') ?? this.letzteMessung(charge.id, 'sg')
    const elternId = charge.elternChargeId
    const gaeraktivitaet = this.letzteMessung(charge.id, 'gaeraktivitaet')
    return `<button class="karte klick chargenkarte" type="button" data-action="charge" data-id="${html(charge.id)}"><div class="charge-kopf"><div><div class="charge-name">${html(charge.name)}</div><div class="charge-meta">${charge.mengeKg === undefined ? 'Menge offen' : `${formatiereZahl(charge.mengeKg)} kg`} · ${html(PHASEN_LABEL[charge.phase])} · Tag ${this.tagDerPhase(charge)}</div></div>${this.renderAmpel(ampel)}</div><div class="chargenwerte"><div><strong>${letzteTemp?.wert == null ? '–' : `${formatiereZahl(letzteTemp.wert)}°`}</strong><span>Temperatur</span></div><div><strong>${letzteDichte?.wert == null ? '–' : `${zahlFormat.format(letzteDichte.wert)}`}</strong><span>${letzteDichte?.typ === 'sg' ? 'SG' : '°Oe'}</span></div><div><strong>${html(gaeraktivitaet?.text ?? '–')}</strong><span>Gärung</span></div></div>${elternId ? `<div class="abstammung">Abstammung: ${html(this.stand.chargen.find(c => c.id === elternId)?.name ?? elternId)}</div>` : ''}</button>`
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
      return `<div class="karte">${messungen.length ? messungen.map(m => `<div class="zeile"><span>${datumZeitFormat.format(new Date(m.zeit))} · ${html(this.messLabel(m.typ))}</span><b>${m.wert === null ? html(m.text ?? '–') : `${zahlFormat.format(m.wert)} ${html(this.messEinheit(m.typ))}`}${m.methode ? ` · ${html(m.methode)}` : ''}</b></div>`).join('') : '<div class="leer">Noch keine Messungen.</div>'}</div>`
    }
    if (this.ui.chargeTab === 'ereignisse') {
      const ereignisse = this.stand.ereignisse.filter(e => e.chargeId === charge.id).sort((a, b) => b.zeit.localeCompare(a.zeit))
      return `<div class="karte">${ereignisse.length ? ereignisse.map(e => `<div class="befund befund-green ereignis"><div class="befund-titel">${html(EREIGNIS_LABEL[e.art])} · ${datumZeitFormat.format(new Date(e.zeit))}</div><div class="befund-text">${e.stoff ? `${html(e.stoff)} · ` : ''}${e.mengeWert === undefined ? '' : `${zahlFormat.format(e.mengeWert)} ${html(e.mengeEinheit)} · `}${e.vorratId ? 'Vorrat abgezogen · ' : ''}${html(e.begruendung)}</div><button class="text-knopf text-gefahr" type="button" data-action="ereignis-loeschen" data-id="${html(e.id)}">Ereignis löschen</button></div>`).join('') : '<div class="leer">Noch keine Ereignisse.</div>'}</div>`
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
    return `<section class="seite" aria-labelledby="erfassen-titel"><button class="zurueck" type="button" data-action="nav" data-view="${charge ? 'charge' : 'heute'}">${icon('pfeil')}${charge ? html(charge.name) : 'Heute'}</button><h1 class="seiten-titel" id="erfassen-titel">Sammelaktion erfassen</h1><div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${this.ui.erfassenModus === id ? 'aktiv' : ''}" type="button" data-action="erfassen-modus" data-mode="${id}">${label}</button>`).join('')}</div>${this.ui.erfassenModus === 'messung' ? this.renderMessForm() : this.renderEreignisForm()}</section>`
  }

  private renderChargenAuswahl(name = 'chargeIds'): string {
    return `<fieldset><legend>Chargen auswählen</legend><div class="checkbox-liste">${this.aktiveChargen().map(charge => `<div class="checkbox-zeile"><input id="auswahl-${html(charge.id)}" name="${name}" value="${html(charge.id)}" type="checkbox" ${name === 'quellen' || charge.id === this.ui.chargeId ? 'checked' : ''}><label for="auswahl-${html(charge.id)}">${html(charge.name)} · ${html(PHASEN_LABEL[charge.phase])}</label></div>`).join('')}</div></fieldset>`
  }

  private renderMessForm(): string {
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === this.ui.messTyp) ?? MESS_DEFINITIONEN[0]!
    return `<form class="karte" id="mess-form">${this.renderChargenAuswahl()}<label for="mess-typ">Messgröße</label><select id="mess-typ" name="typ" data-action="mess-typ">${MESS_DEFINITIONEN.map(eintrag => `<option value="${eintrag.typ}" ${eintrag.typ === definition.typ ? 'selected' : ''}>${html(eintrag.label)}</option>`).join('')}</select>${definition.art === 'zahl' ? `<label for="mess-wert">${html(definition.label)}</label><input id="mess-wert" name="wert" inputmode="decimal" required><div class="hint">${html(definition.einheit)}${definition.hinweis ? ` · ${html(definition.hinweis)}` : ''}</div>` : `<label for="mess-text">Befund</label><select id="mess-text" name="text" required><option value="">Bitte wählen</option>${(definition.optionen ?? []).map(option => `<option>${html(option)}</option>`).join('')}</select>`}${DICHTE_TYPEN.includes(definition.typ) ? `<label for="mess-methode">Messmethode</label><select id="mess-methode" name="methode" data-action="mess-methode"><option value="spindel">Spindel</option><option value="refraktometer">Refraktometer</option><option value="sonstige">Sonstige</option></select><div id="refraktometer-hinweis"></div>` : ''}<label for="mess-zeit">Zeitpunkt</label><input id="mess-zeit" name="zeit" type="datetime-local" value="${datetimeLocalWert()}" required><label for="mess-notiz">Notiz (freiwillig)</label><textarea id="mess-notiz" name="notiz"></textarea><div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Für ausgewählte Chargen speichern</button><div class="hint">Pro Charge wird ein eigener Messdatensatz gespeichert.</div></form>`
  }

  private renderEreignisForm(): string {
    return `<form class="karte" id="ereignis-form">${this.renderChargenAuswahl()}<label for="ereignis-art">Art</label><select id="ereignis-art" name="art" data-action="ereignis-art">${Object.entries(EREIGNIS_LABEL).map(([wert, label]) => `<option value="${wert}">${html(label)}</option>`).join('')}</select><div id="zugabe-felder"></div><label for="ereignis-zeit">Zeitpunkt</label><input id="ereignis-zeit" name="zeit" type="datetime-local" value="${datetimeLocalWert()}" required><label for="ereignis-grund">Begründung *</label><textarea id="ereignis-grund" name="begruendung" required placeholder="Warum wird dieser Schritt jetzt ausgeführt?"></textarea><label for="ereignis-fotos">Fotos (freiwillig)</label><input id="ereignis-fotos" name="fotos" type="file" accept="image/*" multiple><div class="hint">Fotos werden als Blob getrennt vom Datenstand in IndexedDB gespeichert.</div><div id="erfassen-fehler" role="alert"></div><button class="btn btn-haupt" type="submit">Für ausgewählte Chargen speichern</button><div class="hint">Jede ausgewählte Charge erhält einen eigenen Ereignisdatensatz. Zugabemengen werden aus ihrem jeweiligen Volumen berechnet.</div></form>`
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
    return `<section class="seite" aria-labelledby="gate-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><div class="gate-kopf"><h1 class="seiten-titel" id="gate-titel">${html(gate.titel)}</h1>${this.renderAmpel(gate.freigegeben && !chargeGesperrt ? 'GREEN' : 'RED')}</div><div class="hint">Alle Prüfungen müssen erfüllt sein. Unbekannt blockiert wie nicht erfüllt, wird aber grau dargestellt.</div><div class="karte">${gate.checks.map(check => `<div class="check"><div class="check-status ${check.erfuellt === true ? 'check-ja' : check.erfuellt === false ? 'check-nein' : 'check-unbekannt'}" aria-label="${check.erfuellt === true ? 'Erfüllt' : check.erfuellt === false ? 'Nicht erfüllt' : 'Unbekannt'}">${check.erfuellt === true ? '✓' : check.erfuellt === false ? '×' : '?'}</div><div><div class="check-frage">${this.fachtext(check.frage)}</div><div class="check-grund">${this.fachtext(check.begruendung)}</div></div></div>`).join('')}</div>${gate.freigegeben && !chargeGesperrt ? '<div class="erfolgbox"><strong>Gate freigegeben.</strong> Alle Prüfungen sind erfüllt.</div>' : `<div class="fehlerbox"><strong>Gate nicht freigegeben.</strong><ul>${chargeGesperrt ? '<li>Die Regelengine hat die Charge rot gesperrt.</li>' : gate.blocker.map(blocker => `<li>${this.fachtext(blocker)}</li>`).join('')}</ul></div>`}<button class="btn btn-haupt" type="button" data-action="phase-weiter" ${gate.freigegeben && !chargeGesperrt && naechstePhase ? '' : 'disabled'}>${naechstePhase ? `Weiter zu ${html(PHASEN_LABEL[naechstePhase])}` : 'Keine weitere Phase'}</button><button class="btn" type="button" data-action="gate-reminder">Erinnerung zur erneuten Prüfung anlegen</button></section>`
  }

  private renderTermine(): string {
    const sortiert = [...this.stand.reminder].sort((a, b) => a.faellig.localeCompare(b.faellig))
    return `<section class="seite" aria-labelledby="termine-titel"><h1 class="seiten-titel" id="termine-titel">Termine & Erinnerungen</h1><div class="karte">${sortiert.length ? sortiert.map(reminder => this.renderReminder(reminder)).join('') : '<div class="leer">Keine Termine.</div>'}</div><button class="btn btn-haupt" type="button" data-action="ics-alle">${icon('download', 'icon-klein')} Alle Termine als .ics</button><form class="karte" id="reminder-form"><h2>Termin anlegen</h2><label for="reminder-titel">Titel</label><input id="reminder-titel" name="titel" required><label for="reminder-beschreibung">Beschreibung</label><textarea id="reminder-beschreibung" name="beschreibung" required></textarea><label for="reminder-faellig">Fällig</label><input id="reminder-faellig" name="faellig" type="datetime-local" value="${datetimeLocalWert()}" required><button class="btn" type="submit">Termin speichern</button></form><div class="info-box">Die App erzeugt Kalenderdateien mit Erinnerung. Sie baut kein eigenes Push- oder Benachrichtigungssystem.</div></section>`
  }

  private renderReminder(reminder: Reminder): string {
    const datum = new Date(reminder.faellig)
    const faellig = !reminder.erledigt && datum.getTime() <= Date.now()
    return `<div class="termin ${faellig ? 'faellig' : ''}"><div class="termin-datum"><strong>${datum.getDate().toString().padStart(2, '0')}</strong><small>${MONATE[datum.getMonth()]}</small></div><div class="termin-inhalt"><strong>${html(reminder.titel)}${reminder.erledigt ? ' · erledigt' : ''}</strong><small>${html(reminder.beschreibung)}</small><div class="termin-aktionen"><button class="text-knopf" type="button" data-action="ics-einzel" data-id="${html(reminder.id)}">In Kalender übernehmen</button><button class="text-knopf" type="button" data-action="reminder-toggle" data-id="${html(reminder.id)}">${reminder.erledigt ? 'Wieder öffnen' : 'Erledigt'}</button></div></div></div>`
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
    return `<section class="seite" aria-labelledby="mehr-titel"><h1 class="seiten-titel" id="mehr-titel">Mehr</h1><h2>Export & Sicherung</h2><div class="karte button-grid"><button class="btn" type="button" data-action="export-md">Jahrgang als Markdown</button><button class="btn" type="button" data-action="export-csv">Messreihen als CSV</button><button class="btn" type="button" data-action="export-json">Vollsicherung als JSON</button><button class="btn" type="button" data-action="export-zip">ZIP inklusive Fotos</button><label class="btn" for="import-json">JSON-Sicherung importieren</label><input class="sr-only" id="import-json" type="file" accept="application/json,.json" data-action="import-json"></div>
      <h2>Kellersensor</h2><form class="karte" id="sensor-form"><label for="sensor-adapter">Adapter</label><select id="sensor-adapter" name="adapter"><option value="shelly-cloud" ${sensor.adapter === 'shelly-cloud' ? 'selected' : ''}>Shelly Cloud</option><option value="govee" ${sensor.adapter === 'govee' ? 'selected' : ''}>Govee</option><option value="generisch-json" ${sensor.adapter === 'generisch-json' ? 'selected' : ''}>Generisches JSON</option></select><label for="sensor-url">HTTPS-Endpunkt</label><input id="sensor-url" name="url" type="url" value="${html(sensor.url)}" placeholder="https://…"><div class="hint">HTTP wird mit einer klaren Mixed-Content-Meldung blockiert.</div><div class="formular-grid zwei"><div><label for="sensor-token">Token</label><input id="sensor-token" name="token" type="password" value="${html(sensor.token ?? '')}" autocomplete="off"></div><div><label for="sensor-id">Geräte-ID</label><input id="sensor-id" name="geraeteId" value="${html(sensor.geraeteId ?? '')}"></div><div><label for="sensor-temp-pfad">JSON-Pfad Temperatur</label><input id="sensor-temp-pfad" name="pfadTemperatur" value="${html(sensor.pfadTemperatur ?? '')}" placeholder="data.temp"></div><div><label for="sensor-feuchte-pfad">JSON-Pfad Feuchte</label><input id="sensor-feuchte-pfad" name="pfadFeuchte" value="${html(sensor.pfadFeuchte ?? '')}" placeholder="data.humidity"></div></div><div id="sensor-fehler" role="alert"></div><div class="balken-actions"><button class="btn" type="submit" name="sensorAktion" value="speichern">Konfiguration speichern</button><button class="btn btn-haupt" type="submit" name="sensorAktion" value="testen">Verbindung testen</button></div></form>
      <h2>Manueller Klimawert</h2><form class="karte" id="klima-form"><div class="formular-grid zwei"><div><label for="klima-temp">Temperatur in °C</label><input id="klima-temp" name="temperatur" inputmode="decimal" required></div><div><label for="klima-feuchte">Feuchte in %</label><input id="klima-feuchte" name="feuchte" inputmode="decimal"></div></div><button class="btn btn-haupt" type="submit">Manuell speichern</button><div class="hint">Funktioniert immer und bleibt der Standardweg.</div></form>
      <h2>Behälter</h2><div class="karte">${this.stand.behaelter.map(behaelter => { const charge = this.stand.chargen.find(c => c.behaelterId === behaelter.id && !c.archiviert); return `<div class="zeile"><span>${html(behaelter.name)} · ${zahlFormat.format(behaelter.bruttoLiter)} L</span><b>${charge ? `belegt: ${html(charge.name)}` : behaelter.vorhandenAb ? `ab ${datumFormat.format(new Date(`${behaelter.vorhandenAb}T12:00:00`))}` : 'frei'}</b></div>` }).join('')}</div>
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

  private async behandleKlick(event: Event): Promise<void> {
    const ziel = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!ziel) return
    const action = ziel.dataset.action
    if (action === 'nav') {
      if (ziel.classList.contains('zurueck') && history.length > 1) return history.back()
      return this.navigiere(ziel.dataset.view as Ansicht)
    }
    if (action === 'charge') { this.ui.chargeId = ziel.dataset.id ?? ''; this.ui.ansicht = 'charge'; this.ui.chargeTab = 'befunde'; this.schreibeHistory(); return this.render() }
    if (action === 'charge-tab') { this.ui.chargeTab = ziel.dataset.tab as ChargeTab; return this.render() }
    if (action === 'erfassen') { this.ui.ansicht = 'erfassen'; this.schreibeHistory(); return this.render() }
    if (action === 'erfassen-modus') { this.ui.erfassenModus = ziel.dataset.mode as ErfassenModus; return this.render() }
    if (action === 'rechner-tab') { this.ui.rechnerTyp = ziel.dataset.rechner as RechnerTyp; return this.render() }
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
    if (action === 'ereignis-loeschen') return this.loescheEreignis(ziel.dataset.id ?? '')
    if (action === 'export-md') return this.exportiereMarkdown()
    if (action === 'export-csv') return this.exportiereCsv()
    if (action === 'export-json') return this.exportiereJson()
    if (action === 'export-zip') return this.exportiereZip()
  }

  private async behandleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const formular = event.target as HTMLFormElement
    if (formular.id === 'mess-form') return this.speichereMessungen(formular)
    if (formular.id === 'ereignis-form') return this.speichereEreignisse(formular)
    if (formular.id === 'gefaess-form') return this.speichereGefaess(formular)
    if (formular.id === 'reminder-form') return this.speichereReminder(formular)
    if (formular.id === 'wiki-form') return this.speichereWiki(formular)
    if (formular.id === 'sensor-form') return this.speichereSensor(formular, event.submitter as HTMLButtonElement | null)
    if (formular.id === 'klima-form') return this.speichereKlima(formular)
    if (formular.id === 'umverteilen-form') return this.speichereUmverteilung(formular)
  }

  private async behandleAenderung(event: Event): Promise<void> {
    const ziel = event.target as HTMLInputElement | HTMLSelectElement
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
    if (ziel.closest('#rechner-form')) this.aktualisiereRechner()
    if (ziel.closest('#ereignis-form')) this.aktualisiereZugabeVorschau()
    if (ziel.id === 'wiki-suche') {
      this.ui.wikiFilter = ziel.value
      const liste = this.root.querySelector<HTMLElement>('#wiki-liste')
      if (liste) liste.innerHTML = this.renderWikiListe()
    }
    if (ziel.closest('#umverteilen-form') && ziel.name === 'zielMenge') this.pruefeUmverteilung()
  }

  private navigiere(ansicht: Ansicht): void {
    this.ui.ansicht = ansicht
    this.schreibeHistory()
    window.scrollTo({ top: 0, behavior: 'auto' })
    this.render()
    this.root.querySelector<HTMLElement>('#hauptinhalt')?.focus({ preventScroll: true })
  }

  private schreibeHistory(ersetzen = false): void {
    const route = { weinbegleiter: true, ui: { ...this.ui, status: null } }
    const url = `${location.pathname}${location.search}#${this.ui.ansicht}`
    if (ersetzen) history.replaceState(route, '', url)
    else history.pushState(route, '', url)
  }

  private async persistieren(meldung?: string): Promise<void> {
    await speichereDatenstand(this.stand)
    if (meldung) this.zeigeStatus('erfolg', meldung)
  }

  private zeigeStatus(art: 'erfolg' | 'fehler', text: string): void {
    this.ui.status = { art, text }
    this.render()
  }

  private gewaehlteChargen(formular: HTMLFormElement, name = 'chargeIds'): Charge[] {
    const ids = new FormData(formular).getAll(name).map(String)
    return ids.map(chargeId => this.stand.chargen.find(charge => charge.id === chargeId)).filter((charge): charge is Charge => Boolean(charge))
  }

  private formularFehler(text: string): void {
    const feld = this.root.querySelector<HTMLElement>('#erfassen-fehler')
    if (feld) feld.innerHTML = `<div class="form-fehler">${html(text)}</div>`
    else this.zeigeStatus('fehler', text)
  }

  private async speichereMessungen(formular: HTMLFormElement): Promise<void> {
    const chargen = this.gewaehlteChargen(formular)
    if (!chargen.length) return this.formularFehler('Wähle mindestens eine Charge aus.')
    const daten = new FormData(formular)
    const typ = String(daten.get('typ')) as MessTyp
    const definition = MESS_DEFINITIONEN.find(eintrag => eintrag.typ === typ)
    if (!definition) return this.formularFehler('Unbekannte Messgröße.')
    const wert = definition.art === 'zahl' ? parseDeZahl(daten.get('wert')) : null
    const text = definition.art === 'auswahl' ? String(daten.get('text') ?? '') : undefined
    if (definition.art === 'zahl' && wert === null) return this.formularFehler('Trage einen gültigen Zahlenwert ein.')
    if ((typ === 'volumen' || typ === 'kopfraum') && wert !== null && wert < 0) return this.formularFehler('Volumenwerte müssen mindestens 0 L betragen.')
    if (definition.art === 'auswahl' && !text) return this.formularFehler('Wähle einen Befund aus.')
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const methode = DICHTE_TYPEN.includes(typ) ? String(daten.get('methode') ?? 'spindel') as MessMethode : undefined
    const notiz = String(daten.get('notiz') ?? '').trim() || undefined
    const neu: Messung[] = chargen.map(charge => ({ id: id('messung'), chargeId: charge.id, zeit, typ, wert, text, methode, notiz }))
    this.stand.messungen.push(...neu)
    if (wert !== null && (typ === 'volumen' || typ === 'kopfraum')) {
      chargen.forEach(charge => {
        fuegeVolumenPunktHinzu(this.stand, charge.id, {
          zeit,
          fuellLiter: typ === 'volumen' ? wert : charge.fuellLiter,
          kopfraumLiter: typ === 'kopfraum' ? wert : charge.kopfraumLiter,
          behaelterId: charge.behaelterId,
          anlass: `${definition.label} gemessen`,
        })
      })
    }
    await this.persistieren(`${neu.length} Messdatensätze gespeichert.`)
    this.ui.ansicht = 'charge'
    this.ui.chargeTab = 'messungen'
    this.schreibeHistory(true)
    this.render()
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
    const container = this.root.querySelector<HTMLElement>('#refraktometer-hinweis')
    if (!formular || !container) return
    const methode = new FormData(formular).get('methode')
    if (methode !== 'refraktometer') { container.innerHTML = ''; return }
    const chargen = this.gewaehlteChargen(formular)
    let befund: ReturnType<typeof befundeFuerCharge>[number] | undefined
    for (const charge of chargen) {
      const probe: Messung = { id: 'vorschau-refra', chargeId: charge.id, zeit: new Date().toISOString(), typ: this.ui.messTyp, wert: 0, methode: 'refraktometer' }
      const vorschau = { ...this.stand, messungen: [...this.stand.messungen, probe] }
      befund = befundeFuerCharge(vorschau, charge).find(eintrag => eintrag.regelId === 'R-REFRAKTOMETER')
      if (befund) break
    }
    container.innerHTML = befund ? `<div class="warnbox"><strong>${html(befund.regelId)} · ${this.fachtext(befund.titel)}</strong><br>${this.fachtext(befund.text)} ${befund.massnahme ? this.fachtext(befund.massnahme) : ''}</div>` : ''
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

  private async loescheEreignis(ereignisId: string): Promise<void> {
    const ereignis = this.stand.ereignisse.find(eintrag => eintrag.id === ereignisId)
    if (!ereignis) return this.zeigeStatus('fehler', 'Das Ereignis wurde nicht gefunden.')
    if (!window.confirm(`${EREIGNIS_LABEL[ereignis.art]} vom ${datumZeitFormat.format(new Date(ereignis.zeit))} löschen? Eine Vorratsbuchung wird zurückgebucht.`)) return
    try {
      loescheEreignisMitVorrat(this.stand, ereignisId)
      await this.persistieren('Ereignis gelöscht. Eine verknüpfte Vorratsmenge wurde zurückgebucht.')
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
    await this.persistieren(`Phase auf ${PHASEN_LABEL[naechste]} gesetzt.`)
  }

  private async legeGateReminderAn(): Promise<void> {
    const charge = this.aktuelleCharge()
    const gate = charge ? gateFuerPhase(this.stand, charge) : null
    if (!charge || !gate) return
    const faellig = new Date(Date.now() + 24 * 60 * 60 * 1000)
    this.stand.reminder.push({ id: id('reminder'), chargeId: charge.id, faellig: faellig.toISOString(), titel: `${gate.titel} erneut prüfen`, beschreibung: gate.blocker.join(' · ') || `Gate für ${charge.name} prüfen.`, erledigt: false, quelle: 'regel', regelId: gate.gate })
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
    const reminder: Reminder = { id: id('reminder'), titel: String(daten.get('titel')), beschreibung: String(daten.get('beschreibung')), faellig: isoAusDatetimeLocal(daten.get('faellig')), erledigt: false, quelle: 'manuell' }
    this.stand.reminder.push(reminder)
    await this.persistieren('Termin gespeichert.')
  }

  private async toggleReminder(reminderId: string): Promise<void> {
    const reminder = this.stand.reminder.find(eintrag => eintrag.id === reminderId)
    if (!reminder) return
    reminder.erledigt = !reminder.erledigt
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
    if (vorhanden) Object.assign(vorhanden, { titel, inhalt, tags, aktualisiert: new Date().toISOString() })
    else {
      const neu: WikiSeite = { id: id('wiki'), slug: dateiname(titel), titel, inhalt, tags, aktualisiert: new Date().toISOString() }
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
    this.stand.klima.push({ zeit: new Date().toISOString(), temperatur, feuchte: feuchte ?? undefined, quelle: 'manuell' })
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
      id: id('charge'), jahrgang: this.stand.jahrgang, name, typ: quellen[0]?.typ ?? 'maische', phase: 'ANSTELLEN', phaseSeit: zeit, startdatum: zeit,
      elternChargeId: quellen[0]?.id, mengeKg: mengen[index] ?? 0, behaelterId: behaelter[index] || undefined,
      volumenHistorie: [], gesperrt: false, isoliert: false,
      notiz: `Umverteilt aus ${quellen.map(charge => charge.name).join(', ')}. Begründung: ${begruendung}`,
    }))
    quellen.forEach(charge => { charge.archiviert = true })
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
