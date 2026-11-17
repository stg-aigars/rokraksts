'use client'

import type { Charset } from '@/core/charsets'
import type { CompiledFont } from '@/core/font'
import { MAX_TEXT_LENGTH, textMissing } from '@/core/project'
import { STYLE_LIMITS } from '@/core/style'
import type { FontProject, FontStyle } from '@/core/types'
import { Preview } from './Preview'

type Props = {
  project: FontProject
  font: CompiledFont
  charset: Charset
  text: string
  onText: (text: string) => void
  onStyle: (patch: Partial<FontStyle>) => void
  /** Atvērt rakstīšanu tieši šīm zīmēm. */
  onWriteMissing: (chars: string[]) => void
  onPick: (char: string, variant: number) => void
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** "1 zīme", "2 zīmes", "11 zīmes", "21 zīme": latviešu valodā skaitļiem, kas beidzas ar 1 (bet ne 11), vienskaitlis. */
export function signs(count: number): string {
  return count % 10 === 1 && count % 100 !== 11 ? `${count} zīme` : `${count} zīmes`
}

type Slider = { key: keyof FontStyle; label: string; format: (value: number) => string }

const sliders: Slider[] = [
  { key: 'strokeWidth', label: 'Līnijas biezums', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'spacing', label: 'Burtu atstarpes', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'scale', label: 'Izmērs', format: (v) => `${Math.round(v * 100)}%` },
  // Slīpums glabājas kā tangenss; saskarnē rādām aptuvenos grādus.
  { key: 'slant', label: 'Slīpums', format: (v) => `${Math.round((Math.atan(v) * 180) / Math.PI)}°` },
]

/**
 * Lietotāja teksts un fonta stils (PRD 4. sadaļas 4. un 7. solis). Priekšskatījums uzreiz rāda
 * tekstu ar pašreizējo stilu. Ja tekstā ir neuzrakstītas zīmes, tās nosauc un piedāvā uzrakstīt;
 * tās nekad netiek aizstātas ar citu burtu.
 */
export function TextStyle({ project, font, charset, text, onText, onStyle, onWriteMissing, onPick }: Props) {
  const shown = text || charset.sampleText
  const missing = textMissing(project, shown)

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tavs teksts
        <textarea
          data-testid="text-input"
          rows={2}
          maxLength={MAX_TEXT_LENGTH}
          value={text}
          placeholder={charset.sampleText}
          onChange={(event) => onText(event.target.value)}
          lang="lv"
          className={`resize-none rounded-lg bg-white px-3 py-2 text-base font-normal ring-1 ring-ink/15 ${focusRing}`}
        />
      </label>

      <Preview
        font={font}
        charset={charset}
        text={shown}
        lineWidth={6000}
        idPrefix="teksts"
        className=""
        fit="width"
        onPick={onPick}
      />
      <p className="-mt-2 text-center text-xs text-ink/50">Pieskaries burtam, lai to pārrakstītu.</p>

      {missing.writable.length > 0 ? (
        <div
          data-testid="missing"
          data-count={missing.writable.length}
          className="flex items-center justify-between gap-2 rounded-xl bg-accent/10 px-3 py-2"
        >
          <p className="min-w-0 text-sm">
            <span className="font-medium">Trūkst {signs(missing.writable.length)}:</span>{' '}
            <span lang="lv" className="tracking-wider">
              {missing.writable.join(' ')}
            </span>
          </p>
          <button
            type="button"
            className={`h-9 shrink-0 rounded-full bg-accent px-3 text-sm font-medium text-white ${focusRing}`}
            onClick={() => onWriteMissing(missing.writable)}
          >
            Uzrakstīt
          </button>
        </div>
      ) : null}
      {missing.unsupported.length > 0 ? (
        <p data-testid="unsupported" className="text-xs text-ink/60">
          Šīs zīmes nav rakstzīmju kopā, tāpēc tās uzrakstīt nevar: {missing.unsupported.join(' ')}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Stils</legend>
        {sliders.map(({ key, label, format }) => {
          const limit = STYLE_LIMITS[key]
          const value = project.style[key]
          return (
            <label key={key} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
              <span>{label}</span>
              <input
                type="range"
                data-testid={`style-${key}`}
                min={limit.min}
                max={limit.max}
                step={limit.step}
                value={value}
                onChange={(event) => onStyle({ [key]: Number(event.target.value) })}
                className="accent-accent"
              />
              <output className="text-right text-ink/60 tabular-nums">{format(value)}</output>
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}
