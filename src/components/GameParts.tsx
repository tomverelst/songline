import type { ReactNode } from 'react'
import type { GameState, Player, Song } from '../game/types'
import { finish } from '../game/logic'
import { useYearEditor } from './YearEdit'
import { DevicePicker } from './DevicePicker'
import { Coin } from './Coins'
import { Button, CardTitle, IconButton, Muted, Switch } from './ui'
import { CELEBRATIONS, celebrateCard, celebrationOf, type CelebrationStyle } from '../party'
import { cx } from './classes'
import { canFullscreen, enterFullscreen, exitFullscreen, useFullscreen } from '../fullscreen'

// Pieces of the game screens that every game mode shares.

/** The time left to guess; red in the last seconds, dimmed while paused. */
export function GuessTimer({ ms, running }: { ms: number; running: boolean }) {
  const seconds = Math.ceil(ms / 1000)
  const hurry = seconds <= 5
  return (
    <span
      role="timer"
      aria-label={`${seconds} seconds left`}
      className={cx(
        'flex-none rounded-full border px-2.5 py-0.5 text-sm font-extrabold tabular-nums',
        hurry ? 'border-bad bg-bad/15 text-bad' : 'border-line bg-surface-2',
        hurry && running && 'animate-pulse',
        !running && 'opacity-60',
      )}
    >
      ⏱ {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  )
}

/** The revealed year, which can be looked up and overwritten in place. */
export function RevealYear({ song, exact, onSave }: { song: Song; exact: boolean; onSave: (year: number) => void }) {
  const editor = useYearEditor(song, onSave)
  return (
    <>
      {editor.editing ? (
        <div className="mt-2 w-full">{editor.input}</div>
      ) : (
        <>
          <div className={cx('mt-2 text-[3.5rem] leading-none font-black tabular-nums', exact && 'text-gold')}>
            {song.year}
          </div>
          <YearSource song={song} />
        </>
      )}
      {editor.pills}
    </>
  )
}

export function YearSource({ song }: { song: Song }) {
  // An overwritten year speaks for itself.
  if (song.yearSource === 'manual') return null
  if (song.yearSource === 'musicbrainz') {
    return (
      <Muted>
        Original release (MusicBrainz)
        {song.spotifyYear !== song.year && ` · Spotify album says ${song.spotifyYear}`}
      </Muted>
    )
  }
  return <Muted>Album release date (Spotify) · could be a later reissue</Muted>
}

export function BonusToggle({
  label,
  answer,
  value,
  onChange,
  coin = false,
}: {
  /** Rewards a bonus coin instead of a point. */
  coin?: boolean
  label: string
  answer: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      className={cx(
        'flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left',
        value ? 'border-good bg-good/12' : 'border-line bg-bg',
      )}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <span
        className={cx(
          'grid size-8 flex-none place-items-center rounded-lg border-2 font-black',
          value ? 'border-good bg-good text-[#04130a]' : 'border-line',
        )}
      >
        {value ? '✓' : ''}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-muted">{label}</span>
        <span className="font-semibold">{answer}</span>
      </span>
      <span className={cx('inline-flex flex-none items-center gap-1 font-extrabold', value ? 'text-good' : 'text-muted')}>
        {value ? '+1' : '+0'}
        {coin && <Coin />}
      </span>
    </button>
  )
}

/** The ☰ menu: playback device, full screen, mode-specific `children`, and ways out. */
export function GameMenu({
  game,
  onChange,
  deviceId,
  onDeviceChange,
  onClose,
  onQuit,
  stopMusic,
  children,
}: {
  game: GameState
  onChange: (update: (game: GameState) => GameState) => void
  deviceId: string | null
  onDeviceChange: (id: string | null) => void
  onClose: () => void
  onQuit: () => void
  stopMusic: () => void
  children?: ReactNode
}) {
  const fullscreen = useFullscreen()
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[85%] w-full max-w-[560px] animate-slide-up flex-col gap-3 overflow-y-auto rounded-t-[20px] bg-surface px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Game menu</CardTitle>
          <IconButton aria-label="Close" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <Muted>
          Playlist: {game.settings.playlistName} · {game.deck.length} songs left
        </Muted>
        <DevicePicker deviceId={deviceId} onChange={onDeviceChange} />
        {canFullscreen() ? (
          <Switch
            title="Full screen"
            description="Hides the address bar."
            checked={fullscreen}
            onChange={(on) => (on ? enterFullscreen() : exitFullscreen())}
          />
        ) : (
          <Muted>To hide the address bar, add Songline to your Home Screen (Share → Add to Home Screen) and play from there.</Muted>
        )}
        <Switch
          title="No double years"
          description="Never play a song from a year that’s already in the timeline of whoever is guessing."
          checked={!!game.settings.noDoubleYears}
          onChange={(noDoubleYears) => onChange((g) => ({ ...g, settings: { ...g.settings, noDoubleYears } }))}
        />
        {children}
        <PlayerCelebrations
          players={game.players}
          onChange={(index, celebration) =>
            onChange((g) => ({ ...g, players: g.players.map((p, i) => (i === index ? { ...p, celebration } : p)) }))
          }
        />
        {/* Pull-to-refresh can't reach the turned game screen; the game is saved, so this is safe. */}
        <Button onClick={() => window.location.reload()}>↻ Reload</Button>
        <Button
          onClick={() => {
            if (confirm('End the game now? The highest score wins.')) {
              stopMusic()
              onChange(finish)
            }
          }}
        >
          🏁 End game now
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm('Quit without a winner?')) {
              stopMusic()
              onQuit()
            }
          }}
        >
          Quit to setup
        </Button>
      </div>
    </div>
  )
}

