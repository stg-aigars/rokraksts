'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeferredValue, useMemo, useState } from 'react'
import { getCharset } from '@/core/charsets'
import { compileFont, createGlyphCache } from '@/core/font'
import {
  addStroke,
  addVariant,
  canAddVariant,
  canDeleteVariant,
  canGoBack,
  canGoNext,
  canStartLap,
  clearStrokes,
  currentStrokes,
  deleteVariant,
  endLap,
  endQueue,
  ghostOn,
  guideStrokes,
  hasCursiveGuide,
  goBack,
  goNext,
  hasGuide,
  openChar,
  previewText,
  progress,
  queuePosition,
  selectVariant,
  setStyle,
  setText,
  startLap,
  startQueue,
  toggleGhost,
  toggleGuideStyle,
  undoStroke,
  variantCount,
} from '@/core/project'
import { saveLabels, useSession } from '@/lib/use-session'
import { DrawPad } from './DrawPad'
import { GlyphGrid } from './GlyphGrid'
import { Preview } from './Preview'
import { TextStyle } from './TextStyle'

/** Rakstīšana, pārskats pār visām zīmēm vai teksts un stils. */
type View = 'write' | 'grid' | 'text'

const buttonBase =
  'min-h-12 flex-1 rounded-full px-2 text-base font-medium disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const secondary = `${buttonBase} bg-white ring-1 ring-ink/15`
const primary = `${buttonBase} bg-accent text-white`

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const chip = `size-9 shrink-0 rounded-full text-sm font-medium ring-1 ring-ink/15 disabled:opacity-35 ${focusRing}`
const small = `h-9 shrink-0 rounded-full px-3 text-sm font-medium ring-1 ring-ink/15 disabled:opacity-35 ${focusRing}`

/**
 * Burtu rakstīšana (PRD 4. sadaļas 3.–7. solis); stāvoklis glabājas IndexedDB.
 * Variantus pievieno, pārzīmē un dzēš turpat zem uzvednes: pogas "1 2 3" atver variantu,
 * "+" pievieno jaunu, Notīrīt un rakstīšana no jauna to pārzīmē, "Dzēst" izņem. "Paraugs" ieslēdz blāvo paraugu,
 * "Rakstītie" maina tā formu no drukātajiem uz rakstītajiem burtiem.
 * Burtu var izlaist. "Visas zīmes" ir pārskats pār visu kopu, "Teksts un stils" ir savs teksts,
 * trūkstošās zīmes un stils. Pieskāriens glifam priekšskatījumā vai režģī atver to pārzīmēšanai.
 */
