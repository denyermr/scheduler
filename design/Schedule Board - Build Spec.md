# Schedule Board — Build Spec v1

Companion to `Schedule Board Spec — bundled.html` (visual reference).
This file is the canonical, machine-readable design system + interaction spec for implementation.

---

## 1. Product summary

A digital recreation of a physical schedule board (animation studio, Wallace &amp; Gromit reference photo). The whole mechanic:

- A grid of **weeks × Mon–Sun**.
- **Cards** pinned to cells with short handwritten text.
- **Threads** (curved string) connecting related cards.

Constraints (deliberate):
- No accounts, no permissions. URL = identity. Anyone with the link can edit.
- No save button. State autosaves.
- No comments, notifications, calendar sync, recurring events, image cards, filtering, search, or card categories beyond color.
- Mobile-first is **not** in scope. Design for desktop browsers.

---

## 2. Aesthetic commitments

| | |
|---|---|
| Surface | Cork over a warm wood frame. Slight noise/dot texture on the cork. |
| Cards | ±2° random rotation per card (persistent). Two-layer drop shadow. A 5px pin-head dot on the left. |
| Threads | Curved SVG path with downward sag (8–22px). Faded reddish-brown stroke. Soft shadow. No arrowheads. |
| Typography | Handwritten on the board (Caveat / Permanent Marker). Neutral in the chrome (Manrope / JetBrains Mono). |
| Motion | Restrained. No bouncy springs. 120ms ease-out for snaps, 80ms hover lifts. |

The reference photo is the north star. When unsure, look more tactile, not slicker.

---

## 3. Design tokens

### 3.1 Color — card palette (fixed set of 8)

```ts
const CARD_COLORS = {
  peach:  { fill: '#F4B584', ink: '#5a3520' }, // default
  coral:  { fill: '#F26B86', ink: '#4a1a26' },
  orange: { fill: '#EE7A3E', ink: '#4a1f0a' },
  salmon: { fill: '#F5A088', ink: '#4a221a' },
  yellow: { fill: '#F5D257', ink: '#4a3c10' },
  mint:   { fill: '#9BD3B0', ink: '#1f3f2c' },
  sky:    { fill: '#6FA8D8', ink: '#102a44' },
  lilac:  { fill: '#B89DD0', ink: '#2c1f44' },
};
```

Color carries no built-in meaning — users assign it themselves. These eight are the **only** allowed card fills.

### 3.2 Color — pin heads

Random per card, persisted with the card. Purely cosmetic.

```ts
const PIN_COLORS = ['#d6463a', '#e9b834', '#3a7ed6', '#3aa15a', '#f5f1e6']; // red, yellow, blue, green, white
```

### 3.3 Color — surface &amp; ink

```ts
const SURFACE = {
  cork:    '#c9a978', // top
  corkDark:'#b89465', // bottom (linear gradient)
  corkEdge:'rgba(40,30,15,.28)', // 1px inset hairline on the cork
  paper:   '#f6f2ec', // off-board panels
  inkDark: '#2a1f15',
  inkMid:  '#6b5a48',
  inkOnCork: '#3a2410',
};
```

Cork background:
```css
background:
  radial-gradient(circle at 22% 18%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
  radial-gradient(circle at 71% 64%, rgba(0,0,0,.04) 0 1px, transparent 1.5px),
  radial-gradient(circle at 44% 88%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
  radial-gradient(circle at 88% 12%, rgba(255,255,255,.05) 0 1.2px, transparent 2px),
  linear-gradient(180deg, #c9a978 0%, #b89465 100%);
background-size: 13px 13px, 9px 9px, 17px 17px, 11px 11px, 100% 100%;
box-shadow: inset 0 0 24px rgba(60,30,10,.18), inset 0 0 0 1px rgba(0,0,0,.18);
```

### 3.4 Typography

Load from Google Fonts:
```
Caveat (400–700) · Permanent Marker · Manrope (400–700) · JetBrains Mono (400–500)
```

