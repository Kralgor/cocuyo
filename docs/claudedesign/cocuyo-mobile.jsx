// cocuyo-mobile.jsx — Mobile screens for Cocuyo
// Five screens: ZoneDetail (active outage), Forecast, BajonesReporter, History, Methodology
// All sized for 390x844 (inside IOSDevice from ios-frame.jsx).

const { useState: useStateM, useEffect: useEffectM, useMemo: useMemoM } = React;

// ── Mobile shell (status bar, top nav, bottom tab bar) ───────
function MobileShell({ theme: t, lang, title, subtitle, children, active = 'zone', noTabBar = false, accent }) {
  const dark = t.name !== 'civic';
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.bg, color: t.ink, fontFamily: t.body,
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Status bar */}
      <IOSStatusBar dark={dark} time="2:47" />
      {/* Title bar */}
      {title && (
        <div style={{
          padding: '0 22px 14px',
          borderBottom: `0.5px solid ${t.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
              textTransform: 'uppercase', letterSpacing: '0.18em',
            }}>{subtitle}</span>
            <span style={{
              fontFamily: t.display, fontSize: 26, color: t.ink, fontWeight: 500,
              letterSpacing: '-0.02em', lineHeight: 1.05,
            }}>{title}</span>
          </div>
          <FireflyDot color={accent || t.accent} size={10} pulse={true} glow={t.glow !== 'none'} />
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {children}
      </div>
      {!noTabBar && <MobileTabBar t={t} lang={lang} active={active} />}
      {/* home indicator */}
      <div style={{ height: 34, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 8, background: t.bg }}>
        <div style={{ width: 134, height: 5, borderRadius: 99, background: t.ink, opacity: 0.4 }} />
      </div>
    </div>
  );
}

function MobileTabBar({ t, lang, active }) {
  const items = [
    { id: 'zone',    label: window.COCUYO.tt('nav_zone', lang),    icon: 'zone' },
    { id: 'map',     label: window.COCUYO.tt('nav_map', lang),     icon: 'map' },
    { id: 'forecast',label: window.COCUYO.tt('forecast', lang),    icon: 'forecast' },
    { id: 'bajones', label: window.COCUYO.tt('nav_bajones', lang), icon: 'wave' },
    { id: 'history', label: window.COCUYO.tt('nav_history', lang), icon: 'hist' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      borderTop: `0.5px solid ${t.line}`, background: t.panel,
      padding: '8px 4px 4px',
    }}>
      {items.map(it => (
        <div key={it.id} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          color: it.id === active ? t.accent : t.inkFaint,
          padding: '4px 0',
        }}>
          <TabIcon name={it.icon} color="currentColor" />
          <span style={{
            fontFamily: t.mono, fontSize: 8.5, letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textShadow: t.glow !== 'none' && it.id === active ? `0 0 6px ${t.accent}` : 'none',
          }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function TabIcon({ name, color = 'currentColor' }) {
  const s = 18;
  if (name === 'zone') return (
    <svg width={s} height={s} viewBox="0 0 18 18"><circle cx="9" cy="9" r="2.5" fill={color}/><circle cx="9" cy="9" r="6" stroke={color} strokeWidth="1" fill="none"/></svg>
  );
  if (name === 'map') return (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2"><path d="M2 5l5-2 4 2 5-2v12l-5 2-4-2-5 2z"/><path d="M7 3v12M11 5v12"/></svg>
  );
  if (name === 'forecast') return (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2"><path d="M2 13l4-5 3 3 5-7 2 2"/></svg>
  );
  if (name === 'wave') return (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2"><path d="M2 9 C 4 9, 4 4, 6 4 S 8 14, 10 14 S 12 4, 14 9 L 16 9"/></svg>
  );
  if (name === 'hist') return (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2"><rect x="3" y="4" width="2.5" height="10"/><rect x="7.75" y="7" width="2.5" height="7"/><rect x="12.5" y="2" width="2.5" height="12"/></svg>
  );
  return null;
}

// ── SCREEN 1: Zone Detail (active outage) ─────────────────────
function ScreenZoneDetail({ theme: t, lang, scenarioId, accent }) {
  const regionData = useMemoM(() => window.COCUYO.SCENARIOS[scenarioId].build(), [scenarioId]);
  const zone = window.COCUYO.FOCUS_ZONE;
  // For scenarios 'normal' and 'at_risk', synthesize a non-outage state in Caracas/El Paraíso.
  // For 'active' and 'national', the zone is out.
  const isOut = scenarioId === 'active' || scenarioId === 'national';
  const data = isOut
    ? {
        score: scenarioId === 'national' ? 0.85 : 0.78,
        prediction: 0.92,
        signals: { inet: 0.42, sat: 0.22, crowd: 0.88, weather: 0.46 },
        since: new Date(Date.now() - 1000 * 60 * 137),
        type: scenarioId === 'national' ? 'transmission' : 'rationing',
        confidence: scenarioId === 'national' ? 0.84 : 0.92,
        eta_min: scenarioId === 'national' ? 240 : 38,
      }
    : (scenarioId === 'at_risk'
      ? { score: 0.22, prediction: 0.51, signals: { inet: 0.08, sat: 0, crowd: 0.12, weather: 0.68 }, since: null, type: null }
      : { score: 0.06, prediction: 0.18, signals: { inet: 0.05, sat: 0, crowd: 0.0, weather: 0.20 }, since: null, type: null });

  const status = window.COCUYO.statusFromScore(data.score);
  const color = window.COCUYO.statusColor(status, t);
  const statusLabel = status === 'confirmed_outage' ? window.COCUYO.tt('confirmed', lang)
                    : status === 'likely_outage' ? window.COCUYO.tt('likely', lang)
                    : status === 'at_risk' ? window.COCUYO.tt('at_risk', lang)
                    : (lang === 'es' ? 'CON LUZ' : 'POWERED');

  const elapsedMin = data.since ? (Date.now() - data.since.getTime()) / 60000 : 0;

  return (
    <MobileShell theme={t} lang={lang}
      subtitle={`${zone.city.toUpperCase()} · ${zone.state.toUpperCase()}`}
      title={zone.name} active="zone" accent={accent}>
      <div style={{ padding: '18px 22px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Hero status card */}
        <div style={{
          padding: '18px 18px 20px', position: 'relative', overflow: 'hidden',
          background: t.panel,
          border: `0.5px solid ${t.line}`,
          borderLeft: `2px solid ${color}`,
          borderRadius: 6,
          boxShadow: t.glow !== 'none' && isOut ? `inset 0 0 40px ${color}1a` : 'none',
        }}>
          {/* faint signal-fingerprint bg */}
          {isOut && (
            <div style={{ position: 'absolute', right: -30, top: -30, opacity: 0.18, pointerEvents: 'none' }}>
              <Fingerprint signals={data.signals} theme={t} size={140} glow={false} accentColor={color} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{
              padding: '4px 9px', background: `${color}22`, color, fontFamily: t.mono,
              fontSize: 10, letterSpacing: '0.14em', borderRadius: 2,
              border: `0.5px solid ${color}55`,
            }}>{statusLabel}</span>
            {data.confidence && (
              <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, letterSpacing: '0.04em' }}>
                {Math.round(data.confidence * 100)}% {window.COCUYO.tt('confidence', lang).toLowerCase()}
              </span>
            )}
          </div>
          {isOut ? (
            <>
              <div style={{
                fontFamily: t.display, fontSize: 22, color: t.ink, fontWeight: 500,
                lineHeight: 1.1, letterSpacing: '-0.01em', marginBottom: 6,
              }}>
                {data.type === 'rationing' ? window.COCUYO.tt('scheduled', lang)
                  : data.type === 'transmission' ? window.COCUYO.tt('transmission', lang)
                  : window.COCUYO.tt('feeder', lang)}
              </div>
              <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 18 }}>
                {data.type === 'rationing' ? (lang === 'es'
                  ? 'Esta zona pierde luz martes y jueves a esta hora. 87% coincidencia.'
                  : 'This zone loses power Tue/Thu at this time. 87% match.')
                  : data.type === 'transmission' ? (lang === 'es'
                  ? 'Falla de transmisión afectando 8 estados.'
                  : 'Transmission fault affecting 8 states.')
                  : (lang === 'es' ? 'Reportes sugieren falla local.' : 'Reports suggest local fault.')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <MiniStat theme={t} label={window.COCUYO.tt('elapsed', lang)}
                  value={Math.floor(elapsedMin / 60) > 0 ? Math.floor(elapsedMin / 60) : Math.round(elapsedMin)}
                  unit={Math.floor(elapsedMin / 60) > 0 ? 'h' : 'min'}
                  sub={Math.floor(elapsedMin / 60) > 0 ? `${Math.round(elapsedMin % 60)} min` : (lang === 'es' ? 'recién' : 'just now')} />
                <MiniStat theme={t} label={window.COCUYO.tt('eta', lang)}
                  value={data.eta_min ? (data.eta_min >= 60 ? `+${Math.floor(data.eta_min / 60)}` : `+${data.eta_min}`) : '—'}
                  unit={data.eta_min ? (data.eta_min >= 60 ? 'h' : 'min') : ''}
                  sub={data.eta_min ? (data.eta_min >= 60 ? `${data.eta_min % 60} min` : (lang === 'es' ? 'restantes' : 'remaining')) : (lang === 'es' ? 'sin patrón' : 'no pattern')} />
                <MiniStat theme={t} label={window.COCUYO.tt('confidence', lang)}
                  value={Math.round((data.confidence || 0) * 100)} unit="%"
                  sub={lang === 'es' ? 'cruce de señales' : 'cross-signal'} />
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontFamily: t.display, fontSize: 22, color: t.ink, fontWeight: 500,
                lineHeight: 1.1, letterSpacing: '-0.01em', marginBottom: 4,
              }}>
                {lang === 'es' ? 'Sin cortes activos' : 'No active outage'}
              </div>
              <div style={{ fontSize: 12, color: t.inkDim }}>
                {scenarioId === 'at_risk'
                  ? (lang === 'es' ? 'Riesgo elevado para esta tarde por calor + bloque histórico.' : 'Elevated risk this afternoon: heat + historical block.')
                  : (lang === 'es' ? 'Todo en orden. Próxima ventana de riesgo: mañana 14:00.' : 'All clear. Next risk window: tomorrow 2pm.')}
              </div>
            </>
          )}
        </div>

        {/* Cross-service */}
        <div>
          <SectionLabel t={t}>{window.COCUYO.tt('cross_service', lang)}</SectionLabel>
          <div style={{ marginTop: 10 }}>
            <CrossServiceRow theme={t} lang={lang} items={[
              { label: window.COCUYO.tt('power', lang),    status: isOut ? 'down' : (data.score > 0.2 ? 'pending' : 'ok'), detail: isOut ? window.COCUYO.formatTime(data.since, lang) : '' },
              { label: window.COCUYO.tt('water', lang),    status: isOut && elapsedMin > 90 ? 'degraded' : 'ok', detail: isOut && elapsedMin > 90 ? (lang === 'es' ? 'baja' : 'low') : '' },
              { label: window.COCUYO.tt('internet', lang), status: data.signals.inet > 0.5 ? 'down' : data.signals.inet > 0.25 ? 'degraded' : 'ok', detail: data.signals.inet > 0.25 ? 'CANTV ↓' : '' },
              { label: window.COCUYO.tt('cell', lang),     status: 'ok', detail: 'Digitel 4G' },
            ]} />
          </div>
        </div>

        {/* Signal fingerprint */}
        <div>
          <SectionLabel t={t} right={
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, letterSpacing: '0.06em' }}>
              {[data.signals.inet, data.signals.sat, data.signals.crowd, data.signals.weather].filter(v => v > 0.5).length}/4 {window.COCUYO.tt('signals_agree', lang).toUpperCase()}
            </span>
          }>{window.COCUYO.tt('signal_print', lang)}</SectionLabel>
          <div style={{
            marginTop: 12, padding: '14px 14px 16px',
            background: t.panel, border: `0.5px solid ${t.line}`, borderRadius: 6,
            display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'center',
          }}>
            <Fingerprint signals={data.signals} theme={t} size={120} lang={lang} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <SignalBar theme={t} label={window.COCUYO.tt('signal_int', lang)}   value={data.signals.inet}   color={data.signals.inet > 0.5 ? t.danger : t.accent} />
              <SignalBar theme={t} label={window.COCUYO.tt('signal_sat', lang)}    value={data.signals.sat}    color={data.signals.sat > 0.5 ? t.danger : t.accent} />
              <SignalBar theme={t} label={window.COCUYO.tt('signal_crowd', lang)}  value={data.signals.crowd}  color={data.signals.crowd > 0.5 ? t.danger : t.accent} />
              <SignalBar theme={t} label={window.COCUYO.tt('signal_wx', lang)}     value={data.signals.weather} color={data.signals.weather > 0.5 ? t.warn : t.accent} />
            </div>
          </div>
        </div>

        {/* Forecast curve */}
        <div>
          <SectionLabel t={t}>{window.COCUYO.tt('forecast24', lang)}</SectionLabel>
          <div style={{
            marginTop: 12, padding: '14px 14px 22px',
            background: t.panel, border: `0.5px solid ${t.line}`, borderRadius: 6,
          }}>
            <ForecastCurve theme={t} data={window.COCUYO.FORECAST_24H} width={304} height={84} lang={lang} />
          </div>
        </div>

        {/* Feeder identity */}
        <div style={{
          padding: '12px 14px', background: t.panel2, border: `0.5px dashed ${t.line}`,
          borderRadius: 4, fontFamily: t.mono, fontSize: 10, color: t.inkDim,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <span style={{ flex: 1, lineHeight: 1.5 }}>
            <span style={{ color: t.inkFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{window.COCUYO.tt('feeder_circuit', lang)}</span><br/>
            {zone.feeder}
          </span>
          <span style={{ textAlign: 'right' }}>
            <span style={{ color: t.inkFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{window.COCUYO.tt('homes', lang)}</span><br/>
            <span style={{ color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{zone.homes.toLocaleString()}</span>
          </span>
        </div>

        {/* Report CTA */}
        <ReportButtons t={t} lang={lang} accent={accent} />
      </div>
    </MobileShell>
  );
}

function ReportButtons({ t, lang, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        padding: '14px 16px', border: `0.5px solid ${accent || t.accent}`, borderRadius: 6,
        background: `${accent || t.accent}1a`,
        color: t.ink, fontFamily: t.body, fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
        boxShadow: t.glow !== 'none' ? `inset 0 0 18px ${(accent || t.accent)}33, 0 0 16px ${(accent || t.accent)}22` : 'none',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M3 13l2-2M11 5l2-2"/>
        </svg>
        {window.COCUYO.tt('report_no_pwr', lang)}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button style={{
          padding: '12px 12px', border: `0.5px solid ${t.line}`, borderRadius: 6,
          background: t.panel, color: t.inkDim,
          fontFamily: t.body, fontSize: 12, cursor: 'pointer',
        }}>{window.COCUYO.tt('report_back', lang)}</button>
        <button style={{
          padding: '12px 12px', border: `0.5px solid ${t.line}`, borderRadius: 6,
          background: t.panel, color: t.inkDim,
          fontFamily: t.body, fontSize: 12, cursor: 'pointer',
        }}>{window.COCUYO.tt('report_unst', lang)}</button>
      </div>
    </div>
  );
}

// ── SCREEN 2: Forecast (24h drill-down) ──────────────────────
function ScreenForecast({ theme: t, lang, scenarioId, accent }) {
  const data = window.COCUYO.FORECAST_24H;
  // Build per-hour buckets aggregating two half-hour slots
  const hourly = [];
  for (let i = 0; i < 24; i++) hourly.push(Math.max(data[i*2], data[i*2+1]));
  const now = new Date();

  return (
    <MobileShell theme={t} lang={lang}
      subtitle={lang === 'es' ? 'EL PARAÍSO · CARACAS' : 'EL PARAÍSO · CARACAS'}
      title={window.COCUYO.tt('forecast', lang)} active="forecast" accent={accent}>
      <div style={{ padding: '18px 22px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Risk summary */}
        <div style={{
          padding: '16px 18px', background: t.panel, border: `0.5px solid ${t.line}`,
          borderRadius: 6, position: 'relative', overflow: 'hidden',
        }}>
          {/* Peak indicator */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: t.display, fontSize: 38, color: t.warn, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, textShadow: t.glow !== 'none' ? `0 0 16px ${t.warn}55` : 'none' }}>62%</span>
            <span style={{ fontSize: 11, color: t.inkDim }}>
              {lang === 'es' ? 'pico previsto · 15:30' : 'predicted peak · 3:30 PM'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: t.inkDim, lineHeight: 1.45 }}>
            {lang === 'es'
              ? 'Calor (36 °C), bloque histórico de racionamiento martes/jueves 14–17h y embalse Guri al 40% elevan el riesgo de corte esta tarde.'
              : 'Heat (36°C), historical Tue/Thu 2–5pm rationing block, and Guri reservoir at 40% raise outage risk this afternoon.'}
          </div>
        </div>

        {/* Hour-by-hour vertical bars */}
        <div>
          <SectionLabel t={t} right={
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, letterSpacing: '0.06em' }}>
              {lang === 'es' ? 'PROB. POR HORA' : 'HOURLY PROB.'}
            </span>
          }>{window.COCUYO.tt('forecast24', lang)}</SectionLabel>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', gap: 3, height: 130, position: 'relative' }}>
            {/* threshold line */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: 1, background: t.danger, opacity: 0.25 }} />
            {hourly.map((v, i) => {
              const h = (now.getHours() + i) % 24;
              const color = v > 0.55 ? t.danger : v > 0.35 ? t.warn : v > 0.20 ? (t.risk || t.accent) : t.inkFaint;
              const opacity = v > 0.55 ? 1 : v > 0.35 ? 0.85 : v > 0.20 ? 0.7 : 0.4;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', height: `${Math.max(v * 100, 8)}%`,
                    background: color, borderRadius: 1, opacity,
                    boxShadow: t.glow !== 'none' && v > 0.3 ? `0 0 6px ${color}` : 'none',
                  }} />
                  {i % 4 === 0 && (
                    <span style={{ fontFamily: t.mono, fontSize: 8, color: t.inkFaint, letterSpacing: '0.04em' }}>
                      {String(h).padStart(2, '0')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Why */}
        <div>
          <SectionLabel t={t}>{window.COCUYO.tt('why_forecast', lang)}</SectionLabel>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DriverRow t={t} lang={lang} icon="heat"     name={window.COCUYO.STRINGS.drivers.heat[lang]}     value="36 °C · 78%"  weight={0.32} />
            <DriverRow t={t} lang={lang} icon="schedule" name={window.COCUYO.STRINGS.drivers.schedule[lang]} value={lang === 'es' ? 'martes 14–17h' : 'Tue 2–5pm'} weight={0.28} />
            <DriverRow t={t} lang={lang} icon="hist"     name={window.COCUYO.STRINGS.drivers.history[lang]}  value={lang === 'es' ? '8 cortes / 30 d' : '8 outages / 30 d'} weight={0.22} />
            <DriverRow t={t} lang={lang} icon="resv"     name={window.COCUYO.STRINGS.drivers.reservoir[lang]} value="Guri 40%"      weight={0.12} />
            <DriverRow t={t} lang={lang} icon="adj"      name={window.COCUYO.STRINGS.drivers.adjacent[lang]}  value={lang === 'es' ? 'Zulia, Táchira out' : 'Zulia, Táchira out'} weight={0.06} />
          </div>
        </div>

        <div style={{
          fontFamily: t.mono, fontSize: 10, color: t.inkFaint, lineHeight: 1.5,
          padding: '12px 14px', background: t.panel2, border: `0.5px dashed ${t.line}`, borderRadius: 4,
        }}>
          {lang === 'es'
            ? '↳ Pronóstico actualizado cada 10 min con datos de IODA, Cloudflare, VIIRS y NASA POWER.'
            : '↳ Forecast updated every 10 min from IODA, Cloudflare, VIIRS and NASA POWER.'}
        </div>
      </div>
    </MobileShell>
  );
}

function DriverRow({ t, lang, icon, name, value, weight }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '22px 1fr auto 70px', gap: 10,
      alignItems: 'center', padding: '10px 12px',
      background: t.panel, border: `0.5px solid ${t.line}`, borderRadius: 4,
    }}>
      <DriverIcon name={icon} color={t.accent} />
      <span style={{ fontSize: 12, color: t.ink }}>{name}</span>
      <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkDim, letterSpacing: '0.02em' }}>{value}</span>
      <div style={{ position: 'relative', height: 4, background: t.panel2, borderRadius: 2 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${weight * 100}%`, background: t.accent, borderRadius: 2,
          boxShadow: t.glow !== 'none' ? `0 0 4px ${t.accent}` : 'none',
        }} />
      </div>
    </div>
  );
}

