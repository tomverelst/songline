import { useEffect, useRef, type ReactNode } from 'react'
import { MAX_YEAR, MIN_YEAR } from '../game/logic'
import type { Song } from '../game/types'
import { CardBack, CardFace } from './TimelineCards'
import { cx } from './classes'
import { HoldToOpen } from './SongDetails'
import { Coin } from './Coins'
import { Artwork } from './ui'
import { rotateVector, useScreenRotation } from './rotation'

interface Props {
  /** The scores and menu button, shown along the top. */
  scoreboard: ReactNode
  playerName: string
  timeline: Song[]
  /** The guess, if any. */
  yearGuess: number | undefined
  /** Where the ruler starts when nothing is guessed yet. */
  startYear: number
  onSelectYear: (year: number | undefined) => void
  playing: boolean
  onTogglePause: () => void
  onRestart: () => void
  onSkip: () => void
  lockLabel: string
  lockDisabled: boolean
  onLock: () => void
  /** The guess card stays in the middle; swiping the cards changes the year. */
  swipeCards: boolean
}

const CARD_W = 116
const CARD_H = 164
const GAP = 14
const SLOT = CARD_W + GAP

/**
 * The guessing screen for a phone on its side: the cards lie in one straight
 * row across the table, and the year is picked on a ruler you swipe along.
 */
