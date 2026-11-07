# Songline

A local multiplayer music game for a single phone, powered by Spotify. A
random song from a playlist plays, and the current player has to place it
in their personal timeline of songs.

## How to play

1. **Setup:** add the players, pick a **game mode** (Standard, or Battle for two) and the number of points
   needed to win, connect Spotify, pick a playlist and choose the device the
   music plays on.
2. Every player starts with one random song card (the year is shown).
3. On your turn, tap **Play mystery song** and pass the phone around. Nothing
   about the song is shown. Enter the **year** you think it's from with the big
   number field or the −10/−1/+1/+10 buttons. Your cards stay visible below it,
   and the spot where your guess lands is highlighted:
   - **before** your earliest card,
   - **between** two of your cards (e.g. between 1970 and 1980 means 1971–1979),
   - **after** your latest card, or
   - **in** the same year as one of your cards.

   Your cards are shown as a fanned hand of playing cards with album art and
   the year in big numbers, with the mystery song as a face-down card where
   your guess lands. Swipe through the hand, or tap a card to guess its year:
   the mystery card is laid on top of it. Press and hold the mystery card to
   pick it up and drag it to another spot. The year follows the card: a card's
   year when held over a card, and every year in between as it moves across a
   gap (or past either end).
4. Lock in. If the real year falls in the same spot as your guess, you win the
   card, even if you didn't hit the exact year.
5. Bonus **coins**, one each, whether or not you won the card:
   - **Exact year**: ticked automatically when your guess matches the year exactly.
   - **Title** and **Artist**: after the reveal, tick the ones you named out loud.

   Everything on the reveal screen, including whether you won the card, can be
   tapped to correct it. That's useful when the table agrees the year is wrong.

### Game mode: Standard

- **Points:** every card in your timeline is a point. The first player to reach
  the points to win takes the game.
- **Coins:** bonus coins are shown next to the points. They don't count towards
  winning, but if the deck runs out (or the game is ended early) they break a
  tie on points.
- **Time to guess** (Off, 15, 30, 45 or 60 seconds): a big countdown next to
  the play controls, the seconds in a ring (in the player's colour) that runs
  down once the mystery song can be heard (it waits for the speaker to really
  start, which can take a few seconds), and stops while it's paused. It turns red
  and beats for the last 10 seconds. When it runs out, the guess is
  locked in as it stands; with no year picked yet the card is lost (title and
  artist coins can still be ticked on the reveal).
- **Start somewhere in the song**: the mystery song starts at a random point
  instead of the beginning: past the intro (at least 10 seconds in, or 10% of
  the song), and early enough that the whole time limit (or half a minute
  without one) plus a margin fits before the end. **Restart** goes back to that
  same point. Songs too short for that start as late as fits, or at the start.
- **No double years** (in Standard and Battle, and in the ☰ menu): a mystery
  song is never from a year that's already in the guessing player's timeline
  (in Battle, in either timeline), going by the original year looked up ahead
  of time. Songs from those years stay in the deck for later turns. If a song
  started before its year was known and the year clashes, the game puts that
  song back and plays another.
  When every song left clashes, they play anyway.
  Since every card is then from another year, the points to win can't be set
  higher than the years there are to play (10 for just the 1980s), unless
  coins count as points; and a game won't start when the playlist's songs
  cover fewer years than the points to win.
- **Decades** (in Standard and Battle): play only songs from a range of
  decades, e.g. the 1960s to the 1980s. Each end can also be **Any**. Starting
  cards are from the range too. A song whose original year turns out to be
  outside the range is dropped before it plays (if its year is known by then).
  Songs are picked by Spotify's year first, so a remaster that Spotify dates
  after the range is left out even if the original fits.
- **Spread the years**: deals by picking a decade at random, then a song from
  it, so every decade in the playlist comes up about equally often. A playlist
  that's mostly 80s still gives you the 60s and the 2000s regularly.
- **Advanced options** → **Coins count as points**: makes coins count towards
  the target as well, so a perfect turn is worth 4 points.
- **Advanced options** → **Autoplay** (on by default): the "whose turn" screen
  starts the next mystery song by itself after 2.5 seconds. The border of the
  Play button fills up as a countdown; tap it to start straight away. Opening
  the ☰ menu pauses the countdown.
- **Advanced options** → **Turn the screen to each player**: for a phone lying
  flat in the middle of the table. **Across** turns the screen upside down
  every other turn, for players sitting across from each other. **Around the
  table** is for 3, 4 or more players: lay the phone with its charging port
  towards the bottom side and pick everyone's side (bottom, left, top or right;
  several players can share one). Each turn the screen turns to face whoever's
  turn it is; on the left and right sides the guess and reveal use the table
  view. A picture of the table shows who sits where. It can also be changed
  mid-game from the ☰ menu.
