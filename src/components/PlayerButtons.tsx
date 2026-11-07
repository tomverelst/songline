import { CELEBRATIONS, celebrateCard, type CelebrationStyle } from '../party'
import { freeColor, TEAM_COLORS, teamVars, type TeamColor } from '../game/teams'
import { IconButton } from './ui'

// The buttons next to each name on the setup screen: a player's colour and
// celebration are picked there, before the game.

/**
 * A button that shows a player's celebration and switches to the next one
 * when tapped, showing it off.
 */
export function CelebrationButton({
  value,
  onChange,
  className,
}: {
  value: CelebrationStyle
  onChange: (style: CelebrationStyle) => void
  className?: string
}) {
  const current = CELEBRATIONS.find((c) => c.id === value) ?? CELEBRATIONS[0]
  return (
    <IconButton
      aria-label={`Celebration: ${current.name}. Tap to change.`}
      title={current.name}
      className={className}
      onClick={() => {
        const next = CELEBRATIONS[(CELEBRATIONS.indexOf(current) + 1) % CELEBRATIONS.length]
        onChange(next.id)
        celebrateCard(next.id)
      }}
    >
      {current.emoji}
    </IconButton>
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
