import { describe, expect, it } from 'vitest'
import { allLockedIn, endBattleTurn, revealBattle, setBattleGuess, setBattleLocked, setFirstToName, updateBattleResult } from './battle'
import { drawSong, newGame, overwriteRevealedYear } from './logic'
import type { GameSettings, GameState, Song } from './types'

const song = (year: number): Song => ({
  id: `s${year}`,
  uri: `spotify:track:${year}`,
  title: `Song ${year}`,
  artists: ['Artist'],
  year,
  spotifyYear: year,
})

const settings: GameSettings = {
  mode: 'battle',
  targetPoints: 3,
  bonusCountsTowardsGoal: false,
  playlistId: 'x',
  playlistName: 'x',
}

/** Ann starts with 1960, Bob with 2000; the mystery song is from 1980. */
function battle(overrides: Partial<GameSettings> = {}): GameState {
  const g = newGame(['Ann', 'Bob'], { ...settings, ...overrides }, [song(1990), song(1980), song(2000), song(1960)], () => 0)
  const deck = [song(1980), song(1990)]
  return drawSong({ ...g, players: [{ ...g.players[0], timeline: [song(1960)] }, { ...g.players[1], timeline: [song(2000)] }], deck })
}

const guess = (g: GameState, ann: number | undefined, bob: number | undefined) =>
  setBattleGuess(setBattleGuess(g, 0, ann), 1, bob)

describe('battle mode', () => {
  it('gives every player an empty guess', () => {
    expect(battle().turn!.guesses).toEqual([{}, {}])
  })

  it('reveals once both locked in, and only valid years lock', () => {
    let g = guess(battle(), 1985, undefined)
    g = setBattleLocked(setBattleLocked(g, 0, true), 1, true)
    expect(g.turn!.guesses!.map((x) => !!x.locked)).toEqual([true, false])
    expect(allLockedIn(g)).toBe(false)
    g = setBattleLocked(setBattleGuess(g, 1, 1970), 1, true)
    expect(allLockedIn(g)).toBe(true)
    // A locked guess can't change until it's opened up again.
    expect(setBattleGuess(g, 0, 1900).turn!.guesses![0].yearGuess).toBe(1985)
  })

  it('judges each guess against its own timeline', () => {
    // Ann: after 1960 is right. Bob: before 2000 is right, and exact.
    const g = revealBattle(guess(battle(), 1975, 1980))
    expect(g.turn!.phase).toBe('reveal')
    expect(g.turn!.guesses!.map((x) => x.result)).toEqual([
      { placementCorrect: true, exactYear: false, titleCorrect: false, artistCorrect: false },
      { placementCorrect: true, exactYear: true, titleCorrect: false, artistCorrect: false },
    ])
  })

  it('counts guesses as they stand when time is up; no year loses the card', () => {
    const g = revealBattle(guess(battle(), 1975, undefined), true)
    expect(g.turn!.timedOut).toBe(true)
    expect(g.turn!.guesses!.map((x) => x.result!.placementCorrect)).toEqual([true, false])
  })

  it('works the results out again when the year is overwritten', () => {
    const g = overwriteRevealedYear(revealBattle(guess(battle(), 1975, 1980)), 2005)
    expect(g.turn!.guesses!.map((x) => x.result!.placementCorrect)).toEqual([true, false])
    expect(g.turn!.guesses!.map((x) => x.result!.exactYear)).toEqual([false, false])
  })

  it('hands every right guess a copy of the card, plus coins', () => {
    let g = revealBattle(guess(battle(), 1975, 2010))
    g = updateBattleResult(g, 1, { titleCorrect: true })
    g = endBattleTurn(g)
    expect(g.players.map((p) => p.timeline.length)).toEqual([2, 1])
    expect(g.players.map((p) => p.bonus)).toEqual([0, 1])
    expect(g.round).toBe(2)
    expect(g.turn).toBeUndefined()
  })

  it('shares the win when both reach the target level, coins break a tie', () => {
    const atTwo = (g: GameState) => ({ ...g, players: g.players.map((p) => ({ ...p, timeline: [...p.timeline, song(1500 + p.id.length)] })) })
    let g = revealBattle(guess(atTwo(battle()), 1975, 1990))
    const shared = endBattleTurn(g)
    expect(shared.status).toBe('finished')
    expect(shared.winnerIds).toEqual(['p0', 'p1'])
    g = updateBattleResult(g, 1, { artistCorrect: true })
    expect(endBattleTurn(g).winnerIds).toEqual(['p1'])
  })

  it('gives title and artist only to the side that named it first', () => {
    let g = revealBattle(guess(battle(), 1975, 1990))
    g = setFirstToName(g, 'titleCorrect', 0)
    g = setFirstToName(g, 'titleCorrect', 1)
    g = setFirstToName(g, 'artistCorrect', 0)
    expect(g.turn!.guesses!.map((x) => [x.result!.titleCorrect, x.result!.artistCorrect])).toEqual([
      [false, true],
      [true, false],
    ])
    g = setFirstToName(g, 'artistCorrect', null)
    expect(g.turn!.guesses!.some((x) => x.result!.artistCorrect)).toBe(false)
    expect(endBattleTurn(g).players.map((p) => p.bonus)).toEqual([0, 1])
  })
})
