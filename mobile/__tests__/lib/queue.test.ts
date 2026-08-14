import { STORAGE_KEYS, storage } from '../../lib/storage';
import { canEnqueue, enqueue, flushQueue } from '../../lib/queue';

const payload = {
  region: 'maracaibo',
  status: 'no_power' as const,
  lat: 10.6427,
  lon: -71.6125,
  city_freetext: null,
  onset_type: null,
  symptom: null,
  device_fingerprint: null,
  parroquia: 'Bolivar',
};

describe('report queue', () => {
  beforeEach(() => {
    storage.delete(STORAGE_KEYS.reportQueue);
    storage.delete(STORAGE_KEYS.lastReportTime);
  });

  it('enqueues reports with uuid, timestamp, and zero attempts', () => {
    const id = enqueue(payload);
    const queue = JSON.parse(storage.getString(STORAGE_KEYS.reportQueue) ?? '[]');

    expect(id).toBe('mock-uuid-1234');
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id, payload, attempts: 0 });
    expect(typeof queue[0].queued_at).toBe('string');
  });

  it('blocks duplicate enqueue attempts inside the 30 minute cooldown', () => {
    const now = Date.now();
    storage.set(STORAGE_KEYS.lastReportTime, now - 5 * 60 * 1000);

    expect(canEnqueue(now)).toBe(false);
  });

  it('flushes queued reports and removes successful submissions', async () => {
    enqueue(payload);
    const submitFn = jest.fn().mockResolvedValue({ ok: true });

    await expect(flushQueue(submitFn)).resolves.toBe(1);
    expect(submitFn).toHaveBeenCalledWith(payload);
    expect(JSON.parse(storage.getString(STORAGE_KEYS.reportQueue) ?? '[]')).toEqual([]);
  });
});
