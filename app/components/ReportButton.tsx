import { useState, useEffect, useCallback } from 'react';
import { submitReport, getRecentCount } from '../lib/api';
import { getRegion } from './mobile/RegionPicker';
import { loadParroquias, getMunicipios, getParroquias } from '../lib/parroquias';
import type { ParroquiaDataset } from '../lib/parroquias';

// ── region list (mirrors pipeline/regions.py order) ───────────────────────────
const REGIONS = [
  { key: 'maracaibo',        name: 'Maracaibo (Zulia)' },
  { key: 'san_cristobal',    name: 'San Cristóbal (Táchira)' },
  { key: 'merida',           name: 'Mérida (Mérida)' },
  { key: 'valera',           name: 'Valera (Trujillo)' },
  { key: 'barquisimeto',     name: 'Barquisimeto (Lara)' },
  { key: 'punto_fijo',       name: 'Punto Fijo (Falcón)' },
  { key: 'valencia',         name: 'Valencia (Carabobo)' },
  { key: 'maracay',          name: 'Maracay (Aragua)' },
  { key: 'caracas',          name: 'Caracas (Distrito Capital)' },
  { key: 'los_teques',       name: 'Los Teques (Miranda)' },
  { key: 'guarenas_guatire', name: 'Guarenas-Guatire (Miranda)' },
  { key: 'barinas',          name: 'Barinas (Barinas)' },
  { key: 'maturin',          name: 'Matúrín (Monagas)' },
  { key: 'barcelona',        name: 'Barcelona (Anzoátegui)' },
  { key: 'cumana',           name: 'Cumaná (Sucre)' },
  { key: 'porlamar',         name: 'Porlamar (Nueva Esparta)' },
  { key: 'ciudad_guayana',   name: 'Ciudad Guayana (Bolívar)' },
  { key: 'guanare',          name: 'Guanare (Portuguesa)' },
  { key: 'san_felipe',       name: 'San Felipe (Yaracuy)' },
  { key: 'san_carlos',       name: 'San Carlos (Cojedes)' },
  { key: 'san_juan_de_los_morros', name: 'San Juan de los Morros (Guárico)' },
  { key: 'san_fernando_de_apure',  name: 'San Fernando de Apure (Apure)' },
  { key: 'puerto_ayacucho',  name: 'Puerto Ayacucho (Amazonas)' },
  { key: 'tucupita',         name: 'Tucupita (Delta Amacuro)' },
  { key: 'la_guaira',        name: 'La Guaira (La Guaira)' },
] as const;

const STATUS_OPTIONS = [
  { key: 'no_power',    label: 'Sin luz',         emoji: '🔴' },
  { key: 'unstable',    label: 'Luz inestable',   emoji: '🟡' },
  { key: 'power_back',  label: 'Volvió la luz',   emoji: '🟢' },
] as const;

const LAST_REPORT_KEY = 'cocuyo_last_report';
const POWER_BACK_WINDOW_MS = 12 * 60 * 60 * 1000;

// ── types ─────────────────────────────────────────────────────────────────────
type Step = 'idle' | 'region' | 'unlisted' | 'parroquia' | 'status' | 'submitting' | 'done' | 'error';

interface Gps { lat: number; lon: number }
interface LastReport { region: string; displayName: string; status: string; ts: number }

// ── GPS helper ────────────────────────────────────────────────────────────────
function requestGps(): Promise<Gps | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      ()    => resolve(null),
      { timeout: 6000, maximumAge: 60000 },
    );
  });
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function saveLastReport(r: LastReport): void {
  try { localStorage.setItem(LAST_REPORT_KEY, JSON.stringify(r)); } catch {}
}

function loadLastReport(): LastReport | null {
  try {
    const raw = localStorage.getItem(LAST_REPORT_KEY);
    return raw ? (JSON.parse(raw) as LastReport) : null;
  } catch { return null; }
}

function clearLastReport(): void {
  try { localStorage.removeItem(LAST_REPORT_KEY); } catch {}
}

