# Șah: Originile — consola de test

*The app is in Romanian. This file is the developer's note.*

A companion app prototype for **Chess: The Origins**, the board-game-style chess
by Anca Rohlicek and Paul Pamfil.

The shipping product has underboard sensors and pieces that talk to the app. This
prototype has neither. It is built for the stage before that: a wooden board with
the map printed over it, a phone standing next to it, and every move entered by
hand.

**Play:** https://paulpamfil-star.github.io/sah1/ — public, no account, one phone or two
**On Claude:** https://claude.ai/artifact/WgKas38sCShyM9tB1bfT6B — same app, Claude's own store
**Design canvas (reference boards):** https://claude.ai/artifact/J12hreb7yw5R3K8VjcDCpG

One file serves both, with two backends behind one seam. Inside a
Claude artifact it uses the artifact's own document store. Served as a plain page
it uses Supabase. Nothing else in the app knows the difference.

The public link is the one to share: no Claude account, no workspace, anyone with
the URL can be the second phone.

### Setting up the Supabase side

Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase dashboard —
SQL Editor → New query → paste → Run. It creates the `matches` table, turns on row
level security with the playtest policies, and adds the table to the realtime
publication.

The project URL and publishable key sit in `index.html` in plain sight. That
is what a publishable key is for; it ships in client code by design and RLS is
what actually guards the rows. The **secret** key never goes anywhere near this
repository.

Read the policy comments in the SQL before you ship anything: as written, anyone
with the site's key can read or write any match. Fine for a playtest, not fine for
a product.

---

## What this is

Infrastructure and the hazards, in Romanian. The console runs the turn, keeps the
record, and decides what happens to you.

It holds you to ordinary chess — whose turn it is, where a piece may go — with one
marked **Fără reguli** override for when something at the table says otherwise.
Nothing is asked of the player after a move: the console resolves the turn itself
and hands it over.

## The hazards

Nothing is on the board at the start and nobody picks anything. A hazard is drawn
only when a piece **lands** on a square, and the square it fired on is spent for
the rest of the match.

| | Hazard | Tier | Weight | What fires |
|---|---|---|---|---|
| ░ | Mlaștină | Comun | 30 | The piece that landed is mired — it cannot move for 2 plies |
| ↝ | Vânt | Comun | 27 | The piece is shoved one square, direction rolled. Blocked, it stays |
| ≈ | Râu | Neobișnuit | 18 | A run of 3–4 squares floods for 5 plies. Only knights jump it |
| ❄ | Ger | Neobișnuit | 14 | Knights move and capture as pawns for 3 plies |
| ✟ | Înviere | Rar | 8 | A fallen piece returns to a square the player chooses |
| ═ | Cădere în tranșeu | Unic | 3 | The piece is gone for good. Never the king. **Once per match** |

Weights are out of 100, so each reads straight as a percentage of whatever fires.

### The roll

On each completed move, against the square just landed on:

```
square already fired       → nothing, it is spent
first 6 plies              → nothing, the opening is safe
fewer than 3 plies since   → nothing, never two in a row
otherwise  p = 16% + 4% per quiet ply beyond the third, capped at 45%
```

The climbing chance is the point: a quiet stretch gets steadily more dangerous, so
tension builds instead of going flat and a match cannot die quiet. It resets the
moment something fires. Over a 40-ply game that is six or seven events, with the
trench landing in roughly one match in five.

Re-draws rather than wasted rolls: the trench on a king, a revival with nothing
fallen, a second trench after the first.

**Only the phone that made the move rolls**, and it writes the result into the
shared match. Two phones can never roll different dice for the same move.

### On the board

Every hazard arrives with its own motion — the water rises and runs, the mud
swallows the square and the piece sinks in it, the ground cracks open, a gust
crosses, the frost sweeps the whole board, a revived piece comes back in light.
Each carries a countdown on its own square that ticks every ply and turns amber on
its last. When it expires it washes off and the square takes a small dot: it is
safe from then on.

## What it deliberately does not do

No check or checkmate detection. No castling in one tap. No en passant. No
per-player clock. No sensors, no Bluetooth. No mountain — that card is out.

## One phone or two

The opening screen asks. Both paths run the same console.

**Un telefon, între voi.** It sits by the board and you both tap into it. Nothing
networked; the match autosaves to that device.

**Două telefoane, legate printr-un cod.** One player starts a match and gets four
letters. The other opens the same link, types those letters, and the two are live:
every move and every hazard appears on both phones at once. Each phone shows the
board from its own player's side and will only let that player move.

The pairing is one row per match, keyed by the code, with both phones watching it.
On the public link that row lives in Supabase; inside a Claude artifact it lives in
the artifact's own store. Whichever it is, every write carries a rising `rev` and
the writer's tag, so a phone can tell its own echo from the other player's move.

**What two-phone play requires.** On the public link: nothing. No account, no
workspace — anyone you send the URL to can be the second phone. (Inside a Claude
artifact both players must be signed in to the same Claude workspace, which is why
the public link is the one to share.)

## Layout

```
index.html           the console — one phone or two, the thing you actually use
docs/index.html      the same file, so Pages serves it whichever folder it is set to

test/two-screens/    drives the real app in two browser windows and plays a few
                     moves between them — see its README for what that proves

canvas/project/
  canvas.json        the canvas index — frames, order, notes
  Main.dc.html       the single-phone console as a design artboard
  Anatomy.dc.html    every control explained, and the loop at the table
  Record.dc.html     what one move records
  System.dc.html     palette, type, marks, controls
```

`index.html` is the live app, and `docs/index.html` is a copy of it so the site
serves either way. The canvas holds the design reference; it predates the hazard
model and shows the earlier card-and-terrain console, so read it for the visual
language, not for the rules.

## The record

One move, as the console writes it:

```json
{
  "ply": 9, "no": 5, "side": "w",
  "san": "Cg1–f3", "from": "g1", "to": "f3", "piece": "cal",
  "captured": null, "promotedTo": null, "override": false,
  "hazard": "swamp", "hazardRo": "Mlaștină",
  "inPlay": ["river"], "at": 412300
}
```

A hazard in play:

```json
{ "id": 4, "hzId": "river", "left": 3, "born": 9, "cells": [20, 21, 22], "from": 5 }
```

## Design

Apple HIG shape on the game's own field: type on the iOS Dynamic Type ladder with
nothing below 11pt, a translucent bar and dock over the content layer, 44pt hit
regions, one prominent button per view, system red for destructive actions. Board
colours are sampled from the printed board itself — the ochre and moss of the map,
the brass of the box, on a dark field. Every animation folds away under
`prefers-reduced-motion`.
