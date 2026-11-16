import { describe, expect, it } from 'vitest'
import {
  addStroke,
  canGoBack,
  canGoNext,
  clearStrokes,
  createSession,
  currentStrokes,
  goBack,
  goNext,
  normalizeSession,
  progress,
  promptChars,
  undoStroke,
} from './project'
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