// ── component ─────────────────────────────────────────────────────────────────
export default function ReportButton() {
  const [step, setStep]               = useState<Step>('idle');
  const [region, setRegion]           = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [cityFreetext, setCityFreetext] = useState('');
  const [gps, setGps]                 = useState<Gps | null>(null);
  const [, setStatus]                 = useState<string | null>(null);
  const [recentCount, setRecentCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [shortcut, setShortcut]       = useState<LastReport | null>(null);
  const [parroquiaData, setParroquiaData] = useState<ParroquiaDataset[] | null>(null);
  const [municipio, setMunicipio]     = useState<string>('');
  const [parroquia, setParroquia]     = useState<string>('');

  // Check for power-back shortcut on mount
  useEffect(() => {
    const last = loadLastReport();
    if (
      last &&
      last.status === 'no_power' &&
      Date.now() - last.ts < POWER_BACK_WINDOW_MS
    ) {
      setShortcut(last);
    }
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setRegion(null);
    setDisplayName('');
    setCityFreetext('');
    setGps(null);
    setStatus(null);
    setRecentCount(null);
    setErrorMsg(null);
    setMunicipio('');
    setParroquia('');
  }, []);

  // One-tap power-back shortcut
  const handleShortcut = useCallback(async () => {
    if (!shortcut) return;
    setStep('submitting');
    try {
      await submitReport({
        region:        shortcut.region,
        status:        'power_back',
        lat:           null,
        lon:           null,
        city_freetext: null,
      });
      saveLastReport({ ...shortcut, status: 'power_back', ts: Date.now() });
      setShortcut(null);
      clearLastReport();
      const count = await getRecentCount(shortcut.region);
      setRecentCount(count);
      setRegion(shortcut.region);
      setDisplayName(shortcut.displayName);
      setStatus('power_back');
      setStep('done');
    } catch {
      setErrorMsg('No se pudo enviar. Intenta de nuevo.');
      setStep('error');
    }
  }, [shortcut]);

  // Step 1 → region selection → optional parroquia refinement
  const handleSelectRegion = useCallback(async (key: string, name: string) => {
    setRegion(key);
    setDisplayName(name);
    const coords = await requestGps();
    setGps(coords);
    // parroquia refinement step when the region's state has parroquia data
    const data = parroquiaData ?? await loadParroquias();
    if (!parroquiaData) setParroquiaData(data);
    const state = getRegion(key)?.state;
    setMunicipio('');
    setParroquia('');
    setStep(state && getMunicipios(data, state).length ? 'parroquia' : 'status');
  }, [parroquiaData]);

  // Unlisted → status
  const handleUnlistedContinue = useCallback(async () => {
    if (!cityFreetext.trim()) return;
    setRegion('unlisted');
    setDisplayName(cityFreetext.trim());
    const coords = await requestGps();
    setGps(coords);
    setStep('status');
  }, [cityFreetext]);

  // Status selection → submit
  const handleSelectStatus = useCallback(async (selectedStatus: string) => {
    if (!region) return;
    setStatus(selectedStatus);
    setStep('submitting');
    try {
      await submitReport({
        region,
        status:        selectedStatus,
        lat:           gps?.lat ?? null,
        lon:           gps?.lon ?? null,
        city_freetext: region === 'unlisted' ? displayName : null,
        parroquia:     parroquia || null,
      });
      saveLastReport({ region, displayName, status: selectedStatus, ts: Date.now() });
      const count = await getRecentCount(region);
      setRecentCount(count);
      setStep('done');
    } catch {
      setErrorMsg('No se pudo enviar. Intenta de nuevo.');
      setStep('error');
    }
  }, [region, displayName, gps, parroquia]);

  // ── render ────────────────────────────────────────────────────────────────

  if (step === 'submitting') {
    return <p style={s.msg}>Enviando reporte…</p>;
  }

  if (step === 'done') {
    return (
      <div style={s.card}>
        <p style={s.success}>✓ Reporte enviado — {displayName}</p>
        {recentCount !== null && (
          <p style={s.count}>
            Tú + {recentCount - 1} persona{recentCount !== 2 ? 's' : ''} reportaron
            en los últimos 30 minutos.
          </p>
        )}
        <button style={s.btn} onClick={reset}>Cerrar</button>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div style={s.card}>
        <p style={s.err}>{errorMsg}</p>
        <button style={s.btn} onClick={reset}>Volver</button>
      </div>
    );
  }

  if (step === 'status') {
    return (
      <div style={s.card}>
        <p style={s.label}>{displayName} — ¿Cuál es el estado?</p>
        {STATUS_OPTIONS.map(({ key, label, emoji }) => (
          <button
            key={key}
            style={s.optBtn}
            onClick={() => handleSelectStatus(key)}
          >
            {emoji} {label}
          </button>
        ))}
        <button style={s.backBtn} onClick={reset}>Cancelar</button>
      </div>
    );
  }

  if (step === 'unlisted') {
    return (
      <div style={s.card}>
        <p style={s.label}>¿En qué ciudad estás?</p>
        <input
          style={s.input}
          type="text"
          placeholder="Nombre de tu ciudad"
          value={cityFreetext}
          onChange={(e) => setCityFreetext(e.target.value)}
          autoFocus
        />
        <button
          style={{ ...s.btn, opacity: cityFreetext.trim() ? 1 : 0.5 }}
          onClick={handleUnlistedContinue}
          disabled={!cityFreetext.trim()}
        >
          Continuar
        </button>
        <button style={s.backBtn} onClick={reset}>Cancelar</button>
      </div>
    );
  }

  if (step === 'parroquia') {
    const state = region ? (getRegion(region)?.state ?? '') : '';
    const munis = getMunicipios(parroquiaData ?? [], state);
    const parr = municipio ? getParroquias(parroquiaData ?? [], state, municipio) : [];
    return (
      <div style={s.card}>
        <p style={s.label}>{displayName} — ¿Dónde exactamente? (opcional)</p>
        <select
          style={s.input}
          value={municipio}
          onChange={(e) => { setMunicipio(e.target.value); setParroquia(''); }}
        >
          <option value="">Municipio…</option>
          {munis.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {municipio && (
          <select
            style={s.input}
            value={parroquia}
            onChange={(e) => setParroquia(e.target.value)}
          >
            <option value="">Parroquia…</option>
            {parr.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <button style={{ ...s.btn, opacity: 1 }} onClick={() => setStep('status')}>
          Continuar
        </button>
        <button style={s.backBtn} onClick={reset}>Cancelar</button>
      </div>
    );
  }

  if (step === 'region') {
    return (
      <div style={s.card}>
        <p style={s.label}>¿En qué ciudad estás?</p>
        <div style={s.list}>
          {REGIONS.map(({ key, name }) => (
            <button
              key={key}
              style={s.optBtn}
              onClick={() => handleSelectRegion(key, name)}
            >
              {name}
            </button>
          ))}
          <button
            style={{ ...s.optBtn, color: '#666' }}
            onClick={() => setStep('unlisted')}
          >
            Mi ciudad no está en la lista
          </button>
        </div>
        <button style={s.backBtn} onClick={reset}>Cancelar</button>
      </div>
    );
  }

  // idle
  return (
    <div>
      {shortcut && (
        <button style={s.shortcut} onClick={handleShortcut}>
          ⚡ ¿Volvió la luz en {shortcut.displayName}?
        </button>
      )}
      <button style={s.btn} onClick={() => setStep('region')}>
        Reportar estado del servicio
      </button>
    </div>
  );
}

// ── minimal inline styles ─────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  card:     { background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,.12)', maxWidth: 420 },
  label:    { margin: '0 0 .75rem', fontWeight: 600 },
  list:     { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' },
  btn:      { background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, width: '100%', marginTop: 8 },
  optBtn:   { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, padding: '10px 16px', cursor: 'pointer', textAlign: 'left', width: '100%' },
  backBtn:  { background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginTop: 4, fontSize: '.875rem', width: '100%' },
  shortcut: { background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6, padding: '10px 16px', cursor: 'pointer', fontWeight: 600, width: '100%', marginBottom: 8 },
  msg:      { color: '#666' },
  success:  { color: '#2e7d32', fontWeight: 600, margin: '0 0 .5rem' },
  count:    { color: '#555', fontSize: '.9rem', margin: '0 0 .75rem' },
  err:      { color: '#c62828', margin: '0 0 .75rem' },
  input:    { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box', marginBottom: 8 },
};
