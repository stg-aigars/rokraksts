'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@/core/project'
import { loadSession, saveSession } from './project-store'

export type SaveState = 'saved' | 'saving' | 'error'

export const saveLabels: Record<SaveState, string> = {
  saved: 'Saglabāts šajā ierīcē',
  saving: 'Saglabā…',
  error: 'Neizdevās saglabāt šajā ierīcē',
}

/**
 * Sesija no IndexedDB (lib/project-store.ts) un tās maiņa. Katra izmaiņa tiek saglabāta; ieraksti
 * iet viens aiz otra, lai vecāks stāvoklis nepārrakstītu jaunāku. Lieto rakstīšana un kartītes
 * redaktors; abi strādā ar vienu un to pašu sesiju.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const latest = useRef<Session | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    void loadSession().then((loaded) => {
      if (cancelled) return
      latest.current = loaded
      setSession(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function update(change: (session: Session) => Session) {
    const before = latest.current
    if (!before) return
    const next = change(before)
    if (next === before) return
    latest.current = next
    setSession(next)
    setSaveState('saving')
    queue.current = queue.current
      .then(() => saveSession(next))
      .then(
        () => {
          if (latest.current === next) setSaveState('saved')
        },
        () => setSaveState('error'),
      )
  }

  /** Gaida, līdz visi ieraksti pabeigti (pirms pārejas uz citu lapu). */
  function flushed(): Promise<void> {
    return queue.current.catch(() => undefined)
  }

  return { session, saveState, update, flushed }
}
