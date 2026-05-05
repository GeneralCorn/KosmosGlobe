import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import GorhomBottomSheet, {
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSelectedEvent, useStore } from "../domain/store";
import { bottomSheetRef } from "./bottomSheetRef";

const BACKGROUND = "rgba(10, 14, 26, 0.95)";
const TEXT_PRIMARY = "#E6EDF3";
const TEXT_SECONDARY = "#7D8590";
const ACCENT_RED = "#FF6B4A";

function LiveIndicator() {
  const signalCount = useStore((s) => s.events.length);
  const countryCount = useStore((s) => s.countryHeat.length);
  const now = new Date();
  const timeStr = `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")} UTC`;

  return (
    <View style={styles.peekContent}>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveLabel}>LIVE</Text>
        <Text style={styles.timestamp}>{timeStr}</Text>
      </View>
      <Text style={styles.statsLine}>
        {signalCount} signals · {countryCount} countries
      </Text>
    </View>
  );
}

function IntelligenceCenter() {
  return (
    <View style={styles.stubContent}>
      <Text style={styles.stubHeader}>TOP REGIONS</Text>
      <Text style={styles.stubText}>Region data loading in Phase 5...</Text>
      <Text style={[styles.stubHeader, { marginTop: 20 }]}>ACCELERATING ↑</Text>
      <Text style={styles.stubText}>Velocity signals in Phase 5...</Text>
      <Text style={[styles.stubHeader, { marginTop: 20 }]}>LIVE FEED</Text>
      <Text style={styles.stubText}>Evidence ticker in Phase 5...</Text>
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

  return (
    <View style={styles.stubContent}>
      <TouchableOpacity onPress={onBack} style={styles.backRow}>
        <Text style={styles.backLabel}>← overview</Text>
      </TouchableOpacity>
      <Text style={styles.detailTitle}>{selected.title}</Text>
      <Text style={styles.detailMeta}>
        {selected.category.toUpperCase()}  ·  {selected.countryCode}  ·{" "}
        {selected.evidenceCount} sources
      </Text>
      <Text style={styles.stubText}>{selected.summary}</Text>
      <Text style={[styles.stubHeader, { marginTop: 16 }]}>EVIDENCE</Text>
      <Text style={styles.stubText}>Full evidence detail in Phase 5...</Text>
    </View>
  );
}

export default function BottomSheet() {
  const detailMode = useStore((s) => s.detailMode);
  const snapPoints = useMemo(() => ["15%", "50%", "85%"], []);

  return (
    <GorhomBottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.container}>
        <LiveIndicator />
        {detailMode ? <SignalDetail /> : <IntelligenceCenter />}
      </BottomSheetView>
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
    paddingHorizontal: 20,
  },
  peekContent: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
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
  stubContent: {
    paddingTop: 4,
  },
  stubHeader: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  stubText: {
    fontFamily: "System",
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 19,
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
});
