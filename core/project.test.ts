import { describe, expect, it } from 'vitest'
import { getCharset, lapOrder, requiredChars } from './charsets'
import {
  addStroke,
  addVariant,
  baseChar,
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
  ghostStrokes,
  goBack,
  goNext,
  normalizeSession,
  progress,
  promptChars,
  selectVariant,
  startLap,
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
  it('Tālāk nav atļauts, kamēr burts nav uzrakstīts', () => {
    const s = fresh()
    expect(canGoNext(s)).toBe(false)
    expect(goNext(s)).toBe(s)
    expect(canGoNext(addStroke(s, stroke(100)))).toBe(true)
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
  it('pamatburta piesaiste nāk no rakstzīmju kopas datiem', () => {
    const s = goNext(addStroke(fresh(), stroke(100)))
    expect(s.current).toBe('ā')
    expect(baseChar(s)).toBe('a')
    expect(baseChar(fresh())).toBeUndefined()
  })

  it('pēc noklusējuma izslēgts; ieslēdzot rāda pamatburta vilcienus', () => {
    const s = goNext(addStroke(fresh(), stroke(100)))
    expect(ghostStrokes(s)).toEqual([])
    const on = toggleGhost(s)
    expect(ghostStrokes(on)).toEqual([stroke(100)])
    expect(ghostStrokes(toggleGhost(on))).toEqual([])
  })

  it('paraugs ir tikai fons: glifā nonāk tikai jaunie vilcieni', () => {
    let s = toggleGhost(goNext(addStroke(fresh(), stroke(100))))
    s = addStroke(s, stroke(500))
    expect(s.project.glyphs['ā']).toEqual({ char: 'ā', variants: [{ strokes: [stroke(500)] }] })
    expect(s.project.glyphs['a']).toEqual({ char: 'a', variants: [{ strokes: [stroke(100)] }] })
  })

  it('burtam bez pamatburta un neuzrakstītam pamatburtam parauga nav', () => {
    const on = toggleGhost(addStroke(fresh(), stroke(100)))
    expect(ghostStrokes(on)).toEqual([])
    // ā atvērts, bet a nav uzrakstīts.
    expect(ghostStrokes({ ...toggleGhost(fresh()), current: 'ā' })).toEqual([])
  })

  it('rakstot burta otro variantu, paraugs ir pamatburta atbilstošais variants, ja tāds ir', () => {
    let s = withVariants(100, 200)
    s = addStroke(goNext(s), stroke(500))
    s = toggleGhost(addVariant(s))
    expect(ghostStrokes(s)).toEqual([stroke(200)])
    s = addVariant(addStroke(s, stroke(600)))
    // Trešā a varianta nav: rāda pēdējo esošo.
    expect(ghostStrokes(s)).toEqual([stroke(200)])
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
