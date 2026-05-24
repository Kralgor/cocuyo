import React from 'react';
import { Theme, statusColor } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import { RegionEntry } from '../../lib/api';
import Fingerprint, { Signals } from '../primitives/Fingerprint';
import SignalBar from '../primitives/SignalBar';
import SectionLabel from '../primitives/SectionLabel';
import ReportButtons from './ReportButtons';
import PowerBackBanner from './PowerBackBanner';

interface Props {
  theme:     Theme;
  lang:      Lang;
  regionKey: string;
  region:    RegionEntry | null;
}

function StatusBadge({ status, theme: t, lang }: { status: string; theme: Theme; lang: Lang }) {
  let label: string;
  let color: string;

  if (status === 'unverified_reports') {
    label = lang === 'es' ? 'REPORTES' : 'REPORTS';
    color = '#6b8fc2';
  } else if (status === 'no_data') {
    label = lang === 'es' ? 'SIN DATOS' : 'NO DATA';
    color = t.inkFaint;
  } else {
    label = status.toUpperCase().replace('_', ' ');
    color = statusColor(status, t);
  }

  return (
    <span style={{
      padding: '4px 9px',
      background: `${color}22`,
      color,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.14em',
      border: `0.5px solid ${color}55`,
      borderRadius: `${t.radius + 2}px`,
    }}>
      {label}
    </span>
  );
}

function RationingCallout({ pattern, theme: t, lang }: {
  pattern: NonNullable<RegionEntry['rationing_pattern']>;
  theme: Theme;
  lang: Lang;
}) {
  const startH = pattern.typical_start_hour;
  const startLabel = startH != null
    ? `${String(startH).padStart(2, '0')}:00 VET`
    : null;

  return (
    <div style={{
      padding: '12px 14px',
      background: t.panel,
      borderLeft: `2px solid ${t.accent}`,
      border: `0.5px solid ${t.line}`,
      borderLeftWidth: 2,
      borderLeftColor: t.accent,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: t.accent, marginBottom: 6,
      }}>
        {tt('rationing_pattern', lang)}
      </div>
      <div style={{ fontSize: 12, color: t.ink, lineHeight: 1.5, marginBottom: 4 }}>
        {pattern.description}
      </div>
      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap',
        fontFamily: 'var(--font-mono)', fontSize: 9.5,
        color: t.inkDim, marginTop: 6,
      }}>
        {startLabel && (
          <span>
            <span style={{ color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 8 }}>
              {lang === 'es' ? 'Hora típica' : 'Typical time'}{' '}
            </span>
            {startLabel}
          </span>
        )}
        {pattern.typical_duration_hours && (
          <span>
            <span style={{ color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 8 }}>
              {lang === 'es' ? 'Duración' : 'Duration'}{' '}
            </span>
            {pattern.typical_duration_hours}h
          </span>
        )}
        {pattern.frequency && (
          <span>
            <span style={{ color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 8 }}>
              {lang === 'es' ? 'Freq' : 'Freq'}{' '}
            </span>
            {pattern.frequency}
          </span>
        )}
      </div>
    </div>
  );
}

