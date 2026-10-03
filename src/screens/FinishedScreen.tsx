import type { GameState } from '../game/types'
import { score } from '../game/logic'
import { Timeline } from '../components/Timeline'

export function FinishedScreen({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const winners = game.players.filter((p) => game.winnerIds?.includes(p.id))
  const ranked = [...game.players].sort((a, b) => score(b) - score(a))

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
            <span className="chip-score">{score(p)} pts</span>
          </div>
          <p className="muted small">
            {p.timeline.length} cards · {p.bonus} bonus
          </p>
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
