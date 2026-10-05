import type { Slot, Song } from '../game/types'
import { cx } from './classes'
import type { TimelineMode } from './timelineMode'
import { Timeline } from './Timeline'
import { TimelineCarousel } from './TimelineCarousel'
import { Card, CardTitle } from './ui'

export function TimelineModeToggle({ mode, onChange }: { mode: TimelineMode; onChange: (m: TimelineMode) => void }) {
  return (
    <div className="flex flex-none rounded-full border border-line bg-bg p-0.5 text-sm" role="group" aria-label="Timeline view">
      {(['list', 'cards'] as const).map((m) => (
        <button
          key={m}
          aria-pressed={mode === m}
          className={cx('rounded-full px-3 py-1 font-semibold', mode === m ? 'bg-surface-2 text-ink' : 'text-muted')}
          onClick={() => onChange(m)}
        >
          {m === 'list' ? 'List' : 'Cards'}
        </button>
      ))}
    </div>
  )
}

interface Props {
  title: string
  timeline: Song[]
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  guessYear?: number
  /** Where the guess lands (for the list view). */
  slot?: Slot
  verdict?: 'correct' | 'wrong'
}

/** A player's timeline in a card, as a list or as swipeable cards. */
export function TimelineView({ title, timeline, mode, onModeChange, guessYear, slot, verdict }: Props) {
  return (
    <Card className="gap-2">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <TimelineModeToggle mode={mode} onChange={onModeChange} />
      </div>
      {mode === 'cards' ? (
        <TimelineCarousel timeline={timeline} guessYear={guessYear} verdict={verdict} />
      ) : (
        <Timeline
          timeline={timeline}
          selected={slot}
          selectedLabel={guessYear !== undefined && slot ? `🎵 ${guessYear}` : undefined}
          verdict={verdict}
        />
      )}
    </Card>
  )
}
