import { describe, expect, it } from 'vitest'
import { fixtureCases, fixtureGlyphs, fixtureStrokes } from '../tests/fixtures/strokes'
import {
  MAX_GLYPH_POINTS,
  PEN_SIZE,
  buildOutline,
  flattenContour,
  mergeStrokes,
  outlineToPath,
  pointCount,
  ringArea,
} from './outline'
import type { GlyphOutline } from './outline'
import type { Point, Stroke } from './types'

const everything = { ...fixtureGlyphs, ...fixtureCases }

const contourAreas = (outline: GlyphOutline) => outline.contours.map((c) => ringArea(flattenContour(c, 16)))
const totalArea = (outline: GlyphOutline) => contourAreas(outline).reduce((sum, a) => sum + a, 0)

/** Taisns vilciens no (200, 200) līdz (800, 200) ar doto soli laikā un, ja dots, spiedienu. */
function straight(msPerPoint: number, p?: number): Stroke {
  const points: Point[] = []
  for (let i = 0; i <= 30; i++) {
    const point: Point = { x: 200 + i * 20, y: 200, t: i * msPerPoint }
    if (p !== undefined) point.p = p
    points.push(point)
  }
  return { points }
}

describe('vilcieni -> kontūra', () => {
  it('katrs etalona glifs dod kontūru ar veselām koordinātām', () => {
    for (const [name, strokes] of Object.entries(everything)) {
      const outline = buildOutline(strokes)
      expect(outline.contours.length, name).toBeGreaterThan(0)
      const numbers = outline.contours.flatMap((c) => [c.start, ...c.segments.flatMap((s) => [s.c1, s.c2, s.to])]).flat()
      for (const n of numbers) if (n !== undefined) expect(Number.isInteger(n), name).toBe(true)
    }
  })

  it(`katram etalona glifam ir ne vairāk par ${MAX_GLYPH_POINTS} punktiem`, () => {
    for (const [name, strokes] of Object.entries(everything)) {
      expect(pointCount(buildOutline(strokes)), name).toBeLessThanOrEqual(MAX_GLYPH_POINTS)
    }
  })

  it('robežkaste aptver vilcienus un nav platāka par pildspalvas biezumu ap tiem', () => {
    for (const [name, strokes] of Object.entries(everything)) {
      const { bounds } = buildOutline(strokes)
      const points = strokes.flatMap((s) => s.points)
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      expect(bounds, name).not.toBeNull()
      // Izlīdzināšana drīkst nedaudz nogriezt trīci, bet ne vairāk par dažām vienībām.
      expect(bounds!.xMin, name).toBeLessThan(Math.min(...xs) + 4)
      expect(bounds!.xMax, name).toBeGreaterThan(Math.max(...xs) - 4)
      expect(bounds!.yMin, name).toBeLessThan(Math.min(...ys) + 4)
      expect(bounds!.yMax, name).toBeGreaterThan(Math.max(...ys) - 4)
      expect(bounds!.xMin, name).toBeGreaterThan(Math.min(...xs) - PEN_SIZE)
      expect(bounds!.xMax, name).toBeLessThan(Math.max(...xs) + PEN_SIZE)
      expect(bounds!.yMin, name).toBeGreaterThan(Math.min(...ys) - PEN_SIZE)
      expect(bounds!.yMax, name).toBeLessThan(Math.max(...ys) + PEN_SIZE)
    }
  })

  it('tukšs vilcienu saraksts dod tukšu kontūru', () => {
    expect(buildOutline([])).toEqual({ contours: [], bounds: null })
  })

  it('viens pieskāriens dod apaļu punktu', () => {
    const outline = buildOutline(fixtureStrokes('punkts'))
    expect(outline.contours).toHaveLength(1)
    const { xMin, xMax, yMin, yMax } = outline.bounds!
    expect(Math.abs(xMax - xMin - (yMax - yMin))).toBeLessThanOrEqual(4)
    expect(xMax - xMin).toBeGreaterThan(PEN_SIZE * 0.6)
  })
})

describe('apvienošana bez pārklājumiem', () => {
  it('krustoti vilcieni saplūst vienā kontūrā (t: stabs un šķērssvītra)', () => {
    expect(buildOutline(fixtureStrokes('t')).contours).toHaveLength(1)
    expect(buildOutline(fixtureStrokes('k')).contours).toHaveLength(1)
  })

  it('atsevišķas daļas paliek atsevišķas (i: stabs un punkts; ā: burts un garumzīme)', () => {
    expect(contourAreas(buildOutline(fixtureStrokes('i'))).map(Math.sign)).toEqual([1, 1])
    // ā: burta ārējā kontūra, garumzīme un caurums burta iekšpusē.
    expect(contourAreas(buildOutline(fixtureStrokes('ā'))).map(Math.sign).sort()).toEqual([-1, 1, 1])
  })

  it('virzieni ir izlīdzināti: ārējā kontūra pret pulksteņrādītāja virzienu, caurums pa to (o)', () => {
    const areas = contourAreas(buildOutline(fixtureStrokes('o')))
    expect(areas).toHaveLength(2)
    expect(areas[0]).toBeGreaterThan(0)
    expect(areas[1]).toBeLessThan(0)
    expect(Math.abs(areas[1]!)).toBeLessThan(areas[0]!)
  })

  it('vilciens, kas krusto pats sevi, krustpunktā nepaliek caurs', () => {
    // Cilpa: viena ārējā kontūra un viens īsts caurums cilpas iekšpusē, nevis divi.
    const areas = contourAreas(buildOutline(fixtureStrokes('cilpa')))
    expect(areas.map(Math.sign)).toEqual([1, -1])
  })

  it('švīkājums ar daudziem pārklājumiem saplūst vienā ārējā kontūrā', () => {
    const areas = contourAreas(buildOutline(fixtureStrokes('svikajums')))
    expect(areas.filter((a) => a > 0)).toHaveLength(1)
  })

  it('apvienotā laukuma platība nepārsniedz atsevišķo vilcienu platību summu', () => {
    const strokes = fixtureStrokes('t')
    const separate = strokes.map((s) => totalArea(buildOutline([s]))).reduce((a, b) => a + b, 0)
    const merged = totalArea(buildOutline(strokes))
    expect(merged).toBeLessThan(separate)
    expect(merged).toBeGreaterThan(separate * 0.9)
  })
})

