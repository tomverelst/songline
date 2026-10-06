import { describe, expect, it } from 'vitest'
import { rotateVector } from './rotation'

describe('rotateVector', () => {
  it('turns clockwise on the screen (y points down)', () => {
    expect(rotateVector({ x: 1, y: 0 }, 90)).toEqual({ x: 0, y: 1 })
    expect(rotateVector({ x: 0, y: 1 }, 90)).toEqual({ x: -1, y: 0 })
    expect(rotateVector({ x: 1, y: 2 }, 180)).toEqual({ x: -1, y: -2 })
  })

  it('undoes a turn when turned back', () => {
    const v = { x: 3, y: -7 }
    for (const angle of [0, 90, 180, 270]) expect(rotateVector(rotateVector(v, angle), -angle)).toEqual(v)
  })
})
