import { describe, expect, it } from 'vitest'
import {
  artistMatches,
  endTurn,
  insertSorted,
  isPlacementCorrect,
  newGame,
  reveal,
  score,
  slotLabel,
  slotsFor,
  titleMatches,
  drawSong,
} from './logic'
import type { Song } from './types'

const song = (year: number, title = `Song ${year}`, artists = ['Artist']): Song => ({
  id: `${title}-${year}`,
  uri: `spotify:track:${year}`,
  title,
  artists,
  year,
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

describe('guess matching', () => {
  it('ignores remaster suffixes, punctuation and small typos', () => {
    expect(titleMatches("dont stop me now", "Don't Stop Me Now - Remastered 2011")).toBe(true)
    expect(titleMatches('bohemian rapsody', 'Bohemian Rhapsody')).toBe(true)
    expect(titleMatches('yesterday', 'Let It Be')).toBe(false)
    expect(titleMatches('', 'Let It Be')).toBe(false)
  })

  it('matches any credited artist', () => {
    expect(artistMatches('beatles', ['The Beatles'])).toBe(true)
    expect(artistMatches('Beyonce', ['Jay-Z', 'Beyoncé'])).toBe(true)
    expect(artistMatches('Queen', ['ABBA'])).toBe(false)
  })
})

describe('game flow', () => {
  const settings = { targetPoints: 3, playlistId: 'x', playlistName: 'x' }
  const songs = [1960, 1970, 1980, 1990, 2000, 2010].map((y) => song(y))

  it('deals a starting card to every player', () => {
    const g = newGame(['Ann', 'Bob'], settings, songs)
    expect(g.players.every((p) => p.timeline.length === 1)).toBe(true)
    expect(g.deck).toHaveLength(4)
  })

  it('awards the card and bonus points, then passes the turn', () => {
    let g = drawSong(newGame(['Ann', 'Bob'], settings, songs, () => 0.5))
    const mystery = g.turn!.song
    const start = g.players[0].timeline[0].year
    const slot = mystery.year < start ? { kind: 'before', year: start } as const : { kind: 'after', year: start } as const
    g = { ...g, turn: { ...g.turn!, slot, titleGuess: mystery.title, artistGuess: '' } }
    g = endTurn(reveal(g))
    expect(g.players[0].timeline).toHaveLength(2)
    expect(g.players[0].bonus).toBe(1)
    expect(score(g.players[0])).toBe(3)
    expect(g.status).toBe('finished')
    expect(g.winnerIds).toEqual(['p0'])
  })

  it('does not award the card for a wrong placement', () => {
    let g = drawSong(newGame(['Ann', 'Bob'], settings, songs, () => 0.5))
    g = { ...g, turn: { ...g.turn!, slot: { kind: 'on', year: 1 } } }
    g = endTurn(reveal(g))
    expect(g.players[0].timeline).toHaveLength(1)
    expect(g.currentPlayer).toBe(1)
  })
})
