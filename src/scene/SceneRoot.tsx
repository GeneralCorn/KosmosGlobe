import React from "react";
import { useFrame } from "@react-three/fiber/native";
import Earth from "../layers/earth/Earth";
import Atmosphere from "../layers/atmosphere/Atmosphere";
import Markers from "../layers/markers/Markers";
import Pulses from "../layers/pulses/Pulses";
import Arcs from "../layers/arcs/Arcs";
import { gestureState } from "./gestureState";
import { globeGroupRef } from "./globeGroupRef";
import { useStore } from "../domain/store";

const AUTO_ROTATION_RATE = 0.05;
const IDLE_RESUME_MS = 0;
const DEFAULT_CAMERA_Z = 2.2;
const CAM_LERP = 0.05;

export default function SceneRoot() {
  useFrame((state, delta) => {
    const group = globeGroupRef.current;
    if (!group) {
      return;
    }

    if (!gestureState.isInteracting) {
      const dz = gestureState.targetCameraZ - gestureState.cameraZ;
      if (Math.abs(dz) > 0.001) {
        gestureState.cameraZ += dz * CAM_LERP;
      }
    }

    const hasSelection = useStore.getState().selectedSignalId !== null;
    const now = Date.now();
    const atDefaultZoom = gestureState.cameraZ >= DEFAULT_CAMERA_Z * 0.95;
    const idle =
      !gestureState.isInteracting &&
      !gestureState.isLerpingToSelection &&
      !hasSelection &&
      atDefaultZoom &&
      now - gestureState.lastInteractionTime > IDLE_RESUME_MS;

    if (idle) {
      gestureState.rotY += delta * AUTO_ROTATION_RATE;
    }

    if (!gestureState.isLerpingToSelection) {
      group.rotation.x = gestureState.rotX;
      group.rotation.y = gestureState.rotY;
    }

    state.camera.position.z = gestureState.cameraZ;
  });

  return (
    <group ref={globeGroupRef}>
      <Earth />
      <Atmosphere />
      <Markers />
      <Pulses />
      <Arcs />
    </group>
  );
}
