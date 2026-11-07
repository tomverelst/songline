import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findProfile, profileKey, saveProfile } from './profiles'

beforeEach(() => {
  const items = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  })
})

describe('profiles (players remembered by name)', () => {
  it('finds a player again by name, however it is capitalised or spaced', () => {
    saveProfile('Tom', { color: 'cyan', celebration: 'knitting', knitPattern: '1'.repeat(120), cardArt: 'data:image/png;base64,x' })
    expect(profileKey('  TOM ')).toBe('tom')
    expect(findProfile(' tom')).toEqual({ color: 'cyan', celebration: 'knitting', knitPattern: '1'.repeat(120), cardArt: 'data:image/png;base64,x', emoji: undefined })
    expect(findProfile('Tomas')).toBeUndefined()
    expect(findProfile('')).toBeUndefined()
  })

  it('replaces what was remembered, dropping what is no longer set', () => {
    saveProfile('Lien', { color: 'pink', cardArt: 'data:x' })
    saveProfile('lien', { color: 'green', celebration: 'emoji', emoji: '🦖' })
    expect(findProfile('Lien')).toMatchObject({ color: 'green', emoji: '🦖', cardArt: undefined })
  })

  it('keeps the 40 most recent players', () => {
    for (let i = 0; i < 45; i++) saveProfile(`Player ${i}`, { color: 'red' }, 1000 + i)
    expect(findProfile('Player 0')).toBeUndefined()
    expect(findProfile('Player 5')).toBeDefined()
    expect(findProfile('Player 44')).toBeDefined()
  })
})
