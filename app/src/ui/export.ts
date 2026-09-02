import type { Foto, Messung } from '../domain/typen'
import type { AppDatenstand } from '../speicher/modell'

export interface Sicherung {
  schema: 'weinbegleiter-v1'
  exportiert: string
  datenstand: AppDatenstand
  fotos: Array<{ id: string; zeit: string; chargeId?: string; typ: string; datei: string }>
}

const deDatum = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })
const deZahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 })

function csvFeld(wert: string): string {
  return `"${wert.replace(/"/g, '""')}"`
}

function messwert(messung: Messung): string {
  if (messung.wert !== null) return deZahl.format(messung.wert)
  return messung.text ?? ''
}

export function alsMarkdown(stand: AppDatenstand): string {
  const abschnitte = stand.chargen.filter(charge => !charge.archiviert).map(charge => {
    const messungen = stand.messungen.filter(messung => messung.chargeId === charge.id).sort((a, b) => a.zeit.localeCompare(b.zeit))
    const ereignisse = stand.ereignisse.filter(ereignis => ereignis.chargeId === charge.id).sort((a, b) => a.zeit.localeCompare(b.zeit))
    const kg = stand.appMeta.chargenMengenKg[charge.id]
    return `## ${charge.name}\n\n- Phase: ${charge.phase}\n- Typ: ${charge.typ}\n- Menge: ${kg === undefined ? 'nicht erfasst' : `${deZahl.format(kg)} kg`}\n- Start: ${deDatum.format(new Date(charge.startdatum))}\n\n### Messungen\n\n${messungen.length ? messungen.map(m => `- ${deDatum.format(new Date(m.zeit))}: ${m.typ} ${messwert(m)}${m.methode ? ` (${m.methode})` : ''}`).join('\n') : '- Keine Messungen'}\n\n### Ereignisse\n\n${ereignisse.length ? ereignisse.map(e => `- ${deDatum.format(new Date(e.zeit))}: ${e.art}${e.stoff ? `, ${e.stoff}` : ''}${e.mengeWert === undefined ? '' : `, ${deZahl.format(e.mengeWert)} ${e.mengeEinheit ?? ''}`} — ${e.begruendung}`).join('\n') : '- Keine Ereignisse'}`
  })
  return `# Weinbegleiter – Jahrgang ${stand.jahrgang}\n\nExportiert am ${deDatum.format(new Date())}.\n\n${abschnitte.join('\n\n')}`
}

export function alsCsv(stand: AppDatenstand): string {
  const kopf = ['Charge', 'Zeitpunkt', 'Messgröße', 'Wert', 'Methode', 'Notiz'].map(csvFeld).join(';')
  const zeilen = stand.messungen.sort((a, b) => a.zeit.localeCompare(b.zeit)).map(messung => {
    const charge = stand.chargen.find(eintrag => eintrag.id === messung.chargeId)
    return [charge?.name ?? messung.chargeId, deDatum.format(new Date(messung.zeit)), messung.typ, messwert(messung), messung.methode ?? '', messung.notiz ?? ''].map(csvFeld).join(';')
  })
  return `\uFEFF${[kopf, ...zeilen].join('\r\n')}`
}

function blobAlsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Foto konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

export async function alsSicherung(stand: AppDatenstand, fotos: Foto[]): Promise<Sicherung> {
  return {
    schema: 'weinbegleiter-v1',
    exportiert: new Date().toISOString(),
    datenstand: stand,
    fotos: await Promise.all(fotos.map(async foto => ({
      id: foto.id,
      zeit: foto.zeit,
      chargeId: foto.chargeId,
      typ: foto.blob.type || 'application/octet-stream',
      datei: await blobAlsDataUrl(foto.blob),
    }))),
  }
}

export function istSicherung(wert: unknown): wert is Sicherung {
  if (!wert || typeof wert !== 'object') return false
  const kandidat = wert as Partial<Sicherung>
  return kandidat.schema === 'weinbegleiter-v1' && Boolean(kandidat.datenstand) && Array.isArray(kandidat.fotos)
}

export function fotoAusSicherung(foto: Sicherung['fotos'][number]): Foto {
  const [kopf, basis64 = ''] = foto.datei.split(',', 2)
  const typ = /data:([^;]+)/.exec(kopf ?? '')?.[1] ?? foto.typ
  const binaer = atob(basis64)
  const bytes = Uint8Array.from(binaer, zeichen => zeichen.charCodeAt(0))
  return { id: foto.id, zeit: foto.zeit, chargeId: foto.chargeId, blob: new Blob([bytes], { type: typ }) }
}

export function ladeDatei(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(wert: number): Uint8Array {
  return Uint8Array.of(wert & 255, (wert >>> 8) & 255)
}

function u32(wert: number): Uint8Array {
  return Uint8Array.of(wert & 255, (wert >>> 8) & 255, (wert >>> 16) & 255, (wert >>> 24) & 255)
}

function verbinde(teile: Uint8Array[]): Uint8Array {
  const ausgabe = new Uint8Array(teile.reduce((summe, teil) => summe + teil.length, 0))
  let offset = 0
  teile.forEach(teil => { ausgabe.set(teil, offset); offset += teil.length })
  return ausgabe
}

export function baueZip(dateien: Array<{ name: string; daten: Uint8Array }>): Blob {
  const encoder = new TextEncoder()
  const lokaleTeile: Uint8Array[] = []
  const zentraleTeile: Uint8Array[] = []
  let offset = 0
  for (const datei of dateien) {
    const name = encoder.encode(datei.name)
    const crc = crc32(datei.daten)
    const lokal = verbinde([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(datei.daten.length), u32(datei.daten.length), u16(name.length), u16(0), name, datei.daten])
    lokaleTeile.push(lokal)
    zentraleTeile.push(verbinde([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(datei.daten.length), u32(datei.daten.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]))
    offset += lokal.length
  }
  const zentral = verbinde(zentraleTeile)
  const ende = verbinde([u32(0x06054b50), u16(0), u16(0), u16(dateien.length), u16(dateien.length), u32(zentral.length), u32(offset), u16(0)])
  const bytes = verbinde([...lokaleTeile, zentral, ende])
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: 'application/zip' })
}
