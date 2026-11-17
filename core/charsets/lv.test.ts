import { describe, expect, it } from 'vitest'
import { PAD } from '../pad'
import { allChars, getCharset, requiredChars } from './index'

const lv = getCharset('lv')
const chars = allChars(lv)
const group = (id: string) => lv.groups.find((g) => g.id === id)!.chars

describe('latviešu rakstzīmju kopa', () => {
  it('satur 99 rakstzīmes pa grupām 33 + 4 + 37 + 10 + 15', () => {
    expect(lv.groups.map((g) => g.chars.length)).toEqual([33, 4, 37, 10, 15])
    expect(chars).toHaveLength(99)
  })

  it('nesatur dublikātus', () => {
    expect(new Set(chars).size).toBe(chars.length)
  })

  it('katra rakstzīme ir viens NFC kodpunkts', () => {
    for (const c of chars) {
      expect([...c], c).toHaveLength(1)
      expect(c.normalize('NFC'), c).toBe(c)
    }
  })

  it('mazie burti ir alfabēta secībā: burts ar zīmi uzreiz pēc pamatburta', () => {
    expect(group('lower').join('')).toBe('aābcčdeēfgģhiījkķlļmnņoprsštuūvzž')
    expect(requiredChars(lv)).toEqual([...group('lower')])
  })

  it('lielie burti atbilst mazajiem, ieskaitot Q W X Y', () => {
    expect(group('upper').join('')).toBe('AĀBCČDEĒFGĢHIĪJKĶLĻMNŅOPRSŠTUŪVZŽQWXY')
  })

  it('burtiem ar zīmēm ir savi kodpunkti (ā = U+0101, ķ = U+0137, Ģ = U+0122)', () => {
    expect('ā'.codePointAt(0)).toBe(0x0101)
    expect(chars).toContain('ā')
    expect(chars).toContain('ķ')
    expect(chars).toContain('Ģ')
  })

  it('aizstāšanas mērķi ir kopā', () => {
    for (const target of Object.values(lv.substitutions)) {
      for (const c of target) expect(chars, target).toContain(c)
    }
  })

  it('biežākie burti ir no obligātās grupas', () => {
    for (const c of lv.frequentChars) expect(group('lower')).toContain(c)
  })

  it('uzvednes atšķir mazos, lielos, ciparus un pieturzīmes', () => {
    expect(lv.prompt('ā')).toBe('Raksti mazo ā')
    expect(lv.prompt('Ķ')).toBe('Raksti lielo Ķ')
    expect(lv.prompt('7')).toBe('Raksti ciparu 7')
    expect(lv.prompt('!')).toBe('Raksti izsaukuma zīmi')
  })

  it('PRD etalona teksti pēc aizstāšanas sastāv tikai no kopas rakstzīmēm', () => {
    const texts = [
      'Glāžšķūņa rūķīši dzērumā čiepj Baha koncertflīģeļu vākus.',
      'ĀBOLU ČIEKURS ĒNA ĢIMENE ĪSS ĶERRA ĻOTI ŅEM ŠŪPOĻU ŪDENS ŽOGS',
      'Daudz laimes 30. dzimšanas dienā, Mārīt! ♥',
    ]
    for (const text of texts) {
      const missing = [...text.normalize('NFC')].filter((c) => c !== ' ' && !chars.includes(c))
      expect(missing, text).toEqual([])
    }
  })

  it('parauga teksts sastāv tikai no obligātajiem burtiem un satur visus 11 burtus ar zīmēm', () => {
    const letters = [...lv.sampleText].filter((c) => c !== ' ')
    for (const c of letters) expect(requiredChars(lv), c).toContain(c)
    for (const c of 'āčēģīķļņšūž') expect(letters, c).toContain(c)
    expect(lv.sampleText.normalize('NFC')).toBe(lv.sampleText)
  })

  it('katras grupas parauga teksts satur visas grupas zīmes; citas zīmes tikai no obligātās grupas', () => {
    expect(lv.groupSamples.lower).toBe(lv.sampleText)
    const required = requiredChars(lv)
    for (const g of lv.groups) {
      const sample = lv.groupSamples[g.id]
      expect(sample.normalize('NFC'), g.id).toBe(sample)
      for (const c of g.chars) expect([...sample], `${g.id}: ${c}`).toContain(c)
      for (const c of sample) if (c !== ' ') expect([...g.chars, ...required], `${g.id}: ${c}`).toContain(c)
    }
  })

  describe('blāvie paraugi', () => {
    const ys = (stroke: readonly number[]) => stroke.filter((_, i) => i % 2 === 1)
    const xs = (stroke: readonly number[]) => stroke.filter((_, i) => i % 2 === 0)
    /** Zīme ir parauga pēdējais vilciens. */
    const mark = (char: string) => lv.guides[char]!.at(-1)!
    const letter = (char: string) => lv.guides[char]!.slice(0, -1)

    it('ir visām 99 kopas zīmēm; burti ar zīmi (pēc noklusējuma ieslēgtie) ir mazie un lielie ā č ē ģ ī ķ ļ ņ š ū ž', () => {
      expect(Object.keys(lv.guides).sort()).toEqual([...chars].sort())
      expect(lv.markedChars.join('')).toBe('āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ')
    })

    it('ir veseli skaitļi laukuma robežās; katrs vilciens ir vismaz viens nogrieznis (punkts ir nogrieznis uz sevi)', () => {
      for (const [char, strokes] of Object.entries(lv.guides)) {
        // Burtam ar zīmi ir vismaz burts un zīme.
        expect(strokes.length, char).toBeGreaterThanOrEqual(lv.markedChars.includes(char) ? 2 : 1)
        for (const stroke of strokes) {
          expect(stroke.length % 2).toBe(0)
          expect(stroke.length).toBeGreaterThanOrEqual(4)
          expect(stroke.every(Number.isInteger)).toBe(true)
          expect(Math.min(...xs(stroke))).toBeGreaterThanOrEqual(0)
          expect(Math.max(...xs(stroke))).toBeLessThanOrEqual(PAD.width)
          expect(Math.min(...ys(stroke))).toBeGreaterThanOrEqual(PAD.bottom)
          expect(Math.max(...ys(stroke))).toBeLessThanOrEqual(PAD.top)
        }
      }
    })

    it('garumzīme un jumtiņš ir virs mazo burtu augstuma, brīvi no burta', () => {
      for (const c of 'āčēīšūž') {
        expect(Math.min(...ys(mark(c))), c).toBeGreaterThan(PAD.lines.xHeight + 60)
        expect(Math.max(...letter(c).flatMap(ys)), c).toBeLessThanOrEqual(PAD.lines.xHeight + 5)
      }
      // Garumzīme ir gandrīz horizontāla svītra, jumtiņš ir ķeksis ar zemāko punktu vidū.
      expect(mark('ā')).toHaveLength(4)
      const caron = ys(mark('č'))
      expect(Math.min(...caron)).toBeLessThan(Math.min(caron[0]!, caron.at(-1)!))
    })

    it('komats, nevis sedija: burtiem ķ ļ ņ zīme ir zem pamatlīnijas un nav savienota ar burtu', () => {
      for (const c of 'ķļņ') {
        expect(Math.max(...ys(mark(c))), c).toBeLessThanOrEqual(-80)
        expect(Math.min(...ys(mark(c))), c).toBeGreaterThanOrEqual(PAD.lines.descender)
        expect(Math.min(...letter(c).flatMap(ys)), c).toBeGreaterThanOrEqual(-5)
      }
    })

    it('lielajiem burtiem garumzīme un jumtiņš ir brīvajā joslā virs lielo burtu augstuma', () => {
      for (const c of 'ĀČĒĪŠŪŽ') {
        expect(Math.min(...ys(mark(c))), c).toBeGreaterThan(PAD.lines.ascender + 60)
        expect(Math.max(...letter(c).flatMap(ys)), c).toBeLessThanOrEqual(PAD.lines.ascender + 5)
        expect(Math.min(...letter(c).flatMap(ys)), c).toBeGreaterThanOrEqual(-5)
      }
    })

    it('lielajiem Ģ Ķ Ļ Ņ komats ir apakšā un nav savienots ar burtu (arī Ģ, atšķirībā no mazā ģ)', () => {
      for (const c of 'ĢĶĻŅ') {
        expect(Math.max(...ys(mark(c))), c).toBeLessThanOrEqual(-80)
        expect(Math.min(...ys(mark(c))), c).toBeGreaterThanOrEqual(PAD.lines.descender)
        expect(Math.min(...letter(c).flatMap(ys)), c).toBeGreaterThanOrEqual(-5)
        expect(Math.max(...letter(c).flatMap(ys)), c).toBeGreaterThan(PAD.lines.ascender - 10)
      }
    })

    it('mazajam ģ zīme ir augšā', () => {
      expect(Math.min(...ys(mark('ģ')))).toBeGreaterThan(PAD.lines.xHeight + 60)
      expect(Math.max(...letter('ģ').flatMap(ys))).toBeLessThanOrEqual(PAD.lines.xHeight + 5)
      // Pats burts g iet zem pamatlīnijas, zīme ne.
      expect(Math.min(...letter('ģ').flatMap(ys))).toBeLessThan(-150)
    })
  })
})
