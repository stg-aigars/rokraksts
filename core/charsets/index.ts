import type { CharsetId } from '../types'
import { lv } from './lv'
import type { Charset } from './types'

export type { CharGroup, CharGroupId, Charset } from './types'

const charsets: Record<CharsetId, Charset> = { lv }

export function getCharset(id: CharsetId): Charset {
  return charsets[id]
}

/** Visas kopas rakstzīmes uzvedņu secībā. */
export function allChars(charset: Charset): string[] {
  return charset.groups.flatMap((g) => [...g.chars])
}

/** Rakstzīmes, kas jāuzraksta pirms pirmās kartītes. */
export function requiredChars(charset: Charset): string[] {
  return charset.groups.filter((g) => g.required).flatMap((g) => [...g.chars])
}
