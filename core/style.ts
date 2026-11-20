import type { FontStyle } from './types'

// Fonta stils (PRD 4. sadaļas 7. solis): līnijas biezums, burtu atstarpes, izmērs, slīpums.
// Stils mainās tikai kontūru būvē (core/outline.ts, core/metrics.ts): kontūras vienmēr
// pārrēķina no vilcieniem. Izkārtotājs un SVG zīmētājs stilu neredz, tāpēc tie paliek
// bait-identiski visās vidēs, un kartītē ceļo jau slīpas, noapaļotas kontūras.
//
// Slīpums ir nobīdes koeficients (leņķa tangenss), nevis grādi: x' = x + (y − SLANT_PIVOT) · slant.
// Kontūru kods to un izmēru lieto kā veselus skaitļus tūkstošdaļās, un punkti jau ir veseli
// skaitļi, tāpēc pārveidojums ir tikai veselu skaitļu reizinājumi un viena dalīšana ar
// noapaļošanu. Trigonometrijas tur nav.

type Limit = { min: number; max: number; step: number }

export const STYLE_LIMITS = {
  /** Pildspalvas biezuma reizinātājs. */
  strokeWidth: { min: 0.5, max: 2, step: 0.1 },
  /**
   * Sānu atstarpe katrā pusē kā daļa no em. Apakšējā robeža sargā glifu no trices: pagriezts un
   * palielināts glifs pie rindas malas nedrīkst iziet ārpus attēla (pārbauda render-svg tests).
   */
  spacing: { min: 0.04, max: 0.16, step: 0.01 },
  /** Slīpuma tangenss: −0,2 ≈ −11°, 0,35 ≈ 19°. Rokraksts parasti slīgst pa labi. */
  slant: { min: -0.2, max: 0.35, step: 0.05 },
  /** Glifu izmērs attiecībā pret laukumu. */
  scale: { min: 0.8, max: 1.25, step: 0.05 },
} as const satisfies Record<keyof FontStyle, Limit>

export const DEFAULT_STYLE: FontStyle = { strokeWidth: 1, spacing: 0.06, slant: 0, scale: 1 }

/** Slīpums griežas ap mazo burtu augstuma vidu, lai burta ķermenis paliktu savā vietā. */
export const SLANT_PIVOT = 225

function snap(value: number, limit: Limit, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const clamped = Math.min(limit.max, Math.max(limit.min, value))
  // Vērtība veselos simtdaļās, lai 0,1 + 0,2 kļūtu par 0,3, nevis 0,30000000000000004.
  const steps = Math.round(clamped / limit.step)
  return Math.round(steps * limit.step * 100) / 100
}

/** Stils robežās un noapaļots līdz solim; nederīgs skaitlis kļūst par noklusējumu. */
export function normalizeStyle(style: FontStyle): FontStyle {
  return {
    strokeWidth: snap(style.strokeWidth, STYLE_LIMITS.strokeWidth, DEFAULT_STYLE.strokeWidth),
    spacing: snap(style.spacing, STYLE_LIMITS.spacing, DEFAULT_STYLE.spacing),
    slant: snap(style.slant, STYLE_LIMITS.slant, DEFAULT_STYLE.slant),
    scale: snap(style.scale, STYLE_LIMITS.scale, DEFAULT_STYLE.scale),
  }
}

export function sameStyle(a: FontStyle, b: FontStyle): boolean {
  return a.strokeWidth === b.strokeWidth && a.spacing === b.spacing && a.slant === b.slant && a.scale === b.scale
}

/** Slīpums un izmērs veselos skaitļos tūkstošdaļās. */
export type StyleUnits = { slant: number; scale: number }

export function styleUnits(style: Partial<Pick<FontStyle, 'slant' | 'scale'>>): StyleUnits {
  return { slant: Math.round((style.slant ?? 0) * 1000), scale: Math.round((style.scale ?? 1) * 1000) }
}

/** Mērogo vērtību (fonta vienībās) ar izmēru tūkstošdaļās; rezultāts ir vesels skaitlis. */
export function scaleUnits(value: number, scale: number): number {
  return Math.round((value * scale) / 1000)
}

/**
 * Izmērs un slīpums poligona punktiem (fonta vienības, y uz augšu, veseli skaitļi):
 *   y' = y · s
 *   x' = x · s + (y · s − SLANT_PIVOT) · k
 * kur s un k ir tūkstošdaļās. Skaitītājs ir precīzs vesels skaitlis (krietni zem 2^53),
 * dalīšana un noapaļošana IEEE 754 ir precīzi noteiktas, tāpēc rezultāts visur ir viens.
 */
export function transformRing<P extends readonly [number, number]>(ring: readonly P[], units: StyleUnits): [number, number][] {
  const { slant: k, scale: s } = units
  return ring.map(([x, y]) => {
    const ys = y * s
    return [Math.round((x * s * 1000 + (ys - SLANT_PIVOT * 1000) * k) / 1_000_000) + 0, Math.round(ys / 1000) + 0]
  })
}
