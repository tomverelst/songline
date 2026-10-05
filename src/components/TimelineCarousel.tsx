import { useEffect, useRef } from 'react'
import type { Song } from '../game/types'
import { cx } from './classes'

interface Props {
  timeline: Song[]
  /** The guessed year, shown as an extra card where it would land. */
  guessYear?: number
  /** Colours the guess card after the reveal. */
  verdict?: 'correct' | 'wrong'
}

const GUESS_STYLES = {
  none: 'border-dashed border-accent bg-accent/15',
  correct: 'border-good bg-good/15',
  wrong: 'border-bad bg-bad/15',
}

/**
 * The timeline as a row of swipeable cards, with the guess card slotted in
 * where it lands and scrolled to the middle.
 */
export function TimelineCarousel({ timeline, guessYear, verdict }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const focus = useRef<HTMLDivElement>(null)

  const songs = [...timeline].sort((a, b) => a.year - b.year)
  // The guess goes after any cards from the same year, like the card would.
  const guessAt = guessYear === undefined ? -1 : songs.filter((s) => s.year <= guessYear).length
  const focusAt = guessAt >= 0 ? guessAt : Math.floor((songs.length - 1) / 2)

  useEffect(() => {
    const el = scroller.current
    const card = focus.current
    if (!el || !card) return
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' })
  }, [guessYear, timeline.length])

  const cards = songs.map((s, i) => (
    <div
      key={s.id}
      ref={guessAt < 0 && i === focusAt ? focus : undefined}
      className={cx(
        'flex h-36 w-32 flex-none snap-center flex-col gap-1 rounded-2xl border p-3',
        guessYear === s.year ? 'border-accent bg-surface-2' : 'border-line bg-surface-2',
      )}
    >
      <span className="text-2xl font-extrabold text-accent-2 tabular-nums">{s.year}</span>
      <span className="line-clamp-3 text-sm leading-snug">{s.title}</span>
      <span className="mt-auto truncate text-xs text-muted">{s.artists.join(', ')}</span>
    </div>
  ))

  if (guessAt >= 0) {
    cards.splice(
      guessAt,
      0,
      <div
        key="guess"
        ref={focus}
        className={cx(
          'flex h-36 w-32 flex-none snap-center flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center',
          GUESS_STYLES[verdict ?? 'none'],
        )}
      >
        <span className="text-xl">🎵</span>
        <span className="text-3xl font-black tabular-nums">{guessYear}</span>
        <span className="text-xs text-muted">{verdict ? 'Your guess' : 'Mystery song'}</span>
      </div>,
    )
  }

  return (
    <div
      ref={scroller}
      className="relative -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-[calc(50%-4rem)] py-1 [scrollbar-width:none]"
    >
      {cards}
    </div>
  )
}
