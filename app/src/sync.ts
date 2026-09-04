import type {
  Behaelter,
  Charge,
  Ereignis,
  Grabstein,
  Klimapunkt,
  Messung,
  Reminder,
  SensorKonfig,
  SyncSammlung,
  Vorratsposten,
  WikiSeite,
} from './domain/typen'
import { istAppDatenstand, migriereDatenstand, type AppDatenstand } from './speicher/modell'

const SYNC_SAMMLUNGEN: SyncSammlung[] = [
  'chargen', 'behaelter', 'messungen', 'ereignisse', 'reminder', 'wiki', 'klima', 'vorrat',
]
const SYNC_TOKEN_SPEICHER = 'weinbegleiter-sync-token'

interface SyncDatensatz {
  id: string
  zuletztGeaendert?: string
}

function stabilisiere(wert: unknown): unknown {
  if (Array.isArray(wert)) return wert.map(stabilisiere)
  if (!wert || typeof wert !== 'object') return wert
  return Object.fromEntries(Object.entries(wert as Record<string, unknown>)
    .sort(([links], [rechts]) => links.localeCompare(rechts))
    .map(([schluessel, inhalt]) => [schluessel, stabilisiere(inhalt)]))
}

function stabilerText(wert: unknown): string {
  return JSON.stringify(stabilisiere(wert))
}

function gewinntRechts<T extends { zuletztGeaendert?: string }>(links: T, rechts: T): boolean {
  const linksZeit = links.zuletztGeaendert ?? ''
  const rechtsZeit = rechts.zuletztGeaendert ?? ''
  if (rechtsZeit !== linksZeit) return rechtsZeit > linksZeit
  return stabilerText(rechts) > stabilerText(links)
}

