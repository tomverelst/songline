import { useState } from 'react'
import { KEYS, load, save } from '../storage'

export type TimelineMode = 'list' | 'cards'

/** The List / Cards choice, remembered on this device. */
export function useTimelineMode(): [TimelineMode, (mode: TimelineMode) => void] {
  const [mode, setMode] = useState<TimelineMode>(() => load<TimelineMode>(KEYS.timelineView, 'list'))
  return [
    mode,
    (m) => {
      setMode(m)
      save(KEYS.timelineView, m)
    },
  ]
}