function DriverIcon({ name, color }) {
  if (name === 'heat') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.2">
      <circle cx="7" cy="7" r="2.5"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.5 2.5l1.5 1.5M10 10l1.5 1.5M2.5 11.5l1.5-1.5M10 4l1.5-1.5"/>
    </svg>
  );
  if (name === 'schedule') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.2">
      <circle cx="7" cy="7" r="5.5"/><path d="M7 4v3l2 1.5"/>
    </svg>
  );
  if (name === 'hist') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.2">
      <rect x="2" y="3" width="2" height="8"/><rect x="6" y="6" width="2" height="5"/><rect x="10" y="1" width="2" height="10"/>
    </svg>
  );
  if (name === 'resv') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.2">
      <path d="M2 11 V 4 C 5 6, 9 2, 12 4 V 11 Z" fill={color} fillOpacity="0.3"/>
    </svg>
  );
  if (name === 'adj') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.2">
      <circle cx="4" cy="7" r="2"/><circle cx="10" cy="7" r="2"/><path d="M6 7h2"/>
    </svg>
  );
  return null;
}

// ── SCREEN 3: Bajones (voltage quality) ──────────────────────
function ScreenBajones({ theme: t, lang, scenarioId, accent }) {
  const items = window.COCUYO.BAJONES_24H;
  // Map to live trace events (newer items appear later in the trace).
  const traceEvents = items.slice(0, 8).map((b, i) => ({
    t_idx: 240 - Math.round(b.t / 6),
    span: Math.max(3, b.dur),
    depth: Math.min(b.mag * 0.7, 1.0),
  }));
  const [freqNow, setFreqNow] = useStateM(60.00);
  useEffectM(() => {
    let raf;
    const tick = () => {
      const w = Math.sin(Date.now() / 800) * 0.06 + Math.sin(Date.now() / 200) * 0.03;
      setFreqNow(60.00 + w);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const severityCount = { mild: 0, medium: 0, severe: 0 };
  for (const b of items) severityCount[b.sev]++;

  return (
    <MobileShell theme={t} lang={lang}
      subtitle={window.COCUYO.tt('bajones_sub', lang).toUpperCase()}
      title={window.COCUYO.tt('bajones_title', lang)} active="bajones" accent={accent}>
      <div style={{ padding: '18px 22px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Live frequency display */}
        <div style={{
          padding: '18px 18px 20px', background: t.panel,
          border: `0.5px solid ${t.line}`, borderRadius: 6, position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
                {window.COCUYO.tt('hz_now', lang).toUpperCase()}
              </div>
              <div style={{
                fontFamily: t.display, fontSize: 44, color: t.ink, fontWeight: 500,
                letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                textShadow: t.glow !== 'none' ? `0 0 16px ${t.accent}33` : 'none',
              }}>
                {freqNow.toFixed(2)}<span style={{ fontSize: 16, color: t.inkFaint, marginLeft: 4, fontFamily: t.mono }}>Hz</span>
              </div>
              <div style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint, marginTop: 4, letterSpacing: '0.04em' }}>
                {window.COCUYO.tt('hz_nominal', lang)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{
                padding: '3px 8px', background: `${t.warn}22`, color: t.warn,
                fontFamily: t.mono, fontSize: 10, letterSpacing: '0.1em',
                border: `0.5px solid ${t.warn}55`, borderRadius: 2,
              }}>{lang === 'es' ? 'INESTABLE' : 'UNSTABLE'}</span>
              <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint, marginTop: 6 }}>
                {items.length} {lang === 'es' ? 'bajones · 24 h' : 'dips · 24h'}
              </span>
            </div>
          </div>
          <FrequencyTrace theme={t} width={304} height={70} bajones={traceEvents} live={true} glow={t.glow !== 'none'} />
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6,
            fontFamily: t.mono, fontSize: 8.5, color: t.inkFaint, letterSpacing: '0.04em',
          }}>
            <span>—10 min</span><span>—5 min</span><span style={{ color: t.accent }}>{lang === 'es' ? 'ahora' : 'now'}</span>
          </div>
        </div>

        {/* Severity stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: lang === 'es' ? 'leves' : 'mild',    n: severityCount.mild,   c: t.risk || t.accent },
            { label: lang === 'es' ? 'medios' : 'medium', n: severityCount.medium, c: t.warn },
            { label: lang === 'es' ? 'graves' : 'severe', n: severityCount.severe, c: t.danger },
          ].map(s => (
            <div key={s.label} style={{
              padding: '12px 12px', background: t.panel, border: `0.5px solid ${t.line}`, borderRadius: 4,
              borderTop: `2px solid ${s.c}`,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{
                fontFamily: t.display, fontSize: 24, color: t.ink, fontWeight: 500,
                letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>{s.n}</span>
              <span style={{
                fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Timeline of events */}
        <div>
          <SectionLabel t={t}>{lang === 'es' ? 'Eventos · últimas 24 h' : 'Events · last 24h'}</SectionLabel>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.slice(0, 6).map((b, i) => {
              const c = b.sev === 'severe' ? t.danger : b.sev === 'medium' ? t.warn : (t.risk || t.accent);
              const hAgo = b.t / 60;
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '70px 1fr 70px', gap: 10,
                  alignItems: 'center', padding: '8px 12px',
                  background: t.panel, border: `0.5px solid ${t.line}`, borderRadius: 4,
                  borderLeft: `2px solid ${c}`,
                }}>
                  <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkDim, fontVariantNumeric: 'tabular-nums' }}>
                    {hAgo < 1 ? `${b.t} min` : `${hAgo.toFixed(1)} h`}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontFamily: t.mono, fontSize: 11, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
                      −{b.mag.toFixed(2)} Hz
                    </span>
                    <span style={{ fontSize: 9.5, color: t.inkFaint }}>
                      {b.dur.toFixed(1)}s · {b.sev === 'severe' ? (lang === 'es' ? 'desconectar electrodomésticos' : 'unplug appliances') : b.sev === 'medium' ? (lang === 'es' ? 'precaución' : 'caution') : (lang === 'es' ? 'leve' : 'mild')}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: t.mono, fontSize: 9, color: c, letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'right',
                  }}>{b.sev}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Report */}
        <button style={{
          padding: '14px 16px', border: `0.5px solid ${(accent || t.accent)}`, borderRadius: 6,
          background: `${(accent || t.accent)}1a`, color: t.ink,
          fontFamily: t.body, fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em',
          cursor: 'pointer',
          boxShadow: t.glow !== 'none' ? `inset 0 0 18px ${(accent || t.accent)}33` : 'none',
        }}>
          {lang === 'es' ? 'Reportar bajón / inestabilidad' : 'Report dip / instability'}
        </button>
      </div>
    </MobileShell>
  );
}

