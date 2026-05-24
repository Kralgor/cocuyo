import React, { useState, useEffect, useRef } from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import { submitReport, getRecentCount } from '../../lib/api';

const LAST_REPORT_KEY = 'cocuyo_last_report';
const UNDO_SECONDS    = 60;
const COOLDOWN_MS     = 60 * 1000;

export interface LastReport {
  region:    string;
  status:    string;
  timestamp: number;
}

export function saveLastReport(r: LastReport) {
  localStorage.setItem(LAST_REPORT_KEY, JSON.stringify(r));
}

export function loadLastReport(): LastReport | null {
  try {
    const raw = localStorage.getItem(LAST_REPORT_KEY);
    return raw ? (JSON.parse(raw) as LastReport) : null;
  } catch {
    return null;
  }
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'submitting'; status: string }
  | { kind: 'submitted'; status: string; count: number | null; secondsLeft: number }
  | { kind: 'undone' }
  | { kind: 'cooldown' }
  | { kind: 'error' };

interface Props {
  theme:       Theme;
  lang:        Lang;
  regionKey:   string;
  regionName?: string;
}

const STATUSES = [
  { key: 'no_power',  labelKey: 'report_no_pwr', primary: true  },
  { key: 'power_back',labelKey: 'report_back',   primary: false },
  { key: 'unstable',  labelKey: 'report_unst',   primary: false },
] as const;

