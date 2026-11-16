'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { getCharset } from '@/core/charsets'
import {
  addStroke,
  addVariant,
  baseChar,
  canAddVariant,
  canDeleteVariant,
  canGoBack,
  canGoNext,
  canStartLap,
  clearStrokes,
  currentStrokes,
  deleteVariant,
  endLap,
  ghostStrokes,
  goBack,
  goNext,
  progress,
  selectVariant,
  startLap,
  toggleGhost,
  undoStroke,
  variantCount,
} from '@/core/project'
import type { Session } from '@/core/project'
import { loadSession, saveSession } from '@/lib/project-store'
import { DrawPad } from './DrawPad'
import { Preview } from './Preview'

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

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const chip = `size-9 shrink-0 rounded-full text-sm font-medium ring-1 ring-ink/15 disabled:opacity-35 ${focusRing}`
const small = `h-9 shrink-0 rounded-full px-3 text-sm font-medium ring-1 ring-ink/15 disabled:opacity-35 ${focusRing}`

/**
 * Burtu rakstīšana pēc kārtas (PRD 4. sadaļas 3. un 5. solis); stāvoklis glabājas IndexedDB.
 * Variantus pievieno, pārzīmē un dzēš turpat zem uzvednes: pogas "1 2 3" atver variantu,
 * "+" pievieno jaunu, Notīrīt un rakstīšana no jauna to pārzīmē, "Dzēst variantu" izņem.
 */
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
  const count = variantCount(session)
  // Atvērts jauns, vēl tukšs variants: tam ir sava poga saraksta vietā `session.variant`.
  const slots = count + (session.fresh ? 1 : 0)
  const base = baseChar(session)
  const baseWritten = base !== undefined && session.project.glyphs[base] !== undefined
  const lapOffered = canStartLap(session)

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

      <div className="flex items-center gap-2">
        <div role="group" aria-label="Varianti" data-testid="variants" data-count={count} className="flex gap-1.5">
          {Array.from({ length: slots }, (_, i) => {
            const open = i === session.variant
            const empty = session.fresh && open
            return (
              <button
                key={i}
                type="button"
                aria-label={empty ? `${i + 1}. variants (jauns)` : `${i + 1}. variants`}
                aria-pressed={open}
                className={`${chip} ${open ? 'bg-ink text-white' : 'bg-white'} ${empty ? 'border-2 border-dashed border-white/70' : ''}`}
                // Tukšais jaunais variants projektā vēl nav: varianti aiz tā ir par vienu vietu agrāk.
                onClick={() => {
                  if (!empty) update((s) => selectVariant(s, i - (session.fresh && i > session.variant ? 1 : 0)))
                }}
              >
                {i + 1}
              </button>
            )
          })}
          {canAddVariant(session) ? (
            <button type="button" aria-label="Pievienot variantu" className={`${chip} bg-white`} onClick={() => update(addVariant)}>
              +
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className={`${small} bg-white`}
          disabled={!canDeleteVariant(session)}
          onClick={() => update(deleteVariant)}
        >
          Dzēst variantu
        </button>
        {base !== undefined ? (
          <button
            type="button"
            aria-pressed={session.ghost && baseWritten}
            disabled={!baseWritten}
            className={`${small} ml-auto ${session.ghost && baseWritten ? 'bg-ink text-white' : 'bg-white'}`}
            onClick={() => update(toggleGhost)}
          >
            Paraugs: {base}
          </button>
        ) : null}
      </div>

      {session.lap || lapOffered ? (
        <div data-testid="lap" data-active={session.lap} className="flex items-center justify-between gap-2 text-sm">
          <p className="min-w-0 text-ink/70">
            {session.lap ? 'Raksti burtus vēlreiz, lai tie tekstā nebūtu vienādi.' : 'Alfabēts gatavs! Gribi dabiskāku rakstu?'}
          </p>
          <button
            type="button"
            className={`${small} ${session.lap ? 'bg-white' : 'bg-accent text-white ring-0'}`}
            onClick={() => update(session.lap ? endLap : startLap)}
          >
            {session.lap ? 'Beigt apli' : 'Uzraksti vēlreiz'}
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
        <DrawPad
          key={`${char}/${session.variant}`}
          strokes={strokes}
          ghost={ghostStrokes(session)}
          onStroke={(stroke) => update((s) => addStroke(s, stroke))}
          label={`Zīmēšanas laukums: ${charset.prompt(char)}`}
        />
      </div>

      <Preview project={session.project} />

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
