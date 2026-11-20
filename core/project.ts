import { DEFAULT_CARD_SETTINGS, nextSeed } from './card'
import type { CardSettings } from './card'
import { CARD_FORMAT_IDS, getTemplate, inkAllowed } from './card-templates'
import { allChars, getCharset, lapOrder, requiredChars } from './charsets'
import { prepareText } from './layout'
import { defaultMetrics } from './pad'
import { DEFAULT_STYLE, normalizeStyle, sameStyle } from './style'
import { MAX_VARIANTS } from './types'
import type { FontProject, FontStyle, Stroke } from './types'

// Rakstīšanas sesijas stāvoklis: projekts un tas, kurš burts un kurš tā variants šobrīd ir
// atvērts. Visas funkcijas ir tīras un atgriež jaunu objektu. FontProject paliek kā PRD
// 10. sadaļā; viss pārējais (atvērtais variants, aplis, paraugs, lietotāja teksts, trūkstošo
// zīmju rinda) ir tikai sesijas stāvoklis.

export type GuideStyle = 'print' | 'cursive'

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
  /** Vai rādīt blāvo paraugu pārējām zīmēm (burtiem bez zīmes, cipariem, pieturzīmēm); pēc noklusējuma nē. */
  ghostPlain: boolean
  /** Parauga forma: drukātie (noklusējums) vai rakstītie burti (skolas raksts). */
  guideStyle: GuideStyle
  /** Lietotāja teksts priekšskatījumam; tukšs nozīmē rakstzīmju kopas parauga tekstu. Paliek ierīcē. */
  text: string
  /**
   * Trūkstošo zīmju rinda (PRD 4. sadaļas 4. solis): zīmes, kuru rakstīšanu atvēra no teksta.
   * Tukša nozīmē parasto secību. Atvērtā zīme vienmēr ir rindā.
   */
  queue: string[]
  /** Kur atgriezties pēc trūkstošo zīmju rindas: teksta skatā vai kartītes redaktorā. */
  queueReturn: QueueReturn
  /** Kartītes redaktora iestatījumi (5. posms); kartītes teksts ir `text`. */
  card: CardSettings
}

export type QueueReturn = 'text' | 'card'

export function createProject(id: string, createdAt: string): FontProject {
  return {
    id,
    schemaVersion: 1,
    name: 'Mans rokraksts',
    charset: 'lv',
    createdAt,
    metrics: defaultMetrics(),
    style: { ...DEFAULT_STYLE },
    glyphs: {},
  }
}

/** Rakstzīmes uzvedņu secībā (no rakstzīmju kopas datiem). */
export function promptChars(project: FontProject): string[] {
  return allChars(getCharset(project.charset))
}

export function createSession(id: string, createdAt: string): Session {
  const project = createProject(id, createdAt)
  return {
    project,
    current: promptChars(project)[0]!,
    variant: 0,
    fresh: true,
    lap: false,
    ghost: true,
    ghostPlain: false,
    guideStyle: 'print',
    text: '',
    queue: [],
    queueReturn: 'text',
    card: { ...DEFAULT_CARD_SETTINGS },
  }
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
  let next = session
  const style = normalizeStyle(session.project.style)
  if (!sameStyle(style, session.project.style)) next = { ...next, project: { ...next.project, style } }
  const { project } = next
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

  if (next.queue.length > 0) {
    const chars = promptChars(project)
    const queue = [...new Set(next.queue)].filter((c) => chars.includes(c))
    if (!queue.includes(next.current) || next.lap) next = { ...next, queue: [] }
    else if (queue.length !== next.queue.length) next = { ...next, queue }
  }
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
  return openNew({ ...session, lap: true, queue: [] }, nextInLap(session, 0)!)
}

/** Pārtrauc apli; turpina ar pirmo vēl neuzrakstīto rakstzīmi. */
export function endLap(session: Session): Session {
  if (!session.lap) return session
  return openFirst({ ...session, lap: false }, firstUnwritten(session.project))
}

// --- pārvietošanās ---

export function canGoBack(session: Session): boolean {
  const chars = session.queue.length > 0 ? session.queue : session.lap ? lapChars(session) : promptChars(session.project)
  return chars.indexOf(session.current) > 0
}

