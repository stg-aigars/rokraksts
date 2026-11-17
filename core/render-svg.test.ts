import { describe, expect, it } from 'vitest'
import { fixtureAll, fixtureProject } from '../tests/fixtures/strokes'
import { getCharset } from './charsets'
import { compileFont } from './font'
import { layoutText } from './layout'
import { renderSvg } from './render-svg'
import type { CompiledFont } from './font'
import type { FontStyle } from './types'

const lv = getCharset('lv')
// Šajā daļā katram burtam ir viens variants un trices nav: pārbauda pašu SVG uzbūvi.
const font = compileFont(fixtureProject(['a', 'b', 'l', 's'], { variants: false }))
const render = (text: string, options = {}) =>
  renderSvg(layoutText(text, font, lv, { maxWidth: 4000, trice: false }), font, options)

describe('SVG izvade', () => {
  it('ir patstāvīgs SVG ar izkārtojuma izmēru kā viewBox', () => {
    const layout = layoutText('balss', font, lv, { maxWidth: 4000, trice: false })
    const svg = renderSvg(layout, font)
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 ${layout.height}"`)).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('katru glifu definē vienu reizi un lieto tik reižu, cik tas ir tekstā', () => {
    const svg = render('balss')
    expect(svg.match(/<path id=/g)).toHaveLength(4)
    expect(svg.match(/<use /g)).toHaveLength(5)
    // Abi "s" atsaucas uz vienu un to pašu kontūru.
    const refs = [...svg.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1])
    expect(refs[3]).toBe(refs[4])
    expect(new Set(refs).size).toBe(4)
  })

  it('glifu novieto izkārtojuma koordinātās', () => {
    const layout = layoutText('ab', font, lv, { maxWidth: 4000, trice: false })
    const svg = renderSvg(layout, font)
    for (const glyph of layout.glyphs) expect(svg).toContain(` x="${glyph.x}" y="${glyph.y}"/>`)
  })

  it('visi skaitļi izvadē ir veseli', () => {
    const svg = render('balss\nlab as')
    expect(svg).not.toMatch(/\d\.\d/)
    expect(svg).not.toMatch(/\de[+-]?\d/i)
    expect(svg).not.toContain('NaN')
  })

  it('tas pats teksts un glifi dod bait-identisku virkni', () => {
    const again = compileFont(fixtureProject(['a', 'b', 'l', 's'], { variants: false }))
    const a = render('balss lab')
    const b = renderSvg(layoutText('balss lab', again, lv, { maxWidth: 4000, trice: false }), again)
    expect(a).toBe(b)
    expect(new TextEncoder().encode(a)).toEqual(new TextEncoder().encode(b))
  })

  it('tintes krāsa ir iestatāma; nederīga krāsa netiek pieņemta', () => {
    expect(render('a')).toContain('fill="#1d2433"')
    expect(render('a', { ink: '#B4402C' })).toContain('fill="#b4402c"')
    expect(() => render('a', { ink: 'red" onload="x' })).toThrow()
  })

  it('teksts ir pieejams ekrāna lasītājiem un ir droši ievietots atribūtā', () => {
    expect(render('balss')).toContain('role="img" aria-label="balss"')
    expect(render('a<b>&"s"')).toContain('aria-label="a&lt;b&gt;&amp;“s“"')
  })

  it('neuzrakstītu rakstzīmi rāda kā tukšu rāmīti, nevis citu burtu', () => {
    const svg = render('ās')
    expect(svg.match(/<use /g)).toHaveLength(1)
    expect(svg.match(/<rect /g)).toHaveLength(1)
    expect(render('as')).not.toContain('<rect')
    expect(render('ās', { showMissing: false })).not.toContain('<rect')
  })

  it('identifikatoru priedēklis ļauj vienā lapā ievietot vairākus SVG', () => {
    const svg = render('ab', { idPrefix: 'p' })
    expect(svg).toContain('<path id="p0"')
    expect(svg).toContain('href="#p1"')
    expect(() => render('a', { idPrefix: 'x y' })).toThrow()
  })

  it('tukšs teksts dod derīgu tukšu SVG', () => {
    expect(render('')).toMatch(/^<svg [^>]*><\/svg>$/)
  })
})

