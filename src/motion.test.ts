import { describe, expect, it } from 'vitest'
import { turnFromGravity } from './motion'

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
