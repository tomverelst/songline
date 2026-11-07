import type { Song } from './types'

/**
 * Records the outcome of the original-year lookup for a song. `year` is null
 * when the lookup found nothing, in which case the Spotify year stays.
 */
export function withOriginalYear(song: Song, year: number | null): Song {
  return year === null
    ? { ...song, year: song.spotifyYear ?? song.year, yearSource: 'spotify' }
    : { ...song, year, yearSource: 'musicbrainz' }
}
