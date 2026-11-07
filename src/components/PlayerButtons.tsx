import { useState } from 'react'
import { CELEBRATIONS, celebrateCard, EMOJI_CHOICES, type Celebration, type CelebrationStyle } from '../party'
import { firstEmoji } from '../emojiRain'
import { DEFAULT_KNIT_PATTERN } from '../knitting'
import { KnitDesigner } from './KnitDesigner'
import { Muted, OptionButton, TextInput } from './ui'
import { cx } from './classes'

// A player's celebration, picked in their card editor before the game.

/** A celebration's icon: its emoji, the player's own for emoji rain, or a drawn one. */
export function CelebrationIcon({ style, emoji }: { style: CelebrationStyle; emoji: string }) {
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

/**
 * Pick a celebration (and for emoji rain which emoji, for knitting the
 * scarf's pattern), right in the player editor. Picking one shows it off.
 */
export function CelebrationChooser({ value, onChange }: { value: Celebration; onChange: (celebration: Celebration) => void }) {
  const [typed, setTyped] = useState('')
  const pick = (next: Celebration) => {
    onChange(next)
    celebrateCard(next)
  }
  return (
    <div className="flex flex-col gap-3">
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
    </div>
  )
}
