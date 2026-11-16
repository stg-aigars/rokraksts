import { describe, expect, it } from 'vitest'
import { fixtureGlyphs, fixtureProject, fixtureStrokes } from '../tests/fixtures/strokes'
import { compileFont, compileVariant, createGlyphCache } from './font'
import { fontMetrics, glyphMetrics, sideBearing } from './metrics'
import { buildOutline } from './outline'
import { PAD } from './pad'
import { createProject } from './project'

const style = createProject('p', '2026-11-16T00:00:00.000Z').style

describe('glifa platums', () => {
  it('sānu atstarpe pēc noklusējuma ir 6% no em', () => {
    expect(sideBearing(style)).toBe(60)
    expect(sideBearing({ ...style, spacing: 0.1 })).toBe(100)
  })

  it('platums = robežkaste + sānu atstarpes abās pusēs', () => {
    const bounds = { xMin: 380, xMax: 720, yMin: 0, yMax: 450 }
    expect(glyphMetrics(bounds, style)).toEqual({ advance: 340 + 120, offsetX: 60 - 380 })
  })

  it('lietotāja pielāgots platums aizstāj aprēķināto, glifs paliek pie kreisās atstarpes', () => {
    const bounds = { xMin: 380, xMax: 720, yMin: 0, yMax: 450 }
    expect(glyphMetrics(bounds, style, 600)).toEqual({ advance: 600, offsetX: -320 })
  })

  it('tukšam glifam ir tikai sānu atstarpes', () => {
    expect(glyphMetrics(null, style)).toEqual({ advance: 120, offsetX: 0 })
  })

  it('sakompilēts glifs sākas tieši pie kreisās atstarpes neatkarīgi no vietas laukumā', () => {
    for (const [char, strokes] of Object.entries(fixtureGlyphs)) {
      const glyph = compileVariant({ strokes }, style)
      expect(glyph.bounds.xMin, char).toBe(60)
      expect(glyph.advance, char).toBe(glyph.bounds.xMax + 60)
    }
    // Tas pats burts, uzrakstīts laukuma citā malā, dod to pašu glifu.
    const moved = fixtureStrokes('o').map((s) => ({ points: s.points.map((p) => ({ ...p, x: p.x + 200 })) }))
    expect(compileVariant({ strokes: moved }, style)).toEqual(compileVariant({ strokes: fixtureStrokes('o') }, style))
  })

  it('vertikāli glifs netiek pārbīdīts: pamatlīnija paliek y = 0', () => {
    const outline = buildOutline(fixtureStrokes('p'))
    const glyph = compileVariant({ strokes: fixtureStrokes('p') }, style)
    expect(glyph.bounds.yMin).toBe(outline.bounds!.yMin)
    expect(glyph.bounds.yMax).toBe(outline.bounds!.yMax)
    expect(glyph.bounds.yMin).toBeLessThan(-200)
  })
})

describe('vertikālā metrika', () => {
  it('bez glifiem ir laukuma līnijas', () => {
    expect(fontMetrics([])).toEqual({ upm: 1000, ascender: 700, descender: -250, xHeight: 450, capHeight: 700 })
  })

  it('zemi burti metriku nesamazina zem laukuma līnijām', () => {
    const metrics = compileFont(fixtureProject(['a', 'o'])).metrics
    expect(metrics.ascender).toBe(PAD.lines.ascender)
    expect(metrics.descender).toBe(PAD.lines.descender)
  })

  it('robežas nāk no faktiski uzzīmētā augstākā un zemākā punkta, lai zīmes netiktu nogrieztas', () => {
    const font = compileFont(fixtureProject(['a', 'ģ', 'ķ']))
    const all = Object.values(font.glyphs).map((variants) => variants[0]!.bounds)
    const top = Math.max(...all.map((b) => b.yMax))
    const bottom = Math.min(...all.map((b) => b.yMin))
    // Pildspalvas biezuma dēļ burti sniedzas nedaudz pāri augšējai līnijai.
    expect(top).toBeGreaterThan(PAD.lines.ascender)
    expect(font.metrics.ascender).toBe(top)
    expect(font.metrics.descender).toBe(Math.min(PAD.lines.descender, bottom))

    // Zīme, kas uzrakstīta brīvajā joslā zem apakšējās līnijas, pavelk metriku līdzi.
    const low = fixtureStrokes('ķ').map((s) => ({ points: s.points.map((p) => ({ ...p, y: p.y - 150 })) }))
    const lowFont = fontMetrics([buildOutline(low).bounds])
    expect(lowFont.descender).toBeLessThan(-350)
    expect(lowFont.descender).toBe(buildOutline(low).bounds!.yMin)
  })

  it('mazo un lielo burtu augstums nāk no laukuma līnijām', () => {
    const { xHeight, capHeight } = compileFont(fixtureProject()).metrics
    expect(xHeight).toBe(PAD.lines.xHeight)
    expect(capHeight).toBe(PAD.lines.ascender)
  })
})

describe('fonta kompilēšana', () => {
  it('katram uzrakstītajam variantam ir savs glifs; neuzrakstītu rakstzīmju nav', () => {
    const font = compileFont(fixtureProject(['a', 'b']))
    expect(Object.keys(font.glyphs)).toEqual(['a', 'b'])
    expect(font.glyphs['a']).toHaveLength(1)
    expect(font.glyphs['ā']).toBeUndefined()
  })

  it('kešs nepārrēķina glifus, kuru vilcieni nav mainījušies', () => {
    const cache = createGlyphCache()
    const project = fixtureProject(['a', 'b'])
    const first = compileFont(project, cache)
    const changed = {
      ...project,
      glyphs: { ...project.glyphs, b: { char: 'b', variants: [{ strokes: fixtureStrokes('d') }] } },
    }
    const second = compileFont(changed, cache)
    expect(second.glyphs['a']![0]).toBe(first.glyphs['a']![0])
    expect(second.glyphs['b']![0]).not.toBe(first.glyphs['b']![0])
    expect(second.glyphs['b']![0]).toEqual(compileVariant({ strokes: fixtureStrokes('d') }, project.style))
  })

  it('stila maiņa pārrēķina visus glifus', () => {
    const cache = createGlyphCache()
    const project = fixtureProject(['l'])
    const thin = compileFont(project, cache).glyphs['l']![0]!
    const bold = compileFont({ ...project, style: { ...project.style, strokeWidth: 2 } }, cache).glyphs['l']![0]!
    expect(bold.advance).toBeGreaterThan(thin.advance)
  })
})
