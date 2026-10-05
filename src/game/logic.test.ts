import { describe, expect, it } from 'vitest'
import {
  endTurn,
  insertSorted,
  isPlacementCorrect,
  newGame,
  reveal,
  score,
  slotLabel,
  slotForYear,
  slotsFor,
  drawSong,
  finish,
  isFlipped,
  ranking,
} from './logic'
import type { GameSettings, Song } from './types'

const song = (year: number, title = `Song ${year}`, artists = ['Artist']): Song => ({
  id: `${title}-${year}`,
  uri: `spotify:track:${year}`,
  title,
  artists,
  year,
  spotifyYear: year,
})

describe('slotsFor', () => {
  it('offers before, on, between and after slots', () => {
    const labels = slotsFor([song(1970), song(1980)]).map(slotLabel)
    expect(labels).toEqual(['Before 1970', 'In 1970', 'Between 1970 and 1980', 'In 1980', 'After 1980'])
  })

  it('merges cards with the same year and drops impossible gaps', () => {
    const labels = slotsFor([song(1970), song(1970), song(1971)]).map(slotLabel)
    expect(labels).toEqual(['Before 1970', 'In 1970', 'In 1971', 'After 1971'])
  })
})

describe('isPlacementCorrect', () => {
  it('treats between as exclusive and on as exact', () => {
    const between = { kind: 'between', low: 1970, high: 1980 } as const
    expect(isPlacementCorrect(between, 1975)).toBe(true)
    expect(isPlacementCorrect(between, 1970)).toBe(false)
    expect(isPlacementCorrect({ kind: 'on', year: 1970 }, 1970)).toBe(true)
    expect(isPlacementCorrect({ kind: 'before', year: 1970 }, 1969)).toBe(true)
    expect(isPlacementCorrect({ kind: 'after', year: 1980 }, 1980)).toBe(false)
  })
})

describe('insertSorted', () => {
  it('keeps the timeline chronological', () => {
    const t = insertSorted([song(1970), song(1990)], song(1980))
    expect(t.map((s) => s.year)).toEqual([1970, 1980, 1990])
  })
})

describe('slotForYear', () => {
  const timeline = [song(1970), song(1980)]
  it('maps a guessed year onto the timeline', () => {
    expect(slotLabel(slotForYear(timeline, 1965))).toBe('Before 1970')
    expect(slotLabel(slotForYear(timeline, 1970))).toBe('In 1970')
    expect(slotLabel(slotForYear(timeline, 1975))).toBe('Between 1970 and 1980')
    expect(slotLabel(slotForYear(timeline, 1999))).toBe('After 1980')
  })

  it('wins the card for any year in the right gap, not only the exact year', () => {
    expect(isPlacementCorrect(slotForYear(timeline, 1972), 1978)).toBe(true)
    expect(isPlacementCorrect(slotForYear(timeline, 1972), 1980)).toBe(false)
  })
})

