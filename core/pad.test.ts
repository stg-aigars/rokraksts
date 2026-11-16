import { describe, expect, it } from 'vitest'
import { PAD, PAD_HEIGHT, defaultMetrics, normalizePressure, polylinePath, strokePath, toFontUnits, toPadY } from './pad'

const size = { width: 330, height: 420 }

describe('laukuma ģeometrija', () => {
  it('līnijas ir pareizā secībā un abās pusēs ir brīva josla zīmēm', () => {
    const { ascender, xHeight, baseline, descender } = PAD.lines
    expect(baseline).toBe(0)
    expect(PAD.top).toBeGreaterThan(ascender)
    expect(ascender).toBeGreaterThan(xHeight)
    expect(xHeight).toBeGreaterThan(baseline)
    expect(baseline).toBeGreaterThan(descender)
    expect(descender).toBeGreaterThan(PAD.bottom)
    expect(PAD.top - ascender).toBeGreaterThanOrEqual(200)
    expect(descender - PAD.bottom).toBeGreaterThanOrEqual(200)
  })

  it('palīgpunkti ir uz pamatlīnijas laukuma kreisajā un labajā malā', () => {
    const [entry, exit] = PAD.guides
    expect(entry.y).toBe(0)
    expect(exit.y).toBe(0)
    expect(entry.x).toBeLessThan(PAD.width / 2)
    expect(exit.x).toBeGreaterThan(PAD.width / 2)
  })

  it('sākuma metrika atbilst līnijām un 1000 vienībām uz em', () => {
    expect(defaultMetrics()).toEqual({ upm: 1000, ascender: 700, descender: -250, xHeight: 450, capHeight: 700 })
  })
})

describe('ekrāna koordinātas -> fonta vienības', () => {
  it('stūri atbilst laukuma malām', () => {
    expect(toFontUnits(0, 0, size)).toEqual({ x: 0, y: PAD.top })
    expect(toFontUnits(330, 420, size)).toEqual({ x: PAD.width, y: PAD.bottom })
  })

  it('pamatlīnija ir y = 0 un y aug uz augšu', () => {
    const baselinePx = (PAD.top / PAD_HEIGHT) * size.height
    expect(toFontUnits(0, baselinePx, size).y).toBe(0)
    expect(toFontUnits(0, baselinePx - 30, size).y).toBeGreaterThan(0)
    expect(toFontUnits(0, baselinePx + 30, size).y).toBeLessThan(0)
  })

  it('rezultāts nav atkarīgs no laukuma izmēra ekrānā', () => {
    const big = { width: 660, height: 840 }
    expect(toFontUnits(200, 100, big)).toEqual(toFontUnits(100, 50, size))
  })

  it('atgriež veselus skaitļus', () => {
    const p = toFontUnits(101.37, 77.71, size)
    expect(Number.isInteger(p.x)).toBe(true)
    expect(Number.isInteger(p.y)).toBe(true)
  })

  it('punktus ārpus laukuma pievelk pie malas', () => {
    expect(toFontUnits(-50, -50, size)).toEqual({ x: 0, y: PAD.top })
    expect(toFontUnits(9999, 9999, size)).toEqual({ x: PAD.width, y: PAD.bottom })
  })

  it('nulles izmēra laukums nedod NaN', () => {
    expect(toFontUnits(10, 10, { width: 0, height: 0 })).toEqual({ x: 0, y: PAD.top })
  })

  it('toPadY ir apgrieztā pārveide laukuma SVG koordinātām', () => {
    expect(toPadY(PAD.top)).toBe(0)
    expect(toPadY(0)).toBe(PAD.top)
    expect(toPadY(PAD.bottom)).toBe(PAD_HEIGHT)
  })
})

describe('spiediens', () => {
  it('irbuļa spiedienu saglabā', () => {
    expect(normalizePressure(0.3337, 'pen')).toBe(0.334)
  })

  it('peles un sensora neesamības vērtības atmet', () => {
    expect(normalizePressure(0.5, 'mouse')).toBeUndefined()
    expect(normalizePressure(0.7, 'mouse')).toBeUndefined()
    expect(normalizePressure(0.5, 'touch')).toBeUndefined()
    expect(normalizePressure(0, 'touch')).toBeUndefined()
    expect(normalizePressure(Number.NaN, 'pen')).toBeUndefined()
  })

  it('ierobežo līdz 1', () => {
    expect(normalizePressure(1.4, 'pen')).toBe(1)
  })
})

describe('vilciena ceļš attēlošanai', () => {
  it('savieno punktus laukuma koordinātās', () => {
    const d = strokePath({ points: [{ x: 100, y: 0, t: 0 }, { x: 200, y: 450, t: 10 }] })
    expect(d).toBe('M100 950L200 500')
  })

  it('viens punkts dod nulles garuma posmu, ko apaļie gali rāda kā punktu', () => {
    expect(strokePath({ points: [{ x: 5, y: 950, t: 0 }] })).toBe('M5 0h0')
  })
})

describe('blāvā parauga ceļš', () => {
  it('lauzta līnija fonta vienībās kļūst par SVG ceļu laukuma koordinātās (y uz leju)', () => {
    expect(polylinePath([430, 598, 650, 610])).toBe('M430 352L650 340')
    expect(polylinePath([0, 950, 10, 0, 20, -450])).toBe('M0 0L10 950L20 1400')
    expect(polylinePath([])).toBe('')
  })
})
