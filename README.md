# Songline

A local multiplayer music game for a single phone, powered by Spotify. A
random song from a playlist plays, and the current player has to place it
in their personal timeline of songs.

## How to play

1. **Setup:** add the players, choose the number of points needed to win, connect
   Spotify, pick a playlist and choose the device the music plays on.
2. Every player starts with one random song card (the year is shown).
3. On your turn, tap **Play mystery song** and pass the phone around. Nothing
   about the song is shown. Enter the **year** you think it's from with the big
   number field or the −10/−1/+1/+10 buttons. Your cards stay visible below it,
   and the spot where your guess lands is highlighted:
   - **before** your earliest card,
   - **between** two of your cards (e.g. between 1970 and 1980 means 1971–1979),
   - **after** your latest card, or
   - **in** the same year as one of your cards.
4. Lock in. If the real year falls in the same spot as your guess, you win the
   card, even if you didn't hit the exact year.
5. Bonus points, **+1 each**, whether or not you won the card:
   - **Exact year**: ticked automatically when your guess matches the year exactly.
   - **Title** and **Artist**: after the reveal, tick the ones you named out loud.

   That's at most **4 points per turn**: the card plus three bonus points.
6. Your score is the number of cards in your timeline plus your bonus points.
   The first player to reach the target wins. If the deck runs out first, the
   highest score wins.

The ☰ menu lets you switch the playback device, skip a song (for example
when Spotify only has a remaster with the wrong year), end the game early,
or quit.

The game state is saved in the browser, so a refresh or an accidental tab
close doesn't lose the game.

## Spotify setup

The app talks to Spotify directly from the browser (Authorization Code + PKCE),
so there is no backend and no client secret.

1. Create an app at <https://developer.spotify.com/dashboard> and select the **Web API**.
2. Add the URL where you host the game as a **Redirect URI**. The setup screen
   shows the exact URL to use, for example `https://you.github.io/songline/` or
   `http://127.0.0.1:5173/`.
   Spotify only accepts `http` for loopback addresses. Everything else must use `https`.
3. Paste the app's **client ID** on the setup screen, or bake it in at build time
   with `VITE_SPOTIFY_CLIENT_ID=...`.
4. While the Spotify app is in *development mode*, add every account that will
   log in under **User Management**.

Requirements and limitations:

- **Spotify Premium** is required to start playback through the Web API.
- Music plays through **Spotify Connect** on a device you choose: a speaker,
  TV, laptop, or the Spotify app on a phone. Spotify must have been opened on that
  device recently for it to appear. Use a device that nobody is staring at,
  because the Spotify app shows the song title.
- The year is the album's release date on Spotify. Compilations and
  remasters can show a later year. Use playlists of original releases where
  you can, and use **Skip** when a year is clearly wrong.
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
any path: GitHub Pages, Netlify, Vercel, or any static file server.

## Project layout

- `src/game/`: pure game rules (slots, placement, scoring, guess matching), with tests
- `src/spotify/`: PKCE login, playlists and Connect playback
- `src/screens/`: the setup, game and results screens
- `src/components/`: the timeline and the device picker