// ── SCREEN 4: Outage History ─────────────────────────────────
function ScreenHistory({ theme: t, lang, scenarioId, accent }) {
  const days = window.COCUYO.HIST_30D;
  let total = 0, longest = 0, count = 0, ration = 0;
  for (const d of days) {
    for (const o of d.outages) {
      total += o.dur; count++;
      if (o.dur > longest) longest = o.dur;
      if (d.date.getDay() === 2 || d.date.getDay() === 4) ration++;
    }
  }
  const avg = count > 0 ? total / count : 0;

  return (
    <MobileShell theme={t} lang={lang}
      subtitle={lang === 'es' ? 'EL PARAÍSO · ÚLTIMOS 30 DÍAS' : 'EL PARAÍSO · LAST 30 DAYS'}
      title={window.COCUYO.tt('history', lang)} active="history" accent={accent}>
      <div style={{ padding: '18px 22px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Big numbers */}
        <div style={{
          padding: '18px 18px', background: t.panel, border: `0.5px solid ${t.line}`, borderRadius: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: t.display, fontSize: 48, color: t.accent, fontWeight: 500,
              letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              textShadow: t.glow !== 'none' ? `0 0 18px ${t.accent}66` : 'none',
            }}>{total.toFixed(0)}</span>
            <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkDim, letterSpacing: '0.06em' }}>
              {window.COCUYO.tt('total_hours', lang).toLowerCase()} · 30d
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: t.inkDim }}>
            {lang === 'es'
              ? `${count} cortes · promedio ${avg.toFixed(1)}h cada uno`
              : `${count} outages · avg ${avg.toFixed(1)}h each`}
          </div>
        </div>

        {/* 30-day strip */}
        <div>
          <SectionLabel t={t} right={
            <span style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, letterSpacing: '0.06em' }}>
              {lang === 'es' ? 'COL = DÍA, FILA = HORA' : 'COL = DAY, ROW = HOUR'}
            </span>
          }>{window.COCUYO.tt('history_30d', lang)}</SectionLabel>
          <div style={{
            marginTop: 14, padding: '12px 4px',
            background: t.panel, border: `0.5px solid ${t.line}`, borderRadius: 6,
          }}>
            <HistoryStrip theme={t} days={days} width={304} height={120} lang={lang} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile t={t} label={window.COCUYO.tt('avg_duration', lang)} value={avg.toFixed(1)} unit="h" />
          <StatTile t={t} label={window.COCUYO.tt('longest', lang)} value={longest.toFixed(1)} unit="h" />
          <StatTile t={t} label={lang === 'es' ? 'cortes / semana' : 'outages / week'} value={(count / 4.3).toFixed(1)} unit="" />
          <StatTile t={t} label={lang === 'es' ? 'racionamientos detectados' : 'rationing detected'} value={ration} unit="" />
        </div>

        {/* Pattern callout */}
        <div style={{
          padding: '14px 16px', background: `${t.accent}10`,
          border: `0.5px solid ${t.accent}55`, borderRadius: 6,
          boxShadow: t.glow !== 'none' ? `inset 0 0 24px ${t.accent}11` : 'none',
        }}>
          <div style={{
            fontFamily: t.mono, fontSize: 9, color: t.accent,
            textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 6,
          }}>↳ {window.COCUYO.tt('pattern', lang)}</div>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.4 }}>
            {window.COCUYO.tt('pattern_text', lang)}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip t={t}>{lang === 'es' ? 'Martes · 87%' : 'Tue · 87%'}</Chip>
            <Chip t={t}>{lang === 'es' ? 'Jueves · 82%' : 'Thu · 82%'}</Chip>
            <Chip t={t}>{lang === 'es' ? '14:00 ±25 min' : '2:00 PM ±25 min'}</Chip>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function StatTile({ t, label, value, unit }) {
  return (
    <div style={{
      padding: '14px 14px', background: t.panel,
      border: `0.5px solid ${t.line}`, borderRadius: 6,
    }}>
      <div style={{
        fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: t.display, fontSize: 28, color: t.ink, fontWeight: 500,
          letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        }}>{value}</span>
        {unit && <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint }}>{unit}</span>}
      </div>
    </div>
  );
}

function Chip({ t, children }) {
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px',
      border: `0.5px solid ${t.line}`, borderRadius: 99,
      color: t.inkDim, fontFamily: t.mono, letterSpacing: '0.04em',
      background: t.panel,
    }}>{children}</span>
  );
}

// SectionLabel local to mobile so we don't depend on dashboard file load order.
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

Object.assign(window, {
  ScreenZoneDetail, ScreenForecast, ScreenBajones, ScreenHistory,
  MobileShell, MobileTabBar, ReportButtons,
});
