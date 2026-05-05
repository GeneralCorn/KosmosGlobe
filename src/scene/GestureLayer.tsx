import React, { useMemo } from "react";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { gestureState } from "./gestureState";

const PAN_SENSITIVITY = 0.006;
const MAX_TILT = 1.2;
const CAMERA_CLOSE = 1.5;
const CAMERA_FAR = 5.0;

export default function GestureLayer({
  children,
}: {
  children: React.ReactNode;
}) {
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(5)
        .runOnJS(true)
        .onBegin(() => {
          gestureState.isInteracting = true;
          gestureState.isLerpingToSelection = false;
          gestureState.lastInteractionTime = Date.now();
        })
        .onChange((e) => {
          gestureState.rotY += e.changeX * PAN_SENSITIVITY;
          gestureState.rotX = Math.max(
            -MAX_TILT,
            Math.min(MAX_TILT, gestureState.rotX + e.changeY * PAN_SENSITIVITY),
          );
          gestureState.lastInteractionTime = Date.now();
        })
        .onEnd(() => {
          gestureState.isInteracting = false;
          gestureState.lastInteractionTime = Date.now();
        }),
    [],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onBegin(() => {
          gestureState.isInteracting = true;
          gestureState.isLerpingToSelection = false;
          gestureState.pinchStartZ = gestureState.cameraZ;
          gestureState.lastInteractionTime = Date.now();
        })
        .onChange((e) => {
          const z = gestureState.pinchStartZ / Math.max(e.scale, 0.01);
          gestureState.cameraZ = Math.max(CAMERA_CLOSE, Math.min(CAMERA_FAR, z));
          gestureState.lastInteractionTime = Date.now();
        })
        .onEnd(() => {
          gestureState.isInteracting = false;
          gestureState.lastInteractionTime = Date.now();
        }),
    [],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .runOnJS(true)
        .onEnd((e, success) => {
          if (success) {
            gestureState.pendingTap = { x: e.x, y: e.y };
          }
        }),
    [],
  );

  const combinedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture, tapGesture),
    [panGesture, pinchGesture, tapGesture],
  );

  return (
    <GestureDetector gesture={combinedGesture}>{children}</GestureDetector>
  );
}
