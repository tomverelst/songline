import { useSyncExternalStore } from 'react'

/** Whether this browser can hide its address bar on request (iPhones can't). */
export function canFullscreen(): boolean {
  return !!document.fullscreenEnabled
}

/** Hides the address bar and system bars. Only works from a tap. */
export function enterFullscreen() {
  if (document.fullscreenElement || !canFullscreen()) return
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
}

export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

export function useFullscreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('fullscreenchange', onChange)
      return () => document.removeEventListener('fullscreenchange', onChange)
    },
    () => !!document.fullscreenElement,
  )
}
