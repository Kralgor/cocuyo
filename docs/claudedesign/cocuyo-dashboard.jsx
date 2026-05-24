// cocuyo-dashboard.jsx — Desktop national operations dashboard
// Loaded after cocuyo-viz.jsx. Uses Leaflet from window.L.

const { useState, useEffect, useRef, useMemo } = React;

// ── Leaflet map of Venezuela with firefly markers ─────────────
function VenezuelaMap({ theme: t, regionData, selectedId, onSelect, lang = 'es' }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerLayer = useRef(null);
  const tileLayer = useRef(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    if (!window.L) return;
    const map = window.L.map(mapRef.current, {
      center: [8.0, -66.0],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    mapInstance.current = map;
    markerLayer.current = window.L.layerGroup().addTo(map);
    // Fit to Venezuela bounds
    map.fitBounds([[0.5, -73.5], [12.5, -59.5]]);
  }, []);

  // Swap tile layer when theme changes
  useEffect(() => {
    if (!mapInstance.current) return;
    if (tileLayer.current) {
      mapInstance.current.removeLayer(tileLayer.current);
    }
    const tl = window.L.tileLayer(t.tileUrl, {
      maxZoom: 9, minZoom: 5, subdomains: 'abcd',
      crossOrigin: true,
    });
    tl.on('load', () => setTilesLoaded(true));
    tl.addTo(mapInstance.current);
    tileLayer.current = tl;
  }, [t.name]);

  // Update markers when data changes
  useEffect(() => {
    if (!markerLayer.current || !window.L) return;
    markerLayer.current.clearLayers();
    const REGIONS = window.COCUYO.REGIONS;
    for (const r of REGIONS) {
      const d = regionData[r.id];
      const status = window.COCUYO.statusFromScore(d.score);
      const color = window.COCUYO.statusColor(status, t);
      const size = 10 + Math.log2(r.pop / 100) * 3;
      const isOut = status === 'confirmed_outage' || status === 'likely_outage';
      const html = `
        <div class="cocuyo-marker" style="position:relative;width:${size * 3}px;height:${size * 3}px;">
          ${isOut ? `<span style="position:absolute;left:50%;top:50%;width:${size}px;height:${size}px;margin-left:-${size/2}px;margin-top:-${size/2}px;border:1px solid ${color};border-radius:50%;animation:cocuyo-ring 2.4s ease-out infinite;"></span>` : ''}
          ${isOut ? `<span style="position:absolute;left:50%;top:50%;width:${size}px;height:${size}px;margin-left:-${size/2}px;margin-top:-${size/2}px;border:1px solid ${color};border-radius:50%;animation:cocuyo-ring 2.4s ease-out 1.2s infinite;"></span>` : ''}
          <span style="position:absolute;left:50%;top:50%;width:${size}px;height:${size}px;margin-left:-${size/2}px;margin-top:-${size/2}px;background:${color};border-radius:50%;box-shadow:0 0 ${size * 0.9}px ${color},0 0 ${size * 0.3}px ${color};${isOut ? `animation:cocuyo-pulse 2.4s ease-in-out infinite;` : ''}"></span>
        </div>`;
      const icon = window.L.divIcon({ html, className: '', iconSize: [size * 3, size * 3] });
      const m = window.L.marker([r.lat, r.lng], { icon }).addTo(markerLayer.current);
      m.on('click', () => onSelect(r.id));
      // Label
      const shadowCol = t.name === 'estudio' ? '#e7e1d2' : t.name === 'tinta' ? '#1c1a16' : t.name === 'civic' ? '#f3efe6' : (typeof t.bg === 'string' && t.bg.startsWith('#') ? t.bg : '#0a0a0a');
      const labelHtml = `<div style="white-space:nowrap;font-family:${t.mono};font-size:9.5px;letter-spacing:0.06em;text-transform:uppercase;color:${t.ink};text-shadow:0 0 6px ${shadowCol},0 0 6px ${shadowCol};padding-left:${size}px;${selectedId === r.id ? `color:${color};` : ''}">${r.name}</div>`;
      const labelIcon = window.L.divIcon({ html: labelHtml, className: '', iconSize: [120, 14], iconAnchor: [-2, 6] });
      window.L.marker([r.lat, r.lng], { icon: labelIcon, interactive: false }).addTo(markerLayer.current);
    }
  }, [regionData, t.name, selectedId]);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: t.panel, borderRadius: 0, overflow: 'hidden',
    }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: t.bg }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: t.mapOverlay || 'none',
      }} />
      {/* graticule corners */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, pointerEvents: 'none' }}>
        {[['tl', 0, 0, 1, 1], ['tr', 0, 'auto', 1, 1], ['bl', 'auto', 0, 1, 1], ['br', 'auto', 'auto', 1, 1]].map(([k]) => (
          <div key={k} style={{
            position: 'absolute',
            top: k.includes('t') ? 0 : 'auto', bottom: k.includes('b') ? 0 : 'auto',
            left: k.includes('l') ? 0 : 'auto', right: k.includes('r') ? 0 : 'auto',
            width: 14, height: 14,
            borderTop: k.includes('t') ? `1px solid ${t.lineStrong}` : 'none',
            borderBottom: k.includes('b') ? `1px solid ${t.lineStrong}` : 'none',
            borderLeft: k.includes('l') ? `1px solid ${t.lineStrong}` : 'none',
            borderRight: k.includes('r') ? `1px solid ${t.lineStrong}` : 'none',
          }} />
        ))}
      </div>
      {/* legend overlay */}
      <MapLegend theme={t} lang={lang} />
    </div>
  );
}

