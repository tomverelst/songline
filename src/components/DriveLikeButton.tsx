import { useEffect, useState } from 'react'
import { isLiked, setLiked } from '../spotify/api'
import { hasAllScopes } from '../spotify/auth'
import { cx } from './classes'

interface Props {
  /** The song to like; none while no song is up. */
  uri?: string
  /** Tells why a like didn't go through. */
  onError: (message: string) => void
}

/**
 * Driver mode's like button: one tap puts the song in Liked Songs, nothing
 * to pick or confirm. A second tap takes it out again, for a tap by mistake.
 */
export function DriveLikeButton({ uri, onError }: Props) {
  const allowed = hasAllScopes()
  const [liked, setLikedState] = useState<{ uri: string; liked: boolean } | null>(null)
  const on = !!uri && liked?.uri === uri && liked.liked

  useEffect(() => {
    if (!uri || !allowed) return
    let current = true
    isLiked(uri)
      .then((l) => current && setLikedState({ uri, liked: l }))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [uri, allowed])

  function tap() {
    if (!uri) return
    if (!allowed) {
      onError('To like songs, Spotify needs you to log in again once: Menu, then "Log in to Spotify again".')
      return
    }
    const want = !on
    setLikedState({ uri, liked: want })
    setLiked(uri, want).catch((e) => {
      setLikedState((s) => (s?.uri === uri ? { uri, liked: !want } : s))
      onError((e as Error).message)
    })
  }

  return (
    <button
      aria-label={on ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      aria-pressed={on}
      disabled={!uri}
      className={cx(
        'grid size-14 flex-none place-items-center rounded-full border transition-transform active:scale-90 disabled:opacity-45 short:size-12',
        on ? 'border-[#1ed760]/50 bg-[#1ed760]/15 text-[#1ed760]' : 'border-line bg-surface-2 text-muted',
      )}
      onClick={tap}
    >
      <svg key={String(on)} viewBox="0 0 24 24" className={cx('size-7 short:size-6', on && 'animate-pop')} aria-hidden>
        <path
          d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"
          fill={on ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
