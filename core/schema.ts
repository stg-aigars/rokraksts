import { z } from 'zod'
import { DEFAULT_CARD_SETTINGS } from './card'
import { getTemplate, inkAllowed } from './card-templates'
import { MAX_TEXT_LENGTH } from './project'
import type { Session } from './project'
import { MAX_VARIANTS } from './types'
import type { Card, FontProject } from './types'

// Shēmas datiem, kas nāk no ārpuses (IndexedDB, vēlāk arī importēts JSON).

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  t: z.number().finite().nonnegative(),
  p: z.number().min(0).max(1).optional(),
})

const strokeSchema = z.object({ points: z.array(pointSchema).min(1) })

const glyphVariantSchema = z.object({
  strokes: z.array(strokeSchema).min(1),
  advance: z.number().finite().optional(),
})

const charSchema = z
  .string()
  .refine((c) => [...c].length === 1 && c.normalize('NFC') === c, 'jābūt vienai NFC rakstzīmei')

const glyphSchema = z.object({
  char: charSchema,
  variants: z.array(glyphVariantSchema).min(1).max(MAX_VARIANTS),
})

const metricsSchema = z.object({
  upm: z.literal(1000),
  ascender: z.number().finite(),
  descender: z.number().finite(),
  xHeight: z.number().finite(),
  capHeight: z.number().finite(),
})

export const fontProjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  name: z.string(),
  charset: z.literal('lv'),
  createdAt: z.string(),
  metrics: metricsSchema,
  style: z.object({
    strokeWidth: z.number().finite(),
    spacing: z.number().finite(),
    slant: z.number().finite(),
    scale: z.number().finite(),
  }),
  glyphs: z
    .record(z.string(), glyphSchema)
    .refine(
      (glyphs) => Object.entries(glyphs).every(([key, glyph]) => key === glyph.char),
      'glifa atslēgai jāsakrīt ar tā rakstzīmi',
    ),
}) satisfies z.ZodType<FontProject>

export const sessionSchema = z.object({
  project: fontProjectSchema,
  current: charSchema,
  // Lauki no 3. posma; vecākam ierakstam to nav, un normalizeSession tos saskaņo ar projektu.
  variant: z
    .number()
    .int()
    .min(0)
    .max(MAX_VARIANTS - 1)
    .default(0),
  fresh: z.boolean().default(false),
  lap: z.boolean().default(false),
  ghost: z.boolean().default(true),
  ghostPlain: z.boolean().default(false),
  guideStyle: z.enum(['print', 'cursive']).default('print'),
  // Lauki no 4. posma.
  text: z.string().max(2000).default(''),
  queue: z.array(charSchema).max(99).default([]),
  // Lauki no 5. posma. Bojāti kartītes iestatījumi nesabojā visu sesiju: paliek noklusējumi.
  queueReturn: z.enum(['text', 'card']).catch('text'),
  card: z.lazy(() => cardSettingsSchema).catch(() => ({ ...DEFAULT_CARD_SETTINGS })),
}) satisfies z.ZodType<Session>

/** Atgriež sesiju vai null, ja dati neatbilst shēmai. */
export function parseSession(data: unknown): Session | null {
  const result = sessionSchema.safeParse(data)
  return result.success ? result.data : null
}

// --- kartīte (PRD 10. sadaļa); 6. posmā to pašu shēmu lietos serveris ---

const seedSchema = z
  .number()
  .int()
  .min(0)
  .max(0xffffffff)

const cardSettingsShape = {
  format: z.enum(['square', 'portrait', 'story']),
  templateId: z.string().refine((id) => getTemplate(id) !== undefined, 'nezināms fons'),
  ink: z.string().regex(/^#[0-9a-f]{6}$/),
  align: z.enum(['left', 'center']),
  seed: seedSchema,
}

/** Tinte drīkst būt tikai tāda, kam ar fonu ir pietiekams kontrasts (PRD 8. sadaļa). */
const contrastOk = (value: { templateId: string; ink: string }) => {
  const template = getTemplate(value.templateId)
  return template !== undefined && inkAllowed(template, value.ink)
}

/** Kartītes iestatījumi sesijā; vecam vai bojātam ierakstam paliek noklusējumi. */
export const cardSettingsSchema = z.object(cardSettingsShape).refine(contrastOk, 'tintes kontrasts par mazu')

/** SVG ceļš, kādu dod core/outline.ts: tikai M L C Z, veseli skaitļi un atstarpes. */
const pathSchema = z.string().max(20_000).regex(/^[MLCZ0-9 -]*$/)

export const cardSchema = z
  .object({
    id: z.string().min(1).max(64),
    schemaVersion: z.literal(1),
    text: z
      .string()
      .max(MAX_TEXT_LENGTH)
      .refine((text) => text.normalize('NFC') === text, 'tekstam jābūt NFC'),
    ...cardSettingsShape,
    metrics: metricsSchema,
    outlines: z.record(charSchema, z.array(pathSchema).min(1).max(MAX_VARIANTS)),
    advances: z.record(charSchema, z.array(z.number().int().positive().max(100_000)).min(1).max(MAX_VARIANTS)),
  })
  .refine(contrastOk, 'tintes kontrasts par mazu')
  .refine((card) => {
    const keys = Object.keys(card.outlines)
    return (
      keys.length === Object.keys(card.advances).length &&
      keys.every((key) => card.advances[key]?.length === card.outlines[key]!.length)
    )
  }, 'katram ceļam vajag platumu') satisfies z.ZodType<Card>

/** Atgriež kartīti vai null, ja dati neatbilst shēmai. */
export function parseCard(data: unknown): Card | null {
  const result = cardSchema.safeParse(data)
  return result.success ? result.data : null
}
