import { fontMetrics, glyphMetrics } from './metrics'
import { buildOutline, outlineToPath } from './outline'
import type { Bounds } from './outline'
import type { FontMetrics, FontProject, FontStyle, GlyphVariant } from './types'

// Projekts (vilcieni) -> zīmējami glifi. Kontūras nekad neglabājam: tās vienmēr pārrēķina
// no vilcieniem, un kešs tikai aiztaupa darbu, kamēr vilcieni nav mainījušies.

export type CompiledGlyph = {
  /** SVG ceļš: y uz leju, pamatlīnija y = 0, kreisā sānu atstarpe sākas pie x = 0. */
  path: string
  advance: number
  /** Robežkaste fonta vienībās (y uz augšu) pēc pārbīdes pie kreisās atstarpes. */
  bounds: Bounds
}

export type CompiledFont = {
  metrics: FontMetrics
  /** Rakstzīme -> glifs katram uzrakstītajam variantam. Neuzrakstītu rakstzīmju šeit nav. */
  glyphs: Record<string, CompiledGlyph[]>
}

export type GlyphCache = { styleKey: string; glyphs: WeakMap<GlyphVariant, CompiledGlyph> }

export function createGlyphCache(): GlyphCache {
  return { styleKey: '', glyphs: new WeakMap() }
}

/** Viena varianta glifs: kontūra no vilcieniem, pārbīdīta pie kreisās sānu atstarpes. */
export function compileVariant(variant: GlyphVariant, style: FontStyle): CompiledGlyph {
  const outline = buildOutline(variant.strokes, style)
  const { advance, offsetX } = glyphMetrics(outline.bounds, style, variant.advance)
  const b = outline.bounds ?? { xMin: 0, yMin: 0, xMax: 0, yMax: 0 }
  return {
    path: outlineToPath(outline, offsetX),
    advance,
    bounds: { xMin: b.xMin + offsetX, yMin: b.yMin, xMax: b.xMax + offsetX, yMax: b.yMax },
  }
}

/**
 * Visi projekta glifi un fonta metrika. Ar kešu pārrēķina tikai tos variantus, kuru objekts
 * ir mainījies (core/project.ts pēc katra vilciena izveido jaunu tikai atvērtajam burtam).
 */
export function compileFont(project: FontProject, cache: GlyphCache = createGlyphCache()): CompiledFont {
  const styleKey = JSON.stringify(project.style)
  if (cache.styleKey !== styleKey) {
    cache.styleKey = styleKey
    cache.glyphs = new WeakMap()
  }
  const glyphs: Record<string, CompiledGlyph[]> = {}
  for (const [char, glyph] of Object.entries(project.glyphs)) {
    glyphs[char] = glyph.variants.map((variant) => {
      let compiled = cache.glyphs.get(variant)
      if (!compiled) {
        compiled = compileVariant(variant, project.style)
        cache.glyphs.set(variant, compiled)
      }
      return compiled
    })
  }
  return { metrics: fontMetrics(Object.values(glyphs).flatMap((list) => list.map((g) => g.bounds))), glyphs }
}
