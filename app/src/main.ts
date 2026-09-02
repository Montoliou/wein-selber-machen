import { erzeugeStartdaten } from './startdaten'
import { ladeDatenstand, ladeFotos, speichereDatenstand } from './speicher/indexeddb'
import { WeinbegleiterApp } from './ui/app'
import './ui/styles.css'

async function starteApp(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app')
  if (!root) throw new Error('App-Container fehlt.')
  let stand = await ladeDatenstand()
  if (!stand) {
    stand = erzeugeStartdaten()
    await speichereDatenstand(stand)
  }
  const fotos = await ladeFotos()
  new WeinbegleiterApp(root, stand, fotos).start()

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('./sw.js').catch(fehler => {
        console.warn('Service Worker konnte nicht registriert werden.', fehler)
      })
    })
  }
}

void starteApp().catch(fehler => {
  const root = document.querySelector<HTMLElement>('#app')
  if (root) root.innerHTML = `<main style="padding:24px;color:#f5eeea;background:#14100f;min-height:100vh;font:16px system-ui"><h1>Weinbegleiter konnte nicht starten</h1><p>${fehler instanceof Error ? fehler.message : 'Unbekannter Fehler'}</p></main>`
})
