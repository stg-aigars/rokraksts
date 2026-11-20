import { describe, expect, it } from 'vitest'
import {
  allowedInks,
  CARD_FORMATS,
  CARD_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  INKS,
  inkAllowed,
  templateDecorations,
  textArea,
} from './card-templates'
import type { Decoration } from './card-templates'
import { contrastRatio, isHexColor, MIN_CONTRAST } from './color'
import type { CardFormat } from './types'

const formats = Object.keys(CARD_FORMATS) as CardFormat[]

describe('kartītes formāti (PRD 8. sadaļa)', () => {
  it('kvadrāts 1080×1080, portrets 1080×1350, stāsts 1080×1920', () => {
    expect(CARD_FORMATS.square).toMatchObject({ width: 1080, height: 1080 })
    expect(CARD_FORMATS.portrait).toMatchObject({ width: 1080, height: 1350 })
    expect(CARD_FORMATS.story).toMatchObject({ width: 1080, height: 1920 })
  })

  it('teksta laukums ir attēla iekšpusē ar malām no visām pusēm; visi skaitļi veseli', () => {
    for (const format of formats) {
      const { width, height } = CARD_FORMATS[format]
      const area = textArea(format)
      for (const value of Object.values(area)) expect(Number.isInteger(value), format).toBe(true)
      expect(area.x).toBeGreaterThan(0)
      expect(area.y).toBeGreaterThan(0)
      expect(area.x + area.width).toBeLessThan(width)
      expect(area.y + area.height).toBeLessThan(height)
      // Stāstā augšā un apakšā ir vieta lietotņu pogām.
      if (format === 'story') expect(area.y).toBeGreaterThanOrEqual(240)
    }
  })
})

/** Vai rotājums pārklāj taisnstūri (apļa tuvākais punkts vai taisnstūru pārklāšanās). */
function overlaps(d: Decoration, r: { x: number; y: number; width: number; height: number }): boolean {
  if (d.kind === 'rect') return d.x < r.x + r.width && d.x + d.width > r.x && d.y < r.y + r.height && d.y + d.height > r.y
  const nx = Math.max(r.x, Math.min(d.cx, r.x + r.width))
  const ny = Math.max(r.y, Math.min(d.cy, r.y + r.height))
  return (d.cx - nx) ** 2 + (d.cy - ny) ** 2 < d.r ** 2
}

describe('foni', () => {
  it('ir 6–8 foni ar unikāliem identifikatoriem un latviskiem nosaukumiem', () => {
    expect(CARD_TEMPLATES.length).toBeGreaterThanOrEqual(6)
    expect(CARD_TEMPLATES.length).toBeLessThanOrEqual(8)
    expect(new Set(CARD_TEMPLATES.map((t) => t.id)).size).toBe(CARD_TEMPLATES.length)
    for (const t of CARD_TEMPLATES) {
      expect(t.id).toMatch(/^[a-z-]+$/)
      expect(t.label.length).toBeGreaterThan(1)
      expect(isHexColor(t.background)).toBe(true)
    }
    expect(getTemplate(DEFAULT_TEMPLATE_ID)).toBeDefined()
    expect(getTemplate('nav-tada')).toBeUndefined()
  })

  it('katram fonam ir vismaz 3 atļautas tintes, un noklusējuma tinte ir starp tām', () => {
    for (const t of CARD_TEMPLATES) {
      const inks = allowedInks(t)
      expect(inks.length, t.id).toBeGreaterThanOrEqual(3)
      expect(inks.map((i) => i.hex), t.id).toContain(t.ink)
    }
  })

  it('atļautas ir tikai tintes ar kontrastu vismaz 4,5:1 pret fonu', () => {
    for (const t of CARD_TEMPLATES) {
      for (const ink of INKS) {
        const ok = contrastRatio(ink.hex, t.background) >= MIN_CONTRAST
        expect(inkAllowed(t, ink.hex), `${t.id} ${ink.hex}`).toBe(ok)
        expect(allowedInks(t).includes(ink), `${t.id} ${ink.hex}`).toBe(ok)
      }
      // Tinte, kuras nav paletē, nav atļauta pat ar labu kontrastu.
      expect(inkAllowed(t, '#010203')).toBe(false)
    }
  })

  it('tintes paletē ir gan tumšas, gan gaišas krāsas, katra derīga un ar nosaukumu', () => {
    expect(new Set(INKS.map((i) => i.hex)).size).toBe(INKS.length)
    for (const ink of INKS) {
      expect(isHexColor(ink.hex)).toBe(true)
      expect(ink.label.length).toBeGreaterThan(1)
    }
    expect(INKS.some((i) => contrastRatio(i.hex, '#ffffff') >= MIN_CONTRAST)).toBe(true)
    expect(INKS.some((i) => contrastRatio(i.hex, '#000000') >= MIN_CONTRAST)).toBe(true)
  })

  it('rotājumi ir veselos skaitļos, attēlā un nekur nepārklāj teksta laukumu', () => {
    for (const t of CARD_TEMPLATES) {
      for (const format of formats) {
        const area = textArea(format)
        const { width, height } = CARD_FORMATS[format]
        for (const d of templateDecorations(t, format)) {
          const where = `${t.id} ${format} ${JSON.stringify(d)}`
          const numbers = d.kind === 'rect' ? [d.x, d.y, d.width, d.height, d.opacity] : [d.cx, d.cy, d.r, d.opacity]
          for (const n of numbers) expect(Number.isInteger(n), where).toBe(true)
          expect(isHexColor(d.fill), where).toBe(true)
          expect(d.opacity, where).toBeGreaterThan(0)
          expect(d.opacity, where).toBeLessThanOrEqual(100)
          expect(overlaps(d, area), where).toBe(false)
          // Vismaz daļa rotājuma ir redzama attēlā.
          expect(overlaps(d, { x: 0, y: 0, width, height }), where).toBe(true)
        }
      }
    }
  })
})
