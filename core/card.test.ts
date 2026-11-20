import { describe, expect, it } from 'vitest'
import { fixtureAll, fixtureProject } from '../tests/fixtures/strokes'
import {
  cardFont,
  cardStatus,
  createCard,
  DEFAULT_CARD_SETTINGS,
  layoutCard,
  MAX_EM_PX,
  MIN_EM_PX,
  nextSeed,
  renderCardSvg,
} from './card'
import type { CardSettings } from './card'
import { CARD_FORMAT_IDS, CARD_FORMATS, CARD_TEMPLATES, getTemplate, textArea } from './card-templates'
import { getCharset } from './charsets'
import { compileFont } from './font'
import type { CompiledFont } from './font'
import { layoutText } from './layout'
import type { PlacedGlyph } from './layout'
import { parseCard } from './schema'
import type { FontStyle } from './types'

const lv = getCharset('lv')
const full = compileFont(fixtureProject(fixtureAll))
const GREETING = 'Daudz laimes 30. dzimšanas dienā, Mārīt! ♥'

const make = (text: string, settings: Partial<CardSettings> = {}, font: CompiledFont = full) =>
  createCard({ id: 'kartite', text, settings: { ...DEFAULT_CARD_SETTINGS, seed: 2026, ...settings }, font, charset: lv })

describe('kartītes dati (PRD 10. sadaļa)', () => {
  it('satur tikai tekstā izmantoto zīmju kontūras, katrai visus variantus un to platumus', () => {
    const card = make('aāa Mārīt')
    expect(Object.keys(card.outlines).sort()).toEqual(['M', 'a', 'r', 't', 'ā', 'ī'].sort())
    for (const [char, paths] of Object.entries(card.outlines)) {
      expect(paths).toEqual(full.glyphs[char]!.map((g) => g.path))
      expect(card.advances[char]).toEqual(full.glyphs[char]!.map((g) => g.advance))
    }
    // Burtam "a" etalonā ir 3 varianti; tie visi ceļo līdzi, citādi mainītos variantu izvēle.
    expect(card.outlines.a).toHaveLength(3)
    expect(card.metrics).toEqual(full.metrics)
    expect(card).toMatchObject({ id: 'kartite', schemaVersion: 1, format: 'square', align: 'center', seed: 2026 })
  })

  it('teksts glabājas NFC formā; neuzrakstītām zīmēm kontūru nav', () => {
    const partial = compileFont(fixtureProject(['a', 'b']))
    const card = make('āb c', {}, partial)
    expect(card.text).toBe('āb c')
    expect(Object.keys(card.outlines)).toEqual(['b'])
  })

  it('kartīti var izkārtot tikai no tās datiem: tas pats izkārtojums, kas ar pilnu fontu', () => {
    const card = make(GREETING)
    const fromCard = cardFont(card)
    const placed = layoutCard(card, lv)
    const direct = layoutText(GREETING, full, lv, {
      maxWidth: placed.layout.width,
      align: card.align,
      seed: card.seed,
    })
    expect(placed.layout).toEqual(direct)
    expect(fromCard.metrics).toEqual(full.metrics)
  })

  it('shēma pieņem derīgu kartīti un noraida bojātu', () => {
    const card = make(GREETING)
    expect(parseCard(JSON.parse(JSON.stringify(card)))).toEqual(card)
    expect(parseCard({ ...card, ink: 'red' })).toBeNull()
    expect(parseCard({ ...card, format: 'a4' })).toBeNull()
    expect(parseCard({ ...card, templateId: 'nav-tada' })).toBeNull()
    expect(parseCard({ ...card, outlines: { a: ['M0 0"/><script>'] } })).toBeNull()
    expect(parseCard({ ...card, advances: {} })).toBeNull()
    expect(parseCard({ ...card, seed: -1 })).toBeNull()
    expect(parseCard({ ...card, text: 'ā' })).toBeNull()
  })
})

describe('izmērs: lielākais, ar kuru teksts ietilpst, bet ne mazāk par 28 px', () => {
  it('īss teksts ir liels, garš mazāks; nekad zem 28 px pie 1080 px platuma', () => {
    const short = layoutCard(make('Paldies!'), lv)
    const long = layoutCard(make(`${GREETING} `.repeat(4)), lv)
    expect(short.emPx).toBeGreaterThan(long.emPx)
    expect(short.emPx).toBeLessThanOrEqual(MAX_EM_PX)
    for (const placed of [short, long]) {
      expect(placed.emPx).toBeGreaterThanOrEqual(MIN_EM_PX)
      expect(placed.fits).toBe(true)
    }
  })

  it('teksts, kas neietilpst pat ar 28 px, netiek samazināts tālāk, un kartīti nevar sūtīt', () => {
    const card = make('Daudz laimes! '.repeat(150))
    const placed = layoutCard(card, lv)
    expect(placed.emPx).toBe(MIN_EM_PX)
    expect(placed.fits).toBe(false)
    expect(cardStatus(placed)).toEqual({ shareable: false, problem: 'too-long' })
  })

  it('stāstā tas pats teksts var būt lielāks nekā kvadrātā', () => {
    const text = `${GREETING}\nTavs draugs`
    const square = layoutCard(make(text, { format: 'square' }), lv)
    const story = layoutCard(make(text, { format: 'story' }), lv)
    expect(story.emPx).toBeGreaterThanOrEqual(square.emPx)
  })

  it('vārdus nelauž pa burtiem, ja vien tie neietilpst pat mazākajā izmērā', () => {
    for (const format of CARD_FORMAT_IDS) {
      const placed = layoutCard(make('Ziemassvētkos koncertflīģeļu glāžšķūņa', { format }), lv)
      expect(placed.layout.splitWords, format).toBe(false)
    }
  })
})

