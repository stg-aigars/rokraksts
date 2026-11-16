// Latviešu mazo burtu shematiskās formas: līnijas un loki fonta vienībās (laukums no core/pad.ts:
// pamatlīnija y = 0, mazo burtu augstums 450, augšējā līnija 700, apakšējā −250).
// No šīm formām ģenerē divas lietas:
//   - etalona vilcienus testiem (tests/fixtures/generate-strokes.mjs),
//   - blāvos paraugus burtiem ar zīmēm (scripts/generate-guides.mjs -> core/charsets/lv-guides.ts).

// --- formu elementi: katrs atgriež blīvu punktu virkni [x, y] ---

export function line(a, b) {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2))
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])
}

/** Elipses loks; leņķi grādos, y aug uz augšu, virziens no a0 uz a1. */
export function arc(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) / 360) * 2 * Math.PI * Math.max(rx, ry) / 2))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })
}

export function cubic(p0, p1, p2, p3) {
  const n = 200
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
    return [0, 1].map((k) => w[0] * p0[k] + w[1] * p1[k] + w[2] * p2[k] + w[3] * p3[k])
  })
}

export const join = (...parts) => parts.flat()
export const dot = (x, y) => [[x, y]]

// --- pamatburti ---

const bowl = (cx = 520) => arc(cx, 225, 170, 225, 20, 340)
export const base = {
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

export const shapes = {
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
