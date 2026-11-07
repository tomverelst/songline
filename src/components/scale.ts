import { useSyncExternalStore } from 'react'

// The breakpoints live in CSS (index.css: the `tablet` variant). Layout uses
// them as `tablet:` classes; the few things JavaScript has to know (sizes for
// card maths, swiping instead of year buttons) come from the variables those
// breakpoints set on the root, so they're never defined twice.

/**
 * How much bigger the interface is than on a phone: the root font size over
 * the default 16px. Everything sized in rem grows with it; sizes worked out
 * in JavaScript (card positions while dragging, say) multiply by this.
 */
export function useUiScale(): number {
  return useSyncExternalStore(subscribe, uiScale, () => 1)
}

export function uiScale(): number {
  return (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16
}

/** How much bigger cards are drawn than the rest of the UI (--card-scale: bigger on tablets). */
export function useCardScale(): number {
  return useSyncExternalStore(subscribe, () => rootNumber('--card-scale') || 1, () => 1)
}

/** Whether the cards alone pick the year, with no year buttons or ruler (--cards-only: tablets). */
export function useCardsOnly(): boolean {
  return useSyncExternalStore(subscribe, () => rootNumber('--cards-only') === 1, () => false)
}

function rootNumber(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
}

function subscribe(onChange: () => void) {
  // The breakpoints change with the screen size (e.g. turning a tablet).
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}
