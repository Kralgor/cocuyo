/**
 * Tests for local food spoilage warning notifications (mobile/lib/foodNotifications.ts).
 * Covers NOTF-03:
 *   - schedules a warning at outageStartedAt + threshold - lead (D-09, D-18)
 *   - does not schedule when prefs disabled / food disabled / time in past
 *   - dedupes the same session/item/warning key (T-04-04-02)
 *   - cancels scheduled ids on restoration/reset (D-16)
 *   - permission requested only via explicit calls (D-11, T-04-04-03)
 *   - permission denial is non-fatal
 *   - no Supabase/registerToken used for food alerts (D-10)
 * Offline + deterministic. expo-notifications and MMKV mocked in jest.setup.js.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { FoodTimerSession, TrackedFoodItem } from '../../lib/food';
import {
  buildFoodWarningNotification,
  cancelFoodWarningNotifications,
  ensureFoodNotificationChannelAsync,
  ensureFoodNotificationPermission,
  FOOD_NOTIFICATION_CHANNEL_ID,
  getFoodWarningScheduleTime,
  makeFoodWarningKey,
  readFoodDismissedWarnings,
  readFoodNotificationPrefs,
  rescheduleFoodWarningNotifications,
  scheduleFoodWarningNotifications,
  writeFoodNotificationPrefs,
} from '../../lib/foodNotifications';
import { STORAGE_KEYS, storage } from '../../lib/storage';

const OUTAGE_START = '2026-06-19T12:00:00.000Z';

function item(overrides: Partial<TrackedFoodItem> = {}): TrackedFoodItem {
  return {
    id: 'item-1',
    presetId: null,
    name: 'Leche',
    category: 'dairy',
    thresholdMinutes: 120,
    warningLeadMinutes: 30,
    enabled: true,
    createdAt: OUTAGE_START,
    ...overrides,
  };
}

function activeSession(overrides: Partial<FoodTimerSession> = {}): FoodTimerSession {
  return {
    status: 'active',
    zone: 'maracaibo',
    timerSessionId: 'maracaibo|' + OUTAGE_START,
    outageStartedAt: OUTAGE_START,
    source: 'status_outage_started_at',
    startedAtLocal: OUTAGE_START,
    ...overrides,
  };
}

describe('foodNotifications — pure helpers', () => {
  it('schedule time = outageStartedAt + threshold - lead (NOTF-03, D-09)', () => {
    const t = getFoodWarningScheduleTime(item(), activeSession());
    // 12:00 + (120 - 30) min = 13:30
    expect(t?.toISOString()).toBe('2026-06-19T13:30:00.000Z');
  });

  it('returns null when no active session', () => {
    expect(getFoodWarningScheduleTime(item(), activeSession({ status: 'idle' }))).toBeNull();
    expect(
      getFoodWarningScheduleTime(item(), activeSession({ outageStartedAt: null })),
    ).toBeNull();
  });

  it('warning key includes session, item, and level', () => {
    expect(makeFoodWarningKey('sess', 'it', 'warning')).toBe('sess:it:warning');
  });

  it('warning copy is cautious and names the item (D-17, T-04-04-04)', () => {
    const c = buildFoodWarningNotification(item(), activeSession());
    expect(c.title).toContain('Leche');
    expect(c.body.toLowerCase()).toContain('descarta');
    expect(c.data.kind).toBe('food_warning');
  });

  it('handles invalid prefs JSON without crashing', () => {
    storage.set(STORAGE_KEYS.foodNotificationPrefs, '{not json');
    expect(readFoodNotificationPrefs()).toEqual({ enabled: false, reviewPromptEnabled: true });
  });
});

describe('foodNotifications — scheduling + dedupe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.delete(STORAGE_KEYS.foodDismissedWarnings);
    storage.delete(STORAGE_KEYS.foodNotificationPrefs);
    // Run as Android so the food channel is created (G4).
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    // Freeze "now" before the warning fire time so future scheduling occurs.
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-19T12:00:00.000Z'));
    (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(async () =>
      'notif-' + Math.random().toString(36).slice(2),
    );
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore?.();
  });

  it('schedules a local notification for an enabled item with future warning (NOTF-03)', async () => {
    await scheduleFoodWarningNotifications(activeSession(), [item()]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const registry = readFoodDismissedWarnings();
    expect(Object.keys(registry)).toHaveLength(1);
  });

  it('creates the food Android channel before scheduling (G4)', async () => {
    await scheduleFoodWarningNotifications(activeSession(), [item()]);
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      FOOD_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({
        name: 'Comida',
        importance: Notifications.AndroidImportance.HIGH,
      }),
    );
  });

  it('passes channelId food on the trigger object (G4, Expo v56 DateTriggerInput)', async () => {
    await scheduleFoodWarningNotifications(activeSession(), [item()]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          channelId: FOOD_NOTIFICATION_CHANNEL_ID,
          type: Notifications.SchedulableTriggerInputTypes.DATE,
        }),
      }),
    );
  });

  it('does not schedule for a disabled tracked food', async () => {
    await scheduleFoodWarningNotifications(activeSession(), [item({ enabled: false })]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not schedule when the warning time is in the past', async () => {
    (Date.now as jest.Mock).mockReturnValue(Date.parse('2026-06-19T14:00:00.000Z'));
    await scheduleFoodWarningNotifications(activeSession(), [item()]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not schedule duplicate warning keys for the same session/item', async () => {
    await scheduleFoodWarningNotifications(activeSession(), [item()]);
    await scheduleFoodWarningNotifications(activeSession(), [item()]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels scheduled ids on restoration/reset (D-16)', async () => {
    const session = activeSession();
    await scheduleFoodWarningNotifications(session, [item()]);
    await cancelFoodWarningNotifications(session);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Object.keys(readFoodDismissedWarnings())).toHaveLength(0);
  });

  it('reschedule cancels then schedules current warnings', async () => {
    const session = activeSession();
    await scheduleFoodWarningNotifications(session, [item()]);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    await rescheduleFoodWarningNotifications(session, [item()]);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('foodNotifications — permission (point-of-use, D-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests permission only when explicitly called', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    const status = await ensureFoodNotificationPermission();
    expect(status).toBe('granted');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not re-request when already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    const status = await ensureFoodNotificationPermission();
    expect(status).toBe('granted');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns denied (non-fatal) when permission is refused', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    const status = await ensureFoodNotificationPermission();
    expect(status).toBe('denied');
  });
});

describe('foodNotifications — Android channel (G4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  });

  it('ensureFoodNotificationChannelAsync creates the food channel on Android', async () => {
    await ensureFoodNotificationChannelAsync();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      FOOD_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({
        name: 'Comida',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        showBadge: false,
      }),
    );
  });

  it('ensureFoodNotificationPermission creates the channel after permission is granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    await ensureFoodNotificationPermission();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      FOOD_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({ name: 'Comida' }),
    );
  });

  it('ensureFoodNotificationPermission does NOT create the channel when denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    await ensureFoodNotificationPermission();
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('foodNotifications — local-first guarantee (D-10, T-04-04-01)', () => {
  it('does not import or call any Supabase/registerToken path', () => {
    // Static guard: the module source must not reference network registration.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../lib/foodNotifications.ts'),
      'utf8',
    );
    // Strip comments so the cautionary header (which names threats) is not matched.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/registerToken/);
    expect(code).not.toMatch(/supabase/i);
    expect(code).not.toMatch(/from ['"]@?\/?lib\/api['"]/);
    expect(code).not.toMatch(/getExpoPushTokenAsync/);
  });

  it('prefs round-trip stays local in MMKV', () => {
    writeFoodNotificationPrefs({ enabled: true, reviewPromptEnabled: false });
    expect(readFoodNotificationPrefs()).toEqual({ enabled: true, reviewPromptEnabled: false });
  });
});
