export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable — the game still works in memory */
  }
}

export const KEYS = {
  game: 'songline.game',
  setup: 'songline.setup',
  device: 'songline.device',
  playedSongs: 'songline.playedSongs',
  celebration: 'songline.celebration',
  /** Players' colours, celebrations and cards, remembered by name (profiles.ts). */
  profiles: 'songline.profiles',
  /** The last finished game counted on the player cards, so a reload doesn't count it again. */
  recordedGame: 'songline.recordedGame',
} as const
