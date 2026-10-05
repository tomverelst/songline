import { useCallback, useEffect, useState } from 'react'
import type { GameState } from './game/types'
import { handleRedirect } from './spotify/auth'
import { KEYS, load, save } from './storage'
import { SetupScreen } from './screens/SetupScreen'
import { GameScreen } from './screens/GameScreen'
import { FinishedScreen } from './screens/FinishedScreen'

export default function App() {
  const [game, setGame] = useState<GameState | null>(() => load<GameState | null>(KEYS.game, null))
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    handleRedirect().then((error) => {
      setAuthError(error)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => save(KEYS.game, game), [game])

  const updateGame = useCallback((update: GameState | ((g: GameState) => GameState)) => {
    setGame((g) => (typeof update === 'function' ? (g ? update(g) : g) : update))
  }, [])

  if (!authReady) return <div className="grid min-h-dvh place-items-center text-muted">Loading…</div>

  if (!game) return <SetupScreen onStart={setGame} initialError={authError} />
  if (game.status === 'finished') return <FinishedScreen game={game} onNewGame={() => setGame(null)} />
  return (
    <GameScreen
      game={game}
      onChange={updateGame}
      onQuit={() => setGame(null)}
    />
  )
}
