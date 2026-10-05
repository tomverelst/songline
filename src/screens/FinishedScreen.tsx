import { useEffect } from 'react'
import type { GameState } from '../game/types'
import { celebrateWin } from '../party'
import { ranking, score } from '../game/logic'
import { Timeline } from '../components/Timeline'
import { Coins } from '../components/Coins'

export function FinishedScreen({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  useEffect(() => celebrateWin(), [])
  const winners = game.players.filter((p) => game.winnerIds?.includes(p.id))
  const ranked = ranking(game)

  return (
    <div className="screen">
      <header className="hero">
        <div className="logo">🏆</div>
        <h1>{winners.map((w) => w.name).join(' & ')} wins!</h1>
        <p className="muted">After {game.round} rounds</p>
      </header>

      {ranked.map((p, i) => (
        <section key={p.id} className="card stack-sm">
          <div className="row between">
            <h2>
              {i + 1}. {p.name}
            </h2>
            <span className="chip-score">
              {score(p, game.settings)} {score(p, game.settings) === 1 ? 'pt' : 'pts'}
              <Coins count={p.bonus} />
            </span>
          </div>
          <Timeline timeline={p.timeline} />
        </section>
      ))}

      <div className="bottom-bar">
        <button className="btn primary block" onClick={onNewGame}>
          New game
        </button>
      </div>
    </div>
  )
}
