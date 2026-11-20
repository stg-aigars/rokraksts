import { createProject } from '@/core/project'
import type { FontProject, Stroke } from '@/core/types'
import data from './strokes.json'

// Etalona vilcieni testiem. Datus ģenerē generate-strokes.mjs; testi lasa tikai JSON.

type StrokeSet = Record<string, Stroke[]>

/** Visi 33 latviešu mazie burti: rakstzīme -> vilcieni. */
export const fixtureGlyphs: StrokeSet = data.glyphs

/** Otrais un trešais variants biežākajiem burtiem: rakstzīme -> vilcieni katram papildu variantam. */
export const fixtureVariants: Record<string, Stroke[][]> = data.variants

/** Īpaši gadījumi kontūru kodam: cilpa, spiediens, punkts, svikajums. */
export const fixtureCases: StrokeSet = data.cases

/** Pārējās 66 kopas zīmes (q w x y, lielie burti, cipari, pieturzīmes) etalona secībā. */
export const fixtureMore = data.more as [string, Stroke[]][]

const moreByChar: StrokeSet = Object.fromEntries(fixtureMore)

/** Visas 99 etalona zīmes: vispirms 33 mazie burti, tad pārējās. */
export const fixtureAll: readonly string[] = [...Object.keys(fixtureGlyphs), ...fixtureMore.map(([char]) => char)]

export function fixtureStrokes(name: string): Stroke[] {
  const strokes = fixtureGlyphs[name] ?? moreByChar[name] ?? fixtureCases[name]
  if (!strokes) throw new Error(`Etalonā nav "${name}"`)
  return strokes
}

/**
 * Projekts ar etalona burtiem; bez argumenta 33 mazie burti (kā 3. posmā), ar `fixtureAll` visas
 * 99 zīmes, citādi tikai nosauktās. Pēc noklusējuma ar
 * visiem etalona variantiem; `variants: false` atstāj katram burtam tikai pirmo.
 */
export function fixtureProject(
  chars: readonly string[] = Object.keys(fixtureGlyphs),
  options: { variants?: boolean } = {},
): FontProject {
  const project = createProject('etalons', '2026-11-16T00:00:00.000Z')
  for (const char of chars) {
    const extra = options.variants === false ? [] : (fixtureVariants[char] ?? [])
    project.glyphs[char] = { char, variants: [fixtureStrokes(char), ...extra].map((strokes) => ({ strokes })) }
  }
  return project
}
