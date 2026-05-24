import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { AppProvider } from '../contexts/AppContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    }
  }, []);

  return (
    <div style={{ height: '100%' }}>
      <AppProvider>
        <Component {...pageProps} />
      </AppProvider>
    </div>
  );
}
