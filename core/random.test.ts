import { describe, expect, it } from 'vitest'
import { createRandom, mix32 } from './random'

describe('jaucējfunkcija', () => {
  it('dod 32 bitu veselu skaitli bez zīmes', () => {
    for (const values of [[0], [1, 2, 3], [-5, 0x7fffffff], [4294967295, 12]]) {
      const h = mix32(...values)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('ir atkarīga no visām vērtībām un to secības', () => {
    const results = [mix32(1, 2, 3), mix32(1, 2, 4), mix32(2, 1, 3), mix32(1, 2), mix32(0, 1, 2, 3)]
    expect(new Set(results).size).toBe(results.length)
  })

  it('vērtības ir piespraustas: jebkurā vidē tām jābūt tieši šādām', () => {
    expect([mix32(0), mix32(1), mix32(1, 2, 3), mix32(2026, 97)]).toMatchInlineSnapshot(`
      [
        1020716019,
        4230986166,
        2875751612,
        3444442623,
      ]
    `)
  })

  it('sēklu, kas nav vesels 32 bitu skaitlis, saīsina vienādi', () => {
    expect(mix32(1.9)).toBe(mix32(1))
    expect(mix32(4294967296 + 7)).toBe(mix32(7))
    expect(mix32(Number.NaN)).toBe(mix32(0))
  })
})

describe('ģenerators ar sēklu', () => {
  it('tā pati sēkla dod to pašu virkni, cita sēkla citu', () => {
    const take = (seed: number) => {
      const random = createRandom(seed)
      return Array.from({ length: 8 }, () => random.next())
    }
    expect(take(7)).toEqual(take(7))
    expect(take(7)).not.toEqual(take(8))
  })

  it('int dod veselus skaitļus robežās, ieskaitot abus galus', () => {
    const random = createRandom(3)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const n = random.int(-2, 2)
      expect(Number.isInteger(n)).toBe(true)
      seen.add(n)
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2])
  })

  it('virkne ir piesprausta', () => {
    const random = createRandom(2026)
    expect(Array.from({ length: 4 }, () => random.next())).toMatchInlineSnapshot(`
      [
        1955961175,
        1324980858,
        2839649622,
        2656330836,
      ]
    `)
  })
})