function fuehreSammlungZusammen<T extends SyncDatensatz>(links: T[], rechts: T[]): T[] {
  const nachId = new Map<string, T>()
  for (const datensatz of [...links, ...rechts]) {
    const vorhanden = nachId.get(datensatz.id)
    if (!vorhanden || gewinntRechts(vorhanden, datensatz)) nachId.set(datensatz.id, datensatz)
  }
  return [...nachId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function fuehreGrabsteineZusammen(links: Grabstein[], rechts: Grabstein[]): Grabstein[] {
  const nachSchluessel = new Map<string, Grabstein>()
  for (const grabstein of [...links, ...rechts]) {
    const schluessel = `${grabstein.sammlung}\u0000${grabstein.id}`
    const vorhanden = nachSchluessel.get(schluessel)
    if (!vorhanden || grabstein.zeit > vorhanden.zeit) nachSchluessel.set(schluessel, grabstein)
  }
  return [...nachSchluessel.values()].sort((a, b) =>
    a.sammlung.localeCompare(b.sammlung) || a.id.localeCompare(b.id))
}

function ohneGeloeschte<T extends SyncDatensatz>(
  sammlung: SyncSammlung,
  datensaetze: T[],
  grabsteine: Grabstein[],
): T[] {
  const geloeschtNachId = new Map(grabsteine
    .filter(grabstein => grabstein.sammlung === sammlung)
    .map(grabstein => [grabstein.id, grabstein.zeit]))
  return datensaetze.filter(datensatz => {
    const geloeschtAm = geloeschtNachId.get(datensatz.id)
    return !geloeschtAm || geloeschtAm < (datensatz.zuletztGeaendert ?? '')
  })
}

function waehleSensor(links: SensorKonfig, rechts: SensorKonfig): SensorKonfig {
  return gewinntRechts(links, rechts) ? rechts : links
}

export function fuehreDatenstaendeZusammen(lokal: AppDatenstand, entfernt: AppDatenstand): AppDatenstand {
  const links = migriereDatenstand(lokal)
  const rechts = migriereDatenstand(entfernt)
  if (links.jahrgang !== rechts.jahrgang) throw new Error('Die Jahrgänge der Datenstände stimmen nicht überein.')
  const geloescht = fuehreGrabsteineZusammen(links.geloescht ?? [], rechts.geloescht ?? [])

  const sammlungen: {
    chargen: Charge[]
    behaelter: Behaelter[]
    messungen: Messung[]
    ereignisse: Ereignis[]
    reminder: Reminder[]
    wiki: WikiSeite[]
    klima: Klimapunkt[]
    vorrat: Vorratsposten[]
  } = {
    chargen: ohneGeloeschte('chargen', fuehreSammlungZusammen(links.chargen, rechts.chargen), geloescht),
    behaelter: ohneGeloeschte('behaelter', fuehreSammlungZusammen(links.behaelter, rechts.behaelter), geloescht),
    messungen: ohneGeloeschte('messungen', fuehreSammlungZusammen(links.messungen, rechts.messungen), geloescht),
    ereignisse: ohneGeloeschte('ereignisse', fuehreSammlungZusammen(links.ereignisse, rechts.ereignisse), geloescht),
    reminder: ohneGeloeschte('reminder', fuehreSammlungZusammen(links.reminder, rechts.reminder), geloescht),
    wiki: ohneGeloeschte('wiki', fuehreSammlungZusammen(links.wiki, rechts.wiki), geloescht),
    klima: ohneGeloeschte('klima', fuehreSammlungZusammen(links.klima, rechts.klima), geloescht),
    vorrat: ohneGeloeschte('vorrat', fuehreSammlungZusammen(links.vorrat, rechts.vorrat), geloescht),
  }

  const migrationen = [...new Set([
    ...(Array.isArray(links.appMeta.migrationen) ? links.appMeta.migrationen : []),
    ...(Array.isArray(rechts.appMeta.migrationen) ? rechts.appMeta.migrationen : []),
  ])]
  const ergebnis: AppDatenstand = {
    ...links,
    ...sammlungen,
    version: Math.max(links.version, rechts.version),
    sensor: waehleSensor(links.sensor, rechts.sensor),
    geloescht,
    appMeta: { ...links.appMeta, migrationen },
  }
  return migriereDatenstand(ergebnis)
}

function gespeicherterSyncToken(): string {
  try {
    return localStorage.getItem(SYNC_TOKEN_SPEICHER)?.trim() ?? ''
  } catch {
    return ''
  }
}

function speichereSyncToken(token: string): void {
  try {
    localStorage.setItem(SYNC_TOKEN_SPEICHER, token)
  } catch {
    // IndexedDB bleibt die Datenquelle; blockierter Web Storage verhindert nur das Merken des Tokens.
  }
}

function tokenAusSensor(sensor: SensorKonfig): string {
  try {
    const queryToken = new URL(sensor.url).searchParams.get('token')?.trim()
    if (queryToken) return queryToken
  } catch {
    // Eine leere Sensor-URL ist vor der ersten Einrichtung normal.
  }
  return sensor.token?.trim() ?? ''
}

export function uebernehmeSyncTokenAusUrl(): void {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('sync-token')?.trim()
  if (!token) return
  speichereSyncToken(token)
  url.searchParams.delete('sync-token')
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export function syncEndpunktFuer(stand: AppDatenstand, basis = document.baseURI): URL {
  const sensorToken = tokenAusSensor(stand.sensor)
  if (sensorToken) speichereSyncToken(sensorToken)
  const token = gespeicherterSyncToken() || sensorToken
  if (!token) throw new Error('Der Abgleich benötigt den Proxy-Token aus der Kellersensor-Konfiguration.')
  const url = new URL('./sync.php', basis)
  url.searchParams.set('token', token)
  return url
}

export async function gleicheMitServerAb(stand: AppDatenstand): Promise<AppDatenstand> {
  if (navigator.onLine === false) throw new Error('Das Gerät ist offline.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  try {
    const antwort = await fetch(syncEndpunktFuer(stand), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(stand),
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    if (!antwort.ok) throw new Error(`Der Sync-Endpunkt antwortet mit HTTP ${antwort.status}.`)
    const entfernt: unknown = await antwort.json()
    if (!istAppDatenstand(entfernt)) throw new Error('Der Sync-Endpunkt hat keinen gültigen Datenstand geliefert.')
    return fuehreDatenstaendeZusammen(stand, migriereDatenstand(entfernt))
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Ein Stand ohne Inhalt, aber mit gueltigem Kopf (Version, Jahrgang, Sensor).
 * Damit fragt ein neues Geraet den Server, OHNE ihm etwas unterzuschieben:
 * Vereinigung mit leeren Sammlungen liefert den Serverstand unveraendert.
 */
export function alsSonde(stand: AppDatenstand): AppDatenstand {
  return { ...stand, chargen: [], behaelter: [], messungen: [], ereignisse: [], reminder: [], wiki: [], klima: [], vorrat: [], geloescht: [] }
}

/**
 * Holt den kanonischen Stand, falls das Geraet einen Token hat und der Server
 * schon Daten traegt. Sonst null - dann darf lokal gesaeet werden.
 * Grund siehe main.ts: ein Startdatensatz darf nie gegen einen bestehenden
 * Serverstand gemischt werden.
 */
export async function holeKanonischenStand(sonde: AppDatenstand): Promise<AppDatenstand | null> {
  if (!gespeicherterSyncToken() && !tokenAusSensor(sonde.sensor)) return null
  if (navigator.onLine === false) return null
  try {
    const stand = await gleicheMitServerAb(sonde)
    return stand.chargen.length > 0 ? stand : null
  } catch {
    return null
  }
}

export { SYNC_SAMMLUNGEN }
