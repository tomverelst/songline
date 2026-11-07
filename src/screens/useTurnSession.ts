import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, Song } from '../game/types'
import {
  drawSong,
  isDoubleYear,
  redrawSong,
  setTurnSongYear,
  skipSong,
  startClock,
  stopClock,
  timeLeftMs,
  timeLimitMs,
  upcomingSongs,
  withKnownYears,
} from '../game/logic'
import { originalYear } from '../musicbrainz'
import { rememberSongs } from '../history'
import { describePlaybackError, pause, playSong, resume, SpotifyError } from '../spotify/api'
import { KEYS, load, save } from '../storage'

type OnChange = (update: GameState | ((game: GameState) => GameState)) => void

interface Options {
  game: GameState
  onChange: OnChange
  /** Reveals the turn; `timedOut` when the time limit ran out first. */
  reveal: (game: GameState, timedOut: boolean) => GameState
  /** Hands out the cards and moves on to the next turn. */
  endTurn: (game: GameState) => GameState
  /** Holds autoplay back (e.g. while the menu is open). */
  holdAutoplay: boolean
}

/**
 * Everything a turn does besides showing it, shared by every game mode's
 * screen: playback, autoplay, the original-year lookup, the guess clock and
 * locking in.
 */
export function useTurnSession({ game, onChange, reveal, endTurn, holdAutoplay }: Options) {
  const [deviceId, setDeviceId] = useState<string | null>(() => load(KEYS.device, null))
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingYear, setCheckingYear] = useState(false)
  /** Getting the next song ready: waiting for its original year. */
  const [preparing, setPreparing] = useState(false)
  const turn = game.turn
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  })

  // Original years from MusicBrainz, by song id (null: nothing found, keep
  // Spotify's). Each song is looked up once; the lookups queue up politely.
  const knownYears = useRef(new Map<string, number | null>())
  const lookups = useRef(new Map<string, Promise<number | null>>())
  const lookUp = useCallback((song: Song) => {
    let lookup = lookups.current.get(song.id)
    if (!lookup) {
      lookup = originalYear(song).then((year) => {
        knownYears.current.set(song.id, year)
        return year
      })
      lookups.current.set(song.id, lookup)
    }
    return lookup
  }, [])

  // Autoplay: start the mystery song by itself a few seconds after the
  // "whose turn" screen appears.
  const autoplayActive = !turn && game.settings.autoplay !== false && !holdAutoplay
  const startTurnRef = useRef(startTurn)
  useEffect(() => {
    startTurnRef.current = startTurn
  })
  const introKey = `${game.round}-${game.currentPlayer}`
  useEffect(() => {
    if (!autoplayActive) return
    const timer = setTimeout(() => startTurnRef.current(), AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [autoplayActive, introKey])

  // Remember every song that comes up, so later games can play fresh ones first.
  const drawnSongId = turn?.song.id
  useEffect(() => {
    if (drawnSongId) rememberSongs([drawnSongId])
  }, [drawnSongId])

  // A song drawn before its year came in (e.g. the lookup took too long)
  // gets it while it plays.
  const songToCheck = turn?.phase === 'guess' && !turn.song.yearSource ? turn.song : null
  const watched = useRef(new Set<string>())
  useEffect(() => {
    if (!songToCheck || watched.current.has(songToCheck.id)) return
    const id = songToCheck.id
    watched.current.add(id)
    lookUp(songToCheck).then((year) => onChange((g) => setTurnSongYear(g, id, year)))
  }, [songToCheck, onChange, lookUp])

  // Look ahead: find the original years of the next songs in the deck while
  // this turn is still going, so the next song is ready before it plays.
  const deck = game.deck
  useEffect(() => {
    for (const song of upcomingSongs(deck)) if (!song.yearSource) lookUp(song)
  }, [deck, lookUp])

  async function play(uri: string, positionMs?: number) {
    setError(null)
    try {
      try {
        await playSong(uri, deviceId ?? undefined, positionMs)
      } catch (e) {
        // The saved device may have gone to sleep — fall back to the active one.
        if (deviceId && e instanceof SpotifyError && e.status === 404) await playSong(uri, undefined, positionMs)
        else throw e
      }
      setPlaying(true)
      // The guess clock only runs once the song can be heard.
      onChange((g) => (g.turn?.song.uri === uri ? startClock(g, Date.now()) : g))
    } catch (e) {
      setPlaying(false)
      setError(describePlaybackError(e))
    }
  }

  async function togglePause() {
    setError(null)
    try {
      if (playing) await pause(deviceId ?? undefined)
      else await resume(deviceId ?? undefined)
      onChange((g) => (playing ? stopClock(g, Date.now()) : startClock(g, Date.now())))
      setPlaying(!playing)
    } catch (e) {
      setError(describePlaybackError(e))
    }
  }

  /** Plays the song again from where this turn started it. */
  function restart() {
    if (turn) play(turn.song.uri, turn.startMs)
  }

  /**
   * Draws the next song once the years of the songs it could be are known
   * (waiting a few seconds at most), so it plays with its real year.
   */
  const drawing = useRef(false)
  async function drawNext(draw: (game: GameState) => GameState): Promise<boolean> {
    if (drawing.current) return false
    drawing.current = true
    try {
      const pending = upcomingSongs(gameRef.current.deck)
        .filter((s) => !s.yearSource && !knownYears.current.has(s.id))
        .map(lookUp)
      if (pending.length) {
        setPreparing(true)
        await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, NEXT_SONG_WAIT_MS))])
        setPreparing(false)
      }
      const next = draw(withKnownYears(gameRef.current, knownYears.current))
      onChange(next)
      if (next.turn) play(next.turn.song.uri, next.turn.startMs)
      return true
    } finally {
      drawing.current = false
    }
  }

  function startTurn() {
    drawNext(drawSong)
  }

  function skip() {
    drawNext(skipSong)
  }

  // No double years: a song whose original year turns out to be in the
  // timeline already goes back in the deck, and another one plays.
  const doubleYearSong = isDoubleYear(game) && !checkingYear ? turn?.song.id : undefined
  const redrawRef = useRef(redraw)
  useEffect(() => {
    redrawRef.current = redraw
  })
  useEffect(() => {
    if (doubleYearSong) redrawRef.current()
  }, [doubleYearSong])

  async function redraw() {
    const year = turn?.song.year
    // After play(), which clears old messages as it starts.
    if (await drawNext(redrawSong))
      setError(`That song is from ${year}, a year that's already in the timeline. Here's another one.`)
  }

  /** Reveals the turn, waiting a moment for the original year if it's still being looked up. */
  async function lockIn(timedOut = false) {
    const pending = turn && !turn.song.yearSource ? lookups.current.get(turn.song.id) : undefined
    if (pending && turn) {
      setCheckingYear(true)
      const tooSlow = await Promise.race([
        pending.then(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(true), YEAR_CHECK_WAIT_MS)),
      ])
      // Too slow: settle on the Spotify year rather than keep the table waiting.
      if (tooSlow) onChange((g) => setTurnSongYear(g, turn.song.id, null))
      setCheckingYear(false)
    }
    scrollToTop()
    onChange((g) => reveal(g, timedOut))
  }

  // The time limit: lock in whatever is guessed when the clock runs out.
  const clockRunning = turn?.phase === 'guess' && turn.clock?.deadline !== undefined
  const now = useNow(clockRunning)
  const left = turn?.phase === 'guess' ? timeLeftMs(turn, now) : undefined
  // `now` can lag behind for a tick just after the clock starts.
  const timeLeft = left === undefined ? undefined : Math.min(left, timeLimitMs(game.settings))
  const lockInRef = useRef(lockIn)
  useEffect(() => {
    lockInRef.current = lockIn
  })
  const timeIsUp = timeLeft === 0 && !checkingYear
  useEffect(() => {
    if (timeIsUp) lockInRef.current(true)
  }, [timeIsUp])

  function nextTurn() {
    if (playing) pause(deviceId ?? undefined).catch(() => {})
    setPlaying(false)
    scrollToTop()
    onChange(endTurn(game))
  }

  function changeDevice(id: string | null) {
    setDeviceId(id)
    save(KEYS.device, id)
  }

  /** Stops the music, e.g. when the game ends from the menu. */
  function stopMusic() {
    pause(deviceId ?? undefined).catch(() => {})
  }

  return {
    deviceId,
    changeDevice,
    playing,
    error,
    setError,
    checkingYear,
    preparing,
    autoplayActive,
    autoplayMs: AUTOPLAY_MS,
    introKey,
    startTurn,
    skip,
    restart,
    togglePause,
    lockIn,
    nextTurn,
    stopMusic,
    timeLeft,
    clockRunning,
  }
}

/** The current time, ticking a few times a second while `active`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [active])
  return now
}

export function scrollToTop() {
  window.scrollTo(0, 0)
  document.querySelector('[data-scroller]')?.scrollTo(0, 0)
}

const YEAR_CHECK_WAIT_MS = 4000
/** At most this long to get the next song's year before playing it anyway. */
const NEXT_SONG_WAIT_MS = 4000
const AUTOPLAY_MS = 2500
