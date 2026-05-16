// workflows.jsx — Storyboard panels (numbered steps) for each interaction flow.

const wF_anno = "'JetBrains Mono', ui-monospace, monospace";
const wF_body = "'Manrope', -apple-system, system-ui, sans-serif";

function Panel({ n, title, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, padding:12, boxShadow:'0 1px 0 rgba(0,0,0,.04), 0 1px 6px rgba(0,0,0,.04)' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10 }}>
        <span style={{
          fontFamily:wF_anno, fontSize:10, color:'#fff', background:'#2a1f15',
          padding:'2px 6px', borderRadius:3, letterSpacing:'0.04em',
        }}>{String(n).padStart(2,'0')}</span>
        <span style={{ fontFamily:wF_body, fontSize:13, fontWeight:600, color:'#2a1f15' }}>{title}</span>
      </div>
      <div style={{ position:'relative', borderRadius:4, overflow:'hidden', background:'#c9a978' }}>
        {children}
      </div>
    </div>
  );
}

function StoryboardCard({ children, narration }) {
  return (
    <div>
      {children}
      {narration && (
        <div style={{ fontFamily:wF_body, fontSize:11, color:'#6b5a48', marginTop:8, lineHeight:1.4 }}>
          {narration}
        </div>
      )}
    </div>
  );
}

// Helper: small board for storyboards (5 weeks, narrow)
function MiniBoard({ cards = [], threads = [], threadDrag = null, highlightCell = null, ghostCard = null }) {
  return (
    <Board
      weeks={4} cellW={68} cellH={36} railW={56} headerH={28}
      cards={cards} threads={threads}
      threadDrag={threadDrag} highlightCell={highlightCell} ghostCard={ghostCard}
      showHoles={false}
      frame={false}
      style={{ width:'100%', boxShadow:'none' }}
    />
  );
}

// ---- Workflow 1: Add a card ----
function FlowAddCard() {
  return (
    <div style={{ padding:28, background:'#f6f2ec' }}>
      <Anno>Workflow 01 · Add a card</Anno>
      <div style={{ fontFamily:wF_body, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
        Click cell → type → done
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginTop:18 }}>
        <Panel n={1} title="Hover empty cell">
          <StoryboardCard narration="Cursor on an empty cell. The cell tints blue and gets a hairline outline. No tooltip.">
            <MiniBoard
              cards={[{ w:0, d:1, c:'peach', t:'BLOCK' }, { w:1, d:3, c:'coral', t:'RIG' }]}
              highlightCell={{ w:2, d:2 }} threads={[]} />
          </StoryboardCard>
        </Panel>

        <Panel n={2} title="Click → blank card + caret">
          <StoryboardCard narration="A peach card (default color) appears in the cell with a blinking caret. Focus is in the inline text input. The popover docks underneath.">
            <div style={{ position:'relative' }}>
              <MiniBoard
                cards={[
                  { w:0, d:1, c:'peach', t:'BLOCK' },
                  { w:1, d:3, c:'coral', t:'RIG' },
                  { w:2, d:2, c:'peach', t:'|' },
                ]}
                threads={[]} />
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={3} title="Type text">
          <StoryboardCard narration="Text shows live in Caveat. If user types all-caps it switches to Permanent Marker automatically.">
            <MiniBoard
              cards={[
                { w:0, d:1, c:'peach', t:'BLOCK' },
                { w:1, d:3, c:'coral', t:'RIG' },
                { w:2, d:2, c:'peach', t:'Dress|' },
              ]}
              threads={[]} />
          </StoryboardCard>
        </Panel>

        <Panel n={4} title="Enter or click away → saved">
          <StoryboardCard narration="Enter or blur commits. The card settles with a tiny rotation and a randomized pin color. State persists immediately.">
            <MiniBoard
              cards={[
                { w:0, d:1, c:'peach', t:'BLOCK' },
                { w:1, d:3, c:'coral', t:'RIG' },
                { w:2, d:2, c:'peach', t:'Dress + light', rot:-1.5 },
              ]}
              threads={[]} />
          </StoryboardCard>
        </Panel>
      </div>
    </div>
  );
}

