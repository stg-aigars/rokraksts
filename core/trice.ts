import { createRandom, mix32 } from './random'

// "Trice" (PRD 7. sadaļa): katram glifam neliela nobirze no kartītes sēklas.
//
// Lai layout un render-svg būtu bait-identiski visās vidēs, šeit nav Math.sin/cos (to
// rezultāts drīkst atšķirties starp dzinējiem). Rotāciju un mērogu izsakām ar veseliem
// skaitļiem tūkstošdaļās:
//   rotate  leņķa sinuss tūkstošdaļās, −26..26 (sin 1,5° = 0,02618, tātad leņķis ≤ 1,49°)
//   scale   mērogs tūkstošdaļās, 981..1019
//   shift   pamatlīnijas nobīde fonta vienībās, −10..10 (1% no em)
// Matrica ir a = d = scale, b = scale × rotate / 1000 (noapaļots uz nulles pusi), c = −b.
// Tik mazam leņķim kosinuss no 1 atšķiras par mazāk nekā 0,035%, kas ir zem tūkstošdaļu
// režģa, tāpēc to neskaitām; kopējais mērogs √(a² + b²) paliek ±2% robežās, jo scale
// robeža ir par vienu tūkstošdaļu šaurāka. Reizināšana, dalīšana un noapaļošana ir IEEE 754
// precīzi noteiktas, tāpēc tās visur dod vienu un to pašu.

export const TRICE_LIMITS = { rotate: 26, scale: 19, shift: 10 } as const

export type Trice = { rotate: number; scale: number; shift: number }

/** SVG matrica: a b c d tūkstošdaļās, e f fonta vienībās; visi veseli skaitļi. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number]

const STREAM = 2

/**
 * Nobirze rakstzīmei ar kārtas numuru `index` tekstā. Atkarīga tikai no sēklas un vietas,
 * nevis no tā, kuri citi burti jau uzrakstīti: jauns burts nemaina pārējo burtu trici.
 */
export function triceAt(seed: number, index: number): Trice {
  const random = createRandom(mix32(seed, STREAM, index))
  return {
    rotate: random.int(-TRICE_LIMITS.rotate, TRICE_LIMITS.rotate),
    scale: 1000 + random.int(-TRICE_LIMITS.scale, TRICE_LIMITS.scale),
    shift: random.int(-TRICE_LIMITS.shift, TRICE_LIMITS.shift),
  }
}

/**
 * Matrica glifam, kura sākums uz pamatlīnijas ir (x, y) un platums `advance` (SVG
 * koordinātas, y uz leju). Griež un mērogo ap glifa vidu uz pamatlīnijas, lai burts paliktu
 * savā vietā rindā; `shift` pēc tam pārbīda pamatlīniju.
 */
export function triceMatrix(trice: Trice, x: number, y: number, advance: number): Matrix {
  const a = trice.scale
  // `| 0` noapaļo uz nulles pusi un nekad nedod negatīvo nulli.
  const b = ((trice.scale * trice.rotate) / 1000) | 0
  const cx = Math.round(advance / 2)
  const e = x + cx - Math.round((a * cx) / 1000)
  const f = y + trice.shift - Math.round((b * cx) / 1000)
  return [a, b, 0 - b, a, e + 0, f + 0]
}

/** Tūkstošdaļas kā decimāldaļa bez liekām nullēm; virkni saliek no veseliem skaitļiem. */
function thousandths(n: number): string {
  const abs = Math.abs(n)
  const whole = Math.floor(abs / 1000)
  const fraction = String(abs % 1000).padStart(3, '0').replace(/0+$/, '')
  return `${n < 0 ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

/** Matricas saturs SVG `matrix(...)` iekavām. */
export function formatMatrix([a, b, c, d, e, f]: Matrix): string {
  return `${thousandths(a)} ${thousandths(b)} ${thousandths(c)} ${thousandths(d)} ${e} ${f}`
}
