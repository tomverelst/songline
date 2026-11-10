import confetti from 'canvas-confetti'

// Party effects draw on a canvas over the whole screen. When the game screen
// is turned (towards the player's side of the table, upside down every other
// turn, or in Battle for the top player), the effects turn with it, so they
// rain down towards whoever celebrates.

let current = 0

/** Quarter turns only: 0, 90, 180 or 270. */
function normalize(deg: number) {
  return (((Math.round(deg / 90) * 90) % 360) + 360) % 360
}

/** How far (degrees clockwise) the effects started from now on are turned. */
export function setEffectAngle(deg: number) {
  current = normalize(deg)
}

/** The angle effects started now are turned by. */
export function effectAngle() {
  return current
}

/**
 * A canvas over the whole screen, turned by `angle` (default: the current
 * effect angle) and added to the page. Call `fitOverlay` to size it.
 */
export function overlayCanvas(angle = current): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.angle = String(normalize(angle))
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    pointerEvents: 'none',
    zIndex: '50',
  })
  document.body.appendChild(canvas)
  return canvas
}

/**
 * Sizes an overlay canvas to the screen as seen turned by its angle (on its
 * side, width and height swap) and returns that size in CSS pixels.
 */
export function fitOverlay(canvas: HTMLCanvasElement, dpr: number): { w: number; h: number } {
  const angle = Number(canvas.dataset.angle ?? 0)
  const sideways = angle % 180 !== 0
  const w = sideways ? window.innerHeight : window.innerWidth
  const h = sideways ? window.innerWidth : window.innerHeight
  Object.assign(canvas.style, {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
  })
  canvas.width = w * dpr
  canvas.height = h * dpr
  return { w, h }
}

const cannons = new Map<number, confetti.CreateTypes>()

/** canvas-confetti, turned by `angle`: its own canvas when not upright. */
export function confettiAt(angle = current): typeof confetti {
  angle = normalize(angle)
  if (angle === 0) return confetti
  let cannon = cannons.get(angle)
  if (!cannon) {
    const canvas = overlayCanvas(angle)
    const fit = () => fitOverlay(canvas, 1)
    fit()
    window.addEventListener('resize', fit)
    cannon = confetti.create(canvas, { resize: false, useWorker: false })
    cannons.set(angle, cannon)
  }
  return cannon as unknown as typeof confetti
}
