import { describe, expect, it } from 'vitest'
import { getCharset, lapOrder, requiredChars } from './charsets'
import {
  addStroke,
  addVariant,
  canAddVariant,
  canDeleteVariant,
  canGoBack,
  canGoNext,
  canStartLap,
  clearStrokes,
  createSession,
  currentStrokes,
  deleteVariant,
  endLap,
  endQueue,
  ghostOn,
  guideStrokes,
  hasCursiveGuide,
  toggleGuideStyle,
  goBack,
  goNext,
  hasGuide,
  normalizeSession,
  openChar,
  previewText,
  progress,
  promptChars,
  selectVariant,
  setStyle,
  setText,
  startLap,
  startQueue,
  textMissing,
  toggleGhost,
  undoStroke,
  variantCount,
} from './project'
import type { Session } from './project'
import { parseSession } from './schema'
import type { Stroke } from './types'

const stroke = (x: number): Stroke => ({
  points: [
    { x, y: 0, t: 0 },
    { x: x + 100, y: 450, t: 16 },
  ],
})

const fresh = () => createSession('p1', '2026-11-16T00:00:00.000Z')

describe('jauna sesija', () => {
  it('sākas ar pirmo kopas burtu un tukšu projektu', () => {
    const s = fresh()
    expect(s.current).toBe('a')
    expect(s.project.glyphs).toEqual({})
    expect(s.project.metrics.upm).toBe(1000)
    expect(progress(s)).toEqual({ done: 0, total: 99 })
  })

  it('uzvednes iet alfabēta secībā: burts ar zīmi uzreiz pēc pamatburta', () => {
    expect(promptChars(fresh().project).slice(0, 5)).toEqual(['a', 'ā', 'b', 'c', 'č'])
  })
})

describe('vilcieni', () => {
  it('pieliek vilcienus atvērtajam burtam, nemainot iepriekšējo stāvokli', () => {
    const s0 = fresh()
    const s1 = addStroke(s0, stroke(100))
    const s2 = addStroke(s1, stroke(300))
    expect(currentStrokes(s0)).toHaveLength(0)
    expect(currentStrokes(s1)).toHaveLength(1)
    expect(currentStrokes(s2)).toEqual([stroke(100), stroke(300)])
    expect(s2.project.glyphs['a']).toEqual({ char: 'a', variants: [{ strokes: [stroke(100), stroke(300)] }] })
  })

  it('tukšu vilcienu ignorē', () => {
    const s = fresh()
    expect(addStroke(s, { points: [] })).toBe(s)
  })

  it('Atsaukt noņem pēdējo vilcienu; pēc pēdējā glifs pazūd', () => {
    const s2 = addStroke(addStroke(fresh(), stroke(100)), stroke(300))
    const s1 = undoStroke(s2)
    expect(currentStrokes(s1)).toEqual([stroke(100)])
    const s0 = undoStroke(s1)
    expect(s0.project.glyphs).toEqual({})
    expect(undoStroke(s0)).toBe(s0)
  })

  it('Notīrīt noņem visus atvērtā burta vilcienus, citus burtus neaiztiek', () => {
    let s = goNext(addStroke(fresh(), stroke(100)))
    s = addStroke(addStroke(s, stroke(100)), stroke(300))
    s = clearStrokes(s)
    expect(Object.keys(s.project.glyphs)).toEqual(['a'])
    expect(clearStrokes(s)).toBe(s)
  })

  it('ā ir atsevišķs glifs, nevis a', () => {
    let s = goNext(addStroke(fresh(), stroke(100)))
    expect(s.current).toBe('ā')
    expect(currentStrokes(s)).toHaveLength(0)
    s = addStroke(s, stroke(500))
    expect(s.project.glyphs['a']!.variants[0]!.strokes).toEqual([stroke(100)])
    expect(s.project.glyphs['ā']!.variants[0]!.strokes).toEqual([stroke(500)])
  })
})

