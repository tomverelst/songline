import { useEffect } from 'react'
import type { GameState } from '../game/types'
import { celebrateWin } from '../party'
import { ranking, score } from '../game/logic'
import { Timeline } from '../components/Timeline'
import { Coins } from '../components/Coins'
import { BottomBar, Button, Card, CardTitle, Logo, Screen } from '../components/ui'

export function FinishedScreen({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  useEffect(() => celebrateWin(), [])
  const winners = game.players.filter((p) => game.winnerIds?.includes(p.id))
  const ranked = ranking(game)

  return (
    <Screen>
      <header className="flex flex-col items-center gap-2 pt-4 pb-1 text-center">
        <Logo>🏆</Logo>
        <h1 className="text-[2rem] leading-tight font-bold">{winners.map((w) => w.name).join(' & ')} wins!</h1>
        <p className="text-muted">After {game.round} rounds</p>
      </header>

      {ranked.map((p, i) => {
        const points = score(p, game.settings)
        return (
          <Card key={p.id} className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>
                {i + 1}. {p.name}
              </CardTitle>
              <span className="inline-flex items-center font-extrabold tabular-nums">
                {points} {points === 1 ? 'pt' : 'pts'}
                <Coins count={p.bonus} />
              </span>
            </div>
            <Timeline timeline={p.timeline} />
          </Card>
        )
      })}

      <BottomBar>
        <Button variant="primary" block onClick={onNewGame}>
          New game
        </Button>
      </BottomBar>
    </Screen>
  )
}
