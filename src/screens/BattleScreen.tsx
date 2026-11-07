import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BattleGuess, GameSettings, GameState, Player, TurnResult } from '../game/types'
import { isValidYear, overwriteCardYear, overwriteRevealedYear, score } from '../game/logic'
import {
  allLockedIn,
  endBattleTurn,
  revealBattle,
  setBattleGuess,
  setBattleLocked,
  setFirstToName,
  updateBattleResult,
} from '../game/battle'
import { celebrateCard, celebrateExact, celebrationOf, type CelebrationStyle } from '../party'
import { CardRow } from '../components/CardRow'
import { LikeButton } from '../components/LikeButton'
import { SongDetailsProvider } from '../components/SongDetails'
import { YearInput } from '../components/YearInput'
import { TimerButton } from '../components/TimerButton'
import { Coins } from '../components/Coins'
import { GameMenu, GuessTimer, PointChip, RevealYear } from '../components/GameParts'
import { guessText, medianYear } from '../components/format'
import { Artwork, BottomBar, Button, Card, CardTitle, IconButton, Muted, Screen, Switch, Toast } from '../components/ui'
import { cx } from '../components/classes'
import { teamColor, teamVars, type TeamColor } from '../game/teams'
import { ScreenRotation } from '../components/rotation'
import { useCardsOnly } from '../components/scale'
import { useTurnSession } from './useTurnSession'

interface Props {
  game: GameState
  onChange: (update: GameState | ((game: GameState) => GameState)) => void
  onQuit: () => void
}

/**
 * Battle mode: both players (or teams) guess the same song at the same time,
 * each on their own half of the screen with their own timeline.
 */
