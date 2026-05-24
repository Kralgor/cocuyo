// cocuyo-viz.jsx — Custom visual language for grid health
// Exports (on window): Fingerprint, FrequencyTrace, ForecastCurve,
// HistoryStrip, CrossServiceRow, FireflyDot, GuriGauge, SignalBar, Spark, MiniStat

// ── Signal Fingerprint ───────────────────────────────────────
// 4 wedges (internet, satellite, crowd, weather) emanating from center.
// Each wedge length = signal score. When all 4 are bright, the firefly glows.
function Fingerprint({ signals, theme: t, size = 120, accentColor, glow = true, labels = false, lang = 'es' }) {
  const c = size / 2;
  const r0 = size * 0.08;  // inner hole
  const rmax = size * 0.46;
  const ax = accentColor || t.accent;

  const axes = [
    { k: 'inet',    angle: -90, label: window.COCUYO.tt('signal_int', lang),   sym: 'I' },
    { k: 'sat',     angle:   0, label: window.COCUYO.tt('signal_sat', lang),  sym: 'S' },
    { k: 'crowd',   angle:  90, label: window.COCUYO.tt('signal_crowd', lang), sym: 'C' },
    { k: 'weather', angle: 180, label: window.COCUYO.tt('signal_wx', lang),    sym: 'W' },
  ];

  // wedge angular width: narrow at the core, wider at the tip — like beams of light
  const halfBase = 8;  // degrees half-width at the base (core)
  const halfTip  = 22; // degrees half-width at the tip

  function wedgePath(angleDeg, len) {
    const a1b = (angleDeg - halfBase) * Math.PI / 180;
    const a2b = (angleDeg + halfBase) * Math.PI / 180;
    const a1t = (angleDeg - halfTip)  * Math.PI / 180;
    const a2t = (angleDeg + halfTip)  * Math.PI / 180;
    const x1 = c + r0  * Math.cos(a1b), y1 = c + r0  * Math.sin(a1b);
    const x2 = c + len * Math.cos(a1t), y2 = c + len * Math.sin(a1t);
    const x3 = c + len * Math.cos(a2t), y3 = c + len * Math.sin(a2t);
    const x4 = c + r0  * Math.cos(a2b), y4 = c + r0  * Math.sin(a2b);
    return `M ${x1} ${y1} L ${x2} ${y2} A ${len} ${len} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${r0} ${r0} 0 0 0 ${x1} ${y1} Z`;
  }

  // overall intensity
  const total = (signals.inet + signals.sat + signals.crowd + signals.weather) / 4;
  const filterGlow = glow ? `drop-shadow(0 0 ${4 + total * 12}px ${ax}${total > 0.5 ? 'cc' : '66'})` : 'none';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', filter: filterGlow }}>
        {/* outer rings */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <circle key={f} cx={c} cy={c} r={r0 + (rmax - r0) * f} fill="none"
            stroke={t.line} strokeWidth={0.5} strokeDasharray="1 3" />
        ))}
        {/* wedges */}
        {axes.map(ax2 => {
          const v = signals[ax2.k] || 0;
          const len = r0 + (rmax - r0) * v;
          const op = 0.25 + v * 0.75;
          return (
            <g key={ax2.k}>
              {/* base ghost */}
              <path d={wedgePath(ax2.angle, rmax)} fill={t.line} opacity={0.4} />
              {/* live value */}
              <path d={wedgePath(ax2.angle, len)} fill={ax} opacity={op}>
                {v > 0.6 && glow && (
                  <animate attributeName="opacity" values={`${op};${Math.min(1, op + 0.15)};${op}`} dur="2s" repeatCount="indefinite" />
                )}
              </path>
            </g>
          );
        })}
        {/* spokes — faint axis lines under wedges */}
        {axes.map(ax2 => {
          const a = ax2.angle * Math.PI / 180;
          return (
            <line key={'sp-'+ax2.k}
              x1={c + r0 * Math.cos(a)} y1={c + r0 * Math.sin(a)}
              x2={c + rmax * Math.cos(a)} y2={c + rmax * Math.sin(a)}
              stroke={t.line} strokeWidth={0.5} strokeDasharray="1 2" />
          );
        })}
        {/* core dot */}
        <circle cx={c} cy={c} r={r0 * 1.1} fill={t.bg} stroke={ax} strokeWidth={0.7} opacity={0.5 + total * 0.5} />
        <circle cx={c} cy={c} r={r0 * 0.4} fill={ax} opacity={0.4 + total * 0.6} />
        {/* axis labels (symbols) */}
        {axes.map(ax2 => {
          const a = ax2.angle * Math.PI / 180;
          const lx = c + (rmax + 8) * Math.cos(a);
          const ly = c + (rmax + 8) * Math.sin(a);
          return (
            <text key={ax2.k} x={lx} y={ly + 3} fontSize={size * 0.07} textAnchor="middle"
              fill={t.inkFaint} fontFamily={t.mono} style={{ fontWeight: 600, letterSpacing: '0.08em' }}>
              {ax2.sym}
            </text>
          );
        })}
      </svg>
      {labels && (
        <div style={{
          marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px',
          fontFamily: t.mono, fontSize: 9, color: t.inkDim, letterSpacing: '0.04em',
        }}>
          {axes.map(ax2 => (
            <div key={ax2.k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ textTransform: 'uppercase' }}>{ax2.label}</span>
              <span style={{ color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{Math.round((signals[ax2.k] || 0) * 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Live Grid Frequency Heartbeat ─────────────────────────────
// A scrolling 60Hz trace with realistic-looking sag events.
function FrequencyTrace({ theme: t, width = 320, height = 80, bajones = [], live = true, glow = true }) {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    if (!live) return;
    let raf;
    const tick = (ts) => { setPhase(ts / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  // Generate path: each x is a time bucket, y is frequency deviation from 60Hz.
  // Sag at index i creates a dip.
  const N = 240;
  const points = [];
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * width;
    // base wobble
    let dev = Math.sin((i + phase * 30) * 0.18) * 0.04 + Math.sin((i + phase * 11) * 0.51) * 0.025;
    // event sags (recent on the right)
    for (const e of bajones) {
      const center = N - (e.t_idx || (N - 30));
      const span = e.span || 8;
      const depth = e.depth || 0.4;
      const d = (i - center) / span;
      if (Math.abs(d) < 1) {
        dev -= depth * (1 - d * d);
      }
    }
    // map dev (-1..0.2) to y; 60Hz = mid height
    const mid = height / 2;
    const y = mid + dev * (height * 0.6);
    points.push([x, y]);
  }
  const path = 'M ' + points.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');

  // 60Hz grid line
  const mid = height / 2;
  const accent = t.accent;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {/* deviation bands */}
      <rect x={0} y={mid - height * 0.05} width={width} height={height * 0.10} fill={t.ok} opacity={0.06} />
      <line x1={0} y1={mid} x2={width} y2={mid} stroke={t.line} strokeDasharray="2 3" />
      {/* 59.5 and 60.5 ticks */}
      <line x1={0} y1={mid + height * 0.30} x2={width} y2={mid + height * 0.30} stroke={t.danger} opacity={0.15} strokeDasharray="1 4" />
      {/* live trace */}
      <path d={path} fill="none" stroke={accent} strokeWidth={1.4}
        style={{ filter: glow ? `drop-shadow(0 0 4px ${accent})` : 'none' }} />
      {/* now indicator */}
      <circle cx={width - 2} cy={points[N - 1][1]} r={3} fill={accent}
        style={{ filter: glow ? `drop-shadow(0 0 6px ${accent})` : 'none' }} />
    </svg>
  );
}

// ── 24h Forecast Curve ────────────────────────────────────────
function ForecastCurve({ theme: t, data, width = 320, height = 96, lang = 'es', glow = true, hoursOffset = 0, accentColor }) {
  const N = data.length;
  // Build smoothed area path
  const stepX = width / (N - 1);
  const ys = data.map(v => height - height * 0.92 * v - height * 0.04);

  let area = `M 0 ${height} `;
  for (let i = 0; i < N; i++) area += `L ${(i * stepX).toFixed(1)} ${ys[i].toFixed(1)} `;
  area += `L ${width} ${height} Z`;

  let line = `M 0 ${ys[0].toFixed(1)} `;
  for (let i = 1; i < N; i++) line += `L ${(i * stepX).toFixed(1)} ${ys[i].toFixed(1)} `;

  const ax = accentColor || t.accent;
  // Hour labels
  const startH = new Date().getHours();
  const ticks = [0, 6, 12, 18, 24].map(h => {
    const x = ((h * 2) / (N - 1)) * width;
    return { x, h: (startH + h) % 24 };
  });

  // Risk band (high)
  const highRiskBand = (
    <rect x={0} y={height * 0.05} width={width} height={height * 0.25} fill={t.danger} opacity={0.04} />
  );

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="fc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ax} stopOpacity={0.55} />
          <stop offset="100%" stopColor={ax} stopOpacity={0} />
        </linearGradient>
      </defs>
      {highRiskBand}
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} y1={height * (1 - f)} x2={width} y2={height * (1 - f)}
          stroke={t.line} strokeDasharray="1 4" />
      ))}
      {/* area */}
      <path d={area} fill="url(#fc-grad)" />
      <path d={line} fill="none" stroke={ax} strokeWidth={1.5}
        style={{ filter: glow ? `drop-shadow(0 0 6px ${ax})` : 'none' }} />
      {/* hour ticks */}
      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={tk.x} y1={height - 2} x2={tk.x} y2={height - 6} stroke={t.lineStrong} />
          <text x={tk.x} y={height + 9} fontSize="8" textAnchor="middle"
            fill={t.inkFaint} fontFamily={t.mono} style={{ letterSpacing: '0.06em' }}>
            {String(tk.h).padStart(2, '0')}h
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── 30-Day Darkness Strip ─────────────────────────────────────
// Each day = a vertical column with 24 hour rows. Filled cell = power out.
function HistoryStrip({ theme: t, days, width = 320, height = 110, lang = 'es' }) {
  const N = days.length;
  const colW = width / N;
  const rowH = height / 24;
  const ax = t.accent;

  // Find max outage hours
  let total = 0, longest = 0, outageCount = 0;
  for (const d of days) {
    for (const o of d.outages) {
      total += o.dur;
      if (o.dur > longest) longest = o.dur;
      outageCount++;
    }
  }

  // Day-of-week labels (sparse)
  const today = new Date();
  return (
    <svg width={width} height={height + 16} viewBox={`0 0 ${width} ${height + 16}`}>
      {/* hour gridlines */}
      {[6, 12, 18].map(h => (
        <line key={h} x1={0} y1={h * rowH} x2={width} y2={h * rowH}
          stroke={t.line} strokeDasharray="1 3" />
      ))}
      {/* outage rectangles */}
      {days.map((d, i) => (
        <g key={i}>
          {d.outages.map((o, j) => (
            <rect
              key={j}
              x={i * colW + colW * 0.12}
              y={o.start * rowH}
              width={colW * 0.76}
              height={o.dur * rowH}
              rx={1}
              fill={ax}
              opacity={0.85}
              style={{ filter: t.glow !== 'none' ? `drop-shadow(0 0 3px ${ax}aa)` : 'none' }}
            />
          ))}
          {/* day frame */}
          <rect x={i * colW + 0.5} y={0} width={colW - 1} height={height} fill="none" stroke={t.line} strokeWidth={0.5} />
        </g>
      ))}
      {/* hour labels left */}
      <text x={2} y={6 * rowH + 3} fontSize="7" fill={t.inkFaint} fontFamily={t.mono}>06</text>
      <text x={2} y={12 * rowH + 3} fontSize="7" fill={t.inkFaint} fontFamily={t.mono}>12</text>
      <text x={2} y={18 * rowH + 3} fontSize="7" fill={t.inkFaint} fontFamily={t.mono}>18</text>
      {/* week markers */}
      {[6, 13, 20, 27].map(i => (
        <text key={i} x={i * colW + colW / 2} y={height + 10} fontSize="7" textAnchor="middle"
          fill={t.inkFaint} fontFamily={t.mono}>
          {(() => {
            const dd = new Date(today);
            dd.setDate(today.getDate() - (29 - i));
            return dd.getDate();
          })()}
        </text>
      ))}
    </svg>
  );
}

// ── Cross-Service Row (Power / Water / Internet / Cell) ──────
function CrossServiceRow({ theme: t, lang, items }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {items.map((it, i) => {
        const color = it.status === 'down' ? t.danger :
                      it.status === 'degraded' ? t.warn :
                      it.status === 'pending' ? t.accent : t.ok;
        const label = it.status === 'down' ? (lang === 'es' ? 'caído' : 'down') :
                      it.status === 'degraded' ? (lang === 'es' ? 'degradado' : 'degraded') :
                      it.status === 'pending' ? (lang === 'es' ? 'monitor' : 'monitor') :
                      (lang === 'es' ? 'normal' : 'normal');
        return (
          <div key={i} style={{
            flex: 1, background: t.panel2, border: `0.5px solid ${t.line}`,
            borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: color,
                boxShadow: t.glow !== 'none' ? `0 0 6px ${color}` : 'none',
              }} />
              <span style={{ fontSize: 10, color: t.inkDim, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: t.mono }}>
                {it.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: t.ink, fontWeight: 500 }}>{label}</div>
            {it.detail && <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: t.mono }}>{it.detail}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Firefly Dot (used on the map) ─────────────────────────────
function FireflyDot({ size = 14, color, pulse = true, glow = true }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, position: 'relative',
      boxShadow: glow ? `0 0 ${size * 0.8}px ${color}, 0 0 ${size * 0.3}px ${color}` : 'none',
      animation: pulse ? `cocuyo-pulse 2.4s ease-in-out infinite` : 'none',
    }} />
  );
}

// ── Guri Reservoir Proxy Gauge ────────────────────────────────
// Vertical bar with current level + historical band.
function GuriGauge({ theme: t, level = 0.40, lang = 'es' }) {
  // Level = 0 (empty) .. 1 (full)
  const ax = t.accent;
  const color = level < 0.35 ? t.danger : level < 0.55 ? t.warn : t.ok;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{
        position: 'relative', width: 12, height: 70, background: t.panel2,
        border: `0.5px solid ${t.line}`, borderRadius: 3, overflow: 'hidden',
      }}>
        {/* fill */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${level * 100}%`, background: color,
          boxShadow: t.glow !== 'none' ? `0 0 6px ${color}aa` : 'none',
          transition: 'height .6s ease',
        }} />
        {/* nominal band */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: '60%', height: 1, background: t.lineStrong,
        }} />
      </div>
      <div style={{ fontFamily: t.mono, fontSize: 10, color: t.inkDim, lineHeight: 1.4 }}>
        <div style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{window.COCUYO.tt('caroni_proxy', lang)}</div>
        <div style={{ color: t.ink, fontSize: 18, fontWeight: 500, fontFamily: t.display, letterSpacing: '-0.01em' }}>
          {Math.round(level * 100)}<span style={{ fontSize: 11, color: t.inkFaint, marginLeft: 2 }}>%</span>
        </div>
        <div style={{ color: t.inkFaint }}>{lang === 'es' ? 'óptimo histórico' : 'historical optimum'}</div>
      </div>
    </div>
  );
}

// ── Plain horizontal Signal Bar ───────────────────────────────
function SignalBar({ theme: t, label, value, sub, color }) {
  const c = color || t.accent;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.inkDim, fontFamily: t.mono, letterSpacing: '0.04em' }}>
        <span style={{ textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{Math.round(value * 100)}</span>
      </div>
      <div style={{ height: 4, background: t.panel2, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', width: `${value * 100}%`, background: c,
          boxShadow: t.glow !== 'none' ? `0 0 4px ${c}` : 'none',
        }} />
      </div>
      {sub && <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: t.mono }}>{sub}</div>}
    </div>
  );
}

// ── Tiny sparkline ────────────────────────────────────────────
function Spark({ theme: t, data, width = 60, height = 18, color }) {
  const c = color || t.accent;
  const max = Math.max(...data, 0.01);
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - (v / max) * height * 0.9 - height * 0.05]);
  const d = 'M ' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={c} strokeWidth={1.2} />
    </svg>
  );
}

// ── Mini stat ─────────────────────────────────────────────────
function MiniStat({ theme: t, label, value, unit, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 9, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: t.mono }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, color: t.ink, fontWeight: 500, fontFamily: t.display, letterSpacing: '-0.02em' }}>{value}</span>
        {unit && <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: t.mono }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 9.5, color: t.inkDim, fontFamily: t.mono }}>{sub}</div>}
    </div>
  );
}

// ── Inject pulse keyframes once ───────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('cocuyo-anim')) {
  const s = document.createElement('style');
  s.id = 'cocuyo-anim';
  s.textContent = `
    @keyframes cocuyo-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.25); opacity: 0.7; }
    }
    @keyframes cocuyo-ring {
      0% { transform: scale(0.6); opacity: 0.7; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes cocuyo-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  Fingerprint, FrequencyTrace, ForecastCurve, HistoryStrip,
  CrossServiceRow, FireflyDot, GuriGauge, SignalBar, Spark, MiniStat,
});
