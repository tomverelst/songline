/**
 * The songs of a game as a stream of cards. Each rule is a small deck that
 * wraps the deck it draws from, so they compose:
 *
 *   new game:  SourceDeck → YearRangeDeck → SpreadDecadesDeck → FreshFirstDeck
 *   playing:   SourceDeck → LookupDeck → BufferDeck → YearRangeDeck → AvoidDoubleYearsDeck
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

/** An inclusive range of years, e.g. the 1960s to the 1980s: 1960–1989. */
export interface YearRange {
  from?: number
  to?: number
}

export function inYearRange(year: number, range: YearRange | undefined) {
  return (range?.from === undefined || year >= range.from) && (range?.to === undefined || year <= range.to)
}

/**
 * Drops cards outside a range of years, going by the year known so far. Put
 * it before a LookupDeck to filter on Spotify's year without looking songs up
 * (an original year is never later than Spotify's, so a song from before the
 * range can go straight away), and after one to filter on the real year.
 */
export class YearRangeDeck extends DeckFilter {
  private readonly range: YearRange

  constructor(upstream: Deck, range: YearRange) {
    super(upstream)
    this.range = range
  }

  draw() {
    for (let song = this.upstream.draw(); song; song = this.upstream.draw()) {
      if (inYearRange(song.year, this.range)) return song
    }
    return undefined
  }

  remaining() {
    return this.upstream.remaining().filter((s) => inYearRange(s.year, this.range))
  }
}

/**
 * Spreads the years: deals by picking one of the decades still in the deck at
 * random, then the next card from that decade. Every decade comes up about
 * equally often, however many songs the playlist has from each.
 */
export class SpreadDecadesDeck extends DeckFilter {
  private readonly random: () => number
  private readonly decades = new Map<number, Song[]>()
  private order: Song[] | null = null

  constructor(upstream: Deck, random: () => number = Math.random) {
    super(upstream)
    this.random = random
  }

  /** Deals the whole deck out into decades, then lays them out in spread order. */
  private spread(): Song[] {
    if (this.order) return this.order
    for (let song = this.upstream.draw(); song; song = this.upstream.draw()) {
      const decade = Math.floor(song.year / 10) * 10
      this.decades.set(decade, [...(this.decades.get(decade) ?? []), song])
    }
    const order: Song[] = []
    const piles = [...this.decades.values()]
    while (piles.length) {
      const i = Math.floor(this.random() * piles.length)
      order.push(piles[i].shift()!)
      if (!piles[i].length) piles.splice(i, 1)
    }
    return (this.order = order)
  }

  draw() {
    return this.spread().shift()
  }

  putBack(song: Song) {
    this.spread().push(song)
  }

  remaining() {
    return [...this.spread()]
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
 * A new game's deck: the playlist shuffled, only the chosen years (by
 * Spotify's year; the real year is checked while playing), optionally spread
 * over the decades, and songs heard before last.
 */
export function newGameDeck(
  songs: Song[],
  options: { yearRange?: YearRange; spreadDecades?: boolean; heard?: ReadonlySet<string>; random?: () => number },
): Deck {
  let deck: Deck = new YearRangeDeck(SourceDeck.shuffled(songs, options.random), options.yearRange ?? {})
  if (options.spreadDecades) deck = new SpreadDecadesDeck(deck, options.random)
  return new FreshFirstDeck(deck, options.heard ?? new Set())
}

/**
 * The deck a game draws from: what's left of the playlist, with original
 * years looked up a few cards ahead, songs whose real year falls outside the
 * chosen range dropped and, when wanted, no double years.
 */
export function playingDeck(
  songs: Song[],
  options: {
    lookUp: (song: Song) => Promise<number | null>
    blockedYears: () => ReadonlySet<number>
    yearRange?: YearRange
  },
) {
  const lookup = new LookupDeck(new SourceDeck(songs), options.lookUp)
  const inRange = new YearRangeDeck(new BufferDeck(lookup, LOOK_AHEAD), options.yearRange ?? {})
  const deck = new AvoidDoubleYearsDeck(inRange, options.blockedYears)
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
