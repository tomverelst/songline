import { Fragment, useEffect, useMemo, useState } from 'react'
import type { GameMode, GameState } from '../game/types'
import { newGame, withOriginalYear } from '../game/logic'
import { originalYear } from '../musicbrainz'
import { forgetPlayedSongs, playedSongIds, rememberSongs } from '../history'
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
import { GAME_MODES } from '../game/modes'
import { Coin } from '../components/Coins'
import {
  Artwork,
  BottomBar,
  Button,
  Card,
  CardTitle,
  IconButton,
  LinkButton,
  Logo,
  Muted,
  OptionButton,
  Screen,
  Switch,
  TextInput,
} from '../components/ui'
import { cx } from '../components/classes'

interface SetupDraft {
  names: string[]
  mode: GameMode
  targetPoints: number
  bonusCountsTowardsGoal: boolean
  autoplay: boolean
  flipBetweenTurns: boolean
  avoidPlayedSongs: boolean
  playlist: PlaylistSummary | null
}

const DEFAULT_DRAFT: SetupDraft = {
  names: ['', ''],
  mode: 'standard',
  targetPoints: 10,
  bonusCountsTowardsGoal: false,
  autoplay: true,
  flipBetweenTurns: false,
  avoidPlayedSongs: true,
  playlist: null,
}

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
  const [rememberedCount, setRememberedCount] = useState(() => playedSongIds().size)

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
        {
          mode: draft.mode,
          targetPoints: draft.targetPoints,
          bonusCountsTowardsGoal: draft.bonusCountsTowardsGoal,
          autoplay: draft.autoplay,
          flipBetweenTurns: draft.flipBetweenTurns,
          playlistId: draft.playlist.id,
          playlistName: draft.playlist.name,
        },
        songs,
        Math.random,
        draft.avoidPlayedSongs ? playedSongIds() : new Set(),
      )
      rememberSongs(game.players.map((p) => p.timeline[0].id))
      setStarting('years')
      onStart(await withOriginalStartingYears(game))
    } catch (e) {
      setError((e as Error).message)
      setStarting(false)
    }
  }

  return (
    <Screen>
      <header className="flex flex-col items-center gap-2 pt-4 pb-1 text-center">
        <Logo>♪</Logo>
        <h1 className="text-[2rem] leading-tight font-bold">Songline</h1>
        <p className="text-muted">Guess the year. Build your timeline. First to the target wins.</p>
      </header>

      <Card>
        <CardTitle>Players</CardTitle>
        {draft.names.map((name, i) => (
          <div className="flex items-center gap-2" key={i}>
            <TextInput
              placeholder={`Player ${i + 1}`}
              value={name}
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => update({ names: draft.names.map((n, j) => (j === i ? e.target.value : n)) })}
            />
            {draft.names.length > 1 && (
              <IconButton
                aria-label={`Remove player ${i + 1}`}
                onClick={() => update({ names: draft.names.filter((_, j) => j !== i) })}
              >
                ✕
              </IconButton>
            )}
          </div>
        ))}
        <Button variant="ghost" onClick={() => update({ names: [...draft.names, ''] })}>
          + Add player
        </Button>
      </Card>

      <Card>
        <CardTitle>Game mode</CardTitle>
        <div className="flex flex-col gap-1.5">
          {GAME_MODES.map((m) => (
            <OptionButton key={m.id} selected={draft.mode === m.id} onClick={() => update({ mode: m.id })}>
              <span className="font-semibold">{m.name}</span>
              <span className="text-sm text-muted">{m.description}</span>
            </OptionButton>
          ))}
        </div>

        <h3 className="mt-1 text-[0.95rem] font-bold">Points to win</h3>
        <div className="flex items-center justify-center gap-6">
          <IconButton big onClick={() => update({ targetPoints: Math.max(2, draft.targetPoints - 1) })}>
            −
          </IconButton>
          <span className="min-w-[2ch] text-center text-[2.5rem] font-extrabold tabular-nums">{draft.targetPoints}</span>
          <IconButton big onClick={() => update({ targetPoints: Math.min(50, draft.targetPoints + 1) })}>
            +
          </IconButton>
        </div>
        <Muted>
          Every card in your timeline is 1 point; you start with one. The exact year, the title and the artist each
          earn a bonus coin <Coin />
          {draft.bonusCountsTowardsGoal
            ? ', and coins count as points too.'
            : '. Coins don’t count towards winning, but break a tie if the songs run out.'}
        </Muted>

        <details className="group border-t border-line pt-3">
          <summary className="flex min-h-8 list-none items-center font-semibold text-accent-2 [&::-webkit-details-marker]:hidden">
            <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
            Advanced options
          </summary>
          <Switch
            title="Coins count as points"
            description="Bonus coins also count towards the points to win."
            checked={draft.bonusCountsTowardsGoal}
            onChange={(bonusCountsTowardsGoal) => update({ bonusCountsTowardsGoal })}
          />
          <Switch
            title="Autoplay"
            description="Start the next mystery song by itself 5 seconds after showing whose turn it is."
            checked={draft.autoplay}
            onChange={(autoplay) => update({ autoplay })}
          />
          <Switch
            title="Flip screen between turns"
            description="Turns the screen upside down every other turn, for players sitting across the table."
            checked={draft.flipBetweenTurns}
            onChange={(flipBetweenTurns) => update({ flipBetweenTurns })}
          />
          <Switch
            title="Avoid songs from earlier games"
            description={
              rememberedCount
                ? `Songs you already heard (${rememberedCount} on this phone) only come up once the fresh ones run out.`
                : 'Songs you already heard only come up once the fresh ones run out.'
            }
            checked={draft.avoidPlayedSongs}
            onChange={(avoidPlayedSongs) => update({ avoidPlayedSongs })}
          />
          {rememberedCount > 0 && (
            <LinkButton
              className="mt-2"
              onClick={() => {
                forgetPlayedSongs()
                setRememberedCount(0)
              }}
            >
              Forget played songs
            </LinkButton>
          )}
        </details>
      </Card>

      <Card>
        <CardTitle>Spotify</CardTitle>
        {!loggedIn ? (
          <SpotifyLogin onError={setError} />
        ) : (
          <>
            <PlaylistPicker selected={draft.playlist} onSelect={(playlist) => update({ playlist })} onError={setError} />
            <DevicePicker deviceId={deviceId} onChange={setDeviceId} />
            <LinkButton
              onClick={() => {
                logout()
                setLoggedIn(false)
              }}
            >
              Disconnect Spotify
            </LinkButton>
          </>
        )}
      </Card>

      {error && <p className="text-sm text-bad">{error}</p>}

      <BottomBar>
        <Button variant="primary" block disabled={!canStart} onClick={start}>
          {starting === 'songs' ? 'Shuffling songs…' : starting === 'years' ? 'Checking release years…' : 'Start game'}
        </Button>
      </BottomBar>
    </Screen>
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
      <div className="flex flex-col gap-2">
        <Muted>
          Create an app on the{' '}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            Spotify developer dashboard
          </a>{' '}
          (Web API), add this redirect URI and paste its client ID below:
        </Muted>
        <code className="block rounded-[10px] border border-dashed border-line bg-bg px-3 py-2.5 text-sm break-all select-all">
          {redirectUri()}
        </code>
        <TextInput placeholder="Spotify client ID" value={clientId} autoComplete="off" onChange={(e) => setId(e.target.value)} />
        <Button
          disabled={!clientId.trim()}
          onClick={() => {
            setClientId(clientId)
            setEditing(false)
          }}
        >
          Save client ID
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="spotify" block onClick={() => login().catch((e) => onError(e.message))}>
        Connect Spotify
      </Button>
      <Muted>Spotify Premium is needed to control playback.</Muted>
      <LinkButton onClick={() => setEditing(true)}>Change client ID</LinkButton>
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
    <div className="flex flex-col gap-2">
      {selected && (
        <div className="flex items-center gap-3 rounded-xl bg-linear-135 from-accent/20 to-accent-2/15 p-2.5">
          <Artwork src={selected.image} className="size-14 rounded-md" />
          <div className="min-w-0">
            <Muted>Playlist</Muted>
            <div className="truncate font-semibold">{selected.name}</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <TextInput placeholder="Paste a playlist link…" value={link} onChange={(e) => setLink(e.target.value)} />
        <Button disabled={!link.trim()} onClick={applyLink}>
          Use
        </Button>
      </div>
      {playlists === null ? (
        <Muted>Loading your playlists…</Muted>
      ) : (
        <>
          {playlists.length > 8 && (
            <TextInput placeholder="Search your playlists" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto overscroll-contain">
            {visible.map((p, i) => (
              <Fragment key={p.id}>
                {!p.readable && (i === 0 || visible[i - 1].readable) && (
                  <Muted className="px-0.5 pt-2">
                    Playlists made by others can't be used — Spotify doesn't share their songs with this game. Copy
                    the songs into a playlist of your own to play them.
                  </Muted>
                )}
                <button
                  className={cx(
                    'flex min-h-13 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left disabled:opacity-45',
                    selected?.id === p.id ? 'border-accent bg-accent/12' : 'border-line bg-bg',
                  )}
                  disabled={!p.readable}
                  onClick={() => onSelect(p)}
                >
                  <Artwork src={p.image} className="size-10 rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{p.name}</span>
                    {p.readable
                      ? p.trackCount !== undefined && <span className="text-sm text-muted"> · {p.trackCount} songs</span>
                      : p.owner && <span className="text-sm text-muted"> · by {p.owner}</span>}
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
