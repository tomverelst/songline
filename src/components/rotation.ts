import { createContext, useContext } from 'react'

/**
 * How far the game screen is turned, in degrees clockwise (0, 90, 180 or
 * 270). Touches arrive in screen coordinates, so anything that follows a
 * finger needs this to map them onto the turned screen.
 */
export const ScreenRotation = createContext(0)

export function useScreenRotation() {
  return useContext(ScreenRotation)
}

export interface Point {
  x: number
  y: number
}

/** Turns a vector clockwise by `degrees` (screen y points down). */
export function rotateVector({ x, y }: Point, degrees: number): Point {
  const r = (degrees * Math.PI) / 180
  const cos = Math.round(Math.cos(r) * 1e9) / 1e9
  const sin = Math.round(Math.sin(r) * 1e9) / 1e9
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

/**
 * A point on the screen in `el`'s own coordinates (from its top left, as if
 * the screen weren't turned by `degrees`).
 */
export function toLocal(point: Point, el: HTMLElement, degrees: number): Point {
  const rect = el.getBoundingClientRect()
  const fromCenter = { x: point.x - (rect.left + rect.width / 2), y: point.y - (rect.top + rect.height / 2) }
  const local = rotateVector(fromCenter, -degrees)
  return { x: local.x + el.offsetWidth / 2, y: local.y + el.offsetHeight / 2 }
}