describe('vienkāršošana', () => {
  it('līknes saglabā formu: platība atšķiras no poligona mazāk nekā par 3%', () => {
    for (const [name, strokes] of Object.entries(everything)) {
      const polygonArea = mergeStrokes(strokes).reduce((sum, ring) => sum + ringArea(ring), 0)
      const curveArea = totalArea(buildOutline(strokes))
      expect(Math.abs(curveArea - polygonArea) / polygonArea, name).toBeLessThan(0.03)
    }
  })

  it('taisns vilciens dod pavisam maz punktu', () => {
    expect(pointCount(buildOutline([straight(10)]))).toBeLessThanOrEqual(12)
  })
})

describe('līnijas platums', () => {
  const thickness = (stroke: Stroke, strokeWidth = 1) => {
    const { bounds } = buildOutline([stroke], { strokeWidth })
    return bounds!.yMax - bounds!.yMin
  }

  it('bez spiediena platumu nosaka ātrums: lēns vilciens ir biezāks par ātru', () => {
    expect(thickness(straight(40))).toBeGreaterThan(thickness(straight(3)) + 6)
  })

  it('ja ierīce mēra spiedienu, platumu nosaka tas, nevis ātrums', () => {
    expect(thickness(straight(10, 0.9))).toBeGreaterThan(thickness(straight(10, 0.2)) + 10)
    expect(thickness(straight(3, 0.6))).toBe(thickness(straight(40, 0.6)))
  })

  it('stila strokeWidth maina biezumu proporcionāli', () => {
    const normal = thickness(straight(10, 0.5))
    const bold = thickness(straight(10, 0.5), 2)
    expect(bold / normal).toBeGreaterThan(1.8)
    expect(bold / normal).toBeLessThan(2.2)
  })

  it('vilciens ar vienādiem laikiem (t nemainās) nesalūst', () => {
    const frozen: Stroke = { points: straight(10).points.map((p) => ({ ...p, t: 0 })) }
    expect(buildOutline([frozen]).contours).toHaveLength(1)
  })
})

describe('determinisms un ātrums', () => {
  it('tie paši vilcieni vienmēr dod to pašu kontūru un netiek mainīti', () => {
    for (const [name, strokes] of Object.entries(everything)) {
      const before = JSON.stringify(strokes)
      const first = buildOutline(strokes)
      expect(buildOutline(strokes), name).toEqual(first)
      expect(JSON.stringify(strokes), name).toBe(before)
    }
  })

  it('SVG ceļā ir tikai veseli skaitļi, un y ir apgriezts (uz leju)', () => {
    const outline = buildOutline(fixtureStrokes('l'))
    const path = outlineToPath(outline)
    expect(path).toMatch(/^(M-?\d+ -?\d+((L-?\d+ -?\d+)|(C-?\d+ -?\d+ -?\d+ -?\d+ -?\d+ -?\d+))+Z)+$/)
    // "l" ir virs pamatlīnijas, tāpēc SVG koordinātās gandrīz viss ir ar negatīvu y.
    const ys = [...path.matchAll(/-?\d+ (-?\d+)/g)].map((m) => Number(m[1]))
    expect(Math.min(...ys)).toBeLessThan(-650)
    // Nobīde pa x pārbīda visus punktus.
    const shifted = outlineToPath(outline, 100)
    const firstX = (d: string) => Number(/^M(-?\d+)/.exec(d)![1])
    expect(firstX(shifted) - firstX(path)).toBe(100)
  })

  it('glifs pārrēķinās krietni zem 50 ms (PRD 12. sadaļa)', () => {
    for (const strokes of Object.values(everything)) buildOutline(strokes) // iesildīšana
    const times = Object.entries(everything).map(([name, strokes]) => {
      const runs = Array.from({ length: 5 }, () => {
        const start = performance.now()
        buildOutline(strokes)
        return performance.now() - start
      }).sort((a, b) => a - b)
      return { name, ms: runs[2]! }
    })
    const worst = times.reduce((a, b) => (b.ms > a.ms ? b : a))
    // Slieksnis telefonam ir 50 ms; testa mašīnā prasām uz pusi mazāk (parasti iznāk 1–5 ms).
    expect(worst.ms, `lēnākais: ${worst.name}`).toBeLessThan(25)
  })
})