export function BattleScreen({ game, onChange, onQuit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useTurnSession({
    game,
    onChange,
    reveal: revealBattle,
    endTurn: endBattleTurn,
    holdAutoplay: menuOpen,
  })
  const turn = game.turn
  const faceToFace = game.settings.faceToFace !== false

  // Tablets have no year buttons: each side's guess starts on the middle
  // card of their own timeline, ready to be swiped.
  const cardsOnly = useCardsOnly()
  const needsStart =
    cardsOnly && turn?.phase === 'guess' && !!turn.guesses?.some((g) => g.yearGuess === undefined && !g.locked)
  useEffect(() => {
    if (!needsStart) return
    onChange((g) =>
      (g.turn?.guesses ?? []).reduce(
        (state, guess, i) =>
          guess.yearGuess === undefined && !guess.locked
            ? setBattleGuess(state, i, medianYear(state.players[i].timeline))
            : state,
        g,
      ),
    )
  }, [needsStart, onChange])

  // Reveal as soon as everyone has locked in.
  const everyoneLocked = turn?.phase === 'guess' && allLockedIn(game) && !session.checkingYear
  const lockInRef = useRef(session.lockIn)
  useEffect(() => {
    lockInRef.current = session.lockIn
  })
  useEffect(() => {
    if (everyoneLocked) lockInRef.current()
  }, [everyoneLocked])

  // Party when the answer is revealed (once per song, not on later corrections).
  const celebrated = useRef<string | null>(null)
  const revealedSong = turn?.phase === 'reveal' ? turn.song.id : null
  // Every side that won celebrates in its own style (once per style and kind).
  const parties = [
    ...new Set(
      (turn?.guesses ?? []).flatMap((g, i) => {
        const style = celebrationOf(game.players[i])
        return g.result?.exactYear ? [`exact:${style}`] : g.result?.placementCorrect ? [`card:${style}`] : []
      }),
    ),
  ].join()
  useEffect(() => {
    if (!revealedSong || celebrated.current === revealedSong) return
    celebrated.current = revealedSong
    for (const party of parties.split(',').filter(Boolean)) {
      const [kind, style] = party.split(':') as ['exact' | 'card', CelebrationStyle]
      if (kind === 'exact') celebrateExact(style)
      else celebrateCard(style)
    }
  }, [revealedSong, parties])

  const menuButton = (
    <IconButton aria-label="Menu" onClick={() => setMenuOpen(true)}>
      ☰
    </IconButton>
  )

  let content
  if (!turn) {
    content = (
      <BattleIntro
        game={game}
        menuButton={menuButton}
        onStart={session.startTurn}
        timerMs={session.autoplayActive ? session.autoplayMs : undefined}
      />
    )
  } else if (turn.phase === 'guess' && turn.guesses) {
    const panel = (index: number, upsideDown: boolean) => (
      <GuessPanel
        player={game.players[index]}
        color={teamColor(game.players[index], index)}
        settings={game.settings}
        guess={turn.guesses![index] ?? {}}
        upsideDown={upsideDown}
        checkingYear={session.checkingYear}
        onYear={(year) => onChange((g) => setBattleGuess(g, index, year))}
        onLock={(locked) => onChange((g) => setBattleLocked(g, index, locked))}
      />
    )
    content = (
      <div className="flex h-full flex-col select-none">
        {panel(1, faceToFace)}
        <div className="flex flex-none items-center gap-2 border-y border-line bg-surface px-3 py-2">
          <div
            className={cx(
              'vinyl-grooves grid size-10 flex-none place-items-center rounded-full ring-2 ring-line',
              session.playing && 'animate-vinyl',
            )}
            aria-hidden
          >
            <div className="size-3.5 rounded-full bg-accent-gradient" />
          </div>
          <Button size="sm" className="px-3" onClick={session.togglePause}>
            {session.playing ? '❚❚' : '▶'}
          </Button>
          <Button size="sm" variant="ghost" className="px-3" aria-label="Restart" onClick={session.restart}>
            ↺
          </Button>
          <Button size="sm" variant="ghost" className="px-3" aria-label="Skip" onClick={session.skip}>
            ⏭
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {session.timeLeft !== undefined && <GuessTimer ms={session.timeLeft} running={session.clockRunning} />}
            {menuButton}
          </div>
        </div>
        {panel(0, false)}
      </div>
    )
  } else if (turn.phase === 'reveal' && turn.guesses) {
    content = (
      <BattleReveal
        game={game}
        onEditYear={(year) => onChange((g) => overwriteRevealedYear(g, year))}
        onResult={(index, patch) => onChange((g) => updateBattleResult(g, index, patch))}
        onFirstToName={(field, index) => onChange((g) => setFirstToName(g, field, index))}
        onContinue={session.nextTurn}
        menuButton={menuButton}
      />
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <SongDetailsProvider
        playlistId={game.settings.playlistId}
        onEditYear={(songId, year) => onChange((g) => overwriteCardYear(g, songId, year))}
      >
        <div data-scroller className="h-full overflow-y-auto overscroll-contain">
          {content}
        </div>
        {session.error && <Toast onDismiss={() => session.setError(null)}>{session.error}</Toast>}
        {menuOpen && (
          <GameMenu
            game={game}
            onChange={onChange}
            deviceId={session.deviceId}
            onDeviceChange={session.changeDevice}
            onClose={() => setMenuOpen(false)}
            onQuit={onQuit}
            stopMusic={session.stopMusic}
          >
            <Switch
              title="Face each other"
              description="The top half of the screen is upside down, for players across the table."
              checked={faceToFace}
              onChange={(on) => onChange((g) => ({ ...g, settings: { ...g.settings, faceToFace: on } }))}
            />
          </GameMenu>
        )}
      </SongDetailsProvider>
    </div>
  )
}

function ScoreChip({ player, settings }: { player: Player; settings: GameSettings }) {
  return (
    // Sits inside an element with the player's --team colour.
    <span className="inline-flex flex-none items-center rounded-full border border-(--team)/60 bg-surface px-2.5 py-0.5 text-sm font-extrabold tabular-nums">
      {score(player, settings)}
      <Coins count={player.bonus} />
    </span>
  )
}

function BattleIntro({
  game,
  menuButton,
  onStart,
  timerMs,
}: {
  game: GameState
  menuButton: ReactNode
  onStart: () => void
  timerMs?: number
}) {
  const [a, b] = game.players
  return (
    <Screen>
      <header className="flex justify-end">{menuButton}</header>
      <section className="flex min-h-[calc(100dvh-220px)] flex-col justify-center gap-4 text-center">
        <p className="text-lg text-muted">Round {game.round} · first to {game.settings.targetPoints}</p>
        {[a, b].map((p, i) => (
          <div key={p.id} className="flex flex-col items-center gap-1" style={teamVars(teamColor(p, i))}>
            {i === 1 && <span className="mb-2 text-xl font-black text-muted">vs</span>}
            <h1 className="text-[clamp(2.5rem,13vw,4.5rem)] leading-none font-bold text-(--team) [overflow-wrap:anywhere]">
              {p.name}
            </h1>
            <ScoreChip player={p} settings={game.settings} />
          </div>
        ))}
        <p className="text-lg text-muted">Guess at the same time. Both right? Both win the card! Shout the title and artist first for coins.</p>
      </section>
      <BottomBar>
        <TimerButton variant="primary" block onClick={onStart} timerMs={timerMs}>
          ▶ Play mystery song
        </TimerButton>
      </BottomBar>
    </Screen>
  )
}

/** One player's half of the guessing screen: their year, their cards and their lock. */
function GuessPanel({
  player,
  settings,
  guess,
  color,
  upsideDown,
  checkingYear,
  onYear,
  onLock,
}: {
  player: Player
  settings: GameSettings
  guess: BattleGuess
  /** The team's colour: their name, score and a tint of their half. */
  color: TeamColor
  upsideDown: boolean
  checkingYear: boolean
  onYear: (year: number | undefined) => void
  onLock: (locked: boolean) => void
}) {
  const valid = isValidYear(guess.yearGuess)
  // Tablets pick the year with the cards alone: swipe them under the guess
  // card. Everything else that differs is layout, in the tablet: classes.
  const cardsOnly = useCardsOnly()
  const locked = checkingYear ? 'Checking the year…' : '🔒 Locked in — waiting for the other side'
  return (
    <ScreenRotation value={upsideDown ? 180 : 0}>
      <section
        style={teamVars(color)}
        className={cx(
          // Phones: name and Lock in on top, then the year buttons, then the cards.
          'flex min-h-0 flex-1 flex-col gap-2 bg-(--team)/[0.07] px-3 pt-3 pb-1 [&>*:not(:last-child)]:mx-auto [&>*:not(:last-child)]:w-full [&>*:not(:last-child)]:max-w-[40rem]',
          // Tablets: no year buttons; the cards fill the half, with the name
          // bottom left and Lock in bottom right, as the team sees it.
          'tablet:gap-0 tablet:px-5 tablet:pt-0 tablet:pb-4 tablet:[&>*:not(:last-child)]:max-w-none',
          upsideDown && 'rotate-180',
        )}
      >
        <div className="flex min-h-10 items-center gap-2 tablet:order-last tablet:gap-3">
          <span className="min-w-0 truncate text-2xl font-black text-(--team)">{player.name}</span>
          <ScoreChip player={player} settings={settings} />
          {guess.locked ? (
            <>
              <span className="hidden font-extrabold text-good tablet:ml-auto tablet:inline">{locked}</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto px-4 tablet:ml-0 tablet:min-h-12 tablet:px-6 tablet:text-base"
                disabled={checkingYear}
                onClick={() => onLock(false)}
              >
                Change
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="primary"
              className="ml-auto px-4 tablet:min-h-14 tablet:px-8 tablet:text-lg"
              disabled={!valid}
              onClick={() => onLock(true)}
            >
              {valid ? `Lock in ${guess.yearGuess}` : 'Pick a year'}
            </Button>
          )}
        </div>
        {guess.locked ? (
          // The year stays hidden, so the other side can't copy it.
          <div className="grid min-h-14 place-items-center rounded-2xl border-2 border-good bg-good/12 text-lg font-extrabold text-good tablet:hidden">
            {locked}
          </div>
        ) : (
          <YearInput
            value={guess.yearGuess}
            startYear={medianYear(player.timeline)}
            onChange={onYear}
            typing={false}
            className="tablet:hidden"
          />
        )}
        <CardRow
          timeline={player.timeline}
          guessYear={guess.locked ? undefined : guess.yearGuess}
          onSelectYear={guess.locked ? undefined : onYear}
          swipe={cardsOnly && !guess.locked ? { startYear: medianYear(player.timeline), onMove: () => {} } : undefined}
        />
      </section>
    </ScreenRotation>
  )
}

/** The answer, then every player's guess against their own timeline. */
function BattleReveal({
  game,
  onEditYear,
  onResult,
  onFirstToName,
  onContinue,
  menuButton,
}: {
  game: GameState
  onEditYear: (year: number) => void
  onResult: (index: number, patch: Partial<TurnResult>) => void
  onFirstToName: (field: 'titleCorrect' | 'artistCorrect', index: number | null) => void
  onContinue: () => void
  menuButton: ReactNode
}) {
  const turn = game.turn!
  const anyExact = turn.guesses!.some((g) => g.result?.exactYear)
  return (
    <Screen>
      <header className="flex items-center gap-2">
        {turn.timedOut ? (
          <p className="flex-1 text-lg font-extrabold text-bad">⏱ Time's up!</p>
        ) : (
          <Muted className="flex-1">Round {game.round}</Muted>
        )}
        {menuButton}
      </header>
      <section
        className={cx(
          'flex animate-pop items-center gap-4 rounded-2xl border-2 bg-surface p-4',
          anyExact ? 'border-gold' : 'border-line',
        )}
      >
        <div className="relative flex-none">
          <Artwork src={turn.song.albumArt} className="size-28 rounded-xl text-4xl shadow-[0_12px_32px_rgb(0_0_0/0.5)]" />
          <LikeButton song={turn.song} playlistId={game.settings.playlistId} onArt iconOnly className="absolute -right-2 -bottom-2" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <RevealYear key={turn.song.id} song={turn.song} exact={anyExact} onSave={onEditYear} />
          <div className="mt-1 text-lg font-bold [overflow-wrap:anywhere]">{turn.song.title}</div>
          <div className="text-muted">{turn.song.artists.join(', ')}</div>
        </div>
      </section>

      {/* Title and artist are a race: whoever says it out loud first gets the coin. */}
      <Card className="gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle>Who named it first?</CardTitle>
          <Muted>Tap again to clear</Muted>
        </div>
        {(
          [
            ['titleCorrect', 'Title', turn.song.title],
            ['artistCorrect', 'Artist', turn.song.artists.join(', ')],
          ] as const
        ).map(([field, label, answer]) => (
          <div key={field} className="flex flex-col gap-1.5">
            <Muted className="truncate">
              {label}: <span className="font-semibold text-ink">{answer}</span>
            </Muted>
            <div className="grid grid-cols-2 gap-1.5">
              {game.players.map((player, index) => (
                <PointChip
                  key={player.id}
                  coin
                  label={player.name}
                  value={!!turn.guesses![index]?.result?.[field]}
                  onChange={(on) => onFirstToName(field, on ? index : null)}
                />
              ))}
            </div>
          </div>
        ))}
      </Card>

      {game.players.map((player, index) => {
        const guess = turn.guesses![index]
        const result = guess?.result
        if (!result) return null
        const set = (patch: Partial<TurnResult>) => onResult(index, patch)
        return (
          <Card
            key={player.id}
            style={teamVars(teamColor(player, index))}
            className={cx('gap-2 border-2', result.placementCorrect ? 'border-good' : 'border-bad')}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-xl font-black text-(--team)">{player.name}</span>
              <ScoreChip player={player} settings={game.settings} />
              <span className={cx('ml-auto font-extrabold', result.placementCorrect ? 'text-good' : 'text-bad')}>
                {result.placementCorrect ? '✓ Wins the card' : '✗ Wrong spot'}
              </span>
            </div>
            <Muted>
              {guessText(guess.yearGuess)[0].toUpperCase() + guessText(guess.yearGuess).slice(1)} · tap to change, e.g. if
              the year looks wrong.
            </Muted>
            <CardRow
              timeline={player.timeline}
              guessYear={guess.yearGuess}
              verdict={result.placementCorrect ? 'correct' : 'wrong'}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <PointChip label="Card" value={result.placementCorrect} onChange={(placementCorrect) => set({ placementCorrect })} />
              <PointChip coin label={`Exact ${turn.song.year}`} value={result.exactYear} onChange={(exactYear) => set({ exactYear })} />
            </div>
          </Card>
        )
      })}

      <BottomBar>
        <Button variant="primary" block onClick={onContinue}>
          Continue
        </Button>
      </BottomBar>
    </Screen>
  )
}