- **Advanced options** → **Table view when turned sideways** (on by default):
  turn the phone on its side while guessing and the screen switches to a table
  view: your cards lie in one straight row, and you pick the year by swiping a
  ruler along the bottom (your cards' years are dotted on it). Tap a card to
  guess its year. With **Guess card stays in the middle**, the guess card
  stays put and you swipe anywhere on the cards to change the year (a flick
  keeps going); the cards slide past it. The reveal gets a matching view: the song on one side, your
  row of cards with the guess ringed green or red, and the points as chips to
  tap along the bottom. The screen follows the phone's motion sensor, so it faces
  whoever holds it, even with auto-rotate locked; held upside down it flips.
  Lying flat, it keeps its last position, and at the start of each turn it
  follows **Turn the screen to each player** until someone picks the phone up. It
  can also be switched on or off mid-game from the ☰ menu.
- **Advanced options** → **Avoid songs from earlier games** (on by default): the
  phone remembers every song that came up (mystery songs, skipped songs and
  starting cards). New games deal and play fresh songs first; songs you already
  heard only come up once those run out. **Forget played songs** clears the list.

### Game mode: Battle

For two players, or two teams, on one phone lying between them.

- Every turn, **both sides guess the same song at the same time**. The screen
  is split in two, one half per side, and there are no year buttons: the
  cards fill the half. Your guess starts on the middle card of your
  timeline; swipe the cards under it to change the year, or tap a card to
  take its year. Your name and score sit bottom left of your half and
  **Lock in** bottom right, as you see it.
  With **Face each other** (on by default; Advanced options or the ☰ menu)
  the top half is upside down for the player across the table. Switch it off
  for players sitting side by side.
- Once a side locks in, its guess is hidden from the other side. **Change**
  unlocks it again. When both sides have locked in, the song is revealed.
- Everyone who places the song right in their own timeline wins a copy of the
  card, and an exact year earns each side a coin.
- **Title and artist are a race:** shout them out loud, and only the side that
  names one first gets its coin. On the reveal, **Who named it first?** has a
  button per side for the title and for the artist. Tap a side to give it the
  coin (that takes it away from the other side), or tap it again for nobody.
- If one side reaches the points to win, it wins. If both reach it in the same
  turn, the higher score wins, then the most coins, and a full tie is shared.
- **Same options as Standard:** points to win, time to guess (both sides
  share one clock, and when it runs out each guess counts as it stands), start
  somewhere in the song, no double years, coins count as points, autoplay and avoid songs from
  earlier games. The table view and turning the screen to each player are
  Standard only.

**Team colours:** every player (or team) has a colour: tap the swatch next to
a name on the setup screen to move on to the next colour nobody has yet (8 to
choose from). Colours are picked before the game, not during it. It colours their name on the turn
screen, a dot and outline on the scoreboard, their half in Battle and their
name on the reveal and the final scores.

**Celebrations:** every player (or team) picks their own: confetti,
fireworks with rockets that climb, burst and crackle out, or lasers: the
screen dims like a club and fans of laser beams sweep from the corners to a
128 BPM beat, with a strobe flashing white on the beat (gold for an exact
year, the full rig for the winner). The strobe flashes once a beat, so never
more than 3 times in any one second, the limit for people with photosensitive
epilepsy; phones set to reduce motion skip the laser show altogether. Or
**emoji rain**: the player's own emoji pours down the screen (a downpour of
big ones for an exact year). Or **patatas bravas**: golden potato cubes are
tossed up from the bottom of the screen and land in a heap, then get a red
zigzag of brava sauce and a white one of aioli (a bigger plate with pimentón
for an exact year, two rounds of sauce for the winner). Or **tofu**: wobbly
blocks of tofu with happy little faces drop in, land with a squish, jiggle
and hop about along the bottom (bigger ones hopping more for an exact year, a
whole crowd for the winner). Tap the celebration button next to a name on the
setup screen to pick one (each shows itself off); for emoji rain pick one of
24 emoji or type any other. It can't be changed mid-game. It plays when that player wins a card or hits the
exact year, and for the winner at the end. In Battle, each side that wins
celebrates in its own style, so confetti and fireworks can go off together.