describe('pārvietošanās', () => {
  it('neuzrakstītu burtu var izlaist: Tālāk atver nākamo, un izlaistais paliek neuzrakstīts', () => {
    const s = fresh()
    expect(canGoNext(s)).toBe(true)
    const skipped = goNext(s)
    expect(skipped.current).toBe('ā')
    expect(skipped.project.glyphs).toEqual({})
    expect(progress(skipped)).toEqual({ done: 0, total: 99 })
  })

  it('Atpakaļ nav atļauts pirmajā burtā un atgriež iepriekšējā burta vilcienus', () => {
    const s0 = fresh()
    expect(canGoBack(s0)).toBe(false)
    expect(goBack(s0)).toBe(s0)
    const s1 = goNext(addStroke(s0, stroke(100)))
    expect(canGoBack(s1)).toBe(true)
    expect(currentStrokes(goBack(s1))).toEqual([stroke(100)])
  })

  it('pēdējā rakstzīmē Tālāk nav atļauts; progress sasniedz 99 no 99', () => {
    let s = fresh()
    const chars = promptChars(s.project)
    for (let i = 0; i < chars.length; i++) {
      expect(s.current).toBe(chars[i])
      s = addStroke(s, stroke(100))
      if (i < chars.length - 1) s = goNext(s)
    }
    expect(s.current).toBe('♥')
    expect(canGoNext(s)).toBe(false)
    expect(progress(s)).toEqual({ done: 99, total: 99 })
  })
})

