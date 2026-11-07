import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteProfile, findProfile, loadRoster, profileKey, recordGame, saveProfile } from './profiles'

beforeEach(() => {
  const items = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  })
})

describe('the players on this phone', () => {
  it('finds a player by name, however it is capitalised or spaced', () => {
    saveProfile('Tom', { color: 'cyan', celebration: 'knitting', knitPattern: '1'.repeat(120), cardArt: 'data:image/png;base64,x' })
    expect(profileKey('  TOM ')).toBe('tom')
    expect(findProfile(' tom')).toMatchObject({ name: 'Tom', color: 'cyan', celebration: 'knitting', cardArt: 'data:image/png;base64,x' })
    expect(findProfile('Tomas')).toBeUndefined()
    expect(findProfile('')).toBeUndefined()
  })

  it('lists everyone in the order they were made, keeping that order through changes', () => {
    saveProfile('Lien', { color: 'pink' }, 1000)
    saveProfile('Tom', { color: 'cyan' }, 2000)
    saveProfile('Lien', { color: 'green' }, 3000)
    expect(loadRoster().map((p) => [p.name, p.color])).toEqual([
      ['Lien', 'green'],
      ['Tom', 'cyan'],
    ])
  })

  it('counts games and wins, and keeps them through changes and a new name', () => {
    saveProfile('Ann', { color: 'red' })
    saveProfile('Bob', {})
    recordGame(['Ann', 'Bob', 'Nobody'], ['ann'])
    recordGame(['Ann', 'Bob'], ['Bob'])
    saveProfile('Annie', { color: 'blue' }, Date.now(), 'Ann')
    expect(findProfile('Ann')).toBeUndefined()
    expect(findProfile('Annie')).toMatchObject({ color: 'blue', games: 2, wins: 1 })
    expect(findProfile('Bob')).toMatchObject({ games: 2, wins: 1 })
  })

  it('deletes a player', () => {
    saveProfile('Sara', { cardArt: 'data:x' })
    deleteProfile('SARA')
    expect(loadRoster()).toEqual([])
  })
})
