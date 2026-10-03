import type { Slot, Song } from '../game/types'
import { slotKey, slotLabel, slotsFor } from '../game/logic'

interface Props {
  timeline: Song[]
  /** Highlights where a guess lands. */
  selected?: Slot
  /** Text shown in the highlighted gap (defaults to the slot label). */
  selectedLabel?: string
  /** Colours the selected slot after the reveal. */
  verdict?: 'correct' | 'wrong'
}

export function Timeline({ timeline, selected, selectedLabel, verdict }: Props) {
  const selectedKey = selected ? slotKey(selected) : null

  return (
    <ol className="timeline">
      {slotsFor(timeline).map((slot) => {
        const key = slotKey(slot)
        const isSelected = key === selectedKey
        const stateClass = isSelected ? `selected ${verdict ?? ''}` : ''
        if (slot.kind === 'on') {
          return (
            <li key={key} className={`year-group ${stateClass}`}>
              <span className="year">{slot.year}</span>
              <span className="songs">
                {timeline
                  .filter((s) => s.year === slot.year)
                  .map((s) => (
                    <span key={s.id} className="song-line">
                      <span className="song-title">{s.title}</span>
                      <span className="muted small">{s.artists.join(', ')}</span>
                    </span>
                  ))}
              </span>
              {isSelected && selectedLabel && <span className="on-hint">{selectedLabel}</span>}
            </li>
          )
        }
        if (!isSelected) return null
        return (
          <li key={key} className={`gap ${stateClass}`}>
            {selectedLabel ?? slotLabel(slot)}
          </li>
        )
      })}
    </ol>
  )
}
