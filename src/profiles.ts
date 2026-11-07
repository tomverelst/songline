import type { CelebrationStyle } from './game/types'
import { KEYS, load, save } from './storage'

/**
 * What a player made their own, remembered by name on this phone: their
 * colour, celebration (with its emoji or scarf pattern) and painted card.
 * Typing the name again on the setup screen brings it all back.
 */
export interface Profile {
  color?: string
  celebration?: CelebrationStyle
  emoji?: string
  knitPattern?: string
  cardArt?: string
}

interface Stored extends Profile {
  /** The name as last typed (the key is lower case). */
  name: string
  /** Last saved (ms since 1970), to keep the most recent ones. */
  at: number
}

/** Profiles kept at most; the ones not used for longest go first. */
const MAX_PROFILES = 40

/** Names match however they're capitalised or spaced at the ends. */
export function profileKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function all(): Record<string, Stored> {
  const stored = load<Record<string, Stored> | null>(KEYS.profiles, null)
  return stored && typeof stored === 'object' ? stored : {}
}

export function findProfile(name: string): Profile | undefined {
  const key = profileKey(name)
  if (!key) return undefined
  const found = all()[key]
  if (!found) return undefined
  const { color, celebration, emoji, knitPattern, cardArt } = found
  return { color, celebration, emoji, knitPattern, cardArt }
}

/** Remembers what a player has now (unset fields are forgotten). */
export function saveProfile(name: string, profile: Profile, now = Date.now()) {
  const key = profileKey(name)
  if (!key) return
  const profiles = all()
  const clean = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined && v !== null)) as Profile
  profiles[key] = { ...clean, name: name.trim(), at: now }
  const kept = Object.entries(profiles)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, MAX_PROFILES)
  save(KEYS.profiles, Object.fromEntries(kept))
}