describe('SVG ar variantiem un trici', () => {
  const sample = lv.sampleText
  const full = compileFont(fixtureProject())
  const draw = (seed: number, text = sample) => renderSvg(layoutText(text, full, lv, { maxWidth: 9000, seed }), full)

  it('viena un tā pati sēkla dod bait-identisku SVG, arī no jauna sakompilētam fontam', () => {
    const again = compileFont(fixtureProject())
    const a = draw(2026)
    const b = renderSvg(layoutText(sample, again, lv, { maxWidth: 9000, seed: 2026 }), again)
    expect(a).toBe(b)
    expect(new TextEncoder().encode(a)).toEqual(new TextEncoder().encode(b))
  })

  it('cita sēkla dod citu SVG', () => {
    expect(draw(1)).not.toBe(draw(2))
  })

  it('pangramma attēlojas pilnībā, un atkārtoti burti izmanto dažādus variantus', () => {
    const layout = layoutText(sample, full, lv, { maxWidth: 9000, seed: 5 })
    expect(layout.missing).toEqual([])
    expect(layout.glyphs).toHaveLength([...sample].filter((c) => c !== ' ').length)
    for (const char of ['a', 'ā', 'i', 'e', 'u', 'r', 'ķ']) {
      const seq = layout.glyphs.filter((g) => g.char === char).map((g) => g.variant)
      expect(seq.length, char).toBeGreaterThan(1)
      for (let i = 1; i < seq.length; i++) expect(seq[i], char).not.toBe(seq[i - 1])
    }
    // Katrs izmantotais variants ir definēts vienu reizi ar savu kontūru.
    const svg = renderSvg(layout, full)
    const used = new Set(layout.glyphs.map((g) => `${g.char}/${g.variant}`))
    const paths = [...svg.matchAll(/<path id="[^"]+" d="([^"]+)"/g)].map((m) => m[1])
    expect(paths).toHaveLength(used.size)
    expect(new Set(paths).size).toBe(used.size)
  })

  it('glifu novieto ar matricu: koeficienti ar līdz 3 cipariem aiz komata, pārbīde veseli skaitļi', () => {
    const svg = draw(3)
    const uses = [...svg.matchAll(/<use ([^>]*)\/>/g)].map((m) => m[1]!)
    expect(uses.length).toBeGreaterThan(40)
    for (const attributes of uses) {
      expect(attributes).toMatch(
        /^href="#g\d+" transform="matrix\((-?\d(\.\d{1,3})? ){4}-?\d+ -?\d+\)"$/,
      )
    }
  })

  it('ārpus matricu koeficientiem visi skaitļi ir veseli', () => {
    const svg = draw(3).replace(/matrix\([^)]*\)/g, 'matrix()')
    expect(svg).not.toMatch(/\d\.\d/)
    expect(draw(3)).not.toMatch(/\de[+-]?\d/i)
    expect(draw(3)).not.toContain('NaN')
    expect(draw(3)).not.toContain('-0 ')
  })
})

