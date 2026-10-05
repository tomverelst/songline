import { useEffect, useState, type CSSProperties } from 'react'
import { Artwork, Button, IconButton, Spinner } from '../components/ui'
import { cx } from '../components/classes'

export type LoadingPhase = 'playlist' | 'shuffle' | 'years' | 'ready'

export interface StartingCardCheck {
  player: string
  title: string
  artist: string
  /** Set once the year check finished. */
  year?: number
  fromMusicBrainz?: boolean
}

export interface LoadingState {
  phase: LoadingPhase
  playlistName: string
  songCount?: number
  /** Album art to riffle through while shuffling. */
  art: string[]
  checks: StartingCardCheck[]
}

/** How long before the "taking a while" options show up. */
const SLOW_AFTER_MS = 6000

const PHASES: LoadingPhase[] = ['playlist', 'shuffle', 'years', 'ready']

interface Props {
  state: LoadingState
  onCancel: () => void
  /** Start straight away with Spotify's years for cards still being checked. */
  onSkipYears: () => void
}

export function LoadingScreen({ state, onCancel, onSkipYears }: Props) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  const step = PHASES.indexOf(state.phase)
  const checked = state.checks.filter((c) => c.year !== undefined).length
  const headline = {
    playlist: `Loading ${state.playlistName}…`,
    shuffle: `Shuffling ${state.songCount ?? ''} songs…`,
    years: 'Checking release years…',
    ready: "Let's go!",
  }[state.phase]

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="flex justify-end">
        <IconButton aria-label="Cancel" onClick={onCancel}>
          ✕
        </IconButton>
      </div>

      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center justify-center gap-5">
        <CardStack art={state.art} shuffling={state.phase !== 'ready'} />

        <h1 className="text-accent-gradient text-center text-2xl font-black">{headline}</h1>

        <ol className="flex w-full flex-col gap-2">
          <StepRow label="Loading the playlist" state={stepState(0, step)} />
          <StepRow
            label={state.songCount ? `Shuffling ${state.songCount} songs` : 'Shuffling the songs'}
            state={stepState(1, step)}
          />
          <StepRow
            label={
              state.checks.length
                ? `Checking release years (${checked}/${state.checks.length})`
                : 'Checking release years'
            }
            state={stepState(2, step)}
          />
        </ol>

        {state.checks.length > 0 && (
          <ul className="flex w-full flex-col gap-1.5">
            {state.checks.map((c) => (
              <li
                key={c.player}
                className="flex animate-pop items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs text-muted">{c.player}'s first card</span>
                  <span className="truncate text-sm font-semibold">
                    {c.title} <span className="font-normal text-muted">· {c.artist}</span>
                  </span>
                </span>
                {c.year === undefined ? (
                  <Spinner />
                ) : (
                  <span className="flex-none text-right">
                    <span className="block font-extrabold text-accent-2 tabular-nums">{c.year}</span>
                    <span className="block text-[0.65rem] text-muted">{c.fromMusicBrainz ? 'original' : 'Spotify'}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {slow && state.phase !== 'ready' && (
        <div className="mx-auto flex w-full max-w-[420px] animate-slide-up flex-col gap-2 pt-4">
          <p className="text-center text-sm text-muted">Taking a while?</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            {state.phase === 'years' && (
              <Button variant="primary" size="md" className="flex-1" onClick={onSkipYears}>
                Start anyway
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function stepState(index: number, current: number): 'done' | 'active' | 'todo' {
  return index < current ? 'done' : index === current ? 'active' : 'todo'
}

function StepRow({ label, state }: { label: string; state: 'done' | 'active' | 'todo' }) {
  return (
    <li className={cx('flex items-center gap-3', state === 'todo' && 'opacity-40')}>
      {state === 'done' ? (
        <span className="grid size-5 flex-none place-items-center rounded-full bg-good text-xs font-black text-[#04130a]">✓</span>
      ) : state === 'active' ? (
        <Spinner className="size-5 border-accent border-t-transparent" />
      ) : (
        <span className="size-5 flex-none rounded-full border-2 border-line" />
      )}
      <span className={cx(state === 'active' && 'font-semibold')}>{label}</span>
    </li>
  )
}

/** A stack of album covers that riffles while shuffling. */
function CardStack({ art, shuffling }: { art: string[]; shuffling: boolean }) {
  const covers = Array.from({ length: 5 }, (_, i) => art[i])
  return (
    <div className="relative h-32 w-24">
      {covers.map((src, i) => (
        <div
          key={i}
          className={cx(
            'absolute inset-0 overflow-hidden rounded-2xl border-2 border-line bg-surface-2 shadow-[0_10px_30px_rgb(0_0_0/0.45)]',
            shuffling && (i % 2 ? 'animate-riffle-right' : 'animate-riffle-left'),
          )}
          style={
            {
              '--tilt': `${(i - 2) * 3}deg`,
              transform: `rotate(${(i - 2) * 3}deg)`,
              animationDelay: `${i * 0.18}s`,
              zIndex: i,
            } as CSSProperties
          }
        >
          {src ? (
            <Artwork src={src} className="size-full" />
          ) : (
            <div className="grid size-full place-items-center bg-accent-gradient text-3xl text-on-accent">♪</div>
          )}
        </div>
      ))}
    </div>
  )
}
