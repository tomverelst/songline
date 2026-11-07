import { useSyncExternalStore } from 'react'

/**
 * How much bigger the interface is than on a phone: the root font size over
 * the default 16px. Tablets get a bigger root size (see index.css), and
 * everything sized in rem grows with it. Sizes worked out in JavaScript
 * (card positions while dragging, say) multiply by this to keep up.
 */
export function useUiScale(): number {
  return useSyncExternalStore(subscribe, uiScale, () => 1)
}

export function uiScale(): number {
  return (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16
}

function subscribe(onChange: () => void) {
  // The root size changes with the screen size (e.g. turning a tablet).
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}
