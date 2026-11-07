import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ART_H, ART_W, floodFill } from './cardArt'
import { cx } from './classes'
import { Button, Muted } from './ui'

// Paint your own guess card, MS Paint style: pencil, brush, eraser, paint
// bucket and spray can in the classic palette, drawn in chunky pixels. The
// drawing becomes the back of the player's guess card, with the year on it.


type Tool = 'pencil' | 'brush' | 'eraser' | 'fill' | 'spray'

const TOOLS: { id: Tool; icon: string; name: string }[] = [
  { id: 'pencil', icon: '✏️', name: 'Pencil' },
  { id: 'brush', icon: '🖌️', name: 'Brush' },
  { id: 'spray', icon: '💨', name: 'Spray can' },
  { id: 'fill', icon: '🪣', name: 'Fill' },
  { id: 'eraser', icon: '🧽', name: 'Eraser' },
]

/** The classic palette, two rows. */
const PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040',
]

const SIZES = [2, 5, 10]
const MAX_UNDO = 30

/** The painter, right in the player editor; every change goes straight to `onChange`. */
export function CardPainter({
  art,
  onChange,
}: {
  /** The drawing so far, if any. */
  art: string | undefined
  /** The drawing after each stroke, fill, undo or clear; undefined for the plain card. */
  onChange: (art: string | undefined) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(1)
  const [canUndo, setCanUndo] = useState(false)
  const undo = useRef<ImageData[]>([])
  const last = useRef<{ x: number; y: number } | null>(null)
  const spraying = useRef<number | null>(null)

  const ctx = () => canvas.current!.getContext('2d', { willReadFrequently: true })!

  // Start from the drawing so far (as it was when the painter opened), or a white card.
  const startArt = useRef(art)
  useEffect(() => {
    const c = canvas.current!.getContext('2d', { willReadFrequently: true })!
    c.fillStyle = '#ffffff'
    c.fillRect(0, 0, ART_W, ART_H)
    if (!startArt.current) return
    const img = new Image()
    img.onload = () => c.drawImage(img, 0, 0, ART_W, ART_H)
    img.src = startArt.current
  }, [])

  useEffect(() => () => stopSpray(), [])

  function remember() {
    undo.current.push(ctx().getImageData(0, 0, ART_W, ART_H))
    if (undo.current.length > MAX_UNDO) undo.current.shift()
    setCanUndo(true)
  }

  /** Hands the drawing as it is now to the editor. */
  function changed() {
    onChange(canvas.current!.toDataURL('image/png'))
  }

  function pointAt(e: PointerEvent<HTMLCanvasElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.floor(((e.clientX - box.left) / box.width) * ART_W),
      y: Math.floor(((e.clientY - box.top) / box.height) * ART_H),
    }
  }

  /** A round dab of paint, in whole pixels (no soft edges, like the real thing). */
  function dab(x: number, y: number) {
    const c = ctx()
    c.fillStyle = tool === 'eraser' ? '#ffffff' : color
    if (tool === 'pencil') return c.fillRect(x, y, 1, 1)
    const r = SIZES[size] / 2
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)))
      c.fillRect(x - half, y + dy, half * 2 + 1, 1)
    }
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1)
    for (let i = 0; i <= steps; i++) {
      dab(Math.round(from.x + ((to.x - from.x) * i) / steps), Math.round(from.y + ((to.y - from.y) * i) / steps))
    }
  }

  function spray() {
    const at = last.current
    if (!at) return
    const c = ctx()
    c.fillStyle = color
    const r = SIZES[size] * 1.8 + 3
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2
      const d = Math.random() * r
      c.fillRect(Math.round(at.x + Math.cos(angle) * d), Math.round(at.y + Math.sin(angle) * d), 1, 1)
    }
  }

  function stopSpray() {
    if (spraying.current !== null) clearInterval(spraying.current)
    spraying.current = null
  }

  function onDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const at = pointAt(e)
    remember()
    if (tool === 'fill') {
      floodFill(ctx(), at.x, at.y, color)
      return changed()
    }
    last.current = at
    if (tool === 'spray') {
      spray()
      spraying.current = window.setInterval(spray, 30)
    } else dab(at.x, at.y)
  }

  function onMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return
    const at = pointAt(e)
    if (tool !== 'spray') stroke(last.current, at)
    last.current = at
  }

  function onUp() {
    if (last.current) changed()
    last.current = null
    stopSpray()
  }

  return (
    <div className="flex flex-col gap-3">
      <Muted>Paint the back of your guess card. Your guessed year goes on it, at the bottom.</Muted>

      <div className="flex items-start justify-center gap-3">
        {/* The toolbox, down the side like the real thing. */}
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Tool">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tool === t.id}
              aria-label={t.name}
              title={t.name}
              className={cx(
                'grid size-11 place-items-center rounded-lg border text-xl',
                tool === t.id ? 'border-accent bg-accent/20' : 'border-line bg-bg',
              )}
              onClick={() => setTool(t.id)}
            >
              {t.icon}
            </button>
          ))}
          <div className="mt-1 flex flex-col gap-1" role="radiogroup" aria-label="Size">
            {SIZES.map((s, i) => (
              <button
                key={s}
                role="radio"
                aria-checked={size === i}
                aria-label={['Small', 'Medium', 'Large'][i]}
                className={cx(
                  'grid h-8 w-11 place-items-center rounded-lg border',
                  size === i ? 'border-accent bg-accent/20' : 'border-line bg-bg',
                )}
                onClick={() => setSize(i)}
              >
                <span className="rounded-full bg-ink" style={{ width: 3 + i * 4, height: 3 + i * 4 }} />
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-[min(58vw,15rem)] overflow-hidden rounded-xl border-2 border-line">
          <canvas
            ref={canvas}
            width={ART_W}
            height={ART_H}
            aria-label="Your card: draw on it"
            className="block w-full touch-none bg-white [image-rendering:pixelated]"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          {/* Where the year goes. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-[6%] mx-auto w-fit rounded-full bg-black/65 px-3 text-2xl font-black text-white/80 tabular-nums">
            1987
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[2.75rem_1fr] items-center gap-2">
        <span
          className="size-11 rounded-lg border-2 border-ink"
          style={{ background: color }}
          aria-label={`Colour ${color}`}
          role="img"
        />
        <div className="grid grid-cols-14 gap-0.5" role="radiogroup" aria-label="Colour">
          {PALETTE.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              className={cx('aspect-square rounded-sm border', color === c ? 'border-accent ring-2 ring-accent' : 'border-black/40')}
              style={{ background: c }}
              onClick={() => {
                setColor(c)
                if (tool === 'eraser') setTool('brush')
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={!canUndo}
          onClick={() => {
            const previous = undo.current.pop()
            if (previous) ctx().putImageData(previous, 0, 0)
            setCanUndo(undo.current.length > 0)
            changed()
          }}
        >
          ↶ Undo
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            remember()
            const c = ctx()
            c.fillStyle = '#ffffff'
            c.fillRect(0, 0, ART_W, ART_H)
            changed()
          }}
        >
          🗑 Clear
        </Button>
        {art && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              remember()
              const c = ctx()
              c.fillStyle = '#ffffff'
              c.fillRect(0, 0, ART_W, ART_H)
              onChange(undefined)
            }}
          >
            Back to the plain card
          </Button>
        )}
      </div>
    </div>
  )
}
