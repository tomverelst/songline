import { useState } from 'react'
import { CELEBRATIONS, celebrateCard, EMOJI_CHOICES, type Celebration, type CelebrationStyle } from '../party'
import { firstEmoji } from '../emojiRain'
import { DEFAULT_KNIT_PATTERN } from '../knitting'
import { KnitDesigner } from './KnitDesigner'
import { CardPainter } from './CardPainter'
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
  return (
    <>
      <IconButton aria-label={`Celebration: ${current.name}. Tap to change.`} title={current.name} onClick={() => setOpen(true)}>
        <CelebrationIcon style={current.id} emoji={value.emoji} />
      </IconButton>
      {open && (
        <CelebrationPicker playerName={playerName} value={value} onChange={onChange} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

/** A celebration's icon: its emoji, the player's own for emoji rain, or a drawn one. */
function CelebrationIcon({ style, emoji }: { style: CelebrationStyle; emoji: string }) {
  if (style === 'emoji') return <>{emoji}</>
  if (style === 'tofu') return <TofuIcon />
  return <>{CELEBRATIONS.find((c) => c.id === style)?.emoji}</>
}

/** A happy block of tofu, like the ones in the celebration, sized like an emoji. */
function TofuIcon() {
  return (
    <svg viewBox="1.5 3.5 29 26" width="1.25em" height="1.25em" aria-hidden="true" className="inline-block align-[-0.2em]">
      <defs>
        <linearGradient id="tofu-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.7" stopColor="#f4edd9" />
          <stop offset="1" stopColor="#ddd2b4" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="5" width="27" height="23" rx="5.5" fill="url(#tofu-body)" stroke="#c9bc98" strokeWidth="1.2" />
      <rect x="5" y="6.8" width="22" height="4.6" rx="2.3" fill="#ffffff" opacity="0.85" />
      <ellipse cx="24.6" cy="14.6" rx="1.5" ry="1" fill="#ffffff" transform="rotate(-28 24.6 14.6)" />
      <g fill="none" stroke="#3b2f2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.2 19 L11.6 16.2 L14 19" />
        <path d="M18 19 L20.4 16.2 L22.8 19" />
        <path d="M14 21.4 Q16 23.6 18 21.4" />
      </g>
      <ellipse cx="7.6" cy="22" rx="2.2" ry="1.4" fill="#ff8296" opacity="0.6" />
      <ellipse cx="24.4" cy="22" rx="2.2" ry="1.4" fill="#ff8296" opacity="0.6" />
    </svg>
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
              <span className="text-xl">
                <CelebrationIcon style={c.id} emoji={value.emoji} />
              </span>
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
                  onClick={() => pick({ ...value, style: 'emoji', emoji })}
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
                if (emoji) pick({ ...value, style: 'emoji', emoji })
              }}
            />
          </>
        )}
        {value.style === 'knitting' && (
          <KnitDesigner
            pattern={value.pattern ?? DEFAULT_KNIT_PATTERN}
            // Painting doesn't set it off every stitch; the button below does.
            onChange={(pattern) => onChange({ ...value, pattern })}
            onPreview={() => celebrateCard({ ...value, pattern: value.pattern ?? DEFAULT_KNIT_PATTERN })}
          />
        )}
        <Button variant="primary" block onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

/**
 * A player's guess card: the button shows it in small (their painting, or a
 * plain card in their colour), and a tap opens the painter.
 */
export function CardButton({
  playerName,
  art,
  color,
  onChange,
}: {
  playerName: string
  art: string | undefined
  color: TeamColor
  onChange: (art: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton aria-label={`${playerName || 'Player'}'s card: tap to paint it`} title="Paint your card" onClick={() => setOpen(true)}>
        {art ? (
          <img src={art} alt="" className="h-7 w-5 rounded-[3px] object-cover [image-rendering:pixelated]" />
        ) : (
          <span className="grid h-7 w-5 place-items-center rounded-[3px] bg-team-gradient text-[0.6rem] text-on-accent" style={teamVars(color)}>
            🎨
          </span>
        )}
      </IconButton>
      {open && <CardPainter playerName={playerName} art={art} onSave={onChange} onClose={() => setOpen(false)} />}
    </>
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
