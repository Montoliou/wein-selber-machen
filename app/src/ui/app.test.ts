import { beforeEach, describe, expect, it, vi } from 'vitest'
import { erzeugeStartdaten } from '../startdaten'
import { WeinbegleiterApp } from './app'
import { layoutKlasse } from './layout'

vi.mock('../speicher/indexeddb', () => ({
  speichereDatenstand: vi.fn().mockResolvedValue(undefined),
  speichereFoto: vi.fn().mockResolvedValue(undefined),
  ersetzeFotos: vi.fn().mockResolvedValue(undefined),
}))

function klicke(element: Element | null): void {
  if (!(element instanceof HTMLElement)) throw new Error('Das erwartete Bedienelement fehlt.')
  element.click()
}

function aendere(element: HTMLInputElement | HTMLSelectElement, wert?: string): void {
  if (wert !== undefined) element.value = wert
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function starteRunde(root: HTMLElement): void {
  klicke(root.querySelector('.bottom-nav [data-action="runde-start"]'))
}

async function warteAufRendern(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 5))
}

describe('Layoutklassen', () => {
  it('ordnet iPad und Schreibtisch an den freigegebenen Grenzen ein', () => {
    expect(layoutKlasse(599)).toBe('telefon')
    expect(layoutKlasse(1024)).toBe('tablet')
    expect(layoutKlasse(1200)).toBe('schreibtisch')
  })

  it('schreibt die Layoutklasse an die Wurzel und erneuert sie bei Größenänderung', () => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    const root = document.querySelector<HTMLElement>('#app')!
    new WeinbegleiterApp(root, erzeugeStartdaten(), []).start()
    expect(root.dataset.layout).toBe('tablet')

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    window.dispatchEvent(new Event('resize'))
    expect(root.dataset.layout).toBe('schreibtisch')
  })

  it('liefert am Telefon vier Ziele und am Schreibtisch drei Spalten', () => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    const root = document.querySelector<HTMLElement>('#app')!
    new WeinbegleiterApp(root, erzeugeStartdaten(), []).start()
    expect(root.querySelectorAll('.bottom-nav .nav-knopf')).toHaveLength(4)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    window.dispatchEvent(new Event('resize'))
    expect(root.querySelector('.desktop-shell.desktop-heute')).not.toBeNull()
    expect(root.querySelector('.desktop-seite')).not.toBeNull()
    expect(root.querySelector('.desktop-mitte')).not.toBeNull()
    expect(root.querySelector('.desktop-detail')).not.toBeNull()
  })
})

describe('Runde im DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  })

  it('erzeugt aus leeren Rundenfeldern keinen Datensatz', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const vorher = stand.messungen.length
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))

    expect(stand.messungen).toHaveLength(vorher)
    expect(root.querySelector('#erfassen-fehler')?.textContent).toContain('mindestens einen Messwert')
  })

  it('gibt allen Werten denselben Zeitpunkt und springt nach dem Speichern nicht weiter', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    aendere(root.querySelector<HTMLInputElement>('#runden-zeit')!, '2026-09-04T08:05')
    root.querySelector<HTMLInputElement>('[name="runde-temperatur"]')!.value = '22,8'
    root.querySelector<HTMLInputElement>('[name="runde-oechsle"]')!.value = '58'

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    const neu = stand.messungen.filter(messung => messung.zeit === new Date('2026-09-04T08:05').toISOString())
    expect(neu.map(messung => messung.typ)).toEqual(['temperatur', 'oechsle'])
    expect(new Set(neu.map(messung => messung.zeit)).size).toBe(1)
    expect(root.querySelector('.runde-gefaess h1')?.textContent).toBe('Bottich 1')
    expect(root.querySelector('[data-action="runde-weiter"]')).not.toBeNull()
    expect(root.querySelector<HTMLInputElement>('#runden-zeit')?.disabled).toBe(true)

    klicke(root.querySelector('[data-action="runde-weiter"]'))
    root.querySelector<HTMLInputElement>('[name="runde-temperatur"]')!.value = '21,9'
    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    const rundenWerte = stand.messungen.filter(messung => messung.zeit === new Date('2026-09-04T08:05').toISOString())
    expect(new Set(rundenWerte.map(messung => messung.chargeId)).size).toBe(2)
    expect(new Set(rundenWerte.map(messung => messung.zeit)).size).toBe(1)
    klicke(root.querySelector('[data-action="runde-undo"]'))
    await warteAufRendern()
  })

  it('nimmt genau die zuletzt gespeicherten Datensätze zurück', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const messungenVorher = stand.messungen.map(messung => messung.id)
    const ereignisseVorher = stand.ereignisse.map(ereignis => ereignis.id)
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    root.querySelector<HTMLInputElement>('[name="runde-temperatur"]')!.value = '22,8'
    root.querySelector<HTMLSelectElement>('[name="runde-geruch"]')!.value = 'sauber / fruchtig'
    root.querySelector<HTMLInputElement>('[name="untergestossen"]')!.checked = true

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()
    expect(stand.messungen.length).toBe(messungenVorher.length + 2)
    expect(stand.ereignisse.length).toBe(ereignisseVorher.length + 1)
    klicke(root.querySelector('[data-action="runde-undo"]'))
    await warteAufRendern()

    expect(stand.messungen.map(messung => messung.id)).toEqual(messungenVorher)
    expect(stand.ereignisse.map(ereignis => ereignis.id)).toEqual(ereignisseVorher)
  })
})