| Use | Stack | Size | Weight | Notes |
|---|---|---|---|---|
| Card text (default) | `'Caveat', cursive` | 16px / 1.05 | 600 | Letter-spacing 0.01em |
| Card text (shouty) | `'Permanent Marker', cursive` | 14px | 400 | Uppercase, letter-spacing 0.04em. Auto-applied when full text matches `/^[A-Z &+]{2,}$/`. |
| Day header | `'Caveat', cursive` | 18px | 700 | Rotated ±1.5°, on peach badge |
| Week rail number | `'Caveat', cursive` | 18px | 700 | |
| Week rail date | `'Caveat', cursive` | 12px | 400 | opacity 0.7 |
| Chrome body | `'Manrope', sans-serif` | 13–14px / 1.4 | 500–700 | |
| Mono / annotations | `'JetBrains Mono', monospace` | 10–11px | 400 | Letter-spacing 0.08em uppercase for labels |

### 3.5 Spacing &amp; radii

```ts
const SPACING = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 8: 16, 10: 20, 12: 24, 14: 28 };
const RADIUS  = { card: 1.5, cell: 2, panel: 6, popover: 10 };
```

### 3.6 Shadow tokens

```ts
const SHADOWS = {
  card:        '0 1.2px 2.5px rgba(0,0,0,.18), 0 4px 8px rgba(0,0,0,.10)',
  cardHover:   '0 4px 8px rgba(0,0,0,.22), 0 10px 18px rgba(0,0,0,.14)',
  cardDrag:    '0 8px 18px rgba(0,0,0,.30), 0 2px 4px rgba(0,0,0,.20)',
  popover:     '0 10px 28px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)',
  toolbar:     '0 1px 0 rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.05)',
  pin:         '0 0.6px 1.2px rgba(0,0,0,.4)',
};
```

---

## 4. Grid

| Spec | Value |
|---|---|
| Columns | Mon–Sun (7). Saturday and Sunday are visually muted (smaller header badge, lighter peach background) but otherwise behave identically to weekdays. |
| Rows | Weeks. Default 26. Range 4–52. User-settable. |
| Day cell | 56 × 38 px at base scale. Scales proportionally with viewport. |
| Header row | 32px tall. Day badge in peach. |
| Week rail | 64px wide. Format: `1` + `27 May`. |
| Grid lines | 0.5px, `rgba(40,20,5,0.22)`. |
| Frame | No frame. The cork board floats on the page background via a soft elevated drop shadow: `0 40px 80px -24px rgba(30,40,60,.28), 0 14px 32px -12px rgba(30,40,60,.18), 0 2px 6px rgba(30,40,60,.10)`. The cork has its own subtle radius (3px) and an inset hairline edge `inset 0 0 0 1px rgba(40,30,15,.28)` so the boundary reads cleanly on any background. |
| Page background | Soft cool off-white. Base `linear-gradient(180deg, #eef0f4 0%, #e1e4ec 100%)` with two soft highlights: `radial-gradient(ellipse 900px 700px at 12% -6%, rgba(180,200,230,0.35), transparent 60%)` and `radial-gradient(ellipse 1100px 800px at 105% 110%, rgba(200,210,225,0.30), transparent 65%)`. |

**Week 1 anchor.** The date of week 1 is set at board creation (e.g. Mon 27 May 2024). When the user changes the week count, week 1 stays fixed; weeks add/remove from the bottom only.

---

## 5. Card

### 5.1 Anatomy

A card has 4 visual parts:

1. **Pin head.** Absolute, left:3px, vertically centered. 5px diameter, radial-gradient highlight, pin shadow.
2. **Body.** `padding: 6px 8px 6px 12px`. Rounded 1.5px. One of the 8 fill colors.
3. **Rotation.** Random ±2° on create, persisted.
4. **Text.** Centered. `text-wrap: balance`. One short line; if longer than the cell width, wrap to 2 lines max (no card growth beyond that — truncate with ellipsis on a 3rd line).

Width at base scale: **78px**. Min height: **30px**. Cards scale together with the cell (`scale = min(cellW/56, cellH/38)`).

### 5.2 Data shape

