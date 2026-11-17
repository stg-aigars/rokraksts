// Visas 99 rakstzīmju kopas zīmes shematiskās formās: līnijas un loki fonta vienībās (laukums no
// core/pad.ts: pamatlīnija y = 0, mazo burtu augstums 450, augšējā līnija un lielo burtu augstums
// 700, apakšējā −250; brīvā josla zīmēm līdz 950 augšā un −450 apakšā).
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

// --- papildu mazie burti (4. posms) ---

export const extra = {
  q: [bowl(), line([690, 450], [690, -250])],
  w: [join(line([300, 450], [390, 0]), line([390, 0], [550, 330]), line([550, 330], [710, 0]), line([710, 0], [800, 450]))],
  x: [line([400, 450], [700, 0]), line([700, 450], [400, 0])],
  y: [line([390, 450], [560, 40]), line([710, 450], [450, -250])],
}

// --- lielie burti: augstums 700, zīmes brīvajā joslā virs tā (Ā, Č) vai zem pamatlīnijas (Ķ, Ģ) ---

export const upperBase = {
  A: [join(line([370, 0], [550, 700]), line([550, 700], [730, 0])), line([440, 260], [660, 260])],
  B: [
    line([400, 700], [400, 0]),
    join(line([400, 700], [540, 700]), arc(540, 530, 140, 170, 90, -90), line([540, 360], [400, 360])),
    join(line([400, 360], [570, 360]), arc(570, 180, 160, 180, 90, -90), line([570, 0], [400, 0])),
  ],
  C: [arc(570, 350, 200, 350, 50, 310)],
  D: [line([400, 700], [400, 0]), join(line([400, 700], [500, 700]), arc(500, 350, 220, 350, 90, -90), line([500, 0], [400, 0]))],
  E: [join(line([680, 700], [400, 700]), line([400, 700], [400, 0]), line([400, 0], [690, 0])), line([400, 360], [640, 360])],
  F: [join(line([680, 700], [400, 700]), line([400, 700], [400, 0])), line([400, 370], [630, 370])],
  G: [join(arc(560, 350, 200, 350, 45, 360), line([760, 350], [600, 350]))],
  H: [line([380, 700], [380, 0]), line([720, 700], [720, 0]), line([380, 360], [720, 360])],
  I: [line([550, 700], [550, 0])],
  J: [join(line([640, 700], [640, 180]), arc(500, 180, 140, 180, 0, -170))],
  K: [line([400, 700], [400, 0]), join(line([700, 700], [420, 340]), line([420, 340], [720, 0]))],
  L: [join(line([420, 700], [420, 0]), line([420, 0], [690, 0]))],
  M: [join(line([330, 0], [360, 700]), line([360, 700], [550, 250]), line([550, 250], [740, 700]), line([740, 700], [770, 0]))],
  N: [join(line([390, 0], [390, 700]), line([390, 700], [710, 0]), line([710, 0], [710, 700]))],
  O: [arc(550, 350, 210, 350, 90, 450)],
  P: [line([400, 700], [400, 0]), join(line([400, 700], [540, 700]), arc(540, 520, 160, 180, 90, -90), line([540, 340], [400, 340]))],
  Q: [arc(550, 350, 210, 350, 90, 450), line([600, 130], [740, -60])],
  R: [
    line([400, 700], [400, 0]),
    join(line([400, 700], [540, 700]), arc(540, 520, 160, 180, 90, -90), line([540, 340], [400, 340])),
    line([520, 340], [710, 0]),
  ],
  S: [join(arc(550, 530, 150, 170, 20, 270), arc(550, 180, 165, 180, 90, -160))],
  T: [line([550, 700], [550, 0]), line([360, 700], [740, 700])],
  U: [join(line([390, 700], [390, 220]), arc(550, 220, 160, 220, 180, 360), line([710, 220], [710, 700]))],
  V: [join(line([360, 700], [550, 0]), line([550, 0], [740, 700]))],
  W: [join(line([300, 700], [400, 0]), line([400, 0], [550, 500]), line([550, 500], [700, 0]), line([700, 0], [800, 700]))],
  X: [line([380, 700], [720, 0]), line([720, 700], [380, 0])],
  Y: [join(line([370, 700], [550, 380]), line([550, 380], [730, 700])), line([550, 380], [550, 0])],
  Z: [join(line([380, 700], [720, 700]), line([720, 700], [380, 0]), line([380, 0], [730, 0]))],
}

const capMacron = (cx) => line([cx - 120, 790], [cx + 120, 802])
const capCaron = (cx) => join(line([cx - 100, 880], [cx, 790]), line([cx, 790], [cx + 100, 880]))