/** Glifa robežkaste kartītes pikseļos: trices matrica, tad kartītes mērogs un nobīde. */
function cardBox(font: CompiledFont, g: PlacedGlyph, placed: { emPx: number; x: number; y: number }) {
  const { bounds } = font.glyphs[g.char]![g.variant]!
  const [a, b, c, d, e, f] = g.matrix ?? [1000, 0, 0, 1000, g.x, g.y]
  const corners = [bounds.xMin, bounds.xMax].flatMap((x) =>
    [-bounds.yMax, -bounds.yMin].map((y) => [(a * x + c * y) / 1000 + e, (b * x + d * y) / 1000 + f]),
  )
  const px = corners.map(([x, y]) => [placed.x + (x! * placed.emPx) / 1000, placed.y + (y! * placed.emPx) / 1000])
  const xs = px.map((p) => p[0]!)
  const ys = px.map((p) => p[1]!)
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
}

describe('zīmes netiek nogrieztas nevienā formātā', () => {
  const texts = [
    GREETING,
    'ĀBOLU ČIEKURS ĒNA ĢIMENE ĪSS ĶERRA ĻOTI ŅEM ŠŪPOĻU ŪDENS ŽOGS',
    'ķļņ ģ\nĢĶĻŅ „āčž“',
    'Ā',
    'Glāžšķūņa rūķīši dzērumā čiepj Baha koncertflīģeļu vākus. '.repeat(3),
  ]
  const styles: Partial<FontStyle>[] = [{}, { strokeWidth: 2, spacing: 0.04, scale: 1.25, slant: 0.35 }, { strokeWidth: 2, spacing: 0.04, scale: 1.25, slant: -0.2 }]

  it('ar jebkuru sēklu, līdzinājumu un stilu katrs glifs paliek teksta laukumā', () => {
    for (const style of styles) {
      const project = fixtureProject(fixtureAll)
      const font = compileFont({ ...project, style: { ...project.style, ...style } })
      for (const format of CARD_FORMAT_IDS) {
        const area = textArea(format)
        for (const text of texts) {
          for (const align of ['left', 'center'] as const) {
            for (let seed = 0; seed < 8; seed++) {
              const placed = layoutCard(make(text, { format, align, seed }, font), lv)
              expect(placed.fits).toBe(true)
              for (const g of placed.layout.glyphs) {
                const box = cardBox(font, g, placed)
                const where = `${g.char} ${format} ${align} ${seed} ${JSON.stringify(style)}`
                expect(box.left, where).toBeGreaterThanOrEqual(area.x)
                expect(box.right, where).toBeLessThanOrEqual(area.x + area.width)
                expect(box.top, where).toBeGreaterThanOrEqual(area.y)
                expect(box.bottom, where).toBeLessThanOrEqual(area.y + area.height)
              }
            }
          }
        }
      }
    }
  })

  it('teksta bloks ir vertikāli centrēts; centrētas rindas ir laukuma vidū', () => {
    const placed = layoutCard(make('Sveiki\nMārīt', { format: 'story', align: 'center' }), lv)
    const area = textArea('story')
    const blockHeight = Math.ceil((placed.layout.height * placed.emPx) / 1000)
    expect(Math.abs(placed.y - area.y - (area.height - blockHeight) / 2)).toBeLessThanOrEqual(1)
    for (const line of placed.layout.lines) {
      const left = placed.x + (line.x * placed.emPx) / 1000
      const right = placed.x + ((line.x + line.width) * placed.emPx) / 1000
      expect(Math.abs(left - area.x - (area.x + area.width - right))).toBeLessThanOrEqual(2)
    }
    const left = layoutCard(make('Sveiki\nMārīt', { format: 'story', align: 'left' }), lv)
    for (const line of left.layout.lines) expect(line.x).toBe(0)
    expect(left.x).toBe(area.x)
  })
})

