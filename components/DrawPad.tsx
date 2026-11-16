'use client'

import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { PAD, PAD_HEIGHT, normalizePressure, strokePath, toFontUnits, toPadY } from '@/core/pad'
import type { Point, Stroke } from '@/core/types'

type Props = {
  /** Jau uzrakstītie vilcieni (fonta vienībās). */
  strokes: Stroke[]
  /** Izsauc, kad vilciens pabeigts. */
  onStroke: (stroke: Stroke) => void
  /** Nosaukums ekrāna lasītājiem. */
  label: string
}

const LINES = [
  { y: PAD.lines.ascender, name: 'ascender', strong: false },
  { y: PAD.lines.xHeight, name: 'x-height', strong: false },
  { y: PAD.lines.baseline, name: 'baseline', strong: true },
  { y: PAD.lines.descender, name: 'descender', strong: false },
] as const

/**
 * Zīmēšanas laukums (PRD 6. sadaļas 1. solis). Punkti uzreiz top fonta vienībās;
 * vilcienus rāda kā vienkāršu līniju, kontūras rēķina 2. posms.
 */
export function DrawPad({ strokes, onStroke, label }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const liveRef = useRef<SVGPathElement>(null)
  const active = useRef<{ pointerId: number; points: Point[] } | null>(null)
  /** Laika atskaites punkts: burta pirmā vilciena sākums. */
  const timeBase = useRef<number | null>(null)

  function collect(event: ReactPointerEvent<SVGSVGElement>) {
    const current = active.current
    const svg = svgRef.current
    if (!current || !svg || event.pointerId !== current.pointerId) return
    const rect = svg.getBoundingClientRect()
    const native = event.nativeEvent
    const coalesced = native.getCoalescedEvents?.() ?? []
    for (const e of coalesced.length > 0 ? coalesced : [native]) {
      const { x, y } = toFontUnits(e.clientX - rect.left, e.clientY - rect.top, rect)
      const last = current.points[current.points.length - 1]
      if (last && last.x === x && last.y === y) continue
      const point: Point = { x, y, t: Math.max(0, Math.round(e.timeStamp - (timeBase.current ?? e.timeStamp))) }
      const p = normalizePressure(e.pressure, e.pointerType)
      if (p !== undefined) point.p = p
      current.points.push(point)
    }
    liveRef.current?.setAttribute('d', strokePath({ points: current.points }))
  }

  function start(event: ReactPointerEvent<SVGSVGElement>) {
    if (active.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (timeBase.current === null || strokes.length === 0) {
      // Pēc pārlādes laiks turpinās no pēdējā saglabātā punkta.
      const lastT = strokes.at(-1)?.points.at(-1)?.t ?? 0
      timeBase.current = event.timeStamp - lastT
    }
    active.current = { pointerId: event.pointerId, points: [] }
    collect(event)
  }

  function finish(event: ReactPointerEvent<SVGSVGElement>) {
    const current = active.current
    if (!current || event.pointerId !== current.pointerId) return
    collect(event)
    active.current = null
    liveRef.current?.setAttribute('d', '')
    if (current.points.length > 0) onStroke({ points: current.points })
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={label}
      data-testid="drawpad"
      data-strokes={strokes.length}
      viewBox={`0 0 ${PAD.width} ${PAD_HEIGHT}`}
      // Izmērs: lielākais taisnstūris ar laukuma proporciju, kas ietilpst apkārtējā konteinerā.
      style={{
        width: `min(100cqw, 100cqh * ${PAD.width} / ${PAD_HEIGHT})`,
        aspectRatio: `${PAD.width} / ${PAD_HEIGHT}`,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      className="cursor-crosshair rounded-2xl bg-white shadow-sm ring-1 ring-ink/10"
      onPointerDown={start}
      onPointerMove={collect}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g className="text-ink" pointerEvents="none">
        {LINES.map((line) => (
          <line
            key={line.name}
            data-line={line.name}
            x1={0}
            x2={PAD.width}
            y1={toPadY(line.y)}
            y2={toPadY(line.y)}
            stroke="currentColor"
            strokeOpacity={line.strong ? 0.45 : 0.2}
            strokeWidth={line.strong ? 5 : 3}
            strokeDasharray={line.strong ? undefined : '14 14'}
          />
        ))}
        {PAD.guides.map((guide) => (
          <circle
            key={guide.x}
            data-guide
            cx={guide.x}
            cy={toPadY(guide.y)}
            r={16}
            fill="currentColor"
            fillOpacity={0.18}
          />
        ))}
        <g fill="none" stroke="currentColor" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round">
          {strokes.map((stroke, i) => (
            <path key={i} data-stroke d={strokePath(stroke)} />
          ))}
          <path ref={liveRef} d="" />
        </g>
      </g>
    </svg>
  )
}
