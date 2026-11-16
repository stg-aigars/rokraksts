import { describe, expect, it } from 'vitest'
import { getCharset } from './charsets'
import type { CompiledFont, CompiledGlyph } from './font'
import { MISSING_ADVANCE, SPACE_ADVANCE, layoutText, prepareText } from './layout'
import type { Layout } from './layout'

const lv = getCharset('lv')

/** Mākslīgs fonts ar zināmiem platumiem, lai izkārtojumu varētu pārbaudīt ar galvas rēķinu. */
function fakeFont(advances: Record<string, number>): CompiledFont {
  const glyphs: Record<string, CompiledGlyph[]> = {}
  for (const [char, advance] of Object.entries(advances)) {
    glyphs[char] = [{ path: 'M0 0L1 0L1 -1Z', advance, bounds: { xMin: 0, xMax: advance, yMin: 0, yMax: 450 } }]
  }
  return { metrics: { upm: 1000, ascender: 700, descender: -250, xHeight: 450, capHeight: 700 }, glyphs }
}

const font = fakeFont({ a: 500, ā: 500, b: 400, c: 300, '.': 100, '–': 600, '“': 200 })
const chars = (layout: Layout) => layout.glyphs.map((g) => g.char).join('')
const xs = (layout: Layout) => layout.glyphs.map((g) => g.x)

describe('teksta sagatavošana', () => {
  it('normalizē uz NFC: a + kombinējamā garumzīme kļūst par ā', () => {
    expect(prepareText('ā', lv)).toBe('ā')
    expect(chars(layoutText('ā', font, lv, { maxWidth: 5000 }))).toBe('ā')
  })

  it('lieto aizstāšanas no rakstzīmju kopas', () => {
    expect(prepareText('"a” — b…', lv)).toBe('“a“ – b...')
  })

  it('aizstāšanas ir dati: cita kopa dod citu rezultātu bez koda izmaiņām', () => {
    const other = { ...lv, substitutions: { a: 'b' } }
    expect(prepareText('a"', other)).toBe('b"')
  })

  it('atstarpju virknes saplūst, rindas malās tās pazūd, rindu pārnesumi paliek', () => {
    expect(prepareText('  a \t b  \r\n c ', lv)).toBe('a b\nc')
  })
})

