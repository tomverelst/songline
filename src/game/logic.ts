import type { GameSettings, GameState, Player, Slot, Song } from './types'

export function score(player: Player): number {
  return player.timeline.length + player.bonus
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

export function newGame(
  names: string[],
  settings: GameSettings,
  songs: Song[],
  random: () => number = Math.random,
): GameState {
  const deck = shuffle(songs, random)
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
      result: { placementCorrect: isPlacementCorrect(slot, turn.song.year), titleCorrect: false, artistCorrect: false },
    },
  }
}

export function endTurn(state: GameState): GameState {
  const turn = state.turn
  if (!turn?.result) return state
  const { placementCorrect, titleCorrect, artistCorrect } = turn.result
  const players = state.players.map((p, i) => {
    if (i !== state.currentPlayer) return p
    return {
      ...p,
      timeline: placementCorrect ? insertSorted(p.timeline, turn.song) : p.timeline,
      bonus: p.bonus + (titleCorrect ? 1 : 0) + (artistCorrect ? 1 : 0),
    }
  })
  const next = { ...state, players, turn: undefined }
  if (score(players[state.currentPlayer]) >= state.settings.targetPoints) {
    return { ...next, status: 'finished', winnerIds: [players[state.currentPlayer].id] }
  }
  if (next.deck.length === 0) return finish(next)
  const nextPlayer = (state.currentPlayer + 1) % players.length
  return { ...next, currentPlayer: nextPlayer, round: nextPlayer === 0 ? state.round + 1 : state.round }
}

/** Ends the game early (deck ran out); highest score wins, ties share. */
export function finish(state: GameState): GameState {
  const best = Math.max(...state.players.map(score))
  return {
    ...state,
    status: 'finished',
    turn: undefined,
    winnerIds: state.players.filter((p) => score(p) === best).map((p) => p.id),
  }
}
