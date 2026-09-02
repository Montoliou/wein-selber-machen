import type { Datenstand } from '../domain/typen'

export const APP_DATEN_VERSION = 1

export interface AppMeta {
  chargenMengenKg: Record<string, number>
  elternChargeIds: Record<string, string[]>
}

export interface AppDatenstand extends Datenstand {
  appMeta: AppMeta
}

export function istAppDatenstand(wert: unknown): wert is AppDatenstand {
  if (!wert || typeof wert !== 'object') return false
  const kandidat = wert as Partial<AppDatenstand>
  return typeof kandidat.version === 'number'
    && typeof kandidat.jahrgang === 'number'
    && Array.isArray(kandidat.chargen)
    && Array.isArray(kandidat.behaelter)
    && Array.isArray(kandidat.messungen)
    && Array.isArray(kandidat.ereignisse)
    && Array.isArray(kandidat.reminder)
    && Array.isArray(kandidat.wiki)
    && Array.isArray(kandidat.klima)
    && Array.isArray(kandidat.vorrat)
    && Boolean(kandidat.sensor)
}

export function migriereDatenstand(stand: AppDatenstand): AppDatenstand {
  return {
    ...stand,
    version: APP_DATEN_VERSION,
    appMeta: stand.appMeta ?? { chargenMengenKg: {}, elternChargeIds: {} },
  }
}