describe('izkārtojums', () => {
  it('glifi stāv viens aiz otra pēc platumiem; atstarpe ir tukša vieta', () => {
    const layout = layoutText('ab c', font, lv, { maxWidth: 5000 })
    expect(chars(layout)).toBe('abc')
    expect(xs(layout)).toEqual([0, 500, 900 + SPACE_ADVANCE])
    expect(layout.lines).toEqual([{ x: 0, y: 700, width: 900 + SPACE_ADVANCE + 300 }])
    expect(layout.glyphs.every((g) => g.y === 700 && g.variant === 0)).toBe(true)
  })

  it('augstums ir viena rinda no augšējās līdz apakšējai robežai; platums ir dotais', () => {
    const layout = layoutText('a', font, lv, { maxWidth: 5000 })
    expect(layout.width).toBe(5000)
    expect(layout.height).toBe(950)
  })

  it('rindas lauž pa vārdiem', () => {
    // "ab" = 900, "abc" = 1200; platumā 2400 ietilpst "ab abc" (2400), bet ne vēl viens vārds.
    const layout = layoutText('ab abc ab', font, lv, { maxWidth: 900 + SPACE_ADVANCE + 1200 })
    expect(layout.lines).toHaveLength(2)
    expect(layout.lines[0]!.width).toBe(900 + SPACE_ADVANCE + 1200)
    expect(layout.lines[1]!.width).toBe(900)
    expect(layout.glyphs.filter((g) => g.y === layout.lines[1]!.y).map((g) => g.char)).toEqual(['a', 'b'])
  })

  it('vārds, kas ir tieši par vienu vienību par platu, pāriet uz nākamo rindu', () => {
    const layout = layoutText('ab abc', font, lv, { maxWidth: 900 + SPACE_ADVANCE + 1200 - 1 })
    expect(layout.lines.map((l) => l.width)).toEqual([900, 1200])
  })

  it('vārdu, kas garāks par rindu, lauž pa burtiem', () => {
    const layout = layoutText('aaaaa', font, lv, { maxWidth: 1200 })
    expect(layout.lines.map((l) => l.width)).toEqual([1000, 1000, 500])
  })

  it('pat ja rindā neietilpst neviens burts, katrā rindā ir vismaz viens', () => {
    const layout = layoutText('aa', font, lv, { maxWidth: 100 })
    expect(layout.lines).toHaveLength(2)
  })

  it('jaunas rindas rakstzīme sāk jaunu rindu; tukša rinda saglabājas', () => {
    const layout = layoutText('a\n\nb', font, lv, { maxWidth: 5000 })
    expect(layout.lines.map((l) => l.width)).toEqual([500, 0, 400])
    expect(layout.glyphs.map((g) => g.y)).toEqual([layout.lines[0]!.y, layout.lines[2]!.y])
  })

  it('rindstarpa: attālums starp pamatlīnijām ir (augša − apakša) × lineHeight, noapaļots', () => {
    const tight = layoutText('a\na', font, lv, { maxWidth: 5000, lineHeight: 1 })
    expect(tight.lines.map((l) => l.y)).toEqual([700, 1650])
    expect(tight.height).toBe(1900)

    const loose = layoutText('a\na\na', font, lv, { maxWidth: 5000, lineHeight: 1.3 })
    expect(loose.lines.map((l) => l.y)).toEqual([700, 700 + 1235, 700 + 2 * 1235])
    expect(loose.height).toBe(950 + 2 * 1235)
  })

  it('noklusējuma rindstarpai ir rezerve, lai zīmes nesadurtos ar blakus rindām', () => {
    const layout = layoutText('a\na', font, lv, { maxWidth: 5000 })
    expect(layout.lines[1]!.y - layout.lines[0]!.y).toBeGreaterThan(950)
  })

  it('līdzinājums pa kreisi sāk katru rindu no 0', () => {
    const layout = layoutText('ab\nc', font, lv, { maxWidth: 2001 })
    expect(layout.lines.map((l) => l.x)).toEqual([0, 0])
  })

  it('līdzinājums centrā novieto katru rindu vidū ar veselu nobīdi', () => {
    const layout = layoutText('ab\nc', font, lv, { maxWidth: 2001, align: 'center' })
    expect(layout.lines.map((l) => l.x)).toEqual([550, 850])
    expect(xs(layout)).toEqual([550, 1050, 850])
  })

  it('visas koordinātas ir veseli skaitļi', () => {
    const layout = layoutText('ab abc\nca b', font, lv, { maxWidth: 1777, align: 'center', lineHeight: 1.237 })
    const numbers = [
      layout.width,
      layout.height,
      ...layout.glyphs.flatMap((g) => [g.x, g.y]),
      ...layout.lines.flatMap((l) => [l.x, l.y, l.width]),
    ]
    expect(numbers.every(Number.isInteger)).toBe(true)
  })

  it('tukšs teksts dod vienu tukšu rindu', () => {
    const layout = layoutText('', font, lv, { maxWidth: 1000 })
    expect(layout.glyphs).toEqual([])
    expect(layout.lines).toEqual([{ x: 0, y: 700, width: 0 }])
  })

  it('aizstātās rakstzīmes izmanto aizstājēja glifu: … kļūst par trim punktiem', () => {
    const layout = layoutText('a…', font, lv, { maxWidth: 5000 })
    expect(chars(layout)).toBe('a...')
    expect(layout.text).toBe('a...')
  })
})

describe('neuzrakstītas rakstzīmes', () => {
  it('neuzrakstīts ā nekad netiek aizstāts ar a', () => {
    const noMacron = fakeFont({ a: 500 })
    const layout = layoutText('aāa', noMacron, lv, { maxWidth: 5000 })
    expect(chars(layout)).toBe('aa')
    expect(layout.missing).toEqual([{ char: 'ā', x: 500, y: 700, advance: MISSING_ADVANCE }])
    // Trūkstošā zīme aizņem vietu, nākamais burts nepārbīdās tās vietā.
    expect(xs(layout)).toEqual([0, 500 + MISSING_ADVANCE])
  })

  it('trūkstošo zīmju saraksts ir bez dublikātiem, teksta secībā', () => {
    const layout = layoutText('zāz yā', font, lv, { maxWidth: 9000 })
    expect(layout.missingChars).toEqual(['z', 'y'])
    expect(layout.missing).toHaveLength(3)
  })

  it('lielais burts netiek aizstāts ar mazo', () => {
    const layout = layoutText('Aa', font, lv, { maxWidth: 5000 })
    expect(chars(layout)).toBe('a')
    expect(layout.missingChars).toEqual(['A'])
  })
})
