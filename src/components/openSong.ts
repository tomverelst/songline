import { createContext, useContext } from 'react'
import type { Song } from '../game/types'

export const OpenSong = createContext<((song: Song) => void) | null>(null)

/** Opens a song's sheet, or null outside a SongDetailsProvider. */
export function useOpenSong() {
  return useContext(OpenSong)
}
