import { useEffect, useMemo, useState } from 'react'
import type { GameState } from '../game/types'
import { newGame } from '../game/logic'
import { getClientId, isLoggedIn, login, logout, redirectUri, setClientId } from '../spotify/auth'
import { getMyPlaylists, getPlaylist, getPlaylistSongs, parsePlaylistId, type PlaylistSummary } from '../spotify/api'
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
  const [starting, setStarting] = useState(false)

  useEffect(() => save(KEYS.setup, draft), [draft])
  useEffect(() => save(KEYS.device, deviceId), [deviceId])

  const update = (patch: Partial<SetupDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const names = draft.names.map((n) => n.trim()).filter(Boolean)
  const canStart = names.length >= 1 && !!draft.playlist && loggedIn && !starting

  async function start() {
    if (!draft.playlist) return
    setStarting(true)
    setError(null)
    try {
      const songs = await getPlaylistSongs(draft.playlist.id)
      if (songs.length < names.length + 1) {
        throw new Error(`This playlist only has ${songs.length} usable songs — pick a bigger one.`)
      }
      onStart(
        newGame(names, { targetPoints: draft.targetPoints, playlistId: draft.playlist.id, playlistName: draft.playlist.name }, songs),
      )
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
          Every card in your timeline is 1 point (you start with one). Naming the title or artist correctly earns 1 bonus
          point each.
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
          {starting ? 'Shuffling songs…' : 'Start game'}
        </button>
      </div>
    </div>
  )
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
      onSelect(await getPlaylist(id))
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
            {visible.map((p) => (
              <button
                key={p.id}
                className={`playlist-item ${selected?.id === p.id ? 'selected' : ''}`}
                onClick={() => onSelect(p)}
              >
                {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="placeholder-art">♪</div>}
                <span className="grow">
                  <span className="option-title">{p.name}</span>
                  {p.trackCount !== undefined && <span className="muted small"> · {p.trackCount} songs</span>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
