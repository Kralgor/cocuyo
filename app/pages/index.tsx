import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import ReportButton from '../components/ReportButton';
import StatusBar from '../components/StatusBar';
import { useAutoRefresh } from '../lib/api';

// Leaflet lazy-loaded as a secondary chunk — excluded from initial paint bundle.
// Status list renders immediately; map appears after Leaflet chunk loads.
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <div className="map-placeholder" aria-label="Cargando mapa…" />,
});

const Home: NextPage = () => {
  const { status, offline, refresh } = useAutoRefresh();

  return (
    <>
      <Head>
        <title>Cocuyo — Estado de la luz</title>
        <meta
          name="description"
          content="Monitoreo colaborativo de apagones eléctricos en Venezuela"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <StatusBar status={status} offline={offline} />
      <main>
        <h1>Cocuyo</h1>
        <p>Estado del servicio eléctrico en Venezuela</p>
        {offline && (
          <p style={{ color: '#c62828', fontWeight: 600 }}>
            Sin conexión — mostrando datos en caché
          </p>
        )}
        {/* Map component — lazy-loaded (T-007) */}
        <Map regions={status?.regions} />
        {/* ReportButton — T-008 */}
        <ReportButton />
        {status && (
          <p style={{ color: '#888', fontSize: '.8rem', marginTop: 8 }}>
            Actualizado: {new Date(status.updated_at).toLocaleTimeString('es-VE')}
            {' · '}
            <button
              onClick={refresh}
              style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
            >
              Actualizar ahora
            </button>
          </p>
        )}
      </main>
    </>
  );
};

export default Home;
