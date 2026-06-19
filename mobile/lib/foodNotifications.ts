// ── local food spoilage warning notifications (Phase 4 plan 04, NOTF-03) ────────
// Local-first only (D-10): no Supabase, no push token, no account/identity for
// food state. Warnings fire BEFORE the hard threshold (D-09, D-17) using the
// active session's outage start (D-18). Permission is requested only from an
// explicit user action (D-11) — never at module load or on render.
//
// Threat coverage:
//   T-04-04-01 info disclosure — notification data carries only local ids.
//   T-04-04-02 DoS/dupes — scheduled ids + dismissed keys deduped locally.
//   T-04-04-03 consent — permission requested only via ensureFoodNotificationPermission().
//   T-04-04-04 safety — copy is cautious, no safety/temperature guarantee.
import * as Notifications from 'expo-notifications';

import type { FoodTimerSession, TrackedFoodItem } from './food';
import { STORAGE_KEYS, storage } from './storage';

// ── preferences (local MMKV only) ───────────────────────────────────────────────

export interface FoodNotificationPrefs {
  enabled: boolean;
  /** When true, an outage may surface a local "review your timers" prompt (D-15). */
  reviewPromptEnabled?: boolean;
}

const DEFAULT_FOOD_NOTIFICATION_PREFS: FoodNotificationPrefs = {
  enabled: false,
  reviewPromptEnabled: true,
};

export function readFoodNotificationPrefs(): FoodNotificationPrefs {
  const raw = storage.getString(STORAGE_KEYS.foodNotificationPrefs);
  if (!raw) {
    return { ...DEFAULT_FOOD_NOTIFICATION_PREFS };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== 'object') {
      return { ...DEFAULT_FOOD_NOTIFICATION_PREFS };
    }
    const obj = parsed as Partial<FoodNotificationPrefs>;
    return {
      enabled: typeof obj.enabled === 'boolean' ? obj.enabled : false,
      reviewPromptEnabled:
        typeof obj.reviewPromptEnabled === 'boolean' ? obj.reviewPromptEnabled : true,
    };
  } catch {
    return { ...DEFAULT_FOOD_NOTIFICATION_PREFS };
  }
}

export function writeFoodNotificationPrefs(prefs: FoodNotificationPrefs): void {
  storage.set(STORAGE_KEYS.foodNotificationPrefs, JSON.stringify(prefs));
}

// ── dismissed-warning dedupe map (local MMKV only) ──────────────────────────────
// Keyed by `${timerSessionId}:${itemId}:${warningLevel}` → scheduled notification
// id (or a sentinel). Presence of a key means "already handled, do not re-alert".

export type FoodDismissedWarnings = Record<string, string>;

export function makeFoodWarningKey(
  timerSessionId: string,
  itemId: string,
  warningLevel: string,
): string {
  return `${timerSessionId}:${itemId}:${warningLevel}`;
}

