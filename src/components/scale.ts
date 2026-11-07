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

/** Tablet-sized screens: the same rule as the bigger root size in index.css. */
const TABLET_QUERY = '(min-width: 768px) and (min-height: 600px)'

export function useIsTablet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(TABLET_QUERY)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(TABLET_QUERY).matches,
    () => false,
  )
}

/** Cards on a tablet are this much bigger again than the rest of the UI. */
export const TABLET_CARDS = 1.4

/** How much bigger cards are drawn than the rest of the UI: only on tablets. */
export function useCardScale(): number {
  return useIsTablet() ? TABLET_CARDS : 1
}
