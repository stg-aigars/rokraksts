import { mix32 } from './random'

// Varianta izvēle katrai rakstzīmei (PRD 7. sadaļa). Izkārtotājs katrai rakstzīmei tur
// skaitītāju un ņem nākamo variantu pēc kārtas; sākuma nobīde nāk no kartītes sēklas.
// Ja burtam ir vismaz 2 varianti, divas secīgas tā parādīšanās tāpēc vienmēr atšķiras.

/** Plūsmas numurs, lai variantu nobīdes nesakristu ar citām vērtībām no tās pašas sēklas. */
const STREAM = 1

/** Rakstzīmes sākuma nobīde no sēklas; izvēlētais variants ir (nobīde + kārtas numurs) mod skaits. */
export function variantStart(seed: number, char: string): number {
  return mix32(seed, STREAM, char.codePointAt(0) ?? 0)
}

/** (rakstzīme, tās variantu skaits) -> varianta indekss šai parādīšanās reizei. */
export type VariantPicker = (char: string, count: number) => number

/** Jauns izvēlētājs vienam tekstam; rakstzīmes jāprasa teksta secībā. */
export function createVariantPicker(seed: number): VariantPicker {
  const seen = new Map<string, number>()
  return (char, count) => {
    const occurrence = seen.get(char) ?? 0
    seen.set(char, occurrence + 1)
    if (count <= 1) return 0
    return (variantStart(seed, char) + occurrence) % count
  }
}
