// screens.jsx — Full screen mockups: hero board, empty board, editing, thread drawing, multi-card cell.

const sF_anno = "'JetBrains Mono', ui-monospace, monospace";
const sF_body = "'Manrope', -apple-system, system-ui, sans-serif";

// ---- Hero screen: full populated 26-week board with toolbar over-laid ----
function HeroBoardScreen() {
  return (
    <div style={{
      width:'100%', height:'100%', position:'relative', background:'#3a2410',
      padding:'24px 28px 28px',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontFamily:sF_body, fontSize:13, color:'#d8c8a8', fontWeight:500, letterSpacing:'0.01em' }}>
          <span style={{ opacity:.7 }}>scheduleboard.app / </span><span style={{ fontFamily:sF_anno }}>oak-thread-942</span>
        </div>
        <Toolbar weeks={26} />
      </div>
      <div style={{ display:'flex', justifyContent:'center' }}>
        <Board weeks={26} cellW={84} cellH={42} railW={80} headerH={36} />
      </div>
    </div>
  );
}

// ---- Empty board ----
function EmptyBoardScreen() {
  return (
    <div style={{
      width:'100%', height:'100%', position:'relative', background:'#3a2410',
      padding:'24px 28px 28px',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontFamily:sF_body, fontSize:13, color:'#d8c8a8', fontWeight:500 }}>
          <span style={{ opacity:.7 }}>scheduleboard.app / </span><span style={{ fontFamily:sF_anno }}>fresh-pine-118</span>
        </div>
        <Toolbar weeks={26} />
      </div>
      <div style={{ display:'flex', justifyContent:'center', position:'relative' }}>
        <Board weeks={26} cellW={84} cellH={42} railW={80} headerH={36} cards={[]} threads={[]} />
        {/* hint over the empty board */}
        <div style={{
          position:'absolute', left:'50%', top:'52%', transform:'translate(-50%, -50%)',
          textAlign:'center', pointerEvents:'none',
        }}>
          <div style={{ fontFamily:"'Caveat', cursive", fontSize:32, color:'#3a2410', opacity:.55 }}>
            click any cell to add a card
          </div>
          <div style={{ fontFamily:sF_anno, fontSize:10, color:'#3a2410', opacity:.45, marginTop:6, letterSpacing:'0.08em', textTransform:'uppercase' }}>
            drag from one card to another to make a thread
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Editing a card (popover open) ----
function EditingScreen() {
  return (
    <div style={{
      width:'100%', height:'100%', position:'relative', background:'#3a2410',
      padding:'24px 28px 28px',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontFamily:sF_body, fontSize:13, color:'#d8c8a8', fontWeight:500 }}>
          <span style={{ opacity:.7 }}>scheduleboard.app / </span><span style={{ fontFamily:sF_anno }}>oak-thread-942</span>
        </div>
        <Toolbar weeks={26} />
      </div>
      <div style={{ display:'flex', justifyContent:'center', position:'relative' }}>
        <Board weeks={14} cellW={84} cellH={48} railW={80} headerH={36}
          cards={DEMO_CARDS.filter(c => c.w < 14)} threads={[]} />
        {/* popover anchored near a card */}
        <div style={{ position:'absolute', left:'52%', top:'50%' }}>
          <div style={{ marginLeft:30 }}>
            <EditPopover />
          </div>
          {/* connector line */}
          <svg width="40" height="20" style={{ position:'absolute', left:-10, top:18, overflow:'visible' }}>
            <path d="M 0 10 L 30 10" stroke="#fff" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ---- Thread drawing in progress ----
function ThreadDrawScreen() {
  const cards = [
    { w:0, d:0, c:'coral', t:'RIG' },
    { w:0, d:1, c:'peach', t:'BLOCK' },
    { w:0, d:2, c:'peach', t:'BLOCK' },
    { w:1, d:0, c:'sky', t:'BUILD' },
    { w:1, d:1, c:'peach', t:'Dress + light' },
    { w:1, d:3, c:'lilac', t:'LIGHT' },
    { w:2, d:0, c:'orange', t:'PROG MOCO' },
    { w:2, d:2, c:'peach', t:'BLOCK' },
    { w:3, d:1, c:'coral', t:'STRIKE' },
    { w:3, d:3, c:'mint', t:'Holiday' },
    { w:4, d:0, c:'peach', t:'BLOCK' },
  ];
  // simulate drag from card 0 (RIG) toward a target near card 5 (LIGHT)
  const cellW = 110, cellH = 60, railW = 80, headerH = 36;
  const fromX = railW + 0*cellW + cellW/2;
  const fromY = headerH + 0*cellH + cellH/2;
  const cursorX = railW + 3*cellW + cellW/2 + 6;
  const cursorY = headerH + 1*cellH + cellH/2 - 4;
  return (
    <div style={{
      width:'100%', height:'100%', position:'relative', background:'#3a2410',
      padding:'24px 28px 28px',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontFamily:sF_body, fontSize:13, color:'#d8c8a8', fontWeight:500 }}>
          <span style={{ opacity:.7 }}>scheduleboard.app / </span><span style={{ fontFamily:sF_anno }}>oak-thread-942</span>
        </div>
        <Toolbar weeks={26} />
      </div>
      <div style={{ display:'flex', justifyContent:'center', position:'relative' }}>
        <Board weeks={5} cellW={cellW} cellH={cellH} railW={railW} headerH={headerH}
          cards={cards} threads={[]}
          threadDrag={{ fromIdx:0, x: cursorX, y: cursorY }} />
        {/* helper hint */}
        <div style={{
          position:'absolute', left: cursorX + 24, top: cursorY + 90, pointerEvents:'none',
          fontFamily:sF_anno, fontSize:10, color:'#fff', opacity:.85, letterSpacing:'0.08em', textTransform:'uppercase',
          background:'rgba(0,0,0,.45)', padding:'4px 8px', borderRadius:3,
        }}>
          drop on a card to connect · esc to cancel
        </div>
        {/* fake cursor */}
        <div style={{
          position:'absolute',
          left: 28 + cursorX + 192,
          top: 14 + cursorY + 90,
          pointerEvents:'none',
        }}>
          <svg width="20" height="22" style={{ filter:'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }}>
            <path d="M 1 1 L 1 17 L 6 13 L 9 19 L 12 18 L 9 12 L 16 12 Z" fill="#fff" stroke="#000" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ---- Multi-card cell (stacking) ----
function MultiCardCellScreen() {
  // Use small Board, with two cards in the same cell offset
  const cards = [
    { w:0, d:1, c:'peach', t:'BLOCK', ox:-6, oy:-4 },
    { w:0, d:1, c:'coral', t:'Re-shoot', ox:8, oy:6 },
    { w:1, d:0, c:'sky', t:'BUILD' },
    { w:1, d:1, c:'peach', t:'BLOCK', ox:-4, oy:-3 },
    { w:1, d:1, c:'orange', t:'PROG MOCO', ox:6, oy:5 },
    { w:1, d:1, c:'yellow', t:'Still', ox:14, oy:12 },
    { w:2, d:2, c:'mint', t:'Holiday' },
    { w:2, d:3, c:'peach', t:'Dress + light' },
    { w:3, d:0, c:'lilac', t:'LIGHT' },
    { w:3, d:1, c:'peach', t:'BLOCK' },
  ];
  return (
    <div style={{ padding:28, background:'#f6f2ec', height:'100%' }}>
      <Anno>Screen / States · Multiple cards in one cell</Anno>
      <div style={{ fontFamily:sF_body, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
        Stacking, not resizing
      </div>
      <Hint style={{ maxWidth:520, marginTop:4 }}>
        When a cell holds more than one card, they offset by ±4–14px and overlap. The grid never
        grows. Top-most card is the most recently moved/edited.
      </Hint>
      <div style={{ marginTop:18, display:'flex', justifyContent:'center' }}>
        <Board weeks={4} cellW={130} cellH={86} railW={80} headerH={36}
          cards={cards} threads={[]} />
      </div>
    </div>
  );
}

Object.assign(window, {
  HeroBoardScreen, EmptyBoardScreen, EditingScreen, ThreadDrawScreen, MultiCardCellScreen,
});
