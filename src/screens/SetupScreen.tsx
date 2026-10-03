import { Fragment, useEffect, useMemo, useState } from 'react'
import type { GameState } from '../game/types'
import { newGame, withOriginalYear } from '../game/logic'
import { originalYear } from '../musicbrainz'
import { getClientId, isLoggedIn, login, logout, redirectUri, setClientId } from '../spotify/auth'
import {
  getMyPlaylists,
  getPlaylist,
  getPlaylistSongs,
  NOT_YOUR_PLAYLIST,
  parsePlaylistId,
  type PlaylistSummary,
} from '../spotify/api'
import { DevicePicker } from '../components/DevicePicker'
import { KEYS, load, save } from '../storage'

interface SetupDraft {
  names: string[]
  targetPoints: number
  playlist: PlaylistSummary | null
}

const DEFAULT_DRAFT: SetupDraft = { names: ['', ''], targetPoints: 10, playlist: null }

interface Props {
  onStart: (game: GameState) => void
  initialError: string | null
}

export function SetupScreen({ onStart, initialError }: Props) {
  const [draft, setDraft] = useState<SetupDraft>(() => ({ ...DEFAULT_DRAFT, ...load(KEYS.setup, DEFAULT_DRAFT) }))
  const [deviceId, setDeviceId] = useState<string | null>(() => load(KEYS.device, null))
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)
  const [error, setError] = useState<string | null>(initialError)
  const [starting, setStarting] = useState<false | 'songs' | 'years'>(false)

  useEffect(() => save(KEYS.setup, draft), [draft])
  useEffect(() => save(KEYS.device, deviceId), [deviceId])

  const update = (patch: Partial<SetupDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const names = draft.names.map((n) => n.trim()).filter(Boolean)
  const canStart = names.length >= 1 && !!draft.playlist && loggedIn && !starting

  async function start() {
    if (!draft.playlist) return
    setStarting('songs')
    setError(null)
    try {
      const songs = await getPlaylistSongs(draft.playlist.id)
      if (songs.length < names.length + 1) {
        throw new Error(`This playlist only has ${songs.length} usable songs — pick a bigger one.`)
      }
      const game = newGame(
        names,
        { targetPoints: draft.targetPoints, playlistId: draft.playlist.id, playlistName: draft.playlist.name },
        songs,
      )
      setStarting('years')
      onStart(await withOriginalStartingYears(game))
    } catch (e) {
      setError((e as Error).message)
      setStarting(false)
    }
  }

  return (
    <div className="screen">
      <header className="hero">
        <div className="logo">♪</div>
        <h1>Songline</h1>
        <p className="muted">Guess the year. Build your timeline. First to the target wins.</p>
      </header>

      <section className="card stack">
        <h2>Players</h2>
        {draft.names.map((name, i) => (
          <div className="row" key={i}>
            <input
              className="input grow"
              placeholder={`Player ${i + 1}`}
              value={name}
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => update({ names: draft.names.map((n, j) => (j === i ? e.target.value : n)) })}
            />
            {draft.names.length > 1 && (
              <button
                className="icon-btn"
                aria-label={`Remove player ${i + 1}`}
                onClick={() => update({ names: draft.names.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button className="btn ghost" onClick={() => update({ names: [...draft.names, ''] })}>
          + Add player
        </button>
      </section>

      <section className="card stack">
        <h2>Points to win</h2>
        <div className="stepper">
          <button className="icon-btn big" onClick={() => update({ targetPoints: Math.max(2, draft.targetPoints - 1) })}>
            −
          </button>
          <span className="stepper-value">{draft.targetPoints}</span>
          <button className="icon-btn big" onClick={() => update({ targetPoints: Math.min(50, draft.targetPoints + 1) })}>
            +
          </button>
        </div>
        <p className="muted small">
          Every card in your timeline is 1 point (you start with one). The exact year, the title and the artist
          each earn 1 bonus point — up to 4 points per turn.
        </p>
      </section>

      <section className="card stack">
        <h2>Spotify</h2>
        {!loggedIn ? (
          <SpotifyLogin onError={setError} />
        ) : (
          <>
            <PlaylistPicker selected={draft.playlist} onSelect={(playlist) => update({ playlist })} onError={setError} />
            <DevicePicker deviceId={deviceId} onChange={setDeviceId} />
            <button
              className="link small"
              onClick={() => {
                logout()
                setLoggedIn(false)
              }}
            >
              Disconnect Spotify
            </button>
          </>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <div className="bottom-bar">
        <button className="btn primary block" disabled={!canStart} onClick={start}>
          {starting === 'songs' ? 'Shuffling songs…' : starting === 'years' ? 'Checking release years…' : 'Start game'}
        </button>
      </div>
    </div>
  )
}

const STARTING_YEARS_DEADLINE_MS = 10_000

/**
 * Looks up the original year of every starting card. Cards that MusicBrainz
 * can't answer for in time keep their Spotify year.
 */
async function withOriginalStartingYears(game: GameState): Promise<GameState> {
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), STARTING_YEARS_DEADLINE_MS))
  const players = await Promise.all(
    game.players.map(async (p) => {
      const [card] = p.timeline
      const year = await Promise.race([originalYear(card), deadline])
      return { ...p, timeline: [withOriginalYear(card, year)] }
    }),
  )
  return { ...game, players }
}

function SpotifyLogin({ onError }: { onError: (e: string) => void }) {
  const [clientId, setId] = useState(getClientId)
  const [editing, setEditing] = useState(!getClientId())

  if (editing) {
    return (
      <div className="stack-sm">
        <p className="muted small">
          Create an app on the{' '}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            Spotify developer dashboard
          </a>{' '}
          (Web API), add this redirect URI and paste its client ID below:
        </p>
        <code className="code">{redirectUri()}</code>
        <input
          className="input"
          placeholder="Spotify client ID"
          value={clientId}
          autoComplete="off"
          onChange={(e) => setId(e.target.value)}
        />
        <button
          className="btn"
          disabled={!clientId.trim()}
          onClick={() => {
            setClientId(clientId)
            setEditing(false)
          }}
        >
          Save client ID
        </button>
      </div>
    )
  }

  return (
    <div className="stack-sm">
      <button className="btn spotify block" onClick={() => login().catch((e) => onError(e.message))}>
        Connect Spotify
      </button>
      <p className="muted small">Spotify Premium is needed to control playback.</p>
      <button className="link small" onClick={() => setEditing(true)}>
        Change client ID
      </button>
    </div>
  )
}

function PlaylistPicker({
  selected,
  onSelect,
  onError,
}: {
  selected: PlaylistSummary | null
  onSelect: (p: PlaylistSummary) => void
  onError: (e: string) => void
}) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null)
  const [filter, setFilter] = useState('')
  const [link, setLink] = useState('')

  useEffect(() => {
    getMyPlaylists()
      .then(setPlaylists)
      .catch((e) => onError(e.message))
  }, [onError])

  const visible = useMemo(
    () => (playlists ?? []).filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())),
    [playlists, filter],
  )

  async function applyLink() {
    const id = parsePlaylistId(link)
    if (!id) return onError('That does not look like a Spotify playlist link.')
    try {
      const playlist = await getPlaylist(id)
      if (!playlist.readable) return onError(NOT_YOUR_PLAYLIST)
      onSelect(playlist)
      setLink('')
    } catch (e) {
      onError((e as Error).message)
    }
  }

  return (
    <div className="stack-sm">
      {selected && (
        <div className="selected-playlist">
          {selected.image ? <img src={selected.image} alt="" /> : <div className="placeholder-art">♪</div>}
          <div>
            <div className="muted small">Playlist</div>
            <div className="option-title">{selected.name}</div>
          </div>
        </div>
      )}
      <div className="row">
        <input
          className="input grow"
          placeholder="Paste a playlist link…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button className="btn" disabled={!link.trim()} onClick={applyLink}>
          Use
        </button>
      </div>
      {playlists === null ? (
        <p className="muted small">Loading your playlists…</p>
      ) : (
        <>
          {playlists.length > 8 && (
            <input className="input" placeholder="Search your playlists" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          <div className="playlist-list">
            {visible.map((p, i) => (
              <Fragment key={p.id}>
                {!p.readable && (i === 0 || visible[i - 1].readable) && (
                  <p className="muted small list-note">
                    Playlists made by others can't be used — Spotify doesn't share their songs with this game. Copy
                    the songs into a playlist of your own to play them.
                  </p>
                )}
                <button
                  className={`playlist-item ${selected?.id === p.id ? 'selected' : ''}`}
                  disabled={!p.readable}
                  onClick={() => onSelect(p)}
                >
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="placeholder-art">♪</div>}
                  <span className="grow">
                    <span className="option-title">{p.name}</span>
                    {p.readable
                      ? p.trackCount !== undefined && <span className="muted small"> · {p.trackCount} songs</span>
                      : p.owner && <span className="muted small"> · by {p.owner}</span>}
                  </span>
                </button>
              </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
