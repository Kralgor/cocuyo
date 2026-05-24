// cocuyo-methodology.jsx — How it works: pipeline diagram
// Lives inside a browser window in the design canvas.

function ScreenMethodology({ theme: t, lang, accent }) {
  const sources = [
    { id: 'ioda',  name: 'IODA',        sub: lang === 'es' ? 'BGP por ASN'        : 'BGP per ASN',         lat: '5 min',  axis: 'inet',  weight: 0.35 },
    { id: 'cf',    name: 'Cloudflare',  sub: lang === 'es' ? 'tráfico HTTP'       : 'HTTP traffic',        lat: '10 min', axis: 'inet',  weight: 0.0  },
    { id: 'ooni',  name: 'OONI',        sub: lang === 'es' ? 'censura vs corte'   : 'censorship vs outage',lat: '30 min', axis: 'inet',  weight: 0.0  },
    { id: 'viirs', name: 'VIIRS',       sub: lang === 'es' ? 'luces nocturnas'    : 'nighttime lights',    lat: '12 h',   axis: 'sat',   weight: 0.20 },
    { id: 'power', name: 'NASA POWER',  sub: lang === 'es' ? 'temp · humedad'     : 'temp · humidity',     lat: '6 h',    axis: 'wx',    weight: 0.15 },
    { id: 'corp',  name: 'Corpoelec',   sub: lang === 'es' ? 'anuncios oficiales' : 'official statements', lat: '~daily', axis: 'wx',    weight: 0.0  },
    { id: 'crowd', name: 'Crowdsource', sub: lang === 'es' ? 'usuarios validados' : 'validated users',     lat: 'real-time', axis: 'crowd', weight: 0.30 },
  ];

  const types = [
    { id: 'rationing',    name: window.COCUYO.tt('scheduled', lang),    sig: 'Z·1 R·1 ↻Y'    },
    { id: 'feeder',       name: window.COCUYO.tt('feeder', lang),       sig: 'Z·1 ⚡ explosion' },
    { id: 'substation',   name: window.COCUYO.tt('substation', lang),   sig: 'Z·3-10 R·1'    },
    { id: 'transmission', name: window.COCUYO.tt('transmission', lang), sig: 'R·2-5'         },
    { id: 'blackout',     name: window.COCUYO.tt('blackout', lang),     sig: 'R·5+ INST'     },
    { id: 'weather',      name: window.COCUYO.tt('weather_dmg', lang),  sig: '🌩 ⚡ wind'    },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: t.bg, color: t.ink, fontFamily: t.body,
      display: 'flex', flexDirection: 'column', overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '32px 44px 28px', borderBottom: `0.5px solid ${t.line}`,
        background: t.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40,
      }}>
        <div style={{ maxWidth: 520 }}>
          <div style={{ fontFamily: t.mono, fontSize: 10, color: t.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10, textShadow: t.glow !== 'none' ? `0 0 8px ${t.accent}` : 'none' }}>
            cocuyo · {window.COCUYO.tt('methodology', lang)}
          </div>
          <h1 style={{
            fontFamily: t.display, fontSize: 44, color: t.ink, fontWeight: 500,
            letterSpacing: '-0.025em', lineHeight: 1.05, margin: '0 0 14px',
          }}>
            {lang === 'es'
              ? 'Siete fuentes públicas. Cero cooperación de Corpoelec.'
              : 'Seven public sources. Zero cooperation from Corpoelec.'}
          </h1>
          <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55, margin: 0 }}>
            {lang === 'es'
              ? 'El gobierno no publica datos de cortes. Cocuyo los infiere combinando satélites de la NASA, monitoreo de internet, clima y reportes ciudadanos validados. Ninguna fuente sola es suficiente; juntas son robustas.'
              : 'The government does not publish outage data. Cocuyo infers it by combining NASA satellites, internet monitoring, weather, and validated citizen reports. No single source is enough; together they are robust.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          <BigStat t={t} value="7" label={lang === 'es' ? 'fuentes' : 'sources'} />
          <BigStat t={t} value="14" label={lang === 'es' ? 'regiones' : 'regions'} />
          <BigStat t={t} value="6" label={lang === 'es' ? 'tipos de corte' : 'outage types'} />
          <BigStat t={t} value="<1min" label={lang === 'es' ? 'latencia' : 'latency'} mono />
        </div>
      </div>

      {/* Pipeline */}
      <div style={{ padding: '36px 44px 0', position: 'relative' }}>
        <SectionLabelM t={t}>
          {lang === 'es' ? 'Tubería de datos' : 'Data pipeline'}
        </SectionLabelM>

        <div style={{
          marginTop: 24, display: 'grid',
          gridTemplateColumns: '280px 1fr 280px',
          alignItems: 'stretch', gap: 0, position: 'relative',
        }}>
          {/* Sources column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ColLabel t={t}>{lang === 'es' ? '1 · ENTRADA' : '1 · INPUT'}</ColLabel>
            {sources.map(s => <SourceTile key={s.id} t={t} src={s} accent={accent} />)}
          </div>

          {/* Central scoring engine */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 30px', position: 'relative' }}>
            {/* connector lines */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.5 }}>
              <defs>
                <linearGradient id="conn-l" x1="0" x2="1">
                  <stop offset="0%" stopColor={t.line} />
                  <stop offset="100%" stopColor={t.accent} stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id="conn-r" x1="0" x2="1">
                  <stop offset="0%" stopColor={t.accent} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={t.line} />
                </linearGradient>
              </defs>
              {[0.15, 0.30, 0.45, 0.60, 0.75, 0.85].map(y => (
                <path key={'l-'+y} d={`M 0 ${y * 100}% Q 35% ${y * 100}%, 50% 50%`} stroke="url(#conn-l)" strokeWidth="0.5" fill="none" />
              ))}
              {[0.3, 0.5, 0.7].map(y => (
                <path key={'r-'+y} d={`M 50% 50% Q 65% ${y * 100}%, 100% ${y * 100}%`} stroke="url(#conn-r)" strokeWidth="0.5" fill="none" />
              ))}
            </svg>

            <ColLabel t={t} center>{lang === 'es' ? '2 · MOTOR DE PUNTAJE' : '2 · SCORING ENGINE'}</ColLabel>
            <div style={{
              marginTop: 24,
              padding: '28px 22px', width: 240,
              background: t.panel, border: `1px solid ${t.accent}55`, borderRadius: 12,
              boxShadow: t.glow !== 'none' ? `inset 0 0 30px ${t.accent}1a, 0 0 30px ${t.accent}22` : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative', zIndex: 2,
            }}>
              <Fingerprint signals={{ inet: 0.88, sat: 0.72, crowd: 0.94, weather: 0.66 }} theme={t} size={150} glow={true} labels={false} />
              <div style={{
                fontFamily: t.display, fontSize: 18, color: t.ink, fontWeight: 500, letterSpacing: '-0.01em', textAlign: 'center',
              }}>
                {lang === 'es' ? 'Cruce de cuatro señales' : 'Four-signal cross-check'}
              </div>
              <div style={{ fontFamily: t.mono, fontSize: 10, color: t.inkDim, lineHeight: 1.5, textAlign: 'center', letterSpacing: '0.02em' }}>
                {lang === 'es'
                  ? 'score = 0.35·inet + 0.20·sat + 0.30·crowd + 0.15·wx'
                  : 'score = 0.35·inet + 0.20·sat + 0.30·crowd + 0.15·wx'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {[0.35, 0.20, 0.30, 0.15].map((w, i) => (
                  <div key={i} style={{
                    width: 24, height: 4, background: t.accent, opacity: 0.3 + w * 1.4,
                    borderRadius: 2,
                  }} />
                ))}
              </div>
            </div>

            {/* Anti-abuse stack */}
            <div style={{
              marginTop: 18, width: 240, padding: '12px 16px',
              border: `0.5px dashed ${t.line}`, borderRadius: 6,
              background: t.panel2,
            }}>
              <div style={{ fontFamily: t.mono, fontSize: 9, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
                {lang === 'es' ? '↳ 7 capas anti-abuso' : '↳ 7-layer anti-abuse'}
              </div>
              <div style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkDim, lineHeight: 1.6 }}>
                <div>rate ↓ geo ↓ contradict</div>
                <div>↓ trust ↓ quorum ↓ cross-val</div>
              </div>
            </div>
          </div>

          {/* Outputs column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ColLabel t={t}>{lang === 'es' ? '3 · CLASIFICACIÓN' : '3 · CLASSIFICATION'}</ColLabel>
            {types.map(ty => <OutTile key={ty.id} t={t} ty={ty} />)}
          </div>
        </div>
      </div>

      {/* Cross-validation rules */}
      <div style={{ padding: '44px 44px 36px' }}>
        <SectionLabelM t={t}>
          {lang === 'es' ? 'Cruce de validación · matriz' : 'Cross-validation · matrix'}
        </SectionLabelM>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <ValidCase t={t} lang={lang}
            title={lang === 'es' ? 'Las 4 coinciden' : 'All 4 agree'}
            icons={[1, 1, 1, 1]}
            verdict={lang === 'es' ? 'corte confirmado' : 'outage confirmed'}
            color={t.danger}
          />
          <ValidCase t={t} lang={lang}
            title={lang === 'es' ? 'Solo crowd, no pasivas' : 'Only crowd, no passive'}
            icons={[0, 0, 1, 0]}
            verdict={lang === 'es' ? 'manipulación posible · score · 0.3' : 'possible manipulation · score · 0.3'}
            color={t.warn}
          />
          <ValidCase t={t} lang={lang}
            title={lang === 'es' ? 'Pasivas sí, crowd no' : 'Passive yes, crowd no'}
            icons={[1, 1, 0, 0]}
            verdict={lang === 'es' ? 'usuarios offline · creer pasivas' : 'users offline · trust passive'}
            color={t.accent}
          />
          <ValidCase t={t} lang={lang}
            title={lang === 'es' ? 'OONI marca, tráfico normal' : 'OONI flags, traffic normal'}
            icons={[0, 0, 0, 0]}
            verdict={lang === 'es' ? 'censura, no corte' : 'censorship, not outage'}
            color={t.inkDim}
          />
        </div>
      </div>

      {/* Bottom: costs + scale */}
      <div style={{
        padding: '32px 44px', background: t.panel, borderTop: `0.5px solid ${t.line}`,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 40,
      }}>
        <FooterStat t={t} number="$0" sub={lang === 'es' ? 'costo mensual hasta 10k usuarios' : 'monthly cost up to 10k users'} />
        <FooterStat t={t} number="~50 KB" sub={lang === 'es' ? 'peso de página · pensado para 2G/3G' : 'page weight · designed for 2G/3G'} />
        <FooterStat t={t} number="↑ 1M" sub={lang === 'es' ? 'usuarios servibles por $0 · CDN estático' : 'users servable for $0 · static CDN'} />
      </div>
    </div>
  );
}

