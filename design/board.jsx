// Board.jsx — the reusable Schedule Board renderer used in screens and storyboards.
// Exposes window.Board ({ data, width, height, showThreads, scale, ... }) and helpers.

const COLORS = {
  peach:  { fill: '#F4B584', ink: '#5a3520' },
  coral:  { fill: '#F26B86', ink: '#4a1a26' },
  orange: { fill: '#EE7A3E', ink: '#4a1f0a' },
  salmon: { fill: '#F5A088', ink: '#4a221a' },
  yellow: { fill: '#F5D257', ink: '#4a3c10' },
  mint:   { fill: '#9BD3B0', ink: '#1f3f2c' },
  sky:    { fill: '#6FA8D8', ink: '#102a44' },
  lilac:  { fill: '#B89DD0', ink: '#2c1f44' },
};
const COLOR_KEYS = Object.keys(COLORS);

const PIN_COLORS = ['#d6463a', '#e9b834', '#3a7ed6', '#3aa15a', '#f5f1e6'];

// Deterministic small "random" so cards don't shimmer between renders.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// One reusable demo dataset, scaled across 26 weeks. Each card is
// { week (0-indexed), day (0-4 Mon-Fri), color, text, pin?, rot? }.
// Threads are { from: cardIndex, to: cardIndex }.
const DEMO_CARDS = [
  // Block 1
  { w: 0, d: 1, c: 'coral',  t: 'BLOCK' },
  { w: 1, d: 0, c: 'sky',    t: 'DRESS' },
  { w: 1, d: 1, c: 'coral',  t: 'RIG' },
  { w: 1, d: 2, c: 'coral',  t: 'BLOCK' },
  { w: 1, d: 3, c: 'peach',  t: 'BLOCK' },
  { w: 2, d: 2, c: 'peach',  t: 'Dress + light' },
  { w: 3, d: 0, c: 'coral',  t: 'RIG' },
  { w: 3, d: 1, c: 'orange', t: 'BLOCK' },
  { w: 4, d: 0, c: 'peach',  t: 'Ian recs' },
  { w: 4, d: 4, c: 'coral',  t: 'BLOCK' },
  { w: 5, d: 2, c: 'peach',  t: 'Dress + light' },
  { w: 6, d: 0, c: 'sky',    t: 'DRESS' },
  { w: 6, d: 2, c: 'lilac',  t: 'LIGHT' },
  { w: 7, d: 0, c: 'orange', t: 'BLOCK' },
  { w: 7, d: 1, c: 'orange', t: 'BLOCK' },
  // Block 2
  { w: 8, d: 2, c: 'peach',  t: 'BLOCK' },
  { w: 9, d: 3, c: 'coral',  t: 'Claire McCarty' },
  { w: 10, d: 0, c: 'mint',  t: 'Claire McCarty' },
  { w: 10, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 11, d: 2, c: 'peach', t: 'BLOCK' },
  { w: 11, d: 3, c: 'peach', t: 'BLOCK' },
  { w: 12, d: 0, c: 'sky',   t: 'BUILD' },
  { w: 12, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 12, d: 2, c: 'peach', t: 'Episode 1 Q 1350' },
  { w: 13, d: 1, c: 'peach', t: 'Dress + light' },
  { w: 14, d: 1, c: 'peach', t: '120-0250' },
  { w: 15, d: 1, c: 'peach', t: 'Symphony Holiday' },
  { w: 15, d: 2, c: 'peach', t: 'BLOCK' },
  { w: 16, d: 0, c: 'peach', t: 'Dress + light' },
  { w: 16, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 16, d: 2, c: 'peach', t: '12-0050 Trolley AP' },
  { w: 18, d: 0, c: 'peach', t: 'Dress + light' },
  { w: 18, d: 1, c: 'peach', t: 'Block' },
  { w: 19, d: 0, c: 'coral', t: 'RIG' },
  { w: 19, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 19, d: 2, c: 'peach', t: 'BLOCK' },
  { w: 19, d: 3, c: 'peach', t: 'Dress + light' },
  { w: 20, d: 0, c: 'orange', t: 'PROG MOCO' },
  { w: 20, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 21, d: 0, c: 'orange', t: 'PROG MOCO' },
  { w: 21, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 22, d: 2, c: 'orange', t: 'PROG MOCO' },
  { w: 22, d: 3, c: 'peach',  t: 'BLOCK' },
  { w: 23, d: 0, c: 'peach',  t: 'BLOCK' },
  { w: 24, d: 1, c: 'peach',  t: 'BLOCK' },
  { w: 25, d: 1, c: 'coral',  t: 'BLOCK' },
  { w: 25, d: 2, c: 'peach',  t: 'Dress + light' },
];