**Year looks off?** On the reveal, **🔍 Look up** searches the song's release
year on DuckDuckGo, and **✎ Edit** lets you overwrite it right there; the card
and exact-year points are worked out again from the new year. Holding a card in
a timeline offers the same, and the card moves to its new spot.

**⊕ Save the song:** on the reveal, the ⊕ on the corner of the album art saves the song to
your Liked Songs and opens **Add to playlist**: Liked Songs at the top, then your
own playlists. Every tick saves straight away. Press and hold any
card in a timeline (or tap a song on the final scores) to open it: the song
with the same ⊕, and a link to open it in Spotify. Logins
from before this feature need to log in to Spotify once more for it.

**Songs this game:** the final scores list every song that came up, with
its year and who won it. **Missed** shows the ones nobody got, **All** shows
every one. ▶ plays a song again from the start (on the device picked for
the game) and ⊕ saves it to Liked Songs or a playlist.

**The record** spins while the mystery song plays: tap it to pause or play
(▶/❚❚ in its middle; it pulses while paused). **Skip** next to it and Restart
throws away a song with a wrong year or one
that won't play. The ☰ menu lets you switch the playback device, end the game
early, or quit.

**Tablets:** on a tablet-sized screen (768×600 or bigger, either way round)
the whole game is drawn bigger, and the cards bigger still. Upright, there
are no year buttons on a tablet: the guess starts on the middle card of your
timeline, and you pick the year with the cards (drag the guess card or tap a
card). On its side, the table view has the ruler, as on a phone. Phones keep
the year buttons upright in Standard.

The guess card, Lock in, the ruler's needle and the timer's ring are in the
colour of the player (or team) whose turn it is.

The game state is saved in the browser, so a refresh or an accidental tab
close doesn't lose the game.

**Full screen:** the game hides the browser's address bar when you press
**Start game**, and the ☰ menu switches it on or off. iPhones don't allow that
in Safari; add Songline to the Home Screen instead (Share → Add to Home Screen),
which also works on Android. Log in to Spotify in the browser first; the Home
Screen app picks up the login.

## Spotify setup

The app talks to Spotify directly from the browser (Authorization Code + PKCE),
so there is no backend and no client secret.

1. Create an app at <https://developer.spotify.com/dashboard> and select the **Web API**.
2. Add the URL where you host the game as a **Redirect URI**. The setup screen
   shows the exact URL to use, for example `https://you.github.io/songline/` or
   `http://127.0.0.1:5173/`.
   Spotify only accepts `http` for loopback addresses. Everything else must use `https`.
3. The client ID of Songline's own Spotify app is built in (`src/spotify/auth.ts`).
   To use your own app instead, paste its client ID on the setup screen
   ("Change client ID"), or set `VITE_SPOTIFY_CLIENT_ID=...` at build time.
4. While the Spotify app is in *development mode*, add every account that will
   log in under **User Management**.

Requirements and limitations:

- **Spotify Premium** is required to start playback through the Web API. The game only
  says so when Spotify answers that Premium is missing. Spotify also refuses
  commands now and then for other reasons, such as pausing something that's
  already paused or a device that isn't ready. The game checks or retries
  those, and otherwise suggests ↺ Restart, ⏭ Skip or another device.
