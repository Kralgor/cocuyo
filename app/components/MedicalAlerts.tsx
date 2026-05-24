import React, { useState, useEffect, useRef } from 'react';
import { Theme } from '../lib/theme';
import { Lang } from '../lib/i18n';

export type MedicalNeed =
  | 'insulin'
  | 'cpap'
  | 'home_dialysis'
  | 'oxygen_concentrator';

export interface MedicalProfile {
  needs:           MedicalNeed[];
  notifEnabled:    boolean;
}

interface Props {
  theme:           Theme;
  lang:            Lang;
  predictionScore: number | null;
  regionName:      string;
}

// ── constants ──────────────────────────────────────────────────────────────────
const ALERT_THRESHOLD   = 0.60;
const NOTIF_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between notifications

const STORAGE_PROFILE = 'cocuyo_medical_profile';
const STORAGE_NOTIF_TS = 'cocuyo_medical_notif_ts';

const NEED_META: Record<MedicalNeed, { es: string; en: string; actionEs: string; actionEn: string }> = {
  insulin: {
    es:       'Medicamento refrigerado (insulina)',
    en:       'Refrigerated medication (insulin)',
    actionEs: 'Insulina abierta: segura 28 días a temperatura ambiente.',
    actionEn: 'Opened insulin: safe for 28 days at room temperature.',
  },
  cpap: {
    es:       'Dispositivo eléctrico (CPAP)',
    en:       'Powered device (CPAP)',
    actionEs: 'Carga la batería del CPAP ahora.',
    actionEn: 'Charge CPAP battery now.',
  },
  home_dialysis: {
    es:       'Diálisis en casa',
    en:       'Home dialysis',
    actionEs: 'Prepara energía de respaldo para la máquina de diálisis.',
    actionEn: 'Prepare backup power for dialysis machine.',
  },
  oxygen_concentrator: {
    es:       'Concentrador de oxígeno',
    en:       'Oxygen concentrator',
    actionEs: 'Prepara suministro de oxígeno de respaldo.',
    actionEn: 'Prepare backup oxygen supply.',
  },
};

const ALL_NEEDS: MedicalNeed[] = ['insulin', 'cpap', 'home_dialysis', 'oxygen_concentrator'];

// ── helpers ────────────────────────────────────────────────────────────────────
function loadProfile(): MedicalProfile {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE);
    if (raw) return JSON.parse(raw) as MedicalProfile;
  } catch { /* ignore */ }
  return { needs: [], notifEnabled: false };
}

function saveProfile(p: MedicalProfile): void {
  localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
}

function canNotify(profile: MedicalProfile): boolean {
  if (!profile.notifEnabled || profile.needs.length === 0) return false;
  if (typeof Notification === 'undefined') return false;
  return Notification.permission === 'granted';
}

function withinCooldown(): boolean {
  const raw = localStorage.getItem(STORAGE_NOTIF_TS);
  if (!raw) return false;
  return Date.now() - Number(raw) < NOTIF_COOLDOWN_MS;
}

function fireNotification(profile: MedicalProfile, regionName: string, lang: Lang): void {
  if (!canNotify(profile) || withinCooldown()) return;

  const actionLines = profile.needs
    .map(n => lang === 'es' ? NEED_META[n].actionEs : NEED_META[n].actionEn)
    .join(' ');

  const title = lang === 'es'
    ? `Alto riesgo de apagón — ${regionName}`
    : `High outage risk — ${regionName}`;

  const body = (lang === 'es'
    ? 'Alto riesgo en las próximas 3 h. '
    : 'High risk in next 3 h. '
  ) + actionLines;

  try {
    new Notification(title, { body, icon: '/favicon.ico' });
    localStorage.setItem(STORAGE_NOTIF_TS, String(Date.now()));
  } catch { /* Notification API may throw in some contexts */ }
}

