/**
 * Real fireworks on a full-screen canvas: rockets with a trail climb from the
 * bottom, burst into glowing sparks that slow down, fall and crackle out.
 */

export interface FireworksOptions {
  /** How many shells to fire. */
  shells: number
  /** Spread the launches over this many milliseconds. */
  overMs: number
  colors: string[]
  /** Sparks per burst. */
  sparks?: number
  /** Extra glittering tails on the sparks (for the gold shows). */
  glitter?: boolean
}

interface Rocket {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  trail: { x: number; y: number }[]
}

interface Spark {
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  life: number
  decay: number
  color: string
  glitter: boolean
}

const GRAVITY = 0.06 // px per frame², in CSS pixels at 60 fps
const DRAG = 0.975

let active: { canvas: HTMLCanvasElement; add: (o: FireworksOptions) => void } | null = null

export function fireworks(options: FireworksOptions) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  // One canvas at a time; a new show joins the one already running.
  if (active) return active.add(options)
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '50' })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()

  let w = 0
  let h = 0
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const rockets: Rocket[] = []
  const sparks: Spark[] = []
  const timers: number[] = []
  const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

  function launch(o: FireworksOptions) {
    const x = w * (0.15 + Math.random() * 0.7)
    // Burst somewhere in the top half; climb just fast enough to get there.
    const apex = h * (0.12 + Math.random() * 0.3)
    const vy = -Math.sqrt(2 * GRAVITY * (h - apex)) * 1.04
    rockets.push({ x, y: h, vx: (Math.random() - 0.5) * 1.2, vy, color: pick(o.colors), trail: [] })
    burstStyle.set(rockets[rockets.length - 1], o)
  }
  const burstStyle = new WeakMap<Rocket, FireworksOptions>()

  function burst(r: Rocket, o: FireworksOptions) {
    const count = o.sparks ?? 90
    const second = Math.random() < 0.35 ? pick(o.colors) : r.color
    const power = 4 + Math.random() * 1.8
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1
      // Mostly a round shell, with some sparks inside it.
      const speed = power * (Math.random() < 0.8 ? 0.85 + Math.random() * 0.15 : Math.random() * 0.8)
      sparks.push({
        x: r.x,
        y: r.y,
        px: r.x,
        py: r.y,
        vx: Math.cos(angle) * speed + r.vx * 0.3,
        vy: Math.sin(angle) * speed + r.vy * 0.1,
        life: 1,
        decay: 0.011 + Math.random() * 0.008,
        color: i % 2 ? second : r.color,
        glitter: !!o.glitter,
      })
    }
  }

  function add(o: FireworksOptions) {
    for (let i = 0; i < o.shells; i++) {
      const at = o.shells === 1 ? 0 : (i / (o.shells - 1)) * o.overMs + Math.random() * 120
      timers.push(window.setTimeout(() => launch(o), at))
    }
    pending = Math.max(pending, performance.now() + o.overMs + 200)
  }
  let pending = 0
  active = { canvas, add }
  add(options)

  let last = performance.now()
  function frame(now: number) {
    const dt = Math.min(3, (now - last) / (1000 / 60))
    last = now
    // Fade what was drawn before into trails, keeping the page visible below.
    ctx!.globalCompositeOperation = 'destination-out'
    ctx!.fillStyle = `rgba(0,0,0,${0.28 * dt})`
    ctx!.fillRect(0, 0, w, h)
    ctx!.globalCompositeOperation = 'lighter'

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]
      r.trail.push({ x: r.x, y: r.y })
      if (r.trail.length > 8) r.trail.shift()
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.vy += GRAVITY * dt
      ctx!.strokeStyle = 'rgba(255,220,170,0.7)'
      ctx!.lineWidth = 2
      ctx!.beginPath()
      ctx!.moveTo(r.trail[0].x, r.trail[0].y)
      ctx!.lineTo(r.x, r.y)
      ctx!.stroke()
      dot(r.x, r.y, 2.2, '#fff6e0', 1)
      if (r.vy >= -0.4) {
        rockets.splice(i, 1)
        burst(r, burstStyle.get(r)!)
        flash(r.x, r.y, r.color)
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.px = s.x
      s.py = s.y
      const drag = Math.pow(DRAG, dt)
      s.vx *= drag
      s.vy = s.vy * drag + GRAVITY * 0.55 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.life -= s.decay * dt
      if (s.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      // Crackle: the dying sparks twinkle.
      const alpha = s.life < 0.35 ? s.life * 2 * (Math.random() < 0.5 ? 1 : 0.2) : Math.min(1, s.life * 1.4)
      ctx!.strokeStyle = s.color
      ctx!.globalAlpha = alpha
      ctx!.lineWidth = 2.6
      ctx!.lineCap = 'round'
      ctx!.beginPath()
      ctx!.moveTo(s.px, s.py)
      ctx!.lineTo(s.x, s.y)
      ctx!.stroke()
      ctx!.globalAlpha = 1
      // A hot white core right after the burst, burning down to the colour.
      if (s.life > 0.7) dot(s.x, s.y, 1, '#ffffff', (s.life - 0.7) * 2.5)
      if (s.glitter && Math.random() < 0.08) dot(s.x + (Math.random() - 0.5) * 6, s.y + Math.random() * 6, 1, '#fff1a8', alpha)
    }

    if (rockets.length || sparks.length || now < pending) {
      requestAnimationFrame(frame)
    } else {
      window.removeEventListener('resize', resize)
      timers.forEach(clearTimeout)
      canvas.remove()
      active = null
    }
  }

  function dot(x: number, y: number, radius: number, color: string, alpha: number) {
    ctx!.globalAlpha = alpha
    ctx!.fillStyle = color
    ctx!.beginPath()
    ctx!.arc(x, y, radius, 0, Math.PI * 2)
    ctx!.fill()
    ctx!.globalAlpha = 1
  }

  function flash(x: number, y: number, color: string) {
    const glow = ctx!.createRadialGradient(x, y, 0, x, y, 60)
    glow.addColorStop(0, color)
    glow.addColorStop(1, 'transparent')
    ctx!.globalAlpha = 0.5
    ctx!.fillStyle = glow
    ctx!.fillRect(x - 60, y - 60, 120, 120)
    ctx!.globalAlpha = 1
  }

  requestAnimationFrame(frame)
}