export const upper = {
  A: upperBase.A,
  Ā: [...upperBase.A, capMacron(550)],
  B: upperBase.B,
  C: upperBase.C,
  Č: [...upperBase.C, capCaron(570)],
  D: upperBase.D,
  E: upperBase.E,
  Ē: [...upperBase.E, capMacron(545)],
  F: upperBase.F,
  G: upperBase.G,
  // Lielajam Ģ komats ir apakšā, tāpat kā Ķ Ļ Ņ.
  Ģ: [...upperBase.G, commaBelow(560)],
  H: upperBase.H,
  I: upperBase.I,
  Ī: [...upperBase.I, capMacron(550)],
  J: upperBase.J,
  K: upperBase.K,
  Ķ: [...upperBase.K, commaBelow(560)],
  L: upperBase.L,
  Ļ: [...upperBase.L, commaBelow(550)],
  M: upperBase.M,
  N: upperBase.N,
  Ņ: [...upperBase.N, commaBelow(550)],
  O: upperBase.O,
  P: upperBase.P,
  R: upperBase.R,
  S: upperBase.S,
  Š: [...upperBase.S, capCaron(550)],
  T: upperBase.T,
  U: upperBase.U,
  Ū: [...upperBase.U, capMacron(550)],
  V: upperBase.V,
  Z: upperBase.Z,
  Ž: [...upperBase.Z, capCaron(550)],
  Q: upperBase.Q,
  W: upperBase.W,
  X: upperBase.X,
  Y: upperBase.Y,
}

// --- cipari: augstums 700 ---

export const digits = {
  0: [arc(550, 350, 180, 350, 90, 450)],
  1: [join(line([460, 560], [570, 700]), line([570, 700], [570, 0]))],
  2: [join(arc(550, 520, 160, 180, 160, -30), line([689, 430], [400, 0]), line([400, 0], [720, 0]))],
  3: [join(arc(540, 540, 150, 160, 150, -90), arc(540, 200, 170, 200, 90, -150))],
  4: [join(line([620, 700], [370, 220]), line([370, 220], [740, 220])), line([640, 450], [640, 0])],
  5: [join(line([700, 700], [440, 700]), line([440, 700], [420, 410]), arc(550, 230, 170, 200, 130, -150))],
  6: [join(cubic([680, 660], [480, 760], [380, 500], [380, 250]), arc(550, 220, 170, 220, 180, 540))],
  7: [join(line([380, 700], [720, 700]), line([720, 700], [480, 0]))],
  8: [arc(550, 530, 140, 170, 90, 450), arc(550, 190, 170, 190, 90, 450)],
  9: [join(arc(550, 500, 170, 200, 0, 360), cubic([720, 500], [720, 200], [640, 30], [440, 0]))],
}

// --- pieturzīmes ---

const lowComma = (cx) => join(line([cx + 10, 40], [cx + 5, -30]), line([cx + 5, -30], [cx - 40, -110]))
const highQuote = (cx) => join(line([cx + 10, 600], [cx + 5, 660]), line([cx + 5, 660], [cx + 35, 720]))

export const punctuation = {
  '.': [dot(550, 30)],
  ',': [lowComma(550)],
  '!': [line([550, 700], [550, 200]), dot(550, 30)],
  '?': [join(arc(550, 540, 140, 160, 160, -60), line([620, 401], [550, 300]), line([550, 300], [550, 200])), dot(550, 30)],
  ':': [dot(550, 400), dot(550, 30)],
  ';': [dot(550, 400), lowComma(550)],
  '-': [line([420, 280], [680, 280])],
  '–': [line([330, 280], [770, 280])],
  '(': [arc(720, 350, 220, 420, 140, 220)],
  ')': [arc(380, 350, 220, 420, 40, -40)],
  '„': [lowComma(500), lowComma(610)],
  '“': [highQuote(490), highQuote(600)],
  "'": [line([550, 700], [545, 560])],
  '&': [
    join(
      cubic([720, 0], [500, 250], [380, 450], [470, 620]),
      cubic([470, 620], [540, 740], [660, 640], [580, 520]),
      cubic([580, 520], [380, 350], [300, 120], [460, 30]),
      cubic([460, 30], [580, -30], [680, 100], [720, 250]),
    ),
  ],
  '♥': [
    join(
      cubic([550, 60], [300, 280], [330, 560], [460, 560]),
      cubic([460, 560], [520, 560], [550, 500], [550, 450]),
      cubic([550, 450], [550, 500], [580, 560], [640, 560]),
      cubic([640, 560], [770, 560], [800, 280], [550, 60]),
    ),
  ],
}

/**
 * Zīmes ārpus 33 mazajiem burtiem kā [rakstzīme, vilcieni] pāri. Masīvs, nevis objekts: objektā
 * atslēgas "0".."9" vienmēr nonāktu pirmās un sajauktu secību.
 */
export const moreShapes = [
  ...Object.entries(extra),
  ...Object.entries(upper),
  ...Object.entries(digits),
  ...Object.entries(punctuation),
]
