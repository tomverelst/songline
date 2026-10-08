import type { GameSettings, GameState, Player, Slot, Song } from './types'

/** Points towards the target: one per card, plus coins if the rules say so. */
export function score(player: Player, settings: Pick<GameSettings, 'bonusCountsTowardsGoal'>): number {
  return player.timeline.length + (settings.bonusCountsTowardsGoal ? player.bonus : 0)
}

/** Whether this turn's screen is shown upside down (every other turn when enabled). */
export function isFlipped(state: Pick<GameState, 'settings' | 'round' | 'currentPlayer' | 'players'>): boolean {
  if (!state.settings.flipBetweenTurns) return false
  const turnNumber = (state.round - 1) * state.players.length + state.currentPlayer
  return turnNumber % 2 === 1
}

/** Players from best to worst: most points first, bonus coins break ties. */
export function ranking(state: Pick<GameState, 'players' | 'settings'>): Player[] {
  return [...state.players].sort(
    (a, b) => score(b, state.settings) - score(a, state.settings) || b.bonus - a.bonus,
  )
}

export function distinctYears(timeline: Song[]): number[] {
  return [...new Set(timeline.map((s) => s.year))].sort((a, b) => a - b)
}

/**
 * All placements a player can choose for their timeline, in chronological
 * order. "Between" slots that cannot contain any year (e.g. 1970 and 1971)
 * are left out.
 */
export function slotsFor(timeline: Song[]): Slot[] {
  const years = distinctYears(timeline)
  if (years.length === 0) return []
  const slots: Slot[] = [{ kind: 'before', year: years[0] }]
  years.forEach((year, i) => {
    slots.push({ kind: 'on', year })
    const next = years[i + 1]
    if (next !== undefined && next - year > 1) {
      slots.push({ kind: 'between', low: year, high: next })
    }
  })
  slots.push({ kind: 'after', year: years[years.length - 1] })
  return slots
}

export function slotKey(slot: Slot): string {
  switch (slot.kind) {
    case 'before':
      return `before-${slot.year}`
    case 'after':
      return `after-${slot.year}`
    case 'on':
      return `on-${slot.year}`
    case 'between':
      return `between-${slot.low}-${slot.high}`
  }
}

export function slotLabel(slot: Slot): string {
  switch (slot.kind) {
    case 'before':
      return `Before ${slot.year}`
    case 'after':
      return `After ${slot.year}`
    case 'on':
      return `In ${slot.year}`
    case 'between':
      return `Between ${slot.low} and ${slot.high}`
  }
}

export function isPlacementCorrect(slot: Slot, year: number): boolean {
  switch (slot.kind) {
    case 'before':
      return year < slot.year
    case 'after':
      return year > slot.year
    case 'on':
      return year === slot.year
    case 'between':
      return year > slot.low && year < slot.high
  }
}

export function insertSorted(timeline: Song[], song: Song): Song[] {
  const index = timeline.findIndex((s) => s.year > song.year)
  if (index === -1) return [...timeline, song]
  return [...timeline.slice(0, index), song, ...timeline.slice(index)]
}

export const MIN_YEAR = 1900
export const MAX_YEAR = new Date().getFullYear()

export function isValidYear(year: number | undefined): year is number {
  return year !== undefined && year >= MIN_YEAR && year <= MAX_YEAR
}

/** How close (in cards) to a card's middle counts as "on" that card. */
const ON_CARD = 0.15

/**
 * The guess year for the guess card held at position `at` along a row of card
 * years (sorted; `at` is a card index, so 1.5 is between cards 1 and 2).
 * Over a card it takes that card's year. In a gap the year runs through every
 * year between the two cards as the card moves across it, and past either end
 * it counts on by one year per `1 / yearsPerCardPastEnds` of a card.
 */
export function yearForPosition(
  years: number[],
  at: number,
  yearsPerCardPastEnds = 5,
): { year: number; onIndex: number | null } {
  const n = years.length
  const clamp = (y: number) => Math.min(MAX_YEAR, Math.max(MIN_YEAR, y))
  const nearest = Math.min(n - 1, Math.max(0, Math.round(at)))
  const onCard = { year: years[nearest], onIndex: nearest }
  if (Math.abs(at - nearest) < ON_CARD) return onCard
  if (at < 0) {
    const past = -at - ON_CARD
    return { year: clamp(years[0] - 1 - Math.floor(past * yearsPerCardPastEnds)), onIndex: null }
  }
  if (at > n - 1) {
    const past = at - (n - 1) - ON_CARD
    return { year: clamp(years[n - 1] + 1 + Math.floor(past * yearsPerCardPastEnds)), onIndex: null }
  }
  const low = years[Math.floor(at)]
  const room = years[Math.floor(at) + 1] - low - 1
  if (room <= 0) return onCard // no year fits between them
  const across = (at - Math.floor(at) - ON_CARD) / (1 - 2 * ON_CARD)
  return { year: low + 1 + Math.min(room - 1, Math.floor(Math.max(0, across) * room)), onIndex: null }
}

/** The slot a guessed year falls into, given the player's timeline. */
export function slotForYear(timeline: Song[], year: number): Slot {
  const years = distinctYears(timeline)
  if (years.includes(year)) return { kind: 'on', year }
  if (year < years[0]) return { kind: 'before', year: years[0] }
  if (year > years[years.length - 1]) return { kind: 'after', year: years[years.length - 1] }
  const high = years.find((y) => y > year)!
  const low = [...years].reverse().find((y) => y < year)!
  return { kind: 'between', low, high }
}

