import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({ getAccessToken: () => Promise.resolve('token') }))

const { playSong } = await import('./api')

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
