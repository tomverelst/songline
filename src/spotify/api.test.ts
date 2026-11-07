import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({ getAccessToken: () => Promise.resolve('token') }))

const { describePlaybackError, pause, playSong, resume, SpotifyError } = await import('./api')

const empty = (status = 204) => Promise.resolve(new Response(null, { status }))
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
const badGateway = () => json({ error: { status: 502, message: 'Bad gateway.' } }, 502)
const restricted = () =>
  json({ error: { status: 403, message: 'Player command failed: Restriction violated', reason: 'UNKNOWN' } }, 403)
const premium = () =>
  json({ error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } }, 403)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function stubFetch(...responses: (() => Promise<Response>)[]) {
  const fetch = vi.fn()
  responses.forEach((r) => fetch.mockImplementationOnce(r))
  fetch.mockImplementation(() => empty()) // repeat=track and anything else
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const calls = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace('https://api.spotify.com/v1', '')}`)

describe('playSong', () => {
  it('wakes the device and retries after a 502', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 100 })
    const fetch = stubFetch(badGateway, () => empty(204), () => empty(204), () => empty(204))
    await playSong('spotify:track:x', 'dev1')
    expect(calls(fetch).slice(0, 4)).toEqual([
      'PUT /me/player/play?device_id=dev1',
      'GET /me/player',
      'PUT /me/player',
      'PUT /me/player/play?device_id=dev1',
    ])
  })

  it('accepts a 502 when the song started anyway', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 100 })
    const fetch = stubFetch(badGateway, () => json({ is_playing: true, item: { uri: 'spotify:track:x' } }))
    await playSong('spotify:track:x', 'dev1')
    expect(calls(fetch)).not.toContain('PUT /me/player')
  })

  it('gives up after one retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 100 })
    stubFetch(badGateway, () => empty(204), () => empty(204), badGateway)
    await expect(playSong('spotify:track:x', 'dev1')).rejects.toMatchObject({ status: 502 })
  })
})

describe('player commands', () => {
  it('ignores a non-JSON success body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('MTc2...', { status: 200 }))))
    await expect(pause('dev1')).resolves.toBeUndefined()
  })
})

describe('403 errors', () => {
  it('only blames Premium when Spotify says so', () => {
    const restriction = new SpotifyError(403, 'Player command failed: Restriction violated', 'UNKNOWN')
    expect(describePlaybackError(restriction)).not.toMatch(/Premium/)
    expect(describePlaybackError(new SpotifyError(403, 'Player command failed: Premium required', 'PREMIUM_REQUIRED'))).toMatch(
      /Premium/,
    )
  })

  it('accepts a refused pause when the player is already paused', async () => {
    stubFetch(restricted, () => json({ is_playing: false }))
    await expect(pause('dev1')).resolves.toBeUndefined()
  })

  it('still reports a refused resume when nothing plays', async () => {
    stubFetch(restricted, () => json({ is_playing: false }))
    await expect(resume('dev1')).rejects.toMatchObject({ status: 403 })
  })

  it('retries a song refused with a restriction, but not one that needs Premium', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 100 })
    const fetch = stubFetch(restricted, () => empty(204), () => empty(204), () => empty(204))
    await playSong('spotify:track:x', 'dev1')
    expect(calls(fetch).filter((c) => c.startsWith('PUT /me/player/play'))).toHaveLength(2)
    stubFetch(premium)
    await expect(playSong('spotify:track:x', 'dev1')).rejects.toMatchObject({ reason: 'PREMIUM_REQUIRED' })
  })
})
