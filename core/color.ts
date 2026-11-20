// Krāsas kartītēm: tintes un fona kontrasts pēc WCAG 2 (PRD 8. sadaļa: vismaz 4,5:1).
// Šeit ir peldošā punkta matemātika (pakāpe), bet tā tikai izlemj, kuras tintes atļaut;
// SVG izvadē nonāk tikai pašas krāsas virknes.

export const MIN_CONTRAST = 4.5

const HEX = /^#[0-9a-f]{6}$/

/** Krāsa formā #rrggbb ar mazajiem burtiem (tā glabājas kartītē un nonāk SVG). */
export function isHexColor(value: string): boolean {
  return HEX.test(value)
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relatīvais spilgtums 0..1 (WCAG 2). */
export function relativeLuminance(hex: string): number {
  if (!isHexColor(hex)) throw new Error(`Nederīga krāsa: ${hex}`)
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** Kontrasta attiecība 1..21 starp divām krāsām; secībai nav nozīmes. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