// ---- Workflow 2: Move a card ----
function FlowMoveCard() {
  return (
    <div style={{ padding:28, background:'#f6f2ec' }}>
      <Anno>Workflow 02 · Move a card</Anno>
      <div style={{ fontFamily:wF_body, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
        Drag-drop between cells
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginTop:18 }}>
        <Panel n={1} title="Press &amp; hold a card">
          <StoryboardCard narration="Mouse down on a card. After 80ms it lifts: scale 1.05, larger soft shadow, slight rotation reset.">
            <MiniBoard
              cards={[
                { w:0, d:1, c:'peach', t:'BLOCK', rot:0 },
                { w:1, d:3, c:'coral', t:'RIG' },
                { w:2, d:0, c:'sky', t:'BUILD' },
              ]}
              threads={[]} />
            <div style={{ position:'absolute', left:130, top:48, pointerEvents:'none' }}>
              <div style={{ transform:'scale(1.08)' }}>
                <Card color="peach" text="BLOCK" rot={0} style={{ boxShadow:'0 8px 18px rgba(0,0,0,.3), 0 2px 4px rgba(0,0,0,.2)' }} />
              </div>
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={2} title="Drag → target cell highlights">
          <StoryboardCard narration="As the card crosses cells, the nearest cell gets the same blue highlight as in 01-step-1. Connected threads follow live.">
            <MiniBoard
              cards={[
                { w:1, d:3, c:'coral', t:'RIG' },
                { w:2, d:0, c:'sky', t:'BUILD' },
              ]}
              highlightCell={{ w:1, d:1 }}
              ghostCard={{ w:1, d:1, color:'peach', text:'BLOCK' }}
              threads={[]} />
          </StoryboardCard>
        </Panel>

        <Panel n={3} title="Release → snap to cell">
          <StoryboardCard narration="Card snaps to the new cell center over 120ms ease-out. Pin color and rotation are preserved.">
            <MiniBoard
              cards={[
                { w:1, d:1, c:'peach', t:'BLOCK', rot:-1 },
                { w:1, d:3, c:'coral', t:'RIG' },
                { w:2, d:0, c:'sky', t:'BUILD' },
              ]}
              threads={[]} />
          </StoryboardCard>
        </Panel>
      </div>
    </div>
  );
}

// ---- Workflow 3: Draw a thread ----
function FlowDrawThread() {
  return (
    <div style={{ padding:28, background:'#f6f2ec' }}>
      <Anno>Workflow 03 · Draw a thread</Anno>
      <div style={{ fontFamily:wF_body, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
        Drag from card → onto another card
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginTop:18 }}>
        <Panel n={1} title="Hover a card → handle">
          <StoryboardCard narration="A small thread handle (red string circle) appears at the top-right corner of the hovered card. Grab it to start a thread.">
            <div style={{ position:'relative' }}>
              <MiniBoard
                cards={[
                  { w:0, d:0, c:'coral', t:'RIG' },
                  { w:1, d:2, c:'sky', t:'BUILD' },
                  { w:2, d:1, c:'orange', t:'PROG MOCO' },
                ]}
                threads={[]} />
              {/* handle dot at card 0 position */}
              <div style={{
                position:'absolute', left:56 + 0*68 + 68/2 + 24, top:28 + 0*36 + 36/2 - 14,
                width:10, height:10, borderRadius:'50%', background:'#9c5a2e',
                boxShadow:'0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,.3)', pointerEvents:'none',
              }}></div>
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={2} title="Drag → dashed string follows cursor">
          <StoryboardCard narration="Dashed reddish-brown line follows. Other cards highlight on hover to indicate snap target.">
            <MiniBoard
              cards={[
                { w:0, d:0, c:'coral', t:'RIG' },
                { w:1, d:2, c:'sky', t:'BUILD' },
                { w:2, d:1, c:'orange', t:'PROG MOCO' },
              ]}
              threadDrag={{ fromIdx:0, x: 56 + 2*68 + 68/2, y: 28 + 1*36 + 36/2 - 4 }}
              threads={[]} />
          </StoryboardCard>
        </Panel>

        <Panel n={3} title="Drop on target → solid string">
          <StoryboardCard narration="Released over a card: dashed line becomes a solid sagged thread. Drop on empty space: nothing happens (no orphan threads).">
            <MiniBoard
              cards={[
                { w:0, d:0, c:'coral', t:'RIG' },
                { w:1, d:2, c:'sky', t:'BUILD' },
                { w:2, d:1, c:'orange', t:'PROG MOCO' },
              ]}
              threads={[{ from:0, to:1 }]} />
          </StoryboardCard>
        </Panel>

        <Panel n={4} title="Click a thread → delete">
          <StoryboardCard narration="Threads have a 6px hit area. Click flashes the line red for 100ms, then removes. There is no edit, label, or styling.">
            <div style={{ position:'relative' }}>
              <MiniBoard
                cards={[
                  { w:0, d:0, c:'coral', t:'RIG' },
                  { w:1, d:2, c:'sky', t:'BUILD' },
                  { w:2, d:1, c:'orange', t:'PROG MOCO' },
                ]}
                threads={[{ from:0, to:1 }, { from:1, to:2 }]} />
              {/* red flash indicator */}
              <svg style={{ position:'absolute', inset:0, pointerEvents:'none' }} width="100%" height="100%">
                <path d="M 130 50 Q 200 100 240 110" stroke="#d6463a" strokeWidth="3" fill="none" opacity="0.6" />
              </svg>
            </div>
          </StoryboardCard>
        </Panel>
      </div>
    </div>
  );
}

