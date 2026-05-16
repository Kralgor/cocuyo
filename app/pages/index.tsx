import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import ReportButton from '../components/ReportButton';

// Leaflet lazy-loaded as a secondary chunk — excluded from initial paint bundle.
// Status list renders immediately; map appears after Leaflet chunk loads.
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <div className="map-placeholder" aria-label="Cargando mapa…" />,
});

const Home: NextPage = () => {
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
      <main>
        <h1>Cocuyo</h1>
        <p>Estado del servicio eléctrico en Venezuela</p>
        {/* Map component — lazy-loaded (T-007) */}
        <Map />
        {/* ReportButton — T-008 */}
        <ReportButton />
        {/* Status list — uses data from lib/api.ts (T-009) */}
      </main>
    </>
  );
};

export default Home;
