import { useEffect, useRef, useState } from 'react'
import { MAX_YEAR, MIN_YEAR } from '../game/logic'
import type { Song } from '../game/types'
import { CardBack, CardFace } from './TimelineCards'
import { cx } from './classes'
import { HoldToOpen } from './SongDetails'
import { rotateVector, useScreenRotation } from './rotation'
import { useUiScale } from './scale'

// Sizes at phone scale (16px root); the row scales them with the UI.
const BASE_CARD_W = 116
const BASE_CARD_H = 164
const BASE_GAP = 14
/** Cards never shrink below this share of their size to fit the row. */
const MIN_FIT = 0.55

/** An element's height, kept up to date. */
function useHeight(ref: { current: HTMLElement | null }) {
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return height
}

/**
 * The timeline as cards lying side by side. The guess card stands in its gap,
 * raised a little, or lies across the card of the same year. Every card sits
 * at a computed spot, so they glide when the guess moves.
 */
export function CardRow({
  timeline,
  guessYear,
  onSelectYear,
  verdict,
  swipe,
}: {
  timeline: Song[]
  guessYear: number | undefined
  /** When set, tapping a card guesses its year. */
  onSelectYear?: (year: number) => void
  /** Rings the guess card after the reveal. */
  verdict?: 'correct' | 'wrong'
  /**
   * When set, the guess card stays in the middle and swiping anywhere on the
   * row changes the year (from `startYear` if nothing is guessed yet); the
   * other cards slide past it.
   */
  swipe?: { startYear: number; onMove: (exactYear: number) => void }
}) {
  const scroller = useRef<HTMLDivElement>(null)
  // Cards grow with the UI (bigger on tablets), and shrink when the row has
  // less height than that (a Battle half on a tablet on its side, say).
  const scale = useUiScale()
  const room = useHeight(scroller)
  const padding = 2 * 20 * scale // py-5
  const fit = room ? Math.max(MIN_FIT, Math.min(1, (room - padding) / (BASE_CARD_H * scale))) : 1
  const CARD_W = BASE_CARD_W * scale * fit
  const CARD_H = BASE_CARD_H * scale * fit
  const GAP = BASE_GAP * scale * fit
  const SLOT = CARD_W + GAP
  const swipeHandlers = useYearSwipe(
    guessYear ?? swipe?.startYear ?? 0,
    (year) => onSelectYear?.(year),
    (exactYear) => swipe?.onMove(exactYear),
  )
  const songs = [...timeline].sort((a, b) => a.year - b.year)
  const onCardAt = guessYear === undefined ? -1 : songs.map((s) => s.year).lastIndexOf(guessYear)
  const ownSpotAt =
    guessYear === undefined || onCardAt >= 0 ? -1 : songs.filter((s) => s.year <= guessYear).length
  const count = songs.length + (ownSpotAt >= 0 ? 1 : 0)
  const slotOf = (i: number) => (ownSpotAt >= 0 && i >= ownSpotAt ? i + 1 : i)
  const guessSlot = onCardAt >= 0 ? onCardAt : ownSpotAt >= 0 ? ownSpotAt : (count - 1) / 2

  // Keep the guess in the middle of the table.
  // (A swiped row moves itself instead.)
  useEffect(() => {
    scroller.current?.scrollTo({ left: swipe ? 0 : guessSlot * SLOT, behavior: 'smooth' })
  }, [guessSlot, swipe, SLOT])

  const glide = 'transition-transform duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]'
  return (
    <div
      ref={scroller}
      className={cx(
        'flex min-h-0 flex-1 items-center py-5',
        swipe ? 'cursor-grab touch-none overflow-hidden' : 'overflow-x-auto [scrollbar-width:none]',
      )}
      style={{ paddingInline: `calc(50% - ${CARD_W / 2}px)` }}
      {...(swipe && swipeHandlers)}
    >
      <div
        className={cx('relative flex-none', swipe && glide)}
        style={{
          width: count * SLOT - GAP,
          height: CARD_H,
          // Card text is in em: it shrinks along with the cards.
          fontSize: `${fit}em`,
          // The whole row slides so the guess stays in the middle.
          transform: swipe ? `translateX(${-guessSlot * SLOT}px)` : undefined,
        }}
      >
        {/* The table edge the cards lie along. */}
        <div className="absolute inset-x-[-50vw] top-1/2 h-px bg-line" />
        {songs.map((song, i) => (
          <button
            key={song.id}
            aria-label={onSelectYear ? `Guess ${song.year}` : `${song.title}, ${song.year}`}
            // Not disabled when there's nothing to guess: it can still be held open.
            className={cx('absolute top-0 left-0', !onSelectYear && 'cursor-default', glide)}
            style={{ width: CARD_W, height: CARD_H, transform: `translateX(${slotOf(i) * SLOT}px)` }}
            onClick={() => onSelectYear?.(song.year)}
          >
            <HoldToOpen song={song}>
              <CardFace song={song} highlight={false} />
            </HoldToOpen>
          </button>
        ))}
        {guessYear !== undefined && (
          <div
            className={cx('pointer-events-none absolute top-0 left-0 z-10', glide)}
            style={{
              width: CARD_W,
              height: CARD_H,
              transform:
                onCardAt >= 0
                  ? `translate(${onCardAt * SLOT + 30}px, 16px) rotate(6deg)`
                  : `translate(${ownSpotAt * SLOT}px, -10px)`,
            }}
          >
            <div className="absolute inset-0 drop-shadow-[0_14px_22px_rgb(0_0_0/0.55)]">
              <CardBack
                year={guessYear}
                ring={verdict === 'correct' ? 'ring-4 ring-good' : verdict === 'wrong' ? 'ring-4 ring-bad' : 'ring-2 ring-white/70'}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Swiping this far changes the year by one. */
const SWIPE_PX = 22

/**
 * Pointer handlers that turn a sideways swipe into years: swiping left moves
 * to later years, like pulling the row of cards along. A flick keeps going
 * for a moment. A tap still reaches the card under the finger.
 */
function useYearSwipe(year: number, onChange: (year: number) => void, onMove: (exactYear: number) => void) {
  const angle = useScreenRotation()
  const latest = useRef({ year, onChange, onMove, angle })
  useEffect(() => {
    latest.current = { year, onChange, onMove, angle }
  })
  const gesture = useRef<{ x: number; y: number; base: number; moved: boolean; lastX: number; lastT: number; v: number } | null>(
    null,
  )
  const moved = useRef(false)
  const flick = useRef(0)
  useEffect(() => () => cancelAnimationFrame(flick.current), [])

  // How far the finger moved along the row, whichever way the screen is turned.
  const along = (dx: number, dy: number) => rotateVector({ x: dx, y: dy }, -latest.current.angle).x
  const setYear = (base: number, distance: number) => {
    const exact = Math.min(MAX_YEAR, Math.max(MIN_YEAR, base - distance / SWIPE_PX))
    latest.current.onMove(exact)
    const next = Math.round(exact)
    if (next !== latest.current.year) {
      navigator.vibrate?.(4)
      latest.current.year = next
      latest.current.onChange(next)
    }
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      cancelAnimationFrame(flick.current)
      moved.current = false
      gesture.current = { x: e.clientX, y: e.clientY, base: latest.current.year, moved: false, lastX: 0, lastT: e.timeStamp, v: 0 }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gesture.current
      if (!g) return
      const distance = along(e.clientX - g.x, e.clientY - g.y)
      if (Math.abs(distance) > 6) g.moved = moved.current = true
      if (!g.moved) return
      const dt = e.timeStamp - g.lastT
      if (dt > 0) g.v = 0.7 * ((distance - g.lastX) / dt) + 0.3 * g.v
      g.lastX = distance
      g.lastT = e.timeStamp
      setYear(g.base, distance)
    },
    onPointerUp: () => {
      const g = gesture.current
      gesture.current = null
      if (!g?.moved || Math.abs(g.v) < 0.3) return
      let { v } = g
      let distance = g.lastX
      let last = performance.now()
      const step = (now: number) => {
        distance += v * (now - last)
        v *= Math.pow(0.995, now - last)
        last = now
        setYear(g.base, distance)
        if (Math.abs(v) > 0.05) flick.current = requestAnimationFrame(step)
      }
      flick.current = requestAnimationFrame(step)
    },
    onPointerCancel: () => (gesture.current = null),
    // A swipe that ends on a card isn't a tap on it.
    onClickCapture: (e: React.MouseEvent) => {
      if (moved.current) e.stopPropagation()
    },
  }
}
