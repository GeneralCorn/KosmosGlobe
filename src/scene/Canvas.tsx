import React, { useEffect, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Canvas as R3FCanvas, useFrame } from "@react-three/fiber/native";
import { Color } from "three";
import SceneRoot from "./SceneRoot";

const BACKGROUND = "#06080F";
const TEXT_SECONDARY = "#7D8590";
const VISUAL_RADIUS = 1.05;
const CAMERA_FOV_DEG = 75;
const HORIZONTAL_FILL_RATIO = 0.92;

function computeCameraZ(): number {
  const { width, height } = Dimensions.get("window");
  const aspect = width / height;
  const vFovRad = (CAMERA_FOV_DEG * Math.PI) / 180;
  const tanHalfHFov = Math.tan(vFovRad / 2) * aspect;
  const targetHalfAngle = Math.atan(tanHalfHFov) * HORIZONTAL_FILL_RATIO;
  return VISUAL_RADIUS / Math.sin(targetHalfAngle);
}

const CAMERA_Z = computeCameraZ();

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
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV_DEG, near: 0.1, far: 100 }}
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