function MapLegend({ theme: t, lang }) {
  const items = [
    { c: t.danger, k: 'confirmed', label: window.COCUYO.tt('confirmed', lang) },
    { c: t.warn,   k: 'likely',    label: window.COCUYO.tt('likely', lang) },
    { c: t.risk || t.accent, k: 'risk', label: window.COCUYO.tt('at_risk', lang) },
    { c: t.ok,     k: 'normal',    label: lang === 'es' ? 'NORMAL' : 'NORMAL' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 16, bottom: 16,
      background: t.name === 'aero' ? 'rgba(255, 248, 230, 0.78)' : (typeof t.panel === 'string' && t.panel.startsWith('#') ? `${t.panel}ee` : t.panel), border: `0.5px solid ${t.line}`,
      borderRadius: 4, padding: '10px 12px',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      fontFamily: t.mono, fontSize: 9.5, letterSpacing: '0.06em',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ color: t.inkFaint, textTransform: 'uppercase' }}>
        {lang === 'es' ? 'Estado por región' : 'Status by region'}
      </div>
      {items.map(it => (
        <div key={it.k} style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.ink }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: it.c,
            boxShadow: t.glow !== 'none' ? `0 0 6px ${it.c}` : 'none',
          }} />
          <span style={{ textTransform: 'uppercase' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Region list (left sidebar) ────────────────────────────────
function RegionList({ theme: t, regions, regionData, selectedId, onSelect, lang }) {
  // Sort by score descending
  const sorted = [...regions].sort((a, b) => regionData[b.id].score - regionData[a.id].score);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sorted.map(r => {
        const d = regionData[r.id];
        const status = window.COCUYO.statusFromScore(d.score);
        const color = window.COCUYO.statusColor(status, t);
        const isSelected = selectedId === r.id;
        return (
          <button key={r.id} onClick={() => onSelect(r.id)} style={{
            display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 10, alignItems: 'center',
            padding: '10px 16px',
            background: isSelected ? t.panel2 : 'transparent',
            borderLeft: `2px solid ${isSelected ? color : 'transparent'}`,
            borderTop: 'none', borderRight: 'none', borderBottom: `0.5px solid ${t.line}`,
            color: t.ink, textAlign: 'left', cursor: 'pointer',
            fontFamily: t.body,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: color,
              boxShadow: t.glow !== 'none' ? `0 0 6px ${color}` : 'none',
              justifySelf: 'center',
              animation: status !== 'normal' ? 'cocuyo-pulse 2.4s ease-in-out infinite' : 'none',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: '-0.005em' }}>{r.name}</span>
              <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: t.mono, letterSpacing: '0.04em' }}>
                {r.state}
              </span>
            </div>
            <span style={{
              fontFamily: t.mono, fontSize: 10.5, color: t.inkDim, fontVariantNumeric: 'tabular-nums',
            }}>
              {Math.round(d.score * 100)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Region detail card (right) ────────────────────────────────
function RegionDetail({ theme: t, region, data, lang }) {
  const status = window.COCUYO.statusFromScore(data.score);
  const color = window.COCUYO.statusColor(status, t);
  const statusLabel = status === 'confirmed_outage' ? window.COCUYO.tt('confirmed', lang)
                    : status === 'likely_outage' ? window.COCUYO.tt('likely', lang)
                    : status === 'at_risk' ? window.COCUYO.tt('at_risk', lang)
                    : (lang === 'es' ? 'NORMAL' : 'NORMAL');

  const typeKey = data.type === 'rationing' ? 'scheduled'
                 : data.type === 'feeder_fault' ? 'feeder'
                 : data.type === 'substation_fault' ? 'substation'
                 : data.type === 'transmission_fault' ? 'transmission'
                 : data.type === 'national_blackout' ? 'blackout'
                 : data.type === 'weather' ? 'weather_dmg'
                 : data.type === 'pending' ? 'pending'
                 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 22px 16px', borderBottom: `0.5px solid ${t.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: t.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {region.state}
          </span>
          <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: t.mono, fontVariantNumeric: 'tabular-nums' }}>
            {region.lat.toFixed(2)}° N · {Math.abs(region.lng).toFixed(2)}° W
          </span>
        </div>
        <div style={{
          fontSize: 30, fontFamily: t.display, color: t.ink, fontWeight: 500,
          letterSpacing: '-0.02em', lineHeight: 1,
        }}>
          {region.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 2,
            background: `${color}1f`, border: `0.5px solid ${color}55`,
            color: color, fontFamily: t.mono, fontSize: 10, letterSpacing: '0.1em',
            boxShadow: t.glow !== 'none' && status !== 'normal' ? `inset 0 0 12px ${color}22` : 'none',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: color,
              boxShadow: t.glow !== 'none' ? `0 0 6px ${color}` : 'none',
            }} />
            {statusLabel}
          </span>
          {typeKey && (
            <span style={{ fontSize: 11, color: t.inkDim, fontFamily: t.body }}>
              {window.COCUYO.tt(typeKey, lang)}
              {data.confidence && (
                <span style={{ color: t.inkFaint, fontFamily: t.mono, marginLeft: 8 }}>
                  {Math.round(data.confidence * 100)}% {window.COCUYO.tt('confidence', lang).toLowerCase()}
                </span>
              )}
            </span>
          )}
        </div>
        {data.note && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: t.inkFaint, fontFamily: t.mono, fontStyle: 'italic' }}>
            {data.note}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '18px 22px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Stats row */}
        {data.since && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <MiniStat theme={t}
              label={window.COCUYO.tt('started', lang)}
              value={window.COCUYO.formatTime(data.since, lang)}
              sub={(() => {
                const ago = (Date.now() - data.since.getTime()) / 60000;
                return window.COCUYO.formatDuration(ago, lang) + (lang === 'es' ? ' atrás' : ' ago');
              })()}
            />
            <MiniStat theme={t}
              label={window.COCUYO.tt('eta', lang)}
              value={data.eta_min ? `+${window.COCUYO.formatDuration(data.eta_min, lang)}` : '—'}
              sub={data.eta_min ? (lang === 'es' ? 'restantes' : 'remaining') : (lang === 'es' ? 'sin patrón' : 'no pattern')}
            />
            <MiniStat theme={t}
              label={window.COCUYO.tt('reports_30m', lang)}
              value={data.reports30}
              sub={`${data.bajones24} ${window.COCUYO.tt('bajones_24h', lang)}`}
            />
          </div>
        )}

        {/* Fingerprint + bars */}
        <div>
          <SectionLabel t={t}>{window.COCUYO.tt('signal_print', lang)}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 22, alignItems: 'center', marginTop: 10 }}>
            <Fingerprint signals={data.signals} theme={t} size={140} lang={lang} accentColor={color} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SignalBar theme={t} color={color} label={window.COCUYO.tt('signal_int', lang)}   value={data.signals.inet}
                sub={data.signals.inet > 0.5 ? (lang === 'es' ? 'CANTV + 2 ISPs caídos' : 'CANTV + 2 ISPs dropped') : (lang === 'es' ? 'tráfico normal' : 'traffic normal')} />
              <SignalBar theme={t} color={color} label={window.COCUYO.tt('signal_sat', lang)}    value={data.signals.sat}
                sub={data.signals.sat > 0.5 ? (lang === 'es' ? 'VIIRS: 40% del brillo base' : 'VIIRS: 40% baseline') : (lang === 'es' ? 'luces nominales' : 'lights nominal')} />
              <SignalBar theme={t} color={color} label={window.COCUYO.tt('signal_crowd', lang)}  value={data.signals.crowd}
                sub={`${data.reports30 || 0} ${window.COCUYO.tt('reports_30m', lang)}`} />
              <SignalBar theme={t} color={color} label={window.COCUYO.tt('signal_wx', lang)}     value={data.signals.weather}
                sub={data.signals.weather > 0.6 ? (lang === 'es' ? '36 °C · 78% humedad · pico AC' : '36°C · 78% humid · AC peak') : '—'} />
            </div>
          </div>
        </div>

        {/* Forecast curve */}
        <div>
          <SectionLabel t={t} right={<span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, letterSpacing: '0.06em' }}>{lang === 'es' ? 'PRÓXIMAS 24 H' : 'NEXT 24H'}</span>}>
            {window.COCUYO.tt('forecast24', lang)}
          </SectionLabel>
          <div style={{ marginTop: 12, padding: '4px 0 14px' }}>
            <ForecastCurve theme={t} data={window.COCUYO.FORECAST_24H} width={420} height={86} lang={lang} accentColor={color} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <DriverPill t={t} text={window.COCUYO.STRINGS.drivers.heat[lang]} />
            <DriverPill t={t} text={window.COCUYO.STRINGS.drivers.schedule[lang]} />
            <DriverPill t={t} text={window.COCUYO.STRINGS.drivers.reservoir[lang]} />
            <DriverPill t={t} text={window.COCUYO.STRINGS.drivers.history[lang]} />
          </div>
        </div>

        {/* Cross-service */}
        <div>
          <SectionLabel t={t}>{window.COCUYO.tt('cross_service', lang)}</SectionLabel>
          <div style={{ marginTop: 10 }}>
            <CrossServiceRow theme={t} lang={lang} items={[
              { label: window.COCUYO.tt('power', lang),    status: data.score > 0.5 ? 'down' : data.score > 0.25 ? 'degraded' : 'ok', detail: data.since ? window.COCUYO.formatTime(data.since, lang) : '' },
              { label: window.COCUYO.tt('water', lang),    status: data.score > 0.6 ? 'degraded' : 'ok', detail: data.score > 0.6 ? (lang === 'es' ? 'baja presión' : 'low pressure') : '' },
              { label: window.COCUYO.tt('internet', lang), status: data.signals.inet > 0.5 ? 'down' : data.signals.inet > 0.25 ? 'degraded' : 'ok', detail: data.signals.inet > 0.5 ? 'CANTV ↓' : '' },
              { label: window.COCUYO.tt('cell', lang),     status: data.signals.inet > 0.7 ? 'degraded' : 'ok', detail: data.signals.inet > 0.7 ? (lang === 'es' ? 'torre en batería' : 'tower on battery') : '' },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ t, children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{
        fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint,
        textTransform: 'uppercase', letterSpacing: '0.12em',
      }}>
        {children}
      </div>
      {right}
    </div>
  );
}

