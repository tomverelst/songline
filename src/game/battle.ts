/**
 * Battle mode: two players (or teams) hear the same song and guess at the
 * same time, each placing it in their own timeline. Everyone who places it
 * right wins a copy of the card.
 */
import { finish, insertSorted, isPlacementCorrect, isValidYear, ranking, slotForYear, score } from './logic'
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

/** Locks a guess in (only a valid year), or opens it up again. */
export function setBattleLocked(state: GameState, index: number, locked: boolean): GameState {
  if (state.turn?.phase !== 'guess') return state
  return updateGuess(state, index, (g) => (locked && !isValidYear(g.yearGuess) ? g : { ...g, locked }))
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
  return { ...state, turn: { ...turn, phase: 'reveal', guesses, ...(timedOut && { timedOut: true }) } }
}

export function updateBattleResult(state: GameState, index: number, patch: Partial<TurnResult>): GameState {
  if (state.turn?.phase !== 'reveal') return state
  return updateGuess(state, index, (g) => ({ ...g, result: { ...(g.result ?? NOTHING), ...patch } }))
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
  const next: GameState = { ...state, players, turn: undefined }
  const reached = players.filter((p) => score(p, state.settings) >= state.settings.targetPoints)
  if (reached.length > 0) {
    const [best] = ranking({ players: reached, settings: state.settings })
    const level = (p: Player) =>
      score(p, state.settings) === score(best, state.settings) && p.bonus === best.bonus
    return { ...next, status: 'finished', winnerIds: reached.filter(level).map((p) => p.id) }
  }
  if (next.deck.length === 0) return finish(next)
  return { ...next, round: state.round + 1 }
}
