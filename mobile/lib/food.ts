// ── food spoilage domain model (Phase 4) ───────────────────────────────────────
// Pure, local, offline. Compact basic-grocery presets (D-01, D-02, D-14),
// Spanish-first labels and cautious copy (D-03, D-17), lightweight custom foods
// (D-12), quick remove/reset (D-13), MMKV-only persistence (D-06).
//
// Safety stance (D-17, threat T-04-01-03): warnings fire BEFORE the hard
// threshold. Copy never guarantees food is safe and never claims to know the
// fridge/freezer temperature — these are conservative time-since-outage hints,
// not measurements.
import * as Crypto from 'expo-crypto';

import { STORAGE_KEYS, storage } from './storage';

// ── types ────────────────────────────────────────────────────────────────────

export type FoodCategory =
  | 'dairy'
  | 'meat'
  | 'eggs'
  | 'leftovers'
  | 'prepared'
  | 'produce'
  | 'freezer';

export type FoodPresetId =
  | 'milk'
  | 'cheese'
  | 'eggs'
  | 'raw_chicken'
  | 'raw_beef'
  | 'cooked_leftovers'
  | 'cooked_rice'
  | 'arepas_dough'
  | 'vegetables'
  | 'full_freezer'
  | 'half_freezer';

export type FoodWarningLevel = 'safe' | 'warning' | 'expired';

export interface FoodPreset {
  id: FoodPresetId;
  /** Spanish-first display label (D-03). */
  name: string;
  category: FoodCategory;
  /** Minutes from outage start until the food should be considered unsafe. */
  thresholdMinutes: number;
  /** Minutes of lead time before threshold when a warning begins (D-17). */
  warningLeadMinutes: number;
  /** Concise cautious copy — no safety guarantee, no temperature claim. */
  cautionText: string;
}

export interface TrackedFoodItem {
  /** Locally generated unique id. */
  id: string;
  /** Preset id when created from a preset; null for custom items. */
  presetId: FoodPresetId | null;
  name: string;
  category: FoodCategory | null;
  thresholdMinutes: number;
  warningLeadMinutes: number;
  enabled: boolean;
  /** ISO timestamp of when the item was added to tracking. */
  createdAt: string;
}

export interface CustomFoodInput {
  name: string;
  thresholdMinutes: number;
  category?: FoodCategory;
  warningLeadMinutes?: number;
}

export type ValidateResult = { ok: true } | { ok: false; message: string };

export interface FoodTimerProgress {
  elapsedMinutes: number;
  remainingMinutes: number;
  percent: number;
  level: FoodWarningLevel;
}

// ── preset catalog (D-01, D-02, D-14) ──────────────────────────────────────────
// Compact set of common Venezuelan household perishables. Thresholds are
// conservative and easy to reason about; warning leads always sit below the
// threshold (D-17). Not pantry management — planner discretion (D-14).
export const FOOD_PRESETS: readonly FoodPreset[] = [
  {
    id: 'milk',
    name: 'Leche',
    category: 'dairy',
    thresholdMinutes: 120,
    warningLeadMinutes: 45,
    cautionText: 'La leche se daña rápido sin frío. Revísala antes de usarla.',
  },
  {
    id: 'cheese',
    name: 'Queso',
    category: 'dairy',
    thresholdMinutes: 240,
    warningLeadMinutes: 60,
    cautionText: 'Los quesos frescos aguantan poco fuera del frío.',
  },
  {
    id: 'eggs',
    name: 'Huevos',
    category: 'eggs',
    thresholdMinutes: 180,
    warningLeadMinutes: 45,
    cautionText: 'Si los huevos estaban refrigerados, no los dejes mucho tibios.',
  },
  {
    id: 'raw_chicken',
    name: 'Pollo crudo',
    category: 'meat',
    thresholdMinutes: 120,
    warningLeadMinutes: 45,
    cautionText: 'El pollo crudo es muy delicado. Cocínalo pronto o no lo uses.',
  },
  {
    id: 'raw_beef',
    name: 'Carne cruda',
    category: 'meat',
    thresholdMinutes: 150,
    warningLeadMinutes: 45,
    cautionText: 'La carne cruda se dañará si pasa mucho tiempo sin frío.',
  },
  {
    id: 'cooked_leftovers',
    name: 'Sobras cocidas',
    category: 'leftovers',
    thresholdMinutes: 120,
    warningLeadMinutes: 30,
    cautionText: 'Las comidas ya preparadas se dañan rápido a temperatura ambiente.',
  },
  {
    id: 'cooked_rice',
    name: 'Arroz cocido',
    category: 'prepared',
    thresholdMinutes: 120,
    warningLeadMinutes: 30,
    cautionText: 'El arroz cocido puede dañarse pronto si no está frío.',
  },
  {
    id: 'arepas_dough',
    name: 'Masa de arepa',
    category: 'prepared',
    thresholdMinutes: 240,
    warningLeadMinutes: 45,
    cautionText: 'La masa refrigerada aguanta poco tibia. Úsala pronto.',
  },
  {
    id: 'vegetables',
    name: 'Verduras y frutas',
    category: 'produce',
    thresholdMinutes: 480,
    warningLeadMinutes: 60,
    cautionText: 'Las verduras aguantan más, pero revisa las más delicadas.',
  },
  {
    id: 'full_freezer',
    name: 'Congelador lleno',
    category: 'freezer',
    thresholdMinutes: 2880, // ~48h
    warningLeadMinutes: 240,
    cautionText: 'Un congelador lleno mantiene el frío más tiempo si no lo abres.',
  },
  {
    id: 'half_freezer',
    name: 'Congelador medio',
    category: 'freezer',
    thresholdMinutes: 1440, // ~24h
    warningLeadMinutes: 180,
    cautionText: 'Un congelador a medio llenar pierde frío más rápido.',
  },
] as const;

