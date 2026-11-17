import { describe, expect, it } from 'vitest'
import { createVariantPicker, variantStart } from './variants'

/** Variantu virkne vienam burtam, kas tekstā parādās `times` reizes. */
function sequence(seed: number, char: string, count: number, times: number): number[] {
  const pick = createVariantPicker(seed)
  return Array.from({ length: times }, () => pick(char, count))
}

describe('varianta izvēle', () => {
  it('ar vienu variantu vienmēr ņem to', () => {
    expect(sequence(5, 'a', 1, 6)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('ņem nākamo variantu pēc kārtas un pēc pēdējā sāk no sākuma', () => {
    for (let seed = 0; seed < 20; seed++) {
      const seq = sequence(seed, 'a', 3, 9)
      for (let i = 1; i < seq.length; i++) expect(seq[i]).toBe((seq[i - 1]! + 1) % 3)
    }
  })

  it('ja burtam ir vismaz 2 varianti, divas secīgas parādīšanās vienmēr atšķiras', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const count of [2, 3]) {
        const seq = sequence(seed, 'ā', count, 12)
        for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
        expect(seq.every((v) => Number.isInteger(v) && v >= 0 && v < count)).toBe(true)
      }
    }
  })

  it('visi varianti tiek izmantoti vienlīdz bieži', () => {
    const seq = sequence(11, 's', 3, 30)
    for (const v of [0, 1, 2]) expect(seq.filter((x) => x === v)).toHaveLength(10)
  })

  it('sākuma nobīde nāk no sēklas: dažādas sēklas sāk ar dažādiem variantiem', () => {
    const starts = new Set(Array.from({ length: 40 }, (_, seed) => sequence(seed, 'a', 3, 1)[0]))
    expect([...starts].sort()).toEqual([0, 1, 2])
  })

  it('sākuma nobīde katram burtam ir sava', () => {
    const chars = [...'aābcčdeēfgģhiījkķlļmnņoprsštuūvzž']
    const starts = new Set(chars.map((c) => variantStart(1, c) % 3))
    expect(starts.size).toBe(3)
  })

  it('tā pati sēkla dod to pašu secību', () => {
    expect(sequence(42, 'a', 3, 10)).toEqual(sequence(42, 'a', 3, 10))
  })

  it('katrai rakstzīmei ir savs skaitītājs: citi burti pa vidu secību nemaina', () => {
    const alone = sequence(9, 'a', 3, 4)
    const pick = createVariantPicker(9)
    const mixed: number[] = []
    for (let i = 0; i < 4; i++) {
      mixed.push(pick('a', 3))
      pick('b', 2)
      pick('ā', 3)
    }
    expect(mixed).toEqual(alone)
  })

  it('ā un a ir dažādas rakstzīmes ar dažādiem skaitītājiem', () => {
    const pick = createVariantPicker(3)
    const a = [pick('a', 2), pick('a', 2)]
    const macron = [pick('ā', 2), pick('ā', 2)]
    expect(a[0]).not.toBe(a[1])
    expect(macron[0]).not.toBe(macron[1])
  })

  it('izvēles ir piespraustas: jebkurā vidē tām jābūt tieši šādām', () => {
    expect([1, 2, 3, 2026].map((seed) => sequence(seed, 'a', 3, 4).join(''))).toMatchInlineSnapshot(`
      [
        "2012",
        "2012",
        "2012",
        "0120",
      ]
    `)
  })
})
