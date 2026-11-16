// Ģenerē etalona vilcienu komplektu tests/fixtures/strokes.json.
// Palaišana: node tests/fixtures/generate-strokes.mjs
//
// Burtu formas (scripts/letter-shapes.mjs) ir aprakstītas ar līnijām un lokiem fonta vienībās un
// pārvērstas punktos tā, kā tos ierakstītu DrawPad: veseli skaitļi, laiks ms no burta pirmā vilciena sākuma,
// paraugi ik pēc 8 ms, neliela roku trīce. Rezultāts ir determinēts; ģenerētais JSON glabājas
// repozitorijā, un testi lasa tikai to.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { base, cubic, dot, join, line, shapes } from '../../scripts/letter-shapes.mjs'

const SAMPLE_MS = 8
const SPEED = 2.4 // vienības milisekundē vilciena vidū
const PEN_UP_MS = 160

// --- no formas uz ierakstītiem punktiem ---

function makeRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Iet pa formu ar mainīgu ātrumu (lēnāk sākumā un beigās) un ņem paraugu ik pēc SAMPLE_MS. */
function record(shape, startT, random, pressure) {
  const lengths = [0]
  for (let i = 1; i < shape.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(shape[i][0] - shape[i - 1][0], shape[i][1] - shape[i - 1][1]))
  }
  const total = lengths[lengths.length - 1]
  const points = []
  let travelled = 0
  let t = startT
  let index = 0
  for (;;) {
    while (index < shape.length - 2 && lengths[index + 1] < travelled) index++
    const span = lengths[index + 1] - lengths[index] || 1
    const f = Math.min(1, Math.max(0, (travelled - lengths[index]) / span))
    const a = shape[index]
    const b = shape[Math.min(index + 1, shape.length - 1)]
    const point = {
      x: Math.round(a[0] + (b[0] - a[0]) * f + (random() - 0.5) * 3),
      y: Math.round(a[1] + (b[1] - a[1]) * f + (random() - 0.5) * 3),
      t: Math.round(t),
    }
    if (pressure) point.p = Math.round(pressure(total > 0 ? travelled / total : 0) * 1000) / 1000
    const last = points[points.length - 1]
    if (!last || last.x !== point.x || last.y !== point.y) points.push(point)
    if (travelled >= total) break
    const progress = total > 0 ? travelled / total : 1
    const ease = 0.45 + 0.55 * Math.min(1, progress / 0.15, (1 - progress) / 0.15 + 0.2)
    travelled = Math.min(total, travelled + SPEED * ease * SAMPLE_MS)
    t += SAMPLE_MS
  }
  return { points }
}

function glyph(name, shapes, pressure) {
  const random = makeRandom([...name].reduce((h, c) => Math.imul(h, 31) + c.codePointAt(0), 7))
  const strokes = []
  let t = 0
  for (const shape of shapes) {
    const stroke = record(shape, t, random, pressure)
    strokes.push(stroke)
    t = stroke.points[stroke.points.length - 1].t + PEN_UP_MS
  }
  return strokes
}

const glyphs = Object.fromEntries(Object.entries(shapes).map(([char, list]) => [char, glyph(char, list)]))

// --- otrais un trešais variants (3. posms) ---
// Cilvēks to pašu burtu otrreiz uzraksta nedaudz citādi: mazliet platāku vai šaurāku, ar citu
// slīpumu, nedaudz pabīdītu. Pamatlīnija paliek vietā. Biežākajiem burtiem (charset.frequentChars)
// ir trīs varianti, burtiem r un ķ divi; pārējiem viens.

const extraVariants = { a: 2, i: 2, s: 2, e: 2, t: 2, u: 2, ā: 2, r: 1, ķ: 1 }

function vary(list, name) {
  const random = makeRandom([...name].reduce((h, c) => Math.imul(h, 131) + c.codePointAt(0), 11))
  const sx = 0.92 + random() * 0.16
  const sy = 0.95 + random() * 0.1
  const slant = (random() - 0.5) * 0.14
  const dx = (random() - 0.5) * 40
  return list.map((shape) => shape.map(([x, y]) => [550 + (x - 550) * sx + y * slant + dx, y * sy]))
}

const variants = Object.fromEntries(
  Object.entries(extraVariants).map(([char, count]) => [
    char,
    Array.from({ length: count }, (_, i) => {
      const name = `${char}~${i + 2}`
      return glyph(name, vary(shapes[char], name))
    }),
  ]),
)

// --- īpaši gadījumi kontūru kodam ---

const cases = {
  // Viens vilciens, kas krusto pats sevi (rakstīta "l" cilpa).
  cilpa: glyph('cilpa', [
    join(cubic([300, 60], [720, 280], [640, 720], [520, 700]), cubic([520, 700], [410, 680], [430, 260], [760, 40])),
  ]),
  // Irbulis: spiediens ir ierakstīts un mainās vilciena gaitā.
  spiediens: glyph('spiediens', [base.o[0]], (f) => 0.55 + 0.35 * Math.sin(f * Math.PI * 2)),
  // Viens pieskāriens bez kustības.
  punkts: glyph('punkts', [dot(550, 200)]),
  // Švīkājums: daudz pārklājumu vienā un vairākos vilcienos.
  svikajums: glyph('svikajums', [
    join(
      line([350, 400], [750, 380]),
      line([750, 380], [360, 330]),
      line([360, 330], [740, 300]),
      line([740, 300], [370, 250]),
      line([370, 250], [750, 210]),
    ),
    join(line([450, 450], [480, 150]), line([480, 150], [560, 440]), line([560, 440], [620, 160])),
    line([340, 200], [760, 420]),
  ]),
}

const data = {
  description:
    'Etalona vilcieni (ģenerēti ar generate-strokes.mjs): visi 33 latviešu mazie burti (glyphs), otrais un trešais variants biežākajiem burtiem (variants) un īpaši gadījumi (cases). Punkti ir fonta vienībās, t ir ms no burta pirmā vilciena sākuma.',
  glyphs,
  variants,
  cases,
}

const strokeLines = (strokes) => `[\n${strokes.map((s) => `      ${JSON.stringify(s)}`).join(',\n')}\n    ]`
const section = (record) =>
  `{\n${Object.entries(record)
    .map(([key, strokes]) => `    ${JSON.stringify(key)}: ${strokeLines(strokes)}`)
    .join(',\n')}\n  }`

const variantSection = `{\n${Object.entries(variants)
  .map(([key, list]) => `    ${JSON.stringify(key)}: [\n    ${list.map(strokeLines).join(',\n    ')}\n    ]`)
  .join(',\n')}\n  }`

const json = `{\n  "description": ${JSON.stringify(data.description)},\n  "glyphs": ${section(glyphs)},\n  "variants": ${variantSection},\n  "cases": ${section(cases)}\n}\n`

writeFileSync(fileURLToPath(new URL('./strokes.json', import.meta.url)), json)
