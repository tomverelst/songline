import { describe, expect, it } from 'vitest'
import { drawSong, newGame } from './logic'
import { END_MS, revealDriveSong, songNumber, songProgress, yearAnnouncement } from './drive'
import type { GameSettings, Song } from './types'

const song = (year: number, title = `Song ${year}`): Song => ({
  id: `${title}-${year}`,
  uri: `spotify:track:${year}`,
  title,
  artists: ['Artist', 'Friend'],
  year,
  spotifyYear: year,
})

const settings: GameSettings = {
  mode: 'driver',
  targetPoints: 0,
  bonusCountsTowardsGoal: false,
  playlistId: 'pl',
  playlistName: 'Road trip',
}

const URI = 'spotify:track:1984'
const at = (progressMs: number, isPlaying = true, uri = URI) => ({ isPlaying, uri, progressMs, durationMs: 200_000 })

describe('songProgress', () => {
  it('waits while the player still reports the song from before', () => {
    expect(songProgress(at(120_000, true, 'spotify:track:other'), URI, false)).toBe('waiting')
    expect(songProgress(null, URI, false)).toBe('waiting')
  })

  it('follows playing and pausing (e.g. from the car)', () => {
    expect(songProgress(at(5_000), URI, false)).toBe('playing')
    expect(songProgress(at(60_000, false), URI, true)).toBe('paused')
  })

  it('ends near the end of the song', () => {
    expect(songProgress(at(200_000 - END_MS - 1), URI, true)).toBe('playing')
    expect(songProgress(at(200_000 - END_MS), URI, true)).toBe('ended')
  })

  it('ends when it stopped back at the start, or something else plays', () => {
    expect(songProgress(at(0, false), URI, true)).toBe('ended')
    expect(songProgress(at(3_000, true, 'spotify:track:autoplay'), URI, true)).toBe('ended')
    expect(songProgress(null, URI, true)).toBe('ended')
  })

  it("doesn't end a song that hasn't started yet", () => {
    expect(songProgress(at(0, false), URI, false)).toBe('waiting')
  })
})

describe('driver mode', () => {
  const songs = [song(1971), song(1984), song(1999)]

  it('starts with no players and every song in the deck', () => {
    const game = newGame([], settings, songs, () => 0)
    expect(game.players).toEqual([])
    expect(game.deck).toHaveLength(3)
  })

  it('reveals the song, counts it as played and plays on until the deck is empty', () => {
    let game = drawSong(newGame([], settings, songs, () => 0))
    expect(songNumber(game)).toBe(1)
    game = revealDriveSong(game)
    expect(game.turn?.phase).toBe('reveal')
    expect(game.played).toHaveLength(1)
    expect(songNumber(game)).toBe(1)
    game = drawSong(game)
    expect(songNumber(game)).toBe(2)
    game = drawSong(revealDriveSong(game))
    game = drawSong(revealDriveSong(game))
    expect(game.status).toBe('finished')
    expect(game.played).toHaveLength(3)
  })

  it('takes the original year when it came in late', () => {
    const game = drawSong(newGame([], settings, [song(2011)], () => 0))
    const revealed = revealDriveSong(game, 1969)
    expect(revealed.turn?.song.year).toBe(1969)
    expect(revealed.turn?.song.yearSource).toBe('musicbrainz')
    expect(revealDriveSong(game, null).turn?.song.yearSource).toBe('spotify')
  })

  it('reveals only once', () => {
    const game = revealDriveSong(drawSong(newGame([], settings, songs, () => 0)))
    expect(revealDriveSong(game)).toBe(game)
  })

  it('says the year, then the song', () => {
    expect(yearAnnouncement(song(1984, 'Take on Me'))).toBe('1984. Take on Me, by Artist and Friend.')
  })
})
