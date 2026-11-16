import { createProject } from '@/core/project'
import type { FontProject, Stroke } from '@/core/types'
import data from './strokes.json'

// Etalona vilcieni testiem. Datus ģenerē generate-strokes.mjs; testi lasa tikai JSON.

type StrokeSet = Record<string, Stroke[]>

/** Visi 33 latviešu mazie burti: rakstzīme -> vilcieni. */
export const fixtureGlyphs: StrokeSet = data.glyphs

/** Īpaši gadījumi kontūru kodam: cilpa, spiediens, punkts, svikajums. */
export const fixtureCases: StrokeSet = data.cases

export function fixtureStrokes(name: string): Stroke[] {
  const strokes = fixtureGlyphs[name] ?? fixtureCases[name]
  if (!strokes) throw new Error(`Etalonā nav "${name}"`)
  return strokes
}

/** Projekts ar etalona burtiem; bez argumenta visi, citādi tikai nosauktie. */
export function fixtureProject(chars: readonly string[] = Object.keys(fixtureGlyphs)): FontProject {
  const project = createProject('etalons', '2026-11-16T00:00:00.000Z')
  for (const char of chars) {
    project.glyphs[char] = { char, variants: [{ strokes: fixtureStrokes(char) }] }
  }
  return project
}
