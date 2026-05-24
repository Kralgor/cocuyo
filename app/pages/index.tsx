import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '../contexts/AppContext';
import { useAutoRefresh } from '../lib/api';
import { useRegionHistory } from '../lib/history';
import { tt } from '../lib/i18n';
import MobileShell from '../components/mobile/MobileShell';
import { TabId } from '../components/mobile/TabBar';
import RegionPicker, { getRegion } from '../components/mobile/RegionPicker';
import Settings from '../components/mobile/Settings';
import ScreenZoneDetail from '../components/mobile/ScreenZoneDetail';
import ScreenForecast   from '../components/mobile/ScreenForecast';
import ScreenBajones    from '../components/mobile/ScreenBajones';
import ScreenHistory    from '../components/mobile/ScreenHistory';

// Leaflet lazy-loaded — excluded from initial paint bundle.
// requestIdleCallback prefetch below primes it before user navigates to map tab.
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <div style={{ height: 440, background: 'var(--panel)' }} />,
});

const Home: NextPage = () => {
  const { theme, lang, selectedRegion, setSelectedRegion } = useApp();
  const { status, offline } = useAutoRefresh();
  const [activeTab,    setActiveTab]    = useState<TabId>('zone');
  const [showPicker,   setShowPicker]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempRegionKey, setTempRegionKey] = useState<string | null>(null);
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const effectiveRegionKey = tempRegionKey ?? selectedRegion;
  const { history, loading: historyLoading } = useRegionHistory(effectiveRegionKey);

  const t = theme;

  // Prefetch Leaflet chunk while browser is idle
  useEffect(() => {
    const load = () => { import('../components/Map').catch(() => {}); };
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void })
        .requestIdleCallback(load);
    } else {
      setTimeout(load, 1500);
    }
  }, []);

  const pickerVisible = selectedRegion === null || showPicker;

  function handleRegionSelect(key: string) {
    setSelectedRegion(key);
    setShowPicker(false);
    setTempRegionKey(null);
  }

  function handleMarkerTap(key: string) {
    setTempRegionKey(key);
    setActiveTab('zone');
  }

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    // Clear temp region when user manually navigates away from zone tab
    if (tab !== 'zone') setTempRegionKey(null);
  }

  const region        = effectiveRegionKey ? getRegion(effectiveRegionKey) : null;
  const savedRegion   = selectedRegion ? getRegion(selectedRegion) : null;
  const viewingTemp   = tempRegionKey !== null && tempRegionKey !== selectedRegion;

  function getTitle(): string {
    if (activeTab === 'zone') return region?.name ?? tt('nav_zone', lang);
    if (activeTab === 'map')      return tt('nav_map', lang);
    if (activeTab === 'forecast') return tt('forecast', lang);
    if (activeTab === 'bajones')  return tt('nav_bajones', lang);
    return tt('nav_history', lang);
  }

  function getSubtitle(): string | undefined {
    if (activeTab === 'zone' && region) return region.state.toUpperCase();
    if (status) return 'COCUYO · VENEZUELA';
    return undefined;
  }

  function getTitleAction() {
    // Back arrow when viewing a temp region from map tap
    if (activeTab === 'zone' && viewingTemp) {
      return (
        <button
          onClick={() => setTempRegionKey(null)}
          style={{
            background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: t.inkDim, letterSpacing: '0.04em',
            cursor: 'pointer', padding: '4px 0',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {savedRegion?.name ?? (lang === 'es' ? 'Mi zona' : 'My zone')}
        </button>
      );
    }

    // "Cambiar" button when viewing own region
    if (activeTab === 'zone' && region && !viewingTemp) {
      return (
        <button
          onClick={() => setShowPicker(true)}
          style={{
            background: 'none', border: `0.5px solid ${t.line}`,
            borderRadius: `${t.radius + 3}px`,
            padding: '3px 8px',
            fontFamily: 'var(--font-mono)', fontSize: 8.5,
            color: t.inkFaint, letterSpacing: '0.06em',
            textTransform: 'uppercase', cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {lang === 'es' ? 'cambiar' : 'change'}
        </button>
      );
    }

    return undefined;
  }

  function renderContent() {
    switch (activeTab) {
      case 'zone':
        return (
          <>
            {offline && (
              <div style={{
                padding: '8px 22px', background: t.warn + '22',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: t.warn,
              }}>
                {tt('offline_banner', lang)}
              </div>
            )}
            <ScreenZoneDetail
              theme={t}
              lang={lang}
              regionKey={effectiveRegionKey ?? ''}
              region={effectiveRegionKey ? (status?.regions[effectiveRegionKey] ?? null) : null}
            />
          </>
        );

      case 'map':
        return (
          <Map
            regions={status?.regions}
            theme={t}
            onMarkerTap={handleMarkerTap}
          />
        );

      case 'forecast':
        return <ScreenForecast theme={t} lang={lang} history={history} loading={historyLoading} />;

      case 'bajones':
        return <ScreenBajones theme={t} lang={lang} />;

      case 'history':
        return <ScreenHistory theme={t} lang={lang} history={history} loading={historyLoading} />;
    }
  }

  if (!mounted) {
    return (
      <>
        <Head>
          <title>Cocuyo — Estado de la luz</title>
          <meta name="description" content="Monitoreo colaborativo de apagones eléctricos en Venezuela" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </Head>
        <div className="app-outer" style={{ minHeight: '100vh', background: '#15130f', display: 'flex' }}>
        <div className="app-shell" style={{ minHeight: '100vh', background: '#15130f' }} />
      </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Cocuyo — Estado de la luz</title>
        <meta name="description" content="Monitoreo colaborativo de apagones eléctricos en Venezuela" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="app-outer" style={{
        minHeight: '100vh',
        background: t.panel2,
        display: 'flex',
      }}>
        <div className="app-shell" style={{
          width: '100%',
          minHeight: '100vh',
          background: t.bg,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <MobileShell
            theme={t}
            lang={lang}
            title={getTitle()}
            subtitle={getSubtitle()}
            titleAction={getTitleAction()}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onSettingsOpen={() => setShowSettings(true)}
          >
            {renderContent()}
          </MobileShell>

          {pickerVisible && (
            <RegionPicker
              theme={t}
              lang={lang}
              onSelect={handleRegionSelect}
            />
          )}

          {showSettings && (
            <Settings
              theme={t}
              lang={lang}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Home;
