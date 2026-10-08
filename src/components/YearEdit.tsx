import { useState } from 'react'
import { isValidYear } from '../game/logic'
import type { Song } from '../game/types'
import { cx } from './classes'
import { YearInput } from './YearInput'

/** A web search for the song's original release year. */
export function lookUpUrl(song: Song) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(`"${song.title}" ${song.artists[0] ?? ''} release year`)}`
}

/**
 * Editing a song's year in place: `input` is the −10 −1 [year] +1 +10 control
 * to show instead of the year while `editing`; `pills` are 🔍 Look up and
 * ✎ Edit (✓ Done while editing). Without `onSave` there's only Look up.
 */
export function useYearEditor(song: Song, onSave?: (year: number) => void, { compact = false } = {}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number | undefined>(song.year)

  const done = () => {
    if (draft !== undefined && isValidYear(draft) && draft !== song.year) onSave?.(draft)
    setEditing(false)
  }
  const pill =
    'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold no-underline active:bg-surface-2'
  const quiet = cx(pill, 'border-line text-muted')

  const input = editing && <YearInput value={draft} startYear={song.year} onChange={setDraft} />
  const pills = (
    <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
      <a href={lookUpUrl(song)} target="_blank" rel="noreferrer" className={quiet} aria-label="Look up the year">
        🔍{!compact && ' Look up'}
      </a>
      {onSave &&
        (editing ? (
          <button
            className={cx(pill, 'border-good text-good')}
            disabled={draft === undefined || !isValidYear(draft)}
            onClick={done}
          >
            ✓ Done
          </button>
        ) : (
          <button
            className={quiet}
            aria-label="Edit the year"
            onClick={() => {
              setDraft(song.year)
              setEditing(true)
            }}
          >
            ✎{!compact && ' Edit'}
          </button>
        ))}
    </span>
  )
  return { editing, input, pills }
}