```ts
type Card = {
  id: string;          // uuid
  week: number;        // 0-indexed
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Mon–Sun (5 = Sat, 6 = Sun)
  color: keyof typeof CARD_COLORS; // 8 options
  text: string;        // 1 line; users may type \n but rendering is one line + balance wrap
  rotation: number;    // -2..+2 degrees, set on create, persisted
  pin: keyof typeof PIN_COLORS_NAMED; // 'red'|'yellow'|'blue'|'green'|'white'
  z: number;           // for stacking within a cell; higher = on top
  offset?: { x: number; y: number }; // px, only set for stacked-cell visual offset
  createdAt: number;
  updatedAt: number;
};
```

### 5.3 States

| State | Visual |
|---|---|
| Idle | Token shadow `SHADOWS.card`. |
| Hover | Lift -2px translate, `SHADOWS.cardHover`, brightness +5%. |
| Selected | 2px outline `#2a6fdb` offset 2px. Edit popover docks below. |
| Editing | Same as selected; text becomes contenteditable / input. |
| Dragging | Scale 1.05, rotation reset to 0, `SHADOWS.cardDrag`. |
| Ghost (during drag) | Original card hidden; ghost shown at target cell at opacity 0.55. |

### 5.4 Stacking (multiple cards in one cell)

When N > 1 cards share a (week, day) cell:
- Cards offset by deterministic but varied amounts: `offset.x = (-1)^i * (4 + i*3)`, `offset.y = (-1)^i * (3 + i*2.5)` for i = 0..N-1.
- The grid never grows.
- Most-recently-edited card sits on top (highest `z`).
- Clicking through a stack: top card opens. Cmd/Ctrl-click cycles z-order.

---

## 6. Thread

A directed-but-unstyled connection between two cards.

### 6.1 Path

```
M x1,y1 Q (x1+x2)/2,(y1+y2)/2 + sag  x2,y2
```

`sag = clamp(distance * 0.06, 8, 22)` in px, always downward (positive y).

### 6.2 Stroke

```
stroke: #9c5a2e
stroke-width: 1.8
stroke-linecap: round
opacity: 0.92
```

Soft drop shadow via SVG filter:

```svg
<filter id="threadShadow" x="-10%" y="-10%" width="120%" height="120%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
  <feOffset dx="0" dy="1.5" />
  <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
  <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```

### 6.3 Data shape

```ts
type Thread = {
  id: string;
  from: string; // cardId
  to: string;   // cardId
  createdAt: number;
};
```

If either endpoint card is deleted, the thread is deleted with it.

### 6.4 Interaction

- Hover a card → a 10px draggable handle appears at top-right corner (red-brown disc, white ring, drop shadow).
- Press &amp; drag the handle → a dashed thread follows the cursor; hovered cards highlight.
- Release on another card → thread persists (dashed becomes solid).
- Release on empty space → no thread created.
- Press Esc during drag → cancel.
- Click an existing thread (6px hit area along path) → flash `#d6463a` for 100ms, then delete.

Threads have **no labels, no edit, no styling**. Click is delete; that is the only thread interaction besides creation.

---

## 7. Chrome (the only UI beyond the board)

### 7.1 Toolbar (fixed top-right)

Single pill:
```
[ Weeks 26 ] | [ ↶ Undo ] [ ↷ Redo ] | [ 🔗 Share ]
```

- Background `#fff`, radius 8, shadow `SHADOWS.toolbar`.
- Buttons: transparent fill on hover; Share button has filled dark variant (`#2a1f15` bg, `#f6f2ec` text).
- "Weeks 26" → click reveals an inline stepper (min 4, max 52).

### 7.2 Edit popover

Docks under a selected card.
```
┌───────────────────────────────┐
│  [ inline text input         ]│  ← card text, in Caveat
│                               │
│  ● ● ● ● ● ● ● ●              │  ← 8 swatches, current = ring outline
│                               │
│  ⏎ save · esc cancel  Delete  │
└───────────────────────────────┘
```
Width auto, min 240px. Shadow `SHADOWS.popover`. Radius 10.

### 7.3 Share dialog

Centered modal, 340px wide.
- Title: "Share this board"
- Subtitle: "Anyone with the link can view and edit. There are no roles or accounts."
- URL pill: `scheduleboard.app/b/<slug>` + Copy button.
- Footnote: `Last edited 2 minutes ago · N cards · M threads`

### 7.4 Empty-board hint