export function readFoodDismissedWarnings(): FoodDismissedWarnings {
  const raw = storage.getString(STORAGE_KEYS.foodDismissedWarnings);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: FoodDismissedWarnings = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeFoodDismissedWarnings(map: FoodDismissedWarnings): void {
  storage.set(STORAGE_KEYS.foodDismissedWarnings, JSON.stringify(map));
}

// ── notification content + schedule time (pure) ─────────────────────────────────

export interface FoodWarningContent {
  title: string;
  body: string;
  data: {
    kind: 'food_warning';
    timerSessionId: string;
    itemId: string;
    warningLevel: 'warning';
  };
}

/**
 * Cautious, Spanish-first warning copy (D-17). No safety guarantee, no claim to
 * know the fridge/freezer temperature — only a time-since-outage reminder.
 */
export function buildFoodWarningNotification(
  item: TrackedFoodItem,
  session: FoodTimerSession,
): FoodWarningContent {
  return {
    title: `Revisa: ${item.name}`,
    body: `Tu zona lleva un rato sin luz. Revisa ${item.name} y evita abrir la nevera. Si tienes dudas, descarta.`,
    data: {
      kind: 'food_warning',
      timerSessionId: session.timerSessionId ?? '',
      itemId: item.id,
      warningLevel: 'warning',
    },
  };
}

/**
 * Warning fire time = `outageStartedAt + thresholdMinutes - warningLeadMinutes`
 * (D-09, D-18). Returns null when there is no active session/outage start, or
 * when the timestamps are unparseable.
 */
export function getFoodWarningScheduleTime(
  item: TrackedFoodItem,
  session: FoodTimerSession,
): Date | null {
  if (session.status !== 'active' || !session.outageStartedAt) {
    return null;
  }
  const startMs = Date.parse(session.outageStartedAt);
  if (Number.isNaN(startMs)) {
    return null;
  }
  const fireMs =
    startMs + (item.thresholdMinutes - item.warningLeadMinutes) * 60000;
  return new Date(fireMs);
}

// ── scheduled-id registry (local MMKV only) ─────────────────────────────────────
// Tracks which OS notification ids belong to which session/item/warning so we can
// cancel and dedupe later. Reuses foodDismissedWarnings as the single registry:
// key → scheduled OS notification id.

function registryKeyForItem(session: FoodTimerSession, item: TrackedFoodItem): string {
  return makeFoodWarningKey(session.timerSessionId ?? '', item.id, 'warning');
}

// ── permission (point-of-use only, D-11) ────────────────────────────────────────

export type FoodPermissionStatus = 'granted' | 'denied' | 'undetermined';

function normalizeStatus(status: string | undefined): FoodPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Check current permission; request it only if not yet granted. Call this ONLY
 * from an explicit user action (enable food alerts / confirm outage review).
 */
export async function ensureFoodNotificationPermission(): Promise<FoodPermissionStatus> {
  const existing = await Notifications.getPermissionsAsync();
  let status = normalizeStatus(existing.status);
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = normalizeStatus(requested.status);
  }
  return status;
}

// ── scheduling / cancellation / reschedule ──────────────────────────────────────

/**
 * Schedule one local notification per enabled tracked item whose warning time is
 * in the future and has not already been scheduled/dismissed for this
 * session/item/warning level. Returns the registry of newly-active ids.
 *
 * Past warning times are NOT scheduled — the in-app warning state covers those
 * (avoids a confusing immediate buzz). Dedupe is enforced via foodDismissedWarnings.
 */
export async function scheduleFoodWarningNotifications(
  session: FoodTimerSession,
  items: TrackedFoodItem[],
): Promise<FoodDismissedWarnings> {
  const registry = readFoodDismissedWarnings();
  if (session.status !== 'active' || !session.timerSessionId) {
    return registry;
  }

  const now = Date.now();
  for (const item of items) {
    if (!item.enabled) {
      continue;
    }
    const key = registryKeyForItem(session, item);
    if (registry[key]) {
      // Already scheduled/dismissed for this session/item/warning level.
      continue;
    }
    const fireAt = getFoodWarningScheduleTime(item, session);
    if (!fireAt || fireAt.getTime() <= now) {
      // Past or unknown — rely on in-app warning state, do not schedule.
      continue;
    }
    const content = buildFoodWarningNotification(item, session);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body, data: content.data },
      trigger: { type: 'date', date: fireAt } as Notifications.NotificationTriggerInput,
    });
    registry[key] = id;
  }

  writeFoodDismissedWarnings(registry);
  return registry;
}

/**
 * Cancel scheduled food notifications. Accepts a session (cancels all entries for
 * that session id) or an explicit list of registry keys.
 */
export async function cancelFoodWarningNotifications(
  sessionOrIds: FoodTimerSession | string[],
): Promise<void> {
  const registry = readFoodDismissedWarnings();
  let keys: string[];
  if (Array.isArray(sessionOrIds)) {
    keys = sessionOrIds;
  } else {
    const sid = sessionOrIds.timerSessionId ?? '';
    keys = Object.keys(registry).filter((k) => k.startsWith(`${sid}:`));
  }
  for (const key of keys) {
    const id = registry[key];
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    delete registry[key];
  }
  writeFoodDismissedWarnings(registry);
}

/**
 * Cancel outdated food notifications for this session and schedule current ones.
 */
export async function rescheduleFoodWarningNotifications(
  session: FoodTimerSession,
  items: TrackedFoodItem[],
): Promise<FoodDismissedWarnings> {
  await cancelFoodWarningNotifications(session);
  return scheduleFoodWarningNotifications(session, items);
}

/** Cancel every active food-timer notification id stored locally. */
export async function cancelAllFoodWarningNotifications(): Promise<void> {
  const registry = readFoodDismissedWarnings();
  for (const id of Object.values(registry)) {
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }
  writeFoodDismissedWarnings({});
}