export function WriteFlow() {
  const { session, saveState, update, flushed } = useSession()
  const router = useRouter()
  const [view, setView] = useState<View>('write')
  const [cache] = useState(createGlyphCache)
  // Kontūras pārrēķina no vilcieniem ar pašreizējo stilu. Atlikta vērtība ļauj slīdnim un
  // laukumam palikt atsaucīgiem, kamēr stila maiņa pārrēķina visus glifus.
  const project = useDeferredValue(session?.project ?? null)
  const font = useMemo(() => (project ? compileFont(project, cache) : null), [project, cache])

  if (!session || !font) {
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
  const count = variantCount(session)
  const position = queuePosition(session)
  const lastInQueue = position !== null && position.index === position.total - 1
  const nextLabel = count === 0 ? 'Izlaist' : lastInQueue ? 'Gatavs' : 'Tālāk'

  /** Pēc trūkstošo zīmju rindas: atpakaļ uz kartīti vai teksta skatu, no kurienes rinda sākās. */
  function afterQueue() {
    if (session!.queueReturn === 'card') void flushed().then(() => router.push('/kartite'))
    else setView('text')
  }

  /** Atver rakstzīmi (un variantu) rakstīšanai no režģa vai priekšskatījuma. */
  function open(target: string, variant = 0) {
    update((s) => openChar(s, target, variant))
    setView('write')
  }

  // Telefonā galvenē ir maz vietas: redzamais teksts var būt īsāks par pieejamības nosaukumu.
  const viewButton = (target: View, label: string, short = label) => (
    <button
      type="button"
      aria-label={short === label ? undefined : label}
      aria-pressed={view === target}
      className={`${small} ${view === target ? 'bg-ink text-white' : 'bg-white'}`}
      onClick={() => setView(view === target ? 'write' : target)}
    >
      {short}
    </button>
  )

  const header = (
    <header className="flex items-center justify-between gap-2 text-sm text-ink/60">
      <Link href="/" className="underline underline-offset-4">
        Sākums
      </Link>
      <span data-testid="progress" className="whitespace-nowrap tabular-nums">
        {done} no {total}
      </span>
      <div className="flex gap-1.5">
        <Link href="/kartite" className={`${small} flex items-center bg-white`}>
          Kartīte
        </Link>
        {viewButton('grid', 'Visas zīmes')}
        {viewButton('text', 'Teksts un stils', 'Teksts')}
      </div>
    </header>
  )

  const saveStatus = (
    <p role="status" data-testid="save-state" data-state={saveState} className="text-center text-xs text-ink/50">
      {saveLabels[saveState]}
    </p>
  )

  if (view !== 'write') {
    return (
      <main className="mx-auto flex h-dvh max-w-md flex-col gap-3 overflow-hidden px-4 py-3">
        {header}
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {view === 'grid' ? (
            <GlyphGrid charset={charset} font={font} current={char} onOpen={(c) => open(c)} />
          ) : (
            <TextStyle
              project={session.project}
              font={font}
              charset={charset}
              text={session.text}
              onText={(text) => update((s) => setText(s, text))}
              onStyle={(patch) => update((s) => setStyle(s, patch))}
              onWriteMissing={(chars) => {
                update((s) => startQueue(s, chars))
                setView('write')
              }}
              onPick={open}
            />
          )}
        </div>
        <button type="button" className={primary + ' flex-none'} onClick={() => setView('write')}>
          Rakstīt burtus
        </button>
        {saveStatus}
      </main>
    )
  }
  // Atvērts jauns, vēl tukšs variants: tam ir sava poga saraksta vietā `session.variant`.
  const slots = count + (session.fresh ? 1 : 0)
  const lapOffered = canStartLap(session)

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col gap-3 overflow-hidden px-4 py-3">
      {header}

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
          aria-label="Dzēst variantu"
          disabled={!canDeleteVariant(session)}
          onClick={() => update(deleteVariant)}
        >
          Dzēst
        </button>
        {hasGuide(session) ? (
          <button
            type="button"
            aria-pressed={ghostOn(session)}
            className={`${small} ml-auto ${ghostOn(session) ? 'bg-ink text-white' : 'bg-white'}`}
            onClick={() => update(toggleGhost)}
          >
            Paraugs
          </button>
        ) : null}
        {ghostOn(session) && hasCursiveGuide(session) ? (
          <button
            type="button"
            aria-pressed={session.guideStyle === 'cursive'}
            title="Parauga forma: rakstītie (skolas raksts) vai drukātie burti"
            className={`${small} ${session.guideStyle === 'cursive' ? 'bg-ink text-white' : 'bg-white'}`}
            onClick={() => update(toggleGuideStyle)}
          >
            Rakstītie
          </button>
        ) : null}
      </div>

      {position ? (
        <div data-testid="queue" className="flex items-center justify-between gap-2 text-sm">
          <p className="min-w-0 text-ink/70">
            Trūkstošās zīmes: {position.index + 1} no {position.total}
          </p>
          <button
            type="button"
            className={`${small} bg-white`}
            onClick={() => {
              update(endQueue)
              afterQueue()
            }}
          >
            Beigt
          </button>
        </div>
      ) : session.lap || lapOffered ? (
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
          guide={guideStrokes(session)}
          onStroke={(stroke) => update((s) => addStroke(s, stroke))}
          label={`Zīmēšanas laukums: ${charset.prompt(char)}`}
        />
      </div>

      <Preview font={font} charset={charset} text={previewText(session)} onPick={open} />

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
        <button
          type="button"
          className={primary}
          disabled={!canGoNext(session)}
          onClick={() => {
            update(goNext)
            // Pēc pēdējās trūkstošās zīmes atgriežas pie teksta, lai redzētu to pilnu.
            if (lastInQueue) afterQueue()
          }}
        >
          {nextLabel}
        </button>
      </div>

      {saveStatus}
    </main>
  )
}