- Music plays through **Spotify Connect** on a device you choose: a speaker,
  TV, laptop, or the Spotify app on a phone. Spotify must have been opened on that
  device recently for it to appear. Use a device that nobody is staring at,
  because the Spotify app shows the song title.
- **Release years.** Spotify only knows the release date of the *album* a track is
  on, which is wrong for remasters and compilations. The game looks up each
  song's original release year in [MusicBrainz](https://musicbrainz.org), first
  by ISRC and then by title and artist. This runs in the background for the
  next 3 songs in the deck while a turn goes on, so a song usually starts with
  its real year already known. Nobody waits for it: a song whose lookup isn't
  done yet plays straight away and gets its year while it plays. If MusicBrainz is slow (4 s at
  lock-in), unreachable, or has no answer, the Spotify year is used. The reveal
  card shows which source the year came from. MusicBrainz data is mostly but not
  always right, so every point on the reveal screen (card, exact year, title,
  artist) can be toggled by hand, and **Skip** in the menu throws a song away.
- Spotify blocks third-party apps from reading the tracks of its own editorial
  and algorithmic playlists. Use your own playlists, or copy one into your
  library first.

## Development

```bash
npm install
npm run dev          # http://127.0.0.1:5173
npm run dev:https    # https on your LAN (self-signed), to test on a phone
npm test             # game logic tests
npm run build        # static site in dist/
```

The build is a static site that uses relative paths, so it can be hosted under
any path.

## Deployment

Every push to `main` is tested, built and published to GitHub Pages at
<https://tomverelst.github.io/songline/> by `.github/workflows/deploy.yml`.

- **Enable Pages once:** under Settings → Pages, set Source to **GitHub Actions**.
- **Register the redirect URI:** add `https://tomverelst.github.io/songline/` to your Spotify app.
- **Optional client ID override:** add a repository variable `SPOTIFY_CLIENT_ID` (Settings → Secrets and
  variables → Actions → Variables) to build with a different Spotify app.

## Project layout

- `src/game/`: pure game rules (slots, placement, scoring, guess matching), with tests
- `src/spotify/`: PKCE login, playlists and Connect playback
- `src/musicbrainz.ts`: original release year lookup, with fallback
- `src/game/deck.ts`: the songs as a stream of cards, built from small decks
  that each wrap the next: `SourceDeck` (the shuffled playlist) →
  `YearRangeDeck` (the chosen decades) → `SpreadDecadesDeck` (a random decade
  each time) → `FreshFirstDeck` (songs from earlier games last) when a game is
  set up. While playing: `LookupDeck` (original year, looked up as a card
  passes through) → `BufferDeck` (pulls 3 cards ahead, so their lookups run
  early) → `YearRangeDeck` (on the real year) → `AvoidDoubleYearsDeck` (holds
  back blocked years for later). `GameState.deck` saves what's left, in draw
  order.
- `src/game/battle.ts`: Battle mode's rules (simultaneous guesses, shared wins), with tests
- `src/screens/`: the setup, results and game screens. Each game mode has its
  own screen (`GameScreen` for Standard, `BattleScreen` for Battle); what they
  share lives in `useTurnSession.ts` (playback, autoplay, year lookup, guess
  clock) and `components/GameParts.tsx` (clock, reveal year, points, menu)
- `src/components/`: shared UI (`ui.tsx`: buttons, cards, inputs, switches), the timeline and the device picker
- Breakpoints live in CSS only: `index.css` defines the `tablet` variant once (768×600 and up; phones
  on their side stay phones). Layout uses it as `tablet:` classes. It also sets a bigger root font size
  (everything in rem grows) and the variables `--card-scale` and `--cards-only`, which JavaScript reads
  through `components/scale.ts` for the few things it has to know: sizes for card maths and swiping
  instead of year buttons. Don't repeat the media query in JavaScript.
- Styling is Tailwind CSS v4: theme colours live in `@theme` in `src/index.css`; use utility classes and the components in `ui.tsx` rather than new CSS
