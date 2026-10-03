import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({ getAccessToken: () => Promise.resolve('token') }))

const { playSong, startSong } = await import('./api')

const empty = (status = 204) => Promise.resolve(new Response(null, { status }))
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
const badGateway = () => json({ error: { status: 502, message: 'Bad gateway.' } }, 502)

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

describe('startSong', () => {
  const noActiveDevice = () =>
    json({ error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } }, 404)

  it('plays on a device Spotify can see when none counts as active', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 100 })
    const fetch = stubFetch(noActiveDevice, () =>
      json({ devices: [{ id: 'phone', name: 'iPhone', type: 'Smartphone', is_active: false },
                       { id: 'laptop', name: 'MacBook', type: 'Computer', is_active: false }] }),
    )
    expect(await startSong('spotify:track:x')).toBe('laptop')
    expect(calls(fetch).slice(0, 4)).toEqual([
      'PUT /me/player/play',
      'GET /me/player/devices',
      'PUT /me/player',
      'PUT /me/player/play?device_id=laptop',
    ])
  })

  it('reports when the account has no devices at all', async () => {
    stubFetch(noActiveDevice, () => json({ devices: [] }))
    await expect(startSong('spotify:track:x')).rejects.toMatchObject({ reason: 'NO_DEVICES' })
  })
})
