import type { Song } from '../game/types'

/** How a guess reads on the reveal, e.g. "guessed 1984". */
export function guessText(yearGuess: number | undefined) {
  return yearGuess === undefined ? 'no guess in time' : `guessed ${yearGuess}`
}

/** The middle year of a timeline: where the year buttons start counting from. */
export function medianYear(timeline: Song[]): number {
  const years = timeline.map((s) => s.year).sort((a, b) => a - b)
  return years[Math.floor(years.length / 2)] ?? 2000
}
