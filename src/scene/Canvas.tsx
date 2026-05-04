import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas as R3FCanvas, useFrame } from "@react-three/fiber/native";
import { Color } from "three";
import SceneRoot from "./SceneRoot";

const BACKGROUND = "#06080F";
const TEXT_SECONDARY = "#7D8590";

const fpsState = { current: 0 };

function FpsTracker() {
  useFrame((_, delta) => {
    if (delta > 0) {
      const inst = 1 / delta;
      fpsState.current =
        fpsState.current === 0 ? inst : fpsState.current * 0.9 + inst * 0.1;
    }
  });
  return null;
}

function FpsReadout() {
  const [text, setText] = useState("--.-");
  useEffect(() => {
    const id = setInterval(() => {
      setText(fpsState.current.toFixed(1));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.fpsWrap} pointerEvents="none">
      <Text style={styles.fpsText}>{text} FPS</Text>
    </View>
  );
}

export default function Canvas() {
  return (
    <View style={styles.root}>
      <R3FCanvas
        style={styles.canvas}
        gl={{ antialias: false, alpha: false, powerPreference: "default" }}
        scene={{ background: new Color(BACKGROUND) }}
      >
        <SceneRoot />
        <FpsTracker />
      </R3FCanvas>
      <FpsReadout />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  canvas: {
    flex: 1,
  },
  fpsWrap: {
    position: "absolute",
    top: 56,
    right: 16,
  },
  fpsText: {
    color: TEXT_SECONDARY,
    fontFamily: "Menlo",
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
