// Datu modelis no PRD 10. sadaļas. Patiesības avots ir vilcieni, nevis kontūras.

/** Fonta vienības (1000 uz em, pamatlīnija y = 0), laiks ms, spiediens 0..1. */
export type Point = { x: number; y: number; t: number; p?: number }

export type Stroke = { points: Point[] }

export type GlyphVariant = {
  strokes: Stroke[]
  /** Ja lietotājs pielāgojis platumu. */
  advance?: number
}

export type Glyph = {
  /** Viena NFC rakstzīme: 'a', 'ā', 'Ķ', '!' ... */
  char: string
  /** 1..3; pirmais ir obligāts. */
  variants: GlyphVariant[]
}

export type CharsetId = 'lv'

export type FontMetrics = {
  upm: 1000
  ascender: number
  descender: number
  xHeight: number
  capHeight: number
}

export type FontStyle = {
  strokeWidth: number
  spacing: number
  slant: number
  scale: number
}

export type FontProject = {
  id: string
  schemaVersion: 1
  name: string
  charset: CharsetId
  createdAt: string
  metrics: FontMetrics
  style: FontStyle
  /** Atslēga = rakstzīme. */
  glyphs: Record<string, Glyph>
}

export type CardFormat = 'square' | 'portrait' | 'story'

export type Card = {
  id: string
  schemaVersion: 1
  /** NFC. */
  text: string
  format: CardFormat
  templateId: string
  /** Hex krāsa. */
  ink: string
  align: 'left' | 'center'
  /** Nosaka variantu secību un trici. */
  seed: number
  metrics: FontMetrics
  /** Rakstzīme -> SVG path katram variantam; tikai tekstā izmantotās. */
  outlines: Record<string, string[]>
  /**
   * Rakstzīme -> platums katram variantam (tā pati secība kā `outlines`). Bez tā izkārtojumu no
   * kartītes datiem nevar atkārtot (5. posmā papildināts PRD 10. sadaļas modelis).
   */
  advances: Record<string, number[]>
}

export const MAX_VARIANTS = 3
export const UNITS_PER_EM = 1000
