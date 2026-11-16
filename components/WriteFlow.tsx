'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { getCharset } from '@/core/charsets'
import {
  addStroke,
  canGoBack,
  canGoNext,
  clearStrokes,
  currentStrokes,
  goBack,
  goNext,
  progress,
  undoStroke,
} from '@/core/project'
import type { Session } from '@/core/project'
import { loadSession, saveSession } from '@/lib/project-store'
import { DrawPad } from './DrawPad'

type SaveState = 'saved' | 'saving' | 'error'

const saveLabels: Record<SaveState, string> = {
  saved: 'Saglabāts šajā ierīcē',
  saving: 'Saglabā…',
  error: 'Neizdevās saglabāt šajā ierīcē',
}

const buttonBase =
  'min-h-12 flex-1 rounded-full px-2 text-base font-medium disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const secondary = `${buttonBase} bg-white ring-1 ring-ink/15`
const primary = `${buttonBase} bg-accent text-white`

/** Burtu rakstīšana pēc kārtas (PRD 4. sadaļas 3. solis); stāvoklis glabājas IndexedDB. */
export function WriteFlow() {
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
    // Ieraksti iet viens aiz otra, lai vecāks stāvoklis nepārrakstītu jaunāku.
    queue.current = queue.current
      .then(() => saveSession(next))
      .then(
        () => {
          if (latest.current === next) setSaveState('saved')
        },
        () => setSaveState('error'),
      )
  }

  if (!session) {
    return (
      <main className="flex h-dvh items-center justify-center">
        <p className="text-ink/60">Ielādē…</p>
      </main>
    )
  }

  const charset = getCharset(session.project.charset)
  const char = session.current
  const strokes = currentStrokes(session)
  const { done, total } = progress(session)
  const group = charset.groups.find((g) => g.chars.includes(char))

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col gap-3 overflow-hidden px-4 py-3">
      <header className="flex items-baseline justify-between text-sm text-ink/60">
        <Link href="/" className="underline underline-offset-4">
          Sākums
        </Link>
        <p>
          <span data-testid="progress">
            {done} no {total}
          </span>
          {group ? ` · ${group.label}` : null}
        </p>
      </header>

      <h1 className="text-center text-2xl font-semibold" lang="lv">
        {charset.prompt(char)}
      </h1>

      <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
        <DrawPad
          key={char}
          strokes={strokes}
          onStroke={(stroke) => update((s) => addStroke(s, stroke))}
          label={`Zīmēšanas laukums: ${charset.prompt(char)}`}
        />
      </div>

      <div className="flex gap-2">
        <button type="button" className={secondary} disabled={!canGoBack(session)} onClick={() => update(goBack)}>
          Atpakaļ
        </button>
        <button type="button" className={secondary} disabled={strokes.length === 0} onClick={() => update(undoStroke)}>
          Atsaukt
        </button>
        <button type="button" className={secondary} disabled={strokes.length === 0} onClick={() => update(clearStrokes)}>
          Notīrīt
        </button>
        <button type="button" className={primary} disabled={!canGoNext(session)} onClick={() => update(goNext)}>
          Tālāk
        </button>
      </div>

      <p role="status" data-testid="save-state" data-state={saveState} className="text-center text-xs text-ink/50">
        {saveLabels[saveState]}
      </p>
    </main>
  )
}
