import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { yearForPosition } from '../game/logic'
import type { Song } from '../game/types'
import { cx } from './classes'

interface Props {
  timeline: Song[]
  /** The guessed year, shown as a face-down card where it would land. */
  guessYear?: number
  /** Rings the guess card after the reveal. */
  verdict?: 'correct' | 'wrong'
  /** When set, tapping a card guesses its year, and the guess card can be dragged. */
  onSelectYear?: (year: number) => void
}

const CARD_W = 160 // w-40
const OVERLAP = 52
const STEP = CARD_W - OVERLAP
/** Press this long on the guess card to pick it up. */
const HOLD_MS = 250
/** Moving further than this before then means scrolling, not holding. */
const HOLD_SLOP = 10
/** Dragging this close to an edge scrolls the hand, faster nearer the edge. */
const EDGE = 72
const MAX_EDGE_SPEED = 14
/** The held card's tilt at rest, and how far it leans when dragged fast (degrees). */
const REST_TILT = 3
const MAX_LEAN = 22
/** How far the cards on either side of the drop gap move apart. */
const GAP_SPREAD = STEP * 0.35

const VERDICT_RING = {
  none: 'ring-2 ring-white/60',
  correct: 'ring-4 ring-good',
  wrong: 'ring-4 ring-bad',
}

/** Where the guess card sits: on top of a card, or in its own spot. */
interface Placement {
  onCardAt: number
  ownSpotAt: number
}

interface Drag {
  /** Finger position, relative to the hand's top left. */
  x: number
  y: number
  /** Where on the card the finger grabbed it, so the card doesn't jump. */
  grabX: number
  grabY: number
  /** The card the guess would land on, or the gap (cards from this index on move aside). */
  onIndex: number | null
  gapIndex: number | null
  /** Where the guess card was picked up from; it stays there, hidden. */
  from: Placement
}

function placementOf(songs: Song[], guessYear: number | undefined): Placement {
  if (guessYear === undefined) return { onCardAt: -1, ownSpotAt: -1 }
  const onCardAt = songs.map((s) => s.year).lastIndexOf(guessYear)
  return { onCardAt, ownSpotAt: onCardAt >= 0 ? -1 : songs.filter((s) => s.year <= guessYear).length }
}

/**
 * The timeline as a fanned hand of playing cards. The card in the middle
 * stands up straight; the others tilt away the further out they are. Press
 * and hold the guess card to drag it to another spot.
 */
