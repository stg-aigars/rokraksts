import { contrastRatio, MIN_CONTRAST } from './color'
import type { CardFormat } from './types'

// Kartīšu formāti, foni un tintes (PRD 8. sadaļa). Tie ir dati: SVG zīmētājs (core/card.ts) un
// canvas zīmētājs pārlūkā (lib/card-canvas.ts) zīmē vienus un tos pašus. Visas koordinātas ir
// veseli pikseļi kartītē.

export type CardFormatSpec = {
  id: CardFormat
  label: string
  width: number
  height: number
  /** Malas līdz teksta laukumam: sānos, augšā, apakšā. */
  margin: { x: number; top: number; bottom: number }
}

export const CARD_FORMATS: Readonly<Record<CardFormat, CardFormatSpec>> = {
  square: { id: 'square', label: 'Kvadrāts', width: 1080, height: 1080, margin: { x: 96, top: 120, bottom: 120 } },
  portrait: { id: 'portrait', label: 'Portrets', width: 1080, height: 1350, margin: { x: 96, top: 150, bottom: 150 } },
  // Stāstā (Instagram, WhatsApp statuss) augšā un apakšā ir lietotnes pogas un paraksts.
  story: { id: 'story', label: 'Stāsts', width: 1080, height: 1920, margin: { x: 96, top: 280, bottom: 320 } },
}

export const CARD_FORMAT_IDS = Object.keys(CARD_FORMATS) as CardFormat[]

export type Rect = { x: number; y: number; width: number; height: number }

/** Laukums, kurā drīkst atrasties teksts; rotājumi to nekad nepārklāj. */
export function textArea(format: CardFormat): Rect {
  const { width, height, margin } = CARD_FORMATS[format]
  return { x: margin.x, y: margin.top, width: width - 2 * margin.x, height: height - margin.top - margin.bottom }
}

/** Rotājums: taisnstūris vai aplis; necaurredzamība procentos (1..100). */
export type Decoration =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill: string; opacity: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; opacity: number }

export type Ink = { hex: string; label: string }

/** Tintes palete. Redaktors piedāvā tikai tās, kam ar izvēlēto fonu kontrasts ir vismaz 4,5:1. */
export const INKS: readonly Ink[] = [
  { hex: '#1d2433', label: 'Tinte' },
  { hex: '#111111', label: 'Melna' },
  { hex: '#1d3d8f', label: 'Zila' },
  { hex: '#b4402c', label: 'Sarkana' },
  { hex: '#8a1c3a', label: 'Ķiršu' },
  { hex: '#2f5d1e', label: 'Zaļa' },
  { hex: '#5b2a86', label: 'Violeta' },
  { hex: '#7a3b00', label: 'Brūna' },
  { hex: '#ffffff', label: 'Balta' },
  { hex: '#f6e7b0', label: 'Zelta' },
  { hex: '#ffd6dc', label: 'Rozā' },
]

export type CardTemplate = {
  id: string
  label: string
  background: string
  /** Noklusējuma tinte šim fonam. */
  ink: string
  /** Rotājumi konkrētam formātam; tikai malās, ārpus teksta laukuma. */
  decorations: (format: CardFormatSpec) => Decoration[]
}

const circle = (cx: number, cy: number, r: number, fill: string, opacity: number): Decoration => ({
  kind: 'circle',
  cx,
  cy,
  r,
  fill,
  opacity,
})

/** Plāns rāmis 40 px no malas. */
function frame(f: CardFormatSpec, fill: string, opacity: number): Decoration[] {
  const inset = 40
  const t = 6
  const w = f.width - 2 * inset
  const h = f.height - 2 * inset
  return [
    { kind: 'rect', x: inset, y: inset, width: w, height: t, fill, opacity },
    { kind: 'rect', x: inset, y: inset + h - t, width: w, height: t, fill, opacity },
    { kind: 'rect', x: inset, y: inset + t, width: t, height: h - 2 * t, fill, opacity },
    { kind: 'rect', x: inset + w - t, y: inset + t, width: t, height: h - 2 * t, fill, opacity },
  ]
}

