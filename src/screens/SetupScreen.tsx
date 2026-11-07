import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { GameMode, GameState } from '../game/types'
import { newGame, shuffle, withOriginalYear, yearsInRange } from '../game/logic'
import { inYearRange } from '../game/deck'
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
import { BATTLE_PLAYERS } from '../game/battle'
import { Coin } from '../components/Coins'
import { CelebrationButton, ColorButton } from '../components/PlayerButtons'
import { freeColor, teamColorById } from '../game/teams'
import { DEFAULT_EMOJI, defaultCelebration, type Celebration, type CelebrationStyle } from '../party'
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
import { enterFullscreen } from '../fullscreen'

interface SetupDraft {
  names: string[]
  /** Each player's celebration, by the same index as `names`. */
  celebrations: (CelebrationStyle | null)[]
  /** Each player's emoji for emoji rain, by the same index as `names`. */
  emojis: (string | null)[]
  /** Each player's team colour id, by the same index as `names`. */
  colors: (string | null)[]
  mode: GameMode
  targetPoints: number
  bonusCountsTowardsGoal: boolean
  autoplay: boolean
  flipBetweenTurns: boolean
  tableView: boolean
  swipeCards: boolean
  /** Seconds to guess; 0 means no limit. */
  guessTimeLimit: number
  randomStart: boolean
  noDoubleYears: boolean
  /** First decade to play (e.g. 1960), or null for no limit. */
  decadeFrom: number | null
  /** Last decade to play (e.g. 1980 for up to 1989), or null for no limit. */
  decadeTo: number | null
  spreadDecades: boolean
  /** Battle: the second player's half is upside down. */
  faceToFace: boolean
  avoidPlayedSongs: boolean
  playlist: PlaylistSummary | null
}

