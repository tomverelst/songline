import { fitOverlay, overlayCanvas } from './effectAngle'
/**
 * A techno-club laser show on a full-screen canvas: the page dims, and laser
 * heads all round the edge throw beams to a 128 BPM beat. Every head picks
 * its own pattern each bar (fan, criss-cross, scan, spin), beams cut in and
 * out on the sixteenths, colours jump on the beat, and a strobe flashes on
 * the beat (once a beat: never more than 3 flashes in any one second).
 */

export interface LaserOptions {
  durationMs: number
  /** Beam colours, picked at random on the beat. */
  colors: string[]
  /** More heads and beams, and a harder strobe. */
  big?: boolean
}

const BPM = 128
const BEAT_MS = 60_000 / BPM
const FADE_IN_MS = 200
const FADE_OUT_MS = 450
/** How long a strobe flash lasts. */
const STROBE_MS = 55

type Pattern = 'fan' | 'criss' | 'scan' | 'spin'
const PATTERNS: Pattern[] = ['fan', 'criss', 'scan', 'spin']

interface Head {
  /** Position as a fraction of the screen. */
  x: number
  y: number
  /** Where the head points (radians, 0 = right, screen y down). */
  aim: number
  beams: number
}

let active: { extend: (o: LaserOptions) => void } | null = null

