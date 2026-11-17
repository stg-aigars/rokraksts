// Pseidonejaušība ar sēklu (PRD 7. sadaļa). Šis ir vienīgais nejaušības avots izkārtotājā.
// Tikai 32 bitu veselu skaitļu aritmētika (Math.imul, nobīdes, xor): rezultāts ir vienāds
// jebkurā JavaScript dzinējā. Math.random un peldošā punkta funkcijas šeit nelieto.

/**
 * Sajauc vērtības vienā 32 bitu skaitlī bez zīmes. Katru vērtību vispirms saīsina līdz
 * 32 bitu veselam skaitlim (1.9 -> 1, NaN -> 0). Ar to no (sēkla, plūsma, indekss) iegūst
 * neatkarīgu vērtību katrai vietai tekstā, nepatērējot kopīgu skaitļu virkni.
 */
export function mix32(...values: number[]): number {
  let h = 0x9e3779b9
  for (const value of values) {
    h = (h ^ (value >>> 0)) + 0x9e3779b9
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    h ^= h >>> 16
  }
  return h >>> 0
}

export type Random = {
  /** Nākamais 32 bitu skaitlis bez zīmes. */
  next: () => number
  /** Vesels skaitlis no min līdz max, abus galus ieskaitot. */
  int: (min: number, max: number) => number
}

/** Ģenerators ar sēklu (mulberry32). */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
  return { next, int: (min, max) => min + (next() % (max - min + 1)) }
}
