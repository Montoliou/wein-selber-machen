import type { Reminder } from './domain/typen'

function icsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function lokalDatum(iso: string): string {
  const datum = new Date(iso)
  const teile = [
    datum.getFullYear().toString().padStart(4, '0'),
    (datum.getMonth() + 1).toString().padStart(2, '0'),
    datum.getDate().toString().padStart(2, '0'),
    'T',
    datum.getHours().toString().padStart(2, '0'),
    datum.getMinutes().toString().padStart(2, '0'),
    datum.getSeconds().toString().padStart(2, '0'),
  ]
  return teile.join('')
}

function utcDatum(datum: Date): string {
  return datum.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function falteZeilen(text: string): string {
  return text.split('\r\n').flatMap(zeile => {
    if (zeile.length <= 73) return [zeile]
    const teile: string[] = []
    let rest = zeile
    while (rest.length > 73) {
      teile.push(rest.slice(0, 73))
      rest = ` ${rest.slice(73)}`
    }
    teile.push(rest)
    return teile
  }).join('\r\n')
}

function ereignis(reminder: Reminder): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${icsText(reminder.id)}@weinbegleiter.local`,
    `DTSTAMP:${utcDatum(new Date())}`,
    `DTSTART:${lokalDatum(reminder.faellig)}`,
    `SUMMARY:${icsText(reminder.titel)}`,
    `DESCRIPTION:${icsText(reminder.beschreibung)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`Erinnerung: ${reminder.titel}`)}`,
    'END:VALARM',
    'END:VEVENT',
  ]
}

export function reminderAlsIcs(reminder: Reminder): string {
  return kalenderAlsIcs([reminder])
}

export function kalenderAlsIcs(reminder: Reminder[]): string {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Weinbegleiter 2026//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Weinbegleiter 2026',
    ...reminder.flatMap(ereignis),
    'END:VCALENDAR',
  ]
  return `${falteZeilen(zeilen.join('\r\n'))}\r\n`
}
