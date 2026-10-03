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

export async function playSong(uri: string, deviceId?: string) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
  await request(`/me/player/play${query}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri], position_ms: 0 }),
  })
  // Loop the song while players are thinking; ignore failures (not critical).
  request(`/me/player/repeat?state=track${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`, {
    method: 'PUT',
  }).catch(() => {})
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
    if (e.reason === 'NO_ACTIVE_DEVICE' || e.status === 404)
      return 'No active Spotify device. Open Spotify on your phone or speaker, play anything for a second, then pick the device in settings.'
    if (e.reason === 'PREMIUM_REQUIRED' || e.status === 403)
      return 'Spotify Premium is required to control playback.'
    return e.message
  }
  return (e as Error).message
}
