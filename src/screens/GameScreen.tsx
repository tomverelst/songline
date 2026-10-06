import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { GameState, Song, TurnResult } from '../game/types'
import {
  drawSong,
  endTurn,
  finish,
  isFlipped,
  isValidYear,
  reveal,
  score,
  setTurnSongYear,
  skipSong,
  slotForYear,
} from '../game/logic'
import { originalYear } from '../musicbrainz'
import { rememberSongs } from '../history'
import { celebrateCard, celebrateExact } from '../party'
import { describePlaybackError, pause, playSong, resume, SpotifyError } from '../spotify/api'
import { TimelineCards } from '../components/TimelineCards'
import { TableReveal, TableView } from '../components/TableView'
import { DevicePicker } from '../components/DevicePicker'
import { YearInput } from '../components/YearInput'
import { TimerButton } from '../components/TimerButton'
import { Coin, Coins } from '../components/Coins'
import { KEYS, load, save } from '../storage'
import { Artwork, BottomBar, Button, Card, CardTitle, IconButton, Muted, Screen, Switch, Toast } from '../components/ui'
import { cx } from '../components/classes'
import { ScreenRotation } from '../components/rotation'
import { requestMotionAccess, useDeviceTurn, useScreenAngle } from '../motion'
import { canFullscreen, enterFullscreen, exitFullscreen, useFullscreen } from '../fullscreen'

interface Props {
  game: GameState
  onChange: (update: GameState | ((game: GameState) => GameState)) => void
  onQuit: () => void
}

