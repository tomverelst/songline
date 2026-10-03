// Spotify Authorization Code flow with PKCE — runs entirely in the browser,
// no backend or client secret needed.

const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
]

const CLIENT_ID_KEY = 'songline.clientId'
const TOKEN_KEY = 'songline.token'
const VERIFIER_KEY = 'songline.pkceVerifier'

interface StoredToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) || import.meta.env.VITE_SPOTIFY_CLIENT_ID || ''
}

export function setClientId(id: string) {
  localStorage.setItem(CLIENT_ID_KEY, id.trim())
}

export function redirectUri(): string {
  return window.location.origin + window.location.pathname
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export async function login() {
  const clientId = getClientId()
  if (!clientId) throw new Error('Set your Spotify client ID first.')
  const verifier = randomString(64)
  localStorage.setItem(VERIFIER_KEY, verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    redirect_uri: redirectUri(),
  })
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`)
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return readToken() !== null
}

function readToken(): StoredToken | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
  } catch {
    return null
  }
}

function storeToken(body: { access_token: string; refresh_token?: string; expires_in: number }, previousRefresh = '') {
  const token: StoredToken = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || previousRefresh,
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  return token
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: getClientId(), ...params }),
  })
  if (!res.ok) throw new Error(`Spotify login failed (${res.status})`)
  return res.json()
}

/**
 * Completes the login if Spotify redirected back with ?code=…
 * Returns an error message if Spotify reported one.
 */
export function handleRedirect(): Promise<string | null> {
  redirectHandled ??= completeRedirect()
  return redirectHandled
}

let redirectHandled: Promise<string | null> | null = null

async function completeRedirect(): Promise<string | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (!code && !error) return null
  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('state')
  window.history.replaceState(null, '', url.toString())
  if (error) return `Spotify login was cancelled (${error}).`
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) return 'Login expired, please try again.'
  try {
    storeToken(
      await tokenRequest({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
      }),
    )
    localStorage.removeItem(VERIFIER_KEY)
    return null
  } catch (e) {
    return (e as Error).message
  }
}

let refreshing: Promise<StoredToken> | null = null

export async function getAccessToken(forceRefresh = false): Promise<string> {
  const token = readToken()
  if (!token) throw new Error('Not logged in to Spotify.')
  if (!forceRefresh && Date.now() < token.expiresAt) return token.accessToken
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refreshToken })
    .then((body) => storeToken(body, token.refreshToken))
    .catch((e) => {
      logout()
      throw e
    })
    .finally(() => {
      refreshing = null
    })
  return (await refreshing).accessToken
}