export function lasers(options: LaserOptions) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  // A show that's already on just runs longer (and gets bigger if asked).
  if (active) return active.extend(options)

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
  const seed = Math.floor(Math.random() * 1e6)
  let end = start + options.durationMs
  let colors = options.colors.length ? options.colors : ['#ffffff']
  let big = !!options.big
  let heads = makeHeads(big)

  function stop() {
    window.removeEventListener('resize', resize)
    canvas.remove()
    active = null
  }

  active = {
    extend(o) {
      end = Math.max(end, performance.now() + o.durationMs)
      colors = [...new Set([...colors, ...o.colors])]
      if (o.big && !big) {
        big = true
        heads = makeHeads(true)
      }
    },
  }

  function frame(now: number) {
    try {
      draw(now)
    } catch (e) {
      // Never leave a dead show behind: it would swallow every later one.
      stop()
      throw e
    }
    if (now < end) requestAnimationFrame(frame)
    else stop()
  }

  function draw(now: number) {
    // A frame's timestamp can be from just before the show started.
    const t = Math.max(0, now - start)
    const envelope = clamp01(Math.min(t / FADE_IN_MS, (end - now) / FADE_OUT_MS))
    const beat = t / BEAT_MS
    const beatIndex = Math.floor(beat)
    const bar = Math.floor(beatIndex / 4)
    const sixteenth = Math.floor(beat * 4)
    // Each beat hits hard, then eases off.
    const pulse = 0.5 + 0.5 * Math.pow(1 - (beat - beatIndex), 2)

    ctx!.clearRect(0, 0, w, h)
    ctx!.globalCompositeOperation = 'source-over'
    ctx!.fillStyle = `rgba(5, 2, 12, ${0.6 * envelope})`
    ctx!.fillRect(0, 0, w, h)

    ctx!.globalCompositeOperation = 'lighter'
    const reach = Math.hypot(w, h) * 1.1
    heads.forEach((head, hi) => {
      const ox = head.x * w
      const oy = head.y * h
      const pattern = PATTERNS[Math.floor(rand(seed, bar, hi, 1) * PATTERNS.length)]
      const color = colors[Math.floor(rand(seed, beatIndex, hi, 2) * colors.length)]
      const flip = rand(seed, bar, hi, 3) < 0.5 ? -1 : 1
      for (let i = 0; i < head.beams; i++) {
        // Beams cut in and out on the sixteenths.
        if (rand(seed, sixteenth, hi * 31 + i, 4) < (big ? 0.22 : 0.15)) continue
        const angle = head.aim + flip * beamAngle(pattern, beat, i, head.beams)
        // Now and then a beam takes another colour from the palette.
        const beamColor = rand(seed, beatIndex, hi * 31 + i, 5) < 0.2 ? colors[(i + beatIndex) % colors.length] : color
        beam(ox, oy, ox + Math.cos(angle) * reach, oy + Math.sin(angle) * reach, beamColor, envelope * pulse)
      }
      // The laser head glows where the beams come out.
      const glow = ctx!.createRadialGradient(ox, oy, 0, ox, oy, 46)
      glow.addColorStop(0, rgba(color, 0.95 * envelope * pulse))
      glow.addColorStop(1, rgba(color, 0))
      ctx!.fillStyle = glow
      ctx!.fillRect(ox - 46, oy - 46, 92, 92)
    })

    // Strobe: a hard flash on the beat, after the first one. One flash a beat
    // (128 BPM) is at most 3 flashes in any one second: the limit for people
    // with photosensitive epilepsy. Never make it flash faster than the beat.
    const sinceBeat = (beat - beatIndex) * BEAT_MS
    if (beatIndex >= 1 && sinceBeat < STROBE_MS) {
      // Mostly white; now and then a colour from the palette.
      const flash = rand(seed, beatIndex, 0, 6) < 0.25 ? colors[beatIndex % colors.length] : '#ffffff'
      // The downbeat hits hardest.
      const strength = (beatIndex % 4 === 0 ? 0.95 : 0.82) * (big ? 1 : 0.85)
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.fillStyle = rgba(flash, strength * envelope)
      ctx!.fillRect(0, 0, w, h)
    }
  }

  function beam(x1: number, y1: number, x2: number, y2: number, color: string, alpha: number) {
    const fade = ctx!.createLinearGradient(x1, y1, x2, y2)
    fade.addColorStop(0, rgba(color, alpha))
    fade.addColorStop(0.55, rgba(color, alpha * 0.4))
    fade.addColorStop(1, rgba(color, 0))
    ctx!.strokeStyle = fade
    ctx!.lineCap = 'round'
    // A wide soft glow (the haze in the room), then the hot thin core.
    ctx!.globalAlpha = 0.2
    ctx!.lineWidth = 11
    line(x1, y1, x2, y2)
    ctx!.globalAlpha = 1
    ctx!.lineWidth = 1.8
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

/** Where beam `i` of `n` points, relative to its head's aim, for a pattern. */
function beamAngle(pattern: Pattern, beat: number, i: number, n: number): number {
  const mid = (n - 1) / 2
  switch (pattern) {
    case 'fan':
      // A fan swinging back and forth over two beats.
      return 0.45 * Math.sin((Math.PI * beat) / 2) + (i - mid) * 0.1
    case 'criss':
      // Every beam waves on its own, on the beat: beams cross all the time.
      return 0.7 * Math.sin(Math.PI * beat + i * 0.9) + (i - mid) * 0.05
    case 'scan':
      // A tight bundle racing from side to side, twice a beat.
      return 1.1 * triangle(beat * 2) + (i - mid) * 0.035
    case 'spin':
      // Beams all round, spinning a quarter turn a beat.
      return (Math.PI / 2) * beat + (i * 2 * Math.PI) / n
  }
}

function makeHeads(big: boolean): Head[] {
  const up = -Math.PI / 2
  const down = Math.PI / 2
  const heads: Head[] = [
    { x: 0, y: 1, aim: up + 0.5, beams: 6 },
    { x: 1, y: 1, aim: up - 0.5, beams: 6 },
    { x: 0, y: 0, aim: down - 0.6, beams: 5 },
    { x: 1, y: 0, aim: down + 0.6, beams: 5 },
  ]
  if (big) {
    heads.push(
      { x: 0.5, y: 1, aim: up, beams: 9 },
      { x: 0.5, y: 0, aim: down, beams: 7 },
      { x: 0, y: 0.5, aim: 0, beams: 6 },
      { x: 1, y: 0.5, aim: Math.PI, beams: 6 },
    )
  }
  return heads
}

/** -1 → 1 → -1 over one unit, in straight lines. */
function triangle(x: number) {
  const f = x - Math.floor(x)
  return f < 0.5 ? 4 * f - 1 : 3 - 4 * f
}

/** The same "random" number for the same inputs: patterns hold for their bar, beat or sixteenth. */
function rand(seed: number, a: number, b: number, c: number) {
  let x = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b) ^ Math.imul(c + 13, 0xc2b2ae35)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

/** "#33ff88" with an alpha, as rgba(). */
function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp01(alpha)})`
}