export function GameScreen({ game, onChange, onQuit }: Props) {
  const [deviceId, setDeviceId] = useState<string | null>(() => load(KEYS.device, null))
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [checkingYear, setCheckingYear] = useState(false)
  const yearLookups = useRef(new Map<string, Promise<void>>())

  const player = game.players[game.currentPlayer]
  const turn = game.turn

  // Party when the answer is revealed (once per song, not on later corrections).
  const celebrated = useRef<string | null>(null)
  const revealedSong = turn?.phase === 'reveal' ? turn.song.id : null
  const wonCard = !!turn?.result?.placementCorrect
  const exactHit = !!turn?.result?.exactYear
  useEffect(() => {
    if (!revealedSong || celebrated.current === revealedSong) return
    celebrated.current = revealedSong
    if (exactHit) celebrateExact()
    else if (wonCard) celebrateCard()
  }, [revealedSong, wonCard, exactHit])

  // Autoplay: start the mystery song by itself a few seconds after the
  // "whose turn" screen appears, unless the menu is open.
  const autoplayActive = !turn && game.settings.autoplay !== false && !menuOpen
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

  async function play(uri: string) {
    setError(null)
    try {
      try {
        await playSong(uri, deviceId ?? undefined)
      } catch (e) {
        // The saved device may have gone to sleep — fall back to the active one.
        if (deviceId && e instanceof SpotifyError && e.status === 404) await playSong(uri)
        else throw e
      }
      setPlaying(true)
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
      setPlaying(!playing)
    } catch (e) {
      setError(describePlaybackError(e))
    }
  }

  function startTurn() {
    const next = drawSong(game)
    onChange(next)
    if (next.turn) play(next.turn.song.uri)
  }

  function skip() {
    const next = skipSong(game)
    onChange(next)
    if (next.turn) play(next.turn.song.uri)
  }

  async function lockIn() {
    const pending = turn && !turn.song.yearSource ? yearLookups.current.get(turn.song.id) : undefined
    if (pending && turn) {
      setCheckingYear(true)
      const timedOut = await Promise.race([
        pending.then(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(true), YEAR_CHECK_WAIT_MS)),
      ])
      // Too slow: settle on the Spotify year rather than keep the table waiting.
      if (timedOut) onChange((g) => setTurnSongYear(g, turn.song.id, null))
      setCheckingYear(false)
    }
    scrollToTop()
    onChange(reveal)
  }

  function nextTurn() {
    if (playing) pause(deviceId ?? undefined).catch(() => {})
    setPlaying(false)
    scrollToTop()
    onChange(endTurn(game))
  }

  const guessSlot = turn?.phase === 'guess' && isValidYear(turn.yearGuess)
    ? slotForYear(player.timeline, turn.yearGuess)
    : undefined

  function setYearGuess(yearGuess: number | undefined) {
    if (turn) onChange({ ...game, turn: { ...turn, yearGuess } })
  }

  function updateResult(patch: Partial<TurnResult>) {
    if (!turn?.result) return
    onChange({ ...game, turn: { ...turn, result: { ...turn.result, ...patch } } })
  }

  const flipEnabled = !!game.settings.flipBetweenTurns
  const fullscreen = useFullscreen()
  const tableViewEnabled = game.settings.tableView !== false
  // The guess and the reveal have a table view for a phone on its side.
  const tablePhase = turn?.phase === 'guess' || turn?.phase === 'reveal'
  // The screen faces whoever holds the phone, going by its motion sensor (this
  // works with the phone's auto-rotate locked too). Lying flat, or without a
  // sensor, it follows the flip setting.
  const deviceTurn = useDeviceTurn(introKey)
  const screenAngle = useScreenAngle()
  const flipAngle = isFlipped(game) ? 180 : 0
  let angle = deviceTurn === null ? flipAngle : (deviceTurn - screenAngle + 360) % 360
  // Only the table view is made for a phone on its side.
  if (angle % 180 !== 0 && !(tablePhase && tableViewEnabled)) angle = flipAngle
  const turned = angle % 180 !== 0
  const landscape = useLandscape()
  const sideways = tablePhase && tableViewEnabled && (turned || landscape)
  const scoreboard = (
    <>
      <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {game.players.map((p, i) => (
          <div
            key={p.id}
            className={cx(
              'flex flex-none flex-col rounded-xl border px-3 py-1.5 text-[0.8rem]',
              i === game.currentPlayer ? 'border-accent bg-accent/15' : 'border-line bg-surface',
            )}
          >
            <span className="max-w-[10ch] truncate">{p.name}</span>
            <span className="inline-flex items-center text-base font-extrabold tabular-nums">
              {score(p, game.settings)}
              <Coins count={p.bonus} />
            </span>
          </div>
        ))}
      </div>
      <IconButton aria-label="Menu" onClick={() => setMenuOpen(true)}>
        ☰
      </IconButton>
    </>
  )
  // The guessing screen's parts, laid out upright or sideways.
  const songControls = turn?.phase === 'guess' && (
    <section className="flex items-center gap-3">
      <div
        className={cx(
          'vinyl-grooves grid size-16 flex-none place-items-center rounded-full ring-2 ring-line',
          playing && 'animate-vinyl',
        )}
        aria-hidden
      >
        <div className="grid size-7 place-items-center rounded-full bg-accent-gradient text-sm font-extrabold text-on-accent">
          ?
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Muted className="truncate">{player.name} is guessing</Muted>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" className="px-3" onClick={togglePause}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </Button>
          <Button size="sm" variant="ghost" className="px-3" onClick={() => play(turn.song.uri)}>
            ↺ Restart
          </Button>
          <Button size="sm" variant="ghost" className="px-3" onClick={skip}>
            ⏭ Skip
          </Button>
        </div>
      </div>
    </section>
  )
  const yearInput = turn?.phase === 'guess' && (
    <YearInput
      value={turn.yearGuess}
      startYear={medianYear(player.timeline)}
      onChange={setYearGuess}
    />
  )
  const hand = turn?.phase === 'guess' && (
    <TimelineCards
      timeline={player.timeline}
      guessYear={guessSlot ? turn.yearGuess : undefined}
      onSelectYear={setYearGuess}
    />
  )
  const lockButton = turn?.phase === 'guess' && (
    <Button variant="primary" block disabled={!guessSlot || checkingYear} onClick={lockIn}>
      {checkingYear ? 'Checking the year…' : guessSlot ? `Lock in ${turn.yearGuess}` : 'Enter a year'}
    </Button>
  )
  const screen = (
    <Screen>
      <header className="sticky top-0 z-[5] -mx-4 -mt-4 flex items-center gap-2 bg-bg p-4">
        {scoreboard}
      </header>

      {!turn && (
        <>
          <section className="flex min-h-[calc(100dvh-260px)] flex-col justify-center gap-3 text-center">
            <p className="text-lg text-muted">Round {game.round}</p>
            <h1 className="text-accent-gradient text-[clamp(3.5rem,18vw,6rem)] leading-none font-bold [overflow-wrap:anywhere]">
              {player.name}
            </h1>
            <p className="text-lg text-muted">It's your turn — grab the phone!</p>
          </section>
          <BottomBar>
            <TimerButton variant="primary" block onClick={startTurn} timerMs={autoplayActive ? AUTOPLAY_MS : undefined}>
              ▶ Play mystery song
            </TimerButton>
          </BottomBar>
        </>
      )}

      {turn?.phase === 'guess' && !sideways && (
        <>
          {songControls}
          <Card className="gap-2">
            {yearInput}
            {hand}
          </Card>
          <BottomBar>{lockButton}</BottomBar>
        </>
      )}

      {turn?.phase === 'reveal' && turn.result && !sideways && (
        <>
          <section
            className={cx(
              'flex animate-pop flex-col items-center gap-1.5 rounded-2xl border-2 bg-surface px-4 py-5 text-center',
              turn.result.exactYear
                ? 'border-gold bg-linear-to-b from-gold/10 to-surface to-55% shadow-[0_0_0_1px_var(--color-gold),0_0_32px_rgb(255_204_51/0.35)]'
                : turn.result.placementCorrect
                  ? 'border-good'
                  : 'border-bad',
            )}
          >
            <Artwork src={turn.song.albumArt} className="size-45 rounded-xl text-5xl shadow-[0_12px_32px_rgb(0_0_0/0.5)]" />
            <div className={cx('mt-2 text-[3.5rem] leading-none font-black tabular-nums', turn.result.exactYear && 'text-gold')}>
              {turn.song.year}
            </div>
            <YearSource song={turn.song} />
            <div className="text-xl font-bold [overflow-wrap:anywhere]">{turn.song.title}</div>
            <div className="text-muted">{turn.song.artists.join(', ')}</div>
          </section>

          <Card className="gap-2">
            <CardTitle>Points</CardTitle>
            <Muted>Tap to change, e.g. if the year looks wrong.</Muted>
            <BonusToggle
              label={`Card (guessed ${turn.yearGuess})`}
              answer={turn.result.placementCorrect ? 'Goes in the timeline' : 'Wrong spot'}
              value={turn.result.placementCorrect}
              onChange={(placementCorrect) => updateResult({ placementCorrect })}
            />
            <BonusToggle
              coin
              label={`Exact year (guessed ${turn.yearGuess})`}
              answer={String(turn.song.year)}
              value={turn.result.exactYear}
              onChange={(exactYear) => updateResult({ exactYear })}
            />
            <BonusToggle
              coin
              label="Title"
              answer={turn.song.title}
              value={turn.result.titleCorrect}
              onChange={(titleCorrect) => updateResult({ titleCorrect })}
            />
            <BonusToggle
              coin
              label="Artist"
              answer={turn.song.artists.join(', ')}
              value={turn.result.artistCorrect}
              onChange={(artistCorrect) => updateResult({ artistCorrect })}
            />
          </Card>

          <Card className="gap-0">
            <CardTitle>{player.name}'s cards</CardTitle>
            <TimelineCards
              timeline={player.timeline}
              guessYear={turn.yearGuess}
              verdict={turn.result.placementCorrect ? 'correct' : 'wrong'}
            />
          </Card>

          <BottomBar>
            <Button variant="primary" block onClick={nextTurn}>
              Continue
            </Button>
          </BottomBar>
        </>
      )}
    </Screen>
  )
  const overlays = (
    <>
      {error && <Toast onDismiss={() => setError(null)}>{error}</Toast>}

      {menuOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setMenuOpen(false)}>
          <div
            className="mx-auto flex max-h-[85%] w-full max-w-[560px] animate-slide-up flex-col gap-3 overflow-y-auto rounded-t-[20px] bg-surface px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Game menu</CardTitle>
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
            {canFullscreen() ? (
              <Switch
                title="Full screen"
                description="Hides the address bar."
                checked={fullscreen}
                onChange={(on) => (on ? enterFullscreen() : exitFullscreen())}
              />
            ) : (
              <Muted>To hide the address bar, add Songline to your Home Screen (Share → Add to Home Screen) and play from there.</Muted>
            )}
            <Switch
              title="Table view when turned sideways"
              description="Turn the phone on its side while guessing or revealing to lay your cards out in a row and pick the year on a ruler."
              checked={tableViewEnabled}
              onChange={(tableView) => {
                if (tableView) requestMotionAccess()
                onChange((g) => ({ ...g, settings: { ...g.settings, tableView } }))
              }}
            />
            {tableViewEnabled && (
              <Switch
                title="Guess card stays in the middle"
                description="In the table view, swipe anywhere on the cards to change the year; they slide past your guess."
                checked={!!game.settings.swipeCards}
                onChange={(swipeCards) => onChange((g) => ({ ...g, settings: { ...g.settings, swipeCards } }))}
              />
            )}
            <Switch
              title="Flip screen between turns"
              description="Upside down every other turn, for players across the table."
              checked={flipEnabled}
              onChange={(flipBetweenTurns) => onChange((g) => ({ ...g, settings: { ...g.settings, flipBetweenTurns } }))}
            />
            <Button
              onClick={() => {
                if (confirm('End the game now? The highest score wins.')) {
                  pause(deviceId ?? undefined).catch(() => {})
                  onChange(finish(game))
                }
              }}
            >
              🏁 End game now
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Quit without a winner?')) {
                  pause(deviceId ?? undefined).catch(() => {})
                  onQuit()
                }
              }}
            >
              Quit to setup
            </Button>
          </div>
        </div>
      )}
    </>
  )

  const content =
    sideways && turn?.phase === 'reveal' && turn.result ? (
      <TableReveal
        scoreboard={scoreboard}
        playerName={player.name}
        timeline={player.timeline}
        yearGuess={turn.yearGuess}
        verdict={turn.result.placementCorrect ? 'correct' : 'wrong'}
        exact={turn.result.exactYear}
        song={turn.song}
        yearSource={<YearSource song={turn.song} />}
        points={[
          { label: 'Card', value: turn.result.placementCorrect, onChange: (placementCorrect) => updateResult({ placementCorrect }) },
          { label: 'Exact year', coin: true, value: turn.result.exactYear, onChange: (exactYear) => updateResult({ exactYear }) },
          { label: 'Title', coin: true, value: turn.result.titleCorrect, onChange: (titleCorrect) => updateResult({ titleCorrect }) },
          { label: 'Artist', coin: true, value: turn.result.artistCorrect, onChange: (artistCorrect) => updateResult({ artistCorrect }) },
        ]}
        onContinue={nextTurn}
      />
    ) : sideways && turn ? (
      <TableView
        scoreboard={scoreboard}
        playerName={player.name}
        timeline={player.timeline}
        yearGuess={turn.yearGuess}
        startYear={medianYear(player.timeline)}
        onSelectYear={setYearGuess}
        playing={playing}
        onTogglePause={togglePause}
        onRestart={() => play(turn.song.uri)}
        onSkip={skip}
        lockLabel={checkingYear ? 'Checking…' : guessSlot ? 'Lock in' : 'Pick a year'}
        lockDisabled={!guessSlot || checkingYear}
        onLock={lockIn}
        swipeCards={!!game.settings.swipeCards}
      />
  ) : (
    screen
  )

  // The game lives in its own full-screen frame so it can be turned as a whole;
  // fixed elements (bottom bar, menu) then stay pinned to the turned frame.
  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <div
        className={cx(
          'absolute top-1/2 left-1/2 bg-bg transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]',
          turned ? 'h-[100dvw] w-[100dvh]' : 'size-full',
        )}
        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
      >
        <ScreenRotation value={angle}>
          <div data-scroller className="h-full overflow-y-auto overscroll-contain">
            {content}
          </div>
          {overlays}
        </ScreenRotation>
      </div>
    </div>
  )
}

