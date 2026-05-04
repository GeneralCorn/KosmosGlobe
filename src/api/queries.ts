import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CountryHeat,
  ExplorerOverviewResponse,
  ExplorerStats,
  GlobeActivityResponse,
  NewsEvent,
  SignalsTopResponse,
} from "../domain/types";
import { globeCountryToHeat, signalsToEvents } from "../domain/mapping";
import { useStore } from "../domain/store";
import { fetchKosmos } from "./client";

const STALE_MS = 30_000;
const REFETCH_MS = 60_000;

const PATHS = {
  signalsTop: "/api/v2/signals?sort=top&limit=50",
  globeActivity: "/api/v2/globe/activity?limit=50",
  explorerOverview: "/api/v2/explorer/overview",
} as const;

export function useSignalsTop() {
  return useQuery<SignalsTopResponse, Error, NewsEvent[]>({
    queryKey: ["kosmos", "signals", "top", 50],
    queryFn: () => fetchKosmos<SignalsTopResponse>(PATHS.signalsTop),
    select: (data) => signalsToEvents(data.signals),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useGlobeActivity() {
  return useQuery<GlobeActivityResponse, Error, CountryHeat[]>({
    queryKey: ["kosmos", "globe", "activity", 50],
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
    }),
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useSyncStoreFromQueries(): void {
  const signals = useSignalsTop();
  const globe = useGlobeActivity();
  const setEvents = useStore((s) => s.setEvents);
  const setCountryHeat = useStore((s) => s.setCountryHeat);

  useEffect(() => {
    if (signals.data) {
      setEvents(signals.data);
    }
  }, [signals.data, setEvents]);

  useEffect(() => {
    if (globe.data) {
      setCountryHeat(globe.data);
    }
  }, [globe.data, setCountryHeat]);
}