// ── component ──────────────────────────────────────────────────────────────────
export default function MedicalAlerts({ theme: t, lang, predictionScore, regionName }: Props) {
  const [profile, setProfileState] = useState<MedicalProfile>({ needs: [], notifEnabled: false });
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const prevScoreRef = useRef<number | null>(null);

  useEffect(() => {
    setProfileState(loadProfile());
    if (typeof Notification === 'undefined') {
      setNotifPermission('unsupported');
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // fire notification when score crosses threshold
  useEffect(() => {
    const prev = prevScoreRef.current;
    prevScoreRef.current = predictionScore;

    if (predictionScore == null) return;
    if (predictionScore <= ALERT_THRESHOLD) return;
    // only fire when score crosses threshold (prev <= threshold or prev null)
    const prevWasBelow = prev == null || prev <= ALERT_THRESHOLD;
    if (!prevWasBelow) return;

    const current = loadProfile(); // fresh read
    fireNotification(current, regionName, lang);
  }, [predictionScore, regionName, lang]);

  function updateProfile(updated: MedicalProfile) {
    setProfileState(updated);
    saveProfile(updated);
  }

  function toggleNeed(need: MedicalNeed) {
    const has = profile.needs.includes(need);
    updateProfile({
      ...profile,
      needs: has ? profile.needs.filter(n => n !== need) : [...profile.needs, need],
    });
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    updateProfile({ ...profile, notifEnabled: result === 'granted' });
  }

  function toggleNotif() {
    if (!profile.notifEnabled && notifPermission !== 'granted') {
      requestPermission();
      return;
    }
    updateProfile({ ...profile, notifEnabled: !profile.notifEnabled });
  }

  const lbl = (es: string, en: string) => lang === 'es' ? es : en;
  const activeAlert = predictionScore != null && predictionScore > ALERT_THRESHOLD && profile.needs.length > 0;

  return (
    <div style={{ background: t.panel, border: `0.5px solid ${t.line}`, padding: '16px' }}>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
          color: t.inkFaint, textTransform: 'uppercase',
        }}>
          {lbl('Alertas médicas', 'Medical alerts')}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkFaint }}>
          {lbl('Solo en tu dispositivo', 'Device-only · never sent')}
        </span>
      </div>

      {/* active alert banner */}
      {activeAlert && (
        <div style={{
          background: `${t.danger}18`, border: `0.5px solid ${t.danger}66`,
          padding: '10px 12px', marginBottom: 14,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: t.danger, marginBottom: 6, fontWeight: 600 }}>
            {lbl(
              `RIESGO ALTO — ${Math.round((predictionScore ?? 0) * 100)}% probabilidad · ${regionName}`,
              `HIGH RISK — ${Math.round((predictionScore ?? 0) * 100)}% probability · ${regionName}`
            )}
          </div>
          {profile.needs.map(need => (
            <div key={need} style={{ fontSize: 12, color: t.ink, marginTop: 4 }}>
              · {lang === 'es' ? NEED_META[need].actionEs : NEED_META[need].actionEn}
            </div>
          ))}
        </div>
      )}

      {/* prediction score null = Phase 1-3 */}
      {predictionScore == null && (
        <div style={{
          background: `${t.accent}10`, border: `0.5px solid ${t.accent}33`,
          padding: '8px 10px', marginBottom: 12,
          fontFamily: 'var(--font-mono)', fontSize: 11, color: t.inkDim,
        }}>
          {lbl(
            'Alertas activas en Fase 4 (modelo de predicción). Configura tu perfil ahora.',
            'Alerts active in Phase 4 (prediction model). Set up your profile now.'
          )}
        </div>
      )}

      {/* needs checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {ALL_NEEDS.map(need => {
          const checked = profile.needs.includes(need);
          return (
            <button
              key={need}
              onClick={() => toggleNeed(need)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 0, textAlign: 'left',
              }}
            >
              {/* checkbox */}
              <div style={{
                width: 16, height: 16, flexShrink: 0,
                border: `1.5px solid ${checked ? t.accent : t.lineStrong}`,
                background: checked ? `${t.accent}22` : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && (
                  <div style={{ width: 8, height: 8, background: t.accent }} />
                )}
              </div>
              <span style={{ fontSize: 13, color: checked ? t.ink : t.inkDim }}>
                {lang === 'es' ? NEED_META[need].es : NEED_META[need].en}
              </span>
            </button>
          );
        })}
      </div>

      {/* divider */}
      <div style={{ height: '0.5px', background: t.line, margin: '10px 0' }} />

      {/* notification toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: t.ink, marginBottom: 2 }}>
            {lbl('Notificaciones push', 'Push notifications')}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkFaint }}>
            {notifPermission === 'unsupported' && lbl('No disponible en este navegador', 'Not available in this browser')}
            {notifPermission === 'denied'      && lbl('Bloqueadas — permite en ajustes del navegador', 'Blocked — allow in browser settings')}
            {notifPermission === 'default'     && lbl('Toca para activar', 'Tap to enable')}
            {notifPermission === 'granted' && profile.notifEnabled  && lbl('Activas · umbral 60%', 'Active · threshold 60%')}
            {notifPermission === 'granted' && !profile.notifEnabled && lbl('Desactivadas', 'Disabled')}
          </div>
        </div>

        {notifPermission !== 'unsupported' && notifPermission !== 'denied' && (
          <button
            onClick={toggleNotif}
            disabled={profile.needs.length === 0}
            style={{
              padding: '6px 14px',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              background: profile.notifEnabled ? `${t.accent}22` : 'transparent',
              color: profile.notifEnabled ? t.accent : t.inkDim,
              border: `0.5px solid ${profile.notifEnabled ? t.accent : t.lineStrong}`,
              cursor: profile.needs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: profile.needs.length === 0 ? 0.4 : 1,
            }}
          >
            {profile.notifEnabled ? lbl('Activo', 'On') : lbl('Activar', 'Enable')}
          </button>
        )}
      </div>

    </div>
  );
}
