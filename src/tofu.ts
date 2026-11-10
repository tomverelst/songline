import { fitOverlay, overlayCanvas } from './effectAngle'
/**
 * Happy tofu on a full-screen canvas: wobbly white blocks of tofu with little
 * faces drop in from the top, land with a squish, jiggle like jelly and hop
 * about along the bottom of the screen. Two players' tofu can party at once
 * (Battle).
 */

export interface TofuOptions {
  /** How many blocks drop in. */
  blocks: number
  /** Spread the drops over this long. */
  overMs: number
  /** Block width range in CSS pixels. */
  minSize: number
  maxSize: number
  /** Hops each block does once it has landed. */
  hops: number
  /** How long they keep partying after the last one lands. */
  holdMs: number
}

interface Block {
  sprite: HTMLCanvasElement
  x: number
  y: number
  vx: number
  vy: number
  size: number
  /** Squish from the last landing: how hard, and when (ms since the show began). */
  squish: number
  landedAt: number
  /** When it next hops, while it has hops left. */
  hopAt: number
  hopsLeft: number
  onFloor: boolean
  at: number
  fadeAt: number
}

const SPRITE_W = 128
const SPRITE_H = 104
const FADE_MS = 600
/** Jiggle: how fast it wobbles and how fast the wobble dies down. */
const WOBBLE_HZ = 5.5
const WOBBLE_DECAY = 5

let active: { add: (o: TofuOptions) => void } | null = null
let sprites: HTMLCanvasElement[] | null = null

export function tofu(options: TofuOptions) {
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
  const blocks: Block[] = []
  let endAt = 0
  // Gravity scales with the screen, so a drop takes as long on a phone as on a tablet.
  const gravity = () => h / 1400
  const floor = () => h - 6

  function add(o: TofuOptions) {
    const now = performance.now() - start
    const pics = (sprites ??= makeSprites())
    const added: Block[] = []
    for (let i = 0; i < o.blocks; i++) {
      const size = o.minSize + Math.random() * (o.maxSize - o.minSize)
      added.push({
        sprite: pics[Math.floor(Math.random() * pics.length)],
        x: size / 2 + Math.random() * Math.max(0, w - size),
        y: -Math.random() * h * 0.3,
        vx: 0,
        vy: 0,
        size,
        squish: 0,
        landedAt: 0,
        hopAt: 0,
        hopsLeft: o.hops,
        onFloor: false,
        at: now + Math.random() * o.overMs,
        fadeAt: 0,
      })
    }
    // Bigger ones are nearer, so drawn last.
    blocks.push(...added)
    blocks.sort((a, b) => a.size - b.size)
    // A drop takes about a second, each hop about 0.7s.
    endAt = Math.max(endAt, now + o.overMs + 1000 + o.hops * 700 + o.holdMs)
    for (const b of blocks) b.fadeAt = endAt
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
    const t = Math.max(0, now - start)
    try {
      const dt = Math.min(3, Math.max(0, now - last) / (1000 / 60))
      last = now
      const g = gravity()
      const ground = floor()
      ctx!.clearRect(0, 0, w, h)

      for (const b of blocks) {
        if (t < b.at) continue
        if (b.onFloor && b.hopsLeft > 0 && t >= b.hopAt) {
          // Hop! Up a bit, sometimes to the side.
          b.onFloor = false
          b.hopsLeft--
          b.vy = -Math.sqrt(2 * g * h * (0.08 + Math.random() * 0.14))
          b.vx = (Math.random() - 0.5) * 3
        }
        if (!b.onFloor) {
          b.vy += g * dt
          b.x = Math.max(b.size / 2, Math.min(w - b.size / 2, b.x + b.vx * dt))
          b.y += b.vy * dt
          if (b.vy > 0 && b.y >= ground) {
            b.y = ground
            b.onFloor = true
            b.squish = Math.min(0.45, 0.12 + b.vy / 60)
            b.landedAt = t
            b.vx = 0
            b.hopAt = t + 250 + Math.random() * 350
          }
        }

        // Squash and stretch: stretched by speed in the air, jiggling after a landing.
        const since = (t - b.landedAt) / 1000
        const wobble = b.landedAt ? b.squish * Math.exp(-WOBBLE_DECAY * since) * Math.cos(2 * Math.PI * WOBBLE_HZ * since) : 0
        const stretch = b.onFloor ? 0 : Math.max(-0.12, Math.min(0.18, Math.abs(b.vy) / 90))
        const sy = 1 - wobble + stretch
        const sx = 1 + wobble * 0.7 - stretch * 0.5
        const bw = b.size * sx
        const bh = b.size * (SPRITE_H / SPRITE_W) * sy

        ctx!.globalAlpha = Math.max(0, Math.min(1, 1 - (t - b.fadeAt) / FADE_MS))
        // Anchored at the bottom middle, so it squishes onto the floor.
        ctx!.drawImage(b.sprite, b.x - bw / 2, b.y - bh, bw, bh)
      }
      ctx!.globalAlpha = 1
    } catch (e) {
      // Never leave a dead show behind: it would swallow every later one.
      stop()
      throw e
    }
    if (t < endAt + FADE_MS) requestAnimationFrame(frame)
    else stop()
  }
  requestAnimationFrame(frame)
}

