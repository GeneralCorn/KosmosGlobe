import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { useStore } from "../../domain/store";
import {
  clusterBoost,
  markerColor,
  markerEmission,
  markerOrbitRadius,
  markerSize,
} from "../../domain/encodings";
import { setVector3FromLatLng } from "../earth/latlng";

const MAX_INSTANCES = 100;
const RENDER_CAP = 50;
const PULSE_FREQ = 0.5;
const PULSE_AMPLITUDE = 0.1;
const EMISSION_FLOOR = 0.55;

const tempVec = new Vector3();
const tempScale = new Vector3();
const tempMat = new Matrix4();
const tempColor = new Color();
const IDENTITY_QUAT = new Quaternion();

export default function Markers() {
  const meshRef = useRef<InstancedMesh>(null);
  const lastVersionRef = useRef(-1);
  const pulseIndexRef = useRef(-1);
  const pulseBaseScaleRef = useRef(0);
  const pulseBasePosRef = useRef<Vector3>(new Vector3());

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const snapshot = useStore.getState();
    const version = snapshot.version;

    if (version !== lastVersionRef.current) {
      lastVersionRef.current = version;
      const events = snapshot.events;
      const cats = snapshot.filters.categories;
      const visible =
        cats && cats.length > 0
          ? events.filter((e) => cats.includes(e.category))
          : events;

      const count = Math.min(visible.length, RENDER_CAP);
      let mostRecentIdx = -1;
      let lowestFreshness = Infinity;

      for (let i = 0; i < count; i += 1) {
        const ev = visible[i];
        setVector3FromLatLng(
          tempVec,
          ev.position.lat,
          ev.position.lng,
          markerOrbitRadius(ev),
        );

        const boost = clusterBoost(ev, visible);
        const size = markerSize(ev, boost);
        tempScale.set(size, size, size);

        tempMat.compose(tempVec, IDENTITY_QUAT, tempScale);
        mesh.setMatrixAt(i, tempMat);

        const rgb = markerColor(ev);
        const emission = markerEmission(ev);
        const brightness = EMISSION_FLOOR + (1 - EMISSION_FLOOR) * emission;
        tempColor.setRGB(
          rgb[0] * brightness,
          rgb[1] * brightness,
          rgb[2] * brightness,
        );
        mesh.setColorAt(i, tempColor);

        if (ev.freshnessHours < lowestFreshness) {
          lowestFreshness = ev.freshnessHours;
          mostRecentIdx = i;
        }
      }

      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }

      if (mostRecentIdx >= 0) {
        pulseIndexRef.current = mostRecentIdx;
        const ev = visible[mostRecentIdx];
        setVector3FromLatLng(
          pulseBasePosRef.current,
          ev.position.lat,
          ev.position.lng,
          markerOrbitRadius(ev),
        );
        const boost = clusterBoost(ev, visible);
        pulseBaseScaleRef.current = markerSize(ev, boost);
      } else {
        pulseIndexRef.current = -1;
      }
    }

    const pulseIdx = pulseIndexRef.current;
    if (pulseIdx >= 0) {
      const t = state.clock.elapsedTime;
      const factor =
        1 + Math.sin(t * Math.PI * 2 * PULSE_FREQ) * PULSE_AMPLITUDE;
      const s = pulseBaseScaleRef.current * factor;
      tempScale.set(s, s, s);
      tempMat.compose(pulseBasePosRef.current, IDENTITY_QUAT, tempScale);
      mesh.setMatrixAt(pulseIdx, tempMat);
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_INSTANCES]}
      count={0}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