// A few demo threads (indices into DEMO_CARDS above).
const DEMO_THREADS = [
  { from: 6, to: 11 },   // RIG -> DRESS later
  { from: 12, to: 17 },  // LIGHT -> Claire McCarty
  { from: 21, to: 28 },  // BUILD -> Dress+light
  { from: 38, to: 41 },  // PROG MOCO chain
];

const WEEK_LABELS = (() => {
  // 26 Mondays starting Mon 27 May 2024 (matches photo)
  const start = new Date(Date.UTC(2024, 4, 27));
  const out = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 7 * 86400000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    out.push(`${dd} ${mm}`);
  }
  return out;
})();

const DAYS = ['MON', 'TUES', 'WED', 'THURS', 'FRI'];

// ---- Card primitive ----
function Card({ color = 'peach', text = 'BLOCK', rot = 0, pin = 'red', size = 1, marker = false, style }) {
  const pal = COLORS[color] || COLORS.peach;
  const pinColor = { red:'#d6463a', yellow:'#e9b834', blue:'#3a7ed6', green:'#3aa15a', white:'#f5f1e6' }[pin] || pin;
  const isShouty = marker || /^[A-Z &+]{2,}$/.test(text);
  return (
    <div style={{
      position: 'relative',
      width: 78 * size, minHeight: 30 * size,
      padding: `${6*size}px ${8*size}px ${6*size}px ${12*size}px`,
      background: pal.fill,
      color: pal.ink,
      borderRadius: 1.5,
      transform: `rotate(${rot}deg)`,
      boxShadow: `0 ${1.2*size}px ${2.5*size}px rgba(0,0,0,.18), 0 ${4*size}px ${8*size}px rgba(0,0,0,.10)`,
      fontFamily: isShouty ? "'Permanent Marker', 'Caveat', cursive" : "'Caveat', cursive",
      fontWeight: isShouty ? 400 : 600,
      fontSize: isShouty ? 14*size : 16*size,
      lineHeight: 1.05,
      letterSpacing: isShouty ? '0.04em' : '0.01em',
      textTransform: isShouty ? 'uppercase' : 'none',
      ...style,
    }}>
      {/* pin head */}
      <span style={{
        position: 'absolute', left: 3*size, top: '50%', transform: 'translateY(-50%)',
        width: 5*size, height: 5*size, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, #fff8 0 18%, ${pinColor} 20% 100%)`,
        boxShadow: `0 ${0.6*size}px ${1.2*size}px rgba(0,0,0,.4)`,
      }}></span>
      <span style={{ display: 'block', textAlign: 'center', textWrap: 'balance' }}>{text}</span>
    </div>
  );
}

// ---- Thread (curved string) ----
// Renders an SVG path from (x1,y1) to (x2,y2) with a slack/sag downwards.
function threadPath(x1, y1, x2, y2, sag = 14) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

