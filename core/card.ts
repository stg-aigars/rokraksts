import { CARD_FORMATS, DEFAULT_TEMPLATE_ID, getTemplate, inkAllowed, templateDecorations, textArea } from './card-templates'
import type { Decoration } from './card-templates'
import { getCharset } from './charsets'
import type { Charset } from './charsets'
import { layoutText, prepareText, triceMargin } from './layout'
import type { Layout, LayoutFont, LayoutGlyph } from './layout'
import { mix32 } from './random'
import { escapeAttribute, renderGlyphs } from './render-svg'
import { thousandths } from './trice'
import type { Card } from './types'

// Kartīte (PRD 4. sadaļas 8. solis, 8. sadaļa). Kartīti zīmējam paši caur savu izkārtotāju,
// nevis ar fontu. Viss šeit ir veselu skaitļu aritmētika: viena kartīte (teksts, glifi, sēkla,
// formāts) dod vienu un to pašu izkārtojumu un bait-identisku SVG jebkurā vidē. Canvas
// zīmētājs pārlūkā (lib/card-canvas.ts) lieto to pašu `layoutCard` un tās pašas matricas.

/** Kartītes iestatījumi, ko maina redaktors. */
export type CardSettings = Pick<Card, 'format' | 'templateId' | 'ink' | 'align' | 'seed'>

export const DEFAULT_CARD_SETTINGS: CardSettings = {
  format: 'square',
  templateId: DEFAULT_TEMPLATE_ID,
  ink: '#1d2433',
  align: 'center',
  seed: 1,
}

/**
 * Mazākais burtu izmērs (em pikseļos, kā CSS font-size) pie 1080 px platuma: PRD 8. sadaļa.
 * Mazāk redaktors neatļauj; ja teksts neietilpst, kartīti nevar nosūtīt.
 */
export const MIN_EM_PX = 28
/** Lielākais izmērs: īss teksts ("Paldies!") nekļūst milzīgs. */
export const MAX_EM_PX = 240

/** Plūsma sēklu virknei pogai "Sajaukt" (1 ir varianti, 2 trice). */
const SHUFFLE_STREAM = 3

/** Nākamā sēkla pogai "Sajaukt": deterministiska, 32 bitu skaitlis bez zīmes. */
export function nextSeed(seed: number): number {
  return mix32(seed, SHUFFLE_STREAM)
}

/**
 * Kartīte no teksta un sakompilētā fonta. Līdzi ceļo tikai tekstā izmantoto rakstzīmju kontūras,
 * bet katrai visi varianti: izkārtotājs variantu izvēlas pēc to skaita, tāpēc mazāks skaits
 * mainītu izkārtojumu. Neuzrakstītām zīmēm kontūru nav, un tās paliek tukši rāmīši.
 */
export function createCard(input: {
  id: string
  text: string
  settings: CardSettings
  font: LayoutFont
  charset: Charset
}): Card {
  const text = input.text.normalize('NFC')
  const outlines: Record<string, string[]> = {}
  const advances: Record<string, number[]> = {}
  for (const char of new Set(prepareText(text, input.charset))) {
    const variants = input.font.glyphs[char]
    if (!variants || variants.length === 0) continue
    outlines[char] = variants.map((g) => g.path)
    advances[char] = variants.map((g) => g.advance)
  }
  const { format, templateId, ink, align, seed } = input.settings
  return {
    id: input.id,
    schemaVersion: 1,
    text,
    format,
    templateId,
    ink,
    align,
    seed,
    metrics: { ...input.font.metrics },
    outlines,
    advances,
  }
}

/** Fonts izkārtotājam tikai no kartītes datiem (bez vilcieniem). */
export function cardFont(card: Card): LayoutFont {
  const glyphs: Record<string, LayoutGlyph[]> = {}
  for (const [char, paths] of Object.entries(card.outlines)) {
    glyphs[char] = paths.map((path, i) => ({ path, advance: card.advances[char]?.[i] ?? 0 }))
  }
  return { metrics: card.metrics, glyphs }
}

export type CardLayout = {
  width: number
  height: number
  /** Burtu izmērs: cik pikseļu ir vienā em (1000 fonta vienībās). */
  emPx: number
  /** Izkārtojuma (fonta vienībās) kreisā augšējā stūra vieta kartītē pikseļos. */
  x: number
  y: number
  layout: Layout
  /** false: teksts neietilpst pat ar mazāko izmēru. */
  fits: boolean
}

/**
 * Izkārtojums kartītē: lielākais vesels izmērs no MAX_EM_PX līdz MIN_EM_PX, ar kuru teksts
 * ietilpst teksta laukumā un neviens vārds nav jālauž pa burtiem (to pieļauj tikai mazākajā
 * izmērā). Bloks ir vertikāli centrēts; rindas līdzina izkārtotājs.
 */