/** Punktu josla augšējā un apakšējā malā (sniegs, zvaigznes); izmēri mainās pēc vietas. */
function dots(f: CardFormatSpec, fill: string, opacity: number, sizes: readonly number[]): Decoration[] {
  const result: Decoration[] = []
  const rows = [Math.floor(f.margin.top / 2), f.height - Math.floor(f.margin.bottom / 2)]
  rows.forEach((y, row) => {
    for (let i = 0; i < 9; i++) {
      const r = sizes[(i * 3 + row) % sizes.length]!
      // Katra otrā punkta augstums nedaudz nobīdīts, lai josla nebūtu stingra.
      result.push(circle(60 + i * 120, y + (i % 2 === 0 ? -18 : 18), r, fill, opacity))
    }
  })
  return result
}

export const CARD_TEMPLATES: readonly CardTemplate[] = [
  {
    id: 'papirs',
    label: 'Papīrs',
    background: '#faf6ee',
    ink: '#1d2433',
    decorations: (f) => frame(f, '#b4402c', 35),
  },
  { id: 'balts', label: 'Balts', background: '#ffffff', ink: '#1d2433', decorations: () => [] },
  {
    id: 'egle',
    label: 'Egle',
    background: '#1f3d2b',
    ink: '#f6e7b0',
    decorations: (f) => dots(f, '#ffffff', 45, [6, 10, 14, 8]),
  },
  {
    id: 'nakts',
    label: 'Nakts',
    background: '#1b2a4a',
    ink: '#ffffff',
    decorations: (f) => dots(f, '#f6e7b0', 70, [4, 7, 5, 9]),
  },
  {
    id: 'roze',
    label: 'Roze',
    background: '#fbe4e6',
    ink: '#8a1c3a',
    decorations: (f) => [
      circle(0, 0, 110, '#e8a0ab', 60),
      circle(f.width, f.height, 110, '#e8a0ab', 60),
      circle(f.width, 0, 60, '#e8a0ab', 40),
      circle(0, f.height, 60, '#e8a0ab', 40),
    ],
  },
  {
    id: 'debesis',
    label: 'Debesis',
    background: '#e4f0fa',
    ink: '#1d3d8f',
    decorations: (f) => {
      // Mākoņi apakšmalā: apļi, kuru augša paliek zem teksta laukuma.
      const r = f.margin.bottom - 30
      const cy = f.height + 40
      return [0, 1, 2, 3, 4].map((i) => circle(90 + i * 225, cy + (i % 2) * 30, r + (i % 2) * 20, '#ffffff', 90))
    },
  },
  {
    id: 'ligo',
    label: 'Līgo',
    background: '#eef5e1',
    ink: '#2f5d1e',
    decorations: (f) => [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => circle(60 + i * 120, 34, i % 2 === 0 ? 26 : 18, '#8fbf6a', 55)),
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => circle(60 + i * 120, f.height - 34, i % 2 === 0 ? 18 : 26, '#8fbf6a', 55)),
    ],
  },
  {
    id: 'saule',
    label: 'Saule',
    background: '#fff3cc',
    ink: '#7a3b00',
    decorations: (f) => [circle(f.width, 0, 120, '#f5b830', 70), circle(f.width, 0, 80, '#f08a24', 60), circle(0, f.height, 90, '#f5b830', 45)],
  },
]

export const DEFAULT_TEMPLATE_ID = 'papirs'

export function getTemplate(id: string): CardTemplate | undefined {
  return CARD_TEMPLATES.find((t) => t.id === id)
}

/** Tintes, ko ar šo fonu drīkst lietot (kontrasts vismaz 4,5:1). */
export function allowedInks(template: CardTemplate): Ink[] {
  return INKS.filter((ink) => contrastRatio(ink.hex, template.background) >= MIN_CONTRAST)
}

export function inkAllowed(template: CardTemplate, hex: string): boolean {
  return allowedInks(template).some((ink) => ink.hex === hex)
}

export function templateDecorations(template: CardTemplate, format: CardFormat): Decoration[] {
  return template.decorations(CARD_FORMATS[format])
}
