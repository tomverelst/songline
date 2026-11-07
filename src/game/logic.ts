import type { GameSettings, GameState, Player, Slot, Song, Turn } from './types'

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

/**
 * With "no double years", the years a mystery song must not be from: those
 * in the guessing player's timeline (in Battle, in anyone's).
 */
export function blockedYears(state: GameState): Set<number> {
  if (!state.settings.noDoubleYears) return new Set()
  const guessing = state.settings.mode === 'battle' ? state.players : [state.players[state.currentPlayer]]
  return new Set(guessing.flatMap((p) => p.timeline.map((s) => s.year)))
}

/**
 * Whether the song being guessed is from a year the rules leave out, and a
 * song from another year is left in the deck to replace it.
 */
export function isDoubleYear(state: GameState): boolean {
  const turn = state.turn
  if (!turn || turn.phase !== 'guess') return false
  const blocked = blockedYears(state)
  return blocked.has(turn.song.year) && state.deck.some((s) => !blocked.has(s.year))
}

export function drawSong(state: GameState, random: () => number = Math.random): GameState {
  if (state.deck.length === 0) return finish(state)
  // Cards are drawn from the end. Skip songs from a blocked year (they stay in
  // the deck for later turns); when every song is blocked, take the next one anyway.
  const blocked = blockedYears(state)
  let index = state.deck.length - 1
  while (index >= 0 && blocked.has(state.deck[index].year)) index--
  if (index < 0) index = state.deck.length - 1
  const song = state.deck[index]
  const deck = state.deck.filter((_, i) => i !== index)
  const turn: Turn = { song, phase: 'guess' }
  if (state.settings.randomStart) turn.startMs = randomStartMs(song.durationMs, state.settings.guessTimeLimit, random)
  const limitMs = timeLimitMs(state.settings)
  if (limitMs) turn.clock = { leftMs: limitMs }
  if (state.settings.mode === 'battle') turn.guesses = state.players.map(() => ({}))
  return { ...state, deck, turn }
}

/** Never start in the first bit of a song (intros all sound alike)… */
const MIN_START_FRACTION = 0.1
const MIN_START_MS = 10_000
/** …nor so late that it ends before the guess is in. */
const MAX_START_FRACTION = 0.7
const LISTEN_WITHOUT_LIMIT_MS = 30_000
const END_MARGIN_MS = 15_000

/**
 * A random point to start a song from: past the intro, and early enough that
 * the whole time limit (or half a minute without one), plus a margin, still
 * fits before the end. Songs too short for that start at the latest point that
 * fits, or at the beginning; songs without a known length start at 0.
 */
export function randomStartMs(
  durationMs: number | undefined,
  timeLimitSeconds: number | undefined,
  random: () => number = Math.random,
): number {
  if (!durationMs || durationMs <= 0) return 0
  const listenMs = timeLimitSeconds ? timeLimitSeconds * 1000 : LISTEN_WITHOUT_LIMIT_MS
  const lastFit = durationMs - listenMs - END_MARGIN_MS
  if (lastFit <= 0) return 0
  const earliest = Math.max(MIN_START_MS, durationMs * MIN_START_FRACTION)
  const latest = Math.min(durationMs * MAX_START_FRACTION, lastFit)
  if (latest <= earliest) return Math.round(Math.min(earliest, lastFit))
  return Math.round(earliest + random() * (latest - earliest))
}

// ---------- Guess clock ----------

export function timeLimitMs(settings: Pick<GameSettings, 'guessTimeLimit'>): number {
  return settings.guessTimeLimit && settings.guessTimeLimit > 0 ? settings.guessTimeLimit * 1000 : 0
}

/** Time left to guess, or undefined when the turn has no time limit. */
export function timeLeftMs(turn: Turn | undefined, now: number): number | undefined {
  const clock = turn?.clock
  if (!clock) return undefined
  return Math.max(0, clock.deadline !== undefined ? clock.deadline - now : clock.leftMs)
}

/** Starts (or resumes) the guess clock, once the song is playing. */
export function startClock(state: GameState, now: number): GameState {
  const turn = state.turn
  if (!turn?.clock || turn.phase !== 'guess' || turn.clock.deadline !== undefined) return state
  return { ...state, turn: { ...turn, clock: { ...turn.clock, deadline: now + turn.clock.leftMs } } }
}