function DriverPill({ t, text }) {
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px',
      border: `0.5px solid ${t.line}`, borderRadius: 2,
      color: t.inkDim, fontFamily: t.mono, letterSpacing: '0.04em',
      background: t.panel2,
    }}>{text}</span>
  );
}

// ── Top bar: national summary ─────────────────────────────────
function NationalBar({ theme: t, regionData, lang, scenarioName, freqNow }) {
  const counts = { confirmed_outage: 0, likely_outage: 0, at_risk: 0, normal: 0 };
  for (const id in regionData) {
    const s = window.COCUYO.statusFromScore(regionData[id].score);
    counts[s]++;
  }
  const totalReports = Object.values(regionData).reduce((s, d) => s + (d.reports30 || 0), 0);
  const overall = counts.confirmed_outage > 2 ? 'national'
                : counts.confirmed_outage > 0 ? 'regional'
                : counts.likely_outage + counts.at_risk > 2 ? 'risk' : 'normal';
  const overallLabel = overall === 'national' ? (lang === 'es' ? 'EVENTO NACIONAL' : 'NATIONAL EVENT')
                     : overall === 'regional' ? (lang === 'es' ? 'CORTES REGIONALES' : 'REGIONAL OUTAGES')
                     : overall === 'risk' ? (lang === 'es' ? 'RIESGO ELEVADO' : 'ELEVATED RISK')
                     : (lang === 'es' ? 'TODO NORMAL' : 'ALL NORMAL');
  const overallColor = overall === 'national' ? t.danger : overall === 'regional' ? t.danger : overall === 'risk' ? t.warn : t.ok;
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      borderBottom: `0.5px solid ${t.lineStrong}`,
      background: t.panel,
    }}>
      {/* Brand */}
      <div style={{
        padding: '14px 22px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderRight: `0.5px solid ${t.line}`,
      }}>
        <FireflyDot color={t.accent} size={10} pulse={true} glow={t.glow !== 'none'} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: t.display, fontSize: 22, color: t.ink, fontWeight: 500,
            letterSpacing: '-0.01em',
          }}>cocuyo</span>
          <span style={{
            fontFamily: t.mono, fontSize: 8.5, color: t.inkFaint,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 3,
          }}>{window.COCUYO.tt('tagline', lang)}</span>
        </div>
      </div>

      {/* National status */}
      <div style={{
        padding: '12px 22px',
        display: 'flex', alignItems: 'center', gap: 14,
        borderRight: `0.5px solid ${t.line}`, flex: 1,
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%', background: overallColor,
          boxShadow: t.glow !== 'none' ? `0 0 10px ${overallColor}` : 'none',
          animation: overall !== 'normal' ? 'cocuyo-pulse 2.4s ease-in-out infinite' : 'none',
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
            textTransform: 'uppercase', letterSpacing: '0.14em',
          }}>{window.COCUYO.tt('national_status', lang)}</span>
          <span style={{
            fontFamily: t.display, fontSize: 18, color: overallColor, fontWeight: 500,
            letterSpacing: '-0.005em', textShadow: t.glow !== 'none' ? `0 0 12px ${overallColor}66` : 'none',
          }}>{overallLabel}</span>
        </div>
      </div>

      {/* Counts */}
      <NationalStat t={t} label={window.COCUYO.tt('confirmed', lang)} value={counts.confirmed_outage} color={t.danger} unit={window.COCUYO.tt('states_dark', lang)} />
      <NationalStat t={t} label={window.COCUYO.tt('likely', lang)}    value={counts.likely_outage}    color={t.warn} />
      <NationalStat t={t} label={window.COCUYO.tt('at_risk', lang)}   value={counts.at_risk}           color={t.risk || t.accent} />

      {/* Grid frequency */}
      <div style={{
        padding: '12px 22px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderLeft: `0.5px solid ${t.line}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
            textTransform: 'uppercase', letterSpacing: '0.14em',
          }}>{window.COCUYO.tt('grid_freq', lang)}</span>
          <span style={{
            fontFamily: t.display, fontSize: 18, color: t.ink, fontWeight: 500,
            letterSpacing: '-0.005em', fontVariantNumeric: 'tabular-nums',
          }}>
            {freqNow.toFixed(2)}<span style={{ fontSize: 11, color: t.inkFaint, marginLeft: 2, fontFamily: t.mono }}>Hz</span>
          </span>
        </div>
        <FrequencyTrace theme={t} width={140} height={36}
          bajones={[
            { t_idx: 60, span: 4, depth: 0.25 },
            { t_idx: 30, span: 5, depth: 0.45 },
            { t_idx: 10, span: 3, depth: 0.2 },
          ]} live={true} glow={t.glow !== 'none'} />
      </div>

      {/* Last updated */}
      <div style={{
        padding: '12px 22px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderLeft: `0.5px solid ${t.line}`,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: t.ok,
          boxShadow: t.glow !== 'none' ? `0 0 5px ${t.ok}` : 'none',
          animation: 'cocuyo-blink 2s ease-in-out infinite',
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
            textTransform: 'uppercase', letterSpacing: '0.14em',
          }}>{window.COCUYO.tt('last_updated', lang)}</span>
          <span style={{ fontFamily: t.mono, fontSize: 11, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
            {window.COCUYO.formatTime(new Date(), lang)}
          </span>
        </div>
      </div>
    </div>
  );
}

