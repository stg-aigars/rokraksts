import { describe, expect, it } from 'vitest'
import { contrastRatio, isHexColor, MIN_CONTRAST, relativeLuminance } from './color'

describe('krāsas', () => {
  it('pieņem tikai #rrggbb ar mazajiem burtiem', () => {
    expect(isHexColor('#1d2433')).toBe(true)
    expect(isHexColor('#1D2433')).toBe(false)
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#1d2433" onload="x')).toBe(false)
  })

  it('relatīvais spilgtums pēc WCAG: melns 0, balts 1', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 3)
  })

  it('kontrasts pēc WCAG: melns uz balta 21:1, simetrisks, viena krāsa 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10)
    expect(contrastRatio('#b4402c', '#b4402c')).toBe(1)
    // Zināmas vērtības: #767676 uz balta ir tieši virs 4,5:1, #777777 zem.
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(MIN_CONTRAST)
  })
})
