import { getStroke } from 'perfect-freehand'
import polygonClipping from 'polygon-clipping'
import { styleUnits, transformRing } from './style'
import type { FontStyle, Stroke } from './types'

// Vilcieni -> glifa kontūra (PRD 6. sadaļas 2.–4. solis):
//   1. katrs vilciens kļūst par mainīga platuma poligonu (perfect-freehand); platumu nosaka
//      spiediens, bet, ja ierīce to nemēra, rakstīšanas ātrums;
//   2. viena burta poligonus apvieno vienā formā bez pārklājumiem (polygon-clipping) un
//      izlīdzina virzienus: ārējās kontūras pret pulksteņrādītāja virzienu, caurumi pa to;
//   3. stila izmērs un slīpums pārveido poligona punktus veselos skaitļos (core/style.ts);
//   4. poligonu pārvērš kubiskās Bezjē līknēs ar pielaidi un noapaļo līdz veseliem skaitļiem.
// Viss ir fonta vienībās ar y uz augšu; SVG ceļā (outlineToPath) y tiek apgriezts.

export type Pt = readonly [number, number]
/** Noslēgts poligons bez atkārtota pirmā punkta beigās. */
export type Ring = Pt[]
/** Taisne līdz `to` vai kubiskā Bezjē līkne ar vadības punktiem `c1` un `c2`. */
export type Segment = { to: Pt; c1?: Pt; c2?: Pt }
/** Noslēgta kontūra; pēdējais segments beidzas sākumpunktā. */
export type Contour = { start: Pt; segments: Segment[] }
export type Bounds = { xMin: number; yMin: number; xMax: number; yMax: number }
export type GlyphOutline = { contours: Contour[]; bounds: Bounds | null }

/** Pildspalvas diametrs fonta vienībās pie vidēja spiediena un stila strokeWidth = 1. */
export const PEN_SIZE = 44
/** Mērķis no PRD: tik mezglu (līknes galapunktu) uz glifu, neskaitot vadības punktus. */
export const MAX_GLYPH_POINTS = 60

/** Biezums ir obligāts; bez izmēra un slīpuma glifs ir tāds, kā uzrakstīts. */
type OutlineStyle = Pick<FontStyle, 'strokeWidth'> & Partial<Pick<FontStyle, 'slant' | 'scale'>>

// --- platums ---

const SPEED_SLOW_PRESSURE = 0.85
const SPEED_FAST_PRESSURE = 0.25
/** Ātrums (vienības milisekundē), pie kura līnija sasniedz mazāko platumu. */
const SPEED_FAST = 6
/** Platuma izlīdzināšanas laika konstante milisekundēs. */
const SPEED_SMOOTHING_MS = 50

/**
 * Spiediens 0..1 katram punktam. Ja ierīce spiedienu mēra visā vilcienā, lieto to;
 * citādi simulē no ātruma: lēni rakstīta līnija ir biezāka, ātri rakstīta plānāka.
 */
export function strokePressures(stroke: Stroke): number[] {
  const points = stroke.points
  if (points.every((p) => p.p !== undefined)) return points.map((p) => p.p!)

  const result: number[] = []
  let pressure: number | null = null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const dt = b.t - a.t
    if (dt <= 0) {
      // Laiks nav zināms (vairāki punkti vienā mirklī): platums paliek, kāds bija.
      result.push(pressure ?? 0.5)
      continue
    }
    const speed = Math.hypot(b.x - a.x, b.y - a.y) / dt
    const target = SPEED_SLOW_PRESSURE - (SPEED_SLOW_PRESSURE - SPEED_FAST_PRESSURE) * Math.min(1, speed / SPEED_FAST)
    pressure = pressure === null ? target : pressure + (target - pressure) * (1 - Math.exp(-dt / SPEED_SMOOTHING_MS))
    result.push(pressure)
  }
  // Pirmajam punktam ātruma vēl nav: tas saņem pirmā posma vērtību.
  result.unshift(result[0] ?? 0.5)
  return result
}

function strokeRing(stroke: Stroke, size: number): Ring {
  const pressures = strokePressures(stroke)
  const raw = getStroke(
    stroke.points.map((p, i) => [p.x, p.y, pressures[i]!]),
    { size, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: false, last: true },
  )
  const ring: Ring = []
  for (const [rx, ry] of raw) {
    const x = Math.round(rx!)
    const y = Math.round(ry!)
    const last = ring[ring.length - 1]
    if (!last || last[0] !== x || last[1] !== y) ring.push([x, y])
  }
  return dropClosingPoint(ring)
}