const PRESET_BY_ID: Readonly<Record<FoodPresetId, FoodPreset>> = FOOD_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<FoodPresetId, FoodPreset>,
);

// ── custom food validation (D-12, FOOD-02) ─────────────────────────────────────
const MIN_THRESHOLD_MINUTES = 15;
const MAX_THRESHOLD_MINUTES = 72 * 60; // 72 hours
const DEFAULT_WARNING_LEAD_MINUTES = 30;

export function validateCustomFood(input: CustomFoodInput): ValidateResult {
  const name = (input.name ?? '').trim();
  if (name.length === 0) {
    return { ok: false, message: 'Escribe un nombre para la comida.' };
  }
  const threshold = input.thresholdMinutes;
  if (!Number.isFinite(threshold) || threshold < MIN_THRESHOLD_MINUTES) {
    return { ok: false, message: 'El tiempo debe ser de al menos 15 minutos.' };
  }
  if (threshold > MAX_THRESHOLD_MINUTES) {
    return { ok: false, message: 'El tiempo no puede ser mayor a 72 horas.' };
  }
  if (input.warningLeadMinutes !== undefined && input.warningLeadMinutes >= threshold) {
    return { ok: false, message: 'El aviso debe ocurrir antes del límite.' };
  }
  return { ok: true };
}

// ── tracked item factories (FOOD-01, FOOD-02) ──────────────────────────────────

function newId(): string {
  return Crypto.randomUUID();
}

export function createTrackedFoodFromPreset(
  presetId: FoodPresetId,
  nowIso: string,
): TrackedFoodItem {
  const preset = PRESET_BY_ID[presetId];
  if (!preset) {
    throw new Error(`Unknown food preset: ${presetId}`);
  }
  return {
    id: newId(),
    presetId: preset.id,
    name: preset.name,
    category: preset.category,
    thresholdMinutes: preset.thresholdMinutes,
    warningLeadMinutes: preset.warningLeadMinutes,
    enabled: true,
    createdAt: nowIso,
  };
}

export function createCustomTrackedFood(
  input: CustomFoodInput,
  nowIso: string,
): TrackedFoodItem {
  const name = (input.name ?? '').trim().replace(/\s+/g, ' ');
  const warningLeadMinutes =
    input.warningLeadMinutes !== undefined
      ? input.warningLeadMinutes
      : Math.min(DEFAULT_WARNING_LEAD_MINUTES, Math.max(1, Math.floor(input.thresholdMinutes / 4)));
  return {
    id: newId(),
    presetId: null,
    name,
    category: input.category ?? null,
    thresholdMinutes: input.thresholdMinutes,
    warningLeadMinutes,
    enabled: true,
    createdAt: nowIso,
  };
}

// ── timer classification (FOOD-04, D-17) ────────────────────────────────────────

function elapsedMinutesFrom(outageStartedAt: string, now: string): number {
  const start = Date.parse(outageStartedAt);
  const cur = Date.parse(now);
  if (Number.isNaN(start) || Number.isNaN(cur)) {
    return 0;
  }
  return Math.max(0, (cur - start) / 60000);
}

export function classifyFoodTimer(
  item: TrackedFoodItem,
  outageStartedAt: string,
  now: string,
): FoodWarningLevel {
  const elapsed = elapsedMinutesFrom(outageStartedAt, now);
  if (elapsed >= item.thresholdMinutes) {
    return 'expired';
  }
  if (elapsed >= item.thresholdMinutes - item.warningLeadMinutes) {
    return 'warning';
  }
  return 'safe';
}

export function getFoodTimerProgress(
  item: TrackedFoodItem,
  outageStartedAt: string,
  now: string,
): FoodTimerProgress {
  const elapsed = elapsedMinutesFrom(outageStartedAt, now);
  const remaining = Math.max(0, item.thresholdMinutes - elapsed);
  const percent =
    item.thresholdMinutes > 0
      ? Math.min(100, Math.max(0, (elapsed / item.thresholdMinutes) * 100))
      : 100;
  return {
    elapsedMinutes: elapsed,
    remainingMinutes: remaining,
    percent,
    level: classifyFoodTimer(item, outageStartedAt, now),
  };
}

// ── MMKV persistence helpers (D-06, D-13, FOOD-04) ──────────────────────────────
// Read storage only when called — never at module load. Defensive parsing per
// threat T-04-01-01: corrupt/tampered JSON returns [] and never throws. Local
// only — no api.ts / network imports (T-04-01-02).

export function readTrackedFoodItems(): TrackedFoodItem[] {
  const raw = storage.getString(STORAGE_KEYS.foodTrackedItems);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (it): it is TrackedFoodItem =>
        it != null &&
        typeof it === 'object' &&
        typeof it.id === 'string' &&
        typeof it.thresholdMinutes === 'number',
    );
  } catch {
    return [];
  }
}

export function writeTrackedFoodItems(items: TrackedFoodItem[]): void {
  storage.set(STORAGE_KEYS.foodTrackedItems, JSON.stringify(items));
}

export function upsertTrackedFoodItem(item: TrackedFoodItem): TrackedFoodItem[] {
  const items = readTrackedFoodItems();
  const idx = items.findIndex((it) => it.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  writeTrackedFoodItems(items);
  return items;
}

export function removeTrackedFoodItem(id: string): TrackedFoodItem[] {
  const items = readTrackedFoodItems().filter((it) => it.id !== id);
  writeTrackedFoodItems(items);
  return items;
}

export function resetTrackedFoodItems(): void {
  writeTrackedFoodItems([]);
}
