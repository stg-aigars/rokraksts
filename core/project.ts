import { allChars, getCharset, lapOrder, requiredChars } from './charsets'
import { defaultMetrics } from './pad'
import { MAX_VARIANTS } from './types'
import type { FontProject, Stroke } from './types'

// Rakstīšanas sesijas stāvoklis: projekts un tas, kurš burts un kurš tā variants šobrīd ir
// atvērts. Visas funkcijas ir tīras un atgriež jaunu objektu. FontProject paliek kā PRD
// 10. sadaļā; viss pārējais (atvērtais variants, aplis, paraugs) ir tikai sesijas stāvoklis.

export type Session = {
  project: FontProject
  /** Rakstzīme, kas šobrīd atvērta zīmēšanai. */
  current: string
  /** Atvērtā varianta indekss, 0..2. */
  variant: number
  /**
   * true: atvērtā varianta projektā vēl nav (jauns vai notīrīts pārzīmēšanai). Pirmais
   * vilciens to ieliek vietā `variant`; ja lietotājs aiziet prom, nekas nepaliek.
   */
  fresh: boolean
  /** Vai notiek aplis "Uzraksti vēlreiz" (PRD 7. sadaļa). */
  lap: boolean
  /** Vai laukumā rādīt blāvo paraugu burtiem ar zīmēm (PRD 5. sadaļa); pēc noklusējuma jā. */
  ghost: boolean
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
  return { project, current: promptChars(project)[0]!, variant: 0, fresh: true, lap: false, ghost: true }
}

function countOf(project: FontProject, char: string): number {
  return project.glyphs[char]?.variants.length ?? 0
}

/** Cik variantu ir uzrakstīts atvērtajai rakstzīmei. */
export function variantCount(session: Session): number {
  return countOf(session.project, session.current)
}

/** Atver rakstzīmes pirmo variantu (parastā burtu secība). */
function openFirst(session: Session, char: string): Session {
  return { ...session, current: char, variant: 0, fresh: countOf(session.project, char) === 0 }
}

/** Atver jaunu, tukšu variantu rakstzīmes variantu saraksta galā. */
function openNew(session: Session, char: string): Session {
  return { ...session, current: char, variant: countOf(session.project, char), fresh: true }
}

function firstUnwritten(project: FontProject): string {
  const chars = promptChars(project)
  return chars.find((c) => !project.glyphs[c]) ?? chars[chars.length - 1]!
}

function requiredDone(project: FontProject): boolean {
  return requiredChars(getCharset(project.charset)).every((c) => project.glyphs[c])
}

/** Pēc ielādes: salabo stāvokli, kas nesaskan ar projektu (cita kopa, vecāks ieraksts). */
export function normalizeSession(session: Session): Session {
  const { project } = session
  let next = session
  if (!promptChars(project).includes(next.current)) next = openFirst(next, firstUnwritten(project))

  const count = countOf(project, next.current)
  let { variant, fresh } = next
  if (fresh) {
    if (count >= MAX_VARIANTS) {
      variant = Math.min(variant, MAX_VARIANTS - 1)
      fresh = false
    } else variant = Math.min(variant, count)
  } else if (variant >= count) {
    fresh = count < MAX_VARIANTS
    variant = fresh ? count : 0
  }
  if (variant !== next.variant || fresh !== next.fresh) next = { ...next, variant, fresh }

  const lapValid = requiredDone(project) && lapOrder(getCharset(project.charset)).includes(next.current)
  if (next.lap && !lapValid) next = { ...next, lap: false }
  return next
}

export function strokesOf(project: FontProject, char: string, variant = 0): Stroke[] {
  return project.glyphs[char]?.variants[variant]?.strokes ?? []
}

/** Atvērtā varianta vilcieni; jaunam vai notīrītam variantam to nav. */
export function currentStrokes(session: Session): Stroke[] {
  return session.fresh ? [] : strokesOf(session.project, session.current, session.variant)
}

