import type { Category, CountryHeat, NewsEvent } from "./types";

const MARKER_RGB: Record<Category, [number, number, number]> = {
  geopolitics: [1.0, 0.4196, 0.2902],
  economics: [0.3569, 0.6588, 1.0],
  health: [0.498, 0.878, 0.659],
  other: [0.7216, 0.6078, 0.9098],
};

export function clusterBoost(_target: NewsEvent, _all: NewsEvent[]): number {
  return 0;
}

export function markerSize(event: NewsEvent, boost: number): number {
  const base = 0.02;
  const severityScale = 0.05;
  return base + event.severity * severityScale + boost * 0.01;
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