// --- poligonu ģeometrija ---

function dropClosingPoint(ring: Ring): Ring {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (ring.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1)
  return ring
}

/** Platība ar zīmi: pozitīva, ja punkti iet pret pulksteņrādītāja virzienu (y uz augšu). */
export function ringArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return sum / 2
}

/** Cik reižu poligons apvijas ap punktu (0 nozīmē, ka punkts ir ārpusē). */
function windingNumber(ring: Ring, [px, py]: Pt): number {
  let winding = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    const side = (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])
    if (a[1] <= py) {
      if (b[1] > py && side > 0) winding++
    } else if (b[1] <= py && side < 0) winding--
  }
  return winding
}

/** Punkts vienkārša poligona iekšpusē: viduspunkts starp diviem pirmajiem horizontāles krustpunktiem. */
function interiorPoint(ring: Ring): Pt {
  const ys = [...new Set(ring.map((p) => p[1]))].sort((a, b) => a - b)
  const k = Math.floor((ys.length - 1) / 2)
  const y = ys.length > 1 ? (ys[k]! + ys[k + 1]!) / 2 : ys[0]!
  const crossings: number[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    if (a[1] <= y !== b[1] <= y) crossings.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
  }
  crossings.sort((a, b) => a - b)
  return [((crossings[0] ?? ring[0]![0]) + (crossings[1] ?? ring[0]![0])) / 2, y]
}

type ClipRing = [number, number][]
type ClipPolygon = ClipRing[]

const toClip = (ring: Ring): ClipRing => ring.map(([x, y]) => [x, y])

function orient(ring: Ring, positive: boolean): Ring {
  return ringArea(ring) > 0 === positive ? ring : [...ring].reverse()
}

/** Kontūras, kas mazākas par šo platību (vienības²), ir putekļi un tiek atmestas. */
const MIN_RING_AREA = 40

/**
 * Viena burta vilcieni kā poligoni bez pārklājumiem. Ārējās kontūras iet pret
 * pulksteņrādītāja virzienu, caurumi pa to; katrai ārējai kontūrai seko tās caurumi.
 */
export function mergeStrokes(strokes: readonly Stroke[], style: OutlineStyle = { strokeWidth: 1 }): Ring[] {
  const size = PEN_SIZE * style.strokeWidth
  const rings = strokes.filter((s) => s.points.length > 0).map((s) => strokeRing(s, size))
  const usable = rings.filter((ring) => ring.length >= 3)
  if (usable.length === 0) return []

  let merged: ClipPolygon[]
  try {
    const polygons = usable.map((ring): ClipPolygon => [toClip(ring)])
    merged = polygonClipping.union(polygons[0]!, ...polygons.slice(1))
    // polygon-clipping viena poligona paškrustojumus šķeļ pēc pāra-nepāra likuma, tāpēc vieta,
    // kur vilciens pārklāj pats sevi, var iznākt caura. Īsts caurums ir tikai tāds, ap kuru
    // neapvijas neviens vilciens; pārējos aizpildām un, ja tādi bija, apvienojam vēlreiz.
    let filled = false
    merged = merged.map(([outer, ...holes]) => [
      outer!,
      ...holes.filter((hole) => {
        const inside = interiorPoint(dropClosingPoint(hole))
        const real = usable.every((ring) => windingNumber(ring, inside) === 0)
        if (!real) filled = true
        return real
      }),
    ])
    if (filled) merged = polygonClipping.union(merged[0]!, ...merged.slice(1))
  } catch {
    // polygon-clipping retos deģenerētos gadījumos nespēj pabeigt aprēķinu. Tad atstājam
    // vilcienus neapvienotus ar vienādu virzienu: aizpildījums ir pareizs, tikai ar pārklājumiem.
    return usable.map((ring) => orient(ring, true))
  }

  const result: Ring[] = []
  for (const [outer, ...holes] of merged) {
    const outerRing = dropClosingPoint(outer!)
    if (Math.abs(ringArea(outerRing)) < MIN_RING_AREA) continue
    result.push(orient(outerRing, true))
    for (const hole of holes) {
      const holeRing = dropClosingPoint(hole)
      if (Math.abs(ringArea(holeRing)) >= MIN_RING_AREA) result.push(orient(holeRing, false))
    }
  }
  return result
}

