import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, SLANT_PIVOT, STYLE_LIMITS, normalizeStyle, styleUnits, transformRing } from './style'

describe('stila robežas', () => {
  it('noklusējums ir 2. posma stils: biezums 1, atstarpes 6% no em, bez slīpuma, mērogs 1', () => {
    expect(DEFAULT_STYLE).toEqual({ strokeWidth: 1, spacing: 0.06, slant: 0, scale: 1 })
    expect(normalizeStyle(DEFAULT_STYLE)).toEqual(DEFAULT_STYLE)
  })

  it('vērtības ārpus robežām pievelk pie robežas', () => {
    expect(normalizeStyle({ strokeWidth: 0, spacing: 1, slant: 5, scale: 0.1 })).toEqual({
      strokeWidth: STYLE_LIMITS.strokeWidth.min,
      spacing: STYLE_LIMITS.spacing.max,
      slant: STYLE_LIMITS.slant.max,
      scale: STYLE_LIMITS.scale.min,
    })
  })

  it('vērtības noapaļo līdz solim, bez peldošā punkta astēm', () => {
    const style = normalizeStyle({ strokeWidth: 1.2345, spacing: 0.0849, slant: 0.1 + 0.2, scale: 1.0749 })
    expect(style).toEqual({ strokeWidth: 1.2, spacing: 0.08, slant: 0.3, scale: 1.05 })
  })

  it('nederīgs skaitlis kļūst par noklusējumu', () => {
    expect(normalizeStyle({ strokeWidth: Number.NaN, spacing: 0.06, slant: Infinity, scale: 1 })).toEqual(DEFAULT_STYLE)
  })

  it('minimālās atstarpes pietiek, lai trice neizceltu glifu ārā no rindas (skat. render-svg testu)', () => {
    expect(STYLE_LIMITS.spacing.min).toBeGreaterThanOrEqual(0.04)
  })
})

describe('slīpums un mērogs veselos skaitļos', () => {
  it('stils kontūru kodam ir veseli skaitļi tūkstošdaļās', () => {
    expect(styleUnits({ ...DEFAULT_STYLE, slant: 0.15, scale: 1.1 })).toEqual({ slant: 150, scale: 1100 })
    expect(styleUnits({ ...DEFAULT_STYLE, slant: -0.05, scale: 0.85 })).toEqual({ slant: -50, scale: 850 })
  })

  it('bez slīpuma un ar mērogu 1 punkti nemainās', () => {
    const ring: [number, number][] = [
      [10, -250],
      [700, 0],
      [550, 950],
    ]
    expect(transformRing(ring, { slant: 0, scale: 1000 })).toEqual(ring)
  })

  it('slīpums nobīda punktus pa x proporcionāli augstumam virs mazo burtu augstuma vidus', () => {
    const ring: [number, number][] = [
      [100, SLANT_PIVOT],
      [100, SLANT_PIVOT + 400],
      [100, SLANT_PIVOT - 200],
    ]
    expect(transformRing(ring, { slant: 250, scale: 1000 })).toEqual([
      [100, SLANT_PIVOT],
      [200, SLANT_PIVOT + 400],
      [50, SLANT_PIVOT - 200],
    ])
  })

  it('mērogs reizina abas koordinātas; rezultāts vienmēr ir veseli skaitļi', () => {
    const ring: [number, number][] = [
      [333, 451],
      [-7, -251],
    ]
    const out = transformRing(ring, { slant: 135, scale: 1150 })
    for (const [x, y] of out) expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true)
    expect(out.map((p) => p[1])).toEqual([519, -289])
    // x = x·s + (y·s − pivot) · k, viss tūkstošdaļās: 333·1,15 + (518,65 − 225)·0,135 = 422,59…
    expect(out[0]![0]).toBe(423)
  })

  it('aprēķins ir tikai veselu skaitļu reizinājumi un viena dalīšana: tas pats rezultāts atkārtoti', () => {
    const ring: [number, number][] = Array.from({ length: 200 }, (_, i) => [(i * 37) % 1100, ((i * 91) % 1400) - 450])
    const a = transformRing(ring, { slant: -200, scale: 800 })
    const b = transformRing(ring.map(([x, y]) => [x, y]), { slant: -200, scale: 800 })
    expect(a).toEqual(b)
  })
})
