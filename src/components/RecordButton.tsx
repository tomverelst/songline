import { cx } from './classes'

const SIZES = {
  lg: { disc: 'size-16', label: 'size-8 text-sm' },
  md: { disc: 'size-11', label: 'size-6 text-[0.7rem]' },
  sm: { disc: 'size-10', label: 'size-5.5 text-[0.65rem]' },
}

/**
 * The record: it spins while the mystery song plays, and tapping it pauses
 * or plays the song. The play/pause sign in the middle stays upright.
 */
export function RecordButton({
  playing,
  onToggle,
  size,
}: {
  playing: boolean
  onToggle: () => void
  size: keyof typeof SIZES
}) {
  const s = SIZES[size]
  return (
    <button
      aria-label={playing ? 'Pause' : 'Play'}
      onClick={onToggle}
      className={cx(
        'relative grid flex-none place-items-center rounded-full transition-transform active:scale-95',
        s.disc,
        // Paused: a soft pulse round the record says "tap me".
        !playing && 'shadow-[0_0_0_0_rgb(255_93_143/0.6)] motion-safe:animate-[record-ping_1.6s_ease-out_infinite]',
      )}
    >
      <span
        aria-hidden
        className={cx('vinyl-grooves absolute inset-0 rounded-full ring-2 ring-line', playing && 'animate-vinyl')}
      />
      <span
        aria-hidden
        className={cx(
          'relative grid place-items-center rounded-full bg-accent-gradient leading-none font-extrabold text-on-accent',
          s.label,
        )}
      >
        {playing ? '❚❚' : '▶'}
      </span>
    </button>
  )
}
