import { describe, expect, it } from 'vitest'
import { getCharset } from './charsets'
import type { CompiledFont, CompiledGlyph } from './font'
import {
  MISSING_ADVANCE,
  SPACE_ADVANCE,
  TRICE_MARGIN,
  layoutText as layoutWithTrice,
  missingAdvance,
  prepareText,
  spaceAdvance,
} from './layout'
import type { Layout, LayoutOptions } from './layout'
import { triceAt, triceMatrix } from './trice'

const lv = getCharset('lv')

/** Mākslīgs fonts ar zināmiem platumiem, lai izkārtojumu varētu pārbaudīt ar galvas rēķinu. */
function fakeFont(advances: Record<string, number>): CompiledFont {
  const glyphs: Record<string, CompiledGlyph[]> = {}
  for (const [char, advance] of Object.entries(advances)) {
    glyphs[char] = [{ path: 'M0 0L1 0L1 -1Z', advance, bounds: { xMin: 0, xMax: advance, yMin: 0, yMax: 450 } }]
  }
  return { metrics: { upm: 1000, ascender: 700, descender: -250, xHeight: 450, capHeight: 700 }, glyphs }
}

/** Tīrs izkārtojums bez trices: pozīcijas var pārbaudīt ar galvas rēķinu. */
const layoutText = (text: string, f: CompiledFont, charset: typeof lv, options: LayoutOptions) =>
  layoutWithTrice(text, f, charset, { trice: false, ...options })

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

  it('neuzrakstīts Ā netiek aizstāts ne ar A, ne ar ā', () => {
    const layout = layoutText('ĀAā', fakeFont({ A: 500, ā: 450 }), lv, { maxWidth: 5000 })
    expect(chars(layout)).toBe('Aā')
    expect(layout.missingChars).toEqual(['Ā'])
    expect(layout.missing[0]).toEqual({ char: 'Ā', x: 0, y: 700, advance: MISSING_ADVANCE })
  })
})

/** Mākslīgs fonts, kur katram burtam ir vairāki varianti ar dažādiem platumiem. */
function variantFont(advances: Record<string, number[]>): CompiledFont {
  const base = fakeFont({})
  for (const [char, list] of Object.entries(advances)) {
    base.glyphs[char] = list.map((advance) => ({
      path: 'M0 0L1 0L1 -1Z',
      advance,
      bounds: { xMin: 0, xMax: advance, yMin: 0, yMax: 450 },
    }))
  }
  return base
}

const variantsOf = (layout: Layout, char: string) => layout.glyphs.filter((g) => g.char === char).map((g) => g.variant)

describe('atstarpes atkarībā no izmēra', () => {
  it('ar noklusējuma mazo burtu augstumu atstarpe ir 300 un neuzrakstītas zīmes vieta 420', () => {
    expect(spaceAdvance(font.metrics)).toBe(SPACE_ADVANCE)
    expect(missingAdvance(font.metrics)).toBe(MISSING_ADVANCE)
    expect([SPACE_ADVANCE, MISSING_ADVANCE]).toEqual([300, 420])
  })

  it('lielākam fontam atstarpe un tukšā vieta ir proporcionāli lielāka, veseli skaitļi', () => {
    const big = { ...font.metrics, xHeight: 563 }
    expect(spaceAdvance(big)).toBe(375)
    expect(missingAdvance(big)).toBe(525)
    const big2 = { ...font, metrics: { ...font.metrics, ascender: 875, descender: -313, xHeight: 563 } }
    const layout = layoutText('a z', big2, lv, { maxWidth: 5000 })
    expect(layout.missing[0]!.x).toBe(500 + 375)
    expect(layout.missing[0]!.advance).toBe(525)
  })

  it('trices rezerve virs un zem teksta aug kopā ar izmēru', () => {
    const big = { ...font, metrics: { ...font.metrics, ascender: 875, descender: -313, xHeight: 563 } }
    const layout = layoutWithTrice('a', big, lv, { maxWidth: 5000 })
    expect(layout.lines[0]!.y).toBe(63 + 875)
    expect(layout.height).toBe(875 + 313 + 2 * 63)
    expect(layoutWithTrice('a', font, lv, { maxWidth: 5000 }).lines[0]!.y).toBe(TRICE_MARGIN + 700)
  })
})

