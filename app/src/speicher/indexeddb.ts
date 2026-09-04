import type { Foto } from '../domain/typen'
import { APP_DATEN_VERSION, migriereDatenstand, synchronisiereVolumenspiegel, type AppDatenstand } from './modell'

const DB_NAME = 'weinbegleiter-2026'
const DB_VERSION = 2
const STAND_STORE = 'datenstand'
const FOTO_STORE = 'fotos'
const STAND_KEY = 'aktiv'
const SYNC_SAMMLUNGEN = ['chargen', 'behaelter', 'messungen', 'ereignisse', 'reminder', 'wiki', 'klima', 'vorrat'] as const

function brauchtMigration(stand: AppDatenstand): boolean {
  if (stand.version !== APP_DATEN_VERSION || !Array.isArray(stand.geloescht) || !stand.sensor.zuletztGeaendert) return true
  return SYNC_SAMMLUNGEN.some(sammlung => stand[sammlung].some(datensatz =>
    !datensatz.id || !datensatz.zuletztGeaendert))
}

function oeffneDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION)
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result
      if (!db.objectStoreNames.contains(STAND_STORE)) db.createObjectStore(STAND_STORE)
      if (!db.objectStoreNames.contains(FOTO_STORE)) db.createObjectStore(FOTO_STORE, { keyPath: 'id' })
    }
    anfrage.onsuccess = () => resolve(anfrage.result)
    anfrage.onerror = () => reject(anfrage.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'))
  })
}

function anfrageAlsPromise<T>(anfrage: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    anfrage.onsuccess = () => resolve(anfrage.result)
    anfrage.onerror = () => reject(anfrage.error ?? new Error('IndexedDB-Vorgang fehlgeschlagen.'))
  })
}

export async function ladeDatenstand(): Promise<AppDatenstand | null> {
  const db = await oeffneDb()
  let stand: AppDatenstand | undefined
  try {
    const tx = db.transaction(STAND_STORE, 'readonly')
    stand = await anfrageAlsPromise(tx.objectStore(STAND_STORE).get(STAND_KEY) as IDBRequest<AppDatenstand | undefined>)
  } finally {
    db.close()
  }
  if (!stand) return null
  const migriert = migriereDatenstand(stand)
  if (brauchtMigration(stand)) await speichereDatenstand(migriert)
  return migriert
}

export async function speichereDatenstand(stand: AppDatenstand): Promise<void> {
  synchronisiereVolumenspiegel(stand)
  const db = await oeffneDb()
  try {
    const tx = db.transaction(STAND_STORE, 'readwrite')
    tx.objectStore(STAND_STORE).put({ ...stand, version: APP_DATEN_VERSION }, STAND_KEY)
    await transaktionFertig(tx)
  } finally {
    db.close()
  }
}

export async function speichereFoto(foto: Foto): Promise<void> {
  const db = await oeffneDb()
  try {
    const tx = db.transaction(FOTO_STORE, 'readwrite')
    tx.objectStore(FOTO_STORE).put(foto)
    await transaktionFertig(tx)
  } finally {
    db.close()
  }
}

export async function ladeFotos(): Promise<Foto[]> {
  const db = await oeffneDb()
  try {
    const tx = db.transaction(FOTO_STORE, 'readonly')
    return await anfrageAlsPromise(tx.objectStore(FOTO_STORE).getAll() as IDBRequest<Foto[]>)
  } finally {
    db.close()
  }
}

export async function ersetzeFotos(fotos: Foto[]): Promise<void> {
  const db = await oeffneDb()
  try {
    const tx = db.transaction(FOTO_STORE, 'readwrite')
    const store = tx.objectStore(FOTO_STORE)
    store.clear()
    fotos.forEach(foto => store.put(foto))
    await transaktionFertig(tx)
  } finally {
    db.close()
  }
}

function transaktionFertig(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen.'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Transaktion wurde abgebrochen.'))
  })
}
