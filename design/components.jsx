// components.jsx — Component artboards: toolbar, color popover, edit popover, share dialog, week rail

const aF = "'JetBrains Mono', ui-monospace, monospace";
const bF = "'Manrope', -apple-system, system-ui, sans-serif";

function Toolbar({ weeks = 26 }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:2, padding:4,
      background:'#fff', borderRadius:8,
      boxShadow:'0 1px 0 rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.05)',
      fontFamily:bF,
    }}>
      <TbBtn label="Weeks" value={`${weeks}`} />
      <Sep />
      <TbBtn label="Undo" icon="↶" />
      <TbBtn label="Redo" icon="↷" />
      <Sep />
      <TbBtn label="Share" icon="🔗" primary />
    </div>
  );
}
function TbBtn({ label, value, icon, primary }) {
  return (
    <button style={{
      display:'inline-flex', alignItems:'center', gap:6, padding:'7px 10px',
      border:0, borderRadius:5, background: primary ? '#2a1f15' : 'transparent',
      color: primary ? '#f6f2ec' : '#2a1f15',
      fontFamily:bF, fontSize:13, fontWeight:500, cursor:'pointer',
    }}>
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {value && <span style={{ fontFamily:aF, fontSize:11, opacity:.7, marginLeft:2 }}>{value}</span>}
    </button>
  );
}
function Sep() { return <span style={{ width:1, height:18, background:'rgba(0,0,0,.08)', margin:'0 4px' }}></span>; }

function ColorPopover({ selected = 'peach' }) {
  return (
    <div style={{
      display:'inline-block', padding:8, background:'#fff', borderRadius:8,
      boxShadow:'0 6px 18px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.06)',
    }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 22px)', gap:6 }}>
        {COLOR_KEYS.map(k => (
          <button key={k} style={{
            width:22, height:22, borderRadius:3, border:0, cursor:'pointer', padding:0,
            background: COLORS[k].fill,
            boxShadow: selected === k
              ? '0 0 0 2px #2a1f15, 0 0 0 3px #fff, 0 1px 2px rgba(0,0,0,.2)'
              : 'inset 0 0 0 1px rgba(0,0,0,.06), 0 1px 1px rgba(0,0,0,.1)',
          }}></button>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, padding:'0 2px' }}>
        <span style={{ fontFamily:aF, fontSize:10, color:'#6b5a48' }}>Color</span>
        <button style={{ border:0, background:'transparent', color:'#c84a3a', fontFamily:bF, fontSize:11, fontWeight:600, cursor:'pointer', padding:0 }}>Delete</button>
      </div>
    </div>
  );
}

function EditPopover() {
  return (
    <div style={{
      display:'inline-block', padding:10, background:'#fff', borderRadius:10, minWidth:240,
      boxShadow:'0 10px 28px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)',
    }}>
      <div style={{
        background:'#F4B584', borderRadius:2, padding:'8px 10px',
        fontFamily:"'Caveat', cursive", fontSize:22, fontWeight:600, color:'#3a2410',
        outline:'2px solid #2a6fdb', outlineOffset:2,
      }}>
        Dress + light<span style={{ color:'#2a6fdb', marginLeft:1 }}>|</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8, 18px)', gap:5, marginTop:12 }}>
        {COLOR_KEYS.map((k, i) => (
          <button key={k} style={{
            width:18, height:18, borderRadius:3, border:0, cursor:'pointer', padding:0,
            background: COLORS[k].fill,
            boxShadow: i === 0
              ? '0 0 0 2px #2a1f15, 0 0 0 3px #fff'
              : 'inset 0 0 0 1px rgba(0,0,0,.06)',
          }}></button>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, fontFamily:bF, fontSize:11, color:'#6b5a48' }}>
        <span><span style={{ fontFamily:aF }}>⏎</span> save · <span style={{ fontFamily:aF }}>esc</span> cancel</span>
        <button style={{ border:0, background:'transparent', color:'#c84a3a', fontFamily:bF, fontSize:11, fontWeight:600, cursor:'pointer' }}>Delete</button>
      </div>
    </div>
  );
}

function ShareDialog() {
  return (
    <div style={{
      display:'inline-block', padding:16, background:'#fff', borderRadius:10, width:340,
      boxShadow:'0 10px 28px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontFamily:bF, fontWeight:700, fontSize:15, color:'#2a1f15' }}>Share this board</div>
      <div style={{ fontFamily:bF, fontSize:12, color:'#6b5a48', marginTop:4 }}>
        Anyone with the link can view and edit. There are no roles or accounts.
      </div>
      <div style={{
        display:'flex', alignItems:'center', gap:8, marginTop:12,
        padding:'8px 10px', background:'#f6f2ec', borderRadius:6,
      }}>
        <span style={{ fontFamily:aF, fontSize:11, color:'#2a1f15', flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>
          scheduleboard.app/b/oak-thread-942
        </span>
        <button style={{ border:0, background:'#2a1f15', color:'#f6f2ec', padding:'6px 10px', borderRadius:4, fontFamily:bF, fontSize:12, fontWeight:600, cursor:'pointer' }}>Copy</button>
      </div>
      <div style={{ fontFamily:bF, fontSize:11, color:'#6b5a48', marginTop:10 }}>
        Last edited 2 minutes ago · 14 cards · 3 threads
      </div>
    </div>
  );
}

function ComponentsArtboard() {
  return (
    <div style={{ padding:28, background:'#f6f2ec', height:'100%', display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <Anno>Components · UI chrome</Anno>
        <div style={{ fontFamily:bF, fontSize:18, fontWeight:700, marginTop:4, color:'#2a1f15' }}>
          The whole chrome surface
        </div>
        <Hint style={{ maxWidth:520, marginTop:4 }}>
          The spec calls for "no UI chrome beyond a minimal toolbar." This is all of it: a top-right
          toolbar, a color popover when editing a card, an edit popover, and a share dialog.
        </Hint>
      </div>

      <div>
        <Anno>Toolbar (top-right, fixed)</Anno>
        <div style={{ marginTop:10 }}><Toolbar weeks={26} /></div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
        <div>
          <Anno>Card edit popover</Anno>
          <Hint style={{ marginTop:4 }}>Opens on card click. Text input + 8-color row + delete.</Hint>
          <div style={{ marginTop:10 }}><EditPopover /></div>
        </div>
        <div>
          <Anno>Color-only popover (on click after blur)</Anno>
          <Hint style={{ marginTop:4 }}>Quicker recolor without re-entering edit.</Hint>
          <div style={{ marginTop:10 }}><ColorPopover /></div>
        </div>
      </div>

      <div>
        <Anno>Share dialog</Anno>
        <div style={{ marginTop:10 }}><ShareDialog /></div>
      </div>
    </div>
  );
}

Object.assign(window, { Toolbar, ColorPopover, EditPopover, ShareDialog, ComponentsArtboard });
