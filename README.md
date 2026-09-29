# Chess: The Origins — Playtest Console

A companion app prototype for **Chess: The Origins**, the board-game-style chess
by Anca Rohlicek and Paul Pamfil.

The shipping product has underboard sensors and pieces that talk to the app. This
prototype has neither. It is built for the stage before that: a wooden board with
the map printed over it, a phone standing next to it, and every move entered by
hand.

**Play:** https://paulpamfil-star.github.io/sah1/ — public, no account, one phone or two
**On Claude:** https://claude.ai/artifact/WgKas38sCShyM9tB1bfT6B — same app, Claude's own store
**Design canvas (reference boards):** https://claude.ai/artifact/J12hreb7yw5R3K8VjcDCpG

One `docs/index.html` serves both, with two backends behind one seam. Inside a
Claude artifact it uses the artifact's own document store. Served as a plain page
it uses Supabase. Nothing else in the app knows the difference.

The public link is the one to share: no Claude account, no workspace, anyone with
the URL can be the second phone.

### Setting up the Supabase side

Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase dashboard —
SQL Editor → New query → paste → Run. It creates the `matches` table, turns on row
level security with the playtest policies, and adds the table to the realtime
publication.

The project URL and publishable key sit in `docs/index.html` in plain sight. That
is what a publishable key is for; it ships in client code by design and RLS is
what actually guards the rows. The **secret** key never goes anywhere near this
repository.

Read the policy comments in the SQL before you ship anything: as written, anyone
with the site's key can read or write any match. Fine for a playtest, not fine for
a product.

---

## What this is

Infrastructure, not rules. The console runs the turn and keeps the record; it has
no idea what your cards or your terrain actually do.

It holds you to ordinary chess — whose turn it is, and where a piece may go — with
one clearly marked override for when a card or the terrain says otherwise. After
every move it names what it saw and asks what happened. Terrain, flags and cards
are carried on every record, and nothing reads them yet.

## What it does

| | |
|---|---|
| **Two-tap move entry** | Tap the piece, tap the square. Only the side to move can be picked up; the other side's pieces sit back a shade. Only squares chess allows are accepted. |
| **Break the rule** | One tap lifts the restriction for a single move, and that move is logged as `OVERRIDE`. |
| **It asks after every move** | The band names the move and the terrain it landed on, then five plain buttons — Mine, Terrain event, Card played, Move refused, Check — and a free note. One tap ends the turn. |
| **Terrain** | Marking it is the opening step of a match. Marked squares are tinted and carry an icon, with a legend under the board at all times. |
| **Card shelf** | Name your cards once at setup, then tap to play one. Each carries a countdown that ticks a step per move and drops off by itself. |
| **Undo** | Replays the match from the opening position, so the board and the record cannot drift apart. |
| **Export** | The full log as readable text or as JSON, copied to the clipboard. |
| **Autosave** | Best-effort to `localStorage`, so a dropped phone does not cost you the match. |

## What it deliberately does not do

No check or checkmate detection. No castling in one tap (log the king, then the
rook). No en passant. No per-player chess clock. No sensors, no Bluetooth. And
nothing anywhere knows what a card or a terrain type does.

## One phone or two

The opening screen asks. Both paths run the same console.

**One phone, between us.** The phone sits by the board and both players tap into
it. Nothing networked; the match autosaves to that device.

**Two phones, joined by a code.** One player starts a match and gets four
letters. The other opens the same link, types those letters, and the two are
live: every move, flag, card and terrain mark appears on both phones at once.
Each phone shows the board from its own player's side and will only let that
player move — your opponent's pieces sit back a shade and refuse the tap.

The pairing runs on the artifact's shared document store: one document per match
at `matches/<CODE>`, with both phones subscribed to it. The joining phone takes
its seat under a short lease, so two people entering the same code cannot both
claim White.

**What two-phone play requires.** Both players must be signed in to the same
Claude workspace and opening the same shared link. A page with a shared store is
organization-internal and cannot be opened by a public link — that is a platform
rule, not a setting. If the second player cannot be added to the workspace, the
one-phone path is the whole game and loses nothing except the per-player view.

## Layout

```
docs/
  index.html         the console — one phone or two, the thing you actually use

canvas/project/
  canvas.json        the canvas index — frames, order, notes
  Main.dc.html       the single-phone console as a design artboard
  Anatomy.dc.html    every control explained, and the loop at the table
  Record.dc.html     what one move records, and where the rules plug in
  System.dc.html     palette, type, terrain marks, controls
```

`docs/index.html` is the live app. The canvas holds the design reference — the
control-by-control breakdown, the data contract, and the visual language.

## The record

One move, as the console writes it:

```json
{
  "ply": 8,
  "no": 4,
  "side": "b",
  "move": "Bf8×c5",
  "from": "f8",
  "to": "c5",
  "piece": "bishop",
  "captured": "pawn",
  "promotedTo": null,
  "terrainFrom": null,
  "terrainTo": "river",
  "tags": ["CAPTURE", "MINE"],
  "note": "lost the pawn",
  "atMs": 412300
}
```

A card in play:

```json
{ "name": "FOG OF WAR", "scope": "BOTH", "left": 2, "fromMove": 4 }
```

## Where the rules plug in

Four sockets, all wired, none live:

1. **Terrain → movement.** Which terrain changes which piece, and by how much.
2. **Minefields.** How mines are placed, who sees them, what happens on contact.
3. **Cards.** Where a card comes from, what it does, whether a player holds a hand.
4. **Hidden information.** Whether mines, cards in hand or anything else stay
   secret from the opponent. One shared screen cannot keep a secret, so this is
   what decides whether the game needs a screen per player.

## Design

Colours are sampled from the printed board itself — the ochre and moss of the map,
the brass of the box, on a dark field. EB Garamond for what is said, JetBrains Mono
for what is counted. The full language is on the `System` artboard.
