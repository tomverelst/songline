import { KEYS, load, save } from './storage'

// Songs that came up in earlier games on this device, so new games can play
// fresh ones first. Stored as Spotify track IDs, oldest first.

const MAX_REMEMBERED = 5000

export function playedSongIds(): Set<string> {
  return new Set(load<string[]>(KEYS.playedSongs, []))
}

export function rememberSongs(ids: string[]) {
  const played = load<string[]>(KEYS.playedSongs, [])
  const known = new Set(played)
  const added = ids.filter((id) => !known.has(id))
  if (added.length) save(KEYS.playedSongs, [...played, ...added].slice(-MAX_REMEMBERED))
}

export function forgetPlayedSongs() {
  save(KEYS.playedSongs, null)
}
