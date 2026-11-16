import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import { createSession, normalizeSession } from '@/core/project'
import type { Session } from '@/core/project'
import { parseSession } from '@/core/schema'

// Lokālā glabātuve (PRD 9. un 10. sadaļa): rokraksts paliek ierīcē, IndexedDB.

const DB_NAME = 'rokraksts'
const STORE = 'session'
const KEY = 'current'

interface RokrakstsDB extends DBSchema {
  [STORE]: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<RokrakstsDB>> | null = null

function db(): Promise<IDBPDatabase<RokrakstsDB>> {
  dbPromise ??= openDB<RokrakstsDB>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE)
    },
  })
  return dbPromise
}

/** Ielādē saglabāto sesiju; ja tās nav vai tā neatbilst shēmai, sāk jaunu. */
export async function loadSession(): Promise<Session> {
  try {
    const stored = parseSession(await (await db()).get(STORE, KEY))
    if (stored) return normalizeSession(stored)
  } catch {
    // IndexedDB nav pieejama (piemēram, privātais režīms): strādājam bez glabāšanas.
  }
  return createSession(crypto.randomUUID(), new Date().toISOString())
}

export async function saveSession(session: Session): Promise<void> {
  await (await db()).put(STORE, session, KEY)
}