function SectionLabelM({ t, children }) {
  return (
    <div style={{
      fontFamily: t.mono, fontSize: 10, color: t.inkFaint,
      textTransform: 'uppercase', letterSpacing: '0.18em',
    }}>{children}</div>
  );
}

function ColLabel({ t, children, center }) {
  return (
    <div style={{
      fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint,
      textTransform: 'uppercase', letterSpacing: '0.16em',
      paddingBottom: 6, borderBottom: `0.5px solid ${t.line}`,
      textAlign: center ? 'center' : 'left',
    }}>{children}</div>
  );
}

function SourceTile({ t, src, accent }) {
  return (
    <div style={{
      padding: '12px 14px', background: t.panel,
      border: `0.5px solid ${t.line}`, borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 4, background: t.panel2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: t.mono, fontSize: 9, color: t.accent, letterSpacing: '0.02em',
        border: `0.5px solid ${t.line}`,
      }}>
        {src.axis.toUpperCase().slice(0, 3)}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 12, color: t.ink, fontWeight: 500, letterSpacing: '-0.005em' }}>{src.name}</span>
        <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: t.mono }}>{src.sub}</span>
      </div>
      <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkDim, fontVariantNumeric: 'tabular-nums' }}>
        {src.lat}
      </span>
    </div>
  );
}

