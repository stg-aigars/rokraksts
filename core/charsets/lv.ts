import type { CharGroup, Charset } from './types'

// Latviešu rakstzīmju kopa (PRD 5. sadaļa): 99 rakstzīmes.
// Katrs burts ar zīmi ir patstāvīgs glifs ar savu kodpunktu; nekas netiek salikts automātiski.

const lower = [...'aābcčdeēfgģhiījkķlļmnņoprsštuūvzž']
const lowerExtra = [...'qwxy']
const upper = [...lower, ...lowerExtra].map((c) => c.toLocaleUpperCase('lv'))
const digits = [...'0123456789']
const punctuation = ['.', ',', '!', '?', ':', ';', '-', '–', '(', ')', '„', '“', "'", '&', '♥']

const groups: readonly CharGroup[] = [
  { id: 'lower', label: 'Latviešu alfabēta mazie burti', chars: lower, required: true },
  { id: 'lower-extra', label: 'Papildu mazie burti', chars: lowerExtra, required: false },
  { id: 'upper', label: 'Lielie burti', chars: upper, required: false },
  { id: 'digits', label: 'Cipari', chars: digits, required: false },
  { id: 'punctuation', label: 'Pieturzīmes', chars: punctuation, required: false },
]

const punctuationNames: Record<string, string> = {
  '.': 'punktu',
  ',': 'komatu',
  '!': 'izsaukuma zīmi',
  '?': 'jautājuma zīmi',
  ':': 'kolu',
  ';': 'semikolu',
  '-': 'defisi',
  '–': 'domuzīmi',
  '(': 'atverošo iekavu',
  ')': 'aizverošo iekavu',
  '„': 'atverošās pēdiņas',
  '“': 'aizverošās pēdiņas',
  "'": 'apostrofu',
  '&': 'zīmi &',
  '♥': 'sirsniņu',
}

function prompt(char: string): string {
  const name = punctuationNames[char]
  if (name) return `Raksti ${name}`
  if (digits.includes(char)) return `Raksti ciparu ${char}`
  if (upper.includes(char)) return `Raksti lielo ${char}`
  return `Raksti mazo ${char}`
}

export const lv: Charset = {
  id: 'lv',
  locale: 'lv',
  groups,
  prompt,
  substitutions: {
    '"': '“',
    '”': '“',
    '—': '–',
    '…': '...',
  },
  frequentChars: [...'aisetuā'],
}
