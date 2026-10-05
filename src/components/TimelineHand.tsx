import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Song } from '../game/types'
import { cx } from './classes'

interface Props {
  timeline: Song[]
  /** The guessed year, shown as a face-down card where it would land. */
  guessYear?: number
  /** Rings the guess card after the reveal. */
  verdict?: 'correct' | 'wrong'
}

const CARD_W = 112 // w-28
const OVERLAP = 36
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
export function TimelineHand({ timeline, guessYear, verdict }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)

  const songs = [...timeline].sort((a, b) => a.year - b.year)
  const guessAt = guessYear === undefined ? -1 : songs.filter((s) => s.year <= guessYear).length
  const count = songs.length + (guessAt >= 0 ? 1 : 0)
  const focusAt = guessAt >= 0 ? guessAt : Math.floor((count - 1) / 2)

  useEffect(() => {
    scroller.current?.scrollTo({ left: focusAt * STEP, behavior: 'smooth' })
  }, [focusAt, count])

  const cards: { key: string; face: ReactNode }[] = songs.map((s) => ({
    key: s.id,
    face: <CardFace song={s} highlight={guessYear === s.year} />,
  }))
  if (guessAt >= 0) {
    cards.splice(guessAt, 0, { key: 'guess', face: <CardBack year={guessYear!} ring={VERDICT_RING[verdict ?? 'none']} /> })
  }

  // How far each card is from the middle of the view, in cards.
  const middle = scrollLeft / STEP

  return (
    <div
      ref={scroller}
      onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-[calc(50%-3.5rem)] pt-5 pb-7 [scrollbar-width:none]"
    >
      {cards.map((card, i) => {
        const d = i - middle
        const distance = Math.min(Math.abs(d), 3)
        return (
          <div
            key={card.key}
            className="relative h-40 w-28 flex-none snap-center transition-transform duration-150 ease-out first:ml-0"
            style={{
              marginLeft: i === 0 ? 0 : -OVERLAP,
              transform: `translateY(${distance * distance * 4}px) rotate(${Math.max(-24, Math.min(24, d * 8))}deg) scale(${1 - distance * 0.05})`,
              transformOrigin: '50% 120%',
              zIndex: 100 - Math.round(distance * 10),
            }}
          >
            {card.face}
          </div>
        )
      })}
    </div>
  )
}

const CARD = 'absolute inset-0 overflow-hidden rounded-2xl border-2 border-line shadow-[0_10px_30px_rgb(0_0_0/0.45)]'

function CardFace({ song, highlight }: { song: Song; highlight: boolean }) {
  return (
    <div className={cx(CARD, 'bg-surface-2', highlight && 'border-accent')}>
      {song.albumArt ? (
        <img src={song.albumArt} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-linear-160 from-surface-2 to-bg" />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-black/10 via-transparent to-black/85" />
      <span className="absolute top-2 left-2 rounded-lg bg-black/70 px-1.5 py-0.5 text-sm font-extrabold text-accent-2 tabular-nums">
        {song.year}
      </span>
      <span className="absolute inset-x-2 bottom-2 flex flex-col">
        <span className="line-clamp-2 text-xs leading-tight font-bold text-white">{song.title}</span>
        <span className="truncate text-[0.65rem] text-white/70">{song.artists.join(', ')}</span>
      </span>
    </div>
  )
}

/** The mystery song, face down: the card back from the loading screen. */
function CardBack({ year, ring }: { year: number; ring: string }) {
  return (
    <div className={cx(CARD, 'grid place-items-center bg-accent-gradient text-on-accent', ring)}>
      <div className="absolute inset-2 rounded-xl border-2 border-dashed border-on-accent/25" />
      <div className="relative flex flex-col items-center">
        <span className="text-2xl">♪</span>
        <span className="text-2xl font-black tabular-nums">{year}</span>
      </div>
    </div>
  )
}
