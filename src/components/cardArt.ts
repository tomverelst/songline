import { createContext } from 'react'

// A player's own painted guess card (see CardPainter).

/** The drawing's size in pixels; shown scaled up, pixels and all. Same shape as the cards. */
export const ART_W = 174
export const ART_H = 246

/** The player's own card back (a PNG data URL), for CardBack inside it. */
export const CardArtContext = createContext<string | undefined>(undefined)

/** The paint bucket: fills the area of one colour around (x, y). */
export function floodFill(c: CanvasRenderingContext2D, x: number, y: number, hex: string) {
  if (x < 0 || y < 0 || x >= ART_W || y >= ART_H) return
  const image = c.getImageData(0, 0, ART_W, ART_H)
  const data = new Uint32Array(image.data.buffer)
  const target = data[y * ART_W + x]
  const n = parseInt(hex.slice(1), 16)
  // Little-endian ABGR, as the browser lays out the pixels.
  const fill = ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0
  if (target === fill) return
  const stack = [y * ART_W + x]
  while (stack.length) {
    const i = stack.pop()!
    if (data[i] !== target) continue
    data[i] = fill
    const px = i % ART_W
    if (px > 0) stack.push(i - 1)
    if (px < ART_W - 1) stack.push(i + 1)
    if (i >= ART_W) stack.push(i - ART_W)
    if (i < ART_W * (ART_H - 1)) stack.push(i + ART_W)
  }
  c.putImageData(image, 0, 0)
}
