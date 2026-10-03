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
  /** Guessed the exact release year — worth a bonus point. */
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

export interface GameSettings {
  targetPoints: number
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
