import { useCallback, useEffect, useState } from 'react'
import type { GameState } from './game/types'
import { handleRedirect } from './spotify/auth'
import { KEYS, load, save } from './storage'
import { SetupScreen } from './screens/SetupScreen'
import { GameScreen } from './screens/GameScreen'
import { BattleScreen } from './screens/BattleScreen'
import { FinishedScreen } from './screens/FinishedScreen'
import { DriverScreen } from './screens/DriverScreen'

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
  if (game.settings.mode === 'driver') return <DriverScreen game={game} onChange={updateGame} onQuit={() => setGame(null)} />
  if (game.status === 'finished') return <FinishedScreen game={game} onNewGame={() => setGame(null)} />
  const Screen = game.settings.mode === 'battle' ? BattleScreen : GameScreen
  return <Screen game={game} onChange={updateGame} onQuit={() => setGame(null)} />
}
