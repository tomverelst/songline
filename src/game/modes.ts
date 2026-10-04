import type { GameMode } from './types'

export interface GameModeInfo {
  id: GameMode
  name: string
  description: string
}

export const GAME_MODES: GameModeInfo[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Guess the year to win the card. Name the exact year, title or artist for bonus coins.',
  },
]
