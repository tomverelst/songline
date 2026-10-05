import { MAX_YEAR, MIN_YEAR } from '../game/logic'
import { cx } from './classes'

interface Props {
  value: number | undefined
  /** Where the +/- buttons start counting from when nothing is entered yet. */
  startYear: number
  /** One row (−10 −1 [year] +1 +10), to leave room for the card views below. */
  compact?: boolean
  onChange: (year: number | undefined) => void
}

export function YearInput({ value, startYear, onChange, compact }: Props) {
  const step = (delta: number) => {
    const base = value ?? startYear
    onChange(Math.min(MAX_YEAR, Math.max(MIN_YEAR, base + delta)))
  }

  const field = (
    <input
      className={cx(
        'w-full min-w-0 rounded-2xl border-2 border-line bg-bg text-center leading-[1.1] font-black text-ink tabular-nums caret-accent placeholder:text-line focus:border-accent focus:outline-none',
        compact ? 'text-[clamp(1.9rem,9vw,2.6rem)]' : 'py-1 text-[clamp(4rem,26vw,6.5rem)] tracking-[0.06em]',
      )}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      placeholder="????"
      aria-label="Year"
      value={value ?? ''}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
        onChange(digits ? Number(digits) : undefined)
      }}
    />
  )
  const stepButton = (delta: number) => (
    <button
      key={delta}
      className={cx(
        'touch-manipulation rounded-[14px] border border-line bg-surface-2 font-extrabold tabular-nums active:bg-line',
        compact ? 'min-h-14 text-base' : 'min-h-14 text-xl',
      )}
      onClick={() => step(delta)}
    >
      {delta > 0 ? `+${delta}` : `−${-delta}`}
    </button>
  )

  if (compact) {
    return (
      <div className="grid grid-cols-[3rem_2.75rem_1fr_2.75rem_3rem] items-stretch gap-1.5">
        {stepButton(-10)}
        {stepButton(-1)}
        {field}
        {stepButton(1)}
        {stepButton(10)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {field}
      <div className="grid grid-cols-4 gap-2">{[-10, -1, 1, 10].map(stepButton)}</div>
    </div>
  )
}