function OutTile({ t, ty }) {
  return (
    <div style={{
      padding: '12px 14px', background: t.panel,
      border: `0.5px solid ${t.line}`, borderRadius: 4,
      borderLeft: `2px solid ${t.accent}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <span style={{ fontSize: 12, color: t.ink }}>{ty.name}</span>
      <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint, letterSpacing: '0.04em' }}>
        {ty.sig}
      </span>
    </div>
  );
}

function ValidCase({ t, lang, title, icons, verdict, color }) {
  const labels = ['I', 'S', 'C', 'W'];
  return (
    <div style={{
      padding: '14px 14px', background: t.panel,
      border: `0.5px solid ${t.line}`, borderRadius: 6,
      borderTop: `2px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 12, color: t.ink, fontWeight: 500 }}>{title}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {icons.map((on, i) => (
          <div key={i} style={{
            flex: 1, padding: '6px 0', textAlign: 'center',
            background: on ? `${color}22` : t.panel2,
            border: `0.5px solid ${on ? color + '55' : t.line}`, borderRadius: 3,
            fontFamily: t.mono, fontSize: 10, color: on ? color : t.inkFaint,
            letterSpacing: '0.06em', fontWeight: 600,
            boxShadow: t.glow !== 'none' && on ? `inset 0 0 8px ${color}33` : 'none',
          }}>{labels[i]}</div>
        ))}
      </div>
      <div style={{ fontFamily: t.mono, fontSize: 10, color: color, lineHeight: 1.5, letterSpacing: '0.02em' }}>
        ↳ {verdict}
      </div>
    </div>
  );
}

function BigStat({ t, value, label, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <span style={{
        fontFamily: mono ? t.mono : t.display, fontSize: mono ? 22 : 32,
        color: t.ink, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
      <span style={{
        fontFamily: t.mono, fontSize: 9, color: t.inkFaint,
        textTransform: 'uppercase', letterSpacing: '0.14em',
      }}>{label}</span>
    </div>
  );
}

function FooterStat({ t, number, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontFamily: t.display, fontSize: 38, color: t.accent, fontWeight: 500,
        letterSpacing: '-0.02em', lineHeight: 1,
        textShadow: t.glow !== 'none' ? `0 0 14px ${t.accent}55` : 'none',
      }}>{number}</span>
      <span style={{ fontSize: 12, color: t.inkDim, lineHeight: 1.4 }}>{sub}</span>
    </div>
  );
}

Object.assign(window, { ScreenMethodology });
