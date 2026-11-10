import { fitOverlay, overlayCanvas } from './effectAngle'
/**
 * Patatas bravas on a full-screen canvas: golden fried potato cubes are tossed
 * up from the bottom like from a pan, tumble and land in a heap along the
 * bottom of the screen. Then the brava sauce is drizzled over them in a red
 * zigzag, and a white one of aioli on top. Two players' plates can be served
 * at once (Battle).
 */

export interface BravasOptions {
  /** How many potato cubes are tossed in all. */
  cubes: number
  /** Spread the tosses over this long. */
  overMs: number
  /** Cube size range in CSS pixels. */
  minSize: number
  maxSize: number
  /** Rounds of sauce: each is a brava drizzle and then an aioli one. */
  sauces: number
  /** A dusting of pimentón over the top (for the big ones). */
  pimenton?: boolean
  /** How long the plate stays once the last sauce is on. */
  holdMs: number
}

interface Cube {
  sprite: HTMLCanvasElement
  x: number
  y: number
  vx: number
  vy: number
  size: number
  angle: number
  spin: number
  /** Where it comes to rest on the heap. */
  restY: number
  bounces: number
  /** When it is tossed, and when the plate starts to fade (ms since the show began). */
  at: number
  fadeAt: number
}

interface Drizzle {
  points: { x: number; y: number }[]
  colors: { shadow: string; main: string; shine: string }
  width: number
  at: number
  drawMs: number
  fadeAt: number
}

interface Speck {
  x: number
  y: number
  r: number
  at: number
  fadeAt: number
}

const SPRITE_PX = 72
const SPRITE_VARIANTS = 6
const FADE_MS = 600
const BRAVA = { shadow: '#6e1608', main: '#d2381a', shine: 'rgba(255, 190, 160, 0.7)' }
const AIOLI = { shadow: 'rgba(120, 95, 50, 0.55)', main: '#fbf2d6', shine: 'rgba(255, 255, 255, 0.9)' }

let active: { add: (o: BravasOptions) => void } | null = null
let sprites: HTMLCanvasElement[] | null = null

