import confetti from 'canvas-confetti'
import { fireworks } from './fireworks'
import { KEYS, load, save } from './storage'

export type CelebrationStyle = 'confetti' | 'fireworks'

/** How wins are celebrated on this phone. */
export function celebrationStyle(): CelebrationStyle {
  return load<CelebrationStyle>(KEYS.celebration, 'confetti') === 'fireworks' ? 'fireworks' : 'confetti'
}

export function setCelebrationStyle(style: CelebrationStyle) {
  save(KEYS.celebration, style)
}

const wantsFireworks = () => celebrationStyle() === 'fireworks'

// Party effects. canvas-confetti skips them for people who prefer reduced motion.
const base = { disableForReducedMotion: true, zIndex: 50 }
const GOLD = ['#ffcc33', '#ffe680', '#f5b700', '#fff1a8', '#d99a00']
const PARTY = ['#ff5d8f', '#ffb347', '#3ddc97', '#7aa2ff', '#f4f1fb']

/** You won the card. */
export function celebrateCard() {
  if (wantsFireworks()) return fireworks({ shells: 3, overMs: 700, colors: PARTY })
  confetti({ ...base, particleCount: 80, spread: 70, startVelocity: 40, origin: { y: 0.35 }, colors: PARTY })
}

/** Exact year: a shower of gold coins from both sides. */
export function celebrateExact() {
  if (wantsFireworks()) return fireworks({ shells: 6, overMs: 1400, colors: GOLD, sparks: 110, glitter: true })
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
export function celebrateWin() {
  if (wantsFireworks()) return fireworks({ shells: 14, overMs: 4000, colors: [...PARTY, ...GOLD], sparks: 100, glitter: true })
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
