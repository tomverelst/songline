/**
 * Knitting on a full-screen canvas: a striped scarf is knitted down from the
 * top of the screen, stitch by stitch and row by row, with two needles
 * clicking at the working row and a ball of yarn at the bottom that wobbles
 * as the yarn is pulled up to them. Two players' scarves can be knitted at
 * once (Battle).
 */

export interface KnittingOptions {
  /** Scarves knitted side by side. */
  scarves: number
  /** Stitches across, and rows down, per scarf. */
  cols: number
  rows: number
  /** How long knitting one scarf takes; scarves start a little apart. */
  knitMs: number
  /** Yarn colours: the stripes, a few rows each. */
  colors: string[]
  /** A heart knitted into the middle, in the first colour on the second. */
  heart?: boolean
  /** How long the finished scarves stay. */
  holdMs: number
}

interface Scarf {
  x: number
  /** Stitch width; a row is a bit less tall. */
  s: number
  cols: number
  rows: number
  colorAt: (row: number, col: number) => string
  at: number
  knitMs: number
  fadeAt: number
  /** Where the ball of yarn lies along the bottom. */
  ballX: number
}

const FADE_MS = 600
const WOOD = '#d9a066'
const WOOD_DARK = '#a8743f'

/** A heart, 9 stitches across and 8 rows down. */
const HEART = ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....']

let active: { add: (o: KnittingOptions) => void } | null = null
const stitchSprites = new Map<string, HTMLCanvasElement>()

