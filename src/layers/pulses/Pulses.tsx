import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { useStore } from "../../domain/store";
import { setVector3FromLatLng } from "../earth/latlng";

const PULSE_SPEED = 0.35;
const RING_BASE_SCALE = 0.022;
const RING_MAX_SCALE = 0.10;

const Z_FORWARD = new Vector3(0, 0, 1);
const tempVec = new Vector3();
const tempQuat = new Quaternion();

export default function Pulses() {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const phaseRef = useRef(0);
  const hasTargetRef = useRef(false);
  const lastVersionRef = useRef(-1);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const snap = useStore.getState();

    if (snap.version !== lastVersionRef.current) {
      lastVersionRef.current = snap.version;

      let minFreshness = 2;
      let targetLat = 0;
      let targetLng = 0;
      let found = false;

      const events = snap.events;
      for (let i = 0; i < events.length; i++) {
        if (events[i].freshnessHours < minFreshness) {
          minFreshness = events[i].freshnessHours;
          targetLat = events[i].position.lat;
          targetLng = events[i].position.lng;
          found = true;
        }
      }

      if (found) {
        setVector3FromLatLng(tempVec, targetLat, targetLng, 1.006);
        mesh.position.copy(tempVec);
        tempVec.normalize();
        tempQuat.setFromUnitVectors(Z_FORWARD, tempVec);
        mesh.quaternion.copy(tempQuat);
        hasTargetRef.current = true;
      } else {
        hasTargetRef.current = false;
      }
    }

    if (!hasTargetRef.current) {
      mat.opacity = 0;
      return;
    }

    phaseRef.current = (phaseRef.current + delta * PULSE_SPEED) % 1;
    const t = phaseRef.current;
    mesh.scale.setScalar(RING_BASE_SCALE + t * (RING_MAX_SCALE - RING_BASE_SCALE));
    mat.opacity = (1 - t) * 0.65;
  });

  return (
    <mesh ref={meshRef}>
      <ringGeometry args={[0.65, 1.0, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color="#FFFFFF"
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}
