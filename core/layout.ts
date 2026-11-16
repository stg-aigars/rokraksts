import type { Charset } from './charsets'
import type { CompiledFont } from './font'

// Teksts -> novietoti glifi (PRD 6. sadaļas 7. solis). To lieto priekšskatījums un vēlāk
// kartītes un kopīgošanas lapa, klientā un serverī. Tāpēc šeit ir tikai veselu skaitļu
// saskaitīšana un salīdzināšana: rezultāts ir vienāds jebkurā vidē.
// Koordinātas ir fonta vienībās ar y uz leju; glifa (x, y) ir tā sākums uz pamatlīnijas.

/** Atstarpes platums fonta vienībās. */
export const SPACE_ADVANCE = 300
/** Vieta, ko aizņem neuzrakstīta rakstzīme. */
export const MISSING_ADVANCE = 420
/** Attālums starp pamatlīnijām kā daļa no (augšējā − apakšējā robeža); rezerve zīmēm. */
export const DEFAULT_LINE_HEIGHT = 1.15

export type LayoutOptions = {
  /** Rindas platums fonta vienībās. */
  maxWidth: number
  align?: 'left' | 'center'
  lineHeight?: number
}

export type PlacedGlyph = { char: string; variant: number; x: number; y: number }
/** Neuzrakstīta rakstzīme: vieta ir rezervēta, bet glifa nav (un nekad nav cita burta). */
export type PlacedMissing = { char: string; x: number; y: number; advance: number }
export type LayoutLine = { x: number; y: number; width: number }

export type Layout = {
  /** Teksts pēc NFC normalizācijas un aizstāšanām. */
  text: string
  width: number
  height: number
  lines: LayoutLine[]
  glyphs: PlacedGlyph[]
  missing: PlacedMissing[]
  /** Neuzrakstītās rakstzīmes bez dublikātiem, teksta secībā. */
  missingChars: string[]
}

/**
 * NFC, aizstāšanas no rakstzīmju kopas, atstarpju sakārtošana. Atstarpju virknes saplūst
 * vienā, rindu malās tās pazūd; rindu pārnesumi paliek.
 */
export function prepareText(text: string, charset: Charset): string {
  const substituted = [...text.normalize('NFC')].map((c) => charset.substitutions[c] ?? c).join('')
  return substituted
    .split(/\r\n|\r|\n/)
    .map((line) => line.split(/[ \t]+/).filter(Boolean).join(' '))
    .join('\n')
}

type Item = { char: string; advance: number; missing: boolean }

export function layoutText(text: string, font: CompiledFont, charset: Charset, options: LayoutOptions): Layout {
  const prepared = prepareText(text, charset)
  const maxWidth = Math.max(0, Math.round(options.maxWidth))
  const { ascender, descender } = font.metrics
  const lineAdvance = Math.round((ascender - descender) * (options.lineHeight ?? DEFAULT_LINE_HEIGHT))

  const item = (char: string): Item => {
    // 2. posmā vienmēr pirmais variants; variantu maiņa pēc sēklas nāk 3. posmā.
    const glyph = font.glyphs[char]?.[0]
    return glyph ? { char, advance: glyph.advance, missing: false } : { char, advance: MISSING_ADVANCE, missing: true }
  }
  const widthOf = (items: Item[]) => items.reduce((sum, i) => sum + i.advance, 0)

  // Rindas kā vārdu saraksti; vārds ir rakstzīmju virkne bez atstarpēm.
  const rows: Item[][][] = []
  for (const paragraph of prepared.split('\n')) {
    let row: Item[][] = []
    let rowWidth = 0
    const flush = () => {
      rows.push(row)
      row = []
      rowWidth = 0
    }
    for (const wordText of paragraph === '' ? [] : paragraph.split(' ')) {
      let word = [...wordText].map(item)
      const needed = () => (row.length > 0 ? SPACE_ADVANCE : 0) + widthOf(word)
      if (row.length > 0 && rowWidth + needed() > maxWidth) flush()
      // Vārds, kas garāks par rindu, tiek lauzts pa burtiem; katrā rindā vismaz viens.
      while (widthOf(word) > maxWidth && word.length > 1) {
        let count = 1
        while (count < word.length && widthOf(word.slice(0, count + 1)) <= maxWidth) count++
        rows.push([word.slice(0, count)])
        word = word.slice(count)
      }
      rowWidth += needed()
      row.push(word)
    }
    flush()
  }

  const layout: Layout = {
    text: prepared,
    width: maxWidth,
    height: ascender - descender + (rows.length - 1) * lineAdvance,
    lines: [],
    glyphs: [],
    missing: [],
    missingChars: [],
  }

  rows.forEach((row, index) => {
    const width = row.reduce((sum, word) => sum + widthOf(word), 0) + Math.max(0, row.length - 1) * SPACE_ADVANCE
    const x0 = options.align === 'center' ? Math.floor((maxWidth - width) / 2) : 0
    const y = ascender + index * lineAdvance
    layout.lines.push({ x: x0, y, width })
    let x = x0
    row.forEach((word, wordIndex) => {
      if (wordIndex > 0) x += SPACE_ADVANCE
      for (const { char, advance, missing } of word) {
        if (missing) {
          layout.missing.push({ char, x, y, advance })
          if (!layout.missingChars.includes(char)) layout.missingChars.push(char)
        } else layout.glyphs.push({ char, variant: 0, x, y })
        x += advance
      }
    })
  })
  return layout
}