export function knitting(options: KnittingOptions) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
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

  const start = performance.now()
  const scarves: Scarf[] = []
  let endAt = 0

  function add(o: KnittingOptions) {
    const now = performance.now() - start
    // Side by side across most of the width (one alone stays scarf-narrow),
    // never so long they run into the yarn balls at the bottom.
    const lane = (w * 0.9) / o.scarves
    const s = Math.min(lane / (o.cols + 2), (w * 0.5) / o.cols, (h * 0.66) / (o.rows * 0.8), 30)
    for (let i = 0; i < o.scarves; i++) {
      const jitter = o.scarves > 1 ? (Math.random() - 0.5) * lane * 0.15 : (Math.random() - 0.5) * w * 0.2
      const x = w * 0.05 + lane * (i + 0.5) - (o.cols * s) / 2 + jitter
      const offset = Math.floor(Math.random() * o.colors.length)
      const stripe = (row: number) => o.colors[(Math.floor(row / 3) + offset + i) % o.colors.length]
      const heartTop = Math.floor((o.rows - HEART.length) / 2)
      const heartLeft = Math.floor((o.cols - HEART[0].length) / 2)
      const colorAt = o.heart
        ? (row: number, col: number) => (HEART[row - heartTop]?.[col - heartLeft] === '#' ? o.colors[0] : o.colors[1])
        : (row: number) => stripe(row)
      scarves.push({
        x,
        s,
        cols: o.cols,
        rows: o.rows,
        colorAt,
        at: now + i * 250 + Math.random() * 150,
        knitMs: o.knitMs,
        fadeAt: 0,
        ballX: Math.max(30, Math.min(w - 30, x + o.cols * s + 20 + (Math.random() - 0.5) * 40)),
      })
      endAt = Math.max(endAt, now + i * 250 + 150 + o.knitMs + o.holdMs)
    }
    for (const sc of scarves) sc.fadeAt = endAt
  }

  function stop() {
    window.removeEventListener('resize', resize)
    canvas.remove()
    active = null
  }

  active = { add }
  add(options)

  function frame(now: number) {
    const t = Math.max(0, now - start)
    try {
      ctx!.clearRect(0, 0, w, h)
      for (const sc of scarves) {
        if (t < sc.at) continue
        ctx!.globalAlpha = Math.max(0, Math.min(1, 1 - (t - sc.fadeAt) / FADE_MS))
        drawScarf(sc, t)
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

  function drawScarf(sc: Scarf, t: number) {
    const total = sc.cols * sc.rows
    const done = Math.min(total, Math.floor(((t - sc.at) / sc.knitMs) * total))
    const rowH = sc.s * 0.8
    // Knitted from the top edge down: the first row hangs just above the screen.
    const top = -rowH * 0.4
    for (let i = 0; i < done; i++) {
      const row = Math.floor(i / sc.cols)
      // Rows go back and forth, like real knitting.
      const col = row % 2 ? sc.cols - 1 - (i % sc.cols) : i % sc.cols
      const sprite = stitchSprite(sc.colorAt(row, col))
      // The newest stitches pop in.
      const age = done - i
      const grow = age < 6 ? 0.6 + age * 0.07 : 1
      const sw = sc.s * 1.08 * grow
      const sh = rowH * 1.35 * grow
      ctx!.drawImage(sprite, sc.x + col * sc.s + (sc.s - sw) / 2, top + row * rowH + (rowH - sh) / 2, sw, sh)
    }

    const knitting = done < total
    const row = Math.min(sc.rows - 1, Math.floor(done / sc.cols))
    const inRow = done % sc.cols
    const col = row % 2 ? sc.cols - 1 - inRow : inRow
    const needleY = top + (row + 1) * rowH
    const stitchX = sc.x + (col + 0.5) * sc.s

    // The yarn, from the ball at the bottom up to the stitch being knitted, in
    // this row's colour (the edge stitch: never the heart).
    const yarn = sc.colorAt(row, 0)
    const ballY = h - 34
    const pull = knitting ? Math.sin(t / 45) * 2 : 0
    ctx!.strokeStyle = yarn
    ctx!.lineWidth = 2.5
    ctx!.lineCap = 'round'
    ctx!.beginPath()
    ctx!.moveTo(sc.ballX, ballY - 16)
    ctx!.quadraticCurveTo((sc.ballX + stitchX) / 2 + 30, (ballY + needleY) / 2 + 40, stitchX, needleY)
    ctx!.stroke()
    drawBall(sc.ballX + pull, ballY, 22, yarn, knitting ? t / 300 : 0)

    // The needles cross at the working row; they click while knitting.
    if (knitting || t < sc.at + sc.knitMs + 400) {
      const click = knitting ? Math.sin(t / 55) * 0.12 : 0
      const len = Math.min(sc.cols * sc.s * 0.7 + 60, 260)
      drawNeedle(stitchX, needleY, len, -0.3 + click, -1)
      drawNeedle(stitchX, needleY, len, 0.3 - click, 1)
    }
  }

  function drawNeedle(x: number, y: number, len: number, angle: number, side: number) {
    ctx!.save()
    ctx!.translate(x, y)
    ctx!.rotate(angle)
    // The tips cross just past the stitch.
    ctx!.strokeStyle = WOOD_DARK
    ctx!.lineWidth = 9
    ctx!.lineCap = 'round'
    ctx!.beginPath()
    ctx!.moveTo(-side * 22, 0)
    ctx!.lineTo(side * len, 0)
    ctx!.stroke()
    ctx!.strokeStyle = WOOD
    ctx!.lineWidth = 6
    ctx!.stroke()
    // A sheen along the wood.
    ctx!.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx!.lineWidth = 1.5
    ctx!.beginPath()
    ctx!.moveTo(-side * 18, -1.5)
    ctx!.lineTo(side * (len - 8), -1.5)
    ctx!.stroke()
    // A knob on the far end.
    ctx!.fillStyle = '#ff5d8f'
    ctx!.beginPath()
    ctx!.arc(side * len, 0, 8.5, 0, Math.PI * 2)
    ctx!.fill()
    ctx!.restore()
  }

  function drawBall(x: number, y: number, r: number, color: string, spin: number) {
    ctx!.save()
    ctx!.translate(x, y)
    ctx!.fillStyle = color
    ctx!.beginPath()
    ctx!.arc(0, 0, r, 0, Math.PI * 2)
    ctx!.fill()
    // Wound strands across it, turning as yarn comes off.
    ctx!.clip()
    ctx!.rotate(spin)
    ctx!.strokeStyle = 'rgba(0, 0, 0, 0.22)'
    ctx!.lineWidth = 1.6
    for (let i = -3; i <= 3; i++) {
      ctx!.beginPath()
      ctx!.ellipse(i * 6, 0, r * 0.5, r * 1.1, 0.5, 0, Math.PI * 2)
      ctx!.stroke()
    }
    ctx!.restore()
    // A soft highlight.
    ctx!.fillStyle = 'rgba(255, 255, 255, 0.25)'
    ctx!.beginPath()
    ctx!.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, Math.PI * 2)
    ctx!.fill()
  }

  requestAnimationFrame(frame)
}

/** One knit stitch, a V of two loops, drawn once per colour and reused. */
function stitchSprite(color: string): HTMLCanvasElement {
  let sprite = stitchSprites.get(color)
  if (sprite) return sprite
  sprite = document.createElement('canvas')
  sprite.width = 40
  sprite.height = 44
  const c = sprite.getContext('2d')!
  for (const side of [-1, 1]) {
    c.save()
    c.translate(20 + side * 8.5, 21)
    c.rotate(side * -0.5)
    const loop = c.createLinearGradient(-8, 0, 8, 0)
    loop.addColorStop(0, shade(color, -0.25))
    loop.addColorStop(0.5, color)
    loop.addColorStop(1, shade(color, 0.2))
    c.fillStyle = loop
    c.beginPath()
    c.ellipse(0, 0, 8.5, 17, 0, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = shade(color, -0.4)
    c.lineWidth = 1.5
    c.stroke()
    // The twist of the yarn.
    c.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(-3, -10)
    c.quadraticCurveTo(2, 0, -2, 10)
    c.stroke()
    c.restore()
  }
  stitchSprites.set(color, sprite)
  return sprite
}

/** A hex colour lighter (amount > 0) or darker (< 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const channel = (v: number) => Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount))
  const r = channel((n >> 16) & 255)
  const g = channel((n >> 8) & 255)
  const b = channel(n & 255)
  return `rgb(${r}, ${g}, ${b})`
}
