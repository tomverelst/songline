import { fitOverlay, overlayCanvas } from './effectAngle'
/**
 * Emoji rain on a full-screen canvas: a player's emoji pours down from the
 * top, swaying and spinning, in a mix of sizes. Two players' rains can fall
 * at once (Battle).
 */

export interface EmojiRainOptions {
  emoji: string
  /** How many emoji fall in all. */
  count: number
  /** Spread their start over this long. */
  overMs: number
  /** Size range in CSS pixels. */
  minSize: number
  maxSize: number
}

interface Drop {
  sprite: HTMLCanvasElement
  x: number
  y: number
  size: number
  vy: number
  swayPhase: number
  swayAmp: number
  angle: number
  spin: number
  /** When it starts falling (ms since the show began). */
  at: number
}

/** Drawn once at this size, then scaled: drawing emoji text every frame is slow. */
const SPRITE_PX = 96
const GRAVITY = 0.12

let active: { add: (o: EmojiRainOptions) => void } | null = null
const sprites = new Map<string, HTMLCanvasElement>()

export function emojiRain(options: EmojiRainOptions) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (active) return active.add(options)

  const canvas = overlayCanvas()
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()

  let w = 0
  let h = 0
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ;({ w, h } = fitOverlay(canvas, dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const start = performance.now()
  const drops: Drop[] = []

  function add(o: EmojiRainOptions) {
    const sprite = spriteFor(o.emoji)
    const offset = performance.now() - start
    for (let i = 0; i < o.count; i++) {
      const size = o.minSize + Math.random() * (o.maxSize - o.minSize)
      drops.push({
        sprite,
        x: Math.random() * w,
        y: -size - Math.random() * 40,
        size,
        // Bigger ones fall a little faster, as if nearer.
        vy: 1.5 + Math.random() * 2 + size / 40,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 0.4 + Math.random() * 1.2,
        angle: (Math.random() - 0.5) * 0.6,
        spin: (Math.random() - 0.5) * 0.06,
        at: offset + Math.random() * o.overMs,
      })
    }
  }

  function stop() {
    window.removeEventListener('resize', resize)
    canvas.remove()
    active = null
  }

  active = { add }
  add(options)

  let last = start
  function frame(now: number) {
    try {
      const dt = Math.min(3, Math.max(0, now - last) / (1000 / 60))
      last = now
      const t = Math.max(0, now - start)
      ctx!.clearRect(0, 0, w, h)
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        if (t < d.at) continue
        d.vy += GRAVITY * 0.15 * dt
        d.y += d.vy * dt
        d.x += Math.sin(t / 500 + d.swayPhase) * d.swayAmp * dt
        d.angle += d.spin * dt
        if (d.y - d.size > h) {
          drops.splice(i, 1)
          continue
        }
        // Fade out over the bottom fifth of the screen.
        ctx!.globalAlpha = Math.max(0, Math.min(1, (h - d.y) / (h * 0.2)))
        ctx!.save()
        ctx!.translate(d.x, d.y)
        ctx!.rotate(d.angle)
        ctx!.drawImage(d.sprite, -d.size / 2, -d.size / 2, d.size, d.size)
        ctx!.restore()
      }
      ctx!.globalAlpha = 1
    } catch (e) {
      // Never leave a dead show behind: it would swallow every later one.
      stop()
      throw e
    }
    if (drops.length) requestAnimationFrame(frame)
    else stop()
  }
  requestAnimationFrame(frame)
}

function spriteFor(emoji: string): HTMLCanvasElement {
  let sprite = sprites.get(emoji)
  if (!sprite) {
    sprite = document.createElement('canvas')
    sprite.width = sprite.height = SPRITE_PX
    const c = sprite.getContext('2d')!
    c.font = `${SPRITE_PX * 0.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(emoji, SPRITE_PX / 2, SPRITE_PX / 2 + SPRITE_PX * 0.05)
    sprites.set(emoji, sprite)
  }
  return sprite
}

/**
 * The first emoji in some text (a typed "🔥🔥" gives "🔥", "hi 🦖" gives "🦖"),
 * or null when there's none. Flags, skin tones and families count as one.
 */
export function firstEmoji(text: string): string | null {
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)
  for (const { segment } of segments) {
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) return segment
  }
  return null
}
