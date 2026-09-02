import {
  AMPEL_LABEL,
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
import { alkoholPotenzial, naehrsalzPlan, NAEHRSALZ_MAX_G_PRO_100L, NAEHRSALZ_PORTIONEN, schwefelDosierung, zuckerFuerOechsle } from '../domain/oenologie'
import { ampelFuerCharge, befundeFuerCharge, gateFuerPhase, vermischungErlaubt } from '../domain/regeln'
import { kalenderAlsIcs, reminderAlsIcs } from '../ics'
import { alsKlimapunkt, ladeSensorwert, pruefeSensorKonfiguration } from '../sensor'
import { ersetzeFotos, speichereDatenstand, speichereFoto } from '../speicher/indexeddb'
import { istAppDatenstand, migriereDatenstand, type AppDatenstand } from '../speicher/modell'
import { alsCsv, alsMarkdown, alsSicherung, baueZip, fotoAusSicherung, istSicherung, ladeDatei } from './export'
import { dateiname, datetimeLocalWert, datumFormat, datumZeitFormat, formatiereZahl, html, id, isoAusDatetimeLocal, kurzDatumFormat, parseDeZahl, zahlFormat } from './format'
import { icon } from './icons'

type Ansicht = 'heute' | 'charge' | 'erfassen' | 'rechner' | 'gate' | 'termine' | 'wiki' | 'wiki-seite' | 'wiki-editor' | 'mehr' | 'umverteilen'
type ChargeTab = 'befunde' | 'messungen' | 'ereignisse' | 'gefaess' | 'fotos'
type RechnerTyp = 'schwefeln' | 'aufzuckern' | 'naehrsalz'
type ErfassenModus = 'messung' | 'ereignis'

const DICHTE_TYPEN: MessTyp[] = ['oechsle', 'sg', 'brix']
const ZUGABE_ARTEN: EreignisArt[] = ['schwefeln', 'aufzuckern', 'naehrsalz', 'hefe', 'suessen', 'stabilisieren']
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

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
  private statusTimer: number | null = null
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
      this.ui = { ...this.ui, ...route.ui, status: null }
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
    return `<div class="statusmeldung ${this.ui.status.art === 'erfolg' ? 'erfolgbox' : 'fehlerbox'}" role="${this.ui.status.art === 'erfolg' ? 'status' : 'alert'}">${html(this.ui.status.text)}</div>`
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
    return `<section class="seite" aria-labelledby="heute-titel"><h1 class="seiten-titel" id="heute-titel">Heute</h1>
      <h2>Jetzt dran</h2>
      ${naechster ? `<div class="karte karte-akzent"><div class="aktion">${icon('kalender')}<div><strong class="aktion-titel">${html(naechster.titel)}</strong><div class="aktion-text">${html(naechster.beschreibung)}<br>Fällig: ${datumZeitFormat.format(new Date(naechster.faellig))}</div></div></div><button class="btn btn-haupt" type="button" data-action="nav" data-view="termine">Termine öffnen</button></div>` : '<div class="karte leer">Keine offenen Termine.</div>'}
      <div class="balken-actions"><button class="btn btn-haupt" type="button" data-action="erfassen">${icon('messung', 'icon-klein')} Sammelaktion</button><button class="btn" type="button" data-action="nav" data-view="umverteilen">Umverteilen</button></div>
      <h2>Chargen</h2>${this.aktiveChargen().map(charge => this.renderChargenKarte(charge)).join('') || '<div class="karte leer">Keine aktive Charge.</div>'}
      <h2>Kellerklima</h2><div class="klima-grid"><div class="klima-wert"><small>Letzte Temperatur</small><strong>${klima ? `${formatiereZahl(klima.temperatur)} °C` : '–'}</strong></div><div class="klima-wert"><small>Feuchte</small><strong>${klima?.feuchte === undefined ? '–' : `${formatiereZahl(klima.feuchte, 0)} %`}</strong></div></div><div class="hint">${klima ? `${klima.quelle === 'sensor' ? 'Sensor' : 'Manuell'} · ${datumZeitFormat.format(new Date(klima.zeit))}` : 'Noch kein Klimawert. Manuelle Eingabe ist unter Mehr jederzeit verfügbar.'}</div>
      <h2>Vorrat</h2><div class="karte">${this.stand.vorrat.map(posten => `<div class="zeile"><span>${html(posten.name)}</span><b>${zahlFormat.format(posten.mengeWert)} ${html(posten.mengeEinheit)}</b></div>${posten.notiz ? `<div class="hint">${html(posten.notiz)}</div>` : ''}`).join('')}</div>
    </section>`
  }

  private renderChargenKarte(charge: Charge): string {
    const ampel = ampelFuerCharge(this.stand, charge)
    const letzteTemp = this.letzteMessung(charge.id, 'temperatur')
    const letzteDichte = this.letzteMessung(charge.id, 'oechsle') ?? this.letzteMessung(charge.id, 'sg')
    const kg = this.stand.appMeta.chargenMengenKg[charge.id]
    const eltern = this.stand.appMeta.elternChargeIds[charge.id] ?? (charge.elternChargeId ? [charge.elternChargeId] : [])
    return `<button class="karte klick" type="button" data-action="charge" data-id="${html(charge.id)}"><div class="charge-kopf"><div><div class="charge-name">${html(charge.name)}</div><div class="charge-meta">${kg === undefined ? 'Menge offen' : `${formatiereZahl(kg)} kg`} · ${html(charge.typ)} · seit ${kurzDatumFormat.format(new Date(charge.startdatum))}</div></div>${this.renderAmpel(ampel)}</div>${this.renderPhasenbalken(charge.phase)}<div class="zeile"><span>Phase</span><b>${html(PHASEN_LABEL[charge.phase])}</b></div><div class="zeile"><span>Temperatur</span><b>${letzteTemp?.wert == null ? 'nicht gemessen' : `${formatiereZahl(letzteTemp.wert)} °C`}</b></div><div class="zeile"><span>Dichte</span><b>${letzteDichte?.wert == null ? 'nicht gemessen' : `${zahlFormat.format(letzteDichte.wert)} ${letzteDichte.typ === 'sg' ? 'SG' : '°Oe'}`}</b></div>${eltern.length ? `<div class="abstammung">Abstammung: ${eltern.map(elternId => html(this.stand.chargen.find(c => c.id === elternId)?.name ?? elternId)).join(', ')}</div>` : ''}</button>`
  }

  private renderAmpel(ampel: Ampel): string {
    return `<span class="ampel ampel-${ampel.toLowerCase()}"><i class="ampel-punkt"></i>${html(AMPEL_LABEL[ampel])}</span>`
  }

  private renderPhasenbalken(phase: Phase): string {
    const index = PHASEN_REIHE.indexOf(phase)
    return `<div class="phasenbalken" aria-label="Phase ${index + 1} von ${PHASEN_REIHE.length}">${PHASEN_REIHE.map((_, nr) => `<i class="${nr < index ? 'erledigt' : nr === index ? 'aktuell' : ''}"></i>`).join('')}</div>`
  }

  private renderCharge(): string {
    const charge = this.aktuelleCharge()
    if (!charge) return this.renderFehlendeCharge()
    const ampel = ampelFuerCharge(this.stand, charge)
    const tabs: Array<[ChargeTab, string]> = [['befunde', 'Befunde'], ['messungen', 'Messungen'], ['ereignisse', 'Ereignisse'], ['gefaess', 'Gefäß'], ['fotos', 'Fotos']]
    const gate = gateFuerPhase(this.stand, charge)
    const phaseIndex = PHASEN_REIHE.indexOf(charge.phase)
    const naechstePhase = PHASEN_REIHE[phaseIndex + 1]
    const elternIds = this.stand.appMeta.elternChargeIds[charge.id] ?? (charge.elternChargeId ? [charge.elternChargeId] : [])
    return `<section class="seite" aria-labelledby="charge-titel"><button class="zurueck" type="button" data-action="nav" data-view="heute">${icon('pfeil')}Chargen</button><div class="charge-kopf"><div><h1 class="seiten-titel" id="charge-titel">${html(charge.name)}</h1><div class="charge-meta">${html(charge.typ)} · angelegt ${datumFormat.format(new Date(charge.startdatum))}</div></div>${this.renderAmpel(ampel)}</div>${this.renderPhasenbalken(charge.phase)}
      ${charge.archiviert ? '<div class="info-box">Archivierte Ausgangscharge. Messungen und Ereignisse bleiben unverändert erhalten.</div>' : ''}
      ${elternIds.length ? `<div class="karte"><h2>Herkunft</h2>${elternIds.map(elternId => { const eltern = this.stand.chargen.find(eintrag => eintrag.id === elternId); return `<button class="wiki-eintrag" type="button" data-action="charge" data-id="${html(elternId)}"><strong>${html(eltern?.name ?? elternId)}</strong><small>${eltern ? `${this.stand.appMeta.chargenMengenKg[eltern.id] === undefined ? 'Menge offen' : `${formatiereZahl(this.stand.appMeta.chargenMengenKg[eltern.id]!)} kg`} · ${html(PHASEN_LABEL[eltern.phase])}` : 'Ausgangscharge'}</small></button>` }).join('')}</div>` : ''}
      <div class="tabs" role="tablist" aria-label="Chargendetails">${tabs.map(([id, label]) => `<button class="tab ${this.ui.chargeTab === id ? 'aktiv' : ''}" type="button" role="tab" aria-selected="${this.ui.chargeTab === id}" data-action="charge-tab" data-tab="${id}">${label}</button>`).join('')}</div>
      ${this.renderChargeTab(charge)}
      ${charge.archiviert ? '' : `<div class="button-grid"><button class="btn btn-haupt" type="button" data-action="erfassen">${icon('messung', 'icon-klein')} Erfassen</button><button class="btn" type="button" data-action="nav" data-view="rechner">${icon('rechner', 'icon-klein')} Zugabe berechnen</button><button class="btn" type="button" data-action="nav" data-view="gate">${icon('gate', 'icon-klein')} Gate prüfen</button><button class="btn" type="button" data-action="nav" data-view="umverteilen">Umverteilen</button></div>${naechstePhase ? `<div class="karte"><label for="phase-auswahl">Auf frühere Phase zurücksetzen</label><select id="phase-auswahl" data-action="phase">${PHASEN_REIHE.slice(0, phaseIndex + 1).map(eintrag => `<option value="${eintrag}" ${eintrag === charge.phase ? 'selected' : ''}>${html(PHASEN_LABEL[eintrag])}</option>`).join('')}</select><div class="hint">Vorwärts geht es nur Schritt für Schritt. Dadurch kann kein Gate übersprungen werden.</div>${gate ? `<button class="btn btn-haupt" type="button" data-action="phase-weiter" ${gate.freigegeben ? '' : 'disabled'}>Weiter zu ${html(PHASEN_LABEL[naechstePhase])}</button><div class="hint">${gate.freigegeben ? 'Gate freigegeben.' : 'Gate blockiert. Unbekannt und nicht erfüllt verhindern den Phasenwechsel.'}</div>` : `<button class="btn" type="button" data-action="phase-weiter">Weiter zu ${html(PHASEN_LABEL[naechstePhase])}</button>`}</div>` : ''}`}
    </section>`
  }

  private renderChargeTab(charge: Charge): string {
    if (this.ui.chargeTab === 'befunde') {
      const befunde = befundeFuerCharge(this.stand, charge)
      return befunde.length ? befunde.map(befund => `<div class="befund befund-${befund.ampel.toLowerCase()}"><span class="befund-id">${html(befund.regelId)}</span><div class="befund-titel">${this.fachtext(befund.titel)}</div><div class="befund-text">${this.fachtext(befund.text)}</div>${befund.massnahme ? `<div class="befund-massnahme"><strong>Zu tun:</strong> ${this.fachtext(befund.massnahme)}</div>` : ''}</div>`).join('') : '<div class="erfolgbox">Keine Befunde. Die Regelengine meldet für diese Charge aktuell GREEN.</div>'
    }
    if (this.ui.chargeTab === 'messungen') {
      const messungen = this.stand.messungen.filter(m => m.chargeId === charge.id).sort((a, b) => b.zeit.localeCompare(a.zeit))
      return `<div class="karte">${messungen.length ? messungen.map(m => `<div class="zeile"><span>${datumZeitFormat.format(new Date(m.zeit))} · ${html(this.messLabel(m.typ))}</span><b>${m.wert === null ? html(m.text ?? '–') : `${zahlFormat.format(m.wert)} ${html(this.messEinheit(m.typ))}`}${m.methode ? ` · ${html(m.methode)}` : ''}</b></div>`).join('') : '<div class="leer">Noch keine Messungen.</div>'}</div>`
    }
    if (this.ui.chargeTab === 'ereignisse') {
      const ereignisse = this.stand.ereignisse.filter(e => e.chargeId === charge.id).sort((a, b) => b.zeit.localeCompare(a.zeit))
      return `<div class="karte">${ereignisse.length ? ereignisse.map(e => `<div class="befund befund-green"><div class="befund-titel">${html(EREIGNIS_LABEL[e.art])} · ${datumZeitFormat.format(new Date(e.zeit))}</div><div class="befund-text">${e.stoff ? `${html(e.stoff)} · ` : ''}${e.mengeWert === undefined ? '' : `${zahlFormat.format(e.mengeWert)} ${html(e.mengeEinheit)} · `}${html(e.begruendung)}</div></div>`).join('') : '<div class="leer">Noch keine Ereignisse.</div>'}</div>`
    }
    if (this.ui.chargeTab === 'gefaess') {
      if (charge.archiviert) {
        const behaelter = this.stand.behaelter.find(eintrag => eintrag.id === charge.behaelterId)
        return `<div class="karte"><div class="zeile"><span>Behälter</span><b>${html(behaelter?.name ?? 'nicht zugeordnet')}</b></div><div class="zeile"><span>Füllvolumen</span><b>${charge.fuellLiter === undefined ? 'nicht erfasst' : `${zahlFormat.format(charge.fuellLiter)} L`}</b></div><div class="zeile"><span>Kopfraum</span><b>${charge.kopfraumLiter === undefined ? 'nicht erfasst' : `${zahlFormat.format(charge.kopfraumLiter)} L`}</b></div></div>`
      }
      return `<form class="karte" id="gefaess-form"><label for="charge-gefaess">Behälter</label><select id="charge-gefaess" name="behaelterId"><option value="">Nicht zugeordnet</option>${this.stand.behaelter.map(b => `<option value="${html(b.id)}" ${b.id === charge.behaelterId ? 'selected' : ''}>${html(b.name)} · ${zahlFormat.format(b.bruttoLiter)} L</option>`).join('')}</select><div class="formular-grid zwei"><div><label for="fuell-liter">Füllvolumen in L</label><input id="fuell-liter" name="fuellLiter" inputmode="decimal" value="${charge.fuellLiter === undefined ? '' : html(formatiereZahl(charge.fuellLiter))}"></div><div><label for="kopfraum-liter">Kopfraum in L</label><input id="kopfraum-liter" name="kopfraumLiter" inputmode="decimal" value="${charge.kopfraumLiter === undefined ? '' : html(formatiereZahl(charge.kopfraumLiter))}"></div></div><button class="btn" type="submit">Gefäßdaten speichern</button></form>`
    }
    const ereignisFotoIds = new Set(this.stand.ereignisse.filter(e => e.chargeId === charge.id).flatMap(e => e.fotoIds ?? []))
    const chargeFotos = this.fotos.filter(foto => foto.chargeId === charge.id || ereignisFotoIds.has(foto.id))
    return `<div class="karte">${chargeFotos.length ? `<div class="foto-grid">${chargeFotos.map(foto => { const url = URL.createObjectURL(foto.blob); this.fotoUrls.push(url); return `<img src="${url}" alt="Dokumentationsfoto vom ${datumZeitFormat.format(new Date(foto.zeit))}">` }).join('')}</div>` : '<div class="leer">Noch keine Fotos. Fotos können beim Erfassen eines Ereignisses angehängt werden.</div>'}</div>`
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
    if (!ZUGABE_ARTEN.includes(art)) return '<div class="info-box">Für dieses Ereignis ist keine Zugabemenge erforderlich.</div>'
    const defaults: Partial<Record<EreignisArt, [string, string]>> = {
      schwefeln: ['Kaliumpyrosulfit', 'g'], aufzuckern: ['Haushaltszucker', 'g'], naehrsalz: ['Hefenährsalz', 'g'], hefe: ['Reinzuchthefe Steinberg', 'g'], suessen: ['Zucker', 'g'], stabilisieren: ['Stabilisierungsmittel', 'g'],
    }
    const [stoff, einheit] = defaults[art] ?? ['', 'g']
    return `<label for="ereignis-stoff">Stoff *</label><input id="ereignis-stoff" name="stoff" value="${html(stoff)}" required><label for="ereignis-produkt">Produkt</label><input id="ereignis-produkt" name="produkt"><div class="formular-grid zwei"><div><label for="ereignis-dosis">Dosierung je Liter *</label><input id="ereignis-dosis" name="dosisProLiter" inputmode="decimal" required></div><div><label for="ereignis-einheit">Einheit *</label><select id="ereignis-einheit" name="mengeEinheit"><option value="${einheit}">${einheit}</option><option value="ml">ml</option></select></div></div><div class="hint">Gespeicherte Menge je Charge = Dosierung je Liter × Füllvolumen dieser Charge.</div><div id="zugabe-vorschau"></div>`
  }

  private renderRechner(): string {
    const charge = this.aktuelleCharge()
    if (!charge) return this.renderFehlendeCharge()
    const letztePh = this.letzteMessung(charge.id, 'ph')?.wert
    const tabs: Array<[RechnerTyp, string]> = [['schwefeln', 'Schwefeln'], ['aufzuckern', 'Aufzuckern'], ['naehrsalz', 'Nährsalz']]
    return `<section class="seite" aria-labelledby="rechner-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><h1 class="seiten-titel" id="rechner-titel">Zugabe berechnen</h1><div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${this.ui.rechnerTyp === id ? 'aktiv' : ''}" type="button" data-action="rechner-tab" data-rechner="${id}">${label}</button>`).join('')}</div><form class="karte" id="rechner-form"><label for="rechner-volumen">Volumen</label><input id="rechner-volumen" name="volumen" inputmode="decimal" value="${charge.fuellLiter === undefined ? '' : html(formatiereZahl(charge.fuellLiter))}" required><div class="hint">Liter · gemessenes Füllvolumen der Charge</div>${this.ui.rechnerTyp === 'schwefeln' ? `<label for="rechner-ph">pH-Wert</label><input id="rechner-ph" name="ph" inputmode="decimal" value="${letztePh == null ? '' : html(formatiereZahl(letztePh, 2))}" placeholder="nicht gemessen"><label for="rechner-frei">Freier SO₂ (Istwert)</label><input id="rechner-frei" name="frei" inputmode="decimal" placeholder="nicht gemessen"><div class="hint">Leer lassen, wenn nicht titriert. Dann liefert die App eine geschätzte Obergrenze.</div>` : ''}${this.ui.rechnerTyp === 'aufzuckern' ? `<label for="rechner-ist">Mostgewicht Ist</label><input id="rechner-ist" name="istOe" inputmode="decimal" required><div class="hint">°Oe · gemessen</div><label for="rechner-ziel">Mostgewicht Ziel</label><input id="rechner-ziel" name="zielOe" inputmode="decimal" required><div id="alkohol-potenzial"></div>` : ''}<div id="rechner-ausgabe"></div></form></section>`
  }

  private renderGate(): string {
    const charge = this.aktuelleCharge()
    if (!charge) return this.renderFehlendeCharge()
    const gate = gateFuerPhase(this.stand, charge)
    if (!gate) return `<section class="seite"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><h1 class="seiten-titel">Gate prüfen</h1><div class="info-box">Für die aktuelle Phase ${html(PHASEN_LABEL[charge.phase])} ist kein Gate definiert. Gates werden ausschließlich in den Gate-Phasen durch <code>gateFuerPhase()</code> erzeugt.</div><button class="btn" type="button" data-action="nav" data-view="charge">Zur Charge</button></section>`
    const phaseIndex = PHASEN_REIHE.indexOf(charge.phase)
    const naechstePhase = PHASEN_REIHE[phaseIndex + 1]
    return `<section class="seite" aria-labelledby="gate-titel"><button class="zurueck" type="button" data-action="nav" data-view="charge">${icon('pfeil')}${html(charge.name)}</button><div class="gate-kopf"><h1 class="seiten-titel" id="gate-titel">${html(gate.titel)}</h1>${this.renderAmpel(gate.freigegeben ? 'GREEN' : 'RED')}</div><div class="hint">Alle Prüfungen müssen erfüllt sein. Unbekannt blockiert wie nicht erfüllt, wird aber grau dargestellt.</div><div class="karte">${gate.checks.map(check => `<div class="check"><div class="check-status ${check.erfuellt === true ? 'check-ja' : check.erfuellt === false ? 'check-nein' : 'check-unbekannt'}" aria-label="${check.erfuellt === true ? 'Erfüllt' : check.erfuellt === false ? 'Nicht erfüllt' : 'Unbekannt'}">${check.erfuellt === true ? '✓' : check.erfuellt === false ? '×' : '?'}</div><div><div class="check-frage">${this.fachtext(check.frage)}</div><div class="check-grund">${this.fachtext(check.begruendung)}</div></div></div>`).join('')}</div>${gate.freigegeben ? '<div class="erfolgbox"><strong>Gate freigegeben.</strong> Alle Prüfungen sind erfüllt.</div>' : `<div class="fehlerbox"><strong>Gate nicht freigegeben.</strong><ul>${gate.blocker.map(blocker => `<li>${this.fachtext(blocker)}</li>`).join('')}</ul></div>`}<button class="btn btn-haupt" type="button" data-action="phase-weiter" ${gate.freigegeben && naechstePhase ? '' : 'disabled'}>${naechstePhase ? `Weiter zu ${html(PHASEN_LABEL[naechstePhase])}` : 'Keine weitere Phase'}</button><button class="btn" type="button" data-action="gate-reminder">Erinnerung zur erneuten Prüfung anlegen</button></section>`
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
    if (this.statusTimer !== null) window.clearTimeout(this.statusTimer)
    this.render()
    this.statusTimer = window.setTimeout(() => { this.ui.status = null; this.render() }, 4_000)
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
    if (definition.art === 'auswahl' && !text) return this.formularFehler('Wähle einen Befund aus.')
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const methode = DICHTE_TYPEN.includes(typ) ? String(daten.get('methode') ?? 'spindel') as MessMethode : undefined
    const notiz = String(daten.get('notiz') ?? '').trim() || undefined
    const neu: Messung[] = chargen.map(charge => ({ id: id('messung'), chargeId: charge.id, zeit, typ, wert, text, methode, notiz }))
    this.stand.messungen.push(...neu)
    if (wert !== null && (typ === 'volumen' || typ === 'kopfraum')) {
      chargen.forEach(charge => {
        if (typ === 'volumen') charge.fuellLiter = wert
        else charge.kopfraumLiter = wert
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
    const ohneVolumen = chargen.filter(charge => charge.fuellLiter === undefined)
    if (ohneVolumen.length) {
      container.innerHTML = `<div class="warnbox"><strong>Berechnung nicht möglich:</strong> Füllvolumen fehlt bei ${html(ohneVolumen.map(charge => charge.name).join(', '))}.</div>`
      return
    }
    const mengen = chargen.map(charge => ({ charge, menge: dosis * (charge.fuellLiter ?? 0) }))
    const summe = mengen.reduce((gesamt, eintrag) => gesamt + eintrag.menge, 0)
    const einheit = String(daten.get('mengeEinheit') ?? 'g')
    let inhalt = `<div class="info-box"><strong>Chargenbezogene Mengen:</strong>${mengen.map(eintrag => `<br>${html(eintrag.charge.name)}: ${zahlFormat.format(eintrag.menge)} ${html(einheit)}`).join('')}</div>`
    if (art === 'schwefeln' && einheit === 'g') {
      const vorrat = this.stand.vorrat.find(posten => posten.id === 'vorrat-kps')?.mengeWert ?? 0
      inhalt += summe > vorrat
        ? `<div class="fehlerbox"><strong>Vorrat reicht nicht.</strong> ${zahlFormat.format(summe)} g Zugabe übersteigen ${zahlFormat.format(vorrat)} g Restvorrat um ${zahlFormat.format(summe - vorrat)} g.</div>`
        : `<div class="erfolgbox">Restvorrat nach der Zugabe: ${zahlFormat.format(vorrat - summe)} g.</div>`
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
    const dosis = istZugabe ? parseDeZahl(daten.get('dosisProLiter')) : null
    if (istZugabe && (dosis === null || dosis < 0)) return this.formularFehler('Trage eine gültige Dosierung je Liter ein.')
    const ohneVolumen = istZugabe ? chargen.filter(charge => charge.fuellLiter === undefined) : []
    if (ohneVolumen.length) return this.formularFehler(`Füllvolumen fehlt bei: ${ohneVolumen.map(charge => charge.name).join(', ')}. Zugabemengen werden nicht geschätzt.`)
    const fotoIds: string[] = []
    const dateien = (formular.elements.namedItem('fotos') as HTMLInputElement | null)?.files
    for (const datei of Array.from(dateien ?? [])) {
      const foto: Foto = { id: id('foto'), zeit: new Date().toISOString(), blob: datei }
      await speichereFoto(foto)
      this.fotos.push(foto)
      fotoIds.push(foto.id)
    }
    const zeit = isoAusDatetimeLocal(daten.get('zeit'))
    const stoff = String(daten.get('stoff') ?? '').trim() || undefined
    const produkt = String(daten.get('produkt') ?? '').trim() || undefined
    const mengeEinheit = String(daten.get('mengeEinheit') ?? '').trim() || undefined
    const neu: Ereignis[] = chargen.map(charge => ({
      id: id('ereignis'), chargeId: charge.id, zeit, art, stoff, produkt,
      mengeWert: istZugabe && dosis !== null ? Math.round(dosis * (charge.fuellLiter ?? 0) * 1000) / 1000 : undefined,
      mengeEinheit: istZugabe ? mengeEinheit : undefined,
      begruendung,
      fotoIds: fotoIds.length ? fotoIds : undefined,
    }))
    this.stand.ereignisse.push(...neu)
    if (art === 'schwefeln' && mengeEinheit === 'g') {
      const kps = this.stand.vorrat.find(posten => posten.id === 'vorrat-kps')
      if (kps) kps.mengeWert = Math.round((kps.mengeWert - neu.reduce((summe, ereignis) => summe + (ereignis.mengeWert ?? 0), 0)) * 1000) / 1000
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
    charge.behaelterId = String(daten.get('behaelterId') ?? '') || undefined
    charge.fuellLiter = fuellLiter ?? undefined
    charge.kopfraumLiter = kopfraumLiter ?? undefined
    await this.persistieren('Gefäßdaten gespeichert.')
  }

  private async setzePhase(phase: Phase): Promise<void> {
    const charge = this.aktuelleCharge()
    if (!charge || !PHASEN_REIHE.includes(phase)) return
    const aktuell = PHASEN_REIHE.indexOf(charge.phase)
    const ziel = PHASEN_REIHE.indexOf(phase)
    if (ziel > aktuell) return this.zeigeStatus('fehler', 'Vorwärtswechsel sind nur über den Weiter-Knopf möglich.')
    charge.phase = phase
    await this.persistieren('Phase gespeichert.')
  }

  private async phaseWeiter(): Promise<void> {
    const charge = this.aktuelleCharge()
    if (!charge) return
    const gate = gateFuerPhase(this.stand, charge)
    if (gate && !gate.freigegeben) return this.zeigeStatus('fehler', 'Gate nicht freigegeben.')
    const naechste = PHASEN_REIHE[PHASEN_REIHE.indexOf(charge.phase) + 1]
    if (!naechste) return
    charge.phase = naechste
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
    const gesamt = quellen.reduce((summe, charge) => summe + (this.stand.appMeta.chargenMengenKg[charge.id] ?? 0), 0)
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
    const quellSumme = quellen.reduce((summe, charge) => summe + (this.stand.appMeta.chargenMengenKg[charge.id] ?? 0), 0)
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
      id: id('charge'), jahrgang: this.stand.jahrgang, name, typ: quellen[0]?.typ ?? 'maische', phase: 'ANSTELLEN', startdatum: zeit,
      elternChargeId: quellen[0]?.id, behaelterId: behaelter[index] || undefined, gesperrt: false, isoliert: false,
      notiz: `Umverteilt aus ${quellen.map(charge => charge.name).join(', ')}. Begründung: ${begruendung}`,
    }))
    quellen.forEach(charge => { charge.archiviert = true })
    neueChargen.forEach((charge, index) => {
      this.stand.appMeta.chargenMengenKg[charge.id] = mengen[index] ?? 0
      this.stand.appMeta.elternChargeIds[charge.id] = quellen.map(quelle => quelle.id)
    })
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
      this.zeigeStatus('erfolg', 'Vollsicherung importiert.')
    } catch (error) {
      this.zeigeStatus('fehler', error instanceof Error ? error.message : 'Import fehlgeschlagen.')
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
