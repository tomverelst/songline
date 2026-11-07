import { useState } from 'react'
import { CELEBRATIONS, celebrateCard, EMOJI_CHOICES, type Celebration } from '../party'
import { firstEmoji } from '../emojiRain'
import { freeColor, TEAM_COLORS, teamVars, type TeamColor } from '../game/teams'
import { Button, CardTitle, IconButton, Muted, OptionButton, TextInput } from './ui'
import { cx } from './classes'

// The buttons next to each name on the setup screen: a player's colour and
// celebration are picked there, before the game.

/**
 * A player's celebration: the button shows it, and a tap opens a picker with
 * every style (and, for emoji rain, which emoji). Picking one shows it off.
 */
export function CelebrationButton({
  playerName,
  value,
  onChange,
}: {
  playerName: string
  value: Celebration
  onChange: (celebration: Celebration) => void
}) {
  const [open, setOpen] = useState(false)
  const current = CELEBRATIONS.find((c) => c.id === value.style) ?? CELEBRATIONS[0]
  const icon = value.style === 'emoji' ? value.emoji : current.emoji
  return (
    <>
      <IconButton aria-label={`Celebration: ${current.name}. Tap to change.`} title={current.name} onClick={() => setOpen(true)}>
        {icon}
      </IconButton>
      {open && (
        <CelebrationPicker playerName={playerName} value={value} onChange={onChange} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function CelebrationPicker({
  playerName,
  value,
  onChange,
  onClose,
}: {
  playerName: string
  value: Celebration
  onChange: (celebration: Celebration) => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const pick = (next: Celebration) => {
    onChange(next)
    celebrateCard(next)
  }
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`${playerName || 'Player'}'s celebration`}
        className="mx-auto flex max-h-[85%] w-full max-w-[35rem] animate-slide-up flex-col gap-3 overflow-y-auto rounded-t-[20px] bg-surface px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{playerName ? `${playerName}'s celebration` : 'Celebration'}</CardTitle>
          <IconButton aria-label="Close" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <Muted>Plays when they win a card, hit the exact year and win the game. Tap one to see it.</Muted>
        <div className="grid grid-cols-2 gap-1.5">
          {CELEBRATIONS.map((c) => (
            <OptionButton
              key={c.id}
              selected={value.style === c.id}
              className="min-h-13 flex-row items-center justify-start gap-2 font-semibold"
              onClick={() => pick({ ...value, style: c.id })}
            >
              <span className="text-xl">{c.id === 'emoji' ? value.emoji : c.emoji}</span>
              {c.name}
            </OptionButton>
          ))}
        </div>
        {value.style === 'emoji' && (
          <>
            <span className="mt-1 font-semibold">Which emoji?</span>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  aria-label={emoji}
                  aria-pressed={value.emoji === emoji}
                  className={cx(
                    'grid aspect-square place-items-center rounded-xl border text-2xl',
                    value.emoji === emoji ? 'border-accent bg-accent/15' : 'border-transparent',
                  )}
                  onClick={() => pick({ style: 'emoji', emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <TextInput
              placeholder="Or type any emoji"
              aria-label="Type any emoji"
              value={typed}
              autoComplete="off"
              onChange={(e) => {
                setTyped(e.target.value)
                const emoji = firstEmoji(e.target.value)
                if (emoji) pick({ style: 'emoji', emoji })
              }}
            />
          </>
        )}
        <Button variant="primary" block onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

/** A swatch of a player's colour; a tap moves on to the next colour nobody else has. */
export function ColorButton({
  value,
  taken,
  onChange,
}: {
  value: TeamColor
  /** Colours of the other players. */
  taken: string[]
  onChange: (id: string) => void
}) {
  return (
    <IconButton
      aria-label={`Colour: ${value.name}. Tap to change.`}
      title={value.name}
      onClick={() => onChange(freeColor(TEAM_COLORS.indexOf(value) + 1, taken).id)}
    >
      <span className="size-6 rounded-full border-2 border-white/80 bg-(--team)" style={teamVars(value)} />
    </IconButton>
  )
}
