import * as Crypto from 'expo-crypto';

import type { QueuedReport, ReportPayload } from './api';
import { STORAGE_KEYS, storage } from './storage';

const COOLDOWN_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function getQueue(): QueuedReport[] {
  const raw = storage.getString(STORAGE_KEYS.reportQueue);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: QueuedReport[]): void {
  storage.set(STORAGE_KEYS.reportQueue, JSON.stringify(queue));
}

export function canEnqueue(now = Date.now()): boolean {
  const lastReportTime = storage.getNumber(STORAGE_KEYS.lastReportTime);
  if (!lastReportTime) return true;

  return now - lastReportTime >= COOLDOWN_MS;
}

export function enqueue(payload: ReportPayload): string {
  const id = Crypto.randomUUID();
  const report: QueuedReport = {
    id,
    payload,
    queued_at: new Date().toISOString(),
    attempts: 0,
  };

  saveQueue([...getQueue(), report]);
  storage.set(STORAGE_KEYS.lastReportTime, Date.now());

  return id;
}

export async function flushQueue(submitFn: (payload: ReportPayload) => Promise<unknown>): Promise<number> {
  const remaining: QueuedReport[] = [];
  let flushed = 0;

  for (const item of getQueue()) {
    if (item.attempts >= MAX_ATTEMPTS) {
      continue;
    }

    try {
      await submitFn(item.payload);
      flushed += 1;
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  saveQueue(remaining);
  return flushed;
}
