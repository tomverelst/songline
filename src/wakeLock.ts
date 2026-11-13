import { useEffect } from 'react'

/**
 * Keeps the screen on while `active`. The browser lets go of the lock when the
 * page is hidden, so it's taken again whenever the page comes back.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let released = false
    const take = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (released) l.release().catch(() => {})
          else lock = l
        })
        .catch(() => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', take)
      lock?.release().catch(() => {})
    }
  }, [active])
}
