import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Song } from '../game/types'
import { cx } from './classes'

interface Props {
  timeline: Song[]
  /** The guessed year, shown as a face-down card where it would land. */
  guessYear?: number
  /** Rings the guess card after the reveal. */
  verdict?: 'correct' | 'wrong'
  /** When set, tapping a card guesses that card's year. */
  onSelectYear?: (year: number) => void
}

const CARD_W = 160 // w-40
const OVERLAP = 52
const STEP = CARD_W - OVERLAP

const VERDICT_RING = {
  none: 'ring-2 ring-white/60',
  correct: 'ring-4 ring-good',
  wrong: 'ring-4 ring-bad',
}

/**
 * The timeline as a fanned hand of playing cards. The card in the middle
 * stands up straight; the others tilt away the further out they are.
 */
export function TimelineCards({ timeline, guessYear, verdict, onSelectYear }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  // How far each card is from the middle of the view, in cards.
  const [middle, setMiddle] = useState(0)

  // Card wrappers are never transformed, so their offsets are exact.
  const firstCardLeft = () => (scroller.current?.firstElementChild as HTMLElement | null)?.offsetLeft ?? 0
  const scrollFor = (index: number) =>
    firstCardLeft() + index * STEP - ((scroller.current?.clientWidth ?? 0) - CARD_W) / 2

  const songs = [...timeline].sort((a, b) => a.year - b.year)
  // A guess in the same year as a card lies on top of that card; otherwise
  // it gets its own spot in the hand.
  const onCardAt = guessYear === undefined ? -1 : songs.map((s) => s.year).lastIndexOf(guessYear)
  const ownSpotAt = guessYear === undefined || onCardAt >= 0 ? -1 : songs.filter((s) => s.year <= guessYear).length
  const count = songs.length + (ownSpotAt >= 0 ? 1 : 0)
  const focusAt = onCardAt >= 0 ? onCardAt : ownSpotAt >= 0 ? ownSpotAt : Math.floor((count - 1) / 2)

  useEffect(() => {
    scroller.current?.scrollTo({ left: scrollFor(focusAt), behavior: 'smooth' })
    // scrollFor only reads the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAt, count])

  const back = guessYear !== undefined && <CardBack year={guessYear} ring={VERDICT_RING[verdict ?? 'none']} />
  const cards: { key: string; content: ReactNode; year?: number }[] = songs.map((s, i) => ({
    key: s.id,
    year: s.year,
    content: (
      <>
        <CardFace song={s} covered={i === onCardAt} />
        {i === onCardAt && (
          // Lies on top, shifted so the card underneath still shows.
          <div className="absolute inset-0 z-10 translate-x-3 translate-y-12 rotate-[4deg]">{back}</div>
        )}
      </>
    ),
  }))
  if (ownSpotAt >= 0) cards.splice(ownSpotAt, 0, { key: 'guess', content: back })

  return (
    <div
      ref={scroller}
      onScroll={(e) => setMiddle((e.currentTarget.scrollLeft - scrollFor(0)) / STEP)}
      className="isolate -mx-4 flex snap-x snap-mandatory overflow-x-auto px-[calc(50%-4rem)] pt-6 pb-14 [scrollbar-width:none]"
    >
      {cards.map((card, i) => {
        const d = i - middle
        const distance = Math.min(Math.abs(d), 3)
        const tappable = onSelectYear && card.year !== undefined
        return (
          // The wrapper sets the snap point; only the inner card tilts, so the
          // snap points don't move while the hand fans out.
          <div
            key={card.key}
            role={tappable ? 'button' : undefined}
            aria-label={tappable ? `Guess ${card.year}` : undefined}
            onClick={tappable ? () => onSelectYear(card.year!) : undefined}
            className={cx('relative h-56 w-40 flex-none snap-center', tappable && 'cursor-pointer')}
            style={{ marginLeft: i === 0 ? 0 : -OVERLAP, zIndex: 100 - Math.round(distance * 10) }}
          >
            <div
              className="absolute inset-0 transition-transform duration-150 ease-out"
              style={{
                transform: `translateY(${distance * distance * 5}px) rotate(${Math.max(-24, Math.min(24, d * 8))}deg) scale(${1 - distance * 0.05})`,
                transformOrigin: '50% 120%',
              }}
            >
              {card.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const CARD = 'absolute inset-0 overflow-hidden rounded-2xl border-2 border-line shadow-[0_10px_30px_rgb(0_0_0/0.45)]'

/** `covered`: the guess lies on top, so the year moves up to stay visible. */
function CardFace({ song, covered }: { song: Song; covered: boolean }) {
  return (
    <div className={cx(CARD, 'bg-surface-2')}>
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
