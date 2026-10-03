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
    <div className="year-input">
      <input
        className="year-field"
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
      <div className="year-steps">
        {[-10, -1, 1, 10].map((delta) => (
          <button key={delta} className="year-step" onClick={() => step(delta)}>
            {delta > 0 ? `+${delta}` : `−${-delta}`}
          </button>
        ))}
      </div>
    </div>
  )
}