/** A point to tick on the reveal, as a compact pill: ✓ Title 🪙 */
export function PointChip({
  label,
  value,
  onChange,
  coin,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  /** Rewards a bonus coin instead of a card. */
  coin?: boolean
}) {
  return (
    <button
      aria-pressed={value}
      className={cx(
        'flex h-12 min-w-0 items-center gap-2 rounded-full border px-3 text-sm font-bold',
        value ? 'border-good bg-good/15' : 'border-line bg-surface-2 text-muted',
      )}
      onClick={() => onChange(!value)}
    >
      <span
        className={cx(
          'grid size-6 flex-none place-items-center rounded-full border-2 text-xs font-black',
          value ? 'border-good bg-good text-[#04130a]' : 'border-line',
        )}
      >
        {value ? '✓' : ''}
      </span>
      <span className="truncate">{label}</span>
      {coin ? <Coin /> : <span className={value ? 'text-good' : ''}>+1</span>}
    </button>
  )
}

/**
 * A button that shows a player's celebration and switches to the next one
 * when tapped, showing it off.
 */
export function CelebrationButton({
  value,
  onChange,
  className,
}: {
  value: CelebrationStyle
  onChange: (style: CelebrationStyle) => void
  className?: string
}) {
  const current = CELEBRATIONS.find((c) => c.id === value) ?? CELEBRATIONS[0]
  return (
    <IconButton
      aria-label={`Celebration: ${current.name}. Tap to change.`}
      title={current.name}
      className={className}
      onClick={() => {
        const next = CELEBRATIONS[(CELEBRATIONS.indexOf(current) + 1) % CELEBRATIONS.length]
        onChange(next.id)
        celebrateCard(next.id)
      }}
    >
      {current.emoji}
    </IconButton>
  )
}

/** Every player's celebration, to change mid-game. Picking one shows it. */
export function PlayerCelebrations({ players, onChange }: { players: Player[]; onChange: (index: number, style: CelebrationStyle) => void }) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <span className="font-semibold">Celebrations</span>
      {players.map((p, index) => (
        <div key={p.id} className="grid grid-cols-3 gap-1.5">
          <span className="col-span-3 truncate font-semibold">{p.name}</span>
          {CELEBRATIONS.map((c) => (
            <button
              key={c.id}
              aria-pressed={celebrationOf(p) === c.id}
              className={cx(
                'flex min-h-10 items-center justify-center gap-1 rounded-full border px-2 text-sm font-semibold',
                celebrationOf(p) === c.id ? 'border-accent bg-accent/12' : 'border-line bg-bg text-muted',
              )}
              onClick={() => {
                onChange(index, c.id)
                celebrateCard(c.id)
              }}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
