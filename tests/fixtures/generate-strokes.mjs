// Ģenerē etalona vilcienu komplektu tests/fixtures/strokes.json.
// Palaišana: node tests/fixtures/generate-strokes.mjs
//
// Burtu formas ir aprakstītas ar līnijām un lokiem fonta vienībās (laukums no core/pad.ts:
// pamatlīnija y = 0, mazo burtu augstums 450, augšējā līnija 700, apakšējā −250) un pārvērstas
// punktos tā, kā tos ierakstītu DrawPad: veseli skaitļi, laiks ms no burta pirmā vilciena sākuma,
// paraugi ik pēc 8 ms, neliela roku trīce. Rezultāts ir determinēts; ģenerētais JSON glabājas
// repozitorijā, un testi lasa tikai to.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SAMPLE_MS = 8
const SPEED = 2.4 // vienības milisekundē vilciena vidū
const PEN_UP_MS = 160

// --- formu elementi: katrs atgriež blīvu punktu virkni [x, y] ---

function line(a, b) {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2))
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])
}

/** Elipses loks; leņķi grādos, y aug uz augšu, virziens no a0 uz a1. */
function arc(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) / 360) * 2 * Math.PI * Math.max(rx, ry) / 2))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })
}

function cubic(p0, p1, p2, p3) {
  const n = 200
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
    return [0, 1].map((k) => w[0] * p0[k] + w[1] * p1[k] + w[2] * p2[k] + w[3] * p3[k])
  })
}

const join = (...parts) => parts.flat()
const dot = (x, y) => [[x, y]]

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

// --- pamatburti ---

const bowl = (cx = 520) => arc(cx, 225, 170, 225, 20, 340)
const base = {
  a: [bowl(), join(line([690, 450], [690, 60]), arc(750, 60, 60, 60, 180, 270))],
  b: [line([400, 700], [400, 0]), arc(540, 225, 170, 225, 150, -150)],
  c: [arc(550, 225, 180, 225, 45, 315)],
  d: [bowl(), line([690, 700], [690, 0])],
  e: [join(line([380, 225], [720, 225]), arc(550, 225, 170, 225, 0, 310))],
  f: [join(arc(640, 580, 110, 120, 20, 180), line([530, 580], [530, 0])), line([400, 430], [680, 430])],
  g: [bowl(), join(line([690, 450], [690, -80]), arc(540, -80, 150, 160, 0, -160))],
  h: [line([400, 700], [400, 0]), join(arc(550, 280, 150, 170, 180, 0), line([700, 280], [700, 0]))],
  i: [line([550, 450], [550, 0])],
  j: [join(line([600, 450], [600, -80]), arc(460, -80, 140, 160, 0, -150))],
  k: [line([400, 700], [400, 0]), join(line([700, 450], [420, 210]), line([420, 210], [720, 0]))],
  l: [line([550, 700], [550, 0])],
  m: [
    line([300, 450], [300, 0]),
    join(arc(410, 300, 110, 150, 180, 0), line([520, 300], [520, 0])),
    join(arc(630, 300, 110, 150, 180, 0), line([740, 300], [740, 0])),
  ],
  n: [line([400, 450], [400, 0]), join(arc(550, 290, 150, 160, 180, 0), line([700, 290], [700, 0]))],
  o: [arc(550, 225, 170, 225, 90, 450)],
  p: [line([400, 450], [400, -250]), arc(540, 225, 170, 225, 150, -150)],
  r: [line([450, 450], [450, 0]), arc(600, 290, 150, 160, 180, 50)],
  s: [join(arc(550, 340, 130, 110, 30, 270), arc(550, 115, 140, 115, 90, -160))],
  t: [join(line([520, 650], [520, 90]), arc(610, 90, 90, 90, 180, 290)), line([380, 450], [690, 450])],
  u: [join(line([400, 450], [400, 170]), arc(550, 170, 150, 170, 180, 360), line([700, 170], [700, 450])), line([700, 450], [700, 0])],
  v: [join(line([380, 450], [550, 0]), line([550, 0], [720, 450]))],
  z: [join(line([390, 450], [710, 450]), line([710, 450], [390, 0]), line([390, 0], [720, 0]))],
}

// --- zīmes: katru burtu ar zīmi "raksta" pilnībā, zīme ir atsevišķs vilciens ---

const macron = (cx) => line([cx - 110, 598], [cx + 110, 610])
const caron = (cx) => join(line([cx - 90, 665], [cx, 570]), line([cx, 570], [cx + 90, 665]))
const commaBelow = (cx) => join(line([cx + 15, -100], [cx + 10, -170]), line([cx + 10, -170], [cx - 35, -235]))
/** Mazajam ģ zīme ir augšā (apgriezts komats). */
const commaAbove = (cx) => join(line([cx - 15, 560], [cx - 10, 630]), line([cx - 10, 630], [cx + 35, 695]))

const shapes = {
  a: base.a,
  ā: [...base.a, macron(540)],
  b: base.b,
  c: base.c,
  č: [...base.c, caron(560)],
  d: base.d,
  e: base.e,
  ē: [...base.e, macron(550)],
  f: base.f,
  g: base.g,
  ģ: [...base.g, commaAbove(540)],
  h: base.h,
  i: [...base.i, dot(550, 620)],
  ī: [...base.i, macron(550)],
  j: [...base.j, line([598, 615], [603, 625])],
  k: base.k,
  ķ: [...base.k, commaBelow(560)],
  l: base.l,
  ļ: [...base.l, commaBelow(550)],
  m: base.m,
  n: base.n,
  ņ: [...base.n, commaBelow(550)],
  o: base.o,
  p: base.p,
  r: base.r,
  s: base.s,
  š: [...base.s, caron(550)],
  t: base.t,
  u: base.u,
  ū: [...base.u, macron(550)],
  v: base.v,
  z: base.z,
  ž: [...base.z, caron(550)],
}

const glyphs = Object.fromEntries(Object.entries(shapes).map(([char, list]) => [char, glyph(char, list)]))

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
    'Etalona vilcieni (ģenerēti ar generate-strokes.mjs): visi 33 latviešu mazie burti un īpaši gadījumi. Punkti ir fonta vienībās, t ir ms no burta pirmā vilciena sākuma.',
  glyphs,
  cases,
}

const strokeLines = (strokes) => `[\n${strokes.map((s) => `      ${JSON.stringify(s)}`).join(',\n')}\n    ]`
const section = (record) =>
  `{\n${Object.entries(record)
    .map(([key, strokes]) => `    ${JSON.stringify(key)}: ${strokeLines(strokes)}`)
    .join(',\n')}\n  }`

const json = `{\n  "description": ${JSON.stringify(data.description)},\n  "glyphs": ${section(glyphs)},\n  "cases": ${section(cases)}\n}\n`

writeFileSync(fileURLToPath(new URL('./strokes.json', import.meta.url)), json)
