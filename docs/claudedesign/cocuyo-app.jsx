// cocuyo-app.jsx — Top-level app: design canvas + tweaks panel

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "tinta",
  "accent": "#D4A14A",
  "language": "es",
  "scenario": "active",
  "annotations": true
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  '#D4A14A', // lifted mustard
  '#C77550', // clay
  '#7B9AAE', // muted slate-blue
  '#9AAE76', // olive
  '#B585A0', // dusty plum
];

const THEME_OPTIONS = ['tinta', 'estudio', 'glow', 'civic', 'terminal'];
const THEME_LABELS = {
  tinta:    { es: 'Cocuyo · tinta',   en: 'Cocuyo · ink' },
  estudio:  { es: 'Cocuyo · estudio', en: 'Cocuyo · studio' },
  glow:     { es: 'Cocuyo · oscuro',  en: 'Cocuyo · dark' },
  civic:    { es: 'Cívico · claro',   en: 'Civic · light' },
  terminal: { es: 'Terminal',          en: 'Terminal' },
};
const SCENARIO_OPTIONS = ['normal', 'at_risk', 'active', 'national'];

function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = window.COCUYO.getTheme(tw.theme, tw.accent);
  const lang = tw.language;

  // Inject global font + body styles per theme. Re-apply on theme change.
  React.useEffect(() => {
    const id = 'cocuyo-global-style';
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    // Aero adds: backdrop-filter glass on every panel, gloss bevels,
    // rounded sub-frames, atmospheric scrollbars, and floating firefly bokeh.
    // We match panels by their inline rgba background so existing components
    // don't need code changes — the theme reskins them in place.
    el.textContent = `
      html, body { background: ${tw.theme === 'estudio' ? '#e7e1d2' : tw.theme === 'tinta' ? '#1c1a16' : '#f0eee9'}; margin: 0; padding: 0; }
      .cocuyo-art * { box-sizing: border-box; }
      .cocuyo-art button:focus { outline: none; }
      .leaflet-container { background: ${theme.bg}; font-family: ${theme.mono} !important; }
      .leaflet-tile-pane { ${
        tw.theme === 'terminal' ? 'filter: hue-rotate(80deg) saturate(0.6) brightness(1.3) contrast(1.1);'
        : tw.theme === 'glow'    ? 'filter: brightness(1.5) contrast(1.05) saturate(0.85);'
        : tw.theme === 'estudio' ? 'filter: grayscale(0.45) contrast(0.85) brightness(1.02) sepia(0.10);'
        : tw.theme === 'tinta'   ? 'filter: grayscale(0.45) contrast(0.95) brightness(0.78) sepia(0.18) hue-rotate(-8deg);'
        :                          'filter: contrast(0.9);'
      } }

      ${tw.theme === 'estudio' || tw.theme === 'tinta' ? `
      .cocuyo-art *::-webkit-scrollbar { width: 6px; height: 6px; }
      .cocuyo-art *::-webkit-scrollbar-track { background: transparent; }
      .cocuyo-art *::-webkit-scrollbar-thumb { background: ${tw.theme === 'tinta' ? 'rgba(230,220,198,0.22)' : 'rgba(26,31,37,0.22)'}; border-radius: 0; }
      .cocuyo-art *::-webkit-scrollbar-thumb:hover { background: ${tw.theme === 'tinta' ? 'rgba(230,220,198,0.40)' : 'rgba(26,31,37,0.40)'}; }
      ` : ''}
    `;
  }, [tw.theme, tw.accent]);

  // The DesignCanvas already provides a warm-gray grid. Don't try to theme it;
  // the artboards themselves carry the theme.
  return (
    <>
      <DesignCanvas>
        <DCSection id="ops" title="Operaciones nacionales" subtitle="Desktop · 1440 × 900 · live operations console">
          <DCArtboard id="dashboard" label={lang === 'es' ? 'A · Tablero nacional' : 'A · National dashboard'} width={1440} height={900}>
            <div className="cocuyo-art" style={{ width: '100%', height: '100%' }}>
              <Dashboard theme={theme} scenarioId={tw.scenario} lang={lang} accentColor={tw.accent} />
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="mobile" title="Aplicación móvil" subtitle="iPhone · 390 × 844 · cuatro flujos clave">
          <DCArtboard id="zone" label={lang === 'es' ? 'B · Mi zona' : 'B · My zone'} width={390} height={844}>
            <div className="cocuyo-art" style={{ width: '100%', height: '100%' }}>
              <ScreenZoneDetail theme={theme} lang={lang} scenarioId={tw.scenario} accent={tw.accent} />
            </div>
          </DCArtboard>
          <DCArtboard id="forecast" label={lang === 'es' ? 'C · Pronóstico 24h' : 'C · 24h forecast'} width={390} height={844}>
            <div className="cocuyo-art" style={{ width: '100%', height: '100%' }}>
              <ScreenForecast theme={theme} lang={lang} scenarioId={tw.scenario} accent={tw.accent} />
            </div>
          </DCArtboard>
          <DCArtboard id="bajones" label={lang === 'es' ? 'D · Calidad de voltaje' : 'D · Voltage quality'} width={390} height={844}>
            <div className="cocuyo-art" style={{ width: '100%', height: '100%' }}>
              <ScreenBajones theme={theme} lang={lang} scenarioId={tw.scenario} accent={tw.accent} />
            </div>
          </DCArtboard>
          <DCArtboard id="history" label={lang === 'es' ? 'E · Historial 30d' : 'E · 30-day history'} width={390} height={844}>
            <div className="cocuyo-art" style={{ width: '100%', height: '100%' }}>
              <ScreenHistory theme={theme} lang={lang} scenarioId={tw.scenario} accent={tw.accent} />
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="meth" title="Metodología" subtitle="Cómo cocuyo infiere cortes sin acceso oficial">
          <DCArtboard id="methodology" label={lang === 'es' ? 'F · Tubería de datos' : 'F · Data pipeline'} width={1200} height={1100}>
            <div className="cocuyo-art" style={{ width: '100%', height: '100%' }}>
              <ScreenMethodology theme={theme} lang={lang} accent={tw.accent} />
            </div>
          </DCArtboard>
        </DCSection>

        {tw.annotations && (
          <>
            <DCPostIt top={120} left={-200} rotate={-3} width={170}>
              The map uses real Leaflet + OSM tiles. Markers are firefly-pulsing dots scaled by city population; outage zones pulse and emit expanding rings.
            </DCPostIt>
            <DCPostIt top={520} left={-200} rotate={2} width={170}>
              The "signal fingerprint" is a 4-wedge radial: Internet · Satellite · Crowd · Weather. When all four light up, you have a confirmed outage.
            </DCPostIt>
            <DCPostIt top={1100} left={-200} rotate={-1} width={170}>
              Bajones screen is the differentiator. Live 60Hz heartbeat trace. Detects instability 10-30 min before a full cut.
            </DCPostIt>
            <DCPostIt top={1100} right={-200} rotate={2} width={170}>
              30-day "darkness strip" — columns = days, rows = hours. Easy to spot recurring Tue/Thu 2–5pm rationing pattern.
            </DCPostIt>
          </>
        )}
      </DesignCanvas>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label={lang === 'es' ? 'Escenario' : 'Scenario'} />
        <TweakSelect
          label={lang === 'es' ? 'Estado de la red' : 'Grid state'}
          value={tw.scenario}
          options={SCENARIO_OPTIONS}
          labels={SCENARIO_OPTIONS.map(s => window.COCUYO.SCENARIOS[s][lang === 'es' ? 'labelEs' : 'labelEn'])}
          onChange={v => setTweak('scenario', v)}
        />

        <TweakSection label={lang === 'es' ? 'Tema visual' : 'Visual theme'} />
        <TweakSelect
          label={lang === 'es' ? 'Tema' : 'Theme'}
          value={tw.theme}
          options={THEME_OPTIONS}
          labels={THEME_OPTIONS.map(o => THEME_LABELS[o][lang])}
          onChange={v => setTweak('theme', v)}
        />
        <TweakColor
          label={lang === 'es' ? 'Acento' : 'Accent'}
          value={tw.accent}
          options={ACCENT_OPTIONS}
          onChange={v => setTweak('accent', v)}
        />

        <TweakSection label={lang === 'es' ? 'Idioma' : 'Language'} />
        <TweakRadio
          label={lang === 'es' ? 'Idioma' : 'Language'}
          value={tw.language}
          options={['es', 'en']}
          labels={['Español', 'English']}
          onChange={v => setTweak('language', v)}
        />
        <TweakToggle
          label={lang === 'es' ? 'Notas para revisores' : 'Reviewer notes'}
          value={tw.annotations}
          onChange={v => setTweak('annotations', v)}
        />
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
