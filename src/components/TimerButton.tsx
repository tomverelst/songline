import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  className?: string
  onClick: () => void
  /** When set, the border fills up over this many milliseconds. */
  timerMs?: number
  children: ReactNode
}

const STROKE = 4

/** A button whose border doubles as a countdown ring. */
export function TimerButton({ className = '', onClick, timerMs, children }: Props) {
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
    ring = (
      <svg className="timer-ring" width={size.w} height={size.h} aria-hidden>
        <rect className="timer-track" x={STROKE / 2} y={STROKE / 2} width={w} height={h} rx={r} />
        <rect
          className="timer-progress"
          x={STROKE / 2}
          y={STROKE / 2}
          width={w}
          height={h}
          rx={r}
          style={
            {
              '--perimeter': perimeter,
              strokeDasharray: perimeter,
              animationDuration: `${timerMs}ms`,
            } as React.CSSProperties
          }
        />
      </svg>
    )
  }

  return (
    <button ref={ref} className={`${className} timer-button`} onClick={onClick}>
      {children}
      {ring}
    </button>
  )
}