/**
 * Tālāk drīkst arī tad, ja atvērtais burts nav uzrakstīts: to izlaiž, un tas paliek neuzrakstīts
 * (un nekad netiek aizstāts ar citu). Parastajā secībā pēc pēdējās rakstzīmes Tālāk nav; aplī
 * un trūkstošo zīmju rindā pēc pēdējās Tālāk to pabeidz.
 */
export function canGoNext(session: Session): boolean {
  if (session.lap || session.queue.length > 0) return true
  const chars = promptChars(session.project)
  return chars.indexOf(session.current) < chars.length - 1
}

export function goBack(session: Session): Session {
  if (!canGoBack(session)) return session
  if (session.queue.length > 0) return openFirst(session, session.queue[session.queue.indexOf(session.current) - 1]!)
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
  if (session.queue.length > 0) {
    const target = session.queue[session.queue.indexOf(session.current) + 1]
    return target === undefined ? endQueue(session) : openFirst(session, target)
  }
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

function isMarked(session: Session): boolean {
  return getCharset(session.project.charset).markedChars.includes(session.current)
}

/** Vai atvērtajai zīmei paraugs ir ieslēgts: burtiem ar zīmi un pārējām zīmēm izvēle ir atsevišķa. */
export function ghostOn(session: Session): boolean {
  return isMarked(session) ? session.ghost : session.ghostPlain
}

/** Ieslēdz vai izslēdz paraugu: burtiem ar zīmi vai visām pārējām zīmēm, atkarībā no atvērtās. */
export function toggleGhost(session: Session): Session {
  return isMarked(session) ? { ...session, ghost: !session.ghost } : { ...session, ghostPlain: !session.ghostPlain }
}

/** Vai atvērtajai rakstzīmei rakstzīmju kopā ir paraugs. */
export function hasGuide(session: Session): boolean {
  return getCharset(session.project.charset).guides[session.current] !== undefined
}

/**
 * Paraugs, ko laukumā rādīt blāvi: mūsu shematiska zīme no rakstzīmju kopas datiem. Tas ir tikai
 * fons un nav atkarīgs no lietotāja uzrakstītā; glifā tas nekad nenonāk.
 */
export function guideStrokes(session: Session): readonly (readonly number[])[] {
  if (!ghostOn(session)) return []
  const charset = getCharset(session.project.charset)
  const cursive = session.guideStyle === 'cursive' ? charset.cursiveGuides[session.current] : undefined
  return cursive ?? charset.guides[session.current] ?? []
}

/** Vai atvērtajai zīmei ir rakstītā forma (burtiem jā, cipariem un pieturzīmēm nē). */
export function hasCursiveGuide(session: Session): boolean {
  return getCharset(session.project.charset).cursiveGuides[session.current] !== undefined
}

/** Pārslēdz parauga formu: drukātie ↔ rakstītie. Izvēle attiecas uz visām zīmēm. */
export function toggleGuideStyle(session: Session): Session {
  return { ...session, guideStyle: session.guideStyle === 'cursive' ? 'print' : 'cursive' }
}

// --- jebkuras zīmes atvēršana (glifu režģis, pieskāriens priekšskatījumam) ---

/**
 * Atver rakstzīmes doto variantu pārzīmēšanai; neuzrakstītai rakstzīmei jaunu, tukšu. Pārtrauc
 * apli un trūkstošo zīmju rindu: lietotājs ir izvēlējies, ko rakstīt.
 */
export function openChar(session: Session, char: string, variant = 0): Session {
  if (!promptChars(session.project).includes(char)) return session
  const count = countOf(session.project, char)
  const base = { ...session, lap: false, queue: [] }
  if (count === 0) return openFirst(base, char)
  return { ...base, current: char, variant: Number.isInteger(variant) && variant >= 0 && variant < count ? variant : 0, fresh: false }
}

// --- trūkstošās zīmes (PRD 4. sadaļas 4. solis) ---

export type TextMissing = {
  /** Neuzrakstītās kopas rakstzīmes teksta secībā, bez dublikātiem. */
  writable: string[]
  /** Rakstzīmes, kuru kopā nav (emocijzīmes, @): tās uzrakstīt nevar. */
  unsupported: string[]
}

/**
 * Kuras teksta rakstzīmes vēl nav uzrakstītas. Tekstu sagatavo tāpat kā izkārtotājs (NFC,
 * aizstāšanas), tāpēc saraksts sakrīt ar priekšskatījuma tukšajiem rāmīšiem. Neuzrakstīts "Ā"
 * ir neuzrakstīts arī tad, ja ir "A" vai "ā".
 */
export function textMissing(project: FontProject, text: string): TextMissing {
  const charset = getCharset(project.charset)
  const chars = new Set(allChars(charset))
  const result: TextMissing = { writable: [], unsupported: [] }
  for (const char of new Set(prepareText(text, charset))) {
    if (char === ' ' || char === '\n' || project.glyphs[char]) continue
    ;(chars.has(char) ? result.writable : result.unsupported).push(char)
  }
  return result
}

/** Atver rakstīšanu tieši dotajām zīmēm pēc kārtas (jau uzrakstītās un svešās izlaiž). */
export function startQueue(session: Session, chars: readonly string[], returnTo: QueueReturn = 'text'): Session {
  const known = promptChars(session.project)
  const queue = [...new Set(chars)].filter((c) => known.includes(c) && countOf(session.project, c) === 0)
  if (queue.length === 0) return session
  return openFirst({ ...session, lap: false, queue, queueReturn: returnTo }, queue[0]!)
}

/** Beidz rindu; turpina ar pirmo vēl neuzrakstīto rakstzīmi. */
export function endQueue(session: Session): Session {
  if (session.queue.length === 0) return session
  return openFirst({ ...session, queue: [] }, firstUnwritten(session.project))
}

/** Kura rindas zīme atvērta: { index: 0.., total }; ārpus rindas null. */
export function queuePosition(session: Session): { index: number; total: number } | null {
  if (session.queue.length === 0) return null
  return { index: session.queue.indexOf(session.current), total: session.queue.length }
}

// --- teksts un stils ---

/** Garākais teksts, ko glabājam priekšskatījumam (kartītes teksts ir īss). */
export const MAX_TEXT_LENGTH = 500

export function setText(session: Session, text: string): Session {
  const next = text.slice(0, MAX_TEXT_LENGTH)
  return next === session.text ? session : { ...session, text: next }
}

/** Maina stilu; glifu objekti paliek tie paši (kontūras pārrēķina compileFont). */
export function setStyle(session: Session, patch: Partial<FontStyle>): Session {
  const style = normalizeStyle({ ...session.project.style, ...patch })
  if (sameStyle(style, session.project.style)) return session
  return { ...session, project: { ...session.project, style } }
}

/**
 * Teksts priekšskatījumam rakstīšanas laikā: lietotāja teksts, ja tajā ir atvērtā zīme (piemēram,
 * rakstot trūkstošās zīmes); citādi tās grupas parauga teksts, kurā ir atvērtā zīme. Tā, rakstot
 * lielos burtus, ciparus vai pieturzīmes, tās ir redzamas priekšskatījumā.
 */
export function previewText(session: Session): string {
  const charset = getCharset(session.project.charset)
  if (session.text && [...prepareText(session.text, charset)].includes(session.current)) return session.text
  const group = charset.groups.find((g) => g.chars.includes(session.current))
  return group ? charset.groupSamples[group.id] : charset.sampleText
}

// --- kartīte (PRD 4. sadaļas 8. solis) ---

/**
 * Maina kartītes iestatījumus. Nezināmu formātu, fonu vai līdzinājumu nepieņem, tāpat tinti, kuras
 * kontrasts ar fonu ir zem 4,5:1 (PRD 8. sadaļa). Ja jaunajam fonam pašreizējā tinte neder, tā
 * kļūst par fona noklusējuma tinti.
 */
export function setCard(session: Session, patch: Partial<CardSettings>): Session {
  const next = { ...session.card, ...patch }
  if (!CARD_FORMAT_IDS.includes(next.format)) return session
  if (next.align !== 'left' && next.align !== 'center') return session
  if (!Number.isInteger(next.seed) || next.seed < 0 || next.seed > 0xffffffff) return session
  const template = getTemplate(next.templateId)
  if (!template) return session
  if (!inkAllowed(template, next.ink)) {
    // Tieši izvēlēta nederīga tinte netiek pieņemta; fona maiņa nomaina tinti pati.
    if (patch.ink !== undefined) return session
    next.ink = template.ink
  }
  const same = (Object.keys(next) as (keyof CardSettings)[]).every((key) => next[key] === session.card[key])
  return same ? session : { ...session, card: next }
}

/** "Sajaukt": cita sēkla dod citu variantu izkārtojumu un trici. */
export function shuffleCard(session: Session): Session {
  return { ...session, card: { ...session.card, seed: nextSeed(session.card.seed) } }
}