function LockedSignalRow({ label, theme: t, lang }: { label: string; theme: Theme; lang: Lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      }}>
        <span style={{ color: t.inkFaint, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: t.inkFaint, fontSize: 9 }}>
          {lang === 'es' ? 'Fase 2' : 'Phase 2'}
        </span>
      </div>
      <div style={{
        height: 4, background: t.panel2, position: 'relative', overflow: 'hidden',
        borderRadius: `${t.radius}px`,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(90deg, ${t.line} 0px, ${t.line} 4px, transparent 4px, transparent 8px)`,
        }} />
      </div>
    </div>
  );
}

export default function ScreenZoneDetail({ theme: t, lang, regionKey, region }: Props) {
  if (!region) {
    return (
      <div style={{ padding: '24px 22px', color: t.inkDim, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {tt('updating', lang)}
      </div>
    );
  }

  const signals: Signals = {
    inet:    null,
    sat:     null,
    crowd:   region.signals.crowdsource,
    weather: null,
  };

  const crowdValue = region.signals.crowdsource ?? 0;
  const reports30  = region.crowd_reports_30min ?? 0;
  const hasReports = reports30 > 0 || region.status === 'unverified_reports';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Power-back sticky banner ── */}
      <PowerBackBanner theme={t} lang={lang} />

      <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Status hero card ── */}
      <div style={{
        padding: '16px 16px 18px',
        background: t.panel,
        border: `0.5px solid ${t.line}`,
        borderLeft: `2px solid ${region.status === 'unverified_reports' ? '#6b8fc2' : t.line}`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <StatusBadge status={region.status} theme={t} lang={lang} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: t.inkFaint, letterSpacing: '0.04em',
          }}>
            {tt('phase_1_label', lang)}
          </span>
        </div>

        {hasReports ? (
          <>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22,
              fontWeight: 500, letterSpacing: '-0.01em',
              color: t.ink, lineHeight: 1.1, marginBottom: 4,
            }}>
              {reports30 === 1
                ? (lang === 'es' ? '1 reporte activo' : '1 active report')
                : (lang === 'es' ? `${reports30} reportes activos` : `${reports30} active reports`)}
            </div>
            <div style={{ fontSize: 12, color: t.inkDim }}>
              {lang === 'es'
                ? 'Reportes de la comunidad en los últimos 30 min. Sin verificación pasiva aún.'
                : 'Community reports in the last 30 min. No passive verification yet.'}
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22,
              fontWeight: 500, letterSpacing: '-0.01em',
              color: t.ink, lineHeight: 1.1, marginBottom: 4,
            }}>
              {lang === 'es' ? 'Sin reportes activos' : 'No active reports'}
            </div>
            <div style={{ fontSize: 12, color: t.inkDim }}>
              {lang === 'es'
                ? 'Sé el primero en reportar si hay un corte en tu zona.'
                : 'Be the first to report if there\'s an outage in your area.'}
            </div>
          </>
        )}
      </div>

      {/* ── Rationing pattern callout (conditional) ── */}
      {region.rationing_pattern && (
        <RationingCallout pattern={region.rationing_pattern} theme={t} lang={lang} />
      )}

      {/* ── Signal fingerprint ── */}
      <div>
        <SectionLabel theme={t} label={tt('signal_print', lang)} action={
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: t.inkFaint, letterSpacing: '0.04em',
          }}>
            1/4 {lang === 'es' ? 'señales' : 'signals'}
          </span>
        } />

        <div style={{
          padding: '14px 14px 16px',
          background: t.panel,
          border: `0.5px solid ${t.line}`,
          display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'center',
        }}>
          {/* Fingerprint — 3 null wedges ghosted, crowd live */}
          <Fingerprint signals={signals} theme={t} size={120} lang={lang} labels />

          {/* Signal bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Crowd — live */}
            <SignalBar
              theme={t}
              label={tt('signal_crowd', lang)}
              value={crowdValue}
              color={crowdValue > 0.45 ? t.warn : t.accent}
            />
            {/* Locked signals */}
            <LockedSignalRow label={tt('signal_int', lang)} theme={t} lang={lang} />
            <LockedSignalRow label={tt('signal_sat', lang)} theme={t} lang={lang} />
            <LockedSignalRow label={tt('signal_wx', lang)} theme={t} lang={lang} />
          </div>
        </div>

        {/* Phase unlock hint */}
        <div style={{
          marginTop: 8,
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: t.inkFaint, letterSpacing: '0.04em',
          textAlign: 'center',
        }}>
          {tt('signals_locked', lang)}
        </div>
      </div>

      {/* ── Report buttons ── */}
      <ReportButtons theme={t} lang={lang} regionKey={regionKey} />

      </div>
    </div>
  );
}
