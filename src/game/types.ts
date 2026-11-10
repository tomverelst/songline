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
  /** Where `year` comes from; 'manual' when a player overwrote it. */
  yearSource?: 'spotify' | 'musicbrainz' | 'manual'
  isrc?: string
  albumArt?: string
  /** Length of the track; unset for songs loaded before it was stored. */
  durationMs?: number
}

/** How a player's wins are celebrated. */
export type CelebrationStyle = 'confetti' | 'fireworks' | 'lasers' | 'emoji' | 'bravas' | 'tofu' | 'knitting'

/**
 * A side of the phone lying flat in the middle of the table. 'bottom' is the
 * side with the charging port; the others go clockwise from there, seen from
 * above.
 */
export type Seat = 'bottom' | 'left' | 'top' | 'right'

/**
 * How the screen turns between turns (Standard): not at all, upside down
 * every other turn, or to the side of the table whoever's turn it is sits on.
 */
export type ScreenTurn = 'off' | 'flip' | 'seats'

export interface Player {
  id: string
  name: string
  /** Unset: the phone's default (confetti, unless fireworks were picked before). */
  celebration?: CelebrationStyle
  /** The emoji that rains down with the 'emoji' celebration. */
  emoji?: string
  /** Their own pattern for the 'knitting' celebration (see knitting.ts). */
  knitPattern?: string
  /** Their own painted guess card (a PNG data URL; see CardPainter). */
  cardArt?: string
  /** Team colour (an id from TEAM_COLORS); unset in older games: one by their place. */
  color?: string
  /** Where they sit around the phone, when the screen turns to each player's side. */
  seat?: Seat
  /** With a playlist per player: the playlist their mystery songs come from. */
  playlist?: { id: string; name: string }
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
  /** Where in the song playback starts (and restarts), with a random start. */
  startMs?: number
  /** The guess clock, with a time limit. It only runs while the song plays. */
  clock?: GuessClock
  /** The time limit ran out before the guess was locked in. */
  timedOut?: boolean
  /** Battle mode: every player's guess, by player index. */
  guesses?: BattleGuess[]
}

/** One player's (or team's) guess in a battle turn. */
export interface BattleGuess {
  yearGuess?: number
  /** Locked in; the turn is revealed once every player locked in. */
  locked?: boolean
  /** When it was locked in (ms since 1970): with the same year, the first to lock in gets the card. */
  lockedAt?: number
  /** Right spot, but the other side locked in the same year first, so they get the card. */
  outpaced?: boolean
  /** Where the guessed year falls in this player's timeline; set on reveal. */
  slot?: Slot
  result?: TurnResult
}

export interface GuessClock {
  /** When time runs out, while the clock runs. */
  deadline?: number
  /** Time left while the clock is stopped (song paused or not started yet). */
  leftMs: number
}

export type GameMode = 'standard' | 'battle'

export interface GameSettings {
  mode: GameMode
  /** Points needed to win. A point is a card in your timeline. */
  targetPoints: number
  /** Advanced: bonus coins also count as points towards the target. */
  bonusCountsTowardsGoal: boolean
  /** Advanced: start the next mystery song by itself after a few seconds. Unset means on. */
  autoplay?: boolean
  /** Advanced: how the screen turns between turns. Unset: 'flip' when flipBetweenTurns, else off. */
  screenTurn?: ScreenTurn
  /** Older games: turn the screen upside down every other turn (now screenTurn 'flip'). */
  flipBetweenTurns?: boolean
  /** Advanced: a phone turned on its side while guessing shows the table view. Unset means on. */
  tableView?: boolean
  /** Advanced: in the table view, the guess card stays in the middle and swiping the cards changes the year. */
  swipeCards?: boolean
  /** Seconds to lock in a guess once the song plays. Unset or 0 means no limit. */
  guessTimeLimit?: number
  /** Start each mystery song at a random point, not at the beginning. */
  randomStart?: boolean
  /** Never play a song from a year already in the guessing timeline(s). */
  noDoubleYears?: boolean
  /** Only songs from these years (whole decades, e.g. 1960–1989). Unset ends mean no limit. */
  yearRange?: { from?: number; to?: number }
  /** Every decade in the playlist comes up about equally often. */
  spreadDecades?: boolean
  /** Battle: the second player's half of the screen is upside down. Unset means on. */
  faceToFace?: boolean
  /**
   * Each player (or team) has their own playlist (Player.playlist), and the
   * mystery songs come from the playlist of whoever guesses (Battle: each
   * side's in turn). playlistId and playlistName are then the first player's.
   */
  playlistPerPlayer?: boolean
  playlistId: string
  playlistName: string
}

/** A song that came up and was revealed, with who won it. */
export interface PlayedSong {
  song: Song
  /** Ids of the players who won the card; empty when nobody did. */
  winners: string[]
}

export interface GameState {
  status: 'playing' | 'finished'
  settings: GameSettings
  players: Player[]
  currentPlayer: number
  round: number
  /** The songs still to come, in the order they'll be drawn (empty with a playlist per player). */
  deck: Song[]
  /** With a playlist per player: the songs still to come of each playlist, by playlist id. */
  playlistDecks?: Record<string, Song[]>
  turn?: Turn
  winnerIds?: string[]
  /** Every song revealed this game, in the order they came up. */
  played?: PlayedSong[]
}
