import { describe, expect, it } from 'vitest'
import { TRICE_LIMITS, formatMatrix, triceAt, triceMatrix } from './trice'
import type { Matrix } from './trice'

const samples = () => {
  const list = []
  for (let seed = 0; seed < 40; seed++) for (let index = 0; index < 100; index++) list.push(triceAt(seed, index))
  return list
}

/** Matricas pielietojums punktam, kā to darītu SVG. */
function apply([a, b, c, d, e, f]: Matrix, x: number, y: number): [number, number] {
  return [(a * x + c * y) / 1000 + e, (b * x + d * y) / 1000 + f]
}

describe('trice', () => {
  it('vērtības ir veseli skaitļi robežās', () => {
    for (const t of samples()) {
      expect(Number.isInteger(t.rotate) && Number.isInteger(t.scale) && Number.isInteger(t.shift)).toBe(true)
      expect(Math.abs(t.rotate)).toBeLessThanOrEqual(TRICE_LIMITS.rotate)
      expect(Math.abs(t.scale - 1000)).toBeLessThanOrEqual(TRICE_LIMITS.scale)
      expect(Math.abs(t.shift)).toBeLessThanOrEqual(TRICE_LIMITS.shift)
    }
  })

  it('PRD robežas: rotācija līdz ±1,5°, mērogs līdz ±2%, pamatlīnija līdz ±1% no em', () => {
    // Šis ir tests, nevis izvades kods, tāpēc šeit drīkst lietot trigonometriju.
    for (const t of samples()) {
      const [a, b, c, d] = triceMatrix(t, 0, 0, 500)
      const angle = (Math.atan2(b, a) * 180) / Math.PI
      const scale = Math.hypot(a, b) / 1000
      expect(Math.abs(angle)).toBeLessThanOrEqual(1.5)
      expect(scale).toBeGreaterThanOrEqual(0.98)
      expect(scale).toBeLessThanOrEqual(1.02)
      expect(Math.abs(t.shift)).toBeLessThanOrEqual(10)
      // Tīra rotācija ar mērogu: bez sašķiebuma un spoguļošanas.
      expect(d).toBe(a)
      expect(c).toBe(0 - b)
    }
  })

  it('robežas tiek arī sasniegtas: trice nav nemanāma', () => {
    const all = samples()
    expect(Math.max(...all.map((t) => t.rotate))).toBe(TRICE_LIMITS.rotate)
    expect(Math.min(...all.map((t) => t.rotate))).toBe(-TRICE_LIMITS.rotate)
    expect(Math.max(...all.map((t) => t.scale))).toBe(1000 + TRICE_LIMITS.scale)
    expect(Math.min(...all.map((t) => t.scale))).toBe(1000 - TRICE_LIMITS.scale)
    expect(Math.max(...all.map((t) => t.shift))).toBe(TRICE_LIMITS.shift)
    expect(Math.min(...all.map((t) => t.shift))).toBe(-TRICE_LIMITS.shift)
  })

  it('ir atkarīga tikai no sēklas un vietas tekstā', () => {
    expect(triceAt(7, 3)).toEqual(triceAt(7, 3))
    const bySeed = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(triceAt(seed, 3))))
    const byIndex = new Set(Array.from({ length: 20 }, (_, index) => JSON.stringify(triceAt(7, index))))
    expect(bySeed.size).toBeGreaterThan(15)
    expect(byIndex.size).toBeGreaterThan(15)
  })

  it('vērtības ir piespraustas: jebkurā vidē tām jābūt tieši šādām', () => {
    expect([triceAt(1, 0), triceAt(1, 1), triceAt(2026, 57)]).toMatchInlineSnapshot(`
      [
        {
          "rotate": 15,
          "scale": 984,
          "shift": -2,
        },
        {
          "rotate": -22,
          "scale": 1012,
          "shift": 3,
        },
        {
          "rotate": -25,
          "scale": 999,
          "shift": -1,
        },
      ]
    `)
  })
})

describe('trices matrica', () => {
  it('visi elementi ir veseli skaitļi, bez negatīvās nulles', () => {
    for (const t of samples()) {
      for (const n of triceMatrix(t, 1234, 700, 517)) {
        expect(Number.isInteger(n)).toBe(true)
        expect(Object.is(n, -0)).toBe(false)
      }
    }
  })

  it('bez trices ir tīra pārbīde uz glifa vietu', () => {
    expect(triceMatrix({ rotate: 0, scale: 1000, shift: 0 }, 300, 700, 500)).toEqual([1000, 0, 0, 1000, 300, 700])
  })

  it('griež un mērogo ap glifa vidu uz pamatlīnijas; pamatlīnijas nobīde to pārbīda pa vertikāli', () => {
    for (const t of samples().slice(0, 300)) {
      const [x, y] = apply(triceMatrix(t, 2000, 700, 500), 250, 0)
      expect(Math.abs(x - 2250)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(y - (700 + t.shift))).toBeLessThanOrEqual(0.5)
    }
  })

  it('pozitīva rotācija SVG koordinātās (y uz leju) griež pulksteņrādītāja virzienā', () => {
    const m = triceMatrix({ rotate: 26, scale: 1000, shift: 0 }, 0, 0, 0)
    expect(m).toEqual([1000, 26, -26, 1000, 0, 0])
    const [x, y] = apply(m, 1000, 0)
    expect([x, y]).toEqual([1000, 26])
  })

  it('izvadē koeficienti ir decimāldaļas ar ne vairāk kā 3 cipariem, pārbīde veseli skaitļi', () => {
    expect(formatMatrix([1012, 19, -19, 1012, 3456, 760])).toBe('1.012 0.019 -0.019 1.012 3456 760')
    expect(formatMatrix([1000, 0, 0, 1000, -5, 0])).toBe('1 0 0 1 -5 0')
    expect(formatMatrix([980, -5, 5, 980, 0, 0])).toBe('0.98 -0.005 0.005 0.98 0 0')
    expect(formatMatrix([1010, 20, -20, 1010, 1, 2])).toBe('1.01 0.02 -0.02 1.01 1 2')
  })
})
