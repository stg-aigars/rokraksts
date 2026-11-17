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
    // Metriku nosaka visi varianti, ne tikai pirmais.
    const all = Object.values(font.glyphs).flatMap((variants) => variants.map((v) => v.bounds))
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

  it('ar izmēru laukuma līniju minimumi mērogojas kopā ar glifiem', () => {
    expect(fontMetrics([], { scale: 1.2 })).toEqual({ upm: 1000, ascender: 840, descender: -300, xHeight: 540, capHeight: 840 })
    expect(fontMetrics([], { scale: 0.85 })).toEqual({ upm: 1000, ascender: 595, descender: -212, xHeight: 383, capHeight: 595 })
    const small = compileFont({ ...fixtureProject(['a', 'o']), style: { ...style, scale: 0.8 } }).metrics
    expect(small.ascender).toBe(560)
    expect(small.descender).toBe(-200)
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
    expect(font.glyphs['a']).toHaveLength(3)
    expect(font.glyphs['b']).toHaveLength(1)
    expect(font.glyphs['ā']).toBeUndefined()
    // Katrs variants ir cits zīmējums ar savu kontūru un platumu.
    expect(new Set(font.glyphs['a']!.map((g) => g.path)).size).toBe(3)
  })

  it('augstāks otrais variants pavelk fonta metriku līdzi, lai tas netiktu nogriezts', () => {
    const project = fixtureProject(['a'], { variants: false })
    const tall = fixtureStrokes('l').map((s) => ({ points: s.points.map((p) => ({ ...p, y: p.y + 180 })) }))
    project.glyphs['a']!.variants.push({ strokes: tall })
    const font = compileFont(project)
    expect(font.glyphs['a']![1]!.bounds.yMax).toBeGreaterThan(850)
    expect(font.metrics.ascender).toBe(font.glyphs['a']![1]!.bounds.yMax)
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

  it('slīpums un izmērs: glifs joprojām sākas pie kreisās atstarpes, un nekas neiziet ārpus platuma', () => {
    for (const variant of [{ ...style, slant: 0.35, scale: 1.25 }, { ...style, slant: -0.2, scale: 0.8, spacing: 0.04 }]) {
      for (const [char, strokes] of Object.entries(fixtureGlyphs)) {
        const glyph = compileVariant({ strokes }, variant)
        expect(glyph.bounds.xMin, char).toBe(sideBearing(variant))
        expect(glyph.advance, char).toBe(glyph.bounds.xMax + sideBearing(variant))
      }
    }
  })

  it('stila maiņa pārrēķina visus glifus', () => {
    const cache = createGlyphCache()
    const project = fixtureProject(['l'])
    const thin = compileFont(project, cache).glyphs['l']![0]!
    const bold = compileFont({ ...project, style: { ...project.style, strokeWidth: 2 } }, cache).glyphs['l']![0]!
    expect(bold.advance).toBeGreaterThan(thin.advance)
  })
})