// ---- Board ----
function Board({
  weeks = 26,
  cellW = 56,
  cellH = 38,
  railW = 64,
  headerH = 32,
  cards = DEMO_CARDS,
  threads = DEMO_THREADS,
  showThreads = true,
  showHoles = true,
  weekStart = 0,
  frame = true,
  highlightCell = null,   // { w, d } -> shows blue-tinted hover state
  ghostCard = null,       // { w, d, color, text } -> shows ghost while dragging
  threadDrag = null,      // { fromIdx, x, y } in board-local px
  style,
}) {
  const W = railW + 5 * cellW;
  const H = headerH + weeks * cellH;
  const rand = seeded(1234);

  return (
    <div style={{
      position: 'relative',
      width: W + (frame ? 26 : 0),
      height: H + (frame ? 32 : 0),
      padding: frame ? '8px 14px 24px 12px' : 0,
      background: frame
        ? 'linear-gradient(180deg, #b8845a 0%, #a06c3e 40%, #8a5530 100%)'
        : 'transparent',
      borderRadius: frame ? 6 : 0,
      boxShadow: frame ? '0 4px 14px rgba(0,0,0,.18), inset 0 0 0 1px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.18)' : 'none',
      ...style,
    }}>
      {/* inner board surface (cork) */}
      <div style={{
        position: 'relative', width: W, height: H,
        background: `
          radial-gradient(circle at 22% 18%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
          radial-gradient(circle at 71% 64%, rgba(0,0,0,.04) 0 1px, transparent 1.5px),
          radial-gradient(circle at 44% 88%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
          radial-gradient(circle at 88% 12%, rgba(255,255,255,.05) 0 1.2px, transparent 2px),
          linear-gradient(180deg, #c9a978 0%, #b89465 100%)`,
        backgroundSize: '13px 13px, 9px 9px, 17px 17px, 11px 11px, 100% 100%',
        boxShadow: 'inset 0 0 24px rgba(60,30,10,.18), inset 0 0 0 1px rgba(0,0,0,.18)',
        overflow: 'hidden',
      }}>
        {/* grid lines */}
        <svg width={W} height={H} style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          {/* horizontal */}
          {Array.from({ length: weeks + 1 }).map((_, i) => (
            <line key={'h'+i} x1={0} y1={headerH + i*cellH} x2={W} y2={headerH + i*cellH}
              stroke="rgba(40,20,5,.22)" strokeWidth="0.5" />
          ))}
          {/* vertical */}
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={'v'+i} x1={railW + i*cellW} y1={0} x2={railW + i*cellW} y2={H}
              stroke="rgba(40,20,5,.22)" strokeWidth="0.5" />
          ))}
          {/* outer */}
          <rect x="0.5" y="0.5" width={W-1} height={H-1} fill="none" stroke="rgba(0,0,0,.3)" strokeWidth="1" />
          {/* header underline */}
          <line x1={0} y1={headerH} x2={W} y2={headerH} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
          <line x1={railW} y1={0} x2={railW} y2={H} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
        </svg>

        {/* day headers */}
        {DAYS.map((d, i) => (
          <div key={d} style={{
            position:'absolute', top: 6, left: railW + i*cellW, width: cellW, height: headerH-6,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily: "'Caveat', cursive", fontWeight:700, fontSize: 18, color:'#3a2410',
            transform: `rotate(${(rand()-.5)*1.5}deg)`,
          }}>
            <span style={{
              background:'#F4B584', padding:'2px 8px', borderRadius:1.5,
              boxShadow:'0 1px 2px rgba(0,0,0,.18)',
            }}>{d}</span>
          </div>
        ))}

        {/* week rail (numbers + dates) */}
        {Array.from({ length: weeks }).map((_, i) => {
          const wn = i + 1 + weekStart;
          return (
            <div key={'rail'+i} style={{
              position:'absolute', left: 0, top: headerH + i*cellH, width: railW, height: cellH,
              display:'flex', alignItems:'center', gap: 6, paddingLeft: 6,
              color:'#3a2410',
            }}>
              <span style={{
                fontFamily:"'Caveat', cursive", fontSize: 18, fontWeight:700,
                minWidth: 18, textAlign:'right',
              }}>{wn}</span>
              <span style={{
                fontFamily:"'Caveat', cursive", fontSize: 12, opacity:.7, lineHeight:1,
              }}>{WEEK_LABELS[i + weekStart]}</span>
            </div>
          );
        })}

        {/* pin holes scattered around edges (decorative) */}
        {showHoles && Array.from({ length: 18 }).map((_, i) => {
          const onLeft = i % 2 === 0;
          const x = onLeft ? 3 + rand()*3 : W - 6 - rand()*3;
          const y = headerH + rand() * (H - headerH - 6);
          const c = PIN_COLORS[Math.floor(rand()*PIN_COLORS.length)];
          return <span key={'p'+i} style={{
            position:'absolute', left:x, top:y, width:5, height:5, borderRadius:'50%',
            background:`radial-gradient(circle at 30% 30%, #fff8 0 18%, ${c} 20% 100%)`,
            boxShadow:'0 0.6px 1.2px rgba(0,0,0,.4)',
          }}></span>;
        })}

        {/* highlight cell */}
        {highlightCell && (
          <div style={{
            position:'absolute',
            left: railW + highlightCell.d*cellW + 1,
            top: headerH + highlightCell.w*cellH + 1,
            width: cellW - 2, height: cellH - 2,
            background:'rgba(80,140,220,.18)',
            boxShadow:'inset 0 0 0 1.5px rgba(80,140,220,.7)',
            borderRadius: 2,
          }}></div>
        )}

        {/* cards */}
        {cards.map((card, idx) => {
          const r = card.rot != null ? card.rot : (rand()-.5)*4;
          const cx = railW + card.d*cellW + cellW/2;
          const cy = headerH + card.w*cellH + cellH/2;
          const ox = card.ox || 0, oy = card.oy || 0;
          return (
            <div key={idx} data-card-idx={idx} style={{
              position:'absolute', left: cx + ox, top: cy + oy, transform: 'translate(-50%, -50%)',
            }}>
              <Card color={card.c} text={card.t} rot={r} pin={card.pin || PIN_COLORS[idx % PIN_COLORS.length]}
                size={Math.min(cellW/56, cellH/38)} />
            </div>
          );
        })}

        {/* ghost card (drag preview) */}
        {ghostCard && (
          <div style={{
            position:'absolute',
            left: railW + ghostCard.d*cellW + cellW/2,
            top: headerH + ghostCard.w*cellH + cellH/2,
            transform:'translate(-50%, -50%)',
            opacity: .55, pointerEvents:'none',
          }}>
            <Card color={ghostCard.color} text={ghostCard.text} rot={0}
              size={Math.min(cellW/56, cellH/38)} />
          </div>
        )}

        {/* threads overlay */}
        {showThreads && (
          <svg width={W} height={H} style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            <defs>
              <filter id="threadShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
                <feOffset dx="0" dy="1.5" />
                <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {threads.map((t, i) => {
              const a = cards[t.from], b = cards[t.to];
              if (!a || !b) return null;
              const x1 = railW + a.d*cellW + cellW/2 + (a.ox||0);
              const y1 = headerH + a.w*cellH + cellH/2 + (a.oy||0);
              const x2 = railW + b.d*cellW + cellW/2 + (b.ox||0);
              const y2 = headerH + b.w*cellH + cellH/2 + (b.oy||0);
              const dist = Math.hypot(x2-x1, y2-y1);
              return (
                <path key={i} d={threadPath(x1,y1,x2,y2, Math.min(dist*0.06, 22))}
                  stroke="#9c5a2e" strokeWidth="1.8" fill="none" strokeLinecap="round"
                  filter="url(#threadShadow)" opacity="0.92" />
              );
            })}
            {threadDrag && (() => {
              const a = cards[threadDrag.fromIdx];
              if (!a) return null;
              const x1 = railW + a.d*cellW + cellW/2;
              const y1 = headerH + a.w*cellH + cellH/2;
              return (
                <path d={threadPath(x1,y1,threadDrag.x,threadDrag.y, 12)}
                  stroke="#9c5a2e" strokeWidth="1.8" fill="none" strokeLinecap="round"
                  strokeDasharray="3 3" opacity="0.85" />
              );
            })()}
          </svg>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Board, Card, COLORS, COLOR_KEYS, PIN_COLORS, DEMO_CARDS, DEMO_THREADS, WEEK_LABELS, DAYS });