When the board has 0 cards, overlay (pointer-events: none) the centered text:
> click any cell to add a card
> *drag from one card to another to make a thread*

Hint disappears the moment the first card exists.

---

## 8. Interactions / Workflows

### 8.1 Add a card

1. Hover empty cell → cell tints `rgba(80,140,220,0.18)` with 1.5px hairline outline.
2. Click cell → peach card with caret appears immediately. Edit popover docks below.
3. Type → text renders live in Caveat (auto-switches to Permanent Marker if all-caps).
4. Enter or click outside → commits. Rotation and pin color are randomized once on create and persisted.

### 8.2 Move a card

1. Mouse-down on card → after 80ms hold, card lifts (`SHADOWS.cardDrag`, scale 1.05, rotation→0).
2. Drag → nearest cell highlights (same blue as 8.1). Connected threads update live.
3. Release → card snaps to cell center over 120ms `ease-out`. Pin and rotation preserved.

If released over a cell already containing cards, joins the stack at top z.

### 8.3 Draw a thread

See 6.4. Cancel with Esc.

### 8.4 Edit / recolor / delete

- Click card → selected; edit popover opens.
- Edit text in place. Enter / blur commits. Esc reverts.
- Click a swatch → recolor immediately. Popover stays open.
- Click Delete → card and any attached threads removed. Cmd/Ctrl-Z undoes.

### 8.5 Share / persist

- Every change debounces 250ms then writes to server.
- Concurrent edits merge **last-writer-wins per card and per thread** (no CRDT needed for v1).
- Share dialog just shows the URL + Copy. No invite flow.

### 8.6 Resize the board

- Click "Weeks N" in toolbar → inline stepper (4–52).
- Growing → empty weeks append below.
- Shrinking → if cards would be cut off, warn: "N cards would be cut off — continue?"
  - Confirmed: cards remain in the model but are off-board (restorable by growing again).
  - Not deleted.

---

## 9. Keyboard shortcuts

| Key | Action |
|---|---|
| Enter | Commit card text |
| Esc | Cancel edit / cancel thread drag / close popover |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Backspace (in selected, no edit) | Delete card |
| Arrow keys (with card selected) | Move card 1 cell |

---

## 10. Persistence &amp; URL

- `/` → home: redirects to a new random-slug board (e.g. `/b/oak-thread-942`).
- `/b/<slug>` → opens that board. If the slug doesn't exist, a new empty board is created at that slug. No login.
- Slugs are two random words + 3-digit suffix.
- Server stores `{ board: Board, cards: Card[], threads: Thread[] }` per slug. JSON is fine for v1.
- Writes: debounced 250ms. PATCH the changed entity (card or thread).
- No real-time sync required for v1 (the spec doesn't ask for it), but a 10s poll for remote changes is fine and cheap.

---

## 11. Out of scope (v1 — do not build)

- Accounts, login, permissions, roles
- Comments, notifications, mentions
- Calendar sync (Google/Outlook/iCal)
- Recurring events
- Image cards / pinned photos (deferred to v2)
- Mobile / touch-first layout
- Filtering, search, tags beyond color
- Multiple boards index page, board picker, etc.
- Card categories or types in the data model (color is the only categorization)

---

## 12. v2 (parking lot)

- Image cards (a defining feature of the original board — deferred only to keep v1 simple)
- Optional real-time presence cursors
- Export to PDF / print stylesheet

---

## 13. File / module layout (suggested)

```
src/
  tokens.ts         // exports from §3
  Board.tsx         // the grid component
  Card.tsx          // §5
  Thread.tsx        // §6
  Toolbar.tsx       // §7.1
  EditPopover.tsx   // §7.2
  ShareDialog.tsx   // §7.3
  hooks/
    useBoardState.ts  // load/save/debounced patch
    useDrag.ts        // card + thread drag
  pages/
    BoardPage.tsx     // /b/[slug]
  server/
    api.ts            // GET/PATCH board, card, thread
    store.ts          // JSON file or sqlite
```

The visual reference (`Schedule Board Spec — bundled.html`) is the source of truth for anything not pinned down in this file. When they conflict, **prefer the visual reference for look and the markdown for behavior**.