export default function ReportButtons({ theme: t, lang, regionKey, regionName }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const undoRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const coolRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (undoRef.current) clearInterval(undoRef.current);
    if (coolRef.current) clearTimeout(coolRef.current);
  }, []);

  async function handleReport(statusKey: string) {
    if (phase.kind === 'submitting' || phase.kind === 'cooldown') return;

    setPhase({ kind: 'submitting', status: statusKey });

    // Attempt GPS (non-blocking)
    let lat: number | null = null;
    let lon: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      );
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      // GPS optional — submit without
    }

    try {
      await submitReport({
        region:        regionKey,
        status:        statusKey,
        lat,
        lon,
        city_freetext: null,
      });

      saveLastReport({ region: regionKey, status: statusKey, timestamp: Date.now() });

      // Fetch social proof count (non-blocking)
      const count = await getRecentCount(regionKey);

      setPhase({ kind: 'submitted', status: statusKey, count, secondsLeft: UNDO_SECONDS });

      // Countdown timer for undo window
      undoRef.current = setInterval(() => {
        setPhase(prev => {
          if (prev.kind !== 'submitted') return prev;
          const next = prev.secondsLeft - 1;
          if (next <= 0) {
            if (undoRef.current) clearInterval(undoRef.current);
            startCooldown();
            return { kind: 'cooldown' };
          }
          return { ...prev, secondsLeft: next };
        });
      }, 1000);

    } catch {
      setPhase({ kind: 'error' });
    }
  }

  function handleUndo() {
    if (undoRef.current) clearInterval(undoRef.current);
    // Undo is client-side only (anon role has no DELETE)
    localStorage.removeItem(LAST_REPORT_KEY);
    setPhase({ kind: 'undone' });
    // Allow re-submit immediately after undo
  }

  function startCooldown() {
    coolRef.current = setTimeout(() => setPhase({ kind: 'idle' }), COOLDOWN_MS);
  }

  // ── Submitted state ──────────────────────────────────────────
  if (phase.kind === 'submitted') {
    const { count, secondsLeft, status: submittedStatus } = phase;
    const others = count != null && count > 1 ? count - 1 : 0;
    const socialText = count != null && count > 0
      ? (lang === 'es'
          ? `Tú + ${others} otros · 30 min`
          : `You + ${others} others · 30 min`)
      : (lang === 'es' ? tt('submitted', lang) : tt('submitted', lang));

    return (
      <div style={{
        padding: '14px 16px',
        background: t.panel,
        border: `0.5px solid ${t.line}`,
        borderLeft: `2px solid ${submittedStatus === 'power_back' ? t.ok : submittedStatus === 'unstable' ? t.warn : t.danger}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: t.ink, letterSpacing: '0.02em',
          }}>
            {socialText}
          </span>
          <button
            onClick={handleUndo}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: t.inkFaint, letterSpacing: '0.04em',
            }}
          >
            {tt('undo', lang)} ({secondsLeft}s)
          </button>
        </div>
        <div style={{
          height: 2, background: t.line,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            background: t.accent,
            width: `${(secondsLeft / UNDO_SECONDS) * 100}%`,
            transition: 'width 1s linear',
          }} />
        </div>
      </div>
    );
  }

  // ── Cooldown state ───────────────────────────────────────────
  if (phase.kind === 'cooldown') {
    return (
      <div style={{
        padding: '14px 16px',
        border: `0.5px solid ${t.line}`,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: t.inkFaint, textAlign: 'center',
        letterSpacing: '0.04em',
      }}>
        {lang === 'es' ? 'Reporte registrado' : 'Report recorded'}
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (phase.kind === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          padding: '10px 14px',
          border: `0.5px solid ${t.danger}55`,
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: t.danger,
        }}>
          {lang === 'es' ? 'Error al enviar. Intenta de nuevo.' : 'Send failed. Try again.'}
        </div>
        <button
          onClick={() => setPhase({ kind: 'idle' })}
          style={ghostBtn(t)}
        >
          {lang === 'es' ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    );
  }

  // ── Undone state ─────────────────────────────────────────────
  if (phase.kind === 'undone') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: t.inkFaint, textAlign: 'center', padding: '4px 0',
        }}>
          {lang === 'es' ? 'Reporte cancelado' : 'Report cancelled'}
        </div>
        {renderButtons()}
      </div>
    );
  }

  // ── Idle / submitting ─────────────────────────────────────────
  return renderButtons();

  function renderButtons() {
    const isSubmitting = phase.kind === 'submitting';
    const submittingStatus = isSubmitting ? (phase as { kind: 'submitting'; status: string }).status : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Primary: No tengo luz */}
        <button
          onClick={() => handleReport('no_power')}
          disabled={isSubmitting}
          style={{
            ...primaryBtn(t),
            opacity: isSubmitting && submittingStatus !== 'no_power' ? 0.5 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M3 13l2-2M11 5l2-2"/>
          </svg>
          {submittingStatus === 'no_power'
            ? tt('submitting', lang)
            : tt('report_no_pwr', lang)}
        </button>

        {/* Secondary row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => handleReport('power_back')}
            disabled={isSubmitting}
            style={{
              ...secondaryBtn(t, t.ok),
              opacity: isSubmitting && submittingStatus !== 'power_back' ? 0.5 : 1,
            }}
          >
            {submittingStatus === 'power_back'
              ? tt('submitting', lang)
              : tt('report_back', lang)}
          </button>
          <button
            onClick={() => handleReport('unstable')}
            disabled={isSubmitting}
            style={{
              ...secondaryBtn(t, t.warn),
              opacity: isSubmitting && submittingStatus !== 'unstable' ? 0.5 : 1,
            }}
          >
            {submittingStatus === 'unstable'
              ? tt('submitting', lang)
              : tt('report_unst', lang)}
          </button>
        </div>
      </div>
    );
  }
}

function primaryBtn(t: Theme): React.CSSProperties {
  return {
    padding: '14px 16px',
    border: `0.5px solid ${t.accent}`,
    background: `${t.accent}1a`,
    color: t.ink,
    fontFamily: 'var(--font-inter)',
    fontSize: 13, fontWeight: 500,
    letterSpacing: '-0.005em',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    width: '100%',
  };
}

function secondaryBtn(t: Theme, color: string): React.CSSProperties {
  return {
    padding: '12px 10px',
    border: `0.5px solid ${t.line}`,
    background: 'transparent',
    color: t.inkDim,
    fontFamily: 'var(--font-inter)',
    fontSize: 12,
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  };
}

function ghostBtn(t: Theme): React.CSSProperties {
  return {
    padding: '10px 14px',
    border: `0.5px solid ${t.line}`,
    background: 'none',
    color: t.inkDim,
    fontFamily: 'var(--font-mono)',
    fontSize: 10, cursor: 'pointer',
    letterSpacing: '0.04em',
    WebkitTapHighlightColor: 'transparent',
  };
}
