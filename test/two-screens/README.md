# The two-screen test

Drives the real `index.html` in two browser windows and plays a few moves
between them, so the pairing and sync code is exercised before a playtest
rather than during one.

```
node test/two-screens/server.mjs index.html 8099   # in one terminal
node test/two-screens/two-screens.mjs 8099          # in another
```

Needs Playwright and a Chromium. The driver points at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; change that line for
your own machine, or drop it to use Playwright's own download.

## What it proves, and what it does not

`server.mjs` serves the real app with one line changed: the Supabase client URL
is swapped for a local stand-in that speaks the same shape — one `select`, one
`upsert`, `postgres_changes` on a code, and channel presence, over polling
instead of a socket.

So it proves **the app's own pairing and sync logic**: that the code pairs two
phones, that seats are taken correctly, that a move made on one screen reaches
the other, that the board is drawn from each player's side, that a card played
on one phone lands on both, and that nothing throws on either side. That is
where the joining bug lived.

It proves **nothing about Supabase itself** — not the schema, not row level
security, not realtime delivery. Those only get tested against the live
project.
