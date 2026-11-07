import { useEffect } from 'react'
import type { GameState } from '../game/types'
import { celebrateWin, celebrationOf } from '../party'
import { recordGame } from '../profiles'
import { KEYS, load, save } from '../storage'
import { ranking, score } from '../game/logic'
import { Timeline } from '../components/Timeline'
import { SongDetailsProvider } from '../components/SongDetails'
import { Coins } from '../components/Coins'
import { PlayedSongs } from '../components/PlayedSongs'
import { teamColor, teamVars } from '../game/teams'
import { BottomBar, Button, Card, CardTitle, Logo, Screen } from '../components/ui'

export function FinishedScreen({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const winners = game.players.filter((p) => game.winnerIds?.includes(p.id))
  // The (first) winner's own celebration, once.
  const { style, emoji, pattern } = celebrationOf(winners[0] ?? {})
  useEffect(() => celebrateWin({ style, emoji, pattern }), [style, emoji, pattern])
  // Count the game on everyone's player card, once (not again on a reload).
  useEffect(() => {
    const key = [...game.players.map((p) => p.name), ...(game.played ?? []).map((p) => p.song.id)].join('|')
    if (load<string | null>(KEYS.recordedGame, null) === key) return
    save(KEYS.recordedGame, key)
    recordGame(
      game.players.map((p) => p.name),
      winners.map((p) => p.name),
    )
  }, [game, winners])
  const ranked = ranking(game)

  return (
    <SongDetailsProvider playlistId={game.settings.playlistId}>
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
                  {i + 1}.{' '}
                  <span className="text-(--team)" style={teamVars(teamColor(p, game.players.indexOf(p)))}>
                    {p.name}
                  </span>
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

        <PlayedSongs game={game} />

        <BottomBar>
          <Button variant="primary" block onClick={onNewGame}>
            New game
          </Button>
        </BottomBar>
      </Screen>
    </SongDetailsProvider>
  )
}
