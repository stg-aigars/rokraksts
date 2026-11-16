import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../tests/fixtures/strokes'
import { getCharset } from './charsets'
import { compileFont } from './font'
import { layoutText } from './layout'
import { renderSvg } from './render-svg'

const lv = getCharset('lv')
const font = compileFont(fixtureProject(['a', 'b', 'l', 's']))
const render = (text: string, options = {}) =>
  renderSvg(layoutText(text, font, lv, { maxWidth: 4000 }), font, options)

describe('SVG izvade', () => {
  it('ir patstāvīgs SVG ar izkārtojuma izmēru kā viewBox', () => {
    const layout = layoutText('balss', font, lv, { maxWidth: 4000 })
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
    const layout = layoutText('ab', font, lv, { maxWidth: 4000 })
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
    const again = compileFont(fixtureProject(['a', 'b', 'l', 's']))
    const a = render('balss lab')
    const b = renderSvg(layoutText('balss lab', again, lv, { maxWidth: 4000 }), again)
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
