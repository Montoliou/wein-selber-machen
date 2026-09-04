import { beforeEach, describe, expect, it } from 'vitest'
import { erzeugeStartdaten } from '../startdaten'
import { WeinbegleiterApp } from './app'

function klicke(element: Element | null): void {
  if (!(element instanceof HTMLElement)) throw new Error('Das erwartete Bedienelement fehlt.')
  element.click()
}

function aendere(element: HTMLInputElement | HTMLSelectElement, wert?: string): void {
  if (wert !== undefined) element.value = wert
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

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
