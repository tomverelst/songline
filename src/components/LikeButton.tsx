import { useEffect, useState } from 'react'
import type { Song } from '../game/types'
import {
  addToPlaylist,
  getMyPlaylists,
  isLiked,
  removeFromPlaylist,
  setLiked,
  type PlaylistSummary,
} from '../spotify/api'
import { hasAllScopes, login } from '../spotify/auth'
import { cx } from './classes'
import { Artwork, Button, Spinner } from './ui'

interface Props {
  song: Song
  /** The game's playlist: the song is in it already. */
  playlistId: string
  /** Lies on the corner of album art: a dark backdrop so it reads on any cover. */
  onArt?: boolean
  /** Just the icon, for small spaces. */
  iconOnly?: boolean
  className?: string
}

// Which of your playlists each song is in, as far as this visit knows: the
// game's playlist to begin with, plus whatever you tick here.
const inPlaylists = new Map<string, Set<string>>()
function playlistsWith(uri: string, gamePlaylist: string) {
  if (!inPlaylists.has(uri)) inPlaylists.set(uri, new Set([gamePlaylist]))
  return inPlaylists.get(uri)!
}
let playlistsPromise: Promise<PlaylistSummary[]> | null = null
function myPlaylists() {
  playlistsPromise ??= getMyPlaylists()
    .then((all) => all.filter((p) => p.readable))
    .catch((e) => {
      playlistsPromise = null
      throw e
    })
  return playlistsPromise
}

/**
 * Spotify's ⊕ button: the first tap saves the song to Liked Songs and opens
 * the "Add to playlist" sheet; once liked it shows a green ✓ and opens the
 * sheet straight away.
 */
export function LikeButton({ song, playlistId, onArt, iconOnly, className }: Props) {
  const allowed = hasAllScopes()
  const [liked, setLikedState] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!allowed) return
    let current = true
    isLiked(song.uri)
      .then((l) => current && setLikedState(l))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [song.uri, allowed])

  const tap = () => {
    if (allowed && !liked) {
      setLikedState(true)
      setLiked(song.uri, true).catch(() => setLikedState(false))
    }
    setOpen(true)
  }

  return (
    <>
      <button
        aria-label={liked ? 'Add to playlist' : 'Add to Liked Songs'}
        className={cx(
          'inline-flex h-9 flex-none items-center gap-1.5 rounded-full pl-1.5 text-sm font-semibold whitespace-nowrap transition-transform active:scale-95',
          iconOnly ? 'pr-1.5' : 'pr-3',
          onArt && 'bg-black/70 backdrop-blur-sm',
          liked ? 'text-[#1ed760]' : onArt ? 'text-white' : 'text-muted',
          className,
        )}
        onClick={tap}
      >
        {liked ? <AddedIcon className="animate-pop" /> : <AddIcon />}
        {!iconOnly && (liked ? 'Liked' : 'Add to Liked')}
      </button>
      {open && (
        <AddToPlaylistSheet
          song={song}
          playlistId={playlistId}
          allowed={allowed}
          liked={liked ?? true}
          onLikedChange={setLikedState}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function AddToPlaylistSheet({
  song,
  playlistId,
  allowed,
  liked,
  onLikedChange,
  onClose,
}: {
  song: Song
  playlistId: string
  allowed: boolean
  liked: boolean
  onLikedChange: (liked: boolean) => void
  onClose: () => void
}) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Every tick saves straight away; a failed save puts the tick back.
  const [likedNow, setLikedNow] = useState(liked)
  const [ticked, setTicked] = useState(() => new Set(playlistsWith(song.uri, playlistId)))

  useEffect(() => {
    if (!allowed) return
    myPlaylists()
      .then(setPlaylists)
      .catch((e) => setError((e as Error).message))
  }, [allowed])

  const toggleLiked = () => {
    const on = !likedNow
    setLikedNow(on)
    onLikedChange(on)
    setError(null)
    setLiked(song.uri, on).catch((e) => {
      setLikedNow(!on)
      onLikedChange(!on)
      setError((e as Error).message)
    })
  }

  const toggle = (id: string) => {
    const on = !ticked.has(id)
    const set = (value: boolean) => {
      const where = playlistsWith(song.uri, playlistId)
      if (value) where.add(id)
      else where.delete(id)
      setTicked(new Set(where))
    }
    set(on)
    setError(null)
    ;(on ? addToPlaylist(id, song.uri) : removeFromPlaylist(id, song.uri)).catch((e) => {
      set(!on)
      setError((e as Error).message)
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60 text-left" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[90%] w-full max-w-[560px] animate-slide-up flex-col rounded-t-[20px] bg-surface pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center gap-3 px-4 pb-3">
          <Artwork src={song.albumArt} className="size-12 rounded-md text-xl" />
          <div className="flex min-w-0 flex-col">
            <span className="text-lg font-extrabold">Add to playlist</span>
            <span className="truncate text-sm text-muted">
              {song.title} · {song.artists.join(', ')}
            </span>
          </div>
        </div>

        {!allowed ? (
          <div className="flex flex-col gap-3 px-4 pb-2">
            <p className="text-muted">
              To save songs, Spotify needs you to log in again once. Your game stays where it is.
            </p>
            <Button variant="spotify" block onClick={() => login()}>
              Log in to Spotify again
            </Button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
              <Row
                title="Liked Songs"
                tile={
                  <div className="grid size-12 place-items-center rounded-md bg-linear-135 from-[#450af5] to-[#c4efd9] text-xl text-white">
                    ♥
                  </div>
                }
                checked={likedNow}
                onToggle={toggleLiked}
              />
              <div className="px-2 pt-3 pb-1 text-xs font-bold tracking-wider text-muted uppercase">Your playlists</div>
              {playlists === null && !error && (
                <div className="grid place-items-center py-6">
                  <Spinner />
                </div>
              )}
              {playlists?.map((p) => (
                <Row
                  key={p.id}
                  title={p.name}
                  subtitle={p.trackCount !== undefined ? `${p.trackCount} songs` : undefined}
                  tile={<Artwork src={p.image} className="size-12 rounded-md text-xl" />}
                  checked={ticked.has(p.id)}
                  onToggle={() => toggle(p.id)}
                />
              ))}
            </div>
            {error && <p className="px-4 pt-2 text-sm text-bad">{error}</p>}
            <div className="px-4 pt-3">
              <Button variant="spotify" block onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Row({
  title,
  subtitle,
  tile,
  checked,
  onToggle,
}: {
  title: string
  subtitle?: string
  tile: React.ReactNode
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left active:bg-surface-2"
      onClick={onToggle}
    >
      {tile}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{title}</span>
        {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
      </span>
      {checked ? (
        <AddedIcon className="flex-none" />
      ) : (
        <svg viewBox="0 0 24 24" className="size-6 flex-none text-muted" aria-hidden>
          <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </button>
  )
}

// Spotify's icons: a thin outlined circle with a plus, and a filled green
// circle with a check once the song is saved.
function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.5v9M7.5 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function AddedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-6', className)} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#1ed760" />
      <path d="M7.25 12.25l3.25 3.25 6.25-6.75" fill="none" stroke="#000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
