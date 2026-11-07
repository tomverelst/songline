import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { GameState, TurnResult } from '../game/types'
import {
  endTurn,
  isFlipped,
  isValidYear,
  overwriteCardYear,
  overwriteRevealedYear,
  reveal,
  score,
  slotForYear,
  timeUp,
} from '../game/logic'
import { celebrateCard, celebrateExact } from '../party'
import { TimelineCards } from '../components/TimelineCards'
import { TableReveal, TableView } from '../components/TableView'
import { LikeButton } from '../components/LikeButton'
import { SongDetailsProvider } from '../components/SongDetails'
import { YearInput } from '../components/YearInput'
import { TimerButton } from '../components/TimerButton'
import { Coins } from '../components/Coins'
import { BonusToggle, GameMenu, GuessTimer, RevealYear, YearSource } from '../components/GameParts'
import { guessText, medianYear } from '../components/format'
import { Artwork, BottomBar, Button, Card, CardTitle, IconButton, Muted, Screen, Switch, Toast } from '../components/ui'
import { cx } from '../components/classes'
import { ScreenRotation } from '../components/rotation'
import { requestMotionAccess, useDeviceTurn, useScreenAngle } from '../motion'
import { useTurnSession } from './useTurnSession'

interface Props {
  game: GameState
  onChange: (update: GameState | ((game: GameState) => GameState)) => void
  onQuit: () => void
}

