import confetti from 'canvas-confetti'
import { fireworks } from './fireworks'
import { lasers } from './lasers'
import { emojiRain } from './emojiRain'
import { bravas } from './bravas'
import { tofu } from './tofu'
import { knitting } from './knitting'
import { KEYS, load } from './storage'
import type { CelebrationStyle, Player } from './game/types'

export type { CelebrationStyle }

/** How a player celebrates: a style, and for emoji rain, which emoji. */
export interface Celebration {
  style: CelebrationStyle
  emoji: string
}

export const DEFAULT_EMOJI = '🔥'

/** Emoji to pick from for emoji rain (any other can be typed in). */
export const EMOJI_CHOICES = [
  '🔥', '🎉', '🦖', '🍕', '🚀', '🌈', '💎', '🐐',
  '👑', '⚡', '🍻', '🎸', '🥳', '💃', '🕺', '🐙',
  '🦄', '🍩', '🌮', '💥', '🎯', '🏆', '😎', '🤘',
]

/** Each style's icon: an emoji, or none for one drawn by CelebrationIcon (tofu has no emoji). */
export const CELEBRATIONS: { id: CelebrationStyle; emoji?: string; name: string }[] = [
  { id: 'confetti', emoji: '🎉', name: 'Confetti' },
  { id: 'fireworks', emoji: '🎆', name: 'Fireworks' },
  { id: 'lasers', emoji: '🪩', name: 'Lasers' },
  { id: 'emoji', emoji: '🌧️', name: 'Emoji rain' },
  { id: 'bravas', emoji: '🥔', name: 'Patatas bravas' },
  { id: 'tofu', name: 'Tofu' },
  { id: 'knitting', emoji: '🧶', name: 'Knitting' },
]

/** The style for players who haven't picked one: what this phone used before. */
export function defaultCelebration(): CelebrationStyle {
  const saved = load<CelebrationStyle>(KEYS.celebration, 'confetti')
  return CELEBRATIONS.some((c) => c.id === saved) ? saved : 'confetti'
}

export function celebrationOf(player: Pick<Player, 'celebration' | 'emoji'>): Celebration {
  return { style: player.celebration ?? defaultCelebration(), emoji: player.emoji ?? DEFAULT_EMOJI }
}

// Party effects. canvas-confetti skips them for people who prefer reduced motion.
const base = { disableForReducedMotion: true, zIndex: 50 }
const GOLD = ['#ffcc33', '#ffe680', '#f5b700', '#fff1a8', '#d99a00']
const PARTY = ['#ff5d8f', '#ffb347', '#3ddc97', '#7aa2ff', '#f4f1fb']
const CLUB = ['#39ff14', '#ff2bd6', '#00e5ff', '#3b5bff', '#ff1744']
const GOLD_LASERS = ['#ffd23f', '#ffffff', '#ffb000']
/** Cosy yarn: stripes of rose, cream, mustard and teal. */
const YARN = ['#ff6f91', '#f6ead2', '#f2b33d', '#3fb8af']

/** You won the card. */
export function celebrateCard({ style, emoji }: Celebration) {
  if (style === 'emoji') return emojiRain({ emoji, count: 45, overMs: 1500, minSize: 26, maxSize: 52 })
  if (style === 'fireworks') return fireworks({ shells: 7, overMs: 1200, colors: PARTY })
  if (style === 'lasers') return lasers({ durationMs: 2400, colors: CLUB })
  if (style === 'bravas') return bravas({ cubes: 28, overMs: 400, minSize: 26, maxSize: 40, sauces: 1, holdMs: 700 })
  if (style === 'knitting') return knitting({ scarves: 1, cols: 10, rows: 22, knitMs: 1600, colors: YARN, holdMs: 700 })
  if (style === 'tofu') return tofu({ blocks: 7, overMs: 500, minSize: 60, maxSize: 95, hops: 2, holdMs: 300 })
  confetti({ ...base, particleCount: 80, spread: 70, startVelocity: 40, origin: { y: 0.35 }, colors: PARTY })
}

/** Exact year: a shower of gold coins from both sides. */
export function celebrateExact({ style, emoji }: Celebration) {
  // Exact year: a downpour of big ones.
  if (style === 'emoji') return emojiRain({ emoji, count: 110, overMs: 2200, minSize: 34, maxSize: 84 })
  if (style === 'fireworks') return fireworks({ shells: 14, overMs: 2200, colors: GOLD, sparks: 120, glitter: true })
  if (style === 'lasers') return lasers({ durationMs: 3500, colors: GOLD_LASERS, big: true })
  // Exact year: a bigger plate, with pimentón on top.
  if (style === 'bravas') return bravas({ cubes: 55, overMs: 700, minSize: 30, maxSize: 52, sauces: 1, pimenton: true, holdMs: 900 })
  // Exact year: a wider scarf with a gold heart knitted in.
  if (style === 'knitting') return knitting({ scarves: 1, cols: 15, rows: 24, knitMs: 2300, colors: ['#ffcc33', '#f6ead2'], heart: true, holdMs: 1100 })
  if (style === 'tofu') return tofu({ blocks: 14, overMs: 800, minSize: 70, maxSize: 130, hops: 3, holdMs: 400 })
  const shot = (x: number, angle: number) =>
    confetti({
      ...base,
      particleCount: 90,
      angle,
      spread: 60,
      startVelocity: 55,
      origin: { x, y: 0.6 },
      colors: GOLD,
      shapes: ['circle'],
      scalar: 1.3,
    })
  shot(0, 60)
  shot(1, 120)
  setTimeout(() => confetti({ ...base, particleCount: 120, spread: 100, origin: { y: 0.3 }, colors: GOLD, shapes: ['circle'] }), 250)
}

/** Game over: bursts for a few seconds. */
export function celebrateWin({ style, emoji }: Celebration) {
  if (style === 'emoji') return emojiRain({ emoji, count: 220, overMs: 4500, minSize: 26, maxSize: 90 })
  if (style === 'fireworks') return fireworks({ shells: 34, overMs: 6000, colors: [...PARTY, ...GOLD], sparks: 110, glitter: true })
  if (style === 'lasers') return lasers({ durationMs: 6000, colors: CLUB, big: true })
  if (style === 'bravas') return bravas({ cubes: 110, overMs: 2000, minSize: 28, maxSize: 58, sauces: 2, pimenton: true, holdMs: 1500 })
  if (style === 'knitting') return knitting({ scarves: 3, cols: 8, rows: 36, knitMs: 4000, colors: YARN, holdMs: 1500 })
  if (style === 'tofu') return tofu({ blocks: 32, overMs: 2500, minSize: 50, maxSize: 140, hops: 4, holdMs: 600 })
  const end = Date.now() + 3500
  const burst = () => {
    confetti({
      ...base,
      particleCount: 60,
      spread: 360,
      startVelocity: 30,
      ticks: 90,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.35 },
      colors: [...PARTY, ...GOLD],
    })
    if (Date.now() < end) setTimeout(burst, 400)
  }
  burst()
}
