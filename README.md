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

Infrastructure, not rules. The console records a match; it does not referee one.

Any piece can go to any square. Nothing is ever refused. Terrain, flags and cards
are all carried on the record, and nothing reads them yet — that is what the rules
layer will do once the rules exist.

## What it does

| | |
|---|---|
| **Two-tap move entry** | Tap the piece, tap the square. The move is logged. |
| **Move hints** | Where ordinary chess would allow the piece to go — a guide for the eye, never a block. Toggleable. |
| **Terrain marking** | Paint mountains, rivers, trenches and villages onto the grid from the printed map. Every move then records what it left and what it landed on. |
| **Flags** | Nine one-tap tags — `MINE` `MOUNTAIN` `RIVER` `TRENCH` `VILLAGE` `CARD` `REFUSED` `CHECK` `CAPTURE` — plus a free note. |
| **Cards in play** | A name, a scope and a countdown. Ticks down one step per move, drops off by itself. |
| **Undo** | Replays the whole match from the opening position, so the board and the record cannot drift apart. |
| **Export** | The full log as readable text or as JSON, copied to the clipboard. |
| **Autosave** | Best-effort to `localStorage`, so a dropped phone does not cost you the match. |

## What it deliberately does not do

No legality checks. No check or checkmate. No castling in one tap (log the king,
then the rook). No en passant. No per-player chess clock. No sensors, no Bluetooth.

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
4. **Refusals.** Whether the finished game blocks an illegal move or, as here,
   logs it and moves on.

## Design

Colours are sampled from the printed board itself — the ochre and moss of the map,
the brass of the box, on a dark field. EB Garamond for what is said, JetBrains Mono
for what is counted. The full language is on the `System` artboard.