describe('SVG kartīte', () => {
  it('ir formāta izmērā, ar fonu, rotājumiem, tinti un tekstu ekrāna lasītājiem', () => {
    for (const format of CARD_FORMAT_IDS) {
      const { width, height } = CARD_FORMATS[format]
      const svg = renderCardSvg(make(GREETING, { format, templateId: 'egle', ink: '#ffffff' }), lv)
      expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${GREETING}">`)).toBe(true)
      expect(svg).toContain(`<rect width="${width}" height="${height}" fill="#1f3d2b"/>`)
      expect(svg).toContain('<circle ')
      expect(svg).toContain('fill="#ffffff"')
      expect(svg.match(/<use /g)).toHaveLength([...GREETING].filter((c) => c !== ' ').length)
    }
  })

  it('viena kartīte dod bait-identisku SVG, arī pēc JSON turp un atpakaļ un no jauna sakompilēta fonta', () => {
    const a = renderCardSvg(make(GREETING), lv)
    const again = compileFont(fixtureProject(fixtureAll))
    const card = make(GREETING, {}, again)
    const b = renderCardSvg(parseCard(JSON.parse(JSON.stringify(card)))!, lv)
    expect(new TextEncoder().encode(a)).toEqual(new TextEncoder().encode(b))
  })

  it('"Sajaukt" (cita sēkla) maina variantus un trici, bet ne tekstu un izmēru', () => {
    const seeds = [2026, nextSeed(2026), nextSeed(nextSeed(2026))]
    expect(new Set(seeds).size).toBe(3)
    const placed = seeds.map((seed) => layoutCard(make(GREETING, { seed }), lv))
    const svgs = seeds.map((seed) => renderCardSvg(make(GREETING, { seed }), lv))
    expect(new Set(svgs).size).toBe(3)
    const variants = placed.map((p) => p.layout.glyphs.map((g) => g.variant).join())
    expect(new Set(variants).size).toBeGreaterThan(1)
    const matrices = placed.map((p) => JSON.stringify(p.layout.glyphs.map((g) => g.matrix)))
    expect(new Set(matrices).size).toBe(3)
    expect(new Set(placed.map((p) => p.layout.text)).size).toBe(1)
  })

  it('nākamā sēkla ir deterministiska, 32 bitu skaitlis bez zīmes, un neatkārtojas tūlīt', () => {
    expect(nextSeed(1)).toBe(nextSeed(1))
    let seed = 0
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      seed = nextSeed(seed)
      expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff).toBe(true)
      seen.add(seed)
    }
    expect(seen.size).toBe(1000)
  })

  it('visi skaitļi ir veseli, izņemot matricu koeficientus un necaurredzamību', () => {
    for (const template of CARD_TEMPLATES) {
      const svg = renderCardSvg(make(GREETING, { templateId: template.id, ink: template.ink, format: 'portrait' }), lv)
      const rest = svg.replace(/matrix\([^)]*\)/g, '').replace(/(fill-)?opacity="0\.\d+"/g, '')
      expect(rest, template.id).not.toMatch(/\d\.\d/)
      expect(svg).not.toContain('NaN')
      expect(svg.replace(/#[0-9a-f]{6}/g, '')).not.toMatch(/\de[+-]?\d/i)
    }
  })

  it('neuzrakstīta zīme nekad netiek aizstāta: tukšs rāmītis, un kartīti nevar sūtīt', () => {
    const partial = compileFont(fixtureProject([...'adlimsuz']))
    const card = make('Daudz laimes', {}, partial)
    const placed = layoutCard(card, lv)
    expect(placed.layout.missingChars).toEqual(['D', 'e'])
    expect(cardStatus(placed)).toEqual({ shareable: false, problem: 'missing' })
    const svg = renderCardSvg(card, lv)
    expect(svg.match(/<rect /g)!.length).toBeGreaterThanOrEqual(1 + 2)
    expect(svg.match(/<use /g)).toHaveLength(9)
  })

  it('tukšu tekstu sūtīt nevar; pilnu var', () => {
    expect(cardStatus(layoutCard(make('  \n '), lv))).toEqual({ shareable: false, problem: 'empty' })
    expect(cardStatus(layoutCard(make(GREETING), lv))).toEqual({ shareable: true, problem: null })
  })

  it('nederīgu tinti vai fonu zīmētājs nepieņem', () => {
    expect(() => renderCardSvg({ ...make('a'), ink: '#ffffff" onload="x' }, lv)).toThrow()
    expect(() => renderCardSvg({ ...make('a'), templateId: 'nav-tada' }, lv)).toThrow()
    expect(getTemplate(DEFAULT_CARD_SETTINGS.templateId)!.ink).toBe(DEFAULT_CARD_SETTINGS.ink)
  })

  it('izkārtojums ir ātrs arī garam tekstam', () => {
    const card = make(`${GREETING} `.repeat(11))
    const start = performance.now()
    layoutCard(card, lv)
    expect(performance.now() - start).toBeLessThan(150)
  })
})