export function TimelineCards({ timeline, guessYear, verdict, onSelectYear }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // How far each card is from the middle of the view, in cards.
  const [middle, setMiddle] = useState(0)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragging = drag !== null
  const hold = useRef<{ timer: number; x: number; y: number; startX: number; startY: number } | null>(null)

  // Card wrappers are never transformed, so their offsets are exact.
  const firstCardLeft = () => (scroller.current?.firstElementChild as HTMLElement | null)?.offsetLeft ?? 0
  const scrollFor = (index: number) =>
    firstCardLeft() + index * STEP - ((scroller.current?.clientWidth ?? 0) - CARD_W) / 2

  const songs = [...timeline].sort((a, b) => a.year - b.year)
  // A guess in the same year as a card lies on top of that card; otherwise
  // it gets its own spot in the hand. While it's dragged, its element stays
  // where it was picked up (hidden, taking no room) so the touch that is
  // dragging it keeps being delivered.
  const { onCardAt, ownSpotAt } = drag ? drag.from : placementOf(songs, guessYear)
  const count = songs.length + (ownSpotAt >= 0 && !dragging ? 1 : 0)
  const focusAt = onCardAt >= 0 ? onCardAt : ownSpotAt >= 0 ? ownSpotAt : Math.floor((count - 1) / 2)

  useEffect(() => {
    if (dragging) return
    scroller.current?.scrollTo({ left: scrollFor(focusAt), behavior: 'smooth' })
    // scrollFor only reads the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAt, count, dragging])

  // The latest props, for the window listeners while dragging.
  const latest = useRef({ guessYear, onSelectYear, years: songs.map((s) => s.year) })
  useEffect(() => {
    latest.current = { guessYear, onSelectYear, years: songs.map((s) => s.year) }
  })

  // When the guess leaves its own spot, the cards after it close the gap;
  // shift the view by half a card so the gap stays under the finger.
  const closeGap = useRef(false)
  useLayoutEffect(() => {
    if (dragging && closeGap.current && scroller.current) scroller.current.scrollLeft -= STEP / 2
    closeGap.current = false
  }, [dragging])

  // Where the finger is while dragging, for the listeners below.
  const finger = useRef({ x: 0, y: 0, grabX: 0 })
  const held = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!dragging) return
    let frameId = 0
    const place = () => {
      const el = scroller.current
      if (!el) return
      const { x, y, grabX } = finger.current
      // Where the middle of the held card is, in cards along the hand.
      const cardMiddle = x - grabX + CARD_W / 2
      const at = (el.scrollLeft + cardMiddle - (firstCardLeft() + CARD_W / 2)) / STEP
      const { years, guessYear: current, onSelectYear: select } = latest.current
      const { year, onIndex } = yearForPosition(years, at)
      if (year !== current) select?.(year)
      const gapIndex = onIndex === null ? Math.min(years.length, Math.max(0, Math.ceil(at))) : null
      setDrag((d) => d && { ...d, x, y, onIndex, gapIndex })
    }
    // The held card leans the way it's being dragged, more when faster.
    let tilt = REST_TILT
    let lean = 0
    let lastMove = { x: finger.current.x, time: performance.now() }
    const move = (e: PointerEvent) => {
      const rect = frame.current?.getBoundingClientRect()
      finger.current.x = e.clientX - (rect?.left ?? 0)
      finger.current.y = e.clientY - (rect?.top ?? 0)
      const now = performance.now()
      const speed = (finger.current.x - lastMove.x) / Math.max(now - lastMove.time, 8) // px per ms
      lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, speed * 45))
      lastMove = { x: finger.current.x, time: now }
      place()
    }
    // Every frame: ease the tilt and scroll the hand while the card is held
    // near an edge.
    const edgeScroll = () => {
      tilt += (REST_TILT + lean - tilt) * 0.3
      lean *= 0.9
      if (held.current) held.current.style.transform = `rotate(${tilt}deg) scale(1.06)`
      const el = scroller.current
      if (el) {
        const { x } = finger.current
        const fromRight = el.clientWidth - x
        const speed =
          x < EDGE ? -MAX_EDGE_SPEED * (1 - x / EDGE) : fromRight < EDGE ? MAX_EDGE_SPEED * (1 - fromRight / EDGE) : 0
        if (speed) {
          el.scrollLeft += speed
          place()
        }
      }
      frameId = requestAnimationFrame(edgeScroll)
    }
    const drop = () => setDrag(null)
    // Once the card is picked up, finger moves drag it instead of scrolling.
    const noScroll = (e: TouchEvent) => e.preventDefault()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    window.addEventListener('touchmove', noScroll, { passive: false })
    frameId = requestAnimationFrame(edgeScroll)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
      window.removeEventListener('touchmove', noScroll)
      cancelAnimationFrame(frameId)
    }
    // firstCardLeft only reads the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
  }
  // Handlers for the guess card: press and hold to pick it up.
  const holdHandlers = onSelectYear
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
          const { clientX: x, clientY: y } = e
          const card = e.currentTarget
          cancelHold()
          hold.current = {
            x,
            y,
            startX: x,
            startY: y,
            timer: window.setTimeout(() => {
              const h = hold.current
              hold.current = null
              if (!h || !frame.current) return
              navigator.vibrate?.(15)
              closeGap.current = ownSpotAt >= 0
              const hand = frame.current.getBoundingClientRect()
              const picked = card.getBoundingClientRect()
              const grab = { grabX: h.x - picked.left, grabY: h.y - picked.top }
              finger.current = { x: h.x - hand.left, y: h.y - hand.top, grabX: grab.grabX }
              setDrag({ ...finger.current, ...grab, onIndex: null, gapIndex: null, from: { onCardAt, ownSpotAt } })
            }, HOLD_MS),
          }
        },
        onPointerMove: (e: React.PointerEvent) => {
          const h = hold.current
          if (!h) return
          h.x = e.clientX
          h.y = e.clientY
          if (Math.hypot(h.x - h.startX, h.y - h.startY) > HOLD_SLOP) cancelHold()
        },
        onPointerUp: cancelHold,
        onPointerCancel: cancelHold,
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      }
    : {}

  const back = guessYear !== undefined && <CardBack year={guessYear} ring={VERDICT_RING[verdict ?? 'none']} />
  const cards: { key: string; content: ReactNode; year?: number; songIndex?: number; collapsed?: boolean }[] = songs.map((s, i) => ({
    key: s.id,
    year: s.year,
    songIndex: i,
    content: (
      <>
        <CardFace song={s} covered={i === onCardAt && !dragging} highlight={drag?.onIndex === i} />
        {i === onCardAt && (
          // Lies on top, shifted so the card underneath still shows.
          <div
            className={cx('absolute inset-0 z-10 translate-x-3 translate-y-12 rotate-[4deg]', dragging && 'invisible')}
            {...holdHandlers}
          >
            {back}
          </div>
        )}
      </>
    ),
  }))
  if (ownSpotAt >= 0) {
    cards.splice(ownSpotAt, 0, {
      key: 'guess',
      collapsed: dragging,
      content: (
        <div className={cx('absolute inset-0', dragging && 'invisible')} {...holdHandlers}>
          {back}
        </div>
      ),
    })
  }
  // Position in the fan, skipping a collapsed guess spot.
  let fanIndex = -1

  return (
    <div ref={frame} className="relative -mx-4 select-none [-webkit-touch-callout:none]">
      <div
        ref={scroller}
        onScroll={(e) => setMiddle((e.currentTarget.scrollLeft - scrollFor(0)) / STEP)}
        className={cx(
          'relative isolate flex overflow-x-auto px-[calc(50%-5rem)] pt-6 pb-14 [scrollbar-width:none]',
          !dragging && 'snap-x snap-mandatory',
        )}
      >
        {cards.map((card) => {
          if (!card.collapsed) fanIndex++
          const i = fanIndex
          const d = i - middle
          const distance = Math.min(Math.abs(d), 3)
          const tappable = onSelectYear && card.year !== undefined
          // While dragging, the cards on either side of the drop gap move apart.
          const spread =
            drag?.gapIndex != null && card.songIndex !== undefined
              ? card.songIndex < drag.gapIndex
                ? -GAP_SPREAD
                : GAP_SPREAD
              : 0
          return (
            // The wrapper sets the snap point; only the inner card tilts, so the
            // snap points don't move while the hand fans out.
            <div
              key={card.key}
              role={tappable ? 'button' : undefined}
              aria-label={tappable ? `Guess ${card.year}` : undefined}
              onClick={tappable ? () => onSelectYear(card.year!) : undefined}
              className={cx('relative h-56 flex-none snap-center', card.collapsed ? 'w-0' : 'w-40', tappable && 'cursor-pointer')}
              style={{
                marginLeft: i === 0 || card.collapsed ? 0 : -OVERLAP,
                zIndex: 100 - Math.round(distance * 10),
              }}
            >
              <div
                className="absolute inset-0 transition-transform duration-150 ease-out"
                style={{
                  transform: `translateX(${spread}px) translateY(${distance * distance * 5}px) rotate(${Math.max(-24, Math.min(24, d * 8))}deg) scale(${1 - distance * 0.05})`,
                  transformOrigin: '50% 120%',
                }}
              >
                {card.content}
              </div>
            </div>
          )
        })}
      </div>

      {drag && guessYear !== undefined && (
        // The picked-up guess card follows the finger.
        <div
          ref={held}
          className="pointer-events-none absolute z-[200] h-56 w-40 drop-shadow-[0_18px_30px_rgb(0_0_0/0.6)]"
          style={{
            transform: `rotate(${REST_TILT}deg) scale(1.06)`,
            // Keep most of the card on screen, however far the finger goes.
            left: Math.min(Math.max(drag.x - drag.grabX, -CARD_W / 3), (frame.current?.clientWidth ?? 0) - (CARD_W * 2) / 3),
            top: drag.y - drag.grabY,
          }}
        >
          <CardBack year={guessYear} ring="ring-2 ring-white" />
        </div>
      )}
    </div>
  )
}