type Face = (c: CanvasRenderingContext2D, cx: number, cy: number) => void

/** Happy faces: ^ ^ eyes, dot eyes, and > < eyes, each with a little smile. */
const FACES: Face[] = [
  (c, cx, cy) => {
    for (const dx of [-17, 17]) {
      c.beginPath()
      c.moveTo(cx + dx - 7, cy + 3)
      c.lineTo(cx + dx, cy - 5)
      c.lineTo(cx + dx + 7, cy + 3)
      c.stroke()
    }
  },
  (c, cx, cy) => {
    for (const dx of [-16, 16]) {
      c.beginPath()
      c.arc(cx + dx, cy, 5, 0, Math.PI * 2)
      c.fill()
      // A sparkle in each eye.
      c.save()
      c.fillStyle = '#ffffff'
      c.beginPath()
      c.arc(cx + dx + 1.8, cy - 1.8, 1.6, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  },
  (c, cx, cy) => {
    for (const dir of [-1, 1]) {
      const ex = cx + dir * 17
      c.beginPath()
      c.moveTo(ex - dir * 6, cy - 6)
      c.lineTo(ex + dir * 5, cy)
      c.lineTo(ex - dir * 6, cy + 6)
      c.stroke()
    }
  },
]

/** One block of tofu per face, drawn once each and reused. */
function makeSprites(): HTMLCanvasElement[] {
  return FACES.map((face) => {
    const sprite = document.createElement('canvas')
    sprite.width = SPRITE_W
    sprite.height = SPRITE_H
    const c = sprite.getContext('2d')!
    const pad = 4
    const x = pad
    const y = pad
    const bw = SPRITE_W - pad * 2
    const bh = SPRITE_H - pad * 2

    // The block: soft and pale, a little darker towards the bottom.
    const body = c.createLinearGradient(0, y, 0, y + bh)
    body.addColorStop(0, '#fffdf6')
    body.addColorStop(0.7, '#f4edd9')
    body.addColorStop(1, '#ddd2b4')
    c.fillStyle = body
    rounded(c, x, y, bw, bh, 22)
    c.fill()
    c.strokeStyle = '#c9bc98'
    c.lineWidth = 2.5
    c.stroke()

    // The top face, catching the light: makes it read as a block.
    c.fillStyle = 'rgba(255, 255, 255, 0.85)'
    rounded(c, x + 10, y + 7, bw - 20, bh * 0.22, 12)
    c.fill()
    // A glossy dot, it's a bit wet.
    c.fillStyle = 'rgba(255, 255, 255, 0.95)'
    c.beginPath()
    c.ellipse(x + bw * 0.8, y + bh * 0.42, 6, 4, -0.5, 0, Math.PI * 2)
    c.fill()

    // The face.
    const cx = SPRITE_W / 2
    const cy = y + bh * 0.58
    c.strokeStyle = c.fillStyle = '#3b2f2a'
    c.lineWidth = 4
    c.lineCap = 'round'
    c.lineJoin = 'round'
    face(c, cx, cy)
    c.beginPath()
    c.arc(cx, cy + 9, 6, 0.15 * Math.PI, 0.85 * Math.PI)
    c.stroke()
    // Rosy cheeks.
    c.fillStyle = 'rgba(255, 130, 150, 0.45)'
    for (const dx of [-30, 30]) {
      c.beginPath()
      c.ellipse(cx + dx, cy + 9, 8, 5, 0, 0, Math.PI * 2)
      c.fill()
    }
    return sprite
  })
}

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}
