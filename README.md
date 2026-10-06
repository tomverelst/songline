# Songline

A local multiplayer music game for a single phone, powered by Spotify. A
random song from a playlist plays, and the current player has to place it
in their personal timeline of songs.

## How to play

1. **Setup:** add the players, pick a **game mode** and the number of points
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
- **Advanced options** → **Coins count as points**: makes coins count towards
  the target as well, so a perfect turn is worth 4 points.
- **Advanced options** → **Autoplay** (on by default): the "whose turn" screen
  starts the next mystery song by itself after 2.5 seconds. The border of the
  Play button fills up as a countdown; tap it to start straight away. Opening
  the ☰ menu pauses the countdown.
- **Advanced options** → **Flip screen between turns**: turns the whole screen
  upside down every other turn, so the phone can lie in the middle of the table
  for players sitting across from each other. It can also be switched on or off
  mid-game from the ☰ menu.
- **Advanced options** → **Table view when turned sideways** (on by default):
  turn the phone on its side while guessing and the screen switches to a table
  view: your cards lie in one straight row, and you pick the year by swiping a
  ruler along the bottom (your cards' years are dotted on it). Tap a card to
  guess its year. The reveal gets a matching view: the song on one side, your
  row of cards with the guess ringed green or red, and the points as chips to
  tap along the bottom. The screen follows the phone's motion sensor, so it faces
  whoever holds it, even with auto-rotate locked; held upside down it flips.
  Lying flat, it keeps its last position, and at the start of each turn it
  follows **Flip screen between turns** until someone picks the phone up. It
  can also be switched on or off mid-game from the ☰ menu.
- **Advanced options** → **Avoid songs from earlier games** (on by default): the
  phone remembers every song that came up (mystery songs, skipped songs and
  starting cards). New games deal and play fresh songs first; songs you already
  heard only come up once those run out. **Forget played songs** clears the list.

**Skip** next to Pause and Restart throws away a song with a wrong year or one
that won't play. The ☰ menu lets you switch the playback device, end the game
early, or quit.

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

- **Spotify Premium** is required to start playback through the Web API.
- Music plays through **Spotify Connect** on a device you choose: a speaker,
  TV, laptop, or the Spotify app on a phone. Spotify must have been opened on that
  device recently for it to appear. Use a device that nobody is staring at,
  because the Spotify app shows the song title.
- **Release years.** Spotify only knows the release date of the *album* a track is
  on, which is wrong for remasters and compilations. While a song plays, the
  game looks up its original release year in [MusicBrainz](https://musicbrainz.org),
  first by ISRC and then by title and artist. If MusicBrainz is slow (4 s at
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
- `src/screens/`: the setup, game and results screens
- `src/components/`: shared UI (`ui.tsx`: buttons, cards, inputs, switches), the timeline and the device picker
- Styling is Tailwind CSS v4: theme colours live in `@theme` in `src/index.css`; use utility classes and the components in `ui.tsx` rather than new CSS
