import type { Category, CountryHeat, NewsEvent } from "./types";

export const MARKER_RGB: Record<Category, [number, number, number]> = {
  geopolitics: [1.0, 0.4196, 0.2902],
  economics: [0.3569, 0.6588, 1.0],
  health: [0.498, 0.878, 0.659],
  other: [0.7216, 0.6078, 0.9098],
};

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function markerOrbitRadius(event: NewsEvent): number {
  const base = 1.05;
  const severityRange = 0.025;
  const hashRange = 0.015;
  const hashFloat = fnv1a(event.id) / 0x100000000;
  return base + event.severity * severityRange + hashFloat * hashRange;
}

export function clusterBoost(_target: NewsEvent, _all: NewsEvent[]): number {
  return 1.0;
}

export function markerSize(event: NewsEvent, boost: number): number {
  const base = 0.012;
  const severityScale = 0.018;
  return (base + event.severity * severityScale) * boost;
}

export function markerColor(event: NewsEvent): [number, number, number] {
  return MARKER_RGB[event.category];
}

export function markerEmission(event: NewsEvent): number {
  const halfLifeHours = 24;
  return 1 / (1 + event.freshnessHours / halfLifeHours);
}

export function shouldPulse(event: NewsEvent): boolean {
  return event.freshnessHours < 1;
}

export function countryTint(heat: CountryHeat): number {
  return Math.max(0, Math.min(1, heat.heatScore));
}

export function countryHeatTint(
  countryCode: string,
  events: NewsEvent[],
  countryHeat: CountryHeat[],
): number {
  let conflictCount = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].countryCode === countryCode && events[i].category === "geopolitics") {
      conflictCount++;
    }
  }
  const conflictWeight = Math.min(conflictCount / 5, 1.0);
  let baseHeat = 0;
  for (let i = 0; i < countryHeat.length; i++) {
    if (countryHeat[i].code === countryCode) {
      baseHeat = countryHeat[i].heatScore;
      break;
    }
  }
  return Math.min(conflictWeight * 0.7 + baseHeat * 0.6, 1.0);
}
