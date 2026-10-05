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
  timelineView: 'songline.timelineView',
} as const
