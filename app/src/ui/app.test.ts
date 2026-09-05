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
