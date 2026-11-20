'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { cardAltText, cardStatus, createCard, layoutCard, renderCardSvg } from '@/core/card'
import type { CardSettings } from '@/core/card'
import { allowedInks, CARD_FORMAT_IDS, CARD_FORMATS, CARD_TEMPLATES, getTemplate } from '@/core/card-templates'
import { getCharset } from '@/core/charsets'
import { compileFont, createGlyphCache } from '@/core/font'
import { MAX_TEXT_LENGTH, setCard, setText, shuffleCard, startQueue, textMissing } from '@/core/project'
import type { Card } from '@/core/types'
import { cardPng, download, shareOrDownload } from '@/lib/card-canvas'
import { saveLabels, useSession } from '@/lib/use-session'
import { signs } from './TextStyle'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const pill = `h-10 rounded-full px-3 text-sm font-medium ring-1 ring-ink/15 disabled:opacity-35 ${focusRing}`
const primary = `min-h-12 flex-1 rounded-full bg-accent px-3 text-base font-medium text-white disabled:opacity-35 ${focusRing}`
const secondary = `min-h-12 rounded-full bg-white px-4 text-base font-medium ring-1 ring-ink/15 disabled:opacity-35 ${focusRing}`

const problemText = {
  empty: 'Ieraksti apsveikuma tekstu.',
  'too-long': 'Teksts neietilpst ar salasāmu burtu izmēru. Saīsini to vai izvēlies garāku formātu.',
} as const

type Png = { card: Card; blob: Blob }

/**
 * Kartītes redaktors (PRD 4. sadaļas 8. un 9. solis): teksts, fons, formāts, tinte, līdzinājums,
 * "Sajaukt" un nosūtīšana kā attēls. Kartīti zīmējam paši (core/card.ts): priekšskatījums ir SVG,
 * attēls ir tas pats izkārtojums uz canvas. Neuzrakstīta zīme bloķē sūtīšanu, un "Uzrakstīt"
 * atver rakstīšanu tieši tām zīmēm; pēc tam atgriežas šeit.
 */
