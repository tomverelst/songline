import { MAX_YEAR, MIN_YEAR } from '../game/logic'

interface Props {
  value: number | undefined
  /** Where the +/- buttons start counting from when nothing is entered yet. */
  startYear: number
  onChange: (year: number | undefined) => void
}

export function YearInput({ value, startYear, onChange }: Props) {
  const step = (delta: number) => {
    const base = value ?? startYear
    onChange(Math.min(MAX_YEAR, Math.max(MIN_YEAR, base + delta)))
  }

  return (
    <div className="flex flex-col gap-2.5">
      <input
        className="w-full rounded-2xl border-2 border-line bg-bg py-1 text-center text-[clamp(4rem,26vw,6.5rem)] leading-[1.1] font-black tracking-[0.06em] text-ink tabular-nums caret-accent placeholder:text-line focus:border-accent focus:outline-none"
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
      <div className="grid grid-cols-4 gap-2">
        {[-10, -1, 1, 10].map((delta) => (
          <button
            key={delta}
            className="min-h-14 touch-manipulation rounded-[14px] border border-line bg-surface-2 text-xl font-extrabold tabular-nums active:bg-line"
            onClick={() => step(delta)}
          >
            {delta > 0 ? `+${delta}` : `−${-delta}`}
          </button>
        ))}
      </div>
    </div>
  )
}
