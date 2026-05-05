import React, { useEffect, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Canvas as R3FCanvas, useFrame } from "@react-three/fiber/native";
import { Color } from "three";
import SceneRoot from "./SceneRoot";
import GestureLayer from "./GestureLayer";
import RaycasterBridge from "./RaycasterBridge";
import CameraRig from "./CameraRig";
import MarkerPopup from "../ui/MarkerPopup";
import BottomSheet from "../ui/BottomSheet";
import { gestureState } from "./gestureState";

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
gestureState.cameraZ = CAMERA_Z;

const fpsState = {
  worstDeltaMs: 0,
  frameCount: 0,
  lastWallTime: 0,
};

function FpsTracker() {
  useFrame(() => {
    const now = Date.now();
    if (fpsState.lastWallTime !== 0) {
      const wallDelta = now - fpsState.lastWallTime;
      if (wallDelta > fpsState.worstDeltaMs) fpsState.worstDeltaMs = wallDelta;
    }
    fpsState.lastWallTime = now;
    fpsState.frameCount += 1;
  });
  return null;
}

function FpsReadout() {
  const [text, setText] = useState("--");
  useEffect(() => {
    let lastFrames = 0;
    let lastWindow = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastWindow) / 1000;
      const framesThisWindow = fpsState.frameCount - lastFrames;
      const trueAvg = elapsed > 0 ? framesThisWindow / elapsed : 0;
      const worst = fpsState.worstDeltaMs;
      setText(`${trueAvg.toFixed(0)} fps · worst ${worst.toFixed(0)}ms`);
      lastFrames = fpsState.frameCount;
      lastWindow = now;
      fpsState.worstDeltaMs = 0;
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.fpsWrap} pointerEvents="none">
      <Text style={styles.fpsText}>{text}</Text>
    </View>
  );
}

export default function Canvas() {
  return (
    <View style={styles.root}>
      <GestureLayer>
        <R3FCanvas
          style={styles.canvas}
          gl={{ antialias: false, alpha: false, powerPreference: "default" }}
          scene={{ background: new Color(BACKGROUND) }}
          camera={{
            position: [0, 0, CAMERA_Z],
            fov: CAMERA_FOV_DEG,
            near: 0.1,
            far: 100,
          }}
        >
          <SceneRoot />
          <FpsTracker />
          <RaycasterBridge />
          <CameraRig />
        </R3FCanvas>
      </GestureLayer>
      <MarkerPopup />
      <BottomSheet />
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
