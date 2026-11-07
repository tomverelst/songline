import { describe, expect, it, vi } from 'vitest'
import { AvoidDoubleYearsDeck, BufferDeck, FreshFirstDeck, LookupDeck, playingDeck, SourceDeck, type Deck } from './deck'
import type { Song } from './types'

const song = (year: number, id = `s${year}`): Song => ({
  id,
  uri: `spotify:track:${id}`,
  title: `Song ${year}`,
  artists: ['Artist'],
  year,
  spotifyYear: year,
})

const drawAll = (deck: Deck) => {
  const drawn: number[] = []
  for (let s = deck.draw(); s; s = deck.draw()) drawn.push(s.year)
  return drawn
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('SourceDeck', () => {
  it('deals in order, takes cards back at the bottom and saves what is left', () => {
    const deck = new SourceDeck([song(1970), song(1980)])
    const first = deck.draw()!
    deck.putBack(first)
    expect(deck.remaining().map((s) => s.year)).toEqual([1980, 1970])
  })
})

describe('FreshFirstDeck', () => {
  it('saves songs heard before for when the fresh ones run out', () => {
    const deck = new FreshFirstDeck(new SourceDeck([song(1960), song(1970), song(1980)]), new Set(['s1960']))
    expect(deck.remaining().map((s) => s.year)).toEqual([1970, 1980, 1960])
    expect(drawAll(deck)).toEqual([1970, 1980, 1960])
  })
})

describe('LookupDeck', () => {
  it('looks up a card as it passes through and fills in its year once known', async () => {
    const lookUp = vi.fn((s: Song) => Promise.resolve(s.year === 2001 ? 1980 : null))
    const deck = new LookupDeck(new SourceDeck([song(2001), song(1990)]), lookUp)
    const drawn = deck.draw()!
    expect(drawn.yearSource).toBeUndefined() // not in yet; drawing never waits
    expect(await deck.yearFor(drawn)).toBe(1980)
    expect(deck.refresh(drawn)).toMatchObject({ year: 1980, yearSource: 'musicbrainz' })
    expect(lookUp).toHaveBeenCalledTimes(1) // only songs that passed through
  })
})

describe('BufferDeck', () => {
  it('pulls a few cards ahead, so their lookups start early', async () => {
    const lookUp = vi.fn((s: Song) => Promise.resolve(s.year - 1))
    const lookup = new LookupDeck(new SourceDeck([1960, 1970, 1980, 1990, 2000].map((y) => song(y))), lookUp)
    const deck = new BufferDeck(lookup, 3)
    expect(lookUp.mock.calls.map(([s]) => s.year)).toEqual([1960, 1970, 1980])
    await flush()
    expect(deck.draw()).toMatchObject({ year: 1959, yearSource: 'musicbrainz' })
    expect(lookUp).toHaveBeenCalledTimes(4) // topped up by one
    expect(deck.remaining().map((s) => s.year)).toEqual([1969, 1979, 1990, 2000])
  })
})

describe('AvoidDoubleYearsDeck', () => {
  it('holds back blocked years and deals them once they are allowed', () => {
    let blocked = new Set([1980])
    const deck = new AvoidDoubleYearsDeck(new SourceDeck([song(1980), song(1990), song(2000)]), () => blocked)
    expect(deck.draw()!.year).toBe(1990)
    expect(deck.remaining().map((s) => s.year)).toEqual([1980, 2000])
    blocked = new Set()
    expect(deck.draw()!.year).toBe(1980)
  })

  it('deals blocked cards anyway when nothing else is left', () => {
    const deck = new AvoidDoubleYearsDeck(new SourceDeck([song(1980)]), () => new Set([1980]))
    expect(drawAll(deck)).toEqual([1980])
  })

  it('holds a card that was put back', () => {
    const deck = new AvoidDoubleYearsDeck(new SourceDeck([song(1990)]), () => new Set([1980]))
    deck.putBack(song(1980))
    expect(drawAll(deck)).toEqual([1990, 1980])
  })
})

describe('playingDeck', () => {
  it('passes over a song whose real year clashes before it ever plays', async () => {
    // Spotify says 2001 (a remaster); MusicBrainz says 1980, which is blocked.
    const real: Record<number, number> = { 2001: 1980 }
    const lookUp = vi.fn((s: Song) => Promise.resolve(real[s.year] ?? s.year))
    const { deck } = playingDeck([song(2001), song(1999), song(1990), song(1970), song(1960)], {
      lookUp,
      blockedYears: () => new Set([1980]),
    })
    expect(lookUp).toHaveBeenCalledTimes(3) // only a few ahead
    await flush()
    expect(deck.draw()).toMatchObject({ year: 1999, yearSource: 'musicbrainz' })
    expect(deck.remaining().map((s) => [s.id, s.year])).toEqual([
      ['s2001', 1980],
      ['s1990', 1990],
      ['s1970', 1970],
      ['s1960', 1960],
    ])
  })
})
