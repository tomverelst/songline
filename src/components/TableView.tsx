import { useEffect, useRef, type ReactNode } from 'react'
import { MAX_YEAR, MIN_YEAR } from '../game/logic'
import type { Song } from '../game/types'
import { CardBack, CardFace } from './TimelineCards'
import { cx } from './classes'

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
  return (
    <div className="flex h-full flex-col bg-[radial-gradient(ellipse_at_50%_55%,rgb(255_255_255/0.06),transparent_70%)]">
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

      <CardRow timeline={timeline} guessYear={yearGuess} onSelectYear={onSelectYear} />

      {/* The ruler runs the full width so its needle lines up under the guess card. */}
      <footer className="relative pb-3">
        <YearRuler
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
}: {
  timeline: Song[]
  guessYear: number | undefined
  onSelectYear: (year: number) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const songs = [...timeline].sort((a, b) => a.year - b.year)
  const onCardAt = guessYear === undefined ? -1 : songs.map((s) => s.year).lastIndexOf(guessYear)
  const ownSpotAt =
    guessYear === undefined || onCardAt >= 0 ? -1 : songs.filter((s) => s.year <= guessYear).length
  const count = songs.length + (ownSpotAt >= 0 ? 1 : 0)
  const slotOf = (i: number) => (ownSpotAt >= 0 && i >= ownSpotAt ? i + 1 : i)
  const guessSlot = onCardAt >= 0 ? onCardAt : ownSpotAt >= 0 ? ownSpotAt : (count - 1) / 2

  // Keep the guess in the middle of the table.
  useEffect(() => {
    scroller.current?.scrollTo({ left: guessSlot * SLOT, behavior: 'smooth' })
  }, [guessSlot])

  const glide = 'transition-transform duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]'
  return (
    <div
      ref={scroller}
      className="flex min-h-0 flex-1 items-center overflow-x-auto py-5 [scrollbar-width:none]"
      style={{ paddingInline: `calc(50% - ${CARD_W / 2}px)` }}
    >
      <div className="relative flex-none" style={{ width: count * SLOT - GAP, height: CARD_H }}>
        {/* The table edge the cards lie along. */}
        <div className="absolute inset-x-[-50vw] top-1/2 h-px bg-line" />
        {songs.map((song, i) => (
          <button
            key={song.id}
            aria-label={`Guess ${song.year}`}
            className={cx('absolute top-0 left-0', glide)}
            style={{ width: CARD_W, height: CARD_H, transform: `translateX(${slotOf(i) * SLOT}px)` }}
            onClick={() => onSelectYear(song.year)}
          >
            <CardFace song={song} highlight={false} />
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
              <CardBack year={guessYear} ring="ring-2 ring-white/70" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const TICK = 12

/**
 * A ruler of years to swipe along; the year under the needle is the guess.
 * The years of your cards are marked on it.
 */
function YearRuler({
  value,
  startYear,
  marks,
  onChange,
}: {
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

  useEffect(() => {
    const el = ruler.current
    if (!el) return
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
        <div className="flex h-16">
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
