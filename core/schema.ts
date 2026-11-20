import { z } from 'zod'
import { MAX_VARIANTS } from './types'
import type { FontProject } from './types'
import type { Session } from './project'

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

export const fontProjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  name: z.string(),
  charset: z.literal('lv'),
  createdAt: z.string(),
  metrics: z.object({
    upm: z.literal(1000),
    ascender: z.number().finite(),
    descender: z.number().finite(),
    xHeight: z.number().finite(),
    capHeight: z.number().finite(),
  }),
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
}) satisfies z.ZodType<Session>

/** Atgriež sesiju vai null, ja dati neatbilst shēmai. */
export function parseSession(data: unknown): Session | null {
  const result = sessionSchema.safeParse(data)
  return result.success ? result.data : null
}