/** Stops the guess clock while the song is paused. */
export function stopClock(state: GameState, now: number): GameState {
  const turn = state.turn
  if (!turn?.clock || turn.clock.deadline === undefined) return state
  return { ...state, turn: { ...turn, clock: { leftMs: Math.max(0, turn.clock.deadline - now) } } }
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

/** How many songs ahead the original year is looked up. */
export const LOOK_AHEAD = 3

/**
 * Of the next few songs that can come up, those whose original year hasn't
 * been looked up yet, in the order they'll be drawn (cards are drawn from the
 * end of the deck). Songs known to be passed over by "no double years" don't
 * count as coming up.
 */
export function songsToLookUp(state: GameState, count = LOOK_AHEAD): Song[] {
  const blocked = blockedYears(state)
  const unknown: Song[] = []
  let ahead = 0
  for (let i = state.deck.length - 1; i >= 0 && ahead < count; i--) {
    const song = state.deck[i]
    if (song.yearSource && blocked.has(song.year)) continue
    ahead++
    if (!song.yearSource) unknown.push(song)
  }
  return unknown
}

/**
 * Fills in original years looked up ahead of time (song id → year, null when
 * the lookup found nothing) for the songs still in the deck.
 */
export function withKnownYears(state: GameState, years: ReadonlyMap<string, number | null>): GameState {
  if (!state.deck.some((s) => !s.yearSource && years.has(s.id))) return state
  const deck = state.deck.map((s) => (!s.yearSource && years.has(s.id) ? withOriginalYear(s, years.get(s.id)!) : s))
  return { ...state, deck }
}

/** Applies a looked-up year to the song being guessed, if it is still in play. */
export function setTurnSongYear(state: GameState, songId: string, year: number | null): GameState {
  const turn = state.turn
  if (!turn || turn.phase !== 'guess' || turn.song.id !== songId) return state
  return { ...state, turn: { ...turn, song: withOriginalYear(turn.song, year) } }
}

/**
 * The song turned out to be from a year that's already in the timeline (its
 * original year came in after it was drawn): put it back at the bottom of the
 * deck and draw another.
 */
export function redrawSong(state: GameState, random: () => number = Math.random): GameState {
  const turn = state.turn
  if (!turn) return state
  return drawSong({ ...state, deck: [turn.song, ...state.deck], turn: undefined }, random)
}

/** Throw away the current song (e.g. wrong release year) and draw another. */
export function skipSong(state: GameState, random: () => number = Math.random): GameState {
  return drawSong({ ...state, turn: undefined }, random)
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
 * The time limit ran out: a valid guess is locked in as it stands; without
 * one the card is lost (bonus coins for title and artist can still be ticked).
 */
export function timeUp(state: GameState): GameState {
  const turn = state.turn
  if (!turn || turn.phase !== 'guess') return state
  if (isValidYear(turn.yearGuess)) {
    const revealed = reveal(state)
    return { ...revealed, turn: revealed.turn && { ...revealed.turn, timedOut: true } }
  }
  return {
    ...state,
    turn: {
      ...turn,
      yearGuess: undefined,
      phase: 'reveal',
      timedOut: true,
      result: { placementCorrect: false, exactYear: false, titleCorrect: false, artistCorrect: false },
    },
  }
}

/**
 * Overwrites the revealed song's year (e.g. Spotify had a reissue's date) and
 * works the card and exact-year points out again. Title and artist stay.
 */
export function overwriteRevealedYear(state: GameState, year: number): GameState {
  const turn = state.turn
  if (!turn || turn.phase !== 'reveal' || !(turn.result || turn.guesses)) return state
  return {
    ...state,
    turn: {
      ...turn,
      song: { ...turn.song, year, yearSource: 'manual' },
      result: turn.result && {
        ...turn.result,
        // Without a slot, nobody guessed before the time ran out.
        placementCorrect: turn.slot ? isPlacementCorrect(turn.slot, year) : false,
        exactYear: turn.yearGuess === year,
      },
      guesses: turn.guesses?.map((g) =>
        g.result
          ? {
              ...g,
              result: {
                ...g.result,
                placementCorrect: g.slot ? isPlacementCorrect(g.slot, year) : false,
                exactYear: g.yearGuess === year,
              },
            }
          : g,
      ),
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
