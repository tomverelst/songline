import type { GameSettings, GameState, Player, Slot, Song, TurnResult } from './types'

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

// ---------- Fuzzy matching for title / artist guesses ----------

export function normalizeTitle(input: string): string {
  return normalizeBase(
    input
      // "Song - Remastered 2011", "Song - Live at ..."
      .replace(/\s+-\s+.*$/, '')
      // "(feat. X)", "[Remix]"
      .replace(/[([{].*?[)\]}]/g, ''),
  )
}

export function normalizeArtist(input: string): string {
  return normalizeBase(input.replace(/^the\s+/i, '').replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/i, ''))
}

function normalizeBase(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

function similar(guess: string, answer: string): boolean {
  if (!guess || !answer) return false
  if (guess === answer) return true
  const maxLen = Math.max(guess.length, answer.length)
  // Allow roughly one typo per five characters.
  return levenshtein(guess, answer) <= Math.floor(maxLen / 5)
}

export function titleMatches(guess: string, title: string): boolean {
  const g = normalizeTitle(guess)
  return similar(g, normalizeTitle(title)) || similar(g, normalizeBase(title))
}

export function artistMatches(guess: string, artists: string[]): boolean {
  const g = normalizeArtist(guess)
  return artists.some((a) => similar(g, normalizeArtist(a)))
}

export function evaluateTurn(slot: Slot, song: Song, titleGuess: string, artistGuess: string): TurnResult {
  return {
    placementCorrect: isPlacementCorrect(slot, song.year),
    titleCorrect: titleMatches(titleGuess, song.title),
    artistCorrect: artistMatches(artistGuess, song.artists),
  }
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
  return { ...state, deck, turn: { song, phase: 'guess', titleGuess: '', artistGuess: '' } }
}

/** Throw away the current song (e.g. wrong release year) and draw another. */
export function skipSong(state: GameState): GameState {
  return drawSong({ ...state, turn: undefined })
}

export function reveal(state: GameState): GameState {
  const turn = state.turn
  if (!turn || !turn.slot) return state
  return {
    ...state,
    turn: { ...turn, phase: 'reveal', result: evaluateTurn(turn.slot, turn.song, turn.titleGuess, turn.artistGuess) },
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
