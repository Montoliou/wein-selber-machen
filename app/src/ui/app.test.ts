import { beforeEach, describe, expect, it, vi } from 'vitest'
import { naehrsalzPlan } from '../domain/oenologie'
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

function lokalesIsoDatum(datum = new Date()): string {
  const jahr = datum.getFullYear()
  const monat = String(datum.getMonth() + 1).padStart(2, '0')
  const tag = String(datum.getDate()).padStart(2, '0')
  return `${jahr}-${monat}-${tag}`
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

  it('erzeugt aus einem leeren Zugabemengenfeld keine Zugabe', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    const ereignisseVorher = stand.ereignisse.length
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    root.querySelector<HTMLInputElement>('[name="runde-temperatur"]')!.value = '21,4'
    const menge = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-menge"]')!
    menge.value = ''
    menge.dispatchEvent(new Event('input', { bubbles: true }))

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    expect(stand.ereignisse).toHaveLength(ereignisseVorher)
    expect(stand.ereignisse.filter(ereignis => ereignis.art === 'naehrsalz')).toHaveLength(4)
  })

  it('speichert eine Zugabe mit Vorrat, Begründung und Rundenzeitpunkt', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    aendere(root.querySelector<HTMLInputElement>('#runden-zeit')!, '2026-09-04T10:15')
    const aktiv = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-aktiv"]')!
    aktiv.checked = true
    aendere(aktiv)
    const begruendung = root.querySelector<HTMLTextAreaElement>('[name="zugabe-naehrsalz-begruendung"]')!
    begruendung.value = ''
    begruendung.dispatchEvent(new Event('input', { bubbles: true }))

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    const zugabe = stand.ereignisse.filter(ereignis => ereignis.chargeId === 'charge-bottich-1' && ereignis.art === 'naehrsalz').at(-1)!
    expect(zugabe.vorratId).toBe('vorrat-naehrsalz')
    expect(zugabe.begruendung.trim().length).toBeGreaterThan(0)
    expect(zugabe.begruendung).toContain('04.09.26')
    expect(zugabe.zeit).toBe(new Date('2026-09-04T10:15').toISOString())
  })

  it('schlägt für 8,6 L exakt die Fachmenge je Nährsalzportion vor', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    klicke(root.querySelector('[data-action="runde-wechsel"][data-richtung="1"]'))

    const menge = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-menge"]')!.value
    expect(Number(menge.replace(',', '.'))).toBe(naehrsalzPlan(8.6).proPortion)
    expect(root.querySelector('[data-zugabe-art="naehrsalz"]')?.textContent).toContain('Portion 2 von 3')
  })

  it('erledigt einen gemeinsamen Zugabe-Reminder nach allen Gefäßen und nennt ihn in der Zusammenfassung', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    const reminder = stand.reminder.find(eintrag => eintrag.id === 'rem-naehrsalz-2')!
    reminder.faellig = '2026-09-01T08:00:00.000Z'
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)

    for (let index = 0; index < 4; index += 1) {
      const aktiv = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-aktiv"]')!
      aktiv.checked = true
      aendere(aktiv)
      root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
      await warteAufRendern()
      if (index < 3) klicke(root.querySelector('[data-action="runde-weiter"]'))
    }

    expect(reminder.erledigt).toBe(true)
    klicke(root.querySelector('[data-action="runde-weiter"]'))
    expect(root.querySelector('.runden-zusammenfassung')?.textContent).toContain('Messungen und Zugaben')
    expect(root.querySelector('.runden-zusammenfassung')?.textContent).toContain('Bottich 4')
    expect(root.querySelector('.runden-zusammenfassung')?.textContent).toContain('ErledigtHefenährsalz Portion 2 von 3')
  })

  it('erledigt einen fälligen Zugabe-Reminder der aktuellen Charge', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    const reminder = {
      id: 'rem-test-naehrsalz',
      chargeId: 'charge-bottich-1',
      faellig: '2026-09-01T08:00:00.000Z',
      titel: 'Hefenährsalz Portion 2 von 3',
      beschreibung: 'Am betroffenen Gefäß geben.',
      erledigt: false,
      quelle: 'manuell' as const,
    }
    stand.reminder.push(reminder)
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    expect(root.querySelector('.runden-zugabe-reminder')?.textContent).toContain('Fällig: Hefenährsalz Portion 2 von 3')
    const aktiv = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-aktiv"]')!
    aktiv.checked = true
    aendere(aktiv)

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    expect(reminder.erledigt).toBe(true)
  })

  it('nimmt Zugabe, Vorratsbuchung und Reminder-Erledigung gemeinsam zurück', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    const reminder = {
      id: 'rem-test-undo',
      chargeId: 'charge-bottich-1',
      faellig: '2026-09-01T08:00:00.000Z',
      titel: 'Hefenährsalz Portion 2 von 3',
      beschreibung: 'Am betroffenen Gefäß geben.',
      erledigt: false,
      quelle: 'manuell' as const,
    }
    stand.reminder.push(reminder)
    const ereignisseVorher = stand.ereignisse.map(ereignis => ereignis.id)
    const vorratVorher = stand.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')!.mengeWert
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    const aktiv = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-aktiv"]')!
    aktiv.checked = true
    aendere(aktiv)

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()
    expect(reminder.erledigt).toBe(true)
    expect(stand.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')!.mengeWert).toBeLessThan(vorratVorher)
    klicke(root.querySelector('[data-action="runde-undo"]'))
    await warteAufRendern()

    expect(stand.ereignisse.map(ereignis => ereignis.id)).toEqual(ereignisseVorher)
    expect(stand.vorrat.find(posten => posten.id === 'vorrat-naehrsalz')!.mengeWert).toBe(vorratVorher)
    expect(reminder.erledigt).toBe(false)
  })

  it('setzt einen wiederkehrenden Zugabe-Reminder weiter und stellt ihn bei Rücknahme wieder her', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    const faelligVorher = '2026-09-01T08:00:00.000Z'
    const reminder = {
      id: 'rem-test-wiederholung',
      chargeId: 'charge-bottich-1',
      faellig: faelligVorher,
      titel: 'Hefenährsalz Portion 2 von 3',
      beschreibung: 'Am betroffenen Gefäß geben.',
      erledigt: false,
      wiederholungTage: 1,
      quelle: 'manuell' as const,
    }
    stand.reminder.push(reminder)
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    const aktiv = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-aktiv"]')!
    aktiv.checked = true
    aendere(aktiv)

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    expect(reminder.erledigt).toBe(false)
    expect(new Date(reminder.faellig).getTime()).toBeGreaterThan(Date.now())
    klicke(root.querySelector('[data-action="runde-undo"]'))
    await warteAufRendern()
    expect(reminder.erledigt).toBe(false)
    expect(reminder.faellig).toBe(faelligVorher)
  })

  it('speichert ohne Vorratskopplung, wenn der passende Posten fehlt', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    stand.vorrat = stand.vorrat.filter(posten => posten.id !== 'vorrat-naehrsalz')
    const vorratVorher = structuredClone(stand.vorrat)
    new WeinbegleiterApp(root, stand, []).start()
    starteRunde(root)
    expect(root.querySelector('[data-zugabe-art="naehrsalz"] [data-runde-zugabe-vorrat]')?.textContent).toContain('Vorrat unverändert')
    const aktiv = root.querySelector<HTMLInputElement>('[name="zugabe-naehrsalz-aktiv"]')!
    aktiv.checked = true
    aendere(aktiv)

    root.querySelector<HTMLFormElement>('#runde-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    const zugabe = stand.ereignisse.filter(ereignis => ereignis.chargeId === 'charge-bottich-1' && ereignis.art === 'naehrsalz').at(-1)!
    expect(zugabe.vorratId).toBeUndefined()
    expect(stand.vorrat).toEqual(vorratVorher)
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

describe('Gefäßverwaltung im DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  })

  it('zeigt ein ab heute vorhandenes Gefäß als frei und nur künftige Lieferungen als erwartet', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const heute = lokalesIsoDatum()
    const morgen = new Date()
    morgen.setDate(morgen.getDate() + 1)
    stand.behaelter.push(
      { id: 'test-heute', name: 'Testballon heute', bruttoLiter: 5, material: 'Glas', verschluss: 'Stopfen', vorhandenAb: heute },
      { id: 'test-morgen', name: 'Testballon morgen', bruttoLiter: 5, material: 'Glas', verschluss: 'Stopfen', vorhandenAb: lokalesIsoDatum(morgen) },
    )
    new WeinbegleiterApp(root, stand, []).start()

    klicke(root.querySelector('[data-action="nav"][data-view="mehr"]'))

    expect(root.querySelector('[data-behaelter-id="test-heute"] .gefaess-zustand')?.textContent).toBe('frei')
    expect(root.querySelector('[data-behaelter-id="test-morgen"] .gefaess-zustand')?.textContent).toContain('erwartet ab')
  })

  it('führt ein ausgemustertes Gefäß in keiner Zielauswahl', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const quelle = stand.chargen[0]!
    quelle.phase = 'PRESS_GATE'
    quelle.phaseSeit = new Date(Date.now() - 60_000).toISOString()
    stand.messungen.push({ id: 'test-press-dichte-gefaess', chargeId: quelle.id, zeit: new Date().toISOString(), typ: 'oechsle', wert: 8, methode: 'spindel' })
    const ausgemustert = stand.behaelter.find(behaelter => behaelter.id === 'ballon-1')!
    ausgemustert.ausgemustertAm = new Date().toISOString()
    ausgemustert.ausgemustertGrund = 'Im Transport zerbrochen'
    history.replaceState(null, '', `/#gate/${quelle.id}`)
    new WeinbegleiterApp(root, stand, []).start()

    const formular = root.querySelector<HTMLFormElement>('#press-teilung-form')!
    expect(formular).not.toBeNull()
    expect(formular.querySelector('option[value="ballon-1"]')).toBeNull()
  })

  it('lehnt Ausmustern ohne Grund ab', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const behaelter = stand.behaelter.find(eintrag => eintrag.id === 'ballon-1')!
    new WeinbegleiterApp(root, stand, []).start()
    klicke(root.querySelector('[data-action="nav"][data-view="mehr"]'))
    klicke(root.querySelector('[data-action="behaelter-ausmustern"][data-id="ballon-1"]'))

    root.querySelector<HTMLFormElement>('#behaelter-ausmustern-form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()

    expect(behaelter.ausgemustertAm).toBeUndefined()
    expect(behaelter.ausgemustertGrund).toBeUndefined()
    expect(root.querySelector('#dialog-fehler')?.textContent).toContain('Grund ist Pflicht')
  })

  it('mustert ein Gefäß über den Absendeknopf aus und schließt den Dialog', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    const behaelter = stand.behaelter.find(eintrag => eintrag.id === 'ballon-1')!
    new WeinbegleiterApp(root, stand, []).start()
    klicke(root.querySelector('[data-action="nav"][data-view="mehr"]'))
    klicke(root.querySelector('[data-action="behaelter-ausmustern"][data-id="ballon-1"]'))

    root.querySelector<HTMLTextAreaElement>('#ausmustern-grund')!.value = 'Im Transport zerbrochen'
    klicke(root.querySelector('#behaelter-ausmustern-form button[type="submit"]'))
    await warteAufRendern()

    expect(behaelter.ausgemustertGrund).toBe('Im Transport zerbrochen')
    expect(behaelter.ausgemustertAm).toBeDefined()
    expect(root.querySelector('#behaelter-ausmustern-form')).toBeNull()
    expect(root.querySelector('[role="dialog"]')).toBeNull()

    klicke(root.querySelector('[data-action="behaelter-zurueckholen"][data-id="ballon-1"]'))
    await warteAufRendern()
    expect(behaelter.ausgemustertAm).toBeUndefined()
    expect(behaelter.ausgemustertGrund).toBeUndefined()
  })

  it('legt ein Gefäß an und bearbeitet seine Stammdaten', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    new WeinbegleiterApp(root, stand, []).start()
    klicke(root.querySelector('[data-action="nav"][data-view="mehr"]'))
    klicke(root.querySelector('[data-action="behaelter-neu"]'))
    root.querySelector<HTMLInputElement>('#behaelter-name')!.value = 'Testballon'
    root.querySelector<HTMLInputElement>('#behaelter-liter')!.value = '7,5'
    root.querySelector<HTMLInputElement>('#behaelter-material')!.value = 'Glas'
    root.querySelector<HTMLInputElement>('#behaelter-verschluss')!.value = 'Stopfen'
    klicke(root.querySelector('#behaelter-verwalten-form button[type="submit"]'))
    await warteAufRendern()

    const angelegt = stand.behaelter.find(behaelter => behaelter.name === 'Testballon')!
    expect(angelegt.bruttoLiter).toBe(7.5)
    expect(root.querySelector('#behaelter-verwalten-form')).toBeNull()
    klicke(root.querySelector(`[data-action="behaelter-bearbeiten"][data-id="${angelegt.id}"]`))
    root.querySelector<HTMLInputElement>('#behaelter-name')!.value = 'Testballon groß'
    root.querySelector<HTMLInputElement>('#behaelter-liter')!.value = '8'
    klicke(root.querySelector('#behaelter-verwalten-form button[type="submit"]'))
    await warteAufRendern()

    expect(angelegt.name).toBe('Testballon groß')
    expect(angelegt.bruttoLiter).toBe(8)
  })

  it('entfernt bei Angekommen das erwartete Lieferdatum', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const behaelter = stand.behaelter.find(eintrag => eintrag.id === 'ballon-klein-1')!
    new WeinbegleiterApp(root, stand, []).start()
    klicke(root.querySelector('[data-action="nav"][data-view="mehr"]'))

    klicke(root.querySelector('[data-action="behaelter-angekommen"][data-id="ballon-klein-1"]'))
    await warteAufRendern()

    expect(behaelter.vorhandenAb).toBeUndefined()
    expect(root.querySelector('[data-behaelter-id="ballon-klein-1"] .gefaess-zustand')?.textContent).toBe('frei')
  })

  it('löst einen fälligen Liefertermin mit vorausgewählter Gefäßliste ein', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = erzeugeStartdaten()
    const heute = lokalesIsoDatum()
    const angekommen = stand.behaelter.find(behaelter => behaelter.id === 'ballon-3')!
    const nichtAngekommen = stand.behaelter.find(behaelter => behaelter.id === 'ballon-4')!
    angekommen.vorhandenAb = heute
    nichtAngekommen.vorhandenAb = heute
    const reminder = stand.reminder.find(eintrag => eintrag.id === 'rem-ballons')!
    const faellig = new Date()
    faellig.setHours(0, 0, 0, 0)
    reminder.faellig = faellig.toISOString()
    reminder.beschreibung = 'Zwei Gärballons werden heute erwartet.'
    new WeinbegleiterApp(root, stand, []).start()
    klicke(root.querySelector('[data-action="nav"][data-view="termine"]'))

    klicke(root.querySelector('[data-action="reminder-toggle"][data-id="rem-ballons"]'))
    const formular = root.querySelector<HTMLFormElement>('#lieferung-erledigen-form')!
    const auswahl = [...formular.querySelectorAll<HTMLInputElement>('input[name="behaelterIds"]')]
    const erwarteteIds = stand.behaelter.filter(behaelter => behaelter.vorhandenAb && behaelter.vorhandenAb <= heute).map(behaelter => behaelter.id).sort()
    expect(auswahl.map(feld => feld.value).sort()).toEqual(erwarteteIds)
    expect(auswahl.every(feld => feld.checked)).toBe(true)
    auswahl.find(feld => feld.value === nichtAngekommen.id)!.checked = false

    formular.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await warteAufRendern()

    expect(angekommen.vorhandenAb).toBeUndefined()
    expect(nichtAngekommen.vorhandenAb).toBe(heute)
    expect(reminder.erledigt).toBe(true)
  })
})

