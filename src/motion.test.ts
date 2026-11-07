import { describe, expect, it } from 'vitest'
import { shortestTurn, turnFromGravity } from './motion'

describe('turnFromGravity', () => {
  it('turns the content upright however the phone is held', () => {
    expect(turnFromGravity(0, 9.8)).toBe(0) // upright
    expect(turnFromGravity(0, -9.8)).toBe(180) // upside down
    expect(turnFromGravity(9.8, 0)).toBe(90) // turned left: right edge up
    expect(turnFromGravity(-9.8, 0)).toBe(270) // turned right: left edge up
  })

  it('ignores a phone lying flat or held at a diagonal', () => {
    expect(turnFromGravity(1, 2)).toBeNull()
    expect(turnFromGravity(6, 6)).toBeNull()
  })
})

describe('shortestTurn (the screen turns the shortest way round)', () => {
  it('goes on past 360° or below 0° rather than back the long way', () => {
    expect(shortestTurn(270, 0)).toBe(360)
    expect(shortestTurn(0, 270)).toBe(-90)
    expect(shortestTurn(360, 90)).toBe(450)
    expect(shortestTurn(-90, 180)).toBe(-180)
  })

  it('stays put, or makes a half turn, when that is all there is', () => {
    expect(shortestTurn(450, 90)).toBe(450)
    expect(Math.abs(shortestTurn(0, 180))).toBe(180)
    expect(shortestTurn(90, 180)).toBe(180)
  })
})
