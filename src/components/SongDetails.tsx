import { useEffect, useRef, useState, type ReactNode } from 'react'
import { OpenSong, useOpenSong } from './openSong'
import type { Song } from '../game/types'
import { LikeButton } from './LikeButton'
import { Artwork, IconButton } from './ui'


/** Lets the cards inside open a sheet about their song (see HoldToOpen). */
export function SongDetailsProvider({ playlistId, children }: { playlistId: string; children: ReactNode }) {
  const [song, setSong] = useState<Song | null>(null)
  return (
    <OpenSong value={setSong}>
      {children}
      {song && <SongSheet song={song} playlistId={playlistId} onClose={() => setSong(null)} />}
    </OpenSong>
  )
}

const HOLD_MS = 450
const HOLD_SLOP = 8

/**
 * Press and hold on a card to open its song. A tap still does whatever the
 * card does; a hold doesn't, and neither does a scroll.
 */
export function HoldToOpen({ song, children }: { song: Song; children: ReactNode }) {
  const open = useOpenSong()
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null)
  const opened = useRef(false)
  useEffect(() => () => clearTimeout(hold.current?.timer), [])
  if (!open) return children

  const cancel = () => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
  }
  return (
    <div
      className="absolute inset-0 [-webkit-touch-callout:none]"
      onPointerDown={(e) => {
        cancel()
        opened.current = false
        hold.current = {
          x: e.clientX,
          y: e.clientY,
          timer: window.setTimeout(() => {
            hold.current = null
            opened.current = true
            navigator.vibrate?.(15)
            open(song)
          }, HOLD_MS),
        }
      }}
      onPointerMove={(e) => {
        const h = hold.current
        if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP) cancel()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      // The tap that ends a hold isn't a tap on the card.
      onClickCapture={(e) => {
        if (!opened.current) return
        opened.current = false
        e.stopPropagation()
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}

function SongSheet({ song, playlistId, onClose }: { song: Song; playlistId: string; onClose: () => void }) {
  return (
    <div className="@container fixed inset-0 z-[35] flex items-end bg-black/60 text-left" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[90%] w-full max-w-[560px] animate-slide-up flex-col gap-4 overflow-y-auto rounded-t-[20px] bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+20px)] @min-[36rem]:flex-row @min-[36rem]:items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Artwork
          src={song.albumArt}
          className="aspect-square w-full max-w-64 self-center rounded-xl text-6xl shadow-[0_12px_32px_rgb(0_0_0/0.5)] @min-[36rem]:w-44"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[2.6rem] leading-none font-black tabular-nums">{song.year}</span>
              <span className="mt-1 text-xl font-bold [overflow-wrap:anywhere]">{song.title}</span>
              <span className="text-muted">{song.artists.join(', ')}</span>
              <span className="mt-1 -ml-1.5 self-start">
                <LikeButton song={song} playlistId={playlistId} />
              </span>
            </div>
            <IconButton aria-label="Close" onClick={onClose}>
              ✕
            </IconButton>
          </div>
          <a
            href={`https://open.spotify.com/track/${song.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface-2 px-4 font-bold text-ink no-underline"
          >
            Open in Spotify ↗
          </a>
        </div>
      </div>
    </div>
  )
}
