import React from "react";
import { useFrame } from "@react-three/fiber/native";
import Earth from "../layers/earth/Earth";
import Atmosphere from "../layers/atmosphere/Atmosphere";
import Markers from "../layers/markers/Markers";
import { gestureState } from "./gestureState";
import { globeGroupRef } from "./globeGroupRef";

const AUTO_ROTATION_RATE = 0.05;
const IDLE_RESUME_MS = 0;

export default function SceneRoot() {
  useFrame((state, delta) => {
    const group = globeGroupRef.current;
    if (!group) {
      return;
    }

    const now = Date.now();
    const idle =
      !gestureState.isInteracting &&
      !gestureState.isLerpingToSelection &&
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
    </group>
  );
}