const CARD = 'absolute inset-0 overflow-hidden rounded-2xl border-2 border-line shadow-[0_10px_30px_rgb(0_0_0/0.45)]'

/**
 * `covered`: the guess lies on top, so the year moves up to stay visible.
 * `highlight`: the dragged guess card would land on this card.
 */
function CardFace({ song, covered, highlight }: { song: Song; covered: boolean; highlight: boolean }) {
  return (
    <div className={cx(CARD, 'bg-surface-2', highlight && 'border-accent ring-4 ring-accent/60')}>
      {song.albumArt ? (
        <img src={song.albumArt} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-linear-160 from-surface-2 to-bg" />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-black/10 via-transparent to-black/85" />
      <span
        className={cx(
          'absolute inset-x-0 text-center text-4xl font-black text-white tabular-nums transition-all duration-200 [text-shadow:0_2px_12px_rgb(0_0_0/0.85)]',
          covered ? 'top-1' : 'top-[38%] -translate-y-1/2',
        )}
      >
        {song.year}
      </span>
      <span className="absolute inset-x-2.5 bottom-2.5 flex flex-col">
        <span className="line-clamp-2 text-sm leading-tight font-bold text-white">{song.title}</span>
        <span className="truncate text-xs text-white/70">{song.artists.join(', ')}</span>
      </span>
    </div>
  )
}

/** The mystery song, face down: the card back from the loading screen. */
function CardBack({ year, ring }: { year: number; ring: string }) {
  return (
    <div className={cx(CARD, 'grid place-items-center bg-accent-gradient text-on-accent', ring)}>
      <div className="absolute inset-2.5 rounded-xl border-2 border-dashed border-on-accent/25" />
      <div className="relative flex flex-col items-center">
        <span className="text-3xl">♪</span>
        <span className="text-4xl font-black tabular-nums">{year}</span>
      </div>
    </div>
  )
}