describe('variantu maiņa', () => {
  const three = variantFont({ a: [500, 510, 520], b: [400, 410], c: [300] })

  it('atkārtoti burti izmanto dažādus variantus pēc kārtas', () => {
    const layout = layoutText('aaaaaa', three, lv, { maxWidth: 9000, seed: 4 })
    const seq = variantsOf(layout, 'a')
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBe((seq[i - 1]! + 1) % 3)
    expect(new Set(seq).size).toBe(3)
  })

  it('secīgi vienādi burti atšķiras arī tad, ja starp tiem ir citi burti, atstarpes un rindas', () => {
    for (let seed = 0; seed < 50; seed++) {
      const layout = layoutText('ab ca\nba cab a', three, lv, { maxWidth: 1500, seed })
      for (const char of ['a', 'b']) {
        const seq = variantsOf(layout, char)
        for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
      }
      expect(variantsOf(layout, 'c')).toEqual([0, 0])
    }
  })

  it('katrs variants aizņem savu platumu', () => {
    const layout = layoutText('aaa', three, lv, { maxWidth: 9000, seed: 1 })
    const widths = variantsOf(layout, 'a').map((v) => [500, 510, 520][v]!)
    expect(xs(layout)).toEqual([0, widths[0]!, widths[0]! + widths[1]!])
    expect(layout.lines[0]!.width).toBe(1530)
  })

  it('sēkla nosaka, ar kuru variantu sāk; bez sēklas tā ir 0', () => {
    const starts = new Set(
      Array.from({ length: 30 }, (_, seed) => variantsOf(layoutText('a', three, lv, { maxWidth: 9000, seed }), 'a')[0]),
    )
    expect([...starts].sort()).toEqual([0, 1, 2])
    expect(layoutText('aba', three, lv, { maxWidth: 9000 })).toEqual(layoutText('aba', three, lv, { maxWidth: 9000, seed: 0 }))
  })

  it('neuzrakstīta rakstzīme paliek tukša vieta arī tad, ja citiem burtiem ir varianti', () => {
    const layout = layoutText('aāa', three, lv, { maxWidth: 9000, seed: 2 })
    expect(chars(layout)).toBe('aa')
    expect(layout.missingChars).toEqual(['ā'])
  })
})

describe('trice izkārtojumā', () => {
  const three = variantFont({ a: [500, 510, 520], b: [400, 410], c: [300] })
  const options = { maxWidth: 4000, seed: 12 }

  it('bez trices glifiem matricas nav', () => {
    expect(layoutText('ab', three, lv, options).glyphs.every((g) => g.matrix === undefined)).toBe(true)
  })

  it('katram glifam ir matrica no sēklas un vietas tekstā', () => {
    const layout = layoutWithTrice('ab a', three, lv, options)
    // Vieta tekstā skaita rakstzīmes bez atstarpēm: a = 0, b = 1, a = 2.
    layout.glyphs.forEach((g, i) => {
      const advance = three.glyphs[g.char]![g.variant]!.advance
      expect(g.matrix).toEqual(triceMatrix(triceAt(12, i), g.x, g.y, advance))
    })
    expect(new Set(layout.glyphs.map((g) => JSON.stringify(g.matrix!.slice(0, 4)))).size).toBeGreaterThan(1)
  })

  it('pozīcijas un rindu laušana no trices nav atkarīgas; ir tikai rezerve augšā un apakšā', () => {
    const plain = layoutText('ab ca\nba cab a', three, lv, { ...options, maxWidth: 1500 })
    const shaky = layoutWithTrice('ab ca\nba cab a', three, lv, { ...options, maxWidth: 1500 })
    expect(shaky.glyphs.map((g) => [g.char, g.variant, g.x, g.y - TRICE_MARGIN])).toEqual(
      plain.glyphs.map((g) => [g.char, g.variant, g.x, g.y]),
    )
    expect(shaky.height).toBe(plain.height + 2 * TRICE_MARGIN)
    expect(shaky.width).toBe(plain.width)
  })

  it('tā pati sēkla dod identisku izkārtojumu, cita sēkla citu', () => {
    const a = layoutWithTrice('abba cab', three, lv, options)
    const b = layoutWithTrice('abba cab', three, lv, options)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(layoutWithTrice('abba cab', three, lv, { ...options, seed: 13 }))).not.toBe(JSON.stringify(a))
  })

  it('jauna burta uzrakstīšana nemaina pārējo burtu trici (priekšskatījums nelēkā)', () => {
    const before = layoutWithTrice('abca', variantFont({ a: [500], c: [300] }), lv, options)
    const after = layoutWithTrice('abca', variantFont({ a: [500], b: [420], c: [300] }), lv, options)
    expect(before.missingChars).toEqual(['b'])
    const pick = (layout: Layout, char: string) => layout.glyphs.filter((g) => g.char === char).map((g) => g.matrix)
    // b aizņem tikpat, cik trūkstošās zīmes vieta (420), tāpēc pārējie burti paliek uz vietas.
    expect(pick(after, 'a')).toEqual(pick(before, 'a'))
    expect(pick(after, 'c')).toEqual(pick(before, 'c'))
  })

  it('visi skaitļi ir veseli', () => {
    const layout = layoutWithTrice('ab abc\nca b', three, lv, { maxWidth: 1777, align: 'center', lineHeight: 1.237, seed: 99 })
    expect(layout.glyphs.flatMap((g) => [g.x, g.y, ...g.matrix!]).every(Number.isInteger)).toBe(true)
  })
})