describe('glabāšana', () => {
  it('sesija pēc JSON turp un atpakaļ iziet shēmu nemainīta', () => {
    let s = goNext(addStroke(fresh(), stroke(100)))
    s = addStroke(s, { points: [{ x: 1, y: -2, t: 3, p: 0.4 }] })
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('bojātus datus noraida', () => {
    const s = addStroke(fresh(), stroke(100))
    expect(parseSession(null)).toBeNull()
    expect(parseSession({})).toBeNull()
    expect(parseSession({ ...s, current: 'ab' })).toBeNull()
    expect(parseSession({ ...s, project: { ...s.project, schemaVersion: 2 } })).toBeNull()
    const wrongKey = { ...s.project, glyphs: { b: s.project.glyphs['a'] } }
    expect(parseSession({ ...s, project: wrongKey })).toBeNull()
    const empty = { ...s.project, glyphs: { a: { char: 'a', variants: [] } } }
    expect(parseSession({ ...s, project: empty })).toBeNull()
    const nan = { ...s.project, glyphs: { a: { char: 'a', variants: [{ strokes: [{ points: [{ x: 'x', y: 0, t: 0 }] }] }] } } }
    expect(parseSession({ ...s, project: nan })).toBeNull()
  })

  it('nesalikts (NFD) burts nav derīga glifa rakstzīme', () => {
    const s = fresh()
    expect(parseSession({ ...s, current: 'ā' })).toBeNull()
  })

  it('ja atvērtā rakstzīme nav kopā, turpina ar pirmo neuzrakstīto', () => {
    const s = addStroke(fresh(), stroke(100))
    expect(normalizeSession({ ...s, current: 'ß' }).current).toBe('ā')
    expect(normalizeSession(s)).toBe(s)
  })
})

const lv = getCharset('lv')
const strokesOfVariants = (s: Session, char: string) => s.project.glyphs[char]?.variants.map((v) => v.strokes[0]!.points[0]!.x)

/** Sesija, kurā burtam a ir doti varianti (katrs ar vienu vilcienu, ko atpazīst pēc x). */
function withVariants(...xs: number[]): Session {
  let s = fresh()
  xs.forEach((x, i) => {
    if (i > 0) s = addVariant(s)
    s = addStroke(s, stroke(x))
  })
  return s
}

/** Uzraksta visus 33 mazos burtus; atvērts paliek pēdējais (ž). */
function alphabetDone(): Session {
  let s = fresh()
  const chars = requiredChars(lv)
  chars.forEach((_, i) => {
    s = addStroke(s, stroke(100 + i))
    if (i < chars.length - 1) s = goNext(s)
  })
  return s
}

describe('varianti', () => {
  it('jaunā sesijā atvērts pirmais variants, un tas vēl nav uzrakstīts', () => {
    const s = fresh()
    expect(s.variant).toBe(0)
    expect(s.fresh).toBe(true)
    expect(variantCount(s)).toBe(0)
    expect(canAddVariant(s)).toBe(false)
  })

  it('pievienot: jauns variants ir tukšs un projektā nonāk tikai ar pirmo vilcienu', () => {
    const s1 = addStroke(fresh(), stroke(100))
    expect(s1.fresh).toBe(false)
    expect(canAddVariant(s1)).toBe(true)
    const s2 = addVariant(s1)
    expect(s2.variant).toBe(1)
    expect(currentStrokes(s2)).toEqual([])
    expect(variantCount(s2)).toBe(1)
    expect(s2.project).toBe(s1.project)
    const s3 = addStroke(s2, stroke(200))
    expect(strokesOfVariants(s3, 'a')).toEqual([100, 200])
    expect(currentStrokes(s3)).toEqual([stroke(200)])
  })

  it('katrai rakstzīmei ir ne vairāk kā 3 varianti', () => {
    const s = withVariants(100, 200, 300)
    expect(variantCount(s)).toBe(3)
    expect(canAddVariant(s)).toBe(false)
    expect(addVariant(s)).toBe(s)
  })

  it('kamēr atvērts tukšs jauns variants, vēl vienu pievienot nevar', () => {
    const s = addVariant(addStroke(fresh(), stroke(100)))
    expect(canAddVariant(s)).toBe(false)
  })

  it('izvēlēties: atver esošu variantu ar tā vilcieniem', () => {
    const s = selectVariant(withVariants(100, 200, 300), 1)
    expect(s.variant).toBe(1)
    expect(currentStrokes(s)).toEqual([stroke(200)])
    expect(selectVariant(s, 1)).toBe(s)
    expect(selectVariant(s, 7)).toBe(s)
    expect(selectVariant(s, -1)).toBe(s)
  })

  it('vilcieni nonāk atvērtajā variantā, pārējos neaiztiekot', () => {
    const before = withVariants(100, 200, 300)
    const s = addStroke(selectVariant(before, 1), stroke(250))
    expect(s.project.glyphs['a']!.variants[1]!.strokes).toEqual([stroke(200), stroke(250)])
    // Nemainītie varianti paliek tie paši objekti: kontūru kešs tos nepārrēķina.
    expect(s.project.glyphs['a']!.variants[0]).toBe(before.project.glyphs['a']!.variants[0])
    expect(s.project.glyphs['a']!.variants[2]).toBe(before.project.glyphs['a']!.variants[2])
  })

  it('pārzīmēt: Notīrīt un rakstīt no jauna atstāj variantu tajā pašā vietā', () => {
    let s = selectVariant(withVariants(100, 200, 300), 1)
    s = clearStrokes(s)
    expect(strokesOfVariants(s, 'a')).toEqual([100, 300])
    expect(s.variant).toBe(1)
    expect(currentStrokes(s)).toEqual([])
    s = addStroke(s, stroke(222))
    expect(strokesOfVariants(s, 'a')).toEqual([100, 222, 300])
    expect(currentStrokes(s)).toEqual([stroke(222)])
  })

  it('pārzīmēt pirmo variantu: pa vidu burts joprojām ir uzrakstīts ar atlikušajiem variantiem', () => {
    let s = selectVariant(withVariants(100, 200), 0)
    s = undoStroke(s)
    expect(strokesOfVariants(s, 'a')).toEqual([200])
    expect(canGoNext(s)).toBe(true)
    s = addStroke(s, stroke(111))
    expect(strokesOfVariants(s, 'a')).toEqual([111, 200])
  })

  it('dzēst: izņem atvērto variantu un atver blakus esošo', () => {
    const three = withVariants(100, 200, 300)
    expect(canDeleteVariant(three)).toBe(true)
    const last = deleteVariant(three)
    expect(strokesOfVariants(last, 'a')).toEqual([100, 200])
    expect(last.variant).toBe(1)
    expect(currentStrokes(last)).toEqual([stroke(200)])

    const first = deleteVariant(selectVariant(three, 0))
    expect(strokesOfVariants(first, 'a')).toEqual([200, 300])
    expect(first.variant).toBe(0)
    expect(currentStrokes(first)).toEqual([stroke(200)])
  })

  it('vienīgo variantu dzēst nevar: pirmais ir obligāts (to var tikai pārzīmēt)', () => {
    const s = addStroke(fresh(), stroke(100))
    expect(canDeleteVariant(s)).toBe(false)
    expect(deleteVariant(s)).toBe(s)
  })

  it('dzēst tukšu jaunu variantu nozīmē to vienkārši aizvērt', () => {
    const s = addVariant(addStroke(fresh(), stroke(100)))
    expect(canDeleteVariant(s)).toBe(true)
    const closed = deleteVariant(s)
    expect(closed.variant).toBe(0)
    expect(closed.fresh).toBe(false)
    expect(strokesOfVariants(closed, 'a')).toEqual([100])
  })

  it('pārejot uz citu burtu, atveras tā pirmais variants; tukšais jaunais variants pazūd', () => {
    let s = addStroke(fresh(), stroke(100))
    s = goNext(addVariant(s))
    expect([s.current, s.variant, s.fresh]).toEqual(['ā', 0, true])
    s = goBack(s)
    expect([s.current, s.variant, s.fresh]).toEqual(['a', 0, false])
    expect(variantCount(s)).toBe(1)
  })

  it('Tālāk ir atļauts, ja burtam ir vismaz viens variants, arī ja atvērtais ir tukšs', () => {
    const s = addVariant(addStroke(fresh(), stroke(100)))
    expect(canGoNext(s)).toBe(true)
  })

  it('progress skaita rakstzīmes, nevis variantus', () => {
    expect(progress(withVariants(100, 200, 300))).toEqual({ done: 1, total: 99 })
  })
})

describe('aplis "Uzraksti vēlreiz"', () => {
  it('aplis sākas ar biežākajiem burtiem un tad iet pa pārējiem mazajiem burtiem', () => {
    const order = lapOrder(lv)
    expect(order.slice(0, 7)).toEqual([...'aisetuā'])
    expect(order).toHaveLength(33)
    expect([...order].sort()).toEqual([...requiredChars(lv)].sort())
  })

  it('tiek piedāvāts tikai pēc visu 33 mazo burtu uzrakstīšanas', () => {
    expect(canStartLap(fresh())).toBe(false)
    const almost = goBack(alphabetDone())
    expect(canStartLap(clearStrokes(almost))).toBe(false)
    expect(startLap(fresh()).lap).toBe(false)
    expect(canStartLap(alphabetDone())).toBe(true)
  })

  it('sāk ar a un atver jaunu, tukšu variantu', () => {
    const s = startLap(alphabetDone())
    expect([s.lap, s.current, s.variant, s.fresh]).toEqual([true, 'a', 1, true])
    expect(currentStrokes(s)).toEqual([])
    expect(canStartLap(s)).toBe(false)
  })

  it('Tālāk iet biežuma secībā un katram burtam atver jaunu variantu', () => {
    let s = startLap(alphabetDone())
    const visited: string[] = []
    for (let i = 0; i < 8; i++) {
      visited.push(s.current)
      s = addStroke(s, stroke(900))
      expect(variantCount(s)).toBe(2)
      s = goNext(s)
      expect(s.fresh).toBe(true)
    }
    expect(visited).toEqual([...'aisetuāb'])
  })

  it('burtu aplī var izlaist: Tālāk ir atļauts arī bez vilcieniem', () => {
    const s = startLap(alphabetDone())
    expect(canGoNext(s)).toBe(true)
    const next = goNext(s)
    expect(next.current).toBe('i')
    expect(variantCount({ ...next, current: 'a' })).toBe(1)
  })

  it('Atpakaļ atver iepriekšējā burta pēdējo variantu, lai tikko rakstīto varētu labot', () => {
    let s = startLap(alphabetDone())
    expect(canGoBack(s)).toBe(false)
    s = goNext(addStroke(s, stroke(900)))
    expect(canGoBack(s)).toBe(true)
    s = goBack(s)
    expect([s.current, s.variant, s.fresh]).toEqual(['a', 1, false])
    expect(currentStrokes(s)).toEqual([stroke(900)])
  })

  it('apli var pārtraukt jebkurā brīdī; turpina ar pirmo neuzrakstīto rakstzīmi', () => {
    let s = startLap(alphabetDone())
    s = goNext(addStroke(s, stroke(900)))
    s = endLap(s)
    expect([s.lap, s.current, s.variant, s.fresh]).toEqual([false, 'q', 0, true])
    expect(strokesOfVariants(s, 'a')).toEqual([100, 900])
    expect(endLap(s)).toBe(s)
  })

  it('pēc pēdējā burta aplis beidzas pats', () => {
    let s = startLap(alphabetDone())
    for (let i = 0; i < 33; i++) {
      expect(s.lap).toBe(true)
      s = goNext(addStroke(s, stroke(900)))
    }
    expect([s.lap, s.current]).toEqual([false, 'q'])
    expect(requiredChars(lv).every((c) => s.project.glyphs[c]!.variants.length === 2)).toBe(true)
  })

  it('otrreiz aplis dod trešo variantu; burtus ar 3 variantiem izlaiž; pēc tam apli vairs nepiedāvā', () => {
    let s = startLap(alphabetDone())
    for (let i = 0; i < 33; i++) s = goNext(addStroke(s, stroke(900)))
    // Burtam a trešo variantu pieliek ar roku: aplis sāksies ar i.
    s = { ...s, current: 'a', variant: 0, fresh: false }
    s = addStroke(addVariant(s), stroke(950))
    s = startLap(s)
    expect([s.current, s.variant]).toEqual(['i', 2])
    for (let i = 0; i < 32; i++) s = goNext(addStroke(s, stroke(990)))
    expect(s.lap).toBe(false)
    expect(canStartLap(s)).toBe(false)
  })
})

describe('blāvais paraugs', () => {
  const atMacron = () => goNext(addStroke(fresh(), stroke(100)))

  it('ir mūsu orientieris no rakstzīmju kopas datiem, nevis lietotāja uzrakstītais pamatburts', () => {
    const s = atMacron()
    expect(s.current).toBe('ā')
    expect(hasGuide(s)).toBe(true)
    expect(guideStrokes(s)).toBe(lv.guides['ā'])
    // Paraugs nav atkarīgs no tā, vai un kā uzrakstīts "a".
    const noBase = { ...fresh(), current: 'ā' }
    expect(guideStrokes(noBase)).toBe(lv.guides['ā'])
  })

  it('pēc noklusējuma ieslēgts; to var izslēgt un ieslēgt atpakaļ', () => {
    const s = atMacron()
    expect(s.ghost).toBe(true)
    const off = toggleGhost(s)
    expect(guideStrokes(off)).toEqual([])
    expect(guideStrokes(toggleGhost(off))).toBe(lv.guides['ā'])
  })

  it('burtam bez zīmes paraugs ir, bet pēc noklusējuma izslēgts; ieslēgšana neietekmē burtus ar zīmi', () => {
    const s = fresh()
    expect(hasGuide(s)).toBe(true)
    expect(ghostOn(s)).toBe(false)
    expect(guideStrokes(s)).toEqual([])
    const on = toggleGhost(s)
    expect([on.ghost, on.ghostPlain]).toEqual([true, true])
    expect(guideStrokes(on)).toBe(lv.guides['a'])
    // Izvēle attiecas uz visām zīmēm bez zīmes: arī lielajiem burtiem, cipariem, pieturzīmēm.
    for (const c of ['B', '7', '♥']) expect(guideStrokes(openChar(on, c)), c).toBe(lv.guides[c])
    // Burtiem ar zīmi sava izvēle: izslēdzot "ā" paraugu, "b" paraugs paliek.
    const macronOff = toggleGhost(goNext(addStroke(on, stroke(100))))
    expect(guideStrokes(macronOff)).toEqual([])
    expect(guideStrokes(openChar(macronOff, 'b'))).toBe(lv.guides['b'])
  })

  it('paraugs ir tikai fons: glifā nonāk tikai lietotāja vilcieni', () => {
    const s = addStroke(atMacron(), stroke(500))
    expect(s.project.glyphs['ā']).toEqual({ char: 'ā', variants: [{ strokes: [stroke(500)] }] })
    expect(Object.keys(s.project.glyphs)).toEqual(['a', 'ā'])
    // Kamēr nav vilcienu, burts nav uzrakstīts, lai arī paraugs ir redzams.
    expect(variantCount(atMacron())).toBe(0)
    expect(progress(atMacron())).toEqual({ done: 1, total: 99 })
  })
})

describe('sesijas glabāšana ar variantiem', () => {
  it('sesija ar variantiem, apli un paraugu iziet shēmu nemainīta', () => {
    let s = startLap(alphabetDone())
    s = toggleGhost(goNext(addStroke(s, stroke(900))))
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('2. posma ieraksts bez varianta laukiem ielādējas: atvērts pirmais variants', () => {
    const s = addStroke(fresh(), stroke(100))
    const old = { project: s.project, current: 'a' }
    const loaded = normalizeSession(parseSession(JSON.parse(JSON.stringify(old)))!)
    expect(loaded).toEqual(s)
    expect(loaded.ghost).toBe(true)
    expect(loaded.ghostPlain).toBe(false)
    const unwritten = normalizeSession(parseSession({ project: s.project, current: 'ā' })!)
    expect([unwritten.variant, unwritten.fresh]).toEqual([0, true])
  })

  it('nesaskanīgu varianta stāvokli pēc ielādes salabo', () => {
    const s = addStroke(fresh(), stroke(100))
    expect(normalizeSession({ ...s, variant: 2, fresh: false })).toMatchObject({ variant: 1, fresh: true })
    expect(normalizeSession({ ...s, variant: 2, fresh: true })).toMatchObject({ variant: 1, fresh: true })
    const full = withVariants(100, 200, 300)
    expect(normalizeSession({ ...full, variant: 1, fresh: true })).toMatchObject({ variant: 1, fresh: false })
    expect(normalizeSession({ ...s, lap: true })).toMatchObject({ lap: false })
    expect(parseSession({ ...s, variant: 3 })).toBeNull()
    expect(parseSession({ ...s, variant: 0.5 })).toBeNull()
  })
})

describe('rakstzīmju izlaišana un pārējās zīmes', () => {
  it('pēc 33 mazajiem burtiem secība turpinās ar q w x y, lielajiem burtiem, cipariem, pieturzīmēm', () => {
    const chars = promptChars(fresh().project)
    expect(chars.slice(33, 38)).toEqual(['q', 'w', 'x', 'y', 'A'])
    expect(chars.slice(-3)).toEqual(["'", '&', '♥'])
  })

  it('izlaistie mazie burti netraucē rakstīt tālāk; aplis gaida, kamēr visi 33 uzrakstīti', () => {
    let s = fresh()
    for (let i = 0; i < 33; i++) s = i === 5 ? goNext(s) : goNext(addStroke(s, stroke(100 + i)))
    expect(s.current).toBe('q')
    expect(progress(s)).toEqual({ done: 32, total: 99 })
    expect(canStartLap(s)).toBe(false)
    s = addStroke(openChar(s, requiredChars(lv)[5]!), stroke(900))
    expect(canStartLap(s)).toBe(true)
  })
})

describe('jebkuras zīmes atvēršana (režģis, pieskāriens priekšskatījumam)', () => {
  it('atver uzrakstītas zīmes doto variantu pārzīmēšanai', () => {
    const s = openChar(goNext(goNext(withVariants(100, 200, 300))), 'a', 2)
    expect([s.current, s.variant, s.fresh]).toEqual(['a', 2, false])
    expect(currentStrokes(s)).toEqual([stroke(300)])
  })

  it('neuzrakstītai zīmei atver tukšu pirmo variantu; neesošu variantu nomaina uz pirmo', () => {
    expect(openChar(fresh(), 'Ķ')).toMatchObject({ current: 'Ķ', variant: 0, fresh: true })
    expect(openChar(withVariants(100), 'a', 2)).toMatchObject({ current: 'a', variant: 0, fresh: false })
  })

  it('zīmi ārpus kopas neatver; atverot pārtrauc apli un trūkstošo zīmju rindu', () => {
    const s = fresh()
    expect(openChar(s, '@')).toBe(s)
    const lap = startLap(alphabetDone())
    expect(openChar(lap, 'Z')).toMatchObject({ current: 'Z', lap: false, queue: [] })
    const queued = startQueue(s, ['A', 'B'])
    expect(openChar(queued, 'Z').queue).toEqual([])
  })
})

describe('trūkstošās zīmes (PRD 4. sadaļas 4. solis)', () => {
  it('atrod tekstā neuzrakstītās zīmes teksta secībā bez dublikātiem; atstarpes un rindas neskaita', () => {
    const s = addStroke(fresh(), stroke(100))
    expect(textMissing(s.project, 'Aa ā!\nA ā')).toEqual({ writable: ['A', 'ā', '!'], unsupported: [] })
    expect(textMissing(s.project, 'aaa')).toEqual({ writable: [], unsupported: [] })
  })

  it('ievadi normalizē (NFC, aizstāšanas) tāpat kā izkārtotājs', () => {
    const s = fresh()
    // a + kombinējamā garumzīme ir "ā"; "…" ir trīs punkti; "—" ir "–".
    expect(textMissing(s.project, 'ā… —').writable).toEqual(['ā', '.', '–'])
  })

  it('zīmes ārpus kopas atdala: tās uzrakstīt nevar', () => {
    expect(textMissing(fresh().project, 'a@b€')).toEqual({ writable: ['a', 'b'], unsupported: ['@', '€'] })
  })

  it('neuzrakstīts Ā nav "uzrakstīts" tikai tāpēc, ka ir A vai ā', () => {
    let s = addStroke(openChar(fresh(), 'A'), stroke(100))
    s = addStroke(openChar(s, 'ā'), stroke(200))
    expect(textMissing(s.project, 'ĀAā').writable).toEqual(['Ā'])
    expect(textMissing(s.project, 'a').writable).toEqual(['a'])
  })

  it('rinda atver tieši trūkstošās zīmes pēc kārtas un beigās atgriežas pie pirmās neuzrakstītās', () => {
    let s = startQueue(addStroke(fresh(), stroke(100)), ['P', 'a', '!'])
    // Jau uzrakstīto "a" rinda izlaiž.
    expect(s.queue).toEqual(['P', '!'])
    expect([s.current, s.variant, s.fresh]).toEqual(['P', 0, true])
    expect(canGoBack(s)).toBe(false)
    s = goNext(addStroke(s, stroke(200)))
    expect(s.current).toBe('!')
    expect(canGoBack(s)).toBe(true)
    expect(goBack(s).current).toBe('P')
    s = addStroke(s, stroke(300))
    expect(canGoNext(s)).toBe(true)
    s = goNext(s)
    expect(s.queue).toEqual([])
    expect(s.current).toBe('ā')
    expect(Object.keys(s.project.glyphs)).toEqual(['a', 'P', '!'])
  })

  it('rindā zīmi var izlaist; to var arī pārtraukt', () => {
    let s = startQueue(fresh(), ['P', 'Q'])
    s = goNext(s)
    expect(s.current).toBe('Q')
    s = endQueue(s)
    expect(s.queue).toEqual([])
    expect(s.current).toBe('a')
  })

  it('tukša rinda neko nemaina; rinda pārtrauc apli', () => {
    const s = fresh()
    expect(startQueue(s, [])).toBe(s)
    expect(startQueue(s, ['@'])).toBe(s)
    const lap = startQueue(startLap(alphabetDone()), ['P'])
    expect([lap.lap, lap.current]).toEqual([false, 'P'])
  })
})

describe('teksts un stils sesijā', () => {
  it('lietotāja teksts glabājas sesijā; tas pats teksts nemaina objektu', () => {
    const s = setText(fresh(), 'Sveiks!')
    expect(s.text).toBe('Sveiks!')
    expect(setText(s, 'Sveiks!')).toBe(s)
    expect(fresh().text).toBe('')
  })

  it('stila maiņa ir normalizēta un nemaina glifu objektus', () => {
    const s0 = withVariants(100)
    const s1 = setStyle(s0, { slant: 0.15, spacing: 0.5 })
    expect(s1.project.style).toEqual({ strokeWidth: 1, spacing: 0.16, slant: 0.15, scale: 1 })
    expect(s1.project.glyphs).toBe(s0.project.glyphs)
    expect(setStyle(s1, { slant: 0.15 })).toBe(s1)
  })

  it('sesija ar tekstu, rindu un stilu iziet shēmu; 3. posma ieraksts ielādējas ar noklusējumiem', () => {
    const s = setStyle(setText(startQueue(fresh(), ['Ā', '3']), 'Ā 3'), { strokeWidth: 1.4 })
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s)
    const old: Partial<Session> = fresh()
    delete old.text
    delete old.queue
    expect(parseSession(JSON.parse(JSON.stringify(old)))).toEqual(fresh())
  })

  it('pēc ielādes salabo rindu un stilu, kas nesaskan ar projektu', () => {
    const s = startQueue(fresh(), ['A', 'B'])
    expect(normalizeSession({ ...s, current: 'C' }).queue).toEqual([])
    expect(normalizeSession({ ...s, queue: ['A', '@', 'A', 'B'] }).queue).toEqual(['A', 'B'])
    const wild = { ...s, project: { ...s.project, style: { strokeWidth: 9, spacing: 0, slant: -1, scale: 3 } } }
    expect(normalizeSession(wild).project.style).toEqual({ strokeWidth: 2, spacing: 0.04, slant: -0.2, scale: 1.25 })
  })
})

describe('priekšskatījuma teksts rakstot', () => {
  it('rāda tās grupas paraugu, kuras zīmi raksta: lielos burtus, ciparus, pieturzīmes', () => {
    expect(previewText(fresh())).toBe(lv.sampleText)
    expect(previewText(openChar(fresh(), 'Ķ'))).toBe(lv.groupSamples.upper)
    expect(previewText(openChar(fresh(), '7'))).toBe(lv.groupSamples.digits)
    expect(previewText(openChar(fresh(), '♥'))).toBe(lv.groupSamples.punctuation)
    expect(previewText(openChar(fresh(), 'x'))).toBe(lv.groupSamples['lower-extra'])
  })

  it('lietotāja tekstu rāda, ja tajā ir atvērtā zīme (arī pēc NFC); citādi grupas paraugu', () => {
    const s = setText(fresh(), 'Sveiks, Mārīt!')
    expect(previewText(openChar(s, 'M'))).toBe('Sveiks, Mārīt!')
    expect(previewText(openChar(s, 'ā'))).toBe('Sveiks, Mārīt!')
    expect(previewText(openChar(s, 'Ķ'))).toBe(lv.groupSamples.upper)
    expect(previewText(openChar(setText(fresh(), 'Ā'), 'Ā'))).toBe('Ā')
  })
})

describe('rakstīto burtu paraugs', () => {
  it('pēc noklusējuma paraugs ir drukātais; izvēle "Rakstītie" rāda rakstīto formu', () => {
    const s = fresh()
    expect(s.guideStyle).toBe('print')
    const atMacron = goNext(addStroke(s, stroke(100)))
    expect(guideStrokes(atMacron)).toBe(lv.guides['ā'])
    const cursive = toggleGuideStyle(atMacron)
    expect(cursive.guideStyle).toBe('cursive')
    expect(guideStrokes(cursive)).toBe(lv.cursiveGuides['ā'])
    expect(toggleGuideStyle(cursive).guideStyle).toBe('print')
  })

  it('izvēle attiecas uz visiem burtiem; cipariem un pieturzīmēm rakstītās formas nav, tur paliek drukātā', () => {
    const s = toggleGhost(toggleGuideStyle(fresh()))
    expect(guideStrokes(openChar(s, 'Ģ'))).toBe(lv.cursiveGuides['Ģ'])
    expect(hasCursiveGuide(openChar(s, 'Ģ'))).toBe(true)
    expect(hasCursiveGuide(openChar(s, '7'))).toBe(false)
    expect(guideStrokes(openChar(s, '7'))).toBe(lv.guides['7'])
  })

  it('izslēgts paraugs paliek izslēgts arī ar rakstīto formu', () => {
    expect(guideStrokes(toggleGuideStyle(fresh()))).toEqual([])
  })

  it('izvēle glabājas; vecs ieraksts ielādējas ar drukāto', () => {
    const s = toggleGuideStyle(fresh())
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s)
    const old: Partial<Session> = fresh()
    delete old.guideStyle
    expect(parseSession(JSON.parse(JSON.stringify(old)))!.guideStyle).toBe('print')
  })
})
