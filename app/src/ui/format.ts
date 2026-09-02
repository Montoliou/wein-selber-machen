export const datumZeitFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })
export const datumFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const kurzDatumFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })
export const zahlFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 })

export function formatiereZahl(wert: number, stellen = 1): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen }).format(wert)
}

export function parseDeZahl(wert: FormDataEntryValue | null): number | null {
  if (typeof wert !== 'string' || !wert.trim()) return null
  const normalisiert = wert.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const zahl = Number(normalisiert)
  return Number.isFinite(zahl) ? zahl : null
}

export function isoAusDatetimeLocal(wert: FormDataEntryValue | null): string {
  if (typeof wert !== 'string' || !wert) return new Date().toISOString()
  return new Date(wert).toISOString()
}

export function datetimeLocalWert(iso = new Date().toISOString()): string {
  const datum = new Date(iso)
  const lokal = new Date(datum.getTime() - datum.getTimezoneOffset() * 60_000)
  return lokal.toISOString().slice(0, 16)
}

export function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function html(text: string | number | undefined | null): string {
  return String(text ?? '').replace(/[&<>'"]/g, zeichen => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[zeichen] ?? zeichen)
}

export function dateiname(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
