import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../game/types'
import { drawSong, setTurnSongYear, skipSong, startClock, stopClock, timeLeftMs, timeLimitMs } from '../game/logic'
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
  const yearLookups = useRef(new Map<string, Promise<void>>())
  const turn = game.turn

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

  // Look up the original release year while the song is playing.
  const songToCheck = turn?.phase === 'guess' && !turn.song.yearSource ? turn.song : null
  useEffect(() => {
    if (!songToCheck || yearLookups.current.has(songToCheck.id)) return
    const id = songToCheck.id
    yearLookups.current.set(
      id,
      originalYear(songToCheck).then((year) => onChange((g) => setTurnSongYear(g, id, year))),
    )
  }, [songToCheck, onChange])

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

  function startTurn() {
    const next = drawSong(game)
    onChange(next)
    if (next.turn) play(next.turn.song.uri, next.turn.startMs)
  }

  function skip() {
    const next = skipSong(game)
    onChange(next)
    if (next.turn) play(next.turn.song.uri, next.turn.startMs)
  }

  /** Reveals the turn, waiting a moment for the original year if it's still being looked up. */
  async function lockIn(timedOut = false) {
    const pending = turn && !turn.song.yearSource ? yearLookups.current.get(turn.song.id) : undefined
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
const AUTOPLAY_MS = 2500
