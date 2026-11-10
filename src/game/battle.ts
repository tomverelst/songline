/**
 * Battle mode: two players (or teams) hear the same song and guess at the
 * same time, each placing it in their own timeline. Everyone who places it
 * right wins a copy of the card; but when both picked the same year, only
 * the side that locked it in first does.
 */
import { finish, firstToLockWins, insertSorted, isPlacementCorrect, isValidYear, ranking, slotForYear, score, songsLeft } from './logic'
import type { BattleGuess, GameState, Player, TurnResult } from './types'

export const BATTLE_PLAYERS = 2

function updateGuess(state: GameState, index: number, update: (g: BattleGuess) => BattleGuess): GameState {
  const turn = state.turn
  if (!turn?.guesses?.[index]) return state
  return { ...state, turn: { ...turn, guesses: turn.guesses.map((g, i) => (i === index ? update(g) : g)) } }
}

export function setBattleGuess(state: GameState, index: number, yearGuess: number | undefined): GameState {
  if (state.turn?.phase !== 'guess') return state
  return updateGuess(state, index, (g) => (g.locked ? g : { ...g, yearGuess }))
}

/**
 * Locks a guess in (only a valid year), noting when, or opens it up again
 * (locking in again later counts from then).
 */
export function setBattleLocked(state: GameState, index: number, locked: boolean, now = Date.now()): GameState {
  if (state.turn?.phase !== 'guess') return state
  return updateGuess(state, index, (g) => {
    if (locked && !isValidYear(g.yearGuess)) return g
    if (!locked) return { yearGuess: g.yearGuess }
    return g.locked ? g : { ...g, locked: true, lockedAt: now }
  })
}


export function allLockedIn(state: GameState): boolean {
  const guesses = state.turn?.guesses
  return !!guesses && guesses.length > 0 && guesses.every((g) => g.locked)
}

const NOTHING: TurnResult = { placementCorrect: false, exactYear: false, titleCorrect: false, artistCorrect: false }

/**
 * Reveals every guess. With `timedOut` the clock ran out: guesses count as
 * they stand, locked in or not, and a player without a year loses the card.
 */
export function revealBattle(state: GameState, timedOut = false): GameState {
  const turn = state.turn
  if (!turn?.guesses || turn.phase !== 'guess') return state
  const year = turn.song.year
  const guesses = turn.guesses.map((g, i): BattleGuess => {
    if (!isValidYear(g.yearGuess)) return { locked: g.locked, result: NOTHING }
    const slot = slotForYear(state.players[i].timeline, g.yearGuess)
    return {
      ...g,
      slot,
      result: { ...NOTHING, placementCorrect: isPlacementCorrect(slot, year), exactYear: g.yearGuess === year },
    }
  })
  return { ...state, turn: { ...turn, phase: 'reveal', guesses: firstToLockWins(guesses), ...(timedOut && { timedOut: true }) } }
}

export function updateBattleResult(state: GameState, index: number, patch: Partial<TurnResult>): GameState {
  if (state.turn?.phase !== 'reveal') return state
  return updateGuess(state, index, (g) => ({ ...g, result: { ...(g.result ?? NOTHING), ...patch } }))
}

/**
 * Title and artist are a race, said out loud: only the side that named it
 * first gets the coin. `index` null means nobody did.
 */
export function setFirstToName(
  state: GameState,
  field: 'titleCorrect' | 'artistCorrect',
  index: number | null,
): GameState {
  const turn = state.turn
  if (turn?.phase !== 'reveal' || !turn.guesses) return state
  const guesses = turn.guesses.map((g, i) => ({ ...g, result: { ...(g.result ?? NOTHING), [field]: i === index } }))
  return { ...state, turn: { ...turn, guesses } }
}

/**
 * Hands out the cards and coins. When someone reaches the target, the best
 * of those who did wins (coins break a tie on points; a full tie is shared).
 */
export function endBattleTurn(state: GameState): GameState {
  const turn = state.turn
  if (!turn?.guesses || turn.phase !== 'reveal') return state
  const players = state.players.map((p, i) => {
    const result = turn.guesses![i]?.result
    if (!result) return p
    const { placementCorrect, exactYear, titleCorrect, artistCorrect } = result
    return {
      ...p,
      timeline: placementCorrect ? insertSorted(p.timeline, turn.song) : p.timeline,
      bonus: p.bonus + [exactYear, titleCorrect, artistCorrect].filter(Boolean).length,
    }
  })
  const winners = players.filter((_, i) => turn.guesses![i]?.result?.placementCorrect).map((p) => p.id)
  const next: GameState = { ...state, players, played: [...(state.played ?? []), { song: turn.song, winners }], turn: undefined }
  const reached = players.filter((p) => score(p, state.settings) >= state.settings.targetPoints)
  if (reached.length > 0) {
    const [best] = ranking({ players: reached, settings: state.settings })
    const level = (p: Player) =>
      score(p, state.settings) === score(best, state.settings) && p.bonus === best.bonus
    return { ...next, status: 'finished', winnerIds: reached.filter(level).map((p) => p.id) }
  }
  const after = { ...next, round: state.round + 1 }
  return songsLeft(after).length === 0 ? finish(next) : after
}
