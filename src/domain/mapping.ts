import type {
  Category,
  CountryHeat,
  GlobeCountry,
  NewsEvent,
  SignalCard,
} from "./types";
import { getCentroid } from "../lib/countryCentroids";

const CATEGORY_TABLE: Record<string, Category> = {
  geopolitics: "geopolitics",
  politics: "geopolitics",
  conflict: "geopolitics",
  war: "geopolitics",
  military: "geopolitics",
  defense: "geopolitics",
  economics: "economics",
  economy: "economics",
  business: "economics",
  crypto: "economics",
  finance: "economics",
  markets: "economics",
  trade: "economics",
  health: "health",
  climate: "health",
  environment: "health",
  disaster: "health",
  natural_disaster: "health",
  weather: "health",
  pandemic: "health",
  medicine: "health",
};

const seenUnknownCategories = new Set<string>();

export function categoryToBucket(raw: string | null | undefined): Category {
  if (!raw) {
    return "other";
  }
  const key = raw.toLowerCase().trim();
  const mapped = CATEGORY_TABLE[key];
  if (mapped) {
    return mapped;
  }
  if (__DEV__ && !seenUnknownCategories.has(key)) {
    seenUnknownCategories.add(key);
    console.warn(`[kosmos] unmapped category "${key}" -> "other"`);
  }
  return "other";
}

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function jitter(
  seed: string,
  amplitude = 2.5,
): { lat: number; lng: number } {
  const h = fnv1a(seed);
  const latRaw = (h >>> 16) / 0x10000;
  const lngRaw = (h & 0xffff) / 0x10000;
  return {
    lat: (latRaw * 2 - 1) * amplitude,
    lng: (lngRaw * 2 - 1) * amplitude,
  };
}

export function signalToEvent(signal: SignalCard): NewsEvent | null {
  const centroid = getCentroid(signal.country);
  if (!centroid) {
    return null;
  }
  const j = jitter(signal.id);
  return {
    id: signal.id,
    title: signal.title,
    summary: signal.summary,
    countryCode: signal.country!.toUpperCase(),
    position: {
      lat: centroid.lat + j.lat,
      lng: centroid.lng + j.lng,
    },
    category: categoryToBucket(signal.category),
    severity: signal.severity ?? 0,
    momentum: signal.momentum ?? 0,
    freshnessHours: signal.freshness_hours ?? 0,
    evidenceCount: signal.counts?.evidence ?? 0,
    xVolumeDelta: signal.x_volume?.delta_pct ?? 0,
    primaryMarketId: signal.primary_market?.id ?? null,
    raw: signal,
  };
}

export function signalsToEvents(signals: SignalCard[]): NewsEvent[] {
  const events: NewsEvent[] = [];
  for (const s of signals) {
    const ev = signalToEvent(s);
    if (ev) {
      events.push(ev);
    }
  }
  return events;
}

export function globeCountryToHeat(c: GlobeCountry): CountryHeat {
  return {
    code: c.country.toUpperCase(),
    heatScore: c.heat_score ?? 0,
    name: c.name,
  };
}
