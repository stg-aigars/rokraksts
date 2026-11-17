// Ģenerē blāvos paraugus visām zīmēm: core/charsets/lv-guides.ts.
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

// Paraugs ir visām zīmēm. Burti ar zīmi (tie, kas NFD formā sadalās pamatburtā un kombinējamā
// zīmē; i un j te neietilpst) ir atsevišķā sarakstā: tiem paraugs ir ieslēgts pēc noklusējuma, un
// to pēdējais vilciens ir zīme. Vispirms mazie, tad pārējās zīmes etalona secībā.
const all = [...Object.entries(shapes), ...moreShapes]
const marked = all.map(([char]) => char).filter((char) => char.normalize('NFD').length > 1)

const entries = all.map(([char, list]) => {
  const strokes = list.map((shape) => {
    const points = simplify(shape).flatMap(([x, y]) => [Math.round(x), Math.round(y)])
    // Punkts (viens pieskāriens) kļūst par nogriezni uz sevi; ar noapaļotiem galiem tas ir punkts.
    return points.length === 2 ? [...points, ...points] : points
  })
  return `  ${JSON.stringify(char)}: [\n${strokes.map((s) => `    [${s.join(', ')}],`).join('\n')}\n  ],`
})

const source = `// ĢENERĒTS FAILS: node scripts/generate-guides.mjs. Ar roku nelabot.
// Blāvie paraugi visām zīmēm: katrs vilciens ir lauzta līnija [x0, y0, x1, y1, ...] fonta
// vienībās (y uz augšu, pamatlīnija 0). Burtiem ar zīmi (lvMarkedChars) pēdējais vilciens ir zīme.

export const lvGuides: Readonly<Record<string, readonly (readonly number[])[]>> = {
${entries.join('\n')}
}

/** Burti ar zīmi: tiem paraugs ir ieslēgts pēc noklusējuma. */
export const lvMarkedChars: readonly string[] = ${JSON.stringify(marked)}
`

writeFileSync(fileURLToPath(new URL('../core/charsets/lv-guides.ts', import.meta.url)), source)
