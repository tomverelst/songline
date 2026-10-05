import { MAX_YEAR, MIN_YEAR } from '../game/logic'

interface Props {
  value: number | undefined
  /** Where the +/- buttons start counting from when nothing is entered yet. */
  startYear: number
  onChange: (year: number | undefined) => void
}

/** The guess: −10 −1 [year] +1 +10 in one row. */
export function YearInput({ value, startYear, onChange }: Props) {
  const step = (delta: number) => {
    const base = value ?? startYear
    onChange(Math.min(MAX_YEAR, Math.max(MIN_YEAR, base + delta)))
  }

  const field = (
    <input
      className="w-full min-w-0 rounded-2xl border-2 border-line bg-bg text-center text-[clamp(1.9rem,9vw,2.6rem)] leading-[1.1] font-black text-ink tabular-nums caret-accent placeholder:text-line focus:border-accent focus:outline-none"
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
      className="min-h-14 touch-manipulation rounded-[14px] border border-line bg-surface-2 text-base font-extrabold tabular-nums active:bg-line"
      onClick={() => step(delta)}
    >
      {delta > 0 ? `+${delta}` : `−${-delta}`}
    </button>
  )

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
