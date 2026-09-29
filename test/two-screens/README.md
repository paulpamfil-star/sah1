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

So it proves **the app's own game and sync logic**: that the code pairs two
phones, that the board is drawn from each player's side, that a move made on one
screen reaches the other and the turn passes by itself, that every refusal is
said out loud, that the opening is never touched by a hazard, and that each
hazard — river, frost, trench, revival, swamp — fires correctly and lands on
both phones. It also asserts the two things that were cut: no terrain painting
at setup, no "what happened?" prompt, and no English left on screen.

Hazards are fired from the hidden tester's panel rather than waited for, so the
run is deterministic. The dice themselves (the weights and the climbing chance)
are not exercised here — only the guard that nothing fires in the first six
plies.

It proves **nothing about Supabase itself** — not the schema, not row level
security, not realtime delivery. Those only get tested against the live
project.
