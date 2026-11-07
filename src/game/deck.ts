/**
 * The songs of a game as a stream of cards. Each rule is a small deck that
 * wraps the deck it draws from, so they compose:
 *
 *   SourceDeck → FreshFirstDeck → LookupDeck → BufferDeck → AvoidDoubleYearsDeck
 *
 * Drawing never waits. What's left can be saved (`remaining`) and a deck
 * rebuilt from it later.
 */
import type { Song } from './types'
import { withOriginalYear } from './songs'

export interface Deck {
  /** Takes the next card, or undefined when there are none left. */
  draw(): Song | undefined
  /** Puts a card back, to come up again later. */
  putBack(song: Song): void
  /** The cards still to come, in the order they'd be drawn. */
  remaining(): Song[]
  /** A card with everything found out about it so far (e.g. its original year). */
  refresh(song: Song): Song
}

/** The cards in a fixed order: the shuffled playlist, or what was left of it. */
export class SourceDeck implements Deck {
  private readonly songs: Song[]

  constructor(songs: Song[]) {
    this.songs = [...songs]
  }

  static shuffled(songs: Song[], random: () => number = Math.random) {
    return new SourceDeck(shuffle(songs, random))
  }

  draw() {
    return this.songs.shift()
  }

  putBack(song: Song) {
    this.songs.push(song)
  }

  remaining() {
    return [...this.songs]
  }

  refresh(song: Song) {
    return song
  }
}

/** A deck that draws from another one; by default it passes everything through. */
abstract class DeckFilter implements Deck {
  protected readonly upstream: Deck

  constructor(upstream: Deck) {
    this.upstream = upstream
  }

  abstract draw(): Song | undefined

  putBack(song: Song) {
    this.upstream.putBack(song)
  }

  remaining() {
    return this.upstream.remaining()
  }

  refresh(song: Song) {
    return this.upstream.refresh(song)
  }
}

/** Songs heard in earlier games only come up once the fresh ones run out. */
export class FreshFirstDeck extends DeckFilter {
  private readonly heard: ReadonlySet<string>
  private readonly later: Song[] = []

  constructor(upstream: Deck, heard: ReadonlySet<string>) {
    super(upstream)
    this.heard = heard
  }

  draw() {
    for (let song = this.upstream.draw(); song; song = this.upstream.draw()) {
      if (!this.heard.has(song.id)) return song
      this.later.push(song)
    }
    return this.later.shift()
  }

  remaining() {
    const rest = this.upstream.remaining()
    return [...rest.filter((s) => !this.heard.has(s.id)), ...this.later, ...rest.filter((s) => this.heard.has(s.id))]
  }
}

/**
 * Looks up a card's original release year as it passes through. Lookups run
 * in the background; a card drawn before its year is in gets it via `refresh`
 * or `yearFor`.
 */
export class LookupDeck extends DeckFilter {
  private readonly lookUp: (song: Song) => Promise<number | null>
  private readonly known = new Map<string, number | null>()
  private readonly pending = new Map<string, Promise<number | null>>()

  constructor(upstream: Deck, lookUp: (song: Song) => Promise<number | null>) {
    super(upstream)
    this.lookUp = lookUp
  }

  draw() {
    const song = this.upstream.draw()
    if (song) this.yearFor(song)
    return song && this.refresh(song)
  }

  /** The card's original year (null: nothing found), starting the lookup if needed. */
  yearFor(song: Song): Promise<number | null> {
    let lookup = this.pending.get(song.id)
    if (!lookup) {
      lookup = song.yearSource
        ? Promise.resolve(song.year)
        : this.lookUp(song).then((year) => {
            this.known.set(song.id, year)
            return year
          })
      this.pending.set(song.id, lookup)
    }
    return lookup
  }

  refresh(song: Song) {
    song = this.upstream.refresh(song)
    return !song.yearSource && this.known.has(song.id) ? withOriginalYear(song, this.known.get(song.id)!) : song
  }

  remaining() {
    return this.upstream.remaining().map((s) => this.refresh(s))
  }
}

/**
 * Keeps the next few cards drawn from upstream, so whatever upstream does
 * when a card passes through (like looking up its year) happens ahead of time.
 */
export class BufferDeck extends DeckFilter {
  private readonly size: number
  private readonly buffer: Song[] = []

  constructor(upstream: Deck, size: number) {
    super(upstream)
    this.size = size
    this.fill()
  }

  private fill() {
    while (this.buffer.length < this.size) {
      const song = this.upstream.draw()
      if (!song) return
      this.buffer.push(song)
    }
  }

  draw() {
    this.fill()
    const song = this.buffer.shift()
    this.fill()
    return song && this.refresh(song)
  }

  remaining() {
    return [...this.buffer.map((s) => this.refresh(s)), ...this.upstream.remaining()]
  }
}

/**
 * Passes over cards from a year that's blocked right now (e.g. already in the
 * guessing player's timeline) and holds them for later turns. When only
 * blocked cards are left, they come up anyway.
 */
export class AvoidDoubleYearsDeck extends DeckFilter {
  private readonly blockedYears: () => ReadonlySet<number>
  private readonly held: Song[] = []

  constructor(upstream: Deck, blockedYears: () => ReadonlySet<number>) {
    super(upstream)
    this.blockedYears = blockedYears
  }

  draw() {
    const blocked = this.blockedYears()
    const ok = (song: Song) => !blocked.has(song.year)
    // Held cards first: they may be fine for this turn.
    const index = this.held.findIndex((s) => ok(this.refresh(s)))
    if (index >= 0) return this.refresh(this.held.splice(index, 1)[0])
    for (let song = this.upstream.draw(); song; song = this.upstream.draw()) {
      if (ok(song)) return song
      this.held.push(song)
    }
    const song = this.held.shift()
    return song && this.refresh(song)
  }

  /** A card put back is held, so it comes up as soon as it's allowed. */
  putBack(song: Song) {
    this.held.push(song)
  }

  remaining() {
    return [...this.held.map((s) => this.refresh(s)), ...this.upstream.remaining()]
  }
}

/** How many cards ahead the original year is looked up. */
export const LOOK_AHEAD = 3

/**
 * The deck a game draws from: what's left of the playlist, with original
 * years looked up a few cards ahead and, when wanted, no double years.
 */
export function playingDeck(
  songs: Song[],
  options: { lookUp: (song: Song) => Promise<number | null>; blockedYears: () => ReadonlySet<number> },
) {
  const lookup = new LookupDeck(new SourceDeck(songs), options.lookUp)
  const deck = new AvoidDoubleYearsDeck(new BufferDeck(lookup, LOOK_AHEAD), options.blockedYears)
  return { deck, lookup }
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