const DEFAULT_DRAFT: SetupDraft = {
  names: ['', ''],
  celebrations: [],
  emojis: [],
  colors: [],
  mode: 'standard',
  targetPoints: 10,
  bonusCountsTowardsGoal: false,
  autoplay: true,
  flipBetweenTurns: false,
  tableView: true,
  swipeCards: false,
  guessTimeLimit: 0,
  randomStart: false,
  noDoubleYears: false,
  decadeFrom: null,
  decadeTo: null,
  spreadDecades: false,
  faceToFace: true,
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
  const battle = draft.mode === 'battle'
  // Battle is always two players (or teams); extra names are kept for later.
  const nameFields = battle ? Array.from({ length: BATTLE_PLAYERS }, (_, i) => draft.names[i] ?? '') : draft.names
  const celebrationAt = (i: number): Celebration => ({
    style: draft.celebrations[i] ?? defaultCelebration(),
    emoji: draft.emojis[i] ?? DEFAULT_EMOJI,
  })
  // A player's colour: the one they picked, or else the next one nobody picked.
  const picked = nameFields.map((_, i) => teamColorById(draft.colors[i])?.id ?? null)
  const colorAt = (i: number) =>
    teamColorById(picked[i]) ?? freeColor(i, picked.filter((_, j) => j !== i))
  const othersColors = (i: number) => nameFields.flatMap((_, j) => (j === i ? [] : [colorAt(j).id]))
  // Players are the filled-in names, each with the celebration picked next to it.
  const entries = nameFields
    .map((name, i) => ({ name: name.trim(), ...celebrationAt(i), color: colorAt(i).id }))
    .filter((e) => e.name)
  const names = entries.map((e) => e.name)
  const enoughPlayers = battle ? names.length === BATTLE_PLAYERS : names.length >= 1
  const canStart = enoughPlayers && !!draft.playlist && loggedIn && !loading

  // Each start gets an id; cancelling bumps it so late results are ignored.
  const run = useRef(0)
  const skipYears = useRef<() => void>(() => {})

  const yearRange =
    draft.decadeFrom === null && draft.decadeTo === null
      ? undefined
      : { from: draft.decadeFrom ?? undefined, to: draft.decadeTo === null ? undefined : draft.decadeTo + 9 }
  // With no double years, each card in a timeline is from another year, so
  // (unless coins count too) nobody can get more points than there are years.
  const yearLimited = draft.noDoubleYears && !draft.bonusCountsTowardsGoal
  const maxPoints = Math.min(MAX_POINTS, yearLimited ? yearsInRange(yearRange) : Infinity)
  const targetPoints = Math.min(draft.targetPoints, maxPoints)

  async function start() {
    requestMotionAccess()
    enterFullscreen()
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
      const inRange = songs.filter((s) => inYearRange(s.year, yearRange)).length
      if (inRange < names.length + 1) {
        throw new Error(
          `Only ${inRange} ${inRange === 1 ? 'song' : 'songs'} in this playlist ${inRange === 1 ? 'is' : 'are'} ${decadesLabel(draft.decadeFrom, draft.decadeTo)}. Pick more decades or another playlist.`,
        )
      }
      if (yearLimited) {
        const years = new Set(songs.filter((s) => inYearRange(s.year, yearRange)).map((s) => s.year)).size
        if (years < targetPoints) {
          throw new Error(
            `With no double years, nobody can reach ${targetPoints} points: the songs in this playlist${yearRange ? ` ${decadesLabel(draft.decadeFrom, draft.decadeTo)}` : ''} are from only ${years} different years. Lower the points to win to ${years}, turn off No double years or pick another playlist.`,
          )
        }
      }
      const art = shuffle(songs.flatMap((s) => (s.albumArt ? [s.albumArt] : []))).slice(0, 5)
      setLoading({ phase: 'shuffle', playlistName, songCount: songs.length, art, checks: [] })
      await sleep(SHUFFLE_SHOW_MS)
      if (!alive()) return

      let game = newGame(
        names,
        {
          mode: draft.mode,
          targetPoints,
          bonusCountsTowardsGoal: draft.bonusCountsTowardsGoal,
          autoplay: draft.autoplay,
          flipBetweenTurns: draft.flipBetweenTurns,
          tableView: draft.tableView,
          swipeCards: draft.swipeCards,
          guessTimeLimit: draft.guessTimeLimit,
          randomStart: draft.randomStart,
          noDoubleYears: draft.noDoubleYears,
          ...(yearRange && { yearRange }),
          spreadDecades: draft.spreadDecades,
          ...(battle && { faceToFace: draft.faceToFace }),
          playlistId: draft.playlist.id,
          playlistName,
        },
        songs,
        Math.random,
        draft.avoidPlayedSongs ? playedSongIds() : new Set(),
      )
      game = {
        ...game,
        players: game.players.map((p, i) => ({
          ...p,
          celebration: entries[i].style,
          emoji: entries[i].emoji,
          color: entries[i].color,
        })),
      }
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
        <CardTitle>{battle ? 'Players or teams' : 'Players'}</CardTitle>
        {nameFields.map((name, i) => (
          <div className="flex items-center gap-2" key={i}>
            <TextInput
              placeholder={battle ? `Player or team ${i + 1}` : `Player ${i + 1}`}
              value={name}
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => {
                const next = [...draft.names]
                while (next.length <= i) next.push('')
                next[i] = e.target.value
                update({ names: next })
              }}
            />
            <ColorButton
              value={colorAt(i)}
              taken={othersColors(i)}
              onChange={(color) => {
                const next = [...draft.colors]
                while (next.length <= i) next.push(null)
                next[i] = color
                update({ colors: next })
              }}
            />
            <CelebrationButton
              playerName={name.trim()}
              value={celebrationAt(i)}
              onChange={({ style, emoji }) => {
                const celebrations = [...draft.celebrations]
                const emojis = [...draft.emojis]
                while (celebrations.length <= i) celebrations.push(null)
                while (emojis.length <= i) emojis.push(null)
                celebrations[i] = style
                emojis[i] = emoji
                update({ celebrations, emojis })
              }}
            />
            {!battle && draft.names.length > 1 && (
              <IconButton
                aria-label={`Remove player ${i + 1}`}
                onClick={() =>
                  update({
                    names: draft.names.filter((_, j) => j !== i),
                    celebrations: draft.celebrations.filter((_, j) => j !== i),
                    emojis: draft.emojis.filter((_, j) => j !== i),
                    colors: draft.colors.filter((_, j) => j !== i),
                  })
                }
              >
                ✕
              </IconButton>
            )}
          </div>
        ))}
        {battle ? (
          <Muted>Battle is for two: one player or one team on each side of the phone.</Muted>
        ) : (
          <Button variant="ghost" onClick={() => update({ names: [...draft.names, ''] })}>
            + Add player
          </Button>
        )}
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
          <IconButton big onClick={() => update({ targetPoints: Math.max(2, targetPoints - 1) })}>
            −
          </IconButton>
          <span className="min-w-[2ch] text-center text-[2.5rem] font-extrabold tabular-nums">{targetPoints}</span>
          <IconButton
            big
            className="disabled:opacity-35"
            disabled={targetPoints >= maxPoints}
            onClick={() => update({ targetPoints: Math.min(maxPoints, targetPoints + 1) })}
          >
            +
          </IconButton>
        </div>
        {yearLimited && draft.targetPoints >= maxPoints && maxPoints < MAX_POINTS && (
          <Muted>
            With no double years, there are only {maxPoints} years {yearRange ? decadesLabel(draft.decadeFrom, draft.decadeTo) : 'to play'}, so{' '}
            {maxPoints} points at most.
          </Muted>
        )}
        <Muted>
          Every card in your timeline is 1 point; you start with one. The exact year, the title and the artist each
          earn a bonus coin <Coin />
          {draft.bonusCountsTowardsGoal
            ? ', and coins count as points too.'
            : '. Coins don’t count towards winning, but break a tie if the songs run out.'}
        </Muted>

        <h3 className="mt-1 text-[0.95rem] font-bold">Time to guess</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {TIME_LIMITS.map((seconds) => (
            <OptionButton
              key={seconds}
              className="min-h-11 items-center px-1 text-center font-semibold"
              selected={draft.guessTimeLimit === seconds}
              onClick={() => update({ guessTimeLimit: seconds })}
            >
              {seconds ? `${seconds}s` : 'Off'}
            </OptionButton>
          ))}
        </div>
        <Muted>
          {draft.guessTimeLimit
            ? `The clock runs while the song plays. When it runs out, your guess is locked in as it stands; no guess loses the card.`
            : 'Take as long as you like to guess.'}
        </Muted>
        <Switch
          title="Start somewhere in the song"
          description={`Songs start at a random point past the intro instead of the beginning, with enough song left ${
            draft.guessTimeLimit ? 'for the whole time limit' : 'to listen for a while'
          }.`}
          checked={draft.randomStart}
          onChange={(randomStart) => update({ randomStart })}
        />
        <Switch
          title="No double years"
          description={NO_DOUBLE_YEARS[draft.mode]}
          checked={draft.noDoubleYears}
          onChange={(noDoubleYears) => update({ noDoubleYears })}
        />

        <h3 className="mt-1 text-[0.95rem] font-bold">Decades</h3>
        <div className="grid grid-cols-2 gap-2">
          <DecadeStepper
            label="From"
            value={draft.decadeFrom}
            options={[null, ...DECADES]}
            onChange={(decadeFrom) =>
              update({ decadeFrom, decadeTo: decadeFrom !== null && (draft.decadeTo ?? Infinity) < decadeFrom ? decadeFrom : draft.decadeTo })
            }
          />
          <DecadeStepper
            label="To"
            value={draft.decadeTo}
            options={[...DECADES, null]}
            onChange={(decadeTo) =>
              update({ decadeTo, decadeFrom: decadeTo !== null && (draft.decadeFrom ?? -Infinity) > decadeTo ? decadeTo : draft.decadeFrom })
            }
          />
        </div>
        <Muted>
          {draft.decadeFrom === null && draft.decadeTo === null
            ? 'Songs from any year in the playlist.'
            : `Only songs ${decadesLabel(draft.decadeFrom, draft.decadeTo)}, starting cards included.`}
        </Muted>
        <Switch
          title="Spread the years"
          description="Every decade in the playlist comes up about equally often, instead of mostly the decades the playlist has the most songs from."
          checked={draft.spreadDecades}
          onChange={(spreadDecades) => update({ spreadDecades })}
        />

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
          {battle && (
            <Switch
              title="Face each other"
              description="The top half of the screen is upside down, for players across the table. Off for players side by side."
              checked={draft.faceToFace}
              onChange={(faceToFace) => update({ faceToFace })}
            />
          )}
          {!battle && (
            <Switch
              title="Table view when turned sideways"
              description="Turn the phone on its side while guessing or revealing to lay your cards out in a row and pick the year on a ruler."
              checked={draft.tableView}
              onChange={(tableView) => update({ tableView })}
            />
          )}
          {!battle && draft.tableView && (
            <Switch
              title="Guess card stays in the middle"
              description="In the table view, swipe anywhere on the cards to change the year; they slide past your guess."
              checked={draft.swipeCards}
              onChange={(swipeCards) => update({ swipeCards })}
            />
          )}
          {!battle && (
            <Switch
              title="Flip screen between turns"
              description="Turns the screen upside down every other turn, for players sitting across the table."
              checked={draft.flipBetweenTurns}
              onChange={(flipBetweenTurns) => update({ flipBetweenTurns })}
            />
          )}
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

const TIME_LIMITS = [0, 15, 30, 45, 60]
const MAX_POINTS = 50
/** The decades to choose from, by their first year. */
const DECADES = Array.from({ length: Math.floor(new Date().getFullYear() / 10) - 195 + 1 }, (_, i) => 1950 + i * 10)

/** "from the 1960s to the 1980s", "from the 1960s on", "up to the 1980s". */
function decadesLabel(from: number | null, to: number | null) {
  if (from !== null && to !== null) return from === to ? `from the ${from}s` : `from the ${from}s to the ${to}s`
  if (from !== null) return `from the ${from}s on`
  return `up to the ${to}s`
}

/** − 1960s + : steps through the decades; null is "Any" (no limit on that end). */
function DecadeStepper({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number | null
  options: (number | null)[]
  onChange: (value: number | null) => void
}) {
  const index = Math.max(0, options.indexOf(value))
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-line bg-bg px-1.5 py-2">
      <Muted>{label}</Muted>
      <div className="flex w-full items-center justify-between">
        <IconButton aria-label={`${label}: earlier`} className="disabled:opacity-35" disabled={index === 0} onClick={() => onChange(options[index - 1])}>
          −
        </IconButton>
        <span className="text-base font-extrabold tabular-nums">{value === null ? 'Any' : `${value}s`}</span>
        <IconButton
          aria-label={`${label}: later`}
          className="disabled:opacity-35"
          disabled={index === options.length - 1}
          onClick={() => onChange(options[index + 1])}
        >
          +
        </IconButton>
      </div>
    </div>
  )
}
const NO_DOUBLE_YEARS: Record<GameMode, string> = {
  standard: 'Never play a song from a year that’s already in your timeline.',
  battle: 'Never play a song from a year that’s already in either timeline.',
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
