import type { CelebrationStyle } from './game/types'
import { KEYS, load, save } from './storage'

/**
 * The players on this phone: made once on the setup screen (name, colour,
 * celebration with its emoji or scarf pattern, painted card) and picked from
 * there for every game, with how many games they played and won.
 */
export interface Profile {
  color?: string
  celebration?: CelebrationStyle
  emoji?: string
  knitPattern?: string
  cardArt?: string
}

export interface RosterPlayer extends Profile {
  /** The name, as typed; players are found by it whatever the capitals. */
  name: string
  /** When the player was made (ms since 1970): the roster's order. */
  created: number
  games: number
  wins: number
}

interface Stored extends Profile {
  name: string
  /** Last saved; also when it was made, for players from before `created`. */
  at: number
  created?: number
  games?: number
  wins?: number
}

/** Names match however they're capitalised or spaced at the ends. */
export function profileKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function all(): Record<string, Stored> {
  const stored = load<Record<string, Stored> | null>(KEYS.profiles, null)
  return stored && typeof stored === 'object' ? stored : {}
}

function toPlayer(s: Stored): RosterPlayer {
  const { color, celebration, emoji, knitPattern, cardArt } = s
  return { name: s.name, color, celebration, emoji, knitPattern, cardArt, created: s.created ?? s.at, games: s.games ?? 0, wins: s.wins ?? 0 }
}

/** Everyone on this phone, oldest first. */
export function loadRoster(): RosterPlayer[] {
  return Object.values(all())
    .map(toPlayer)
    .sort((a, b) => a.created - b.created)
}

export function findProfile(name: string): RosterPlayer | undefined {
  const found = all()[profileKey(name)]
  return found && toPlayer(found)
}

/**
 * Saves a player's things (unset ones are cleared), keeping their stats.
 * With `previousName`, it's that player renamed.
 */
export function saveProfile(name: string, profile: Profile, now = Date.now(), previousName?: string) {
  const key = profileKey(name)
  if (!key) return
  const profiles = all()
  const before = profiles[profileKey(previousName ?? name)]
  if (previousName !== undefined && profileKey(previousName) !== key) delete profiles[profileKey(previousName)]
  const clean = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined && v !== null)) as Profile
  profiles[key] = {
    ...clean,
    name: name.trim(),
    at: now,
    created: before?.created ?? before?.at ?? now,
    games: before?.games ?? 0,
    wins: before?.wins ?? 0,
  }
  save(KEYS.profiles, profiles)
}

export function deleteProfile(name: string) {
  const profiles = all()
  delete profiles[profileKey(name)]
  save(KEYS.profiles, profiles)
}

/** Counts a finished game for everyone who played it, and a win for its winners. */
export function recordGame(players: string[], winners: string[]) {
  const profiles = all()
  const won = new Set(winners.map(profileKey))
  for (const name of players) {
    const p = profiles[profileKey(name)]
    if (!p) continue
    p.games = (p.games ?? 0) + 1
    if (won.has(profileKey(name))) p.wins = (p.wins ?? 0) + 1
  }
  save(KEYS.profiles, profiles)
}