describe('zīmes netiek nogrieztas', () => {
  const full = compileFont(fixtureProject())
  const sample = lv.sampleText

  /** Glifa robežkaste SVG koordinātās pēc trices matricas. */
  function placedBox(g: { char: string; variant: number; matrix?: readonly number[] }) {
    const { bounds } = full.glyphs[g.char]![g.variant]!
    const [a, b, c, d, e, f] = g.matrix!
    const corners = [bounds.xMin, bounds.xMax].flatMap((x) =>
      [-bounds.yMax, -bounds.yMin].map((y) => [(a! * x + c! * y) / 1000 + e!, (b! * x + d! * y) / 1000 + f!]),
    )
    const xs = corners.map((p) => p[0]!)
    const ys = corners.map((p) => p[1]!)
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
  }

  it('fonta metrika aptver zīmes virs augšējās līnijas un zem pamatlīnijas', () => {
    const top = Math.max(...['ā', 'č', 'ģ', 'š', 'ž'].flatMap((c) => full.glyphs[c]!.map((g) => g.bounds.yMax)))
    const bottom = Math.min(...['ķ', 'ļ', 'ņ'].flatMap((c) => full.glyphs[c]!.map((g) => g.bounds.yMin)))
    expect(top).toBeGreaterThan(450)
    expect(bottom).toBeLessThan(0)
    expect(full.metrics.ascender).toBeGreaterThanOrEqual(top)
    expect(full.metrics.descender).toBeLessThanOrEqual(bottom)
  })

  it('ar jebkuru sēklu katrs glifs pilnībā ietilpst attēlā', () => {
    for (let seed = 0; seed < 60; seed++) {
      const layout = layoutText(sample, full, lv, { maxWidth: 6000, seed })
      for (const g of layout.glyphs) {
        const box = placedBox(g)
        expect(box.top, `${g.char} sēkla ${seed}`).toBeGreaterThanOrEqual(0)
        expect(box.bottom, `${g.char} sēkla ${seed}`).toBeLessThanOrEqual(layout.height)
        expect(box.left, `${g.char} sēkla ${seed}`).toBeGreaterThanOrEqual(0)
        expect(box.right, `${g.char} sēkla ${seed}`).toBeLessThanOrEqual(layout.width)
      }
    }
  })

  it('zīmes nesaduras ar blakus rindām: vienas rindas apakša ir virs nākamās augšas', () => {
    // Sliktākais gadījums: augšā rinda ar zīmēm apakšā, zem tās rinda ar zīmēm augšā.
    const text = 'ķļņgjp ķļņgjp\nāčģšžēīū āčģšžēīū\nķļņ ģģģ'
    for (let seed = 0; seed < 60; seed++) {
      const layout = layoutText(text, full, lv, { maxWidth: 9000, seed })
      expect(layout.lines).toHaveLength(3)
      const rows = layout.lines.map((line) => layout.glyphs.filter((g) => g.y === line.y).map(placedBox))
      for (let i = 1; i < rows.length; i++) {
        const bottom = Math.max(...rows[i - 1]!.map((box) => box.bottom))
        const top = Math.min(...rows[i]!.map((box) => box.top))
        expect(bottom, `sēkla ${seed}`).toBeLessThan(top)
      }
    }
  })
})

// --- 4. posms: visa kopa un stils ---

/** PRD 12. sadaļas etalona teksti. */
const ETALON_TEXTS = [
  'Glāžšķūņa rūķīši dzērumā čiepj Baha koncertflīģeļu vākus.',
  'ĀBOLU ČIEKURS ĒNA ĢIMENE ĪSS ĶERRA ĻOTI ŅEM ŠŪPOĻU ŪDENS ŽOGS',
  'Daudz laimes 30. dzimšanas dienā, Mārīt! ♥',
]

const styled = (style: Partial<FontStyle>) => {
  const project = fixtureProject(fixtureAll)
  return compileFont({ ...project, style: { ...project.style, ...style } })
}

/** Glifa robežkaste SVG koordinātās pēc trices matricas (vai vienkāršas pārbīdes). */
function boxIn(font: CompiledFont, g: { char: string; variant: number; x: number; y: number; matrix?: readonly number[] }) {
  const { bounds } = font.glyphs[g.char]![g.variant]!
  const [a, b, c, d, e, f] = g.matrix ?? [1000, 0, 0, 1000, g.x, g.y]
  const corners = [bounds.xMin, bounds.xMax].flatMap((x) =>
    [-bounds.yMax, -bounds.yMin].map((y) => [(a! * x + c! * y) / 1000 + e!, (b! * x + d! * y) / 1000 + f!]),
  )
  const xs = corners.map((p) => p[0]!)
  const ys = corners.map((p) => p[1]!)
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
}

