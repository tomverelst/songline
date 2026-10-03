import type { Slot, Song } from '../game/types'
import { slotKey, slotLabel, slotsFor } from '../game/logic'

interface Props {
  timeline: Song[]
  /** When set, slots are tappable. */
  onSelect?: (slot: Slot) => void
  selected?: Slot
  /** Colours the selected slot after the reveal. */
  verdict?: 'correct' | 'wrong'
}

export function Timeline({ timeline, onSelect, selected, verdict }: Props) {
  const selectedKey = selected ? slotKey(selected) : null
  const stateClass = (slot: Slot) =>
    slotKey(slot) === selectedKey ? `selected ${verdict ?? ''}` : ''

  return (
    <ol className={`timeline ${onSelect ? 'interactive' : ''}`}>
      {slotsFor(timeline).map((slot) => {
        const key = slotKey(slot)
        if (slot.kind === 'on') {
          const cards = timeline.filter((s) => s.year === slot.year)
          return (
            <li key={key}>
              <button
                className={`year-group ${stateClass(slot)}`}
                disabled={!onSelect}
                onClick={() => onSelect?.(slot)}
                aria-label={slotLabel(slot)}
              >
                <span className="year">{slot.year}</span>
                <span className="songs">
                  {cards.map((s) => (
                    <span key={s.id} className="song-line">
                      <span className="song-title">{s.title}</span>
                      <span className="muted small">{s.artists.join(', ')}</span>
                    </span>
                  ))}
                </span>
                {onSelect && <span className="on-hint">same year</span>}
              </button>
            </li>
          )
        }
        if (!onSelect && key !== selectedKey) return null
        return (
          <li key={key}>
            <button className={`gap ${stateClass(slot)}`} disabled={!onSelect} onClick={() => onSelect?.(slot)}>
              {slotLabel(slot)}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
