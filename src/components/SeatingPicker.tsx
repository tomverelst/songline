import { teamVars, type TeamColor } from '../game/teams'
import { SEATS } from '../game/logic'
import type { ScreenTurn, Seat } from '../game/types'
import { cx } from './classes'
import { Muted, OptionButton } from './ui'

// How the screen turns between turns, for a phone lying flat in the middle of
// the table: on the setup screen and in the ☰ menu (Standard).

const MODES: { id: ScreenTurn; name: string; description: string }[] = [
  { id: 'off', name: 'Off', description: 'The screen stays put.' },
  { id: 'flip', name: 'Across', description: 'Upside down every other turn.' },
  { id: 'seats', name: 'Around the table', description: 'Turns to whoever’s turn it is.' },
]

const SEAT_LABEL: Record<Seat, { arrow: string; name: string }> = {
  bottom: { arrow: '↓', name: 'Bottom' },
  left: { arrow: '←', name: 'Left' },
  top: { arrow: '↑', name: 'Top' },
  right: { arrow: '→', name: 'Right' },
}

export interface SeatedPlayer {
  key: string
  name: string
  color: TeamColor
  seat: Seat
}

export function SeatingPicker({
  mode,
  onModeChange,
  players,
  onSeatChange,
}: {
  mode: ScreenTurn
  onModeChange: (mode: ScreenTurn) => void
  players: SeatedPlayer[]
  onSeatChange: (key: string, seat: Seat) => void
}) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-line bg-bg p-3">
      <span className="font-semibold">Turn the screen to each player</span>
      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map((m) => (
          <OptionButton key={m.id} selected={mode === m.id} className={cx('px-2', mode !== m.id && 'bg-surface')} onClick={() => onModeChange(m.id)}>
            <span className="text-sm font-semibold">{m.name}</span>
            <span className="text-xs leading-snug text-muted">{m.description}</span>
          </OptionButton>
        ))}
      </div>
      {mode === 'flip' && <Muted>For players sitting across from each other, with the phone in the middle.</Muted>}
      {mode === 'seats' && (
        <>
          <Muted>
            Lay the phone flat in the middle of the table with its charging port towards the bottom side, and pick
            where everyone sits. Each turn, the screen turns to face whoever’s turn it is.
          </Muted>
          <TableDiagram players={players} />
          <div className="flex flex-col gap-1.5">
            {players.map((p) => (
              <div key={p.key} className="flex items-center gap-2" style={teamVars(p.color)}>
                <span className="size-2.5 flex-none rounded-full bg-(--team)" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <div className="flex gap-1" role="radiogroup" aria-label={`Where ${p.name} sits`}>
                  {SEATS.map((seat) => (
                    <button
                      key={seat}
                      role="radio"
                      aria-checked={p.seat === seat}
                      aria-label={SEAT_LABEL[seat].name}
                      title={SEAT_LABEL[seat].name}
                      className={cx(
                        'grid size-9 place-items-center rounded-lg border text-lg font-bold',
                        p.seat === seat ? 'border-(--team) bg-(--team)/20 text-ink' : 'border-line bg-surface text-muted',
                      )}
                      onClick={() => onSeatChange(p.key, seat)}
                    >
                      {SEAT_LABEL[seat].arrow}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** The table seen from above: the phone in the middle, everyone's name at their side. */
function TableDiagram({ players }: { players: SeatedPlayer[] }) {
  const at = (seat: Seat) =>
    players
      .filter((p) => p.seat === seat)
      .map((p) => (
        <span
          key={p.key}
          style={teamVars(p.color)}
          className="max-w-[9ch] truncate rounded-full border border-(--team) bg-(--team)/20 px-2 py-0.5 text-xs font-semibold"
        >
          {p.name}
        </span>
      ))
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto my-1 aspect-[4/3] w-full max-w-[19rem] rounded-[28px] border border-line bg-surface"
    >
      <div className="absolute inset-x-2 top-2 flex flex-wrap justify-center gap-1">{at('top')}</div>
      <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-center gap-1">{at('bottom')}</div>
      <div className="absolute inset-y-10 left-2 flex flex-col items-start justify-center gap-1">{at('left')}</div>
      <div className="absolute inset-y-10 right-2 flex flex-col items-end justify-center gap-1">{at('right')}</div>
      {/* The phone, its charging port at the bottom. */}
      <div className="absolute top-1/2 left-1/2 flex h-16 w-9 -translate-1/2 flex-col items-center justify-end rounded-lg border-2 border-muted bg-bg pb-1">
        <span className="h-0.5 w-3 rounded-full bg-muted" />
      </div>
    </div>
  )
}
