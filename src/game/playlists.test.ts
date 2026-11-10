import { describe, expect, it } from 'vitest'
import { deckOwner, drawSong, endTurn, newGame, reveal, songsLeft, totalSongsLeft } from './logic'
import { endBattleTurn, revealBattle } from './battle'
import type { GameSettings, GameState, Song } from './types'

const song = (id: string, year: number): Song => ({ id, uri: `spotify:track:${id}`, title: id, artists: ['x'], year, spotifyYear: year })
const list = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => song(`${prefix}${i}`, 1960 + i))

const settings = (mode: GameSettings['mode'] = 'standard'): GameSettings => ({
  mode,
  targetPoints: 10,
  bonusCountsTowardsGoal: false,
  playlistId: 'a',
  playlistName: 'A',
})
const A = { id: 'a', name: 'A' }
const B = { id: 'b', name: 'B' }
const songs = { a: list('a', 4), b: list('b', 4) }

/** Plays a turn with a wrong guess. */
const missTurn = (g: GameState) => {
  g = drawSong(g, () => 0)
  return endTurn(reveal({ ...g, turn: { ...g.turn!, yearGuess: 1900 } }))
}

describe('a playlist per player', () => {
  it('deals everyone a starting card from their own playlist', () => {
    const g = newGame(['Ann', 'Bob', 'Cy'], settings(), songs, Math.random, new Set(), [A, B, A])
    expect(g.settings.playlistPerPlayer).toBe(true)
    expect(g.players.map((p) => p.timeline[0].id[0])).toEqual(['a', 'b', 'a'])
    // Ann and Cy share playlist A's deck, so they never get the same card.
    expect(g.players[0].timeline[0].id).not.toBe(g.players[2].timeline[0].id)
    expect(g.playlistDecks!.a).toHaveLength(2)
    expect(g.playlistDecks!.b).toHaveLength(3)
    expect(totalSongsLeft(g)).toBe(5)
  })

  it('plays each player songs from their own playlist', () => {
    let g = newGame(['Ann', 'Bob'], settings(), songs, Math.random, new Set(), [A, B])
    g = drawSong(g, () => 0)
    expect(g.turn!.song.id[0]).toBe('a')
    expect(g.playlistDecks!.a).toHaveLength(2)
    expect(g.playlistDecks!.b).toHaveLength(3)
    g = endTurn(reveal({ ...g, turn: { ...g.turn!, yearGuess: 1900 } }))
    expect(deckOwner(g)?.name).toBe('Bob')
    g = drawSong(g, () => 0)
    expect(g.turn!.song.id[0]).toBe('b')
  })

  it('ends the game when the next player’s playlist runs out', () => {
    let g = newGame(['Ann', 'Bob'], settings(), { a: list('a', 2), b: list('b', 4) }, Math.random, new Set(), [A, B])
    g = missTurn(g) // Ann plays A's last song.
    expect(g.status).toBe('playing')
    g = missTurn(g) // Bob
    expect(g.status).toBe('finished')
    expect(songsLeft({ ...g, currentPlayer: 1 })).toHaveLength(2)
  })

  it('battle: songs come from each side’s playlist in turn', () => {
    let g = newGame(['Ann', 'Bob'], settings('battle'), songs, Math.random, new Set(), [A, B])
    const ids: string[] = []
    for (let round = 0; round < 3; round++) {
      g = drawSong(g, () => 0)
      ids.push(g.turn!.song.id[0])
      g = endBattleTurn(revealBattle(g, true))
    }
    expect(ids).toEqual(['a', 'b', 'a'])
  })
})
