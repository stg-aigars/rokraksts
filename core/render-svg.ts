import type { Layout, LayoutFont } from './layout'
import { formatMatrix } from './trice'

// Novietoti glifi -> SVG virkne (PRD 6. sadaļa: kartītes zīmējam paši, nevis ar fontu).
// Izvadē ir tikai veseli skaitļi un virkņu salikšana, tāpēc viens un tas pats izkārtojums
// dod bait-identisku SVG klientā un serverī. Vienīgās decimāldaļas ir trices matricas
// koeficienti, un arī tos saliek kā virkni no veseliem skaitļiem (core/trice.ts).

export type RenderOptions = {
  /** Tintes krāsa kā #rrggbb. */
  ink?: string
  /** Priedēklis glifu identifikatoriem; jāatšķiras, ja vienā lapā ir vairāki SVG. */
  idPrefix?: string
  /** Teksts ekrāna lasītājiem; pēc noklusējuma izkārtotais teksts. */
  label?: string
  /** Vai neuzrakstītas rakstzīmes rādīt kā tukšus rāmīšus. */
  showMissing?: boolean
}

const DEFAULT_INK = '#1d2433'

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;')
}

/**
 * Glifu daļa bez <svg> apvalka: <defs> ar katru izmantoto variantu vienreiz, <use> katram glifam
 * un neuzrakstīto zīmju rāmīši. Koordinātas ir fonta vienībās (y uz leju); kartīte to ievieto
 * mērogotā grupā.
 */
export function renderGlyphs(layout: Layout, font: LayoutFont, options: Omit<RenderOptions, 'label'> = {}): string {
  const ink = (options.ink ?? DEFAULT_INK).toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(ink)) throw new Error(`Nederīga tintes krāsa: ${options.ink}`)
  const prefix = options.idPrefix ?? 'g'
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(prefix)) throw new Error(`Nederīgs identifikatoru priedēklis: ${prefix}`)

  // Katru izmantoto glifa variantu definē vienu reizi, pirmās parādīšanās secībā.
  const ids = new Map<string, string>()
  let defs = ''
  let uses = ''
  for (const glyph of layout.glyphs) {
    const key = `${glyph.char}/${glyph.variant}`
    let id = ids.get(key)
    if (id === undefined) {
      const compiled = font.glyphs[glyph.char]?.[glyph.variant]
      if (!compiled) throw new Error(`Izkārtojumā ir glifs, kura nav fontā: ${glyph.char}`)
      id = `${prefix}${ids.size}`
      ids.set(key, id)
      defs += `<path id="${id}" d="${compiled.path}"/>`
    }
    uses += glyph.matrix
      ? `<use href="#${id}" transform="matrix(${formatMatrix(glyph.matrix)})"/>`
      : `<use href="#${id}" x="${glyph.x}" y="${glyph.y}"/>`
  }

  let missing = ''
  if (options.showMissing !== false) {
    // Rāmītis no pamatlīnijas līdz mazo burtu augstumam, ar atkāpi no malām.
    const inset = 60
    const height = font.metrics.xHeight
    for (const slot of layout.missing) {
      missing += `<rect x="${slot.x + inset}" y="${slot.y - height}" width="${slot.advance - 2 * inset}" height="${height}" rx="40"/>`
    }
  }

  let svg = ''
  if (defs) svg += `<defs>${defs}</defs><g fill="${ink}">${uses}</g>`
  if (missing) svg += `<g fill="none" stroke="${ink}" stroke-opacity="0.3" stroke-width="16">${missing}</g>`
  return svg
}

export function renderSvg(layout: Layout, font: LayoutFont, options: RenderOptions = {}): string {
  const label = escapeAttribute(options.label ?? layout.text)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${label}">`
  return `${svg}${renderGlyphs(layout, font, options)}</svg>`
}