export function bravas(options: BravasOptions) {
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
  const cubes: Cube[] = []
  const drizzles: Drizzle[] = []
  const specks: Speck[] = []
  let endAt = 0
  // Gravity scales with the screen, so a toss takes as long on a phone as on a tablet.
  const gravity = () => h / 1100

  function add(o: BravasOptions) {
    const now = performance.now() - start
    const pics = (sprites ??= makeSprites())
    const floor = h - 6
    const depth = Math.min(h * 0.22, 40 + o.cubes * 1.4)
    const g = gravity()

    const added: Cube[] = []
    for (let i = 0; i < o.cubes; i++) {
      const size = o.minSize + Math.random() * (o.maxSize - o.minSize)
      const x = w * (0.04 + Math.random() * 0.92)
      // Up to somewhere in the top half, just fast enough to get there.
      const apex = h * (0.12 + Math.random() * 0.4)
      added.push({
        sprite: pics[Math.floor(Math.random() * pics.length)],
        x,
        y: h + size,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.sqrt(2 * g * (h + size - apex)),
        size,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
        restY: floor - size * 0.35 - Math.random() * depth,
        bounces: 0,
        at: now + Math.random() * o.overMs,
        fadeAt: 0,
      })
    }
    // Lower on the heap is nearer, so drawn last.
    added.sort((a, b) => a.restY - b.restY)

    // The sauce goes on once the cubes have landed (a toss takes about 1.2s).
    const sauceAt = now + o.overMs + 1250
    const top = floor - depth - 10
    const added2: Drizzle[] = []
    for (let s = 0; s < o.sauces; s++) {
      const at = sauceAt + s * 1100
      added2.push({ points: zigzag(top, floor - 10), colors: BRAVA, width: 11, at, drawMs: 650, fadeAt: 0 })
      added2.push({ points: zigzag(top, floor - 10), colors: AIOLI, width: 7, at: at + 450, drawMs: 650, fadeAt: 0 })
    }
    const lastSauce = sauceAt + (o.sauces - 1) * 1100 + 450 + 650
    const added3: Speck[] = []
    if (o.pimenton) {
      for (let i = 0; i < 160; i++) {
        added3.push({ x: Math.random() * w, y: top + Math.random() * (floor - top), r: 0.8 + Math.random() * 1.6, at: lastSauce + Math.random() * 500, fadeAt: 0 })
      }
    }

    // One plate: everything on it fades together, joining a plate still being served.
    endAt = Math.max(endAt, lastSauce + (o.pimenton ? 500 : 0) + o.holdMs)
    cubes.push(...added)
    drizzles.push(...added2)
    specks.push(...added3)
    for (const item of [...cubes, ...drizzles, ...specks]) item.fadeAt = endAt
  }

  function zigzag(top: number, bottom: number) {
    // Back and forth across the screen, a bit wobbly, like a squeezy bottle.
    const zigs = Math.max(6, Math.round(w / 70))
    const ltr = Math.random() < 0.5
    const points = []
    for (let i = 0; i <= zigs; i++) {
      const f = i / zigs
      const x = (ltr ? f : 1 - f) * (w + 40) - 20 + (Math.random() - 0.5) * 20
      const y = (i % 2 ? top : bottom) + (Math.random() - 0.5) * (bottom - top) * 0.35
      points.push({ x, y })
    }
    return points
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
      ctx!.clearRect(0, 0, w, h)

      for (const c of cubes) {
        if (t < c.at) continue
        if (c.bounces < 2) {
          c.vy += g * dt
          c.x += c.vx * dt
          c.y += c.vy * dt
          c.angle += c.spin * dt
          if (c.vy > 0 && c.y >= c.restY) {
            // Land with a little bounce, then settle.
            c.y = c.restY
            c.bounces++
            c.vy = c.bounces < 2 ? -c.vy * 0.25 : 0
            c.vx *= 0.3
            c.spin *= 0.3
          }
        }
        ctx!.globalAlpha = fade(t, c.fadeAt)
        ctx!.save()
        ctx!.translate(c.x, c.y)
        ctx!.rotate(c.angle)
        ctx!.drawImage(c.sprite, -c.size / 2, -c.size / 2, c.size, c.size)
        ctx!.restore()
      }

      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      for (const d of drizzles) {
        if (t < d.at) continue
        ctx!.globalAlpha = fade(t, d.fadeAt)
        const progress = Math.min(1, (t - d.at) / d.drawMs)
        drawDrizzle(d, progress)
      }

      for (const s of specks) {
        if (t < s.at) continue
        ctx!.globalAlpha = Math.min(1, (t - s.at) / 200) * fade(t, s.fadeAt)
        ctx!.fillStyle = '#9c2410'
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx!.fill()
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

  function drawDrizzle(d: Drizzle, progress: number) {
    const path = new Path2D()
    const pts = d.points
    const end = progress * (pts.length - 1)
    path.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i <= Math.ceil(end); i++) {
      // Each zig is a curve through the midpoints, so the line flows.
      const prev = pts[i - 1]
      const p = pts[i]
      const f = Math.min(1, end - (i - 1))
      const x = prev.x + (p.x - prev.x) * f
      const y = prev.y + (p.y - prev.y) * f
      const cx = (prev.x + x) / 2
      const cy = Math.max(prev.y, y) + Math.abs(x - prev.x) * 0.15
      path.quadraticCurveTo(cx, cy, x, y)
    }
    ctx!.strokeStyle = d.colors.shadow
    ctx!.lineWidth = d.width + 3
    ctx!.save()
    ctx!.translate(1, 2)
    ctx!.stroke(path)
    ctx!.restore()
    ctx!.strokeStyle = d.colors.main
    ctx!.lineWidth = d.width
    ctx!.stroke(path)
    // A glossy streak along the top of the sauce.
    ctx!.strokeStyle = d.colors.shine
    ctx!.lineWidth = Math.max(1.5, d.width * 0.22)
    ctx!.save()
    ctx!.translate(-1, -d.width * 0.22)
    ctx!.stroke(path)
    ctx!.restore()
  }

  requestAnimationFrame(frame)
}

function fade(t: number, fadeAt: number) {
  return Math.max(0, Math.min(1, 1 - (t - fadeAt) / FADE_MS))
}

/** A few potato cubes, drawn once each and reused: golden, crisp at the edges. */
function makeSprites(): HTMLCanvasElement[] {
  return Array.from({ length: SPRITE_VARIANTS }, () => {
    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = SPRITE_PX
    const c = sprite.getContext('2d')!
    const s = SPRITE_PX
    const pad = s * 0.08
    const side = s - pad * 2
    // Hand-cut: not quite square.
    const sw = side * (0.82 + Math.random() * 0.18)
    const sh = side * (0.82 + Math.random() * 0.18)
    const x = (s - sw) / 2
    const y = (s - sh) / 2

    const body = c.createLinearGradient(x, y, x + sw, y + sh)
    body.addColorStop(0, '#ffd978')
    body.addColorStop(0.55, '#e8a63c')
    body.addColorStop(1, '#a8621c')
    c.fillStyle = body
    rounded(c, x, y, sw, sh, side * (0.18 + Math.random() * 0.1))
    c.fill()
    c.save()
    c.clip()

    // The face turned to the light, a bit paler: makes it read as a cube.
    const face = c.createLinearGradient(x, y, x + sw * 0.7, y + sh * 0.7)
    face.addColorStop(0, 'rgba(255, 244, 200, 0.85)')
    face.addColorStop(1, 'rgba(255, 220, 140, 0.15)')
    c.fillStyle = face
    rounded(c, x + sw * 0.12, y + sh * 0.1, sw * 0.62, sh * 0.6, side * 0.14)
    c.fill()

    // Crispy brown spots.
    for (let i = 0; i < 5; i++) {
      c.fillStyle = `rgba(140, 70, 15, ${0.25 + Math.random() * 0.3})`
      c.beginPath()
      c.ellipse(x + Math.random() * sw, y + Math.random() * sh, 1.5 + Math.random() * 3.5, 1 + Math.random() * 2.5, Math.random() * Math.PI, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
    c.strokeStyle = '#8a4a14'
    c.lineWidth = 2
    c.stroke()
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
