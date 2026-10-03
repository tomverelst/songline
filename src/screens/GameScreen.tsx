import { useState } from 'react'
import type { GameState, Song, TurnResult } from '../game/types'
import { drawSong, endTurn, finish, isValidYear, reveal, score, skipSong, slotForYear, slotLabel } from '../game/logic'
import { describePlaybackError, pause, playSong, resume, SpotifyError } from '../spotify/api'
import { Timeline } from '../components/Timeline'
import { DevicePicker } from '../components/DevicePicker'
import { YearInput } from '../components/YearInput'
import { KEYS, load, save } from '../storage'

interface Props {
  game: GameState
  onChange: (game: GameState) => void
  onQuit: () => void
}

export function GameScreen({ game, onChange, onQuit }: Props) {
  const [deviceId, setDeviceId] = useState<string | null>(() => load(KEYS.device, null))
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const player = game.players[game.currentPlayer]
  const turn = game.turn

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

  function lockIn() {
    window.scrollTo(0, 0)
    onChange(reveal(game))
  }

  function nextTurn() {
    if (playing) pause(deviceId ?? undefined).catch(() => {})
    setPlaying(false)
    window.scrollTo(0, 0)
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

  return (
    <div className="screen game">
      <header className="topbar">
        <div className="scoreboard">
          {game.players.map((p, i) => (
            <div key={p.id} className={`chip ${i === game.currentPlayer ? 'active' : ''}`}>
              <span className="chip-name">{p.name}</span>
              <span className="chip-score">
                {score(p)}
                <span className="muted">/{game.settings.targetPoints}</span>
              </span>
            </div>
          ))}
        </div>
        <button className="icon-btn" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          ☰
        </button>
      </header>

      {!turn && (
        <>
          <section className="turn-intro">
            <p className="muted">Round {game.round}</p>
            <h1>{player.name}</h1>
            <p className="muted">It's your turn — grab the phone!</p>
          </section>
          <section className="card stack-sm">
            <h2>Your timeline</h2>
            <Timeline timeline={player.timeline} />
            {player.bonus > 0 && <p className="muted small">+{player.bonus} bonus points</p>}
          </section>
          <p className="muted small center">{game.deck.length} songs left in the deck</p>
          <div className="bottom-bar">
            <button className="btn primary block" onClick={startTurn}>
              ▶ Play mystery song
            </button>
          </div>
        </>
      )}

      {turn?.phase === 'guess' && (
        <>
          <section className="now-playing">
            <div className={`vinyl ${playing ? 'spinning' : ''}`} aria-hidden>
              <div className="vinyl-label">?</div>
            </div>
            <div className="stack-sm grow">
              <div className="muted small">{player.name} is guessing</div>
              <div className="row">
                <button className="btn small" onClick={togglePause}>
                  {playing ? '❚❚ Pause' : '▶ Play'}
                </button>
                <button className="btn small ghost" onClick={() => play(turn.song.uri)}>
                  ↺ Restart
                </button>
              </div>
            </div>
          </section>

          <section className="card stack-sm">
            <h2>What year is this song?</h2>
            <YearInput value={turn.yearGuess} startYear={medianYear(player.timeline)} onChange={setYearGuess} />
            <p className="guess-slot">
              {guessSlot ? slotLabel(guessSlot) : 'Type a year or use the buttons'}
            </p>
          </section>

          <section className="card stack-sm">
            <h2>{player.name}'s cards</h2>
            <Timeline
              timeline={player.timeline}
              selected={guessSlot}
              selectedLabel={guessSlot ? `🎵 ${turn.yearGuess}` : undefined}
            />
          </section>

          <div className="bottom-bar">
            <button className="btn primary block" disabled={!guessSlot} onClick={lockIn}>
              {guessSlot ? `Lock in ${turn.yearGuess}` : 'Enter a year'}
            </button>
          </div>
        </>
      )}

      {turn?.phase === 'reveal' && turn.result && (
        <>
          <section className={`reveal ${turn.result.placementCorrect ? 'correct' : 'wrong'}`}>
            {turn.song.albumArt ? (
              <img className="album-art" src={turn.song.albumArt} alt="" />
            ) : (
              <div className="album-art placeholder-art">♪</div>
            )}
            <div className="reveal-year">{turn.song.year}</div>
            <div className="reveal-title">{turn.song.title}</div>
            <div className="muted">{turn.song.artists.join(', ')}</div>
            <div className="verdict">
              {turn.result.placementCorrect
                ? `✓ You said ${turn.yearGuess} — the card is yours!`
                : `✗ You said ${turn.yearGuess} — no card this time`}
            </div>
          </section>

          <section className="card stack-sm">
            <h2>Bonus points</h2>
            <p className="muted small">Did {player.name} name it? +1 point each.</p>
            <BonusToggle
              label="Title"
              answer={turn.song.title}
              value={turn.result.titleCorrect}
              onChange={(titleCorrect) => updateResult({ titleCorrect })}
            />
            <BonusToggle
              label="Artist"
              answer={turn.song.artists.join(', ')}
              value={turn.result.artistCorrect}
              onChange={(artistCorrect) => updateResult({ artistCorrect })}
            />
          </section>

          <section className="card stack-sm">
            <h2>{player.name}'s timeline</h2>
            <Timeline
              timeline={player.timeline}
              selected={turn.slot}
              selectedLabel={`🎵 ${turn.yearGuess}`}
              verdict={turn.result.placementCorrect ? 'correct' : 'wrong'}
            />
          </section>

          <div className="bottom-bar">
            <button className="btn primary block" onClick={nextTurn}>
              Continue
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="toast" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet stack" onClick={(e) => e.stopPropagation()}>
            <div className="row between">
              <h2>Game menu</h2>
              <button className="icon-btn" aria-label="Close" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>
            <p className="muted small">
              Playlist: {game.settings.playlistName} · {game.deck.length} songs left
            </p>
            <DevicePicker
              deviceId={deviceId}
              onChange={(id) => {
                setDeviceId(id)
                save(KEYS.device, id)
              }}
            />
            {turn?.phase === 'guess' && (
              <button
                className="btn"
                onClick={() => {
                  setMenuOpen(false)
                  skip()
                }}
              >
                ⏭ Skip this song (wrong year / unplayable)
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                if (confirm('End the game now? The highest score wins.')) {
                  pause(deviceId ?? undefined).catch(() => {})
                  onChange(finish(game))
                }
              }}
            >
              🏁 End game now
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Quit without a winner?')) {
                  pause(deviceId ?? undefined).catch(() => {})
                  onQuit()
                }
              }}
            >
              Quit to setup
            </button>
          </div>
        </div>
      )}
    </div>
  )
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
}: {
  label: string
  answer: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button className={`bonus-toggle ${value ? 'on' : ''}`} aria-pressed={value} onClick={() => onChange(!value)}>
      <span className="bonus-check">{value ? '✓' : ''}</span>
      <span className="grow stack-xs">
        <span className="muted small">{label}</span>
        <span className="option-title">{answer}</span>
      </span>
      <span className="bonus-mark">{value ? '+1' : '+0'}</span>
    </button>
  )
}
