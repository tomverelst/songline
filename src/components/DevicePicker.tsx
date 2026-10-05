import { useCallback, useEffect, useState } from 'react'
import { getDevices, type Device } from '../spotify/api'
import { LinkButton, OptionButton } from './ui'

interface Props {
  deviceId: string | null
  onChange: (id: string | null) => void
}

export function DevicePicker({ deviceId, onChange }: Props) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">Play the music on</span>
        <LinkButton className="self-auto" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </LinkButton>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex flex-col gap-1.5">
        <OptionButton selected={deviceId === null} onClick={() => onChange(null)}>
          <span className="font-semibold">Active device</span>
          <span className="text-sm text-muted">Whatever is currently playing Spotify</span>
        </OptionButton>
        {devices?.map((d) => (
          <OptionButton key={d.id} selected={deviceId === d.id} onClick={() => onChange(d.id)}>
            <span className="font-semibold">{d.name}</span>
            <span className="text-sm text-muted">
              {d.type}
              {d.is_active ? ' · active' : ''}
            </span>
          </OptionButton>
        ))}
      </div>
      {devices?.length === 0 && (
        <p className="text-sm text-muted">
          No devices found. Open the Spotify app on a phone, computer or speaker and press play once, then refresh.
        </p>
      )}
    </div>
  )
}
