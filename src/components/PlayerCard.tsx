import { useState } from 'react'
import { CELEBRATIONS, DEFAULT_EMOJI, defaultCelebration, type Celebration } from '../party'
import { TEAM_COLORS, teamColorById, teamVars, type TeamColor } from '../game/teams'
import { findProfile, profileKey, type Profile, type RosterPlayer } from '../profiles'
import { cx } from './classes'
import { CardButton, CelebrationButton, CelebrationIcon } from './PlayerButtons'
import { Button, CardTitle, IconButton, Muted, TextInput } from './ui'

// The players on this phone as collectible cards, a bit like trading cards:
// a frame in their colour, their name with a trophy count where the HP goes,
// their painted card as the picture, and their celebration as their move.

/** What each celebration does, as a card's move. */
const MOVES: Record<string, (emoji: string) => string> = {
  confetti: () => 'Showers the table in confetti.',
  fireworks: () => 'Lights up the sky.',
  lasers: () => 'Turns the room into a club.',
  emoji: (emoji) => `Makes it rain ${emoji}.`,
  bravas: () => 'Serves up a hot plate.',
  tofu: () => 'Sets the tofu bouncing.',
  knitting: () => 'Knits a scarf on the spot.',
}

export function PlayerCard({
  player,
  color,
  order,
  dimmed,
  onSelect,
  onEdit,
  className,
}: {
  player: RosterPlayer
  /** Their colour in this game (theirs, unless someone picked first had it). */
  color: TeamColor
  /** Their place in the turn order when picked (1, 2, …). */
  order?: number
  /** Can't be picked right now (Battle has two already). */
  dimmed?: boolean
  onSelect?: () => void
  onEdit?: () => void
  className?: string
}) {
  const style = player.celebration ?? defaultCelebration()
  const emoji = player.emoji ?? DEFAULT_EMOJI
  const move = CELEBRATIONS.find((c) => c.id === style)
  const picked = order !== undefined
  return (
    <div
      style={teamVars(color)}
      className={cx(
        'relative aspect-[63/88] w-full transition-transform duration-200',
        picked && '-translate-y-1 -rotate-1',
        dimmed && 'opacity-45',
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={onSelect ? picked : undefined}
        aria-label={onSelect ? `${player.name}${picked ? `, playing ${order}${['st', 'nd', 'rd'][order! - 1] ?? 'th'}` : ''}` : undefined}
        disabled={!onSelect}
        onClick={onSelect}
        className={cx(
          // The frame, in their colour, round a light card.
          'flex size-full flex-col rounded-[0.9rem] bg-team-gradient p-[5%] text-left text-[#2a1f2e]',
          picked ? 'shadow-[0_0_0_3px_white,0_10px_28px_color-mix(in_srgb,var(--team)_60%,transparent)]' : 'shadow-[0_8px_20px_rgb(0_0_0/0.45)]',
        )}
      >
        <span className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.55rem] bg-linear-to-b from-[#fffaf0] to-[#f1e6cf] px-[6%] py-[5%]">
          {/* Name, and the trophies where the HP would be. */}
          <span className="flex items-baseline justify-between gap-1">
            <span className="truncate text-[0.95rem] leading-tight font-black">{player.name}</span>
            <span className="flex-none text-[0.7rem] font-black text-[#c0392b]">🏆{player.wins}</span>
          </span>
          {/* The picture: their painted card, or their initial in their colour. */}
          <span className="mt-[5%] block aspect-[4/3] overflow-hidden rounded-sm border-[3px] border-[#c8b98f] bg-team-gradient shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)]">
            {player.cardArt ? (
              <img src={player.cardArt} alt="" draggable={false} className="size-full object-cover [image-rendering:pixelated]" />
            ) : (
              <span className="grid size-full place-items-center text-[2.4rem] font-black text-white/90 [text-shadow:0_2px_0_rgb(0_0_0/0.25)]">
                {player.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="mt-[3%] truncate text-center text-[0.55rem] text-[#7a6a52] italic">
            {player.games ? `Played ${player.games} · won ${player.wins}` : 'New player'}
          </span>
          {/* Their move: the celebration. */}
          <span className="mt-auto flex items-center gap-1.5 border-t border-[#d8c9a3] pt-[5%]">
            <span className="text-base leading-none">
              <CelebrationIcon style={style} emoji={emoji} />
            </span>
            <span className="min-w-0 truncate text-[0.72rem] font-extrabold">{move?.name}</span>
          </span>
          <span className="text-[0.58rem] leading-snug text-[#5c4f3d]">{MOVES[style]?.(emoji)}</span>
          {/* A holo shine on the cards in play. */}
          {picked && (
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_25%,rgb(255_255_255/0.55)_42%,rgb(255_230_250/0.25)_50%,transparent_62%)] mix-blend-soft-light" />
          )}
        </span>
      </button>
      {picked && (
        <span className="pointer-events-none absolute -top-2 -left-2 grid size-7 place-items-center rounded-full bg-white text-sm font-black text-[#2a1f2e] shadow-md">
          {order}
        </span>
      )}
      {onEdit && (
        <button
          type="button"
          aria-label={`Edit ${player.name}`}
          className="absolute -right-1.5 -bottom-1.5 grid size-8 place-items-center rounded-full border border-line bg-surface-2 text-sm shadow-md"
          onClick={onEdit}
        >
          ✎
        </button>
      )}
    </div>
  )
}

/** Make a new player, or change (or delete) one: their card shows as it'll look. */
export function PlayerEditor({
  player,
  onSave,
  onDelete,
  onClose,
}: {
  /** The player to change; none to make a new one. */
  player?: RosterPlayer
  onSave: (name: string, profile: Profile) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(player?.name ?? '')
  const [profile, setProfile] = useState<Profile>(() =>
    player
      ? { color: player.color, celebration: player.celebration, emoji: player.emoji, knitPattern: player.knitPattern, cardArt: player.cardArt }
      : { color: TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)].id },
  )
  const color = teamColorById(profile.color) ?? TEAM_COLORS[0]
  const trimmed = name.trim()
  // Someone else on this phone already has that name.
  const taken = !!trimmed && profileKey(trimmed) !== profileKey(player?.name ?? '') && !!findProfile(trimmed)
  const celebration: Celebration = {
    style: profile.celebration ?? defaultCelebration(),
    emoji: profile.emoji ?? DEFAULT_EMOJI,
    ...(profile.knitPattern && { pattern: profile.knitPattern }),
  }
  const preview: RosterPlayer = { ...profile, name: trimmed || 'Your name', created: 0, games: player?.games ?? 0, wins: player?.wins ?? 0 }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={player ? `Edit ${player.name}` : 'New player'}
        className="mx-auto flex max-h-[92%] w-full max-w-[35rem] animate-slide-up flex-col gap-3 overflow-y-auto rounded-t-[20px] bg-surface px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{player ? `Edit ${player.name}` : 'New player'}</CardTitle>
          <IconButton aria-label="Close" onClick={onClose}>
            ✕
          </IconButton>
        </div>

        <div className="flex gap-4">
          <div className="w-[42%] max-w-48 flex-none">
            <PlayerCard player={preview} color={color} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <TextInput placeholder="Name" aria-label="Name" value={name} autoComplete="off" maxLength={24} onChange={(e) => setName(e.target.value)} />
            {taken && <p className="text-sm text-bad">There’s already a {trimmed} on this phone.</p>}
            <span className="text-sm font-semibold">Colour</span>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Colour">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={color.id === c.id}
                  aria-label={c.name}
                  className={cx('aspect-square rounded-full border-[3px]', color.id === c.id ? 'border-white' : 'border-transparent')}
                  style={{ background: c.hex }}
                  onClick={() => setProfile((p) => ({ ...p, color: c.id }))}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <CardButton
                playerName={trimmed}
                art={profile.cardArt}
                color={color}
                onChange={(cardArt) => setProfile((p) => ({ ...p, cardArt: cardArt ?? undefined }))}
              />
              <span className="text-sm">Paint the card</span>
            </div>
            <div className="flex items-center gap-2">
              <CelebrationButton
                playerName={trimmed}
                value={celebration}
                onChange={({ style, emoji, pattern }) => setProfile((p) => ({ ...p, celebration: style, emoji, knitPattern: pattern }))}
              />
              <span className="text-sm">Celebration</span>
            </div>
          </div>
        </div>
        <Muted>Saved on this phone, to pick for every game.</Muted>

        <Button
          variant="primary"
          block
          disabled={!trimmed || taken}
          onClick={() => {
            onSave(trimmed, profile)
            onClose()
          }}
        >
          {player ? 'Save' : 'Add player'}
        </Button>
        {onDelete && (
          <Button
            variant="danger"
            block
            onClick={() => {
              if (confirm(`Delete ${player?.name} from this phone, with their card and wins?`)) {
                onDelete()
                onClose()
              }
            }}
          >
            Delete player
          </Button>
        )}
      </div>
    </div>
  )
}
