import type { Klimapunkt, SensorKonfig } from './domain/typen'

export interface SensorMesswert {
  temperatur: number
  feuchte?: number
}

function liesPfad(objekt: unknown, pfad: string | undefined): unknown {
  if (!pfad) return undefined
  return pfad.split('.').reduce<unknown>((wert, teil) => {
    if (!wert || typeof wert !== 'object') return undefined
    if (Array.isArray(wert) && /^\d+$/.test(teil)) return wert[Number(teil)]
    return (wert as Record<string, unknown>)[teil]
  }, objekt)
}

function findeZahl(objekt: unknown, schluessel: string[], tiefe = 0): number | undefined {
  if (!objekt || typeof objekt !== 'object' || tiefe > 6) return undefined
  for (const [name, wert] of Object.entries(objekt)) {
    if (schluessel.includes(name.toLowerCase()) && typeof wert === 'number' && Number.isFinite(wert)) return wert
  }
  for (const wert of Object.values(objekt)) {
    const gefunden = findeZahl(wert, schluessel, tiefe + 1)
    if (gefunden !== undefined) return gefunden
  }
  return undefined
}

function alsZahl(wert: unknown): number | undefined {
  if (typeof wert === 'number' && Number.isFinite(wert)) return wert
  if (typeof wert === 'string') {
    const zahl = Number(wert.replace(',', '.'))
    return Number.isFinite(zahl) ? zahl : undefined
  }
  return undefined
}

export function pruefeSensorKonfiguration(konfig: SensorKonfig): string | null {
  if (!konfig.url.trim()) return 'Kein Sensor-Endpunkt eingetragen. Die manuelle Erfassung bleibt verfügbar.'
  let url: URL
  try {
    url = new URL(konfig.url)
  } catch {
    return 'Der Sensor-Endpunkt ist keine gültige URL.'
  }
  if (url.protocol === 'http:') {
    return 'HTTP ist blockiert: Eine über HTTPS geladene App darf kein unverschlüsseltes Gerät ansprechen (Mixed Content). Nutze einen HTTPS-Endpunkt oder erfasse den Wert manuell.'
  }
  if (url.protocol !== 'https:') return 'Der Sensor-Endpunkt muss mit https:// beginnen.'
  if (konfig.adapter === 'generisch-json' && !konfig.pfadTemperatur?.trim()) {
    return 'Für generisches JSON fehlt der Pfad zur Temperatur, zum Beispiel data.temp.'
  }
  return null
}

export async function ladeSensorwert(konfig: SensorKonfig): Promise<SensorMesswert> {
  const fehler = pruefeSensorKonfiguration(konfig)
  if (fehler) throw new Error(fehler)

  const headers = new Headers({ Accept: 'application/json' })
  if (konfig.token) headers.set('Authorization', `Bearer ${konfig.token}`)
  if (konfig.geraeteId) headers.set('X-Device-Id', konfig.geraeteId)
  const antwort = await fetch(konfig.url, { headers, cache: 'no-store' })
  if (!antwort.ok) throw new Error(`Sensor antwortet mit HTTP ${antwort.status}. Prüfe Endpunkt, Token und Geräte-ID.`)
  const json: unknown = await antwort.json()

  const temperatur = alsZahl(liesPfad(json, konfig.pfadTemperatur))
    ?? (konfig.adapter === 'shelly-cloud' ? findeZahl(json, ['tc', 'temperature', 'temp']) : undefined)
    ?? (konfig.adapter === 'govee' ? findeZahl(json, ['temperature', 'temp']) : undefined)
  const feuchte = alsZahl(liesPfad(json, konfig.pfadFeuchte))
    ?? (konfig.adapter === 'shelly-cloud' ? findeZahl(json, ['rh', 'humidity']) : undefined)
    ?? (konfig.adapter === 'govee' ? findeZahl(json, ['humidity']) : undefined)

  if (temperatur === undefined) {
    throw new Error('Die Antwort enthält am konfigurierten Pfad keinen numerischen Temperaturwert. Passe den JSON-Pfad an.')
  }
  return { temperatur, ...(feuchte === undefined ? {} : { feuchte }) }
}

export function alsKlimapunkt(wert: SensorMesswert, quelle: Klimapunkt['quelle']): Klimapunkt {
  return { zeit: new Date().toISOString(), temperatur: wert.temperatur, feuchte: wert.feuchte, quelle }
}
