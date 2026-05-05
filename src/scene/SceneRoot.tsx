import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import type { Group } from "three";
import Earth from "../layers/earth/Earth";
import Atmosphere from "../layers/atmosphere/Atmosphere";
import Markers from "../layers/markers/Markers";
import { gestureState } from "./gestureState";

const AUTO_ROTATION_RATE = 0.05;
const IDLE_RESUME_MS = 5000;

export default function SceneRoot() {
  const rotRef = useRef<Group>(null);

  useFrame((state, delta) => {
    const group = rotRef.current;
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

    group.rotation.x = gestureState.rotX;
    group.rotation.y = gestureState.rotY;
    state.camera.position.z = gestureState.cameraZ;
  });

  return (
    <group ref={rotRef}>
      <Earth />
      <Atmosphere />
      <Markers />
    </group>
  );
}
