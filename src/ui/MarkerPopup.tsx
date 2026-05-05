import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSelectedEvent, useStore } from "../domain/store";
import { gestureState } from "../scene/gestureState";
import { bottomSheetRef } from "./bottomSheetRef";

const PALETTE: Record<string, string> = {
  geopolitics: "#FF6B4A",
  economics: "#5BA8FF",
  health: "#7FE0A8",
  other: "#B89BE8",
};

const GLANCE_WIDTH = 280;
const GLANCE_HEIGHT = 130;
const EXPANDED_HEIGHT = 264;
const POPUP_MARGIN = 12;
const TOP_THRESHOLD_RATIO = 0.22;

function formatFreshness(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m ago`;
  }
  if (hours < 24) {
    return `${Math.floor(hours)}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export default function MarkerPopup() {
  const selectedEvent = useSelectedEvent();
  const popupExpanded = useStore((s) => s.popupExpanded);
  const setPopupExpanded = useStore((s) => s.setPopupExpanded);
  const setDetailMode = useStore((s) => s.setDetailMode);

  const opacity = useSharedValue(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (selectedEvent) {
      opacity.value = withTiming(1, { duration: 150 });
      if (gestureState.hasSelectedScreen) {
        setPos({ x: gestureState.selectedScreenX, y: gestureState.selectedScreenY });
      }
      intervalRef.current = setInterval(() => {
        if (gestureState.hasSelectedScreen) {
          setPos({
            x: gestureState.selectedScreenX,
            y: gestureState.selectedScreenY,
          });
        }
      }, 67);
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [selectedEvent?.id]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const onMorePress = useCallback(() => {
    setPopupExpanded(true);
  }, [setPopupExpanded]);

  const onLessPress = useCallback(() => {
    setPopupExpanded(false);
  }, [setPopupExpanded]);

  const onFullDetailsPress = useCallback(() => {
    setDetailMode(true);
    bottomSheetRef.current?.snapToIndex(1);
  }, [setDetailMode]);

  if (!selectedEvent) {
    return null;
  }

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const popupHeight = popupExpanded ? EXPANDED_HEIGHT : GLANCE_HEIGHT;
  const inTopZone = pos.y < screenHeight * TOP_THRESHOLD_RATIO;
  const rawY = inTopZone ? pos.y + POPUP_MARGIN * 3 : pos.y - popupHeight - POPUP_MARGIN * 3;
  const clampedX = Math.max(
    POPUP_MARGIN,
    Math.min(screenWidth - GLANCE_WIDTH - POPUP_MARGIN, pos.x - GLANCE_WIDTH / 2),
  );
  const clampedY = Math.max(POPUP_MARGIN, Math.min(screenHeight - popupHeight - POPUP_MARGIN, rawY));

  const catColor = PALETTE[selectedEvent.category] ?? PALETTE.other;

  return (
    <Animated.View
      style={[styles.popup, animStyle, { left: clampedX, top: clampedY }]}
      pointerEvents="box-none"
    >
      <View style={styles.header}>
        <Text style={[styles.category, { color: catColor }]}>
          {selectedEvent.category.toUpperCase()}
        </Text>
        <Text style={styles.meta}>  ·  </Text>
        <Text style={styles.meta}>{selectedEvent.countryCode}</Text>
        <Text style={styles.meta}>  ·  </Text>
        <Text style={styles.meta}>{formatFreshness(selectedEvent.freshnessHours)}</Text>
      </View>

      <Text style={styles.title} numberOfLines={popupExpanded ? 4 : 2}>
        {selectedEvent.title}
      </Text>

      <View style={styles.severityRow}>
        <View style={styles.severityTrack}>
          <View
            style={[
              styles.severityFill,
              { width: `${selectedEvent.severity * 100}%`, backgroundColor: catColor },
            ]}
          />
        </View>
      </View>

      {popupExpanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.summary} numberOfLines={3}>
            {selectedEvent.summary}
          </Text>
          <Text style={styles.meta}>
            {selectedEvent.evidenceCount} sources
            {selectedEvent.raw.counts?.sources
              ? `  ·  ${selectedEvent.raw.counts.sources} feeds`
              : ""}
            {selectedEvent.xVolumeDelta > 0
              ? `  ·  ↑ ${selectedEvent.xVolumeDelta.toFixed(0)}%`
              : ""}
          </Text>

          {selectedEvent.raw.top_evidence?.slice(0, 2).map((ev, idx) => (
            <View key={idx} style={styles.evidenceRow}>
              <Text style={styles.evidenceSource} numberOfLines={1}>
                {ev.source_name ?? ev.source ?? "Unknown"}
              </Text>
              <Text style={styles.evidenceTitle} numberOfLines={1}>
                {ev.title ?? ""}
              </Text>
            </View>
          ))}

          <TouchableOpacity onPress={onFullDetailsPress} style={styles.fullDetailsRow}>
            <Text style={styles.affordance}>full details →</Text>
          </TouchableOpacity>
        </View>
      )}

      {!popupExpanded && (
        <TouchableOpacity onPress={onMorePress} style={styles.moreRow}>
          <Text style={styles.affordance}>more →</Text>
        </TouchableOpacity>
      )}

      {popupExpanded && !selectedEvent.raw.top_evidence?.length && (
        <TouchableOpacity onPress={onLessPress} style={styles.moreRow}>
          <Text style={styles.affordance}>← less</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: "absolute",
    width: GLANCE_WIDTH,
    backgroundColor: "rgba(10, 14, 26, 0.92)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    pointerEvents: "box-none",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  category: {
    fontFamily: "Menlo",
    fontSize: 10,
    letterSpacing: 1,
  },
  meta: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: "#7D8590",
  },
  title: {
    fontFamily: "System",
    fontSize: 13,
    color: "#E6EDF3",
    lineHeight: 18,
    marginBottom: 8,
  },
  severityRow: {
    marginBottom: 8,
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
  expandedContent: {
    marginTop: 4,
  },
  summary: {
    fontFamily: "System",
    fontSize: 12,
    color: "#7D8590",
    lineHeight: 17,
    marginBottom: 6,
  },
  evidenceRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  evidenceSource: {
    fontFamily: "Menlo",
    fontSize: 9,
    color: "#7D8590",
    letterSpacing: 0.5,
  },
  evidenceTitle: {
    fontFamily: "System",
    fontSize: 11,
    color: "#E6EDF3",
    marginTop: 1,
  },
  fullDetailsRow: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  moreRow: {
    alignItems: "flex-end",
    marginTop: 2,
  },
  affordance: {
    fontFamily: "Menlo",
    fontSize: 10,
    color: "#7D8590",
    letterSpacing: 0.3,
  },
});
