// Ģenerē blāvos paraugus burtiem ar zīmēm: core/charsets/lv-guides.ts.
// Palaišana: node scripts/generate-guides.mjs
//
// Paraugs ir mūsu shematisks burts kopā ar zīmi (garumzīme, jumtiņš, komats) pareizajā vietā, ko
// zīmēšanas laukums rāda blāvi kā orientieri. Tas nav lietotāja rokraksts un glifā nekad nenonāk.
// Formas nāk no scripts/letter-shapes.mjs; šeit tās vienkāršo līdz lauztām līnijām ar veseliem
// skaitļiem, lai rakstzīmju kopā būtu tikai dati.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { moreShapes, shapes } from './letter-shapes.mjs'

const TOLERANCE = 1.5

/** Douglas–Peucker: atmet punktus, kas no līnijas neatkāpjas vairāk par pielaidi. */
function simplify(points) {
  if (points.length <= 2) return points
  const [a, b] = [points[0], points[points.length - 1]]
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  let worst = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const distance = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length
    if (distance > worst) {
      worst = distance
      index = i
    }
  }
  if (worst <= TOLERANCE) return [a, b]
  return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))]
}

// Burti ar zīmi: tie, kas NFD formā sadalās pamatburtā un kombinējamā zīmē (i un j te neietilpst).
// Vispirms mazie, tad lielie burti (Ā Č Ē Ģ Ī Ķ Ļ Ņ Š Ū Ž).
const all = [...Object.entries(shapes), ...moreShapes]
const chars = all.filter(([char]) => char.normalize('NFD').length > 1)

const entries = chars.map(([char, list]) => {
  const strokes = list.map((shape) => simplify(shape).flatMap(([x, y]) => [Math.round(x), Math.round(y)]))
  return `  ${char}: [\n${strokes.map((s) => `    [${s.join(', ')}],`).join('\n')}\n  ],`
})

const source = `// ĢENERĒTS FAILS: node scripts/generate-guides.mjs. Ar roku nelabot.
// Blāvie paraugi burtiem ar zīmēm: katrs vilciens ir lauzta līnija [x0, y0, x1, y1, ...]
// fonta vienībās (y uz augšu, pamatlīnija 0). Pēdējais vilciens ir zīme.

export const lvGuides: Readonly<Record<string, readonly (readonly number[])[]>> = {
${entries.join('\n')}
}
`

writeFileSync(fileURLToPath(new URL('../core/charsets/lv-guides.ts', import.meta.url)), source)
