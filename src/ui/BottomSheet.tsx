import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GorhomBottomSheet, {
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useExplorerOverview, useGlobeRegion } from "../api/queries";
import {
  useCountryHeat,
  useSelectedEvent,
  useStore,
} from "../domain/store";
import { getCentroid } from "../lib/countryCentroids";
import type { Category, Evidence, NewsEvent } from "../domain/types";
import { bottomSheetRef } from "./bottomSheetRef";

const BACKGROUND = "rgba(10, 14, 26, 0.95)";
const TEXT_PRIMARY = "#E6EDF3";
const TEXT_SECONDARY = "#7D8590";
const ACCENT_RED = "#FF6B4A";

const CAT_COLOR: Record<Category, string> = {
  geopolitics: "#FF6B4A",
  economics: "#5BA8FF",
  health: "#7FE0A8",
  other: "#B89BE8",
};

function formatNum(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(Math.round(n));
}

function formatFreshness(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m ago`;
  }
  if (hours < 24) {
    return `${Math.floor(hours)}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

function getUTCTime(): string {
  const now = new Date();
  return `${now.getUTCHours().toString().padStart(2, "0")}:${now
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")} UTC`;
}

function heatColor(score: number): string {
  const r = Math.round(0x5a + (0xe8 - 0x5a) * score);
  const g = Math.round(0x24 + (0x97 - 0x24) * score);
  const b = Math.round(0x18 + (0x5d - 0x18) * score);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatHHMM(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}`;
  } catch {
    return "--:--";
  }
}

function evidenceLabel(e: Evidence): string {
  if (e.source_type === "twitter" || e.evidence_type === "tweet") {
    return "TWEET";
  }
  if (e.evidence_type === "market_signal") {
    return "DATA";
  }
  return "NEWS";
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function LiveIndicator() {
  const { data: stats } = useExplorerOverview();
  const [timeStr, setTimeStr] = useState(getUTCTime);

  useEffect(() => {
    const id = setInterval(() => setTimeStr(getUTCTime()), 1000);
    return () => clearInterval(id);
  }, []);

  const statsLine = stats
    ? `${formatNum(stats.activeSignals)} signals · ${stats.activeCountries} countries · ${formatNum(stats.evidence24h)} evidence/24h`
    : "loading...";

  return (
    <View style={styles.peekContent}>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveLabel}>LIVE</Text>
        <Text style={styles.timestamp}>{timeStr}</Text>
      </View>
      <Text style={styles.statsLine}>{statsLine}</Text>
    </View>
  );
}

function TopRegions() {
  const heat = useCountryHeat();
  const setFlyToTarget = useStore((s) => s.setFlyToTarget);

  const top4 = useMemo(
    () => [...heat].sort((a, b) => b.heatScore - a.heatScore).slice(0, 4),
    [heat],
  );

  if (top4.length === 0) {
    return null;
  }

  const maxHeat = top4[0]?.heatScore ?? 1;

  return (
    <View style={styles.section}>
      <SectionHeader label="TOP REGIONS" />
      {top4.map((c) => (
        <TouchableOpacity
          key={c.code}
          style={styles.regionRow}
          onPress={() => {
            const centroid = getCentroid(c.code);
            if (centroid) {
              setFlyToTarget(centroid);
            }
          }}
        >
          <Text style={styles.regionCode}>{c.code}</Text>
          <Text style={styles.regionName} numberOfLines={1}>
            {c.name ?? c.code}
          </Text>
          <View style={styles.heatBarTrack}>
            <View
              style={[
                styles.heatBarFill,
                {
                  width: (c.heatScore / maxHeat) * 60,
                  backgroundColor: heatColor(c.heatScore),
                },
              ]}
            />
          </View>
          <Text style={styles.regionScore}>{c.heatScore.toFixed(2)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function BreakingHeadlines() {
  const { data: stats } = useExplorerOverview();
  const headlines = stats?.breakingNews?.slice(0, 3) ?? [];

  if (headlines.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader label="BREAKING" />
      {headlines.map((h, i) => (
        <TouchableOpacity
          key={h.id ?? i}
          style={[styles.headlineRow, i > 0 && styles.dividerTop]}
          onPress={() => {
            if (h.url) {
              Linking.openURL(h.url);
            }
          }}
        >
          <View style={styles.headlineMeta}>
            <Text style={styles.headlineBadge}>NEWS</Text>
            {h.occurred_at && (
              <Text style={styles.headlineTime}>
                {formatFreshness(
                  (Date.now() - new Date(h.occurred_at).getTime()) / 3_600_000,
                )}
              </Text>
            )}
          </View>
          <Text style={styles.headlineTitle} numberOfLines={2}>
            {h.title ?? ""}
          </Text>
          {h.source_name && (
            <Text style={styles.headlineSource}>{h.source_name}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SourceMix({ events }: { events: NewsEvent[] }) {
  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const ev of events) {
      for (const e of ev.raw.top_evidence ?? []) {
        const key = e.evidence_type ?? "other";
        acc[key] = (acc[key] ?? 0) + 1;
      }
    }
    return acc;
  }, [events]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return null;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <View style={styles.section}>
      <SectionHeader label="SOURCE MIX" />
      {sorted.map(([type, count]) => (
        <View key={type} style={styles.mixRow}>
          <Text style={styles.mixLabel}>{type.replace(/_/g, " ")}</Text>
          <View style={styles.mixBarTrack}>
            <View
              style={[
                styles.mixBarFill,
                { width: `${Math.round((count / total) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.mixPct}>
            {Math.round((count / total) * 100)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

function AcceleratingSignals({ events }: { events: NewsEvent[] }) {
  const setSelectedSignal = useStore((s) => s.setSelectedSignal);

  const accelerating = useMemo(
    () =>
      [...events]
        .filter((e) => e.xVolumeDelta > 0)
        .sort((a, b) => b.xVolumeDelta - a.xVolumeDelta)
        .slice(0, 5),
    [events],
  );

  if (accelerating.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader label="ACCELERATING ↑" />
      {accelerating.map((ev) => (
        <TouchableOpacity
          key={ev.id}
          style={styles.velRow}
          onPress={() => setSelectedSignal(ev.id)}
        >
          <Text style={styles.velPct}>
            ↑ {ev.xVolumeDelta.toFixed(0)}%
          </Text>
          <Text style={styles.velCode}>{ev.countryCode}</Text>
          <Text style={styles.velTitle} numberOfLines={1}>
            {ev.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function LiveTicker({ events }: { events: NewsEvent[] }) {
  const items = useMemo(() => {
    const all: Array<{
      key: string;
      time: string;
      label: string;
      code: string;
      text: string;
    }> = [];
    for (const ev of events) {
      const evidence = [
        ...(ev.raw.top_evidence ?? []),
        ...(ev.raw.top_twitter_evidence ?? []),
      ];
      for (const e of evidence) {
        if (!e.title || !e.occurred_at) {
          continue;
        }
        all.push({
          key: `${e.id ?? e.occurred_at}-${ev.id}`,
          time: formatHHMM(e.occurred_at),
          label: evidenceLabel(e),
          code: ev.countryCode,
          text: e.title,
        });
      }
    }
    all.sort((a, b) => b.time.localeCompare(a.time));
    return all.slice(0, 15);
  }, [events]);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader label="LIVE FEED" />
      <ScrollView
        style={styles.tickerScroll}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <View key={item.key} style={styles.tickerRow}>
            <Text style={styles.tickerTime}>{item.time}</Text>
            <View style={styles.tickerBadge}>
              <Text style={styles.tickerBadgeText}>{item.label}</Text>
            </View>
            <Text style={styles.tickerCode}>{item.code}</Text>
            <Text style={styles.tickerText} numberOfLines={1}>
              {item.text}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function FilterRail() {
  const filters = useStore((s) => s.filters);
  const toggleCategory = useStore((s) => s.toggleCategory);
  const events = useStore((s) => s.events);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const ev of events) {
      acc[ev.category] = (acc[ev.category] ?? 0) + 1;
    }
    return acc;
  }, [events]);

  const cats: Category[] = ["geopolitics", "economics", "health", "other"];
  const active = filters.categories;

  return (
    <View style={styles.section}>
      <SectionHeader label="FILTER" />
      <View style={styles.railRow}>
        {cats.map((cat) => {
          const isActive = !active || active.includes(cat);
          const color = CAT_COLOR[cat];
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.pill,
                isActive
                  ? { backgroundColor: `${color}33`, borderColor: color }
                  : styles.pillInactive,
              ]}
              onPress={() => toggleCategory(cat)}
            >
              <View
                style={[styles.pillDot, { backgroundColor: isActive ? color : TEXT_SECONDARY }]}
              />
              <Text
                style={[styles.pillLabel, isActive && { color }]}
                numberOfLines={1}
              >
                {cat}
              </Text>
              <Text style={styles.pillCount}>{counts[cat] ?? 0}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function IntelligenceCenter() {
  const events = useStore((s) => s.events);

  return (
    <View>
      <TopRegions />
      <BreakingHeadlines />
      <SourceMix events={events} />
      <AcceleratingSignals events={events} />
      <LiveTicker events={events} />
      <FilterRail />
      <View style={styles.bottomPad} />
    </View>
  );
}

function MarketChip({ event }: { event: NewsEvent }) {
  const market = event.raw.primary_market;
  if (!market) {
    return null;
  }
  if (event.severity < 0.4 && event.category === "other") {
    return null;
  }

  const isOther = event.category === "other";
  const yesPrice =
    typeof market["yes_price"] === "number" ? (market["yes_price"] as number) : null;
  const pricePct = yesPrice !== null ? `${Math.round(yesPrice * 100)}%` : null;
  const priceColor =
    isOther
      ? TEXT_SECONDARY
      : yesPrice !== null && yesPrice > 0.5
        ? "#7FE0A8"
        : ACCENT_RED;
  const marketUrl =
    typeof market["url"] === "string" ? (market["url"] as string) : null;

  return (
    <View style={[styles.marketChipContainer, isOther && { opacity: 0.4 }]}>
      <Text style={styles.marketChipLabel}>LINKED MARKET</Text>
      <Text style={styles.marketChipTitle} numberOfLines={2}>
        {String(market.title ?? "")}
      </Text>
      <View style={styles.marketChipRow}>
        {pricePct !== null && (
          <Text style={[styles.marketChipPrice, { color: priceColor }]}>
            {pricePct}{"  "}YES
          </Text>
        )}
        {!isOther && marketUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(marketUrl)}>
            <Text style={styles.marketChipLink}>view market →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SignalDetail() {
  const selected = useSelectedEvent();
  const setDetailMode = useStore((s) => s.setDetailMode);
  const setSelectedSignal = useStore((s) => s.setSelectedSignal);

  const onBack = useCallback(() => {
    setDetailMode(false);
    setSelectedSignal(null);
    bottomSheetRef.current?.snapToIndex(0);
  }, [setDetailMode, setSelectedSignal]);

  if (!selected) {
    return null;
  }

  const catColor = CAT_COLOR[selected.category];
  const newsCount =
    selected.raw.top_evidence?.filter(
      (e) => e.evidence_type !== "market_signal",
    ).length ?? 0;
  const tweetCount = selected.raw.top_twitter_evidence?.length ?? 0;

  return (
    <View style={styles.stubContent}>
      <TouchableOpacity onPress={onBack} style={styles.backRow}>
        <Text style={styles.backLabel}>← overview</Text>
      </TouchableOpacity>

      <Text style={styles.detailTitle}>{selected.title}</Text>
      <Text style={styles.detailMeta}>
        {selected.category.toUpperCase()}{"  ·  "}
        {selected.countryCode}{"  ·  "}
        {formatFreshness(selected.freshnessHours)}
      </Text>

      <View style={styles.detailSeverityRow}>
        <View style={styles.severityTrack}>
          <View
            style={[
              styles.severityFill,
              {
                width: `${selected.severity * 100}%`,
                backgroundColor: catColor,
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.detailStat}>
        {selected.evidenceCount} sources · {newsCount} news · {tweetCount}{" "}
        tweets
      </Text>

      {selected.xVolumeDelta > 0 && (
        <Text style={[styles.detailStat, { color: ACCENT_RED }]}>
          ↑ {selected.xVolumeDelta.toFixed(0)}% in 24h
        </Text>
      )}

      {selected.raw.top_evidence?.slice(0, 3).map((ev, idx) => (
        <View
          key={idx}
          style={[styles.evidenceRow, idx > 0 && styles.dividerTop]}
        >
          <Text style={styles.evidenceSource}>
            {ev.source_name ?? ev.source ?? "Unknown"}
          </Text>
          <Text style={styles.evidenceTitle} numberOfLines={2}>
            {ev.title ?? ""}
          </Text>
          {ev.occurred_at && (
            <Text style={styles.evidenceMeta}>
              {formatFreshness(
                (Date.now() - new Date(ev.occurred_at).getTime()) / 3_600_000,
              )}
            </Text>
          )}
        </View>
      ))}

      <MarketChip event={selected} />

      <View style={styles.bottomPad} />
    </View>
  );
}

function CountryDetail() {
  const selectedCountryCode = useStore((s) => s.selectedCountryCode);
  const setSelectedCountry = useStore((s) => s.setSelectedCountry);
  const { data, isLoading } = useGlobeRegion(selectedCountryCode);

  const onBack = useCallback(() => {
    setSelectedCountry(null);
    bottomSheetRef.current?.snapToIndex(0);
  }, [setSelectedCountry]);

  if (!selectedCountryCode) {
    return null;
  }

  const country = data?.country;
  const signals = data?.signals?.slice(0, 5) ?? [];
  const markets = data?.markets?.filter((m) => (m["yes_price"] as number | undefined) !== undefined).slice(0, 3) ?? [];

  return (
    <View style={styles.stubContent}>
      <TouchableOpacity onPress={onBack} style={styles.backRow}>
        <Text style={styles.backLabel}>← globe</Text>
      </TouchableOpacity>

      <View style={styles.countryHeaderRow}>
        <Text style={styles.countryCode}>{selectedCountryCode}</Text>
        {country?.region_group && (
          <Text style={styles.countryRegion}>
            {"  ·  "}{country.region_group.replace(/_/g, " ")}
          </Text>
        )}
      </View>

      {country && (
        <Text style={styles.detailStat}>
          {country.active_signals?.toLocaleString() ?? "—"} active signals
          {"  ·  "}
          {country.active_markets ?? "—"} markets
          {"  ·  "}
          heat {country.heat_score?.toFixed(2) ?? "—"}
        </Text>
      )}

      {isLoading && <Text style={styles.detailStat}>loading...</Text>}

      {signals.length > 0 && (
        <View style={styles.section}>
          <SectionHeader label="TOP SIGNALS" />
          {signals.map((s, idx) => (
            <View key={s.id} style={[styles.evidenceRow, idx > 0 && styles.dividerTop]}>
              <Text style={styles.evidenceTitle} numberOfLines={2}>{s.title}</Text>
              <Text style={styles.evidenceMeta}>
                {s.severity?.toFixed(2) ?? "—"} severity
              </Text>
            </View>
          ))}
        </View>
      )}

      {markets.length > 0 && (
        <View style={styles.section}>
          <SectionHeader label="TOP MARKETS" />
          {markets.map((m, idx) => {
            const yesPrice = m["yes_price"] as number | undefined;
            const pricePct = yesPrice !== undefined ? `${Math.round(yesPrice * 100)}%` : null;
            const priceColor = yesPrice !== undefined && yesPrice > 0.5 ? "#7FE0A8" : ACCENT_RED;
            const mUrl = m["url"] as string | undefined;
            return (
              <TouchableOpacity
                key={String(m.id)}
                style={[styles.velRow, idx > 0 && styles.dividerTop]}
                disabled={!mUrl}
                onPress={() => mUrl && Linking.openURL(mUrl)}
              >
                <Text style={styles.velTitle} numberOfLines={1}>
                  {String(m.title ?? "")}
                </Text>
                {pricePct && (
                  <Text style={[styles.marketChipPrice, { color: priceColor }]}>
                    {pricePct} YES
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.bottomPad} />
    </View>
  );
}

export default function BottomSheet() {
  const detailMode = useStore((s) => s.detailMode);
  const selectedCountryCode = useStore((s) => s.selectedCountryCode);
  const snapPoints = useMemo(() => ["15%", "50%", "85%"], []);

  useEffect(() => {
    if (selectedCountryCode) {
      bottomSheetRef.current?.snapToIndex(1);
    }
  }, [selectedCountryCode]);

  return (
    <GorhomBottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <LiveIndicator />
        {detailMode
          ? <SignalDetail />
          : selectedCountryCode
            ? <CountryDetail />
            : <IntelligenceCenter />
        }
      </BottomSheetScrollView>
    </GorhomBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: BACKGROUND,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  peekContent: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 4,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_RED,
    marginRight: 6,
  },
  liveLabel: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: ACCENT_RED,
    letterSpacing: 1.5,
    marginRight: 10,
  },
  timestamp: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
  },
  statsLine: {
    fontFamily: "Menlo",
    fontSize: 11,
    color: TEXT_SECONDARY,
    letterSpacing: 0.3,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  regionCode: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    width: 24,
  },
  regionName: {
    fontFamily: "System",
    fontSize: 12,
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  heatBarTrack: {
    width: 60,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
    marginRight: 8,
  },
  heatBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  regionScore: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    width: 32,
    textAlign: "right",
  },
  headlineRow: {
    paddingVertical: 8,
  },
  headlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  headlineBadge: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 0.8,
    marginRight: 8,
  },
  headlineTime: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
  },
  headlineTitle: {
    fontFamily: "System",
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 18,
    marginBottom: 3,
  },
  headlineSource: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
  },
  mixRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  mixLabel: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    width: 96,
  },
  mixBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
    marginRight: 8,
  },
  mixBarFill: {
    height: "100%",
    backgroundColor: "rgba(230,237,243,0.4)",
    borderRadius: 2,
  },
  mixPct: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    width: 30,
    textAlign: "right",
  },
  velRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  velPct: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: ACCENT_RED,
    width: 60,
  },
  velCode: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    width: 28,
  },
  velTitle: {
    fontFamily: "System",
    fontSize: 12,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  tickerScroll: {
    maxHeight: 180,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  tickerTime: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    width: 36,
  },
  tickerBadge: {
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginRight: 5,
  },
  tickerBadgeText: {
    fontFamily: "Menlo",
    fontSize: 8,
    color: TEXT_SECONDARY,
    letterSpacing: 0.3,
  },
  tickerCode: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    width: 22,
  },
  tickerText: {
    fontFamily: "System",
    fontSize: 11,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  railRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  pillInactive: {
    borderColor: "rgba(255,255,255,0.15)",
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillLabel: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 0.3,
  },
  pillCount: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
  },
  bottomPad: {
    height: 24,
  },
  stubContent: {
    paddingTop: 4,
  },
  backRow: {
    marginBottom: 14,
  },
  backLabel: {
    fontFamily: "Menlo",
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  detailTitle: {
    fontFamily: "System",
    fontSize: 17,
    color: TEXT_PRIMARY,
    lineHeight: 24,
    marginBottom: 6,
  },
  detailMeta: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailSeverityRow: {
    marginBottom: 10,
  },
  severityTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  severityFill: {
    height: "100%",
    borderRadius: 2,
    opacity: 0.7,
  },
  detailStat: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  evidenceRow: {
    paddingVertical: 6,
  },
  evidenceSource: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  evidenceTitle: {
    fontFamily: "System",
    fontSize: 12,
    color: TEXT_PRIMARY,
    lineHeight: 17,
  },
  evidenceMeta: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  marketChipContainer: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 12,
  },
  marketChipLabel: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  marketChipTitle: {
    fontFamily: "System",
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 18,
    marginBottom: 8,
  },
  marketChipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketChipPrice: {
    fontFamily: "Menlo",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  marketChipLink: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
  },
  dividerTop: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  countryHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  countryCode: {
    fontFamily: "Menlo",
    fontSize: 22,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
  },
  countryRegion: {
    fontFamily: "Menlo",
    fontSize: 11,
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
  },
});
