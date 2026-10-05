import type { Slot, Song } from '../game/types'
import { slotKey, slotLabel, slotsFor } from '../game/logic'
import { cx } from './classes'

interface Props {
  timeline: Song[]
  /** Highlights where a guess lands. */
  selected?: Slot
  /** Text shown in the highlighted gap (defaults to the slot label). */
  selectedLabel?: string
  /** Colours the selected slot after the reveal. */
  verdict?: 'correct' | 'wrong'
}

const SELECTED = {
  none: 'border-solid border-accent bg-accent/15 text-ink',
  correct: 'border-solid border-good bg-good/15 text-ink',
  wrong: 'border-solid border-bad bg-bad/15 text-ink',
}

export function Timeline({ timeline, selected, selectedLabel, verdict }: Props) {
  const selectedKey = selected ? slotKey(selected) : null
  const selectedClass = SELECTED[verdict ?? 'none']

  return (
    <ol className="flex flex-col gap-1.5">
      {slotsFor(timeline).map((slot) => {
        const key = slotKey(slot)
        const isSelected = key === selectedKey
        if (slot.kind === 'on') {
          return (
            <li
              key={key}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5',
                isSelected ? selectedClass : 'border-line bg-surface-2',
              )}
            >
              <span className="flex-none text-[1.3rem] font-extrabold text-accent-2 tabular-nums">{slot.year}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {timeline
                  .filter((s) => s.year === slot.year)
                  .map((s) => (
                    <span key={s.id} className="flex flex-col">
                      <span className="truncate">{s.title}</span>
                      <span className="truncate text-sm text-muted">{s.artists.join(', ')}</span>
                    </span>
                  ))}
              </span>
              {isSelected && selectedLabel && (
                <span className="flex-none rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  {selectedLabel}
                </span>
              )}
            </li>
          )
        }
        if (!isSelected) return null
        return (
          <li key={key} className={cx('grid min-h-11 place-items-center rounded-xl border-2 text-sm font-semibold', selectedClass)}>
            {selectedLabel ?? slotLabel(slot)}
          </li>
        )
      })}
    </ol>
  )
}