function NationalStat({ t, label, value, color, unit }) {
  return (
    <div style={{
      padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderRight: `0.5px solid ${t.line}`,
    }}>
      <span style={{
        fontFamily: t.display, fontSize: 28, color: color, fontWeight: 500,
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        textShadow: t.glow !== 'none' ? `0 0 10px ${color}55` : 'none',
      }}>{value}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
        <span style={{
          fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
          textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>{label}</span>
        {unit && <span style={{ fontFamily: t.mono, fontSize: 8.5, color: t.inkFaint, letterSpacing: '0.06em' }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Bottom strip: grid pulse + Guri + sources ─────────────────
function BottomStrip({ theme: t, lang, regionData }) {
  // Build a multi-region history strip showing last 7 days of any outages across the country
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '300px 1fr 220px',
      borderTop: `0.5px solid ${t.lineStrong}`, background: t.panel,
    }}>
      {/* Guri */}
      <div style={{ padding: '14px 22px', borderRight: `0.5px solid ${t.line}` }}>
        <GuriGauge theme={t} level={0.40} lang={lang} />
      </div>

      {/* Pulse: per region sparkline of past 24h scores */}
      <div style={{ padding: '14px 22px', borderRight: `0.5px solid ${t.line}` }}>
        <div style={{
          fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint,
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8,
        }}>{window.COCUYO.tt('pulse', lang)} · 24 h</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
          {window.COCUYO.REGIONS.slice(0, 7).map(r => {
            const d = regionData[r.id];
            // Synthetic sparkline based on score
            const arr = [];
            for (let i = 0; i < 24; i++) {
              arr.push(Math.max(0.02, d.score * (0.4 + 0.6 * Math.sin(i * 0.6 + r.priority))));
            }
            const color = window.COCUYO.statusColor(window.COCUYO.statusFromScore(d.score), t);
            return (
              <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Spark theme={t} data={arr} width={60} height={18} color={color} />
                <div style={{ fontFamily: t.mono, fontSize: 9, color: t.inkDim, letterSpacing: '0.04em' }}>
                  {r.name.slice(0, 7)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data sources */}
      <div style={{ padding: '14px 22px' }}>
        <div style={{
          fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint,
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8,
        }}>{window.COCUYO.tt('data_sources', lang)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontFamily: t.mono, fontSize: 10 }}>
          {[
            { name: 'IODA',       sub: 'BGP · 5m' },
            { name: 'Cloudflare', sub: 'HTTP · 10m' },
            { name: 'VIIRS',      sub: 'lights · 12h' },
            { name: 'NASA POWER', sub: 'wx · 6h' },
            { name: 'OONI',       sub: 'cens · 30m' },
            { name: 'crowdsource',sub: '~847/d' },
          ].map(s => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', color: t.ink }}>
              <span>{s.name}</span>
              <span style={{ color: t.inkFaint }}>{s.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Full Dashboard ────────────────────────────────────────────
function Dashboard({ theme: t, scenarioId, lang, accentColor }) {
  const [selectedId, setSelectedId] = useState(null);
  const [freqNow, setFreqNow] = useState(60.00);
  const regionData = useMemo(() => window.COCUYO.SCENARIOS[scenarioId].build(), [scenarioId]);

  // Auto-select most severe
  useEffect(() => {
    let best = null, max = -1;
    for (const r of window.COCUYO.REGIONS) {
      if (regionData[r.id].score > max) { max = regionData[r.id].score; best = r.id; }
    }
    setSelectedId(best);
  }, [scenarioId]);

  // Live frequency
  useEffect(() => {
    let raf;
    const tick = () => {
      const base = 60.00;
      const w = Math.sin(Date.now() / 800) * 0.04 + Math.sin(Date.now() / 200) * 0.02;
      const dip = scenarioId === 'national' ? -0.3 : scenarioId === 'active' ? -0.1 : 0;
      setFreqNow(base + w + dip);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scenarioId]);

  const selectedRegion = window.COCUYO.REGIONS.find(r => r.id === selectedId);
  const selectedData = selectedId ? regionData[selectedId] : null;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.bg, color: t.ink, fontFamily: t.body,
      display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden',
    }}>
      <NationalBar theme={t} regionData={regionData} lang={lang} scenarioName={scenarioId} freqNow={freqNow} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 460px',
        minHeight: 0, overflow: 'hidden',
      }}>
        <div style={{ borderRight: `0.5px solid ${t.line}`, overflow: 'auto', background: t.panel }}>
          <div style={{
            padding: '14px 16px 10px',
            fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            borderBottom: `0.5px solid ${t.line}`,
          }}>{window.COCUYO.tt('regions', lang)} · {window.COCUYO.REGIONS.length}</div>
          <RegionList theme={t} regions={window.COCUYO.REGIONS} regionData={regionData}
            selectedId={selectedId} onSelect={setSelectedId} lang={lang} />
        </div>

        <div style={{ position: 'relative', background: t.bg }}>
          <VenezuelaMap theme={t} regionData={regionData} selectedId={selectedId}
            onSelect={setSelectedId} lang={lang} />
        </div>

        <div style={{ borderLeft: `0.5px solid ${t.line}`, overflow: 'hidden', background: t.panel }}>
          {selectedRegion && selectedData && (
            <RegionDetail theme={t} region={selectedRegion} data={selectedData} lang={lang} />
          )}
        </div>
      </div>

      <BottomStrip theme={t} lang={lang} regionData={regionData} />
    </div>
  );
}

Object.assign(window, { Dashboard });
