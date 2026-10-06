import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Which way up the phone is held, from its motion sensor: how far (degrees
 * clockwise) the screen's content must turn, relative to the phone's natural
 * portrait position, to stand upright. Null until the phone is held up; a
 * phone lying flat keeps the last reading. `resetKey` forgets the reading, so
 * a phone that was put down falls back to the game's own setting.
 */
export function useDeviceTurn(resetKey: string): number | null {
  const [turn, setTurn] = useState<{ key: string; value: number | null }>({ key: resetKey, value: null })
  useEffect(() => {
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity
      if (!g || g.x == null || g.y == null) return
      const value = turnFromGravity(g.x, g.y)
      if (value !== null) setTurn((t) => (t.value === value && t.key === resetKey ? t : { key: resetKey, value }))
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [resetKey])
  return turn.key === resetKey ? turn.value : null
}

/**
 * At rest, `accelerationIncludingGravity` points up, in the phone's axes (x to
 * its right edge, y to its top). The axis pointing up the most is the content's
 * "up". Readings close to flat or to a diagonal are ignored.
 */
export function turnFromGravity(x: number, y: number): number | null {
  // About 25° from lying flat.
  if (Math.hypot(x, y) < 4) return null
  // Clearly one way or the other, not around 45°.
  if (Math.abs(x) > Math.abs(y) * 1.4) return x > 0 ? 90 : 270
  if (Math.abs(y) > Math.abs(x) * 1.4) return y > 0 ? 0 : 180
  return null
}

/** How far the browser itself has turned the page (degrees, 0 when upright). */
export function useScreenAngle(): number {
  return useSyncExternalStore(
    (onChange) => {
      const orientation = screen.orientation
      orientation?.addEventListener('change', onChange)
      window.addEventListener('orientationchange', onChange)
      return () => {
        orientation?.removeEventListener('change', onChange)
        window.removeEventListener('orientationchange', onChange)
      }
    },
    () => screen.orientation?.angle ?? 0,
  )
}

/** iPhones only share the motion sensor after asking; call from a tap. */
export function requestMotionAccess() {
  const motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  motion?.requestPermission?.().catch(() => {})
}
