import { useCallback, useEffect, useState } from 'react'
import { getAccountName, getDevices, type Device } from '../spotify/api'

interface Props {
  deviceId: string | null
  onChange: (id: string | null) => void
}

export function DevicePicker({ deviceId, onChange }: Props) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState<string | null>(null)

  useEffect(() => {
    getAccountName()
      .then(setAccount)
      .catch(() => {})
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDevices(await getDevices())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="stack-sm">
      <div className="row between">
        <span className="muted small">Play the music on</span>
        <button className="link" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
      {account && <p className="muted small">Signed in to Spotify as <strong>{account}</strong></p>}
      {error && <p className="error">{error}</p>}
      <div className="options">
        <button className={`option ${deviceId === null ? 'selected' : ''}`} onClick={() => onChange(null)}>
          <span className="option-title">Active device</span>
          <span className="muted small">Whatever is currently playing Spotify</span>
        </button>
        {devices?.map((d) => (
          <button
            key={d.id}
            className={`option ${deviceId === d.id ? 'selected' : ''}`}
            onClick={() => onChange(d.id)}
          >
            <span className="option-title">{d.name}</span>
            <span className="muted small">
              {d.type}
              {d.is_active ? ' · active' : ''}
            </span>
          </button>
        ))}
      </div>
      {devices?.length === 0 && (
        <p className="muted small">
          No devices found for this account. Open Spotify on a laptop, phone or speaker with the same account, press
          play once, then refresh.
        </p>
      )}
    </div>
  )
}
