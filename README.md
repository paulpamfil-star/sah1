# Chess: The Origins — Playtest Console

A companion app prototype for **Chess: The Origins**, the board-game-style chess
by Anca Rohlicek and Paul Pamfil.

The shipping product has underboard sensors and pieces that talk to the app. This
prototype has neither. It is built for the stage before that: a wooden board with
the map printed over it, a phone standing next to it, and every move entered by
hand.

**Published canvas:** https://claude.ai/artifact/J12hreb7yw5R3K8VjcDCpG

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

## Layout

```
canvas/project/
  canvas.json        the canvas index — frames, order, notes
  Main.dc.html       the working console (390×844, interactive)
  Anatomy.dc.html    every control explained, and the loop at the table
  Record.dc.html     what one move records, and where the rules plug in
  System.dc.html     palette, type, terrain marks, controls
```

Each `.dc.html` is one self-contained artboard. `Main.dc.html` is the only
interactive one — it is the app.

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
