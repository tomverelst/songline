import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { drawStitch, KNIT_PRESETS, PATTERN_COLS, PATTERN_ROWS, YARN_COLORS } from '../knitting'
import { cx } from './classes'
import { Button, Muted } from './ui'

// Design your own scarf for the knitting celebration: paint stitches in the
// yarn colours. The grid is drawn with the celebration's own stitches, so
// what you paint is what gets knitted.

/** Stitch width in the designer, in CSS pixels; rows are 0.8 of that apart, as on the scarf. */
const S = 28
const ROW_H = S * 0.8
/** Stitches stick out a little past their row; room for that at the top and bottom. */
const PAD = (S * 1.08 - ROW_H) / 2
const WIDTH = PATTERN_COLS * S
const HEIGHT = PATTERN_ROWS * ROW_H + PAD * 2

const YARN_NAMES = ['Rose', 'Cream', 'Mustard', 'Teal', 'Gold', 'Navy', 'Red', 'Sage']

export function KnitDesigner({
  pattern,
  onChange,
  onPreview,
}: {
  pattern: string
  onChange: (pattern: string) => void
  onPreview: () => void
}) {
  const [yarn, setYarn] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  // The pattern while painting, so a stroke over many stitches builds on itself.
  const painting = useRef<string | null>(null)

  useEffect(() => {
    const el = canvas.current
    const c = el?.getContext('2d')
    if (!el || !c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    el.width = WIDTH * dpr
    el.height = HEIGHT * dpr
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, WIDTH, HEIGHT)
    for (let row = 0; row < PATTERN_ROWS; row++) {
      for (let col = 0; col < PATTERN_COLS; col++) {
        const color = YARN_COLORS[Number(pattern[row * PATTERN_COLS + col])] ?? YARN_COLORS[1]
        drawStitch(c, color, col * S, PAD + row * ROW_H, S)
      }
    }
  }, [pattern])

  function paintAt(e: PointerEvent<HTMLCanvasElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    // The canvas can be shown smaller than it's drawn; work in its own units.
    const x = ((e.clientX - box.left) / box.width) * WIDTH
    const y = ((e.clientY - box.top) / box.height) * HEIGHT - PAD
    const col = Math.floor(x / S)
    const row = Math.floor(y / ROW_H)
    if (col < 0 || col >= PATTERN_COLS || row < 0 || row >= PATTERN_ROWS) return
    const current = painting.current ?? pattern
    const i = row * PATTERN_COLS + col
    if (current[i] === String(yarn)) return
    const next = current.slice(0, i) + yarn + current.slice(i + 1)
    painting.current = next
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="mt-1 font-semibold">Design your scarf</span>
      <Muted>Pick a yarn and tap or drag over the stitches. The pattern repeats down the scarf.</Muted>
      <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Yarn">
        {YARN_COLORS.map((color, i) => (
          <button
            key={color}
            role="radio"
            aria-checked={yarn === i}
            aria-label={YARN_NAMES[i]}
            title={YARN_NAMES[i]}
            className={cx(
              'size-9 rounded-full border-2 transition-transform',
              yarn === i ? 'scale-110 border-ink' : 'border-transparent',
            )}
            // A ball of yarn: lit from the top left.
            style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${color} 70%, white), ${color} 55%, color-mix(in srgb, ${color} 75%, black))` }}
            onClick={() => setYarn(i)}
          />
        ))}
      </div>
      <div className="mx-auto rounded-2xl bg-bg p-3">
        <canvas
          ref={canvas}
          aria-label="Your scarf's pattern: tap stitches to paint them"
          className="block max-w-full touch-none"
          style={{ width: WIDTH, aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            painting.current = pattern
            paintAt(e)
          }}
          onPointerMove={(e) => painting.current !== null && paintAt(e)}
          onPointerUp={() => (painting.current = null)}
          onPointerCancel={() => (painting.current = null)}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {KNIT_PRESETS.map((preset) => (
          <Button key={preset.name} size="sm" variant="ghost" onClick={() => onChange(preset.pattern)}>
            {preset.name}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onChange(String(yarn).repeat(PATTERN_COLS * PATTERN_ROWS))}>
          Fill with {YARN_NAMES[yarn].toLowerCase()}
        </Button>
      </div>
      <Button onClick={onPreview}>🧶 See it knitted</Button>
    </div>
  )
}
