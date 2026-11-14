import type { GameState, Song } from "./types";
import { withOriginalYear } from "./songs";

/**
 * Driver mode: no players and no guesses. Songs play one after another from
 * the deck; when a song ends its year is shown (the turn's 'reveal' phase),
 * and then the next one plays. Each song is a round.
 */

/** What the Spotify player reports, as far as driver mode needs it. */
export interface PlayerSnapshot {
  isPlaying: boolean;
  uri?: string;
  progressMs: number;
  durationMs?: number;
}

/**
 * How the song is getting on, going by what the player reports:
 * - 'waiting': not playing yet (the player can report the song from before
 *   for a moment after a play command),
 * - 'playing' or 'paused',
 * - 'ended': within `END_MS` of its end, stopped at the start after it had
 *   been playing, or something else took over (a skip from the car, or
 *   Spotify's autoplay) or nothing plays at all any more.
 *
 * `started` says whether this song was seen playing before.
 */
export function songProgress(
  snapshot: PlayerSnapshot | null,
  uri: string,
  started: boolean,
): "waiting" | "playing" | "paused" | "ended" {
  if (snapshot?.uri !== uri) return started ? "ended" : "waiting";
  const { isPlaying, progressMs, durationMs } = snapshot;
  if (durationMs && progressMs >= durationMs - END_MS && (started || isPlaying))
    return "ended";
  if (!isPlaying && started && progressMs === 0) return "ended";
  return isPlaying ? "playing" : started ? "paused" : "waiting";
}

/** How close to its end a song counts as over; polls come in about once a second. */
export const END_MS = 1500;

/**
 * The song ended: show its year. `year` is its original year when it was
 * still being looked up (null: none found, so Spotify's year), or undefined
 * when the song already has its year. The song goes in the list of played
 * songs.
 */
export function revealDriveSong(
  state: GameState,
  year?: number | null,
): GameState {
  const turn = state.turn;
  if (!turn || turn.phase !== "guess") return state;
  const song: Song =
    year !== undefined && !turn.song.yearSource
      ? withOriginalYear(turn.song, year)
      : turn.song;
  return {
    ...state,
    turn: { ...turn, song, phase: "reveal" },
    played: [...(state.played ?? []), { song, winners: [] }],
  };
}

/** The number of the song playing (or just played): 1 for the first one. */
export function songNumber(state: GameState): number {
  const played = state.played?.length ?? 0;
  return state.turn?.phase === "reveal" ? played : played + 1;
}

/** What's said out loud when a song ends: the year, then the song. */
export function yearAnnouncement(song: Song): string {
  return `${spokenYear(song.year)}. ${song.title}, by ${song.artists.join(" and ")}.`;
}

/**
 * A year the way people say it, written out in words so every phone voice
 * says it the same: speech engines read 1976 as "one thousand nine hundred
 * seventy-six", so years before 2000 go in two halves: "nineteen
 * seventy-six" (1900 is "nineteen hundred", 1905 "nineteen oh five"). From
 * 2000 on the plain number already sounds right ("two thousand five").
 */
export function spokenYear(year: number): string {
  if (year < 1000 || year >= 2000) return String(year);
  const century = numberWords(Math.floor(year / 100));
  const rest = year % 100;
  if (rest === 0) return `${century} hundred`;
  if (rest < 10) return `${century} oh ${numberWords(rest)}`;
  return `${century} ${numberWords(rest)}`;
}

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** 0 to 99 in words: 76 is "seventy-six". */
function numberWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 ? `${tens}-${ONES[n % 10]}` : tens;
}
