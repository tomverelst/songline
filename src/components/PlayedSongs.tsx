import { useEffect, useRef, useState } from 'react'
import type { GameState, PlayedSong } from '../game/types'
import { describePlaybackError, pause, playSong } from '../spotify/api'
import { KEYS, load } from '../storage'
import { LikeButton } from './LikeButton'
import { Artwork, Card, CardTitle, IconButton, Muted, Toast } from './ui'
import { cx } from './classes'

type Filter = 'missed' | 'all'

/**
 * Every song that came up this game, to listen to again and save: the ones
 * nobody got first, or all of them.
 */
export function PlayedSongs({ game }: { game: GameState }) {
  const played = game.played ?? []
  const missed = played.filter((p) => p.winners.length === 0)
  const [filter, setFilter] = useState<Filter>(missed.length ? 'missed' : 'all')
  const [playingUri, setPlayingUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deviceId = load<string | null>(KEYS.device, null) ?? undefined

  // Stop the music this list started when leaving the results.
  const startedMusic = useRef(false)
  useEffect(
    () => () => {
      if (startedMusic.current) pause(deviceId).catch(() => {})
    },
    [deviceId],
  )

  if (!played.length) return null
  const shown = filter === 'missed' ? missed : played
  const names = new Map(game.players.map((p) => [p.id, p.name]))

  async function toggle(uri: string) {
    setError(null)
    try {
      if (playingUri === uri) {
        await pause(deviceId)
        setPlayingUri(null)
      } else {
        await playSong(uri, deviceId)
        startedMusic.current = true
        setPlayingUri(uri)
      }
    } catch (e) {
      setError(describePlaybackError(e))
    }
  }

  return (
    <Card className="gap-2">
      <CardTitle>Songs this game</CardTitle>
      <div className="grid grid-cols-2 gap-1.5" role="tablist">
        {(
          [
            ['missed', `Missed (${missed.length})`],
            ['all', `All (${played.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            className={cx(
              'min-h-10 rounded-full border text-sm font-semibold',
              filter === id ? 'border-accent bg-accent/12' : 'border-line bg-bg text-muted',
            )}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Muted>Not a single song missed. Respect.</Muted>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {shown.map((p) => (
            <PlayedRow
              key={p.song.id}
              played={p}
              winnerNames={p.winners.map((id) => names.get(id) ?? '')}
              playlistId={game.settings.playlistId}
              playing={playingUri === p.song.uri}
              onToggle={() => toggle(p.song.uri)}
            />
          ))}
        </ol>
      )}
      {error && <Toast onDismiss={() => setError(null)}>{error}</Toast>}
    </Card>
  )
}

function PlayedRow({
  played: { song, winners },
  winnerNames,
  playlistId,
  playing,
  onToggle,
}: {
  played: PlayedSong
  winnerNames: string[]
  playlistId: string
  playing: boolean
  onToggle: () => void
}) {
  return (
    <li
      className={cx(
        'flex items-center gap-2.5 rounded-xl border bg-surface-2 p-2',
        playing ? 'border-accent' : 'border-line',
      )}
    >
      <Artwork src={song.albumArt} className="size-12 flex-none rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{song.title}</span>
        <span className="truncate text-sm text-muted">{song.artists.join(', ')}</span>
        <span className="truncate text-xs font-semibold">
          <span className="text-accent-2 tabular-nums">{song.year}</span>
          <span className={winners.length ? 'text-good' : 'text-bad'}>
            {' · '}
            {winners.length ? `✓ ${winnerNames.join(' & ')}` : '✗ Missed'}
          </span>
        </span>
      </div>
      <IconButton aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`} onClick={onToggle}>
        {playing ? '❚❚' : '▶'}
      </IconButton>
      <LikeButton song={song} playlistId={playlistId} iconOnly />
    </li>
  )
}
