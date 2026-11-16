'use client'

import { useMemo, useState } from 'react'
import { getCharset } from '@/core/charsets'
import { compileFont, createGlyphCache } from '@/core/font'
import { layoutText } from '@/core/layout'
import { renderSvg } from '@/core/render-svg'
import type { FontProject } from '@/core/types'

type Props = {
  project: FontProject
  /** Teksts, ko rādīt; pēc noklusējuma rakstzīmju kopas parauga teksts. */
  text?: string
}

/** Rindas platums fonta vienībās: parauga teksts telefonā iznāk trīs rindās. */
const LINE_WIDTH = 12500

/**
 * Nemainīga sēkla: variantu secība un trice ir atkarīga tikai no tās un burta vietas tekstā,
 * tāpēc priekšskatījums nelēkā pēc katra vilciena. Sēklu mainīs kartītes redaktors (5. posms).
 */
const PREVIEW_SEED = 1

/**
 * Dzīvs priekšskatījums lietotāja rokrakstā (PRD 4. sadaļas 3. solis). Kontūras pārrēķina no
 * vilcieniem pēc katras izmaiņas; kešs pārrēķina tikai mainīto variantu. Atkārtoti burti ņem
 * dažādus variantus, un katram glifam ir viegla trice. Neuzrakstīta rakstzīme ir tukšs rāmītis
 * un nekad netiek aizstāta ar citu burtu.
 */
export function Preview({ project, text }: Props) {
  const [cache] = useState(createGlyphCache)
  const charset = getCharset(project.charset)
  const sample = text ?? charset.sampleText

  const { svg, written, missing } = useMemo(() => {
    const font = compileFont(project, cache)
    const layout = layoutText(sample, font, charset, { maxWidth: LINE_WIDTH, seed: PREVIEW_SEED })
    return {
      svg: renderSvg(layout, font, { idPrefix: 'paraugs' }),
      written: layout.glyphs.length,
      missing: layout.missing.length,
    }
  }, [project, cache, charset, sample])

  return (
    <section aria-label="Paraugs tavā rokrakstā" className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-ink/10">
      <div
        data-testid="preview"
        data-glyphs={written}
        data-missing={missing}
        className="h-24 [&>svg]:h-full [&>svg]:w-full"
        // SVG virkni ģenerē mūsu pašu core/render-svg; teksts tajā ir tikai kā izvairīts atribūts.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </section>
  )
}
