import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { GameMode, GameState } from '../game/types'
import { newGame, shuffle, withOriginalYear } from '../game/logic'
import { LoadingScreen, type LoadingState, type StartingCardCheck } from './LoadingScreen'
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
  Toast,
} from '../components/ui'
import { cx } from '../components/classes'
import { requestMotionAccess } from '../motion'

interface SetupDraft {
  names: string[]
  mode: GameMode
  targetPoints: number
  bonusCountsTowardsGoal: boolean
  autoplay: boolean
  flipBetweenTurns: boolean
  tableView: boolean
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
  tableView: true,
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
  const [loading, setLoading] = useState<LoadingState | null>(null)
  const [rememberedCount, setRememberedCount] = useState(() => playedSongIds().size)

  useEffect(() => save(KEYS.setup, draft), [draft])
  useEffect(() => save(KEYS.device, deviceId), [deviceId])

  const update = (patch: Partial<SetupDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const names = draft.names.map((n) => n.trim()).filter(Boolean)
  const canStart = names.length >= 1 && !!draft.playlist && loggedIn && !loading

  // Each start gets an id; cancelling bumps it so late results are ignored.
  const run = useRef(0)
  const skipYears = useRef<() => void>(() => {})

  async function start() {
    requestMotionAccess()
    if (!draft.playlist) return
    const id = ++run.current
    const alive = () => run.current === id
    const playlistName = draft.playlist.name
    setError(null)
    setLoading({ phase: 'playlist', playlistName, art: [], checks: [] })
    try {
      const songs = await getPlaylistSongs(draft.playlist.id)
      if (!alive()) return
      if (songs.length < names.length + 1) {
        throw new Error(`This playlist only has ${songs.length} usable songs — pick a bigger one.`)
      }
      const art = shuffle(songs.flatMap((s) => (s.albumArt ? [s.albumArt] : []))).slice(0, 5)
      setLoading({ phase: 'shuffle', playlistName, songCount: songs.length, art, checks: [] })
      await sleep(SHUFFLE_SHOW_MS)
      if (!alive()) return

      let game = newGame(
        names,
        {
          mode: draft.mode,
          targetPoints: draft.targetPoints,
          bonusCountsTowardsGoal: draft.bonusCountsTowardsGoal,
          autoplay: draft.autoplay,
          flipBetweenTurns: draft.flipBetweenTurns,
          tableView: draft.tableView,
          playlistId: draft.playlist.id,
          playlistName,
        },
        songs,
        Math.random,
        draft.avoidPlayedSongs ? playedSongIds() : new Set(),
      )
      const checks: StartingCardCheck[] = game.players.map((p) => ({
        player: p.name,
        title: p.timeline[0].title,
        artist: p.timeline[0].artists.join(', '),
      }))
      setLoading({ phase: 'years', playlistName, songCount: songs.length, art, checks })

      // Look up every starting card's original year, giving up on cards that
      // take too long or when the players tap "Start anyway".
      const giveUp = Promise.race([
        sleep(STARTING_YEARS_DEADLINE_MS),
        new Promise<void>((resolve) => (skipYears.current = resolve)),
      ]).then(() => null)
      const players = await Promise.all(
        game.players.map(async (p, i) => {
          const card = withOriginalYear(p.timeline[0], await Promise.race([originalYear(p.timeline[0]), giveUp]))
          if (alive()) {
            checks[i] = { ...checks[i], year: card.year, fromMusicBrainz: card.yearSource === 'musicbrainz' }
            setLoading((l) => l && { ...l, checks: [...checks] })
          }
          return { ...p, timeline: [card] }
        }),
      )
      if (!alive()) return
      game = { ...game, players }

      setLoading((l) => l && { ...l, phase: 'ready' })
      await sleep(READY_SHOW_MS)
      if (!alive()) return
      rememberSongs(game.players.map((p) => p.timeline[0].id))
      onStart(game)
    } catch (e) {
      if (!alive()) return
      setLoading(null)
      setError((e as Error).message)
    }
  }

  function cancel() {
    run.current++
    setLoading(null)
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
            description="Start the next mystery song by itself 2.5 seconds after showing whose turn it is."
            checked={draft.autoplay}
            onChange={(autoplay) => update({ autoplay })}
          />
          <Switch
            title="Table view when turned sideways"
            description="Turn the phone on its side while guessing to lay your cards out in a row and pick the year on a ruler."
            checked={draft.tableView}
            onChange={(tableView) => update({ tableView })}
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

      {error && <Toast onDismiss={() => setError(null)}>{error}</Toast>}

      {loading && <LoadingScreen state={loading} onCancel={cancel} onSkipYears={() => skipYears.current()} />}

      <BottomBar>
        <Button variant="primary" block disabled={!canStart} onClick={start}>
          Start game
        </Button>
      </BottomBar>
    </Screen>
  )
}

const STARTING_YEARS_DEADLINE_MS = 10_000
/** Let the shuffle animation play for a moment even when loading is quick. */
const SHUFFLE_SHOW_MS = 1400
const READY_SHOW_MS = 700

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

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
