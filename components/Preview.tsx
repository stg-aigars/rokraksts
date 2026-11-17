'use client'

import { useMemo } from 'react'
import type { MouseEvent } from 'react'
import type { Charset } from '@/core/charsets'
import type { CompiledFont } from '@/core/font'
import { layoutText } from '@/core/layout'
import type { Layout } from '@/core/layout'
import { renderSvg } from '@/core/render-svg'

type Props = {
  font: CompiledFont
  charset: Charset
  /** Teksts, ko rādīt; tukšs nozīmē rakstzīmju kopas parauga tekstu. */
  text?: string
  /** Rindas platums fonta vienībās. */
  lineWidth?: number
  /** Identifikatoru priedēklis; jāatšķiras, ja lapā ir vairāki priekšskatījumi. */
  idPrefix?: string
  /** Konteinera augstums (pēc noklusējuma h-24); bez tā SVG aizņem pilnu platumu un savu augstumu. */
  className?: string
  /** 'box': SVG ietilpst konteinerā; 'width': SVG ir pilnā platumā, augstums pēc satura. */
  fit?: 'box' | 'width'
  /** Pieskāriens glifam vai tukšam rāmītim: kura rakstzīme un kurš variants tur ir. */
  onPick?: (char: string, variant: number) => void
}

/** Rindas platums fonta vienībās: parauga teksts telefonā iznāk trīs rindās. */
const LINE_WIDTH = 12500

/**
 * Nemainīga sēkla: variantu secība un trice ir atkarīga tikai no tās un burta vietas tekstā,
 * tāpēc priekšskatījums nelēkā pēc katra vilciena. Sēklu mainīs kartītes redaktors (5. posms).
 */
const PREVIEW_SEED = 1

/** Kura rakstzīme ir izkārtojuma punktā (fonta vienībās); arī neuzrakstītās zīmes rāmītis. */
function pickAt(layout: Layout, font: CompiledFont, x: number, y: number): { char: string; variant: number } | null {
  const { ascender, descender } = font.metrics
  const line = layout.lines.find((l) => y >= l.y - ascender && y <= l.y - descender)
  if (!line) return null
  for (const g of layout.glyphs) {
    const advance = font.glyphs[g.char]?.[g.variant]?.advance ?? 0
    if (g.y === line.y && x >= g.x && x < g.x + advance) return { char: g.char, variant: g.variant }
  }
  for (const m of layout.missing) {
    if (m.y === line.y && x >= m.x && x < m.x + m.advance) return { char: m.char, variant: 0 }
  }
  return null
}

/**
 * Dzīvs priekšskatījums lietotāja rokrakstā (PRD 4. sadaļas 3. solis). Font kompilē WriteFlow
 * (kontūras no vilcieniem ar pašreizējo stilu). Atkārtoti burti ņem dažādus variantus, un katram
 * glifam ir viegla trice. Neuzrakstīta rakstzīme ir tukšs rāmītis un nekad netiek aizstāta ar
 * citu burtu. Pieskaroties glifam, atveras tieši tā rakstzīme un tas variants.
 */
export function Preview({
  font,
  charset,
  text,
  lineWidth = LINE_WIDTH,
  idPrefix = 'paraugs',
  className = 'h-24',
  fit = 'box',
  onPick,
}: Props) {
  const sample = text || charset.sampleText

  const { svg, layout } = useMemo(() => {
    const layout = layoutText(sample, font, charset, { maxWidth: lineWidth, seed: PREVIEW_SEED })
    return { svg: renderSvg(layout, font, { idPrefix }), layout }
  }, [font, charset, sample, lineWidth, idPrefix])

  function pick(event: MouseEvent<HTMLDivElement>) {
    const svgElement = event.currentTarget.querySelector('svg')
    if (!onPick || !svgElement) return
    // SVG ir ievietots ar noklusējuma preserveAspectRatio (xMidYMid meet): vienāds mērogs, centrēts.
    const rect = svgElement.getBoundingClientRect()
    const scale = Math.min(rect.width / layout.width, rect.height / layout.height)
    if (!(scale > 0)) return
    const x = (event.clientX - rect.left - (rect.width - layout.width * scale) / 2) / scale
    const y = (event.clientY - rect.top - (rect.height - layout.height * scale) / 2) / scale
    const hit = pickAt(layout, font, x, y)
    if (hit) onPick(hit.char, hit.variant)
  }

  return (
    <section aria-label="Paraugs tavā rokrakstā" className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-ink/10">
      <div
        data-testid="preview"
        data-glyphs={layout.glyphs.length}
        data-missing={layout.missing.length}
        className={`${className} ${fit === 'box' ? '[&>svg]:h-full' : '[&>svg]:h-auto'} [&>svg]:w-full ${onPick ? 'cursor-pointer' : ''}`}
        onClick={pick}
        // SVG virkni ģenerē mūsu pašu core/render-svg; teksts tajā ir tikai kā izvairīts atribūts.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </section>
  )
}