function withStrokes(session: Session, strokes: Stroke[]): Session {
  const char = session.current
  const variants = [...(session.project.glyphs[char]?.variants ?? [])]
  let fresh = session.fresh
  if (strokes.length === 0) {
    // Variantam vienmēr ir vilcieni; tukšu neglabā. Vieta paliek atvērta pārzīmēšanai.
    if (fresh) return session
    variants.splice(session.variant, 1)
    fresh = true
  } else if (fresh) {
    variants.splice(session.variant, 0, { strokes })
    fresh = false
  } else {
    variants[session.variant] = { ...variants[session.variant], strokes }
  }
  const glyphs = { ...session.project.glyphs }
  if (variants.length > 0) glyphs[char] = { char, variants }
  else delete glyphs[char]
  return { ...session, fresh, project: { ...session.project, glyphs } }
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

/** Notīrīt: noņem visus atvērtā varianta vilcienus; pēc tam to var uzrakstīt no jauna. */
export function clearStrokes(session: Session): Session {
  if (currentStrokes(session).length === 0) return session
  return withStrokes(session, [])
}

// --- varianti (PRD 7. sadaļa): līdz 3 katrai rakstzīmei; pievienot, pārzīmēt, dzēst ---

/** Jaunu variantu var pievienot, ja burts ir uzrakstīts, vēl nav 3 variantu un nav atvērts tukšs. */
export function canAddVariant(session: Session): boolean {
  const count = variantCount(session)
  return count > 0 && count < MAX_VARIANTS && !session.fresh
}

export function addVariant(session: Session): Session {
  return canAddVariant(session) ? openNew(session, session.current) : session
}

/** Atver esošu variantu (pārzīmēšanai: Notīrīt un rakstīt no jauna). */
export function selectVariant(session: Session, index: number): Session {
  if (!Number.isInteger(index) || index < 0 || index >= variantCount(session)) return session
  if (index === session.variant && !session.fresh) return session
  return { ...session, variant: index, fresh: false }
}

/** Dzēst var, kamēr burtam paliek vismaz viens variants: pirmais ir obligāts. */
export function canDeleteVariant(session: Session): boolean {
  const count = variantCount(session)
  return session.fresh ? count > 0 : count > 1
}

/** Izņem atvērto variantu (tukšu jaunu vienkārši aizver) un atver blakus esošo. */
export function deleteVariant(session: Session): Session {
  if (!canDeleteVariant(session)) return session
  const cleared = session.fresh ? session : withStrokes(session, [])
  return { ...cleared, variant: Math.min(session.variant, variantCount(cleared) - 1), fresh: false }
}

// --- aplis "Uzraksti vēlreiz" ---

function lapChars(session: Session): string[] {
  return lapOrder(getCharset(session.project.charset))
}

function nextInLap(session: Session, from: number): string | undefined {
  return lapChars(session)
    .slice(from)
    .find((c) => countOf(session.project, c) < MAX_VARIANTS)
}

/** Apli piedāvā, kad uzrakstīti visi obligātie burti un kādam vēl nav 3 variantu. */
export function canStartLap(session: Session): boolean {
  return !session.lap && requiredDone(session.project) && nextInLap(session, 0) !== undefined
}

export function startLap(session: Session): Session {
  if (!canStartLap(session)) return session
  return openNew({ ...session, lap: true }, nextInLap(session, 0)!)
}

/** Pārtrauc apli; turpina ar pirmo vēl neuzrakstīto rakstzīmi. */
export function endLap(session: Session): Session {
  if (!session.lap) return session
  return openFirst({ ...session, lap: false }, firstUnwritten(session.project))
}

// --- pārvietošanās ---

export function canGoBack(session: Session): boolean {
  const chars = session.lap ? lapChars(session) : promptChars(session.project)
  return chars.indexOf(session.current) > 0
}

/**
 * Parastajā secībā Tālāk drīkst tikai tad, kad atvērtais burts ir uzrakstīts un nav pēdējais.
 * Aplī burtu drīkst izlaist, un pēc pēdējā Tālāk apli pabeidz.
 */
export function canGoNext(session: Session): boolean {
  if (session.lap) return true
  const chars = promptChars(session.project)
  return variantCount(session) > 0 && chars.indexOf(session.current) < chars.length - 1
}

export function goBack(session: Session): Session {
  if (!canGoBack(session)) return session
  if (!session.lap) {
    const chars = promptChars(session.project)
    return openFirst(session, chars[chars.indexOf(session.current) - 1]!)
  }
  // Aplī atver iepriekšējā burta pēdējo variantu: to, ko lietotājs, visticamāk, tikko rakstīja.
  const chars = lapChars(session)
  const target = chars[chars.indexOf(session.current) - 1]!
  return { ...session, current: target, variant: countOf(session.project, target) - 1, fresh: false }
}

export function goNext(session: Session): Session {
  if (!canGoNext(session)) return session
  if (!session.lap) {
    const chars = promptChars(session.project)
    return openFirst(session, chars[chars.indexOf(session.current) + 1]!)
  }
  const target = nextInLap(session, lapChars(session).indexOf(session.current) + 1)
  return target === undefined ? endLap(session) : openNew(session, target)
}

/** Cik rakstzīmju no kopas ir uzrakstītas ("58 no 99"). */
export function progress(session: Session): { done: number; total: number } {
  const chars = promptChars(session.project)
  return { done: chars.filter((c) => session.project.glyphs[c]).length, total: chars.length }
}

// --- blāvais paraugs (PRD 5. sadaļa) ---

export function toggleGhost(session: Session): Session {
  return { ...session, ghost: !session.ghost }
}

/** Vai atvērtajai rakstzīmei rakstzīmju kopā ir paraugs (burti ar zīmēm). */
export function hasGuide(session: Session): boolean {
  return getCharset(session.project.charset).guides[session.current] !== undefined
}

/**
 * Paraugs, ko laukumā rādīt blāvi: mūsu shematisks burts ar zīmi no rakstzīmju kopas datiem.
 * Tas ir tikai fons un nav atkarīgs no lietotāja uzrakstītā; glifā tas nekad nenonāk.
 */
export function guideStrokes(session: Session): readonly (readonly number[])[] {
  if (!session.ghost) return []
  return getCharset(session.project.charset).guides[session.current] ?? []
}
