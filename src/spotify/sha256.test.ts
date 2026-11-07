import { describe, expect, it } from 'vitest'
import { sha256 } from './sha256'

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const hash = (text: string) => hex(sha256(new TextEncoder().encode(text)))

describe('sha256 (login on browsers without crypto.subtle)', () => {
  it('matches the known test vectors', () => {
    expect(hash('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(hash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('pads right around the 64-byte block edges', () => {
    for (const [n, expected] of [
      [1, 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'],
      [55, '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'],
      [56, 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'],
      [63, '7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34'],
      [64, 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
      [65, '635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0'],
      [119, '31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb'],
      [128, '6836cf13bac400e9105071cd6af47084dfacad4e5e302c94bfed24e013afb73e'],
    ] as const) {
      expect(hash('a'.repeat(n))).toBe(expected)
    }
  })

  it('hashes a PKCE code like the browser does', () => {
    expect(hash('dBjftJeZ4CVPmB92K27uhbUJU1p1rwW1gFWFOEjXkdBjftJeZ4CVPmB92K27uhbUJ')).toBe('2b30bdcdf8b742675e912231492d9e09dc0f1f2ebf1f34ebf90acea87483d107')
  })
})
