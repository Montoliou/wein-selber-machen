import { erzeugeStartdaten } from './startdaten'
import { ladeDatenstand, ladeFotos, speichereDatenstand } from './speicher/indexeddb'
import { migriereDatenstand } from './speicher/modell'
import { uebernehmeSyncTokenAusUrl } from './sync'
import { WeinbegleiterApp } from './ui/app'
import './ui/styles.css'

async function starteApp(): Promise<void> {
  uebernehmeSyncTokenAusUrl()
  const root = document.querySelector<HTMLElement>('#app')
  if (!root) throw new Error('App-Container fehlt.')
  let stand = await ladeDatenstand()
  if (!stand) {
    stand = migriereDatenstand(erzeugeStartdaten())
    await speichereDatenstand(stand)
  }
  const fotos = await ladeFotos()
  const app = new WeinbegleiterApp(root, stand, fotos)
  app.start()
  void app.aktualisiereAbgleichBeimStart()
  void app.aktualisiereSensorBeimStart()

  if ('serviceWorker' in navigator) {
    if (document.readyState === 'complete') void registriereServiceWorker(app)
    else window.addEventListener('load', () => { void registriereServiceWorker(app) }, { once: true })
  }
}

async function registriereServiceWorker(app: WeinbegleiterApp): Promise<void> {
  try {
    const registrierung = await navigator.serviceWorker.register('./sw.js')
    let wartenderWorker: ServiceWorker | null = registrierung.waiting
    let aktualisierungAngefordert = false
    if (wartenderWorker) app.zeigeUpdateHinweis()

    registrierung.addEventListener('updatefound', () => {
      const worker = registrierung.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return
        wartenderWorker = registrierung.waiting ?? worker
        app.zeigeUpdateHinweis()
      })
    })

    window.addEventListener('weinbegleiter:update-anwenden', () => {
      const worker = registrierung.waiting ?? wartenderWorker
      if (!worker) return
      aktualisierungAngefordert = true
      worker.postMessage({ type: 'SKIP_WAITING' })
    })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (aktualisierungAngefordert) window.location.reload()
    })
  } catch (fehler) {
    console.warn('Service Worker konnte nicht registriert werden.', fehler)
  }
}

void starteApp().catch(fehler => {
  const root = document.querySelector<HTMLElement>('#app')
  if (root) root.innerHTML = `<main style="padding:24px;color:#f5eeea;background:#14100f;min-height:100vh;font:16px system-ui"><h1>Weinbegleiter konnte nicht starten</h1><p>${fehler instanceof Error ? fehler.message : 'Unbekannter Fehler'}</p></main>`
})
