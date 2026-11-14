import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../game/types'
import { drawSong, setTurnSongYear } from '../game/logic'
import { playingDeck } from '../game/deck'
import { revealDriveSong, songNumber, songProgress, yearAnnouncement } from '../game/drive'
import { rememberSongs } from '../history'
import { describePlaybackError, getPlayerSnapshot, pause, playSong, resume, SpotifyError } from '../spotify/api'
import { KEYS, load, save } from '../storage'
import { say, stopSpeaking, unlockSpeech } from '../speech'
import { useWakeLock } from '../wakeLock'
import { DevicePicker } from '../components/DevicePicker'
import { Artwork, Button, CardTitle, IconButton, Muted, SkipIcon, Switch, Toast } from '../components/ui'
import { cx } from '../components/classes'
import { cachedOriginalYear } from './useTurnSession'

interface Props {
  game: GameState
  onChange: (update: GameState | ((game: GameState) => GameState)) => void
  onQuit: () => void
}

/**
 * Driver mode: songs play one after another; when one ends its year fills
 * the screen (and is said out loud), and a few seconds later the next song
 * starts. Nothing needs a tap, and the screen stays on.
 */
export function DriverScreen({ game, onChange, onQuit }: Props) {
  const [deviceId, setDeviceId] = useState<string | null>(() => load(KEYS.device, null))
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState<{ ms: number; durationMs?: number } | null>(null)
  const [held, setHeld] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** A play command is on its way. */
  const [starting, setStarting] = useState(false)
  /** The song playing now was seen playing, so it can be over. */
  const started = useRef(false)
  const turn = game.turn
  const sayYear = game.settings.sayYear !== false
  const finished = game.status === 'finished'
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  })

  useWakeLock(!finished)

  // The songs as a stream, with original years looked up a few songs ahead.
  const [{ deck, lookup }] = useState(() =>
    playingDeck(game.deck, { lookUp: cachedOriginalYear, blockedYears: () => new Set(), yearRange: game.settings.yearRange }),
  )

  // Remember every song that comes up, so later drives and games play fresh ones first.
  const songId = turn?.song.id
  useEffect(() => {
    if (songId) rememberSongs([songId])
  }, [songId])

  // A song drawn before its year came in gets it while it plays.
  const songToCheck = turn?.phase === 'guess' && !turn.song.yearSource ? turn.song : null
  useEffect(() => {
    if (!songToCheck) return
    const id = songToCheck.id
    lookup.yearFor(songToCheck).then((year) => onChange((g) => setTurnSongYear(g, id, year)))
  }, [songToCheck, lookup, onChange])

  async function play(uri: string) {
    setError(null)
    setProgress(null)
    started.current = false
    setStarting(true)
    try {
      try {
        await playSong(uri, deviceId ?? undefined, 0, false)
      } catch (e) {
        // The saved device may have gone to sleep: fall back to the active one.
        if (deviceId && e instanceof SpotifyError && e.status === 404) await playSong(uri, undefined, 0, false)
        else throw e
      }
      setPlaying(true)
    } catch (e) {
      setPlaying(false)
      setError(describePlaybackError(e))
    } finally {
      setStarting(false)
    }
  }

  /** Draws the next song and plays it. */
  function next() {
    setHeld(false)
    const g = drawSong(gameRef.current, Math.random, deck)
    onChange(g)
    if (g.turn) play(g.turn.song.uri)
    else pause(deviceId ?? undefined).catch(() => {})
  }

  const nextRef = useRef(next)
  useEffect(() => {
    nextRef.current = next
  })

  // A fresh drive starts straight away (Start was just tapped).
  const begun = useRef(false)
  useEffect(() => {
    if (begun.current) return
    begun.current = true
    if (!gameRef.current.turn && gameRef.current.status === 'playing') nextRef.current()
  }, [])

  /** The song is over: show its year, say it and stop anything Spotify plays after it. */
  const revealing = useRef<string | null>(null)
  async function showYear(stopMusic: boolean) {
    const current = gameRef.current.turn
    if (!current || current.phase !== 'guess' || revealing.current === current.song.id) return
    revealing.current = current.song.id
    if (stopMusic) pause(deviceId ?? undefined).catch(() => {})
    setPlaying(false)
    // Still looking up the original year? Wait a moment, then settle for Spotify's.
    const year = current.song.yearSource
      ? undefined
      : await Promise.race([lookup.yearFor(current.song), new Promise<null>((r) => setTimeout(() => r(null), YEAR_WAIT_MS))])
    const shown = revealDriveSong(gameRef.current, year)
    onChange(shown)
    if (gameRef.current.settings.sayYear !== false && shown.turn) say(yearAnnouncement(shown.turn.song))
  }
  const showYearRef = useRef(showYear)
  useEffect(() => {
    showYearRef.current = showYear
  })

  // Follow the player: progress, pauses from the car, and the end of the song.
  const uri = turn?.phase === 'guess' ? turn.song.uri : null
  useEffect(() => {
    if (!uri) return
    let stopped = false
    let ending: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      const snapshot = await getPlayerSnapshot().catch(() => undefined)
      if (stopped || snapshot === undefined || ending) return
      const state = songProgress(snapshot, uri, started.current)
      if (state === 'playing') started.current = true
      if (state === 'playing' || state === 'paused') {
        setPlaying(state === 'playing')
        setProgress({ ms: snapshot!.progressMs, durationMs: snapshot!.durationMs })
      }
      if (state !== 'ended') return
      // Let the last second or so play out, then stop whatever comes after it.
      const left = snapshot?.uri === uri && snapshot.durationMs ? Math.max(0, snapshot.durationMs - snapshot.progressMs) : 0
      ending = setTimeout(() => showYearRef.current(true), left)
    }
    const timer = setInterval(tick, POLL_MS)
    tick()
    return () => {
      stopped = true
      clearInterval(timer)
      clearTimeout(ending)
    }
  }, [uri])

  // After the year has shown for a while, the next song.
  const waiting = turn?.phase === 'reveal' && !held && !menuOpen
  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(() => nextRef.current(), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [waiting, songId])

  async function togglePause() {
    if (!turn) return
    setError(null)
    try {
      if (playing) {
        await pause(deviceId ?? undefined)
        setPlaying(false)
      } else if (started.current) {
        await resume(deviceId ?? undefined)
        setPlaying(true)
      } else {
        await play(turn.song.uri)
      }
    } catch (e) {
      setError(describePlaybackError(e))
    }
  }

  function toggleSayYear() {
    if (sayYear) stopSpeaking()
    else unlockSpeech()
    onChange((g) => ({ ...g, settings: { ...g.settings, sayYear: !sayYear } }))
  }

  function quit() {
    pause(deviceId ?? undefined).catch(() => {})
    onQuit()
  }

  const song = turn?.song
  const revealed = turn?.phase === 'reveal'
  const fraction = progress?.durationMs ? Math.min(1, progress.ms / progress.durationMs) : 0

  return (
    <div className="mx-auto flex h-dvh max-w-[60rem] flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+16px)] short:gap-2 short:pt-[calc(env(safe-area-inset-top)+8px)] short:pb-[calc(env(safe-area-inset-bottom)+8px)]">
      <header className="flex shrink-0 items-center gap-3">
        <span className="text-2xl" aria-hidden>
          🚗
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{game.settings.playlistName}</div>
          <Muted>{finished ? `${game.played?.length ?? 0} songs` : `Song ${songNumber(game)}`}</Muted>
        </div>
        <IconButton aria-label={sayYear ? 'Stop saying the year' : 'Say the year out loud'} onClick={toggleSayYear}>
          {sayYear ? '🔊' : '🔇'}
        </IconButton>
        <IconButton aria-label="Menu" onClick={() => setMenuOpen(true)}>
          ☰
        </IconButton>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden text-center short:gap-2">
        {finished ? (
          <>
            <div className="text-6xl">🏁</div>
            <h1 className="text-3xl font-bold">That was the whole playlist</h1>
            <Muted>{game.played?.length ?? 0} songs. Pick another playlist for the rest of the trip.</Muted>
          </>
        ) : revealed && song ? (
          <>
            <div
              key={song.id}
              className="animate-pop text-accent-gradient leading-[0.9] font-black tabular-nums text-[min(30vw,34dvh)] short:text-[min(26vw,28dvh)] tablet:text-[min(30vw,40dvh)]"
            >
              {song.year}
            </div>
            <div className="flex max-w-full items-center gap-3 text-left">
              <Artwork src={song.albumArt} className="size-16 shrink-0 rounded-lg short:size-11" />
              <div className="min-w-0">
                <div className="truncate text-2xl font-bold short:text-lg">{song.title}</div>
                <div className="truncate text-lg text-muted short:text-sm">{song.artists.join(', ')}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* The record spins; the question mark on it stays upright. A fixed
                square that never shrinks, so it stays round in any window. In a
                short window it sits beside the text instead of above it. */}
            <div className="flex w-full max-w-md items-center justify-center gap-4 short:flex-row flex-col">
              <div
                aria-hidden
                className="relative grid aspect-square size-[clamp(4rem,min(36vw,24dvh),11rem)] shrink-0 place-items-center short:size-[clamp(3rem,22dvh,6rem)]"
              >
                <span className={cx('vinyl-grooves absolute inset-0 rounded-full ring-2 ring-line', playing && 'animate-vinyl')} />
                <span className="relative grid size-1/3 place-items-center rounded-full bg-accent-gradient text-[clamp(1.25rem,min(9vw,6dvh),3.5rem)] font-black text-on-accent short:text-[clamp(1rem,6dvh,1.75rem)]">
                  ?
                </span>
              </div>
              <div className="flex w-full min-w-0 flex-col items-center gap-3 short:items-start short:gap-2">
                <p className="text-2xl font-bold short:text-xl">{playing ? 'Which year?' : starting ? 'Starting the music…' : 'Paused'}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent-gradient transition-[width] duration-1000 ease-linear" style={{ width: `${fraction * 100}%` }} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {revealed && !finished && (
        <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surface-2">
          {waiting && (
            <div
              key={songId}
              className="h-full animate-timer-fill rounded-full bg-accent-gradient"
              style={{ animationDuration: `${REVEAL_MS}ms` }}
            />
          )}
        </div>
      )}

      <footer className={cx('grid shrink-0 gap-3 short:gap-2', !finished && !revealed ? 'grid-cols-[1fr_1fr_1.3fr]' : 'grid-cols-2')}>
        {finished ? (
          <Button variant="primary" className={cx('col-span-2', BIG)} onClick={quit}>
            Done
          </Button>
        ) : revealed ? (
          <>
            <Button className={BIG} onClick={() => setHeld(!held)}>
              {held ? '▶ Keep going' : '❚❚ Wait'}
            </Button>
            <Button variant="primary" className={BIG} onClick={next}>
              Next song <SkipIcon />
            </Button>
          </>
        ) : (
          <>
            <Button className={BIG} disabled={!turn} onClick={togglePause}>
              {playing ? '❚❚ Pause' : '▶ Play'}
            </Button>
            {/* Skip: on to the next song without showing this one's year. */}
            <Button className={BIG} disabled={!turn} onClick={next}>
              Skip <SkipIcon />
            </Button>
            <Button variant="primary" className={BIG} disabled={!turn} onClick={() => showYear(true)}>
              Show year
            </Button>
          </>
        )}
      </footer>

      {error && <Toast onDismiss={() => setError(null)}>{error}</Toast>}

      {menuOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setMenuOpen(false)}>
          <div
            className="mx-auto flex max-h-[85%] w-full max-w-[35rem] animate-slide-up flex-col gap-3 overflow-y-auto rounded-t-[20px] bg-surface px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Driver mode</CardTitle>
              <IconButton aria-label="Close" onClick={() => setMenuOpen(false)}>
                ✕
              </IconButton>
            </div>
            <Muted>
              Playlist: {game.settings.playlistName} · {game.deck.length} songs left
            </Muted>
            <DevicePicker
              deviceId={deviceId}
              onChange={(id) => {
                setDeviceId(id)
                save(KEYS.device, id)
              }}
            />
            <Switch
              title="Say the year out loud"
              description="When a song ends, the phone says its year, title and artist."
              checked={sayYear}
              onChange={toggleSayYear}
            />
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Stop driver mode?')) quit()
              }}
            >
              Stop and go back to setup
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** The footer buttons: big enough to hit while driving, a bit smaller in a short window. */
const BIG = 'min-h-20 text-xl short:min-h-14 short:text-lg'

/** How often the player is asked how the song is getting on. */
const POLL_MS = 1000
/** How long the year shows before the next song starts. */
const REVEAL_MS = 8000
/** How long to wait for a late original year before showing Spotify's. */
const YEAR_WAIT_MS = 4000
