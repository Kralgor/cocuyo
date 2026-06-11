import { useState, useEffect } from 'react';

// SSR-safe matchMedia hook — defaults to false on first render to prevent
// hydration mismatches with the static export (LD-3).
// After mount, reflects window.matchMedia(query).matches and updates on change.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false); // always false on server/first render

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    function handleChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

export default useMediaQuery;
