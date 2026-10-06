export interface Song {
  id: string
  uri: string
  title: string
  artists: string[]
  /** The year used in the game: the original release year when known. */
  year: number
  /** Release date of the album the track is on, according to Spotify. */
  spotifyYear: number
  /** Unset until the original release year has been looked up. */
  yearSource?: 'spotify' | 'musicbrainz'
  isrc?: string
  albumArt?: string
}

export interface Player {
  id: string
  name: string
  timeline: Song[]
  /** Bonus coins: exact year, title and artist. */
  bonus: number
}

/**
 * Where a player places the mystery song relative to the distinct years
 * already in their timeline.
 */
export type Slot =
  | { kind: 'before'; year: number }
  | { kind: 'between'; low: number; high: number }
  | { kind: 'after'; year: number }
  | { kind: 'on'; year: number }

export interface TurnResult {
  placementCorrect: boolean
  /** Guessed the exact release year — worth a bonus coin. */
  exactYear: boolean
  titleCorrect: boolean
  artistCorrect: boolean
}

export interface Turn {
  song: Song
  phase: 'guess' | 'reveal'
  yearGuess?: number
  /** Where the guessed year falls in the timeline; set on reveal. */
  slot?: Slot
  result?: TurnResult
}

export type GameMode = 'standard'

export interface GameSettings {
  mode: GameMode
  /** Points needed to win. A point is a card in your timeline. */
  targetPoints: number
  /** Advanced: bonus coins also count as points towards the target. */
  bonusCountsTowardsGoal: boolean
  /** Advanced: start the next mystery song by itself after a few seconds. Unset means on. */
  autoplay?: boolean
  /** Advanced: turn the screen upside down every other turn, for players across the table. */
  flipBetweenTurns?: boolean
  /** Advanced: a phone turned on its side while guessing shows the table view. Unset means on. */
  tableView?: boolean
  playlistId: string
  playlistName: string
}

export interface GameState {
  status: 'playing' | 'finished'
  settings: GameSettings
  players: Player[]
  currentPlayer: number
  round: number
  deck: Song[]
  turn?: Turn
  winnerIds?: string[]
}
