import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CountryHeat,
  ExplorerOverviewResponse,
  ExplorerStats,
  GlobeActivityResponse,
  GlobeRegionResponse,
  NewsEvent,
  SignalsTopResponse,
} from "../domain/types";
import { globeCountryToHeat, signalsToEvents } from "../domain/mapping";
import { useStore } from "../domain/store";
import { fetchKosmos } from "./client";

const STALE_MS = 30_000;
const REFETCH_MS = 60_000;

const PATHS = {
  signalsTop: "/api/v2/signals?sort=top&limit=100",
  signalsVelocity: "/api/v2/signals?sort=velocity&limit=25",
  globeActivity: "/api/v2/globe/activity?limit=100",
  explorerOverview: "/api/v2/explorer/overview",
} as const;

export function useSignalsTop() {
  return useQuery<SignalsTopResponse, Error, NewsEvent[]>({
    queryKey: ["kosmos", "signals", "top", 100],
    queryFn: () => fetchKosmos<SignalsTopResponse>(PATHS.signalsTop),
    select: (data) => signalsToEvents(data.signals),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useSignalsVelocity() {
  return useQuery<SignalsTopResponse, Error, NewsEvent[]>({
    queryKey: ["kosmos", "signals", "velocity", 25],
    queryFn: () => fetchKosmos<SignalsTopResponse>(PATHS.signalsVelocity),
    select: (data) => signalsToEvents(data.signals),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useGlobeActivity() {
  return useQuery<GlobeActivityResponse, Error, CountryHeat[]>({
    queryKey: ["kosmos", "globe", "activity", 100],
    queryFn: () => fetchKosmos<GlobeActivityResponse>(PATHS.globeActivity),
    select: (data) => data.countries.map(globeCountryToHeat),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useExplorerOverview() {
  return useQuery<ExplorerOverviewResponse, Error, ExplorerStats>({
    queryKey: ["kosmos", "explorer", "overview"],
    queryFn: () =>
      fetchKosmos<ExplorerOverviewResponse>(PATHS.explorerOverview),
    select: (data) => ({
      activeSignals: data.stats.active_signals,
      activeMarkets: data.stats.active_markets,
      evidence24h: data.stats.evidence_24h,
      tweetEvidence24h: data.stats.tweet_evidence_24h,
      totalVolume24h: data.stats.total_volume_24h,
      activeCountries: data.stats.active_countries,
      breakingNews: data.breaking_news ?? [],
    }),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useGlobeRegion(countryCode: string | null) {
  return useQuery<GlobeRegionResponse, Error>({
    queryKey: ["kosmos", "globe", "region", countryCode],
    queryFn: () =>
      fetchKosmos<GlobeRegionResponse>(`/api/v2/globe/region/${countryCode}`),
    enabled: countryCode !== null,
    staleTime: STALE_MS,
  });
}

const MAX_EVENTS = 150;

export function useSyncStoreFromQueries(): void {
  const signals = useSignalsTop();
  const velocity = useSignalsVelocity();
  const globe = useGlobeActivity();
  const setEvents = useStore((s) => s.setEvents);
  const setCountryHeat = useStore((s) => s.setCountryHeat);

  useEffect(() => {
    const top = signals.data ?? [];
    const vel = velocity.data ?? [];
    if (top.length === 0 && vel.length === 0) {
      return;
    }
    const seen = new Set<string>();
    const merged: NewsEvent[] = [];
    for (const e of top) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        merged.push(e);
      }
    }
    for (const e of vel) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        merged.push(e);
      }
    }
    setEvents(merged.slice(0, MAX_EVENTS));
  }, [signals.data, velocity.data, setEvents]);

  useEffect(() => {
    if (globe.data) {
      setCountryHeat(globe.data);
    }
  }, [globe.data, setCountryHeat]);
}
