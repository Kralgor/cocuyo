import * as Location from 'expo-location';

import { REGIONS } from './regions';

const MAX_ZONE_DISTANCE_KM = 150;
const LOCATION_TIMEOUT_MS = 10_000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestZone(lat: number, lon: number): string | null {
  let nearestKey: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [key, region] of Object.entries(REGIONS)) {
    const distance = haversineKm(lat, lon, region.lat, region.lon);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestKey = key;
    }
  }

  return nearestDistance <= MAX_ZONE_DISTANCE_KM ? nearestKey : null;
}

export async function detectNearestZone(): Promise<string | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted && permission.status !== 'granted') {
      return null;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('location timeout')), LOCATION_TIMEOUT_MS);
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    return findNearestZone(position.coords.latitude, position.coords.longitude);
  } catch {
    return null;
  }
}
