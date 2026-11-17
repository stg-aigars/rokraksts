import type { CharsetId } from '../types'

export type CharGroupId = 'lower' | 'lower-extra' | 'upper' | 'digits' | 'punctuation'

export type CharGroup = {
  id: CharGroupId
  /** Grupas nosaukums saskarnē. */
  label: string
  /** Rakstzīmes uzvedņu secībā; katra ir viens NFC kodpunkts. */
  chars: readonly string[]
  /** true: jāuzraksta pirms pirmās kartītes; false: kad parādās tekstā. */
  required: boolean
}

export type Charset = {
  id: CharsetId
  /** BCP 47 valodas birka. */
  locale: string
  groups: readonly CharGroup[]
  /** Uzvednes teksts, piemēram, "Raksti mazo ā". */
  prompt: (char: string) => string
  /** Ievades rakstzīmes, ko attēlo ar citu glifu (pēc NFC normalizācijas). */
  substitutions: Readonly<Record<string, string>>
  /** Parauga teksts priekšskatījumam; tikai rakstzīmes, kas jāuzraksta pirms pirmās kartītes. */
  sampleText: string
  /**
   * Parauga teksts katrai grupai: priekšskatījums rāda tās grupas paraugu, kuras zīmi šobrīd raksta,
   * lai, rakstot lielos burtus, ciparus vai pieturzīmes, tās būtu redzamas. Katrs satur visas savas
   * grupas zīmes; pārējās zīmes tajā ir tikai no obligātās grupas.
   */
  groupSamples: Readonly<Record<CharGroupId, string>>
  /** Biežākie burti dilstošā secībā; ar tiem sākas variantu aplis. */
  frequentChars: readonly string[]
  /**
   * Blāvie paraugi zīmēšanas laukumam: rakstzīme -> shematisks burts kopā ar zīmi kā lauztas
   * līnijas [x0, y0, x1, y1, ...] fonta vienībās. Tas ir orientieris no mūsu puses (kur likt
   * garumzīmi, jumtiņu vai komatu), nevis lietotāja rokraksts; glifā tas nekad nenonāk.
   */
  guides: Readonly<Record<string, readonly (readonly number[])[]>>
}