// --- poligons -> Bezjē līknes ---

/** Garākais posms sablīvētajā poligonā; īsāki posmi dod precīzāku kļūdas mērījumu. */
const DENSE_STEP = 12
/** Attālums gar kontūru, kurā mēra virzienu pirms un pēc punkta. */
const TANGENT_REACH = 8
/** Pagrieziens, no kura punkts ir stūris (līkne tajā nav gluda). */
const CORNER_COS = Math.cos((50 * Math.PI) / 180)
/** Ja posms no taisnes neatkāpjas vairāk par šo, tas ir taisne. */
const LINE_TOLERANCE = 1
/** Pielaides, ko izmēģina pēc kārtas, līdz glifs ietilpst MAX_GLYPH_POINTS (lielākās vajag lieliem, slīpiem glifiem). */
const FIT_TOLERANCES = [1.5, 2.5, 4, 6, 9, 13, 18]

type Vec = [number, number]

function densify(ring: Ring): Vec[] {
  const dense: Vec[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / DENSE_STEP))
    for (let s = 0; s < steps; s++) dense.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps])
  }
  return dense
}

function unit(dx: number, dy: number): Vec {
  const length = Math.hypot(dx, dy)
  return length === 0 ? [0, 0] : [dx / length, dy / length]
}

function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

function cubicAt(p0: Vec, c1: Vec, c2: Vec, p3: Vec, t: number): Vec {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return [w0 * p0[0] + w1 * c1[0] + w2 * c2[0] + w3 * p3[0], w0 * p0[1] + w1 * c1[1] + w2 * c2[1] + w3 * p3[1]]
}

type FloatSegment = { to: Vec; c1?: Vec; c2?: Vec }

type Span = { line: boolean; c1: Vec; c2: Vec; worst: number; worstIndex: number }
type RingFitter = (tolerance: number) => { start: Vec; segments: FloatSegment[] }

/**
 * Sagatavo vienu poligonu pārvēršanai līknēs: pieskares, stūri un mezgli nav atkarīgi no
 * pielaides, tāpēc tos rēķina vienreiz; atgrieztā funkcija pielāgo līknes ar doto pielaidi.
 */
