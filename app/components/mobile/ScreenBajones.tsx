import React from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import { BAJONES_24H, BajonSeed } from '../../lib/demoData';
import FrequencyTrace, { BajonEvent } from '../primitives/FrequencyTrace';
import MiniStat from '../primitives/MiniStat';
import SectionLabel from '../primitives/SectionLabel';
interface Props {
  theme: Theme;
  lang:  Lang;
}

function ComingSoonOverlay({
  theme: t, lang, phase, compact = false,
}: { theme: Theme; lang: Lang; phase: number; compact?: boolean }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: compact ? 4 : 8,
      background: `${t.bg}99`,
      backdropFilter: 'blur(1px)',
    }}>
      <span style={{
        fontFamily: 'var(--font-serif)', fontSize: compact ? 16 : 20,
        color: t.ink, fontWeight: 500, letterSpacing: '-0.01em',
      }}>
        {tt('coming_soon', lang)}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: compact ? 8 : 9,
        color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em',
      }}>
        {lang === 'es' ? 'Fase' : 'Phase'} {phase}
      </span>
    </div>
  );
}

const SEV_COLOR: Record<BajonSeed['severity'], string> = {
  mild:   '#d8b13a',
  medium: '#d96f30',
  severe: '#c8412d',
};

// Convert seeds to FrequencyTrace BajonEvent format (t_idx from right edge)
function toTraceEvents(seeds: BajonSeed[]): BajonEvent[] {
  return seeds.slice(0, 6).map(s => ({
    t_idx: Math.round((s.t_min_ago / 1440) * 240),
    span:  Math.round(s.duration_s * 0.8),
    depth: s.magnitude * 0.3,
  }));
}

export default function ScreenBajones({ theme: t, lang }: Props) {
  const traceEvents = toTraceEvents(BAJONES_24H);

  const severeCount = BAJONES_24H.filter(b => b.severity === 'severe').length;
  const mediumCount = BAJONES_24H.filter(b => b.severity === 'medium').length;

  return (
    <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Frequency trace ── */}
      <div>
        <SectionLabel theme={t} label={tt('bajones_title', lang)} />

        <div style={{ position: 'relative', marginTop: 8 }}>
          <div style={{
            opacity: 0.5,
            padding: '14px 14px 8px',
            background: t.panel,
            border: `0.5px solid ${t.line}`,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 8.5,
              color: t.inkFaint, letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              {tt('hz_nominal', lang)}
            </div>
            <FrequencyTrace
              theme={t}
              width={340}
              height={72}
              bajones={traceEvents}
              live={false}
            />
          </div>
          <ComingSoonOverlay theme={t} lang={lang} phase={5} />
        </div>
      </div>

      {/* ── Event list ── */}
      <div>
        <SectionLabel theme={t} label={tt('bajones_24h', lang)} />

        <div style={{ position: 'relative' }}>
          <div style={{ opacity: 0.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BAJONES_24H.slice(0, 5).map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: t.panel, border: `0.5px solid ${t.line}`,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: SEV_COLOR[b.severity], flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkDim, flex: 1,
                }}>
                  {b.t_min_ago < 60
                    ? `${b.t_min_ago} min`
                    : `${Math.round(b.t_min_ago / 60)}h`}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: SEV_COLOR[b.severity],
                }}>
                  −{b.magnitude.toFixed(2)} Hz
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: t.inkFaint,
                }}>
                  {b.duration_s.toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
          <ComingSoonOverlay theme={t} lang={lang} phase={5} compact />
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div style={{ position: 'relative' }}>
        <div style={{ opacity: 0.5, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ padding: '10px 12px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat theme={t} label={lang === 'es' ? 'Total 24h' : 'Total 24h'} value={BAJONES_24H.length} unit={lang === 'es' ? 'bajones' : 'dips'} />
          </div>
          <div style={{ padding: '10px 12px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat theme={t} label={lang === 'es' ? 'Severos' : 'Severe'} value={severeCount} sub={`+ ${mediumCount} ${lang === 'es' ? 'medios' : 'medium'}`} />
          </div>
          <div style={{ padding: '10px 12px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat theme={t} label={lang === 'es' ? 'Peor' : 'Worst'} value="−1.45" unit="Hz" />
          </div>
        </div>
      </div>
    </div>
  );
}
