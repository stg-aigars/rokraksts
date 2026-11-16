import type { Bounds } from './outline'
import { defaultMetrics } from './pad'
import { UNITS_PER_EM } from './types'
import type { FontMetrics, FontStyle } from './types'

// Metrika (PRD 6. sadaļas 5. solis). Kerninga MVP nav.

export type GlyphMetrics = {
  /** Glifa platums: cik tālu pārvietojas rakstīšanas vieta. */
  advance: number
  /** Cik jāpieskaita kontūras x, lai tā sāktos pie kreisās sānu atstarpes. */
  offsetX: number
}

/** Sānu atstarpe katrā glifa pusē; noklusējums 6% no em, globāli regulējams ar style.spacing. */
export function sideBearing(style: Pick<FontStyle, 'spacing'>): number {
  return Math.round(style.spacing * UNITS_PER_EM)
}

/**
 * Glifa platums = robežkaste + sānu atstarpes. Vieta, kur burts uzrakstīts laukumā, platumu
 * neietekmē. Ja lietotājs platumu pielāgojis (`advance`), glifs paliek pie kreisās atstarpes.
 */
export function glyphMetrics(bounds: Bounds | null, style: Pick<FontStyle, 'spacing'>, advance?: number): GlyphMetrics {
  const bearing = sideBearing(style)
  if (!bounds) return { advance: advance ?? 2 * bearing, offsetX: 0 }
  return { advance: advance ?? bounds.xMax - bounds.xMin + 2 * bearing, offsetX: bearing - bounds.xMin }
}

/**
 * Fonta vertikālā metrika. Mazo un lielo burtu augstums nāk no laukuma līnijām. Augšējā un
 * apakšējā robeža nāk no faktiski uzzīmētā augstākā un zemākā punkta, lai zīmes netiktu
 * nogrieztas, bet nekad nav šaurāka par laukuma līnijām, lai rindas augstums nelēkātu,
 * kamēr uzrakstīti tikai zemi burti.
 */
export function fontMetrics(glyphBounds: Iterable<Bounds | null>): FontMetrics {
  const metrics = defaultMetrics()
  for (const bounds of glyphBounds) {
    if (!bounds) continue
    metrics.ascender = Math.max(metrics.ascender, bounds.yMax)
    metrics.descender = Math.min(metrics.descender, bounds.yMin)
  }
  return metrics
}