describe('Messerfassung im DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
  })

  it('erhält in Modus B die Chargenauswahl beim Wechsel der Messgröße', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    new WeinbegleiterApp(root, stand, []).start()

    klicke(root.querySelector('[data-action="erfassen"]'))
    klicke(root.querySelector('[data-action="mess-erfassungsmodus"][data-mode="messgroesse"]'))

    const auswahl = [...root.querySelectorAll<HTMLInputElement>('input[name="chargeIds"]')]
    expect(auswahl.length).toBeGreaterThanOrEqual(3)
    auswahl[0]!.checked = false
    aendere(auswahl[0]!)
    auswahl[1]!.checked = true
    aendere(auswahl[1]!)
    auswahl[2]!.checked = true
    aendere(auswahl[2]!)

    const messTyp = root.querySelector<HTMLSelectElement>('#mess-typ')!
    aendere(messTyp, 'ph')

    const danach = [...root.querySelectorAll<HTMLInputElement>('input[name="chargeIds"]')]
    expect(danach.filter(feld => feld.checked).map(feld => feld.value)).toEqual([auswahl[1]!.value, auswahl[2]!.value])
    expect(root.querySelector<HTMLOptionElement>('#mess-typ option[selected]')?.value).toBe('ph')
  })

  it('erzeugt in Modus A aus leeren Messfeldern keinen Datensatz', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const anzahlVorher = stand.messungen.length
    new WeinbegleiterApp(root, stand, []).start()

    klicke(root.querySelector('[data-action="erfassen"]'))
    const formular = root.querySelector<HTMLFormElement>('#mess-form')!
    formular.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))

    expect(stand.messungen).toHaveLength(anzahlVorher)
    expect(root.querySelector('#erfassen-fehler')?.textContent).toContain('mindestens einen Messwert')
  })

  it('zeigt unter Mehr den Abgleichsstand und den manuellen Knopf', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    new WeinbegleiterApp(root, stand, []).start()

    klicke(root.querySelector('[data-action="nav"][data-view="mehr"]'))

    expect(root.querySelector('.abgleich-zeile')?.textContent).toContain('Abgleich: noch nie')
    expect(root.querySelector('[data-action="sync-jetzt"]')?.textContent).toBe('Jetzt abgleichen')
    expect(root.querySelector('.abgleich-hinweis')?.textContent).toBe('Nicht abgeglichen')
  })
})

describe('Press-Gate im DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  })

  it('stellt eine unbekannte Prüfung als Frage mit direktem Messfeld dar', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const quelle = stand.chargen[0]!
    quelle.phase = 'PRESS_GATE'
    stand.messungen = stand.messungen.filter(messung => messung.chargeId !== quelle.id || !['oechsle', 'sg'].includes(messung.typ))
    history.replaceState(null, '', `/#gate/${quelle.id}`)
    new WeinbegleiterApp(root, stand, []).start()

    expect(root.querySelector('[data-gate-open] h2')?.textContent).toMatch(/\?$/)
    expect(root.querySelector('.gate-status')?.textContent).toBe('Noch offen')
    expect(root.querySelector('#gate-mess-form')).not.toBeNull()
    expect(root.querySelector('.fehlerbox')).toBeNull()
  })

  it('legt Vorlauf und Presswein mit Abstammung, Volumen und Gefäß an', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const quelle = stand.chargen[0]!
    quelle.phase = 'PRESS_GATE'
    quelle.phaseSeit = '2026-09-04T08:00:00+02:00'
    stand.messungen.push({ id: 'test-press-dichte', chargeId: quelle.id, zeit: '2026-09-04T08:05:00+02:00', typ: 'oechsle', wert: 8, methode: 'spindel' })
    history.replaceState(null, '', `/#gate/${quelle.id}`)
    new WeinbegleiterApp(root, stand, []).start()

    const formular = root.querySelector<HTMLFormElement>('#press-teilung-form')!
    expect(formular).not.toBeNull()
    formular.querySelector<HTMLInputElement>('[name="vorlaufLiter"]')!.value = '4'
    formular.querySelector<HTMLInputElement>('[name="vorlaufKopfraum"]')!.value = '1'
    formular.querySelector<HTMLInputElement>('[name="pressweinLiter"]')!.value = '3'
    formular.querySelector<HTMLInputElement>('[name="pressweinKopfraum"]')!.value = '2'
    formular.querySelector<HTMLSelectElement>('[name="vorlaufBehaelter"]')!.value = 'ballon-1'
    formular.querySelector<HTMLSelectElement>('[name="pressweinBehaelter"]')!.value = 'ballon-2'
    formular.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    const kinder = stand.chargen.filter(charge => charge.elternChargeId === quelle.id)
    expect(quelle.archiviert).toBe(true)
    expect(kinder.map(charge => charge.typ)).toEqual(['vorlauf', 'presswein'])
    expect(kinder.every(charge => charge.phase === 'NACHGAERUNG')).toBe(true)
    expect(kinder.map(charge => [charge.fuellLiter, charge.kopfraumLiter, charge.volumenHistorie?.length])).toEqual([[4, 1, 1], [3, 2, 1]])
    expect(kinder.map(charge => charge.behaelterId)).toEqual(['ballon-1', 'ballon-2'])
  })
})
