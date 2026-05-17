# Schedule Board — Spec v1

## Concept

A digital recreation of the physical schedule board in the reference photo (from an animation studio, used to plan filming on Wallace & Gromit). The entire mechanic is: a grid of days × weeks, colored cards pinned to cells with short handwritten notes, and threads connecting cards to show relationships or duration. That's the whole tool. The appeal is in the constraint — it's a wall, not a database.

## Grid

- Columns: Monday–Sunday (7 columns). Saturday and Sunday are visually muted but functionally identical to weekdays.
- Rows: weeks, numbered down the left side, with the date of each Monday shown next to the number.
- Default span: **26 weeks** (≈6 months). User can set anywhere from 4 weeks to 52.
- The grid is the whole canvas — no other UI chrome around it beyond a minimal toolbar.

## Cards

- A card lives in one cell (one day, one week).
- Pick from a fixed palette of 6–8 colors, matching the warm/cool mix in the reference (peach, pink, orange, blue, green, yellow, mint, lilac).
- One short line of text per card, in a handwritten-feel typeface.
- Click an empty cell to add a card. Click a card to edit text or change color. Drag to move. Delete to remove.
- Multiple cards in one cell are allowed but should stack/overlap slightly rather than resize the grid.

## Threads

- Drag from one card to another to create a thread between them.
- Threads render as a slightly slack curved line — like an actual piece of string, not a vector arrow. No arrowheads.
- Click a thread to delete it. No labels, no styling options.

## Sharing

- Each board has its own URL.
- **Anyone with the link can edit.** No accounts, no permissions, no roles.
- State persists automatically — no save button.

## Look and feel

- Tactile and physical, not slick. The reference photo is the north star.
- Background should feel like the cork/wood of the original board — a warm neutral, faint texture.
- Cards have a soft drop shadow and a tiny pin-head dot, suggesting they're pinned rather than floating.
- Threads cast a faint shadow on the board behind them.
- Typography on cards: a casual handwritten or marker-style face, not a clean sans-serif.

## Out of scope for v1

To protect the simplicity: no accounts, no comments, no notifications, no calendar sync, no recurring events, no images pinned to cells, no mobile-first layout, no filtering or search, no card categories beyond color.

## Possible v2

- Pinned photos / image cards (a defining feature of the original board, deferred only to keep v1 focused).
