import { cardFont, layoutCard } from '@/core/card'
import { getTemplate, templateDecorations } from '@/core/card-templates'
import type { Charset } from '@/core/charsets'
import type { Card } from '@/core/types'

// Kartīte uz canvas PNG attēlam (PRD 8. sadaļa). Zīmē to pašu, ko core/card.ts renderCardSvg:
// tas pats izkārtojums (`layoutCard`), tie paši rotājumi un tās pašas trices matricas
// (`PlacedGlyph.matrix`), tāpēc attēls sakrīt ar priekšskatījumu.

/** Uzzīmē kartīti kontekstā, kura izmērs ir kartītes formāts pikseļos. */
export function drawCard(ctx: CanvasRenderingContext2D, card: Card, charset: Charset): void {
  const template = getTemplate(card.templateId)
  if (!template) throw new Error(`Nezināms fons: ${card.templateId}`)
  const placed = layoutCard(card, charset)
  const font = cardFont(card)

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = template.background
  ctx.fillRect(0, 0, placed.width, placed.height)
  for (const d of templateDecorations(template, card.format)) {
    ctx.globalAlpha = d.opacity / 100
    ctx.fillStyle = d.fill
    ctx.beginPath()
    if (d.kind === 'circle') ctx.arc(d.cx, d.cy, d.r, 0, 2 * Math.PI)
    else if (d.rx) ctx.roundRect(d.x, d.y, d.width, d.height, d.rx)
    else ctx.rect(d.x, d.y, d.width, d.height)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Teksts: kartītes mērogs (em pikseļos) un nobīde, tad katra glifa matrica fonta vienībās.
  const k = placed.emPx / 1000
  const paths = new Map<string, Path2D>()
  ctx.fillStyle = card.ink
  for (const glyph of placed.layout.glyphs) {
    const key = `${glyph.char}/${glyph.variant}`
    let path = paths.get(key)
    if (!path) {
      path = new Path2D(font.glyphs[glyph.char]![glyph.variant]!.path)
      paths.set(key, path)
    }
    ctx.setTransform(k, 0, 0, k, placed.x, placed.y)
    if (glyph.matrix) {
      const [a, b, c, d, e, f] = glyph.matrix
      ctx.transform(a / 1000, b / 1000, c / 1000, d / 1000, e, f)
    } else ctx.translate(glyph.x, glyph.y)
    ctx.fill(path)
  }
  ctx.restore()
}

/** Kartīte kā PNG fails formāta izmērā. */
export async function cardPng(card: Card, charset: Charset): Promise<Blob> {
  const { width, height } = layoutCard(card, charset)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nav pieejams')
  drawCard(ctx, card, charset)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Neizdevās izveidot PNG'))), 'image/png'),
  )
}

export const CARD_FILE_NAME = 'apsveikums.png'

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Nodod attēlu sistēmas Share (WhatsApp, Messenger …); ja pārlūks failus kopīgot neprot,
 * lejupielādē. Ja lietotājs Share logu aizver, nekas nenotiek.
 */
export async function shareOrDownload(blob: Blob, title: string): Promise<ShareResult> {
  const file = new File([blob], CARD_FILE_NAME, { type: 'image/png' })
  const data: ShareData = { files: [file], title }
  if (typeof navigator.share === 'function' && navigator.canShare?.(data)) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Citas kļūdas (piemēram, NotAllowedError bez lietotāja žesta): rezervē lejupielāde.
    }
  }
  download(blob)
  return 'downloaded'
}

export function download(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = CARD_FILE_NAME
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