export function GameScreen({ game, onChange, onQuit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useTurnSession({
    game,
    onChange,
    reveal: (g, timedOut) => (timedOut ? timeUp(g) : reveal(g)),
    endTurn,
    holdAutoplay: menuOpen,
  })
  const { playing, error, setError, checkingYear, autoplayActive, introKey } = session
  const { startTurn, skip, togglePause, lockIn, nextTurn } = session

  const player = game.players[game.currentPlayer]
  const turn = game.turn

  // Party when the answer is revealed (once per song, not on later corrections).
  const celebrated = useRef<string | null>(null)
  const revealedSong = turn?.phase === 'reveal' ? turn.song.id : null
  const wonCard = !!turn?.result?.placementCorrect
  const exactHit = !!turn?.result?.exactYear
  useEffect(() => {
    if (!revealedSong || celebrated.current === revealedSong) return
    celebrated.current = revealedSong
    if (exactHit) celebrateExact()
    else if (wonCard) celebrateCard()
  }, [revealedSong, wonCard, exactHit])

  const clock = session.timeLeft !== undefined && <GuessTimer ms={session.timeLeft} running={session.clockRunning} />

  const guessSlot = turn?.phase === 'guess' && isValidYear(turn.yearGuess)
    ? slotForYear(player.timeline, turn.yearGuess)
    : undefined

  function overwriteYear(year: number) {
    onChange((g) => overwriteRevealedYear(g, year))
  }

  function setYearGuess(yearGuess: number | undefined) {
    if (turn) onChange({ ...game, turn: { ...turn, yearGuess } })
  }

  function updateResult(patch: Partial<TurnResult>) {
    if (!turn?.result) return
    onChange({ ...game, turn: { ...turn, result: { ...turn.result, ...patch } } })
  }

  const flipEnabled = !!game.settings.flipBetweenTurns
  const tableViewEnabled = game.settings.tableView !== false
  // The guess and the reveal have a table view for a phone on its side.
  const tablePhase = turn?.phase === 'guess' || turn?.phase === 'reveal'
  // The screen faces whoever holds the phone, going by its motion sensor (this
  // works with the phone's auto-rotate locked too). Lying flat, or without a
  // sensor, it follows the flip setting.
  const deviceTurn = useDeviceTurn(introKey)
  const screenAngle = useScreenAngle()
  const flipAngle = isFlipped(game) ? 180 : 0
  let angle = deviceTurn === null ? flipAngle : (deviceTurn - screenAngle + 360) % 360
  // Only the table view is made for a phone on its side.
  if (angle % 180 !== 0 && !(tablePhase && tableViewEnabled)) angle = flipAngle
  const turned = angle % 180 !== 0
  const landscape = useLandscape()
  const sideways = tablePhase && tableViewEnabled && (turned || landscape)
  const scoreboard = (
    <>
      <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {game.players.map((p, i) => (
          <div
            key={p.id}
            className={cx(
              'flex flex-none flex-col rounded-xl border px-3 py-1.5 text-[0.8rem]',
              i === game.currentPlayer ? 'border-accent bg-accent/15' : 'border-line bg-surface',
            )}
          >
            <span className="max-w-[10ch] truncate">{p.name}</span>
            <span className="inline-flex items-center text-base font-extrabold tabular-nums">
              {score(p, game.settings)}
              <Coins count={p.bonus} />
            </span>
          </div>
        ))}
      </div>
      <IconButton aria-label="Menu" onClick={() => setMenuOpen(true)}>
        ☰
      </IconButton>
    </>
  )
  // The guessing screen's parts, laid out upright or sideways.
  const songControls = turn?.phase === 'guess' && (
    <section className="flex items-center gap-3">
      <div
        className={cx(
          'vinyl-grooves grid size-16 flex-none place-items-center rounded-full ring-2 ring-line',
          playing && 'animate-vinyl',
        )}
        aria-hidden
      >
        <div className="grid size-7 place-items-center rounded-full bg-accent-gradient text-sm font-extrabold text-on-accent">
          ?
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Muted className="truncate">{player.name} is guessing</Muted>
          {clock}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" className="px-3" onClick={togglePause}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </Button>
          <Button size="sm" variant="ghost" className="px-3" onClick={session.restart}>
            ↺ Restart
          </Button>
          <Button size="sm" variant="ghost" className="px-3" onClick={skip}>
            ⏭ Skip
          </Button>
        </div>
      </div>
    </section>
  )
  const yearInput = turn?.phase === 'guess' && (
    <YearInput
      value={turn.yearGuess}
      startYear={medianYear(player.timeline)}
      onChange={setYearGuess}
    />
  )
  const hand = turn?.phase === 'guess' && (
    <TimelineCards
      timeline={player.timeline}
      guessYear={guessSlot ? turn.yearGuess : undefined}
      onSelectYear={setYearGuess}
    />
  )
  const lockButton = turn?.phase === 'guess' && (
    <Button variant="primary" block disabled={!guessSlot || checkingYear} onClick={() => lockIn()}>
      {checkingYear ? 'Checking the year…' : guessSlot ? `Lock in ${turn.yearGuess}` : 'Enter a year'}
    </Button>
  )
  const screen = (
    <Screen>
      <header className="sticky top-0 z-[5] -mx-4 -mt-4 flex items-center gap-2 bg-bg p-4">
        {scoreboard}
      </header>

      {!turn && (
        <>
          <section className="flex min-h-[calc(100dvh-260px)] flex-col justify-center gap-3 text-center">
            <p className="text-lg text-muted">Round {game.round}</p>
            <h1 className="text-accent-gradient text-[clamp(3.5rem,18vw,6rem)] leading-none font-bold [overflow-wrap:anywhere]">
              {player.name}
            </h1>
            <p className="text-lg text-muted">It's your turn — grab the phone!</p>
          </section>
          <BottomBar>
            <TimerButton variant="primary" block onClick={startTurn} timerMs={autoplayActive ? session.autoplayMs : undefined}>
              {session.preparing ? '⏳ Getting the song ready…' : '▶ Play mystery song'}
            </TimerButton>
          </BottomBar>
        </>
      )}

      {turn?.phase === 'guess' && !sideways && (
        <>
          {songControls}
          <Card className="gap-2">
            {yearInput}
            {hand}
          </Card>
          <BottomBar>{lockButton}</BottomBar>
        </>
      )}

      {turn?.phase === 'reveal' && turn.result && !sideways && (
        <>
          {turn.timedOut && <p className="text-center text-lg font-extrabold text-bad">⏱ Time's up!</p>}
          <section
            className={cx(
              'flex animate-pop flex-col items-center gap-1.5 rounded-2xl border-2 bg-surface px-4 py-5 text-center',
              turn.result.exactYear
                ? 'border-gold bg-linear-to-b from-gold/10 to-surface to-55% shadow-[0_0_0_1px_var(--color-gold),0_0_32px_rgb(255_204_51/0.35)]'
                : turn.result.placementCorrect
                  ? 'border-good'
                  : 'border-bad',
            )}
          >
            <div className="relative">
              <Artwork src={turn.song.albumArt} className="size-45 rounded-xl text-5xl shadow-[0_12px_32px_rgb(0_0_0/0.5)]" />
              <LikeButton song={turn.song} playlistId={game.settings.playlistId} onArt className="absolute right-2 bottom-2" />
            </div>
            <RevealYear key={turn.song.id} song={turn.song} exact={turn.result.exactYear} onSave={overwriteYear} />
            <div className="text-xl font-bold [overflow-wrap:anywhere]">{turn.song.title}</div>
            <div className="text-muted">{turn.song.artists.join(', ')}</div>
          </section>

          <Card className="gap-2">
            <CardTitle>Points</CardTitle>
            <Muted>Tap to change, e.g. if the year looks wrong.</Muted>
            <BonusToggle
              label={`Card (${guessText(turn.yearGuess)})`}
              answer={turn.result.placementCorrect ? 'Goes in the timeline' : 'Wrong spot'}
              value={turn.result.placementCorrect}
              onChange={(placementCorrect) => updateResult({ placementCorrect })}
            />
            <BonusToggle
              coin
              label={`Exact year (${guessText(turn.yearGuess)})`}
              answer={String(turn.song.year)}
              value={turn.result.exactYear}
              onChange={(exactYear) => updateResult({ exactYear })}
            />
            <BonusToggle
              coin
              label="Title"
              answer={turn.song.title}
              value={turn.result.titleCorrect}
              onChange={(titleCorrect) => updateResult({ titleCorrect })}
            />
            <BonusToggle
              coin
              label="Artist"
              answer={turn.song.artists.join(', ')}
              value={turn.result.artistCorrect}
              onChange={(artistCorrect) => updateResult({ artistCorrect })}
            />
          </Card>

          <Card className="gap-0">
            <CardTitle>{player.name}'s cards</CardTitle>
            <TimelineCards
              timeline={player.timeline}
              guessYear={turn.yearGuess}
              verdict={turn.result.placementCorrect ? 'correct' : 'wrong'}
            />
          </Card>

          <BottomBar>
            <Button variant="primary" block onClick={nextTurn}>
              Continue
            </Button>
          </BottomBar>
        </>
      )}
    </Screen>
  )
  const overlays = (
    <>
      {error && <Toast onDismiss={() => setError(null)}>{error}</Toast>}

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
            title="Table view when turned sideways"
            description="Turn the phone on its side while guessing or revealing to lay your cards out in a row and pick the year on a ruler."
            checked={tableViewEnabled}
            onChange={(tableView) => {
              if (tableView) requestMotionAccess()
              onChange((g) => ({ ...g, settings: { ...g.settings, tableView } }))
            }}
          />
          {tableViewEnabled && (
            <Switch
              title="Guess card stays in the middle"
              description="In the table view, swipe anywhere on the cards to change the year; they slide past your guess."
              checked={!!game.settings.swipeCards}
              onChange={(swipeCards) => onChange((g) => ({ ...g, settings: { ...g.settings, swipeCards } }))}
            />
          )}
          <Switch
            title="Flip screen between turns"
            description="Upside down every other turn, for players across the table."
            checked={flipEnabled}
            onChange={(flipBetweenTurns) => onChange((g) => ({ ...g, settings: { ...g.settings, flipBetweenTurns } }))}
          />
        </GameMenu>
      )}
    </>
  )

  const content =
    sideways && turn?.phase === 'reveal' && turn.result ? (
      <TableReveal
        scoreboard={scoreboard}
        playerName={player.name}
        timeline={player.timeline}
        yearGuess={turn.yearGuess}
        verdict={turn.result.placementCorrect ? 'correct' : 'wrong'}
        exact={turn.result.exactYear}
        song={turn.song}
        yearSource={<YearSource song={turn.song} />}
        onEditYear={overwriteYear}
        likeButton={
          <LikeButton song={turn.song} playlistId={game.settings.playlistId} onArt iconOnly className="absolute -right-2 -bottom-2" />
        }
        points={[
          { label: 'Card', value: turn.result.placementCorrect, onChange: (placementCorrect) => updateResult({ placementCorrect }) },
          { label: 'Exact year', coin: true, value: turn.result.exactYear, onChange: (exactYear) => updateResult({ exactYear }) },
          { label: 'Title', coin: true, value: turn.result.titleCorrect, onChange: (titleCorrect) => updateResult({ titleCorrect }) },
          { label: 'Artist', coin: true, value: turn.result.artistCorrect, onChange: (artistCorrect) => updateResult({ artistCorrect }) },
        ]}
        onContinue={nextTurn}
      />
    ) : sideways && turn ? (
      <TableView
        scoreboard={scoreboard}
        playerName={player.name}
        timeline={player.timeline}
        yearGuess={turn.yearGuess}
        startYear={medianYear(player.timeline)}
        onSelectYear={setYearGuess}
        playing={playing}
        onTogglePause={togglePause}
        onRestart={session.restart}
        clock={clock}
        onSkip={skip}
        lockLabel={checkingYear ? 'Checking…' : guessSlot ? 'Lock in' : 'Pick a year'}
        lockDisabled={!guessSlot || checkingYear}
        onLock={() => lockIn()}
        swipeCards={!!game.settings.swipeCards}
      />
  ) : (
    screen
  )

  // The game lives in its own full-screen frame so it can be turned as a whole;
  // fixed elements (bottom bar, menu) then stay pinned to the turned frame.
  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <div
        className={cx(
          'absolute top-1/2 left-1/2 bg-bg transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]',
          turned ? 'h-[100dvw] w-[100dvh]' : 'size-full',
        )}
        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
      >
        <ScreenRotation value={angle}>
          {/* Hold a card to open its song. */}
          <SongDetailsProvider
            playlistId={game.settings.playlistId}
            onEditYear={(songId, year) => onChange((g) => overwriteCardYear(g, songId, year))}
          >
            <div data-scroller className="h-full overflow-y-auto overscroll-contain">
              {content}
            </div>
            {overlays}
          </SongDetailsProvider>
        </ScreenRotation>
      </div>
    </div>
  )
}

/** Whether the phone is held (or the window is) wider than tall. */
function useLandscape() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(orientation: landscape)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(orientation: landscape)').matches,
  )
}