// ---- Workflow 4: Edit / recolor / delete a card ----
function FlowEditCard() {
  return (
    <div style={{ padding:28, background:'#f6f2ec' }}>
      <Anno>Workflow 04 · Edit, recolor, delete</Anno>
      <div style={{ fontFamily:wF_body, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
        Click a card → popover with text + swatches + delete
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginTop:18 }}>
        <Panel n={1} title="Click card → popover docks below">
          <StoryboardCard narration="Card gets a blue selected outline. Text becomes an input. Eight swatches appear underneath. Delete is bottom-right.">
            <div style={{ padding:24, position:'relative' }}>
              <div style={{ display:'flex', justifyContent:'center' }}>
                <Card color="peach" text="Dress + light|" rot={0} style={{ outline:'2px solid #2a6fdb', outlineOffset:2 }} />
              </div>
              <div style={{ marginTop:14, display:'flex', justifyContent:'center' }}>
                <EditPopover />
              </div>
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={2} title="Pick a swatch → recolor live">
          <StoryboardCard narration="Click a new swatch and the card recolors immediately. No confirmation. Pop-over stays open.">
            <div style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'center' }}>
                <Card color="coral" text="Dress + light|" rot={0} style={{ outline:'2px solid #2a6fdb', outlineOffset:2 }} />
              </div>
              <div style={{ marginTop:14, display:'flex', justifyContent:'center' }}>
                <div style={{ display:'inline-block', padding:10, background:'#fff', borderRadius:10, minWidth:240, boxShadow:'0 10px 28px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(8, 18px)', gap:5 }}>
                    {COLOR_KEYS.map((k, i) => (
                      <button key={k} style={{
                        width:18, height:18, borderRadius:3, border:0, padding:0,
                        background: COLORS[k].fill,
                        boxShadow: k === 'coral' ? '0 0 0 2px #2a1f15, 0 0 0 3px #fff' : 'inset 0 0 0 1px rgba(0,0,0,.06)',
                      }}></button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={3} title="Delete or Esc">
          <StoryboardCard narration="Delete removes the card and any threads attached to it. Esc closes without changes. Cmd/Ctrl-Z undoes everything.">
            <div style={{ padding:36, display:'flex', justifyContent:'center', alignItems:'center', gap:18 }}>
              <div style={{ opacity:.3 }}>
                <Card color="peach" text="Dress + light" rot={0} />
              </div>
              <div style={{ fontFamily:wF_anno, fontSize:14, color:'#2a1f15' }}>→</div>
              <div style={{ fontFamily:wF_anno, fontSize:11, color:'#6b5a48', letterSpacing:'0.08em' }}>
                gone
              </div>
            </div>
          </StoryboardCard>
        </Panel>
      </div>
    </div>
  );
}

// ---- Workflow 5: Open & share ----
function FlowShare() {
  return (
    <div style={{ padding:28, background:'#f6f2ec' }}>
      <Anno>Workflow 05 · Open, share, persist</Anno>
      <div style={{ fontFamily:wF_body, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
        URL is the identity
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginTop:18 }}>
        <Panel n={1} title="Open a board URL">
          <StoryboardCard narration="Any URL like /b/<slug> opens that board. If the slug is unknown, a new empty board is created at that slug. No login.">
            <div style={{ padding:'40px 24px', background:'#3a2410', display:'flex', justifyContent:'center', alignItems:'center', gap:8 }}>
              <div style={{ fontFamily:wF_anno, fontSize:11, color:'#d8c8a8', opacity:.7 }}>scheduleboard.app /</div>
              <div style={{ fontFamily:wF_anno, fontSize:11, color:'#f5d257', background:'rgba(255,255,255,.08)', padding:'4px 8px', borderRadius:3 }}>oak-thread-942</div>
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={2} title="Click Share → dialog">
          <StoryboardCard narration="Single Share button in toolbar opens a dialog showing the URL, a Copy button, and a one-line summary. No roles, no permissions.">
            <div style={{ padding:28, display:'flex', justifyContent:'center' }}>
              <ShareDialog />
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={3} title="Edits persist instantly">
          <StoryboardCard narration="No save button. Every change debounces 250ms then writes to the server. Concurrent edits merge by last-writer-wins per card / per thread.">
            <div style={{ padding:'36px 16px', display:'flex', justifyContent:'space-around', alignItems:'center' }}>
              <div style={{ textAlign:'center' }}>
                <Card color="peach" text="BLOCK" rot={-1} />
                <div style={{ fontFamily:wF_anno, fontSize:9, color:'#fff', marginTop:8, opacity:.85 }}>YOU</div>
              </div>
              <div style={{ fontFamily:wF_anno, fontSize:18, color:'#fff', opacity:.6 }}>⇄</div>
              <div style={{ textAlign:'center' }}>
                <Card color="peach" text="BLOCK" rot={-1} />
                <div style={{ fontFamily:wF_anno, fontSize:9, color:'#fff', marginTop:8, opacity:.85 }}>ANYONE ELSE</div>
              </div>
            </div>
          </StoryboardCard>
        </Panel>
      </div>
    </div>
  );
}

// ---- Workflow 6: Adjust week range ----
function FlowWeekRange() {
  return (
    <div style={{ padding:28, background:'#f6f2ec' }}>
      <Anno>Workflow 06 · Resize the board</Anno>
      <div style={{ fontFamily:wF_body, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
        Set anywhere from 4 to 52 weeks
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginTop:18 }}>
        <Panel n={1} title="Click 'Weeks 26' in toolbar">
          <StoryboardCard narration="Toolbar reveals an inline number stepper. Range is 4–52. Mon date of week 1 stays fixed; weeks are added/removed from the bottom.">
            <div style={{ padding:40, display:'flex', justifyContent:'center', background:'#3a2410' }}>
              <Toolbar weeks={26} />
            </div>
          </StoryboardCard>
        </Panel>

        <Panel n={2} title="Shrink → cards stay where they are">
          <StoryboardCard narration="If shrinking would hide cards, a warning appears with a count: '4 cards would be cut off — continue?'. Confirmed cards are not deleted, just off-board (restorable by growing again).">
            <MiniBoard
              cards={DEMO_CARDS.filter(c => c.w < 4)}
              threads={[]} />
          </StoryboardCard>
        </Panel>

        <Panel n={3} title="Grow → empty weeks append">
          <StoryboardCard narration="Growing simply adds rows below. Week-1 date is unchanged; new weeks are calculated forward from it.">
            <Board weeks={6} cellW={58} cellH={30} railW={52} headerH={26}
              cards={DEMO_CARDS.filter(c => c.w < 4)}
              threads={[]}
              showHoles={false}
              frame={false} />
          </StoryboardCard>
        </Panel>
      </div>
    </div>
  );
}

Object.assign(window, {
  FlowAddCard, FlowMoveCard, FlowDrawThread, FlowEditCard, FlowShare, FlowWeekRange,
});