/** Whether the phone is held (or the window is) wider than tall. */
function useLandscape() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(orientation: landscape)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(orientation: landscape)').matches,
  )
}

function scrollToTop() {
  window.scrollTo(0, 0)
  document.querySelector('[data-scroller]')?.scrollTo(0, 0)
}

const YEAR_CHECK_WAIT_MS = 4000
const AUTOPLAY_MS = 2500

function YearSource({ song }: { song: Song }) {
  if (song.yearSource === 'musicbrainz') {
    return (
      <Muted>
        Original release (MusicBrainz)
        {song.spotifyYear !== song.year && ` · Spotify album says ${song.spotifyYear}`}
      </Muted>
    )
  }
  return <Muted>Album release date (Spotify) · could be a later reissue</Muted>
}

function medianYear(timeline: Song[]): number {
  const years = timeline.map((s) => s.year).sort((a, b) => a - b)
  return years[Math.floor(years.length / 2)] ?? 2000
}

function BonusToggle({
  label,
  answer,
  value,
  onChange,
  coin = false,
}: {
  /** Rewards a bonus coin instead of a point. */
  coin?: boolean
  label: string
  answer: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      className={cx(
        'flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left',
        value ? 'border-good bg-good/12' : 'border-line bg-bg',
      )}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <span
        className={cx(
          'grid size-8 flex-none place-items-center rounded-lg border-2 font-black',
          value ? 'border-good bg-good text-[#04130a]' : 'border-line',
        )}
      >
        {value ? '✓' : ''}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-muted">{label}</span>
        <span className="font-semibold">{answer}</span>
      </span>
      <span className={cx('inline-flex flex-none items-center gap-1 font-extrabold', value ? 'text-good' : 'text-muted')}>
        {value ? '+1' : '+0'}
        {coin && <Coin />}
      </span>
    </button>
  )
}
