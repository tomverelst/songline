import type { Song } from '../game/types'
import { getAccessToken } from './auth'

const API = 'https://api.spotify.com/v1'

export class SpotifyError extends Error {
  status: number
  reason?: string
  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.status = status
    this.reason = reason
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (res.status === 401 && retry) {
    await getAccessToken(true)
    return request(path, init, false)
  }
  if (res.status === 429 && retry) {
    const wait = Number(res.headers.get('Retry-After') || '1')
    await new Promise((r) => setTimeout(r, wait * 1000))
    return request(path, init, false)
  }
  if (!res.ok) {
    let message = `Spotify request failed (${res.status})`
    let reason: string | undefined
    try {
      const body = await res.json()
      message = body.error?.message || message
      reason = body.error?.reason
    } catch {
      /* empty body */
    }
    throw new SpotifyError(res.status, message, reason)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

interface Page<T> {
  items: T[]
  next: string | null
}

async function allPages<T>(first: string): Promise<T[]> {
  const items: T[] = []
  let next: string | null = first
  while (next) {
    const page: Page<T> = await request<Page<T>>(next)
    items.push(...page.items)
    next = page.next
  }
  return items
}

// ---------- Playlists ----------

export interface PlaylistSummary {
  id: string
  name: string
  image?: string
  trackCount?: number
  owner?: string
}

interface ApiPlaylist {
  id: string
  name: string
  images?: { url: string }[] | null
  tracks?: { total: number }
  items?: { total: number }
  owner?: { display_name?: string }
}

function toSummary(p: ApiPlaylist): PlaylistSummary {
  return {
    id: p.id,
    name: p.name,
    image: p.images?.[0]?.url,
    trackCount: p.items?.total ?? p.tracks?.total,
    owner: p.owner?.display_name,
  }
}

export async function getMyPlaylists(): Promise<PlaylistSummary[]> {
  const playlists = await allPages<ApiPlaylist | null>('/me/playlists?limit=50')
  return playlists.filter((p): p is ApiPlaylist => !!p).map(toSummary)
}

export async function getPlaylist(id: string): Promise<PlaylistSummary> {
  return toSummary(await request<ApiPlaylist>(`/playlists/${id}?fields=id,name,images,owner(display_name)`))
}

/** Accepts a playlist URL, URI or bare ID. */
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim()
  const match =
    trimmed.match(/playlist[/:]([A-Za-z0-9]{10,})/) ?? trimmed.match(/^([A-Za-z0-9]{10,})$/)
  return match ? match[1] : null
}

interface ApiTrack {
  id: string | null
  uri: string
  name: string
  type?: string
  is_local?: boolean
  external_ids?: { isrc?: string }
  artists: { name: string }[]
  album: { release_date?: string; images?: { url: string }[] }
}

interface ApiPlaylistItem {
  // Spotify renamed `track` to `item` in newer API versions; support both.
  track?: ApiTrack | null
  item?: ApiTrack | null
}

export async function getPlaylistSongs(id: string): Promise<Song[]> {
  let items: ApiPlaylistItem[]
  try {
    items = await allPages<ApiPlaylistItem>(`/playlists/${id}/items?limit=50&additional_types=track`)
  } catch (e) {
    if (!(e instanceof SpotifyError) || e.status !== 404) throw e
    items = await allPages<ApiPlaylistItem>(`/playlists/${id}/tracks?limit=50&additional_types=track`)
  }
  const seen = new Set<string>()
  const songs: Song[] = []
  for (const entry of items) {
    const t = entry.item ?? entry.track
    if (!t || !t.id || t.is_local || (t.type && t.type !== 'track')) continue
    const year = parseInt(t.album?.release_date?.slice(0, 4) ?? '', 10)
    if (!year || year < 1000) continue
    const artists = t.artists.map((a) => a.name)
    const key = `${t.name.toLowerCase()}|${artists[0]?.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    songs.push({
      id: t.id,
      uri: t.uri,
      title: t.name,
      artists,
      year,
      spotifyYear: year,
      isrc: t.external_ids?.isrc,
      albumArt: t.album.images?.[0]?.url,
    })
  }
  return songs
}

// ---------- Playback (Spotify Connect) ----------

export interface Device {
  id: string
  name: string
  type: string
  is_active: boolean
}

export async function getDevices(): Promise<Device[]> {
  const res = await request<{ devices: (Device & { id: string | null })[] }>('/me/player/devices')
  return res.devices.filter((d): d is Device => !!d.id)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function deviceQuery(deviceId?: string, prefix = '?') {
  return deviceId ? `${prefix}device_id=${encodeURIComponent(deviceId)}` : ''
}

async function isPlaying(uri: string): Promise<boolean> {
  const state = await request<{ is_playing?: boolean; item?: { uri?: string } } | undefined>('/me/player')
  return !!state?.is_playing && state.item?.uri === uri
}

/** Wakes a device up by making it the active Spotify Connect device. */
export async function transferPlayback(deviceId: string) {
  await request('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) })
}

export async function playSong(uri: string, deviceId?: string) {
  const start = () =>
    request(`/me/player/play${deviceQuery(deviceId)}`, {
      method: 'PUT',
      body: JSON.stringify({ uris: [uri], position_ms: 0 }),
    })
  try {
    await start()
  } catch (e) {
    // Spotify answers 5xx when it can't reach the device in time (e.g. a phone
    // app in the background). Sometimes the song starts anyway; otherwise wake
    // the device by transferring playback to it and try once more.
    if (!(e instanceof SpotifyError) || e.status < 500) throw e
    await sleep(1000)
    if (await isPlaying(uri).catch(() => false)) return loopTrack(deviceId)
    if (deviceId) await transferPlayback(deviceId).catch(() => {})
    await sleep(1000)
    await start()
  }
  loopTrack(deviceId)
}

function loopTrack(deviceId?: string) {
  // Loop the song while players are thinking; ignore failures (not critical).
  request(`/me/player/repeat?state=track${deviceQuery(deviceId, '&')}`, { method: 'PUT' }).catch(() => {})
}

/**
 * Starts a song on the preferred device. If Spotify says there is no active
 * device (or the saved one is gone), picks a device Spotify can see, wakes it
 * up and plays there instead. Returns the device that was used.
 */
export async function startSong(uri: string, preferredDeviceId?: string): Promise<string | undefined> {
  try {
    await playSong(uri, preferredDeviceId)
    return preferredDeviceId
  } catch (e) {
    if (!(e instanceof SpotifyError) || e.status !== 404) throw e
    const devices = await getDevices()
    const target =
      devices.find((d) => d.id === preferredDeviceId) ??
      devices.find((d) => d.is_active) ??
      devices.find((d) => d.type === 'Computer') ??
      devices[0]
    if (!target) throw new SpotifyError(404, 'No devices', 'NO_DEVICES')
    await transferPlayback(target.id).catch(() => {})
    await sleep(500)
    await playSong(uri, target.id)
    return target.id
  }
}

export async function getAccountName(): Promise<string> {
  const me = await request<{ display_name?: string | null; id: string }>('/me')
  return me.display_name || me.id
}

export async function pause(deviceId?: string) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
  await request(`/me/player/pause${query}`, { method: 'PUT' })
}

export async function resume(deviceId?: string) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
  await request(`/me/player/play${query}`, { method: 'PUT' })
}

export function describePlaybackError(e: unknown): string {
  if (e instanceof SpotifyError) {
    if (e.reason === 'NO_DEVICES')
      return "Spotify doesn't see any device for this account. Check that Spotify on your laptop or phone is logged in to the same account shown in the ☰ menu, then try ↺ Restart."
    if (e.reason === 'NO_ACTIVE_DEVICE' || e.status === 404)
      return 'No active Spotify device. Open Spotify on your laptop, phone or speaker, play anything for a second, then pick the device in the ☰ menu.'
    if (e.reason === 'PREMIUM_REQUIRED' || e.status === 403)
      return 'Spotify Premium is required to control playback.'
    if (e.status >= 500)
      return "Spotify couldn't reach the playback device. Open Spotify on it (on a phone, keep the app in the foreground), then tap ↺ Restart, or pick another device in the ☰ menu."
    return `Spotify error ${e.status}: ${e.message}`
  }
  return (e as Error).message
}