describe('visa 99 rakstzīmju kopa', () => {
  const full = compileFont(fixtureProject(fixtureAll))

  it('visi trīs PRD etalona teksti attēlojas pilnībā, bez neviena tukša rāmīša', () => {
    for (const text of ETALON_TEXTS) {
      const layout = layoutText(text, full, lv, { maxWidth: 9000, seed: 2026 })
      expect(layout.missingChars, text).toEqual([])
      expect(layout.glyphs, text).toHaveLength([...text].filter((c) => c !== ' ').length)
      expect(renderSvg(layout, full), text).not.toContain('<rect')
    }
  })

  it('jebkura kopas rakstzīme attēlojas ar savu glifu', () => {
    const text = fixtureAll.join('')
    const layout = layoutText(text, full, lv, { maxWidth: 9000, seed: 1 })
    expect(layout.missing).toEqual([])
    expect(layout.glyphs.map((g) => g.char).join('')).toBe(text)
  })
})

describe('stils: biezums, atstarpes, izmērs, slīpums', () => {
  const extremes: Partial<FontStyle>[] = [
    { strokeWidth: 2, spacing: 0.04, scale: 1.25, slant: 0.35 },
    { strokeWidth: 2, spacing: 0.04, scale: 1.25, slant: -0.2 },
    { strokeWidth: 0.5, spacing: 0.04, scale: 0.8, slant: 0.35 },
    { strokeWidth: 0.5, spacing: 0.16, scale: 0.8, slant: -0.2 },
  ]

  it('ar galējiem stiliem un jebkuru sēklu zīmes netiek nogrieztas', () => {
    const text = `${ETALON_TEXTS.join('\n')}\nķļņģjpy ĢĶĻŅ (Q) „āčž“`
    for (const style of extremes) {
      const font = styled(style)
      for (let seed = 0; seed < 25; seed++) {
        const layout = layoutText(text, font, lv, { maxWidth: 7000, seed })
        expect(layout.missing).toEqual([])
        for (const g of layout.glyphs) {
          const box = boxIn(font, g)
          const where = `${g.char} ${JSON.stringify(style)} sēkla ${seed}`
          expect(box.top, where).toBeGreaterThanOrEqual(0)
          expect(box.bottom, where).toBeLessThanOrEqual(layout.height)
          expect(box.left, where).toBeGreaterThanOrEqual(0)
          expect(box.right, where).toBeLessThanOrEqual(layout.width)
        }
      }
    }
  })

  it('katra stila maiņa ir redzama SVG', () => {
    const draw = (style: Partial<FontStyle>) =>
      renderSvg(layoutText(ETALON_TEXTS[2]!, styled(style), lv, { maxWidth: 9000, seed: 3 }), styled(style))
    const base = draw({})
    const svgs = [{ strokeWidth: 1.5 }, { spacing: 0.1 }, { scale: 1.2 }, { slant: 0.2 }].map(draw)
    for (const svg of svgs) expect(svg).not.toBe(base)
    expect(new Set(svgs).size).toBe(svgs.length)
  })

  it('viena sēkla ar vienu stilu dod bait-identisku SVG, arī no jauna sakompilētam fontam', () => {
    for (const style of extremes) {
      const a = styled(style)
      const b = styled(style)
      const svgA = renderSvg(layoutText(ETALON_TEXTS[1]!, a, lv, { maxWidth: 9000, seed: 42 }), a)
      const svgB = renderSvg(layoutText(ETALON_TEXTS[1]!, b, lv, { maxWidth: 9000, seed: 42 }), b)
      expect(new TextEncoder().encode(svgA)).toEqual(new TextEncoder().encode(svgB))
      // Arī ar slīpumu un izmēru izvadē ir tikai veseli skaitļi (izņemot trices koeficientus).
      expect(svgA.replace(/matrix\([^)]*\)/g, '')).not.toMatch(/\d\.\d/)
    }
  })
})
