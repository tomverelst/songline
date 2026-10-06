import type { Song } from '../game/types'
import { distinctYears } from '../game/logic'
import { useOpenSong } from './openSong'

/** A player's cards as a compact list, grouped by year (used on the end screen). */
export function Timeline({ timeline }: { timeline: Song[] }) {
  const open = useOpenSong()
  return (
    <ol className="flex flex-col gap-1.5">
      {distinctYears(timeline).map((year) => (
        <li key={year} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <span className="flex-none text-[1.3rem] font-extrabold text-accent-2 tabular-nums">{year}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {timeline
              .filter((s) => s.year === year)
              .map((s) => (
                <button
                  key={s.id}
                  className="flex flex-col text-left disabled:cursor-default"
                  disabled={!open}
                  onClick={() => open?.(s)}
                >
                  <span className="truncate">{s.title}</span>
                  <span className="truncate text-sm text-muted">{s.artists.join(', ')}</span>
                </button>
              ))}
          </span>
        </li>
      ))}
    </ol>
  )
}
