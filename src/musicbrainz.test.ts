import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanTitle, earliestYear, matchingRecordings, originalYear } from './musicbrainz'
import { setTurnSongYear, withOriginalYear } from './game/logic'
import type { GameState, Song } from './game/types'

const remaster: Song = {
  id: 'x',
  uri: 'spotify:track:x',
  title: 'Bohemian Rhapsody - Remastered 2011',
  artists: ['Queen'],
  year: 2011,
  spotifyYear: 2011,
  isrc: 'GBUM71029604',
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('parsing', () => {
  it('takes the earliest of first-release dates and release dates', () => {
    expect(
      earliestYear([
        { 'first-release-date': '1981-10-26', releases: [{ date: '1975-10-31' }, { date: '' }] },
        { 'first-release-date': '2011' },
      ]),
    ).toBe(1975)
    expect(earliestYear([{ releases: [{}] }])).toBeNull()
  })

  it('strips remaster and featuring suffixes from titles', () => {
    expect(cleanTitle('Bohemian Rhapsody - Remastered 2011')).toBe('Bohemian Rhapsody')
    expect(cleanTitle('Empire State of Mind (feat. Alicia Keys)')).toBe('Empire State of Mind')
  })

  it('ignores covers and other songs in search results', () => {
    const hits = matchingRecordings(
      [
        { title: 'Bohemian Rhapsody', score: 100, 'artist-credit': [{ artist: { name: 'Queen' } }] },
        { title: 'Bohemian Rhapsody', score: 100, 'artist-credit': [{ artist: { name: 'Panic! at the Disco' } }] },
        { title: 'Bohemian Rhapsody (live)', score: 95, 'artist-credit': [{ name: 'Queen' }] },
        { title: 'Killer Queen', score: 85, 'artist-credit': [{ name: 'Queen' }] },
      ],
      remaster,
    )
    expect(hits).toHaveLength(2)
  })
})

describe('originalYear', () => {
  it('uses the ISRC lookup', async () => {
    const fetch = vi.fn(() => json({ recordings: [{ 'first-release-date': '1975-10-31' }] }))
    vi.stubGlobal('fetch', fetch)
    expect(await originalYear(remaster)).toBe(1975)
    expect(String(fetch.mock.calls[0])).toContain('/isrc/GBUM71029604')
  })

  it('falls back to a text search when the ISRC is unknown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 200 })
    const fetch = vi
      .fn()
      .mockReturnValueOnce(json({ error: 'Not Found' }, 404))
      .mockReturnValueOnce(
        json({
          recordings: [
            { title: 'Bohemian Rhapsody', score: 100, 'first-release-date': '1975', 'artist-credit': [{ name: 'Queen' }] },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetch)
    expect(await originalYear(remaster)).toBe(1975)
    expect(String(fetch.mock.calls[1])).toContain('/recording?query=')
  })

  it('returns null when MusicBrainz is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await originalYear({ ...remaster, isrc: undefined })).toBeNull()
  })

  it('rejects a year later than the Spotify album', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ recordings: [{ 'first-release-date': '2015' }] })))
    expect(await originalYear(remaster)).toBeNull()
  })
})

describe('applying the year to the game', () => {
  const state = {
    turn: { song: remaster, phase: 'guess' },
  } as GameState

  it('replaces the year when MusicBrainz knows it', () => {
    const song = setTurnSongYear(state, 'x', 1975).turn!.song
    expect(song).toMatchObject({ year: 1975, spotifyYear: 2011, yearSource: 'musicbrainz' })
  })

  it('keeps the Spotify year when the lookup failed', () => {
    expect(withOriginalYear(remaster, null)).toMatchObject({ year: 2011, yearSource: 'spotify' })
  })

  it('ignores late answers for a song that is no longer being guessed', () => {
    const revealed = { turn: { ...state.turn!, phase: 'reveal' } } as GameState
    expect(setTurnSongYear(revealed, 'x', 1975)).toBe(revealed)
    expect(setTurnSongYear(state, 'other', 1975)).toBe(state)
  })
})