describe('Wiki-Formular im DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  })

  it('speichert eine Wiki-Seite über den Absendeknopf', async () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const stand = structuredClone(erzeugeStartdaten())
    new WeinbegleiterApp(root, stand, []).start()
    klicke(root.querySelector('[data-action="nav"][data-view="mehr"]'))
    klicke(root.querySelector('[data-action="nav"][data-view="wiki"]'))
    klicke(root.querySelector('[data-action="wiki-neu"]'))
    root.querySelector<HTMLInputElement>('#wiki-titel-feld')!.value = 'Klicktest'
    root.querySelector<HTMLInputElement>('#wiki-tags-feld')!.value = 'Test, Formular'
    root.querySelector<HTMLTextAreaElement>('#wiki-inhalt')!.value = '# Per Klick gespeichert'

    klicke(root.querySelector('#wiki-form button[type="submit"]'))
    await warteAufRendern()

    const seite = stand.wiki.find(eintrag => eintrag.titel === 'Klicktest')
    expect(seite).toMatchObject({ tags: ['Test', 'Formular'], inhalt: '# Per Klick gespeichert' })
    expect(root.querySelector('#wiki-form')).toBeNull()
    expect(root.dataset.ansicht).toBe('wiki-seite')
  })
})

describe('Formularfeldnamen im DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  })

  it('verdeckt in keinem gerenderten Formular eine HTMLFormElement-Eigenschaft', () => {
    const formularEigenschaften = new Set<string>()
    let ebene: object | null = document.createElement('form')
    while (ebene) {
      Object.getOwnPropertyNames(ebene).forEach(eigenschaft => formularEigenschaften.add(eigenschaft))
      ebene = Object.getPrototypeOf(ebene) as object | null
    }
    const gerenderteFormulare = new Set<string>()
    const pruefeFormulare = (root: HTMLElement): void => {
      root.querySelectorAll<HTMLFormElement>('form').forEach(formular => {
        const formularId = formular.getAttribute('id') ?? '(Formular ohne ID)'
        gerenderteFormulare.add(formularId)
        formular.querySelectorAll<HTMLElement>('[name]').forEach(feld => {
          const feldname = feld.getAttribute('name')!
          expect(formularEigenschaften.has(feldname), `${formularId}: name="${feldname}" verdeckt eine Formulareigenschaft`).toBe(false)
        })
      })
    }
    const starteAnsicht = (hash: string, stand = structuredClone(erzeugeStartdaten())): HTMLElement => {
      document.body.innerHTML = '<div id="app"></div>'
      history.replaceState(null, '', `/${hash}`)
      const root = document.querySelector<HTMLElement>('#app')!
      new WeinbegleiterApp(root, stand, []).start()
      return root
    }

    let stand = structuredClone(erzeugeStartdaten())
    let root = starteAnsicht('#runde', stand)
    pruefeFormulare(root)

    const chargeId = stand.chargen[0]!.id
    root = starteAnsicht(`#charge/${chargeId}`, stand)
    klicke(root.querySelector('[data-action="charge-tab"][data-tab="gefaess"]'))
    pruefeFormulare(root)
    klicke(root.querySelector('[data-action="erfassen"]'))
    pruefeFormulare(root)
    klicke(root.querySelector('[data-action="mess-erfassungsmodus"][data-mode="messgroesse"]'))
    pruefeFormulare(root)
    klicke(root.querySelector('[data-action="erfassen-modus"][data-mode="ereignis"]'))
    pruefeFormulare(root)

    const messung = stand.messungen.find(eintrag => stand.chargen.some(charge => charge.id === eintrag.chargeId))!
    root = starteAnsicht(`#charge/${messung.chargeId}`, stand)
    klicke(root.querySelector('[data-action="charge-tab"][data-tab="messungen"]'))
    klicke(root.querySelector(`[data-action="messung-bearbeiten"][data-id="${messung.id}"]`))
    pruefeFormulare(root)

    const ereignis = stand.ereignisse.find(eintrag => stand.chargen.some(charge => charge.id === eintrag.chargeId))!
    root = starteAnsicht(`#charge/${ereignis.chargeId}`, stand)
    klicke(root.querySelector('[data-action="charge-tab"][data-tab="ereignisse"]'))
    klicke(root.querySelector(`[data-action="ereignis-bearbeiten"][data-id="${ereignis.id}"]`))
    pruefeFormulare(root)

    root = starteAnsicht(`#charge/${chargeId}`, stand)
    klicke(root.querySelector('[data-action="nav"][data-view="rechner"]'))
    pruefeFormulare(root)
    root = starteAnsicht('', stand)
    klicke(root.querySelector('[data-action="nav"][data-view="umverteilen"]'))
    pruefeFormulare(root)

    root = starteAnsicht('#termine', stand)
    pruefeFormulare(root)
    const heute = lokalesIsoDatum()
    const lieferStand = structuredClone(erzeugeStartdaten())
    const lieferReminder = lieferStand.reminder.find(eintrag => eintrag.id === 'rem-ballons')!
    const faellig = new Date()
    faellig.setHours(0, 0, 0, 0)
    lieferReminder.faellig = faellig.toISOString()
    lieferReminder.erledigt = false
    lieferReminder.beschreibung = 'Zwei Gärballons werden heute erwartet.'
    lieferStand.behaelter.find(eintrag => eintrag.id === 'ballon-3')!.vorhandenAb = heute
    lieferStand.behaelter.find(eintrag => eintrag.id === 'ballon-4')!.vorhandenAb = heute
    root = starteAnsicht('', lieferStand)
    klicke(root.querySelector('[data-action="nav"][data-view="termine"]'))
    klicke(root.querySelector('[data-action="reminder-toggle"][data-id="rem-ballons"]'))
    expect(root.querySelector('#lieferung-erledigen-form')).not.toBeNull()
    pruefeFormulare(root)

    root = starteAnsicht('#wiki', stand)
    klicke(root.querySelector('[data-action="wiki-neu"]'))
    pruefeFormulare(root)

    root = starteAnsicht('#mehr', stand)
    pruefeFormulare(root)
    klicke(root.querySelector('[data-action="behaelter-neu"]'))
    pruefeFormulare(root)
    klicke(root.querySelector('[data-action="dialog-schliessen"]'))
    klicke(root.querySelector('[data-action="behaelter-ausmustern"]'))
    pruefeFormulare(root)

    const gateStand = structuredClone(erzeugeStartdaten())
    const gateCharge = gateStand.chargen[0]!
    gateCharge.phase = 'PRESS_GATE'
    gateStand.messungen = gateStand.messungen.filter(eintrag => eintrag.chargeId !== gateCharge.id || !['oechsle', 'sg'].includes(eintrag.typ))
    root = starteAnsicht(`#gate/${gateCharge.id}`, gateStand)
    pruefeFormulare(root)

    const pressStand = structuredClone(erzeugeStartdaten())
    const pressCharge = pressStand.chargen[0]!
    pressCharge.phase = 'PRESS_GATE'
    pressCharge.phaseSeit = '2026-09-04T08:00:00+02:00'
    pressStand.messungen.push({ id: 'test-formularnamen-press-dichte', chargeId: pressCharge.id, zeit: '2026-09-04T08:05:00+02:00', typ: 'oechsle', wert: 8, methode: 'spindel' })
    root = starteAnsicht(`#gate/${pressCharge.id}`, pressStand)
    pruefeFormulare(root)

    expect([...gerenderteFormulare].sort()).toEqual([
      'behaelter-ausmustern-form',
      'behaelter-verwalten-form',
      'ereignis-bearbeiten-form',
      'ereignis-form',
      'gate-mess-form',
      'gefaess-form',
      'klima-form',
      'lieferung-erledigen-form',
      'mess-form',
      'messung-bearbeiten-form',
      'press-teilung-form',
      'rechner-form',
      'reminder-form',
      'runde-form',
      'sensor-form',
      'umverteilen-form',
      'wiki-form',
    ])
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
