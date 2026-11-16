import { allChars, getCharset } from './charsets'
import { defaultMetrics } from './pad'
import type { FontProject, Stroke } from './types'

// Rakstīšanas sesijas stāvoklis: projekts un tas, kurš burts šobrīd ir atvērts.
// Visas funkcijas ir tīras un atgriež jaunu objektu; 1. posmā raksta tikai pirmo variantu.

export type Session = {
  project: FontProject
  /** Rakstzīme, kas šobrīd atvērta zīmēšanai. */
  current: string
}

export function createProject(id: string, createdAt: string): FontProject {
  return {
    id,
    schemaVersion: 1,
    name: 'Mans rokraksts',
    charset: 'lv',
    createdAt,
    metrics: defaultMetrics(),
    style: { strokeWidth: 1, spacing: 0.06, slant: 0, scale: 1 },
    glyphs: {},
  }
}

/** Rakstzīmes uzvedņu secībā (no rakstzīmju kopas datiem). */
export function promptChars(project: FontProject): string[] {
  return allChars(getCharset(project.charset))
}

export function createSession(id: string, createdAt: string): Session {
  const project = createProject(id, createdAt)
  return { project, current: promptChars(project)[0]! }
}

/** Pēc ielādes: ja atvērtā rakstzīme nav kopā, turpina ar pirmo neuzrakstīto. */
export function normalizeSession(session: Session): Session {
  const chars = promptChars(session.project)
  if (chars.includes(session.current)) return session
  const next = chars.find((c) => !session.project.glyphs[c]) ?? chars[chars.length - 1]!
  return { ...session, current: next }
}

export function strokesOf(project: FontProject, char: string): Stroke[] {
  return project.glyphs[char]?.variants[0]?.strokes ?? []
}

export function currentStrokes(session: Session): Stroke[] {
  return strokesOf(session.project, session.current)
}

function withStrokes(session: Session, strokes: Stroke[]): Session {
  const char = session.current
  const glyphs = { ...session.project.glyphs }
  const existing = glyphs[char]
  if (strokes.length === 0) {
    // Glifam vienmēr ir vismaz viens variants ar vilcieniem; tukšu glifu neglabā.
    const rest = existing?.variants.slice(1) ?? []
    if (rest.length > 0) glyphs[char] = { char, variants: rest }
    else delete glyphs[char]
  } else {
    const first = { ...existing?.variants[0], strokes }
    glyphs[char] = { char, variants: [first, ...(existing?.variants.slice(1) ?? [])] }
  }
  return { ...session, project: { ...session.project, glyphs } }
}

export function addStroke(session: Session, stroke: Stroke): Session {
  if (stroke.points.length === 0) return session
  return withStrokes(session, [...currentStrokes(session), stroke])
}

/** Atsaukt: noņem pēdējo vilcienu. */
export function undoStroke(session: Session): Session {
  const strokes = currentStrokes(session)
  if (strokes.length === 0) return session
  return withStrokes(session, strokes.slice(0, -1))
}

/** Notīrīt: noņem visus atvērtā burta vilcienus. */
export function clearStrokes(session: Session): Session {
  if (currentStrokes(session).length === 0) return session
  return withStrokes(session, [])
}

function step(session: Session, delta: number): Session {
  const chars = promptChars(session.project)
  const target = chars[chars.indexOf(session.current) + delta]
  return target === undefined ? session : { ...session, current: target }
}

export function canGoBack(session: Session): boolean {
  return promptChars(session.project).indexOf(session.current) > 0
}

/** Tālāk drīkst tikai tad, kad atvērtais burts ir uzrakstīts un nav pēdējais. */
export function canGoNext(session: Session): boolean {
  const chars = promptChars(session.project)
  return currentStrokes(session).length > 0 && chars.indexOf(session.current) < chars.length - 1
}

export function goBack(session: Session): Session {
  return canGoBack(session) ? step(session, -1) : session
}

export function goNext(session: Session): Session {
  return canGoNext(session) ? step(session, 1) : session
}

/** Cik rakstzīmju no kopas ir uzrakstītas ("58 no 99"). */
export function progress(session: Session): { done: number; total: number } {
  const chars = promptChars(session.project)
  return { done: chars.filter((c) => session.project.glyphs[c]).length, total: chars.length }
}