describe('game flow', () => {
  const settings: GameSettings = {
    mode: 'standard',
    targetPoints: 3,
    bonusCountsTowardsGoal: false,
    playlistId: 'x',
    playlistName: 'x',
  }
  const songs = [1960, 1970, 1980, 1990, 2000, 2010].map((y) => song(y))
  const perfectTurn = (s: GameSettings) => {
    let g = drawSong(newGame(['Ann', 'Bob'], s, songs, () => 0.5))
    g = reveal({ ...g, turn: { ...g.turn!, yearGuess: g.turn!.song.year } })
    return endTurn({ ...g, turn: { ...g.turn!, result: { ...g.turn!.result!, titleCorrect: true, artistCorrect: true } } })
  }

  it('deals a starting card to every player', () => {
    const g = newGame(['Ann', 'Bob'], settings, songs)
    expect(g.players.every((p) => p.timeline.length === 1)).toBe(true)
    expect(g.deck).toHaveLength(4)
  })

  it('gives a card plus up to 3 bonus coins that do not count towards the target', () => {
    const g = perfectTurn(settings)
    expect(g.players[0].timeline).toHaveLength(2)
    expect(g.players[0].bonus).toBe(3)
    expect(score(g.players[0], g.settings)).toBe(2)
    expect(g.status).toBe('playing')
    expect(g.currentPlayer).toBe(1)
  })

  it('counts coins towards the target when that advanced option is on', () => {
    const g = perfectTurn({ ...settings, bonusCountsTowardsGoal: true })
    expect(score(g.players[0], g.settings)).toBe(5)
    expect(g.status).toBe('finished')
    expect(g.winnerIds).toEqual(['p0'])
  })

  it('gives the card but no exact bonus for a year in the right gap', () => {
    let g = drawSong(newGame(['Ann', 'Bob'], settings, songs, () => 0.5))
    const { song } = g.turn!
    const start = g.players[0].timeline[0].year
    const guess = song.year < start ? start - 50 : start + 50
    g = reveal({ ...g, turn: { ...g.turn!, yearGuess: guess } })
    expect(g.turn!.result).toMatchObject({ placementCorrect: true, exactYear: false })
  })

  it('ends the game once a player has enough cards', () => {
    let g = drawSong(newGame(['Ann', 'Bob'], { ...settings, targetPoints: 2 }, songs, () => 0.5))
    g = endTurn(reveal({ ...g, turn: { ...g.turn!, yearGuess: g.turn!.song.year } }))
    expect(g.status).toBe('finished')
    expect(g.winnerIds).toEqual(['p0'])
  })

  it('does not award the card for a wrong placement', () => {
    let g = drawSong(newGame(['Ann', 'Bob'], settings, songs, () => 0.5))
    g = { ...g, turn: { ...g.turn!, yearGuess: 1 } }
    g = endTurn(reveal(g))
    expect(g.players[0].timeline).toHaveLength(1)
    expect(g.currentPlayer).toBe(1)
  })

  it('breaks a tie on points with bonus coins when the game ends early', () => {
    const g = newGame(['Ann', 'Bob', 'Cas'], settings, songs)
    const players = g.players.map((p, i) => ({ ...p, bonus: [1, 2, 0][i] }))
    expect(finish({ ...g, players }).winnerIds).toEqual(['p1'])
    expect(ranking({ ...g, players }).map((p) => p.name)).toEqual(['Bob', 'Ann', 'Cas'])
  })
})

describe('isFlipped', () => {
  const at = (round: number, currentPlayer: number, players: number, flipBetweenTurns = true) =>
    isFlipped({
      round,
      currentPlayer,
      players: Array.from({ length: players }) as never,
      settings: { flipBetweenTurns } as GameSettings,
    })

  it('flips every other turn, also across rounds with an odd number of players', () => {
    expect([at(1, 0, 2), at(1, 1, 2), at(2, 0, 2), at(2, 1, 2)]).toEqual([false, true, false, true])
    expect([at(1, 0, 3), at(1, 1, 3), at(1, 2, 3), at(2, 0, 3)]).toEqual([false, true, false, true])
  })

  it('never flips when the option is off', () => {
    expect(at(1, 1, 2, false)).toBe(false)
  })
})

describe('newGame with songs from earlier games', () => {
  const settings = { mode: 'standard', targetPoints: 10, bonusCountsTowardsGoal: false, playlistId: 'x', playlistName: 'x' } as const
  const songs = [1960, 1970, 1980, 1990, 2000, 2010].map((y) => song(y))
  const played = new Set(songs.slice(0, 3).map((s) => s.id))

  it('deals and draws fresh songs before ones already heard', () => {
    let g = newGame(['Ann', 'Bob'], settings, songs, Math.random, played)
    const order = g.players.map((p) => p.timeline[0].id)
    while (g.deck.length) {
      g = drawSong(g)
      order.push(g.turn!.song.id)
      g = { ...g, turn: undefined }
    }
    expect(order.slice(0, 3).every((id) => !played.has(id))).toBe(true)
    expect(order.slice(3).every((id) => played.has(id))).toBe(true)
  })
})
