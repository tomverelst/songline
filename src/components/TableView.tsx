import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MAX_YEAR, MIN_YEAR } from '../game/logic'
import type { Song } from '../game/types'
import { cx } from './classes'
import { CardRow } from './CardRow'
import { teamVars, type TeamColor } from '../game/teams'
import { useCardsOnly, useUiScale } from './scale'
import { PointChip } from './GameParts'
import { useYearEditor } from './YearEdit'
import { Artwork } from './ui'

interface Props {
  /** The scores and menu button, shown along the top. */
  scoreboard: ReactNode
  playerName: string
  playerColor: TeamColor
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
  /** The time left to guess, with a time limit. */
  clock?: ReactNode
  lockLabel: string
  lockDisabled: boolean
  onLock: () => void
  /** The guess card stays in the middle; swiping the cards changes the year. */
  swipeCards: boolean
}


/**
 * The guessing screen for a phone on its side: the cards lie in one straight
 * row across the table, and the year is picked on a ruler you swipe along.
 */
export function TableView(props: Props) {
  const { scoreboard, playerName, timeline, yearGuess, startYear, onSelectYear, playing } = props
  const cardsOnly = useCardsOnly()
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
          <span className="truncate text-2xl font-black text-(--team)" style={teamVars(props.playerColor)}>
            {playerName}
          </span>
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
        {props.clock}
        <div className="ml-auto flex min-w-0 items-center gap-2">{scoreboard}</div>
      </header>

      <CardRow
        timeline={timeline}
        guessYear={yearGuess}
        onSelectYear={onSelectYear}
        // Tablets have no ruler: the cards always slide under the guess card.
        swipe={props.swipeCards || cardsOnly ? { startYear, onMove: (year) => followRuler.current?.(year) } : undefined}
      />

      {/* The ruler runs the full width so its needle lines up under the guess card. */}
      <footer className="relative pb-3 tablet:hidden">
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
      {/* Tablets: no ruler, just Lock in at the bottom right. */}
      <footer className="hidden justify-end px-4 pb-4 tablet:flex">
        <button
          className="h-14 rounded-full bg-accent-gradient px-8 text-lg font-extrabold text-on-accent shadow-[0_8px_24px_rgb(255_77_141/0.35)] disabled:bg-none disabled:bg-surface-2 disabled:text-muted disabled:shadow-none"
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
  playerColor,
  timeline,
  yearGuess,
  verdict,
  exact,
  song,
  yearSource,
  onEditYear,
  likeButton,
  points,
  onContinue,
}: {
  scoreboard: ReactNode
  playerName: string
  playerColor: TeamColor
  timeline: Song[]
  yearGuess: number | undefined
  verdict: 'correct' | 'wrong'
  exact: boolean
  song: Song
  /** Where the year comes from, in small print. */
  yearSource: ReactNode
  /** Overwrites the song's year (when Spotify's is off). */
  onEditYear: (year: number) => void
  /** Save the song to Liked Songs or a playlist. */
  likeButton: ReactNode
  points: Points[]
  onContinue: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex h-full flex-col select-none bg-[radial-gradient(ellipse_at_50%_55%,rgb(255_255_255/0.06),transparent_70%)]">
      <header className="flex items-center gap-3 px-4 pt-3">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-xs font-semibold text-(--team)" style={teamVars(playerColor)}>
            {playerName}
          </span>
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
            'ml-4 flex flex-none animate-pop items-center gap-3 rounded-2xl border-2 bg-surface p-3 transition-[width]',
            // Room for the year control while editing.
            editing ? 'w-[32rem]' : 'w-64',
            exact
              ? 'border-gold shadow-[0_0_0_1px_var(--color-gold),0_0_28px_rgb(255_204_51/0.35)]'
              : verdict === 'correct'
                ? 'border-good'
                : 'border-bad',
          )}
        >
          <div className="relative flex-none">
            <Artwork src={song.albumArt} className="size-20 rounded-lg text-3xl shadow-[0_8px_20px_rgb(0_0_0/0.5)]" />
            {likeButton}
          </div>
          <PanelSong
            key={song.id}
            song={song}
            exact={exact}
            yearSource={yearSource}
            onEditYear={onEditYear}
            onEditing={setEditing}
          />
        </section>
        <div className="flex min-w-0 flex-1 flex-col">
          <CardRow timeline={timeline} guessYear={yearGuess} verdict={verdict} />
        </div>
      </div>

      <footer className="flex items-center gap-2 px-4 pb-3">
        {points.map((p) => (
          <PointChip key={p.label} {...p} />
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

/** The song panel's text; while editing, the year control takes its place. */
function PanelSong({
  song,
  exact,
  yearSource,
  onEditYear,
  onEditing,
}: {
  song: Song
  exact: boolean
  yearSource: ReactNode
  onEditYear: (year: number) => void
  onEditing: (editing: boolean) => void
}) {
  const editor = useYearEditor(song, onEditYear, { compact: true })
  useEffect(() => onEditing(editor.editing), [editor.editing, onEditing])
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {editor.editing ? (
        editor.input
      ) : (
        <>
          <span className={cx('text-[2.6rem] leading-none font-black tabular-nums', exact && 'text-gold')}>
            {song.year}
          </span>
          <span className="mt-1 line-clamp-2 leading-tight font-bold">{song.title}</span>
          <span className="truncate text-sm text-muted">{song.artists.join(', ')}</span>
          <div className="mt-1 line-clamp-2 text-[0.65rem] leading-tight [&_*]:text-[0.65rem]">{yearSource}</div>
        </>
      )}
      <span className="mt-1.5 self-start">{editor.pills}</span>
    </div>
  )
}

/** Space per year on the ruler, at phone scale. */
const BASE_TICK = 12

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
  const TICK = BASE_TICK * useUiScale()
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
  }, [followRef, TICK])

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
  }, [value, startYear, TICK])

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
