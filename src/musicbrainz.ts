// Looks up the year a recording was *first* released, using MusicBrainz.
// Spotify only knows the date of the album a track is on, which is wrong for
// remasters and compilations. Everything here is best effort: any failure
// resolves to null and the game keeps the Spotify year.

import type { Song } from './game/types'

const API = 'https://musicbrainz.org/ws/2'
const TIMEOUT_MS = 5000
// MusicBrainz allows ~1 request per second per client.
const MIN_INTERVAL_MS = 1100

interface MbRecording {
  title?: string
  score?: number
  'first-release-date'?: string
  releases?: { date?: string }[]
  'artist-credit'?: { name?: string; artist?: { name?: string } }[]
}

let nextSlot = 0

async function throttle() {
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS
  if (wait) await new Promise((r) => setTimeout(r, wait))
}

async function get<T>(path: string): Promise<T> {
  await throttle()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

function yearOf(date: string | undefined): number | null {
  const year = parseInt(date?.slice(0, 4) ?? '', 10)
  return year >= 1000 ? year : null
}

/** Earliest year across the recordings' first-release dates and releases. */
export function earliestYear(recordings: MbRecording[]): number | null {
  const years = recordings.flatMap((r) => [
    yearOf(r['first-release-date']),
    ...(r.releases ?? []).map((rel) => yearOf(rel.date)),
  ])
  const valid = years.filter((y): y is number => y !== null)
  return valid.length ? Math.min(...valid) : null
}

export function cleanTitle(title: string): string {
  return title
    .replace(/\s+-\s+.*$/, '') // "Song - Remastered 2011"
    .replace(/\s*[([].*?[)\]]/g, '') // "Song (feat. X)", "[Live]"
    .trim()
}

function simplify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Search hits that are really this song by this artist (not covers). */
export function matchingRecordings(recordings: MbRecording[], song: Pick<Song, 'title' | 'artists'>): MbRecording[] {
  const title = simplify(cleanTitle(song.title))
  const artists = song.artists.map(simplify)
  return recordings.filter((r) => {
    if ((r.score ?? 100) < 80) return false
    if (simplify(cleanTitle(r.title ?? '')) !== title) return false
    const credited = (r['artist-credit'] ?? []).map((c) => simplify(c.artist?.name ?? c.name ?? ''))
    return credited.some((c) => artists.includes(c))
  })
}

function escapeQuery(s: string): string {
  return s.replace(/["\\]/g, ' ')
}

async function lookup(song: Song): Promise<number | null> {
  if (song.isrc) {
    try {
      const res = await get<{ recordings?: MbRecording[] }>(
        `/isrc/${encodeURIComponent(song.isrc)}?inc=releases&fmt=json`,
      )
      const year = earliestYear(res.recordings ?? [])
      if (year) return year
    } catch {
      // Unknown ISRC (404) or network trouble — try a text search next.
    }
  }
  const query = `recording:"${escapeQuery(cleanTitle(song.title))}" AND artist:"${escapeQuery(song.artists[0] ?? '')}"`
  const res = await get<{ recordings?: MbRecording[] }>(
    `/recording?query=${encodeURIComponent(query)}&limit=25&fmt=json`,
  )
  return earliestYear(matchingRecordings(res.recordings ?? [], song))
}

/**
 * The original release year, or null when MusicBrainz has no usable answer
 * or can't be reached. A year later than Spotify's album date is ignored:
 * a song can't first come out after an album that contains it.
 */
export async function originalYear(song: Song): Promise<number | null> {
  try {
    const year = await lookup(song)
    if (!year) return null
    return year <= song.spotifyYear ? year : null
  } catch {
    return null
  }
}
