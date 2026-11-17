import type { FontMetrics, Stroke } from './types'

// Zīmēšanas laukuma ģeometrija fonta vienībās (1000 uz em, pamatlīnija y = 0, y aug uz augšu).
// Virs augšējās līnijas un zem apakšējās ir brīva josla diakritiskajām zīmēm (PRD 5. sadaļa).

export const PAD = {
  width: 1100,
  /** Laukuma augšmala: 250 vienības virs augšējās līnijas (Ā, Č, ģ). */
  top: 950,
  /** Laukuma apakšmala: 200 vienības zem apakšējās līnijas (ķ, ļ, ņ, Ģ). */
  bottom: -450,
  lines: {
    ascender: 700,
    xHeight: 450,
    baseline: 0,
    descender: -250,
  },
  /** Ieejas un izejas palīgpunkti uz pamatlīnijas (PRD 7. sadaļa). */
  guides: [
    { x: 150, y: 0 },
    { x: 950, y: 0 },
  ],
} as const

export const PAD_HEIGHT = PAD.top - PAD.bottom

export type PadSize = { width: number; height: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Ekrāna koordinātas (pikseļi no laukuma kreisā augšējā stūra) -> fonta vienības.
 * Rezultāts ir veseli skaitļi un nekad neiziet ārpus laukuma.
 */
export function toFontUnits(px: number, py: number, size: PadSize): { x: number; y: number } {
  const fx = size.width > 0 ? px / size.width : 0
  const fy = size.height > 0 ? py / size.height : 0
  return {
    x: Math.round(clamp(fx * PAD.width, 0, PAD.width)),
    y: Math.round(clamp(PAD.top - fy * PAD_HEIGHT, PAD.bottom, PAD.top)),
  }
}

/** Fonta vienību y -> laukuma SVG y (viewBox 0 0 PAD.width PAD_HEIGHT, y aug uz leju). */
export function toPadY(y: number): number {
  return PAD.top - y
}

/**
 * Spiediens 0..1 tikai tad, ja ierīce to tiešām mēra. Pele to nemēra, un ierīces bez sensora
 * ziņo 0.5 (vai 0), tāpēc šīs vērtības atmetam; platumu tad vēlāk simulē no ātruma.
 */
export function normalizePressure(pressure: number, pointerType: string): number | undefined {
  if (pointerType === 'mouse') return undefined
  if (!Number.isFinite(pressure) || pressure <= 0 || pressure === 0.5) return undefined
  return Math.round(clamp(pressure, 0, 1) * 1000) / 1000
}

/** Vilciens kā SVG ceļš laukuma koordinātās; tikai attēlošanai, nevis glifa kontūra. */
export function strokePath(stroke: Stroke): string {
  return stroke.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${toPadY(p.y)}`)
    .join('')
    .concat(stroke.points.length === 1 ? 'h0' : '')
}

/** Lauzta līnija [x0, y0, x1, y1, ...] fonta vienībās kā SVG ceļš laukuma koordinātās (blāvais paraugs). */
export function polylinePath(points: readonly number[]): string {
  let d = ''
  for (let i = 0; i + 1 < points.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${points[i]} ${toPadY(points[i + 1]!)}`
  return d
}

/** Sākuma metrika no laukuma līnijām; faktisko rēķinās 2. posmā no uzzīmētā. */
export function defaultMetrics(): FontMetrics {
  return {
    upm: 1000,
    ascender: PAD.lines.ascender,
    descender: PAD.lines.descender,
    xHeight: PAD.lines.xHeight,
    capHeight: PAD.lines.ascender,
  }
}
