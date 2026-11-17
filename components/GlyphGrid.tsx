'use client'

import type { Charset } from '@/core/charsets'
import type { CompiledFont } from '@/core/font'

type Props = {
  charset: Charset
  font: CompiledFont
  /** Šobrīd atvērtā rakstzīme; tās šūna ir izcelta. */
  current: string
  /** Pieskāriens šūnai: atver rakstzīmi rakstīšanai vai pārzīmēšanai. */
  onOpen: (char: string) => void
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function variantsLabel(count: number): string {
  if (count === 0) return 'nav uzrakstīts'
  return count === 1 ? '1 variants' : `${count} varianti`
}

/**
 * Pārskats pār visu rakstzīmju kopu (PRD 9. sadaļa): katrai zīmei tās pirmais variants lietotāja
 * rokrakstā vai blāva rakstzīme, ja tā vēl nav uzrakstīta, un variantu skaits. Viens pieskāriens
 * atver zīmi rakstīšanai vai pārzīmēšanai.
 */
export function GlyphGrid({ charset, font, current, onOpen }: Props) {
  const { ascender, descender } = font.metrics
  const height = ascender - descender

  return (
    <div data-testid="glyph-grid" className="flex flex-col gap-4">
      {charset.groups.map((group) => {
        const done = group.chars.filter((c) => font.glyphs[c]).length
        return (
          <section key={group.id} aria-label={group.label} className="flex flex-col gap-2">
            <h2 className="flex items-baseline justify-between text-sm font-medium text-ink/70">
              <span>{group.label}</span>
              <span data-testid={`group-progress-${group.id}`} className="text-xs font-normal">
                {done} no {group.chars.length}
              </span>
            </h2>
            <ul className="grid grid-cols-6 gap-1.5">
              {group.chars.map((char) => {
                const variants = font.glyphs[char] ?? []
                const first = variants[0]
                return (
                  <li key={char}>
                    <button
                      type="button"
                      data-testid="glyph-cell"
                      data-char={char}
                      data-variants={variants.length}
                      aria-label={`${char}, ${variantsLabel(variants.length)}`}
                      aria-current={char === current ? 'true' : undefined}
                      onClick={() => onOpen(char)}
                      className={`relative flex aspect-square w-full items-center justify-center rounded-lg bg-white ring-1 ${
                        char === current ? 'ring-2 ring-accent' : 'ring-ink/10'
                      } ${focusRing}`}
                    >
                      {first ? (
                        <svg
                          aria-hidden="true"
                          viewBox={`0 ${-ascender} ${Math.max(first.advance, 1)} ${height}`}
                          className="h-4/5 w-4/5"
                        >
                          <path d={first.path} fill="currentColor" />
                        </svg>
                      ) : (
                        <span aria-hidden="true" className="text-xl text-ink/25" lang="lv">
                          {char}
                        </span>
                      )}
                      {variants.length > 1 ? (
                        <span aria-hidden="true" className="absolute right-1 bottom-0.5 text-[10px] text-ink/50">
                          {variants.length}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