function prepareRing(ring: Ring): RingFitter {
  const dense = densify(ring)
  const n = dense.length
  const at = (i: number): Vec => dense[((i % n) + n) % n]!

  /** Punkts vismaz TANGENT_REACH attālumā gar kontūru virzienā `direction`. */
  const reach = (i: number, direction: 1 | -1): Vec => {
    let travelled = 0
    let k = i
    for (let steps = 0; steps < n - 1 && travelled < TANGENT_REACH; steps++) {
      const a = at(k)
      const b = at(k + direction)
      travelled += Math.hypot(b[0] - a[0], b[1] - a[1])
      k += direction
    }
    return at(k)
  }

  const incoming: Vec[] = []
  const outgoing: Vec[] = []
  const corner: boolean[] = []
  for (let i = 0; i < n; i++) {
    const p = at(i)
    const before = reach(i, -1)
    const after = reach(i, 1)
    const tin = unit(p[0] - before[0], p[1] - before[1])
    const tout = unit(after[0] - p[0], after[1] - p[1])
    const isCorner = tin[0] * tout[0] + tin[1] * tout[1] < CORNER_COS
    corner.push(isCorner)
    if (isCorner) {
      incoming.push(tin)
      outgoing.push(tout)
    } else {
      // Gludā punktā pieskare ir viena abos virzienos, lai līkne paliktu bez lūzuma.
      const smooth = unit(after[0] - before[0], after[1] - before[1])
      incoming.push(smooth)
      outgoing.push(smooth)
    }
  }

  // Obligātie mezgli: stūri. Blakus stūru punktu grupā (noapaļots lūzums) paliek asākais.
  const nodes: number[] = []
  for (let i = 0; i < n; i++) {
    if (!corner[i]) continue
    const sharpness = (k: number) => incoming[k]![0] * outgoing[k]![0] + incoming[k]![1] * outgoing[k]![1]
    const previous = nodes[nodes.length - 1]
    if (previous !== undefined && corner[i - 1] && previous === i - 1) {
      if (sharpness(i) < sharpness(previous)) nodes[nodes.length - 1] = i
    } else nodes.push(i)
  }
  if (nodes.length < 2) {
    // Gludai kontūrai (aplis, punkts) vajag vismaz divus mezglus: sākums un tālākais punkts no tā.
    const first = nodes[0] ?? 0
    let farthest = (first + Math.floor(n / 2)) % n
    let best = -1
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(at(i)[0] - at(first)[0], at(i)[1] - at(first)[1])
      if (d > best) {
        best = d
        farthest = i
      }
    }
    nodes.length = 0
    nodes.push(...[first, farthest].sort((a, b) => a - b))
  }

  // Posma (i..j) līkne un tās kļūda nav atkarīga no pielaides; kešs aiztaupa atkārtotu darbu,
  // kad to pašu poligonu pielāgo ar lielāku pielaidi.
  const spans = new Map<number, Span>()

  const measure = (i: number, j: number): Span => {
    const key = i * (2 * n + 1) + j
    const cached = spans.get(key)
    if (cached) return cached

    const p0 = at(i)
    const p3 = at(j)
    let lineError = 0
    for (let k = i + 1; k < j; k++) lineError = Math.max(lineError, distanceToSegment(at(k), p0, p3))
    let span: Span
    if (lineError <= LINE_TOLERANCE) span = { line: true, c1: p0, c2: p3, worst: 0, worstIndex: i }
    else {
      // Vadības punktu garums kā riņķa lokam ar tādu pašu pagriezienu starp galu pieskarēm.
      const t0 = outgoing[((i % n) + n) % n]!
      const t1 = incoming[((j % n) + n) % n]!
      const turn = Math.min(2.2, Math.acos(Math.min(1, Math.max(-1, t0[0] * t1[0] + t0[1] * t1[1]))))
      const handle = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / (3 * Math.cos(turn / 4) ** 2)
      const c1: Vec = [p0[0] + t0[0] * handle, p0[1] + t0[1] * handle]
      const c2: Vec = [p3[0] - t1[0] * handle, p3[1] - t1[1] * handle]

      const samples = Math.min(32, Math.max(8, (j - i) * 2))
      const curve: Vec[] = []
      for (let q = 0; q <= samples; q++) curve.push(cubicAt(p0, c1, c2, p3, q / samples))

      // Poligona punkti un līkne iet vienā virzienā, tāpēc tuvāko līknes posmu meklē tikai
      // logā ap iepriekšējā punkta tuvāko posmu (punkti nav vienmērīgi, tāpēc logs ir 8 posmi).
      let worst = 0
      let worstIndex = i + Math.floor((j - i) / 2)
      let nearest = 0
      for (let k = i + 1; k < j; k++) {
        let distance = Infinity
        let found = nearest
        const last = Math.min(samples - 1, nearest + 8)
        for (let q = Math.max(0, nearest - 1); q <= last; q++) {
          const d = distanceToSegment(at(k), curve[q]!, curve[q + 1]!)
          if (d < distance) {
            distance = d
            found = q
          }
        }
        nearest = found
        if (distance > worst) {
          worst = distance
          worstIndex = k
        }
      }
      span = { line: false, c1, c2, worst, worstIndex }
    }
    spans.set(key, span)
    return span
  }

  return (tolerance) => {
    const segments: FloatSegment[] = []
    const fitSpan = (i: number, j: number): void => {
      if (j - i <= 1) {
        segments.push({ to: at(j) })
        return
      }
      const span = measure(i, j)
      if (span.line) segments.push({ to: at(j) })
      else if (span.worst <= tolerance) segments.push({ to: at(j), c1: span.c1, c2: span.c2 })
      else {
        fitSpan(i, span.worstIndex)
        fitSpan(span.worstIndex, j)
      }
    }
    for (let k = 0; k < nodes.length; k++) {
      const from = nodes[k]!
      fitSpan(from, k + 1 < nodes.length ? nodes[k + 1]! : nodes[0]! + n)
    }
    return { start: at(nodes[0]!), segments }
  }
}

function roundPoint([x, y]: Vec): Pt {
  // "+ 0" pārvērš −0 par 0, lai izvadē un salīdzinājumos nebūtu divu nuļļu.
  return [Math.round(x) + 0, Math.round(y) + 0]
}

