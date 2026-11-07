import { describe, expect, it } from 'vitest'
import { firstEmoji } from './emojiRain'

describe('firstEmoji (typing your own emoji for emoji rain)', () => {
  it('takes the first emoji, skipping other text', () => {
    expect(firstEmoji('🔥🔥🔥')).toBe('🔥')
    expect(firstEmoji('go 🦖 go')).toBe('🦖')
    expect(firstEmoji('no emoji here')).toBeNull()
    expect(firstEmoji('')).toBeNull()
  })

  it('keeps emoji made of several characters whole', () => {
    expect(firstEmoji('🇧🇪')).toBe('🇧🇪') // a flag
    expect(firstEmoji('👍🏽')).toBe('👍🏽') // a skin tone
    expect(firstEmoji('👨‍👩‍👧')).toBe('👨‍👩‍👧') // a family
    expect(firstEmoji('❤️')).toBe('❤️')
  })
})
