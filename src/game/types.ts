export interface Song {
  id: string
  uri: string
  title: string
  artists: string[]
  year: number
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
  titleCorrect: boolean
  artistCorrect: boolean
}

export interface Turn {
  song: Song
  phase: 'guess' | 'reveal'
  slot?: Slot
  titleGuess: string
  artistGuess: string
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