export function TableView(props: Props) {
  const { scoreboard, playerName, timeline, yearGuess, startYear, onSelectYear, playing } = props
  // Moves the ruler along with a swipe on the cards.
  const followRuler = useRef<((year: number) => void) | null>(null)
  return (
    <div className="flex h-full flex-col select-none bg-[radial-gradient(ellipse_at_50%_55%,rgb(255_255_255/0.06),transparent_70%)]">
      <header className="flex items-center gap-3 px-4 pt-3">
        <div
          className={cx(
            'vinyl-grooves grid size-11 flex-none place-items-center rounded-full ring-2 ring-line',
            playing && 'animate-vinyl',
          )}
          aria-hidden
        >
          <div className="size-4 rounded-full bg-accent-gradient" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-xs text-muted">guessing</span>
          <span className="text-accent-gradient truncate text-2xl font-black">{playerName}</span>
        </div>
        <div className="flex gap-1.5">
          <RoundButton label={playing ? 'Pause' : 'Play'} onClick={props.onTogglePause}>
            {playing ? '❚❚' : '▶'}
          </RoundButton>
          <RoundButton label="Restart" onClick={props.onRestart}>
            ↺
          </RoundButton>
          <RoundButton label="Skip" onClick={props.onSkip}>
            ⏭
          </RoundButton>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">{scoreboard}</div>
      </header>

      <CardRow
        timeline={timeline}
        guessYear={yearGuess}
        onSelectYear={onSelectYear}
        swipe={props.swipeCards ? { startYear, onMove: (year) => followRuler.current?.(year) } : undefined}
      />

      {/* The ruler runs the full width so its needle lines up under the guess card. */}
      <footer className="relative pb-3">
        <YearRuler
          followRef={followRuler}
          value={yearGuess}
          startYear={startYear}
          marks={timeline.map((s) => s.year)}
          onChange={onSelectYear}
        />
        <button
          className="absolute top-[calc(50%-0.375rem)] right-4 h-14 -translate-y-1/2 rounded-full bg-accent-gradient px-6 text-lg font-extrabold text-on-accent shadow-[0_8px_24px_rgb(255_77_141/0.35)] disabled:bg-none disabled:bg-surface-2 disabled:text-muted disabled:shadow-none"
          disabled={props.lockDisabled}
          onClick={props.onLock}
        >
          {props.lockLabel}
        </button>
      </footer>
    </div>
  )
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      className="grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-sm active:bg-line"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/**
 * The timeline as cards lying side by side. The guess card stands in its gap,
 * raised a little, or lies across the card of the same year. Every card sits
 * at a computed spot, so they glide when the guess moves.
 */
function CardRow({
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
  }, [guessSlot, swipe])

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

interface Points {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  /** Rewards a bonus coin instead of a card. */
  coin?: boolean
}

/**
 * The reveal for a phone on its side: the song on the left, your row of cards
 * with the guess ringed green or red, and the points to confirm along the
 * bottom.
 */
export function TableReveal({
  scoreboard,
  playerName,
  timeline,
  yearGuess,
  verdict,
  exact,
  song,
  yearSource,
  likeButton,
  points,
  onContinue,
}: {
  scoreboard: ReactNode
  playerName: string
  timeline: Song[]
  yearGuess: number | undefined
  verdict: 'correct' | 'wrong'
  exact: boolean
  song: Song
  /** Where the year comes from, in small print. */
  yearSource: ReactNode
  /** Save the song to Liked Songs or a playlist. */
  likeButton: ReactNode
  points: Points[]
  onContinue: () => void
}) {
  return (
    <div className="flex h-full flex-col select-none bg-[radial-gradient(ellipse_at_50%_55%,rgb(255_255_255/0.06),transparent_70%)]">
      <header className="flex items-center gap-3 px-4 pt-3">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-xs text-muted">{playerName}</span>
          <span
            className={cx(
              'truncate text-2xl font-black',
              exact ? 'text-gold' : verdict === 'correct' ? 'text-good' : 'text-bad',
            )}
          >
            {exact ? 'Spot on!' : verdict === 'correct' ? 'Card won' : 'Wrong spot'}
          </span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">{scoreboard}</div>
      </header>

      <div className="flex min-h-0 flex-1 items-center">
        <section
          className={cx(
            'ml-4 flex w-64 flex-none animate-pop items-center gap-3 rounded-2xl border-2 bg-surface p-3',
            exact
              ? 'border-gold shadow-[0_0_0_1px_var(--color-gold),0_0_28px_rgb(255_204_51/0.35)]'
              : verdict === 'correct'
                ? 'border-good'
                : 'border-bad',
          )}
        >
          <Artwork src={song.albumArt} className="size-20 rounded-lg text-3xl shadow-[0_8px_20px_rgb(0_0_0/0.5)]" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={cx('text-[2.6rem] leading-none font-black tabular-nums', exact && 'text-gold')}>
              {song.year}
            </span>
            <span className="mt-1 line-clamp-2 leading-tight font-bold">{song.title}</span>
            <span className="truncate text-sm text-muted">{song.artists.join(', ')}</span>
            <span className="-ml-1.5 self-start">{likeButton}</span>
            <div className="mt-1 line-clamp-2 text-[0.65rem] leading-tight [&_*]:text-[0.65rem]">{yearSource}</div>
          </div>
        </section>
        <div className="flex min-w-0 flex-1 flex-col">
          <CardRow timeline={timeline} guessYear={yearGuess} verdict={verdict} />
        </div>
      </div>

      <footer className="flex items-center gap-2 px-4 pb-3">
        {points.map((p) => (
          <button
            key={p.label}
            aria-pressed={p.value}
            className={cx(
              'flex h-12 min-w-0 items-center gap-2 rounded-full border px-3 text-sm font-bold',
              p.value ? 'border-good bg-good/15' : 'border-line bg-surface-2 text-muted',
            )}
            onClick={() => p.onChange(!p.value)}
          >
            <span
              className={cx(
                'grid size-6 flex-none place-items-center rounded-full border-2 text-xs font-black',
                p.value ? 'border-good bg-good text-[#04130a]' : 'border-line',
              )}
            >
              {p.value ? '✓' : ''}
            </span>
            <span className="truncate">{p.label}</span>
            {p.coin ? <Coin /> : <span className={p.value ? 'text-good' : ''}>+1</span>}
          </button>
        ))}
        <button
          className="ml-auto h-12 flex-none rounded-full bg-accent-gradient px-6 text-lg font-extrabold text-on-accent shadow-[0_8px_24px_rgb(255_77_141/0.35)]"
          onClick={onContinue}
        >
          Continue
        </button>
      </footer>
    </div>
  )
}

const TICK = 12

/**
 * A ruler of years to swipe along; the year under the needle is the guess.
 * The years of your cards are marked on it.
 */
function YearRuler({
  followRef,
  value,
  startYear,
  marks,
  onChange,
}: {
  /** Gets a function that moves the ruler to a (fractional) year right away. */
  followRef: { current: ((year: number) => void) | null }
  value: number | undefined
  startYear: number
  marks: number[]
  onChange: (year: number) => void
}) {
  const ruler = useRef<HTMLDivElement>(null)
  // Set while the ruler scrolls to a year chosen elsewhere (e.g. a tapped card),
  // so the years it passes on the way aren't taken as the guess.
  const following = useRef(false)
  const first = useRef(true)
  // Set while the ruler moves along with a swipe elsewhere.
  const live = useRef(0)

  useEffect(() => {
    followRef.current = (year) => {
      const el = ruler.current
      if (!el) return
      // Glide freely with the finger; snap to the year once it stops.
      following.current = true
      el.style.scrollSnapType = 'none'
      el.scrollLeft = (year - MIN_YEAR) * TICK
      clearTimeout(live.current)
      live.current = window.setTimeout(() => {
        live.current = 0
        el.style.scrollSnapType = ''
        el.scrollTo({ left: Math.round(year - MIN_YEAR) * TICK, behavior: 'smooth' })
        window.setTimeout(() => {
          if (!live.current) following.current = false
        }, 400)
      }, 150)
    }
    return () => {
      followRef.current = null
      clearTimeout(live.current)
    }
  }, [followRef])

  useEffect(() => {
    const el = ruler.current
    if (!el || live.current) return
    const target = ((value ?? startYear) - MIN_YEAR) * TICK
    if (Math.abs(el.scrollLeft - target) < TICK / 2) return
    following.current = true
    el.scrollTo({ left: target, behavior: first.current ? 'instant' : 'smooth' })
    first.current = false
    const done = window.setTimeout(() => (following.current = false), 700)
    return () => clearTimeout(done)
  }, [value, startYear])

  const years: number[] = []
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) years.push(y)
  const marked = new Set(marks)

  return (
    <div className="relative">
      <div
        ref={ruler}
        className="snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"
        style={{ paddingInline: `calc(50% - ${TICK / 2}px)` }}
        onTouchStart={() => (following.current = false)}
        onPointerDown={() => (following.current = false)}
        onScroll={(e) => {
          if (following.current) return
          const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.round(e.currentTarget.scrollLeft / TICK) + MIN_YEAR))
          if (year !== value) {
            navigator.vibrate?.(4)
            onChange(year)
          }
        }}
      >
        <div className="flex h-16 w-max">
          {years.map((y) => (
            <div key={y} className="relative flex-none snap-center" style={{ width: TICK }}>
              {y % 10 === 0 && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 text-xs font-bold text-muted tabular-nums">
                  {y}
                </span>
              )}
              <span
                className={cx(
                  'absolute bottom-2 left-1/2 w-px -translate-x-1/2 bg-muted',
                  y % 10 === 0 ? 'h-6' : y % 5 === 0 ? 'h-4 opacity-70' : 'h-2.5 opacity-40',
                )}
              />
              {marked.has(y) && (
                <span className="absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-ink" />
              )}
            </div>
          ))}
        </div>
      </div>
      {/* The needle. */}
      <div className="pointer-events-none absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
    </div>
  )
}
