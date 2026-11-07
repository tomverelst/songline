import type { CSSProperties } from 'react'
import type { Player } from './types'

/** A team colour: bright enough to read on the dark background. */
export interface TeamColor {
  id: string
  name: string
  hex: string
}

export const TEAM_COLORS: TeamColor[] = [
  { id: 'pink', name: 'Pink', hex: '#ff4d8d' },
  { id: 'cyan', name: 'Cyan', hex: '#22d3ee' },
  { id: 'yellow', name: 'Yellow', hex: '#ffd23f' },
  { id: 'green', name: 'Green', hex: '#3ddc84' },
  { id: 'purple', name: 'Purple', hex: '#a66bff' },
  { id: 'orange', name: 'Orange', hex: '#ff9f1c' },
  { id: 'blue', name: 'Blue', hex: '#5b8cff' },
  { id: 'red', name: 'Red', hex: '#ff5252' },
]

export function teamColorById(id: string | null | undefined): TeamColor | undefined {
  return TEAM_COLORS.find((c) => c.id === id)
}

/**
 * The first colour from `start` on (wrapping round) that none of `taken`
 * uses; when every colour is taken, the one at `start`.
 */
export function freeColor(start: number, taken: (string | null | undefined)[]): TeamColor {
  for (let i = 0; i < TEAM_COLORS.length; i++) {
    const color = TEAM_COLORS[(start + i) % TEAM_COLORS.length]
    if (!taken.includes(color.id)) return color
  }
  return TEAM_COLORS[start % TEAM_COLORS.length]
}

/** A player's colour; players without one (older games) get one by their place. */
export function teamColor(player: Pick<Player, 'color'>, index: number): TeamColor {
  return teamColorById(player.color) ?? TEAM_COLORS[index % TEAM_COLORS.length]
}

/** Sets --team for an element, so its classes can use text-(--team), bg-(--team)/15 and so on. */
export function teamVars(color: TeamColor): CSSProperties {
  return { '--team': color.hex } as CSSProperties
}
