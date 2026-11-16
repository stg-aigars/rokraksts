// 0. posma pārbaude (PRD 6. un 11. sadaļa): vai opentype.js prot ierakstīt fontu ar latviešu
// kodpunktiem un GSUB funkcijām (liga, calt), un vai wawoff2 to saspiež WOFF2.
// Secinājumi ir pierakstīti CLAUDE.md; šis tests tos sargā, kad bibliotēkas tiek atjauninātas.
import * as opentype from 'opentype.js'
import wawoff2 from 'wawoff2'
import { describe, expect, it } from 'vitest'
import { allChars, getCharset } from '@/core/charsets'

const chars = allChars(getCharset('lv'))

function box(name: string, unicode: number | undefined, size: number) {
  const path = new opentype.Path()
  path.moveTo(50, 0)
  path.lineTo(50, size)
  path.lineTo(50 + size, size)
  path.lineTo(50 + size, 0)
  path.close()
  return new opentype.Glyph({ name, unicode, advanceWidth: size + 100, path })
}

function buildFont() {
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: new opentype.Path() }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 300, path: new opentype.Path() }),
    ...chars.map((c, i) => box(`u${c.codePointAt(0)!.toString(16)}`, c.codePointAt(0), 300 + i)),
    box('a.alt', undefined, 777),
    box('a_a', undefined, 888),
  ]
  const font = new opentype.Font({
    familyName: 'Rokraksts Tests',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 900,
    descender: -300,
    glyphs,
  })
  return { font, count: glyphs.length }
}

describe('opentype.js + wawoff2', () => {
  it('ieraksta OTF ar visiem 99 kopas kodpunktiem un nolasa to atpakaļ', () => {
    const { font, count } = buildFont()
    const parsed = opentype.parse(font.toArrayBuffer())

    expect(parsed.glyphs.length).toBe(count)
    expect(parsed.unitsPerEm).toBe(1000)
    for (const c of chars) {
      const glyph = parsed.charToGlyph(c)
      expect(glyph.index, c).toBeGreaterThan(0)
      expect(glyph.unicode, c).toBe(c.codePointAt(0))
    }
  })

  it('ieraksta GSUB ligatūru (liga), kas saglabājas pēc nolasīšanas', () => {
    const { font, count } = buildFont()
    const a = font.charToGlyphIndex('a')
    font.substitution.add('liga', { sub: [a, a], by: count - 1 })

    const parsed = opentype.parse(font.toArrayBuffer())
    expect(parsed.tables.gsub).toBeTruthy()
    expect(parsed.substitution.getLigatures('liga')).toEqual([{ sub: [a, a], by: count - 1 }])
  })

  it('ieraksta alternatīvos glifus (salt/aalt) variantiem', () => {
    const { font, count } = buildFont()
    const a = font.charToGlyphIndex('a')
    font.substitution.add('salt', { sub: a, by: [count - 2] })

    const parsed = opentype.parse(font.toArrayBuffer())
    expect(parsed.substitution.getAlternates('salt')).toEqual([{ sub: a, by: [count - 2] }])
  })

  it('augstā līmeņa API klusi ignorē calt: GSUB netiek ierakstīts', () => {
    // substitution.add() pazīst tikai aalt, salt, ssNN, liga, dlig, rlig, ccmp. Bibliotēkā gan ir
    // zema līmeņa GSUB 5. un 6. tipa tabulu rakstītāji, tāpēc calt varētu būvēt ar rokām;
    // tas jāpārbauda pēc MVP, pirms izvēlas fontTools.
    const { font, count } = buildFont()
    const a = font.charToGlyphIndex('a')
    expect(font.substitution.add('calt', { sub: [a, a], by: count - 2 })).toBeUndefined()

    const parsed = opentype.parse(font.toArrayBuffer())
    expect(parsed.tables.gsub).toBeUndefined()
  })

  it('wawoff2 saspiež OTF uz WOFF2 un atspiež atpakaļ nolasāmu fontu', async () => {
    const { font, count } = buildFont()
    const otf = new Uint8Array(font.toArrayBuffer())

    const woff2: Uint8Array = await wawoff2.compress(otf)
    expect(new TextDecoder().decode(woff2.slice(0, 4))).toBe('wOF2')
    expect(woff2.byteLength).toBeLessThan(otf.byteLength)

    const back: Uint8Array = await wawoff2.decompress(woff2)
    const parsed = opentype.parse(back.buffer.slice(back.byteOffset, back.byteOffset + back.byteLength))
    expect(parsed.glyphs.length).toBe(count)
    expect(parsed.charToGlyph('ķ').unicode).toBe(0x0137)
  })
})
