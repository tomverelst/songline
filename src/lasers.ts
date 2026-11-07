/**
 * A techno-club laser show on a full-screen canvas: the page dims, and fans
 * of beams sweep from the corners in time with a 128 BPM beat, switching
 * colour on the beat.
 */

export interface LaserOptions {
  durationMs: number
  /** Beam colours, cycled on the beat. */
  colors: string[]
  /** More emitters and beams, and a soft flash on every downbeat. */
  big?: boolean
}

const BPM = 128
const BEAT_MS = 60_000 / BPM
const FADE_IN_MS = 250
const FADE_OUT_MS = 500

interface Emitter {
  /** Position as a fraction of the screen. */
  x: number
  y: number
  /** Where the fan points (radians, 0 = right, screen y down). */
  aim: number
  beams: number
  /** Angle between neighbouring beams. */
  spread: number
  /** How far the fan swings either way, and where in the swing it starts. */
  swing: number
  phase: number
  colorOffset: number
}

let active: { extend: (o: LaserOptions) => void } | null = null

export function lasers(options: LaserOptions) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  // A show that's already on just runs longer (and gets bigger if asked).
  if (active) return active.extend(options)

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

  const start = performance.now()
  let end = start + options.durationMs
  let colors = options.colors
  let big = !!options.big
  let emitters = makeEmitters(big)
  active = {
    extend(o) {
      end = Math.max(end, performance.now() + o.durationMs)
      colors = [...new Set([...colors, ...o.colors])]
      if (o.big && !big) {
        big = true
        emitters = makeEmitters(true)
      }
    },
  }

  function frame(now: number) {
    const t = now - start
    // Fade the whole show in and out.
    const envelope = Math.min(1, t / FADE_IN_MS, Math.max(0, (end - now) / FADE_OUT_MS))
    const beat = t / BEAT_MS
    const beatIndex = Math.floor(beat)
    // Each beat hits hard, then eases off.
    const pulse = 0.55 + 0.45 * Math.pow(1 - (beat - beatIndex), 2)

    ctx!.clearRect(0, 0, w, h)
    ctx!.globalCompositeOperation = 'source-over'
    ctx!.fillStyle = `rgba(5, 2, 12, ${0.55 * envelope})`
    ctx!.fillRect(0, 0, w, h)

    ctx!.globalCompositeOperation = 'lighter'
    const reach = Math.hypot(w, h) * 1.1
    for (const e of emitters) {
      const ox = e.x * w
      const oy = e.y * h
      const color = colors[(beatIndex + e.colorOffset) % colors.length]
      // Swing over two beats, so the fans sweep to the music.
      const sweep = e.swing * Math.sin((Math.PI * beat) / 2 + e.phase)
      for (let i = 0; i < e.beams; i++) {
        const angle = e.aim + sweep + (i - (e.beams - 1) / 2) * e.spread
        beam(ox, oy, ox + Math.cos(angle) * reach, oy + Math.sin(angle) * reach, color, envelope * pulse)
      }
      // The laser head glows where the beams come out.
      const glow = ctx!.createRadialGradient(ox, oy, 0, ox, oy, 40)
      glow.addColorStop(0, withAlpha(color, 0.9 * envelope))
      glow.addColorStop(1, withAlpha(color, 0))
      ctx!.fillStyle = glow
      ctx!.fillRect(ox - 40, oy - 40, 80, 80)
    }

    // The big show flashes softly on every downbeat (once a bar, not a strobe).
    if (big && beatIndex % 4 === 0 && beat - beatIndex < 0.12) {
      ctx!.fillStyle = `rgba(255, 255, 255, ${0.12 * envelope})`
      ctx!.fillRect(0, 0, w, h)
    }

    if (now < end) {
      requestAnimationFrame(frame)
    } else {
      window.removeEventListener('resize', resize)
      canvas.remove()
      active = null
    }
  }

  function beam(x1: number, y1: number, x2: number, y2: number, color: string, alpha: number) {
    const fade = ctx!.createLinearGradient(x1, y1, x2, y2)
    fade.addColorStop(0, withAlpha(color, alpha))
    fade.addColorStop(0.6, withAlpha(color, alpha * 0.35))
    fade.addColorStop(1, withAlpha(color, 0))
    ctx!.strokeStyle = fade
    ctx!.lineCap = 'round'
    // A wide soft glow (the haze in the room), then the hot thin core.
    ctx!.globalAlpha = 0.18
    ctx!.lineWidth = 10
    line(x1, y1, x2, y2)
    ctx!.globalAlpha = 1
    ctx!.lineWidth = 1.6
    line(x1, y1, x2, y2)
  }

  function line(x1: number, y1: number, x2: number, y2: number) {
    ctx!.beginPath()
    ctx!.moveTo(x1, y1)
    ctx!.lineTo(x2, y2)
    ctx!.stroke()
  }

  requestAnimationFrame(frame)
}

function makeEmitters(big: boolean): Emitter[] {
  const up = -Math.PI / 2
  const emitters: Emitter[] = [
    // Bottom corners, aiming up and inwards.
    { x: 0, y: 1, aim: up + 0.45, beams: big ? 7 : 5, spread: 0.09, swing: 0.35, phase: 0, colorOffset: 0 },
    { x: 1, y: 1, aim: up - 0.45, beams: big ? 7 : 5, spread: 0.09, swing: 0.35, phase: Math.PI, colorOffset: 1 },
  ]
  if (big) {
    // Top corners and the middle of the stage join in.
    emitters.push(
      { x: 0, y: 0, aim: 0.6, beams: 5, spread: 0.11, swing: 0.4, phase: Math.PI / 2, colorOffset: 2 },
      { x: 1, y: 0, aim: Math.PI - 0.6, beams: 5, spread: 0.11, swing: 0.4, phase: -Math.PI / 2, colorOffset: 3 },
      { x: 0.5, y: 1, aim: up, beams: 9, spread: 0.12, swing: 0.5, phase: Math.PI / 4, colorOffset: 1 },
    )
  }
  return emitters
}

/** "#33ff88" with an alpha, as rgba(). */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`
}
