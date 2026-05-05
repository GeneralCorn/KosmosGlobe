import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import type { Group } from "three";
import Earth from "../layers/earth/Earth";
import Atmosphere from "../layers/atmosphere/Atmosphere";
import Markers from "../layers/markers/Markers";

const ROTATION_RATE = 0.05;

export default function SceneRoot() {
  const rotRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (rotRef.current) {
      rotRef.current.rotation.y += delta * ROTATION_RATE;
    }
  });
  return (
    <group ref={rotRef}>
      <Earth />
      <Atmosphere />
      <Markers />
    </group>
  );
}
