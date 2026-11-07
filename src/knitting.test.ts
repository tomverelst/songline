import { describe, expect, it } from 'vitest'
import { isKnitPattern, KNIT_PRESETS, PATTERN_COLS, PATTERN_ROWS, patternColor, YARN_COLORS } from './knitting'

describe('knitting patterns', () => {
  it('has presets that are all whole, knittable patterns', () => {
    for (const preset of KNIT_PRESETS) expect(isKnitPattern(preset.pattern), preset.name).toBe(true)
  })

  it('repeats a pattern down and across the scarf', () => {
    const pattern = Array.from({ length: PATTERN_COLS * PATTERN_ROWS }, (_, i) => (i === 0 ? '6' : '1')).join('')
    expect(patternColor(pattern, 0, 0)).toBe(YARN_COLORS[6])
    expect(patternColor(pattern, PATTERN_ROWS, PATTERN_COLS)).toBe(YARN_COLORS[6])
    expect(patternColor(pattern, 1, 0)).toBe(YARN_COLORS[1])
  })

  it('turns down patterns it cannot knit', () => {
    expect(isKnitPattern('123')).toBe(false)
    expect(isKnitPattern('9'.repeat(PATTERN_COLS * PATTERN_ROWS))).toBe(false)
    expect(isKnitPattern(undefined)).toBe(false)
  })
})