export function CardEditor() {
  const { session, saveState, update, flushed } = useSession()
  const router = useRouter()
  const [cache] = useState(createGlyphCache)
  const [id] = useState(() => crypto.randomUUID())
  const [png, setPng] = useState<Png | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const charset = getCharset('lv')
  const project = useDeferredValue(session?.project ?? null)
  const font = useMemo(() => (project ? compileFont(project, cache) : null), [project, cache])
  const text = session?.text ?? ''
  const settings = session?.card ?? null

  const card = useMemo(
    () => (font && settings ? createCard({ id, text, settings, font, charset }) : null),
    [font, settings, text, id, charset],
  )
  const view = useMemo(() => {
    if (!card) return null
    const placed = layoutCard(card, charset)
    return { placed, status: cardStatus(placed), svg: renderCardSvg(card, charset, { idPrefix: 'kartite' }) }
  }, [card, charset])

  const shareable = view?.status.shareable ?? false
  // Attēlu sagatavo iepriekš, lai Share izsauktu tieši no pieskāriena (iOS to prasa).
  useEffect(() => {
    if (!card || !shareable) return
    let cancelled = false
    const timer = setTimeout(() => {
      void cardPng(card, charset).then(
        (blob) => {
          if (!cancelled) setPng({ card, blob })
        },
        () => undefined,
      )
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [card, shareable, charset])

  if (!session || !font || !card || !view || !settings) {
    return (
      <main className="flex h-dvh items-center justify-center">
        <p className="text-ink/60">Ielādē…</p>
      </main>
    )
  }

  const template = getTemplate(settings.templateId)!
  const inks = allowedInks(template)
  const missing = textMissing(session.project, text)
  const { problem } = view.status
  const alt = cardAltText(card, charset)
  const change = (patch: Partial<CardSettings>) => update((s) => setCard(s, patch))

  async function imageFor(target: Card): Promise<Blob> {
    return png?.card === target ? png.blob : cardPng(target, charset)
  }

  async function send() {
    if (!shareable || !card) return
    setBusy(true)
    setNotice('')
    try {
      const result = await shareOrDownload(await imageFor(card), 'Apsveikums')
      if (result === 'downloaded') setNotice('Attēls lejupielādēts. Pievieno to ziņai kā fotoattēlu.')
    } catch {
      setNotice('Neizdevās izveidot attēlu.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!shareable || !card) return
    setBusy(true)
    try {
      download(await imageFor(card))
      setNotice('Attēls lejupielādēts.')
    } catch {
      setNotice('Neizdevās izveidot attēlu.')
    } finally {
      setBusy(false)
    }
  }

  function writeMissing() {
    update((s) => startQueue(s, missing.writable, 'card'))
    void flushed().then(() => router.push('/raksti'))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-3">
      <header className="flex items-center justify-between gap-2 text-sm text-ink/60">
        <Link href="/raksti" className="underline underline-offset-4">
          Burti
        </Link>
        <h1 className="text-lg font-semibold text-ink">Kartīte</h1>
        <p role="status" data-testid="save-state" data-state={saveState} className="text-xs text-ink/50">
          {saveLabels[saveState]}
        </p>
      </header>

      <div
        data-testid="card"
        data-format={settings.format}
        data-template={settings.templateId}
        data-ink={settings.ink}
        data-align={settings.align}
        data-seed={settings.seed}
        data-em={view.placed.emPx}
        data-glyphs={view.placed.layout.glyphs.length}
        data-missing={view.placed.layout.missing.length}
        data-png={png?.card === card ? png.blob.size : ''}
        className="mx-auto w-full overflow-hidden rounded-lg shadow-md ring-1 ring-ink/10 [&>svg]:h-full [&>svg]:w-full"
        style={{
          aspectRatio: `${view.placed.width} / ${view.placed.height}`,
          maxHeight: '52dvh',
          maxWidth: `calc(52dvh * ${view.placed.width} / ${view.placed.height})`,
        }}
        // SVG virkni ģenerē mūsu pašu core/card.ts; teksts tajā ir tikai kā izvairīts atribūts.
        dangerouslySetInnerHTML={{ __html: view.svg }}
      />

      <div data-testid="card-status" data-problem={problem ?? ''} aria-live="polite">
        {problem === 'missing' && missing.writable.length > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-accent/10 px-3 py-2">
            <p className="min-w-0 text-sm">
              <span className="font-medium">Trūkst {signs(missing.writable.length)}:</span>{' '}
              <span lang="lv" className="tracking-wider">
                {missing.writable.join(' ')}
              </span>
            </p>
            <button
              type="button"
              className={`h-9 shrink-0 rounded-full bg-accent px-3 text-sm font-medium text-white ${focusRing}`}
              onClick={writeMissing}
            >
              Uzrakstīt
            </button>
          </div>
        ) : null}
        {missing.unsupported.length > 0 ? (
          <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm">
            Šīs zīmes nav rakstzīmju kopā, izņem tās no teksta: {missing.unsupported.join(' ')}
          </p>
        ) : null}
        {problem === 'empty' || problem === 'too-long' ? (
          <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm">{problemText[problem]}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button type="button" className={primary} disabled={!shareable || busy} onClick={send}>
          Sūtīt kā attēlu
        </button>
        <button type="button" className={secondary} disabled={!shareable || busy} onClick={save} aria-label="Lejupielādēt attēlu">
          Lejupielādēt
        </button>
      </div>
      {notice ? (
        <p data-testid="notice" className="-mt-2 text-center text-sm text-ink/70">
          {notice}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Apsveikuma teksts
        <textarea
          data-testid="card-text"
          rows={3}
          maxLength={MAX_TEXT_LENGTH}
          value={text}
          placeholder="Daudz laimes dzimšanas dienā!"
          onChange={(event) => update((s) => setText(s, event.target.value))}
          lang="lv"
          className={`resize-none rounded-lg bg-white px-3 py-2 text-base font-normal ring-1 ring-ink/15 ${focusRing}`}
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`${pill} bg-white`}
          onClick={() => update(shuffleCard)}
          title="Cita burtu variantu secība un trice"
        >
          Sajaukt
        </button>
        <div role="group" aria-label="Līdzinājums" className="ml-auto flex gap-1.5">
          {(
            [
              ['left', 'Pa kreisi'],
              ['center', 'Centrā'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={settings.align === value}
              className={`${pill} ${settings.align === value ? 'bg-ink text-white' : 'bg-white'}`}
              onClick={() => change({ align: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">Formāts</legend>
        <div className="flex gap-1.5">
          {CARD_FORMAT_IDS.map((format) => {
            const spec = CARD_FORMATS[format]
            return (
              <button
                key={format}
                type="button"
                aria-pressed={settings.format === format}
                className={`${pill} flex-1 ${settings.format === format ? 'bg-ink text-white' : 'bg-white'}`}
                onClick={() => change({ format })}
              >
                {spec.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">Fons</legend>
        <div className="grid grid-cols-4 gap-2">
          {CARD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={settings.templateId === t.id}
              data-testid="template"
              data-template={t.id}
              className={`flex h-14 flex-col items-center justify-center rounded-lg text-xs font-medium ${focusRing} ${
                settings.templateId === t.id ? 'ring-3 ring-accent' : 'ring-1 ring-ink/15'
              }`}
              style={{ background: t.background, color: t.ink }}
              onClick={() => change({ templateId: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">Tinte</legend>
        <div className="flex flex-wrap gap-2">
          {inks.map((ink) => (
            <button
              key={ink.hex}
              type="button"
              aria-pressed={settings.ink === ink.hex}
              aria-label={ink.label}
              title={ink.label}
              data-testid="ink"
              data-ink={ink.hex}
              className={`size-10 rounded-full ${focusRing} ${settings.ink === ink.hex ? 'ring-3 ring-accent ring-offset-2' : 'ring-1 ring-ink/25'}`}
              style={{ background: ink.hex }}
              onClick={() => change({ ink: ink.hex })}
            />
          ))}
        </div>
        <p className="text-xs text-ink/50">Rādītas tikai tintes, kas uz šī fona ir labi salasāmas.</p>
      </fieldset>

      <section aria-label="Attēla apraksts" className="flex flex-col gap-1 pb-6">
        <h2 className="text-sm font-medium">Attēla apraksts (alt teksts)</h2>
        <p data-testid="alt-text" className="rounded-lg bg-white/60 px-3 py-2 text-sm whitespace-pre-line ring-1 ring-ink/10" lang="lv">
          {alt || '—'}
        </p>
        <button
          type="button"
          className={`${pill} self-start bg-white`}
          disabled={!alt}
          onClick={() => {
            void navigator.clipboard?.writeText(alt).then(
              () => setNotice('Apraksts nokopēts.'),
              () => setNotice('Neizdevās nokopēt.'),
            )
          }}
        >
          Kopēt aprakstu
        </button>
        <p className="text-xs text-ink/50">
          Ielīmē to kā attēla aprakstu, lai apsveikumu varētu nolasīt arī ekrāna lasītājs.
        </p>
      </section>
    </main>
  )
}