export function layoutCard(card: Card, charset: Charset = getCharset('lv')): CardLayout {
  const font = cardFont(card)
  const area = textArea(card.format)
  const { width, height } = CARD_FORMATS[card.format]
  const { ascender, descender } = card.metrics
  const options = { align: card.align, seed: card.seed }

  // Vienai rindai jāietilpst augstumā; lielāku izmēru nav jēgas mēģināt.
  const oneLine = ascender - descender + 2 * triceMargin(card.metrics)
  const start = Math.max(MIN_EM_PX, Math.min(MAX_EM_PX, Math.floor((area.height * 1000) / oneLine)))

  let chosen: { emPx: number; layout: Layout; fits: boolean } | null = null
  for (let emPx = start; emPx >= MIN_EM_PX; emPx--) {
    const layout = layoutText(card.text, font, charset, { ...options, maxWidth: Math.floor((area.width * 1000) / emPx) })
    const fits = Math.ceil((layout.height * emPx) / 1000) <= area.height
    if (fits && (!layout.splitWords || emPx === MIN_EM_PX)) {
      chosen = { emPx, layout, fits }
      break
    }
    if (emPx === MIN_EM_PX) chosen = { emPx, layout, fits }
  }
  const { emPx, layout, fits } = chosen!
  const blockHeight = Math.ceil((layout.height * emPx) / 1000)
  return {
    width,
    height,
    emPx,
    x: area.x,
    y: area.y + Math.max(0, Math.floor((area.height - blockHeight) / 2)),
    layout,
    fits,
  }
}

export type CardProblem = 'empty' | 'missing' | 'too-long'

/**
 * Vai kartīti drīkst nosūtīt. Neuzrakstīta zīme bloķē kopīgošanu (PRD 5. sadaļa), tāpat teksts,
 * kas neietilpst ar mazāko pieļauto izmēru (PRD 8. sadaļa).
 */
export function cardStatus(placed: CardLayout): { shareable: boolean; problem: CardProblem | null } {
  const { layout } = placed
  let problem: CardProblem | null = null
  if (layout.glyphs.length === 0 && layout.missing.length === 0) problem = 'empty'
  else if (layout.missing.length > 0) problem = 'missing'
  else if (!placed.fits) problem = 'too-long'
  return { shareable: problem === null, problem }
}

/** Kartītes teksts ekrāna lasītājiem un attēla alt aprakstam: tāds, kāds tas uzzīmēts. */
export function cardAltText(card: Card, charset: Charset = getCharset('lv')): string {
  return prepareText(card.text, charset)
}

/** Necaurredzamība no procentiem: 35 -> "0.35", 40 -> "0.4". */
function opacity(percent: number): string {
  return percent >= 100 ? '1' : `0.${String(percent).padStart(2, '0').replace(/0+$/, '')}`
}

function decorationSvg(d: Decoration): string {
  const paint = `fill="${d.fill}"${d.opacity < 100 ? ` fill-opacity="${opacity(d.opacity)}"` : ''}`
  if (d.kind === 'circle') return `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" ${paint}/>`
  const rx = d.rx ? ` rx="${d.rx}"` : ''
  return `<rect x="${d.x}" y="${d.y}" width="${d.width}" height="${d.height}"${rx} ${paint}/>`
}

export type CardRenderOptions = {
  /** Glifu identifikatoru priedēklis; jāatšķiras, ja lapā ir vairāki SVG. */
  idPrefix?: string
  /** Vai rādīt neuzrakstīto zīmju rāmīšus (redaktorā jā). */
  showMissing?: boolean
}

/**
 * Kartīte kā patstāvīgs SVG formāta izmērā: fons, rotājumi un teksts. Teksts ir mērogotā grupā,
 * kuras matricas koeficients ir em izmērs tūkstošdaļās (vesels skaitlis kā virkne).
 */
export function renderCardSvg(card: Card, charset: Charset = getCharset('lv'), options: CardRenderOptions = {}): string {
  const template = getTemplate(card.templateId)
  if (!template) throw new Error(`Nezināms fons: ${card.templateId}`)
  if (!inkAllowed(template, card.ink)) throw new Error(`Tinte ${card.ink} nav atļauta fonam ${card.templateId}`)
  const placed = layoutCard(card, charset)
  const { width, height, emPx, x, y } = placed
  const k = thousandths(emPx)
  const label = escapeAttribute(cardAltText(card, charset))
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${label}">`
  svg += `<rect width="${width}" height="${height}" fill="${template.background}"/>`
  for (const d of templateDecorations(template, card.format)) svg += decorationSvg(d)
  const glyphs = renderGlyphs(placed.layout, cardFont(card), {
    ink: card.ink,
    idPrefix: options.idPrefix ?? 'k',
    showMissing: options.showMissing,
  })
  if (glyphs) svg += `<g transform="matrix(${k} 0 0 ${k} ${x} ${y})">${glyphs}</g>`
  return `${svg}</svg>`
}
