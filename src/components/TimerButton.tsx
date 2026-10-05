import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { buttonClass, cx, type ButtonProps } from './classes'

interface Props extends Pick<ButtonProps, 'variant' | 'block'> {
  onClick: () => void
  /** When set, the border fills up over this many milliseconds. */
  timerMs?: number
  children: ReactNode
}

const STROKE = 4

/** A button whose border doubles as a countdown ring. */
export function TimerButton({ variant, block, onClick, timerMs, children }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  let ring: ReactNode = null
  if (timerMs && size) {
    const w = size.w - STROKE
    const h = size.h - STROKE
    const r = h / 2
    const perimeter = 2 * (w - 2 * r) + 2 * Math.PI * r
    const shape = { x: STROKE / 2, y: STROKE / 2, width: w, height: h, rx: r, strokeWidth: STROKE, fill: 'none' }
    ring = (
      <svg className="pointer-events-none absolute inset-0 overflow-visible" width={size.w} height={size.h} aria-hidden>
        <rect {...shape} className="stroke-on-accent/20" />
        <rect
          {...shape}
          className="animate-timer-fill stroke-white"
          strokeLinecap="round"
          style={
            {
              '--perimeter': perimeter,
              strokeDasharray: perimeter,
              strokeDashoffset: perimeter,
              animationDuration: `${timerMs}ms`,
            } as CSSProperties
          }
        />
      </svg>
    )
  }

  return (
    <button ref={ref} className={cx(buttonClass({ variant, block }), 'relative')} onClick={onClick}>
      {children}
      {ring}
    </button>
  )
}