function fitContours(fitters: RingFitter[], tolerance: number): Contour[] {
  const contours: Contour[] = []
  for (const fit of fitters) {
    const fitted = fit(tolerance)
    const start = roundPoint(fitted.start)
    const segments: Segment[] = []
    let previous = start
    for (const segment of fitted.segments) {
      const to = roundPoint(segment.to)
      // Pēc noapaļošanas tukši posmi (punkts pats uz sevi) nav vajadzīgi.
      if (to[0] === previous[0] && to[1] === previous[1]) continue
      segments.push(segment.c1 && segment.c2 ? { to, c1: roundPoint(segment.c1), c2: roundPoint(segment.c2) } : { to })
      previous = to
    }
    if (segments.length >= 2) contours.push({ start, segments })
  }
  return contours
}

/** Mezglu skaits visās kontūrās (katra segmenta galapunkts; vadības punkti netiek skaitīti). */
export function pointCount(outline: GlyphOutline): number {
  return outline.contours.reduce((sum, contour) => sum + contour.segments.length, 0)
}

function boundsOf(contours: Contour[]): Bounds | null {
  let bounds: Bounds | null = null
  const add = ([x, y]: Pt) => {
    bounds = bounds
      ? { xMin: Math.min(bounds.xMin, x), yMin: Math.min(bounds.yMin, y), xMax: Math.max(bounds.xMax, x), yMax: Math.max(bounds.yMax, y) }
      : { xMin: x, yMin: y, xMax: x, yMax: y }
  }
  for (const contour of contours) {
    add(contour.start)
    for (const segment of contour.segments) {
      // Vadības punkti ietver līkni, tāpēc robežkaste nekad nav mazāka par uzzīmēto.
      if (segment.c1) add(segment.c1)
      if (segment.c2) add(segment.c2)
      add(segment.to)
    }
  }
  return bounds
}

/** Izmērs un slīpums; pēc noapaļošanas atkārtotus blakus punktus atmet. */
function applyStyle(rings: Ring[], style: OutlineStyle): Ring[] {
  const units = styleUnits(style)
  if (units.slant === 0 && units.scale === 1000) return rings
  return rings.map((ring) => {
    const out: Ring = []
    for (const point of transformRing(ring, units)) {
      const last = out[out.length - 1]
      if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point)
    }
    return dropClosingPoint(out)
  })
}

/** Viena glifa varianta kontūra no tā vilcieniem. Tīra funkcija: tie paši vilcieni dod to pašu. */
export function buildOutline(strokes: readonly Stroke[], style: OutlineStyle = { strokeWidth: 1 }): GlyphOutline {
  const fitters = applyStyle(mergeStrokes(strokes, style), style)
    .filter((ring) => ring.length >= 3)
    .map(prepareRing)
  let contours: Contour[] = []
  for (const tolerance of FIT_TOLERANCES) {
    contours = fitContours(fitters, tolerance)
    if (pointCount({ contours, bounds: null }) <= MAX_GLYPH_POINTS) break
  }
  return { contours, bounds: boundsOf(contours) }
}

/** Kontūra kā poligons (līknes sadalītas `steps` posmos); testiem un platības aprēķiniem. */
export function flattenContour(contour: Contour, steps = 8): Ring {
  const ring: Ring = []
  let from: Vec = [contour.start[0], contour.start[1]]
  for (const segment of contour.segments) {
    const to: Vec = [segment.to[0], segment.to[1]]
    if (segment.c1 && segment.c2) {
      const c1: Vec = [segment.c1[0], segment.c1[1]]
      const c2: Vec = [segment.c2[0], segment.c2[1]]
      for (let s = 1; s <= steps; s++) ring.push(cubicAt(from, c1, c2, to, s / steps))
    } else ring.push(to)
    from = to
  }
  return ring
}

/**
 * Kontūra kā SVG ceļš: y apgriezts (SVG y aug uz leju), pamatlīnija paliek y = 0,
 * `dx` pārbīda glifu pa x. Tikai veseli skaitļi un komandas M, L, C, Z.
 */
export function outlineToPath(outline: GlyphOutline, dx = 0): string {
  const xy = ([x, y]: Pt) => `${x + dx} ${0 - y}`
  let d = ''
  for (const contour of outline.contours) {
    d += `M${xy(contour.start)}`
    for (const segment of contour.segments) {
      d += segment.c1 && segment.c2 ? `C${xy(segment.c1)} ${xy(segment.c2)} ${xy(segment.to)}` : `L${xy(segment.to)}`
    }
    d += 'Z'
  }
  return d
}