// ---------- Game lifecycle ----------

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Starts a game. Songs in `alreadyPlayed` go to the bottom of the deck, so
 * they only come up (and are only dealt) once the fresh songs run out.
 */
export function newGame(
  names: string[],
  settings: GameSettings,
  songs: Song[],
  random: () => number = Math.random,
  alreadyPlayed: Set<string> = new Set(),
): GameState {
  // Cards are drawn from the end of the deck.
  const deck = [
    ...shuffle(songs.filter((s) => alreadyPlayed.has(s.id)), random),
    ...shuffle(songs.filter((s) => !alreadyPlayed.has(s.id)), random),
  ]
  const players: Player[] = names.map((name, i) => ({
    id: `p${i}`,
    name,
    timeline: [deck.pop()!],
    bonus: 0,
  }))
  return {
    status: 'playing',
    settings,
    players,
    currentPlayer: 0,
    round: 1,
    deck,
  }
}

export function drawSong(state: GameState): GameState {
  if (state.deck.length === 0) return finish(state)
  const deck = state.deck.slice(0, -1)
  const song = state.deck[state.deck.length - 1]
  return { ...state, deck, turn: { song, phase: 'guess' } }
}

/**
 * Records the outcome of the original-year lookup for a song. `year` is null
 * when the lookup found nothing, in which case the Spotify year stays.
 */
export function withOriginalYear(song: Song, year: number | null): Song {
  return year === null
    ? { ...song, year: song.spotifyYear ?? song.year, yearSource: 'spotify' }
    : { ...song, year, yearSource: 'musicbrainz' }
}

/** Applies a looked-up year to the song being guessed, if it is still in play. */
export function setTurnSongYear(state: GameState, songId: string, year: number | null): GameState {
  const turn = state.turn
  if (!turn || turn.phase !== 'guess' || turn.song.id !== songId) return state
  return { ...state, turn: { ...turn, song: withOriginalYear(turn.song, year) } }
}

/** Throw away the current song (e.g. wrong release year) and draw another. */
export function skipSong(state: GameState): GameState {
  return drawSong({ ...state, turn: undefined })
}

export function reveal(state: GameState): GameState {
  const turn = state.turn
  if (!turn || turn.yearGuess === undefined) return state
  const slot = slotForYear(state.players[state.currentPlayer].timeline, turn.yearGuess)
  return {
    ...state,
    turn: {
      ...turn,
      phase: 'reveal',
      slot,
      result: {
        placementCorrect: isPlacementCorrect(slot, turn.song.year),
        exactYear: turn.yearGuess === turn.song.year,
        titleCorrect: false,
        artistCorrect: false,
      },
    },
  }
}

/**
 * Overwrites the revealed song's year (e.g. Spotify had a reissue's date) and
 * works the card and exact-year points out again. Title and artist stay.
 */
export function overwriteRevealedYear(state: GameState, year: number): GameState {
  const turn = state.turn
  if (!turn || turn.phase !== 'reveal' || !turn.result || !turn.slot) return state
  return {
    ...state,
    turn: {
      ...turn,
      song: { ...turn.song, year, yearSource: 'manual' },
      result: {
        ...turn.result,
        placementCorrect: isPlacementCorrect(turn.slot, year),
        exactYear: turn.yearGuess === year,
      },
    },
  }
}

/** Overwrites the year of a card already in a timeline; it moves to its new spot. */
export function overwriteCardYear(state: GameState, songId: string, year: number): GameState {
  const players = state.players.map((p) => {
    const card = p.timeline.find((s) => s.id === songId)
    if (!card) return p
    const others = p.timeline.filter((s) => s.id !== songId)
    return { ...p, timeline: insertSorted(others, { ...card, year, yearSource: 'manual' as const }) }
  })
  return { ...state, players }
}

export function endTurn(state: GameState): GameState {
  const turn = state.turn
  if (!turn?.result) return state
  const { placementCorrect, exactYear, titleCorrect, artistCorrect } = turn.result
  const players = state.players.map((p, i) => {
    if (i !== state.currentPlayer) return p
    return {
      ...p,
      timeline: placementCorrect ? insertSorted(p.timeline, turn.song) : p.timeline,
      bonus: p.bonus + [exactYear, titleCorrect, artistCorrect].filter(Boolean).length,
    }
  })
  const next = { ...state, players, turn: undefined }
  if (score(players[state.currentPlayer], state.settings) >= state.settings.targetPoints) {
    return { ...next, status: 'finished', winnerIds: [players[state.currentPlayer].id] }
  }
  if (next.deck.length === 0) return finish(next)
  const nextPlayer = (state.currentPlayer + 1) % players.length
  return { ...next, currentPlayer: nextPlayer, round: nextPlayer === 0 ? state.round + 1 : state.round }
}

/**
 * Ends the game early (deck ran out or ended from the menu): most points
 * wins, bonus coins break ties, and players still level share the win.
 */
export function finish(state: GameState): GameState {
  const [best] = ranking(state)
  const level = (p: Player) =>
    score(p, state.settings) === score(best, state.settings) && p.bonus === best.bonus
  return {
    ...state,
    status: 'finished',
    turn: undefined,
    winnerIds: state.players.filter(level).map((p) => p.id),
  }
}
