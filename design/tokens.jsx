// tokens.jsx — design system token artboards (colors, type, surfaces, card anatomy, thread, pin)

const annoFont = "'JetBrains Mono', ui-monospace, monospace";
const bodyFont = "'Manrope', -apple-system, system-ui, sans-serif";

function Anno({ children, style }) {
  return <div style={{
    fontFamily: annoFont, fontSize: 10, color: '#6b5a48', textTransform:'uppercase',
    letterSpacing:'0.08em', ...style,
  }}>{children}</div>;
}
function Label({ children, style }) {
  return <div style={{ fontFamily: bodyFont, fontSize: 13, color:'#2a1f15', fontWeight:600, ...style }}>{children}</div>;
}
function Hint({ children, style }) {
  return <div style={{ fontFamily: bodyFont, fontSize: 11, color:'#6b5a48', lineHeight:1.4, ...style }}>{children}</div>;
}
function Mono({ children, style }) {
  return <span style={{ fontFamily: annoFont, fontSize:10, color:'#4a3a28', ...style }}>{children}</span>;
}

// ---- Color palette ----
function ColorPalette() {
  const entries = [
    ['peach',  '#F4B584', 'Peach',  'Default • most cards'],
    ['coral',  '#F26B86', 'Coral',  'Hot pink • urgent / out'],
    ['orange', '#EE7A3E', 'Orange', 'Day / shoot day'],
    ['salmon', '#F5A088', 'Salmon', 'Soft warm tag'],
    ['yellow', '#F5D257', 'Yellow', 'Note / FYI'],
    ['mint',   '#9BD3B0', 'Mint',   'Available / break'],
    ['sky',    '#6FA8D8', 'Sky',    'Build / prep'],
    ['lilac',  '#B89DD0', 'Lilac',  'Lighting / dept tag'],
  ];
  return (
    <div style={{ padding: 28, background:'#f6f2ec', height:'100%', display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <Anno>Tokens / Color · Card palette</Anno>
        <div style={{ fontFamily:bodyFont, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
          Card palette — 8 fixed swatches
        </div>
        <Hint style={{ marginTop:4, maxWidth:480 }}>
          Color carries no built-in meaning — users assign it themselves. These eight cover the
          warm/cool mix of the reference and are the only allowed card fills.
        </Hint>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14 }}>
        {entries.map(([k, hex, name, use]) => (
          <div key={k} style={{ background:'#fff', borderRadius:6, padding:12, boxShadow:'0 1px 0 rgba(0,0,0,.04), 0 1px 6px rgba(0,0,0,.04)' }}>
            <div style={{ width:'100%', height:54, background:hex, borderRadius:3, boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)' }}></div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, alignItems:'baseline' }}>
              <Label>{name}</Label>
              <Mono>{hex}</Mono>
            </div>
            <Hint style={{ marginTop:2 }}>{use}</Hint>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:6 }}>
        <div style={{ background:'#fff', borderRadius:6, padding:14 }}>
          <Anno>Pin heads</Anno>
          <div style={{ display:'flex', gap:14, marginTop:10, alignItems:'center' }}>
            {[['Red','#d6463a'],['Yellow','#e9b834'],['Blue','#3a7ed6'],['Green','#3aa15a'],['White','#f5f1e6']].map(([n,c]) => (
              <div key={n} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <span style={{ width:10, height:10, borderRadius:'50%',
                  background:`radial-gradient(circle at 30% 30%, #fff8 0 18%, ${c} 20% 100%)`,
                  boxShadow:'0 1px 2px rgba(0,0,0,.4)' }}></span>
                <Mono>{n}</Mono>
              </div>
            ))}
          </div>
          <Hint style={{ marginTop:10 }}>Pin color is random on create, persists per-card. Purely cosmetic.</Hint>
        </div>
        <div style={{ background:'#fff', borderRadius:6, padding:14 }}>
          <Anno>Surface / ink</Anno>
          <div style={{ display:'flex', gap:10, marginTop:10 }}>
            {[['Cork','#c9a978'],['Wood','#a06c3e'],['Ink dark','#2a1f15'],['Ink mid','#6b5a48'],['Paper','#f6f2ec']].map(([n,c]) => (
              <div key={n} style={{ flex:1, textAlign:'center' }}>
                <div style={{ height:32, background:c, borderRadius:3, boxShadow:'inset 0 0 0 1px rgba(0,0,0,.08)' }}></div>
                <Mono style={{ display:'block', marginTop:4 }}>{n}</Mono>
                <Mono style={{ display:'block', opacity:.7 }}>{c}</Mono>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Typography ----
function Typography() {
  return (
    <div style={{ padding:28, background:'#f6f2ec', height:'100%', display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <Anno>Tokens / Type · Two voices</Anno>
        <div style={{ fontFamily:bodyFont, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
          Handwritten on the board, neutral in the chrome
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:6, padding:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <Label>Card text — primary</Label>
          <Mono>Caveat · 600 · 16/1.05</Mono>
        </div>
        <div style={{ fontFamily:"'Caveat', cursive", fontWeight:600, fontSize:36, color:'#3a2410', lineHeight:1, marginTop:8 }}>
          Dress &amp; light
        </div>
        <div style={{ fontFamily:"'Caveat', cursive", fontWeight:600, fontSize:22, color:'#3a2410', marginTop:4 }}>
          Claire McCarty · 120-0250 · Ian recs
        </div>
        <Hint style={{ marginTop:8 }}>Used for any non-shouty card text. Mixed case allowed.</Hint>
      </div>

      <div style={{ background:'#fff', borderRadius:6, padding:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <Label>Card text — marker / shouty</Label>
          <Mono>Permanent Marker · 14 · uppercase</Mono>
        </div>
        <div style={{ fontFamily:"'Permanent Marker', cursive", fontSize:32, color:'#3a2410', letterSpacing:'0.04em', marginTop:8 }}>
          BLOCK · RIG · DRESS
        </div>
        <Hint style={{ marginTop:8 }}>
          Auto-applied when the entire text is uppercase letters (regex: <Mono>/^[A-Z &amp;+]{'{2,}'}$/</Mono>).
          Users can type lowercase to opt out.
        </Hint>
      </div>

      <div style={{ background:'#fff', borderRadius:6, padding:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <Label>UI chrome — body</Label>
          <Mono>Manrope · 500 · 13/1.4</Mono>
        </div>
        <div style={{ fontFamily:bodyFont, fontWeight:500, fontSize:14, color:'#2a1f15', marginTop:8 }}>
          Toolbar buttons, dialog text, hover hints, week count, share URL.
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:6, padding:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <Label>UI chrome — mono</Label>
          <Mono>JetBrains Mono · 400 · 10–11</Mono>
        </div>
        <div style={{ fontFamily:annoFont, fontSize:11, color:'#2a1f15', marginTop:8 }}>
          keyboard shortcuts · share URL · spec annotations
        </div>
      </div>
    </div>
  );
}

// ---- Card anatomy ----
function CardAnatomy() {
  return (
    <div style={{ padding:28, background:'#f6f2ec', height:'100%' }}>
      <Anno>Components / Card · Anatomy &amp; states</Anno>
      <div style={{ fontFamily:bodyFont, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>Card</div>

      <div style={{ display:'flex', gap:40, marginTop:24, alignItems:'flex-start' }}>
        {/* Annotated card */}
        <div style={{ position:'relative', padding:'40px 50px' }}>
          <div style={{ transform:'scale(2.4)', transformOrigin:'top left' }}>
            <Card color="peach" text="Dress + light" rot={-2} pin="red" />
          </div>
          {/* callouts */}
          <svg width="320" height="240" style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible' }}>
            <g stroke="#6b5a48" strokeWidth="0.75" fill="none">
              <path d="M 50 70 Q 30 30 0 30" />
              <path d="M 130 50 Q 180 20 240 30" />
              <path d="M 250 130 Q 290 110 310 130" />
              <path d="M 80 170 Q 50 200 0 200" />
            </g>
          </svg>
          <div style={{ position:'absolute', left:-150, top:18, width:160 }}>
            <Mono style={{ display:'block' }}>① Pin head</Mono>
            <Hint>5px radial-gradient dot, random pin color, soft drop shadow.</Hint>
          </div>
          <div style={{ position:'absolute', left:240, top:14, width:180 }}>
            <Mono style={{ display:'block' }}>② Rotation</Mono>
            <Hint>Random ±2° per card on create. Persists. Never animated.</Hint>
          </div>
          <div style={{ position:'absolute', left:320, top:120, width:180 }}>
            <Mono style={{ display:'block' }}>③ Drop shadow</Mono>
            <Hint>Two-layer: 0/1/2 hard + 0/4/8 soft @ 18%/10% black.</Hint>
          </div>
          <div style={{ position:'absolute', left:-150, top:190, width:160 }}>
            <Mono style={{ display:'block' }}>④ Text</Mono>
            <Hint>Caveat 16px or Permanent Marker if all caps. Center-balanced.</Hint>
          </div>
        </div>
      </div>

      <div style={{ marginTop:8 }}>
        <Anno>States</Anno>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginTop:8 }}>
          {[
            { label:'Idle',        node: <Card color="peach" text="BLOCK" rot={-1.5} /> },
            { label:'Hover',       node: <div style={{ filter:'brightness(1.05)', transform:'translateY(-2px)' }}><Card color="peach" text="BLOCK" rot={-1.5} style={{ boxShadow:'0 4px 8px rgba(0,0,0,.22), 0 10px 18px rgba(0,0,0,.14)' }} /></div> },
            { label:'Selected',    node: <Card color="peach" text="BLOCK" rot={0} style={{ outline:'2px solid #2a6fdb', outlineOffset:2 }} /> },
            { label:'Editing',     node: <div style={{ position:'relative' }}><Card color="peach" text="BLOCK|" rot={0} style={{ outline:'2px solid #2a6fdb', outlineOffset:2 }} /></div> },
          ].map(s => (
            <div key={s.label} style={{ background:'#c9a978', padding:'24px 14px 16px', borderRadius:4 }}>
              <div style={{ display:'flex', justifyContent:'center', minHeight:48 }}>{s.node}</div>
              <Mono style={{ display:'block', textAlign:'center', marginTop:14, color:'#2a1f15' }}>{s.label}</Mono>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Thread anatomy ----
function ThreadAnatomy() {
  return (
    <div style={{ padding:28, background:'#f6f2ec', height:'100%' }}>
      <Anno>Components / Thread · String between cards</Anno>
      <div style={{ fontFamily:bodyFont, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>Thread</div>
      <Hint style={{ marginTop:6, maxWidth:520 }}>
        Curved cubic-quadratic path with downward sag proportional to distance (min 8px, max 22px).
        Faded reddish-brown stroke 1.8px. Drop shadow filter. No arrowhead.
      </Hint>

      <div style={{ marginTop:24, background:'#c9a978', borderRadius:4, padding:24, height:260, position:'relative', overflow:'hidden' }}>
        {/* cork texture */}
        <div style={{ position:'absolute', inset:0,
          background: `radial-gradient(circle at 22% 18%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
                       radial-gradient(circle at 71% 64%, rgba(0,0,0,.04) 0 1px, transparent 1.5px),
                       radial-gradient(circle at 44% 88%, rgba(0,0,0,.05) 0 1px, transparent 1.5px)`,
          backgroundSize:'13px 13px, 9px 9px, 17px 17px',
          pointerEvents:'none',
        }}></div>
        <svg width="100%" height="100%" style={{ position:'absolute', inset:0 }}>
          <defs>
            <filter id="ts1" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
              <feOffset dx="0" dy="1.5" />
              <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
              <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path d="M 100 80 Q 230 110 360 80" stroke="#9c5a2e" strokeWidth="1.8" fill="none" filter="url(#ts1)" strokeLinecap="round" />
          <path d="M 100 180 Q 230 230 360 180" stroke="#9c5a2e" strokeWidth="1.8" fill="none" filter="url(#ts1)" strokeLinecap="round" />
          <path d="M 480 80 Q 540 200 600 180" stroke="#9c5a2e" strokeWidth="1.8" fill="none" filter="url(#ts1)" strokeLinecap="round" />
        </svg>
        <div style={{ position:'absolute', left:60, top:62 }}><Card color="orange" text="RIG" rot={-2}/></div>
        <div style={{ position:'absolute', left:320, top:62 }}><Card color="peach" text="BLOCK" rot={1.5}/></div>
        <div style={{ position:'absolute', left:60, top:162 }}><Card color="sky" text="BUILD" rot={-1}/></div>
        <div style={{ position:'absolute', left:320, top:162 }}><Card color="lilac" text="LIGHT" rot={2}/></div>
        <div style={{ position:'absolute', left:440, top:62 }}><Card color="coral" text="STRIKE" rot={-3}/></div>
        <div style={{ position:'absolute', left:560, top:162 }}><Card color="yellow" text="STILL" rot={1}/></div>

        <Mono style={{ position:'absolute', left:210, top:30 }}>short distance · sag 8px</Mono>
        <Mono style={{ position:'absolute', left:210, top:240 }}>medium · sag 14px</Mono>
        <Mono style={{ position:'absolute', left:500, top:130 }}>diagonal · sag 18px</Mono>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16 }}>
        <div style={{ background:'#fff', borderRadius:6, padding:14 }}>
          <Anno>Stroke</Anno>
          <Hint style={{ marginTop:6 }}>
            <Mono>#9c5a2e</Mono> · width <Mono>1.8</Mono> · linecap round · opacity <Mono>0.92</Mono>
          </Hint>
        </div>
        <div style={{ background:'#fff', borderRadius:6, padding:14 }}>
          <Anno>Shadow filter</Anno>
          <Hint style={{ marginTop:6 }}>
            Blur σ=1, offset y=1.5, alpha 0.45. Applied to the path, not the parent.
          </Hint>
        </div>
      </div>
    </div>
  );
}

// ---- Board surface / grid spec ----
function GridSpec() {
  return (
    <div style={{ padding:28, background:'#f6f2ec', height:'100%' }}>
      <Anno>Components / Grid · Surface &amp; cell</Anno>
      <div style={{ fontFamily:bodyFont, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>Board surface</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:18, marginTop:16 }}>
        <div>
          <Board weeks={5} cellW={64} cellH={42} railW={64} cards={[
            { w:0, d:1, c:'coral', t:'BLOCK' },
            { w:1, d:2, c:'peach', t:'Dress + light' },
            { w:2, d:0, c:'sky', t:'BUILD' },
            { w:3, d:3, c:'orange', t:'PROG MOCO' },
          ]} threads={[]} showThreads={false} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <SpecRow k="Frame" v="warm wood gradient · 12–24px border · inset bevel" />
          <SpecRow k="Surface" v="cork gradient #c9a978 → #b89465, noise dots" />
          <SpecRow k="Grid lines" v="0.5px · rgba(40,20,5,.22)" />
          <SpecRow k="Day cell" v="56 × 38 (default) · scales with viewport" />
          <SpecRow k="Header row" v="32px · day badge in peach" />
          <SpecRow k="Week rail" v="64px · # + Mon date in Caveat" />
          <SpecRow k="Columns" v="Mon–Sun (7) · Sat/Sun visually muted" />
          <SpecRow k="Rows" v="4–52 weeks · default 26" />
        </div>
      </div>
    </div>
  );
}
function SpecRow({ k, v }) {
  return (
    <div style={{ background:'#fff', borderRadius:5, padding:'8px 10px' }}>
      <Mono style={{ display:'block' }}>{k}</Mono>
      <Hint style={{ marginTop:2 }}>{v}</Hint>
    </div>
  );
}

Object.assign(window, { ColorPalette, Typography, CardAnatomy, ThreadAnatomy, GridSpec, Anno, Label, Hint, Mono });
