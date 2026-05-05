import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { useStore } from "../../domain/store";
import { MARKER_RGB, markerEmission } from "../../domain/encodings";
import {
  buildClusterTree,
  walkClusterTree,
  thresholdFromCameraZ,
} from "./clustering";
import {
  clusterPX,
  clusterPY,
  clusterPZ,
  clusterCnt,
  clusterCatIdx,
  clusterEventIdx,
  clusterEventId,
  clusterOrbit,
  clusterSeverity,
  clusterFreshness,
  clusterBridge,
  MAX_RENDER,
} from "./clusterState";
import { hitMeshRef } from "./hitMeshRef";

const MAX_INSTANCES = MAX_RENDER;
const RENDER_CAP = 50;
const HIT_SCALE = 2.2;
const PULSE_FREQ = 0.5;
const PULSE_AMPLITUDE = 0.08;
const EMISSION_FLOOR = 0.55;
const BASE_SIZE = 0.009;
const SEVERITY_RANGE = 0.008;
const CLUSTER_BASE = 0.012;
const CLUSTER_LOG_SCALE = 0.0025;
const REFERENCE_CAMERA_Z = 2.2;
const MIN_SIZE_SCALE = 0.45;

const tempVec = new Vector3();
const tempScale = new Vector3();
const hitTempScale = new Vector3();
const tempMat = new Matrix4();
const tempColor = new Color();
const IDENTITY_QUAT = new Quaternion();

const CAT_RGB: [number, number, number][] = [
  MARKER_RGB.geopolitics,
  MARKER_RGB.economics,
  MARKER_RGB.health,
  MARKER_RGB.other,
];

function markerWorldSize(count: number, severity: number): number {
  if (count === 1) {
    return BASE_SIZE + severity * SEVERITY_RANGE;
  }
  return 0.015 + Math.log2(count) * CLUSTER_LOG_SCALE;
}

export default function Markers() {
  const meshRef = useRef<InstancedMesh>(null);
  const lastVersionRef = useRef(-1);
  const lastCameraZRef = useRef(-1);
  const pulseIndexRef = useRef(-1);
  const pulseBaseScaleRef = useRef(0);
  const pulseBasePosRef = useRef<Vector3>(new Vector3());

  useFrame((state) => {
    const mesh = meshRef.current;
    const hitMesh = hitMeshRef.current;
    if (!mesh) return;

    const snapshot = useStore.getState();
    const version = snapshot.version;
    const cameraZ = state.camera.position.z;
    const threshold = thresholdFromCameraZ(cameraZ);

    const versionChanged = version !== lastVersionRef.current;
    const zoomChanged = Math.abs(cameraZ - lastCameraZRef.current) > 0.05;

    if (versionChanged || zoomChanged) {
      if (versionChanged) {
        lastVersionRef.current = version;
        const events = snapshot.events;
        const cats = snapshot.filters.categories;
        const visible =
          cats && cats.length > 0
            ? events.filter((e) => cats.includes(e.category))
            : events;
        const n = Math.min(visible.length, RENDER_CAP);
        buildClusterTree(visible as any, n);
      }

      lastCameraZRef.current = cameraZ;

      const n = walkClusterTree(
        threshold,
        clusterPX,
        clusterPY,
        clusterPZ,
        clusterCnt,
        clusterCatIdx,
        clusterEventIdx,
        clusterEventId,
        clusterOrbit,
        clusterSeverity,
        clusterFreshness,
        MAX_INSTANCES,
      );
      clusterBridge.renderCount = n;

      let pulseLocalIdx = -1;
      let minFreshness = 2;

      for (let i = 0; i < n; i++) {
        const count = clusterCnt[i];
        const orbit = clusterOrbit[i];
        const size = markerWorldSize(count, clusterSeverity[i]);

        tempVec.set(clusterPX[i] * orbit, clusterPY[i] * orbit, clusterPZ[i] * orbit);
        tempScale.set(size, size, size);
        tempMat.compose(tempVec, IDENTITY_QUAT, tempScale);
        mesh.setMatrixAt(i, tempMat);

        if (hitMesh) {
          hitTempScale.set(size * HIT_SCALE, size * HIT_SCALE, size * HIT_SCALE);
          tempMat.compose(tempVec, IDENTITY_QUAT, hitTempScale);
          hitMesh.setMatrixAt(i, tempMat);
        }

        const rgb = CAT_RGB[clusterCatIdx[i]] ?? CAT_RGB[3];
        let brightness: number;
        if (count === 1) {
          const freshness = clusterFreshness[i];
          const emission = markerEmission({ freshnessHours: freshness } as any);
          brightness = EMISSION_FLOOR + (1 - EMISSION_FLOOR) * emission;
        } else {
          brightness = EMISSION_FLOOR + 0.2;
        }
        tempColor.setRGB(rgb[0] * brightness, rgb[1] * brightness, rgb[2] * brightness);
        mesh.setColorAt(i, tempColor);

        if (clusterFreshness[i] < minFreshness) {
          minFreshness = clusterFreshness[i];
          pulseLocalIdx = i;
        }
      }

      // Zero out unused slots
      for (let i = n; i < mesh.count; i++) {
        tempScale.set(0, 0, 0);
        tempMat.compose(tempVec, IDENTITY_QUAT, tempScale);
        mesh.setMatrixAt(i, tempMat);
      }

      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      if (hitMesh) {
        hitMesh.count = n;
        hitMesh.instanceMatrix.needsUpdate = true;
      }

      pulseIndexRef.current = pulseLocalIdx;
      if (pulseLocalIdx >= 0) {
        const r = clusterOrbit[pulseLocalIdx];
        pulseBasePosRef.current.set(
          clusterPX[pulseLocalIdx] * r,
          clusterPY[pulseLocalIdx] * r,
          clusterPZ[pulseLocalIdx] * r,
        );
        pulseBaseScaleRef.current = markerWorldSize(1, clusterSeverity[pulseLocalIdx]);
      }
    }

    const pulseIdx = pulseIndexRef.current;
    if (pulseIdx >= 0) {
      const t = state.clock.elapsedTime;
      const factor = 1 + Math.sin(t * Math.PI * 2 * PULSE_FREQ) * PULSE_AMPLITUDE;
      const s = pulseBaseScaleRef.current * factor;
      tempScale.set(s, s, s);
      tempMat.compose(pulseBasePosRef.current, IDENTITY_QUAT, tempScale);
      mesh.setMatrixAt(pulseIdx, tempMat);
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh
        ref={hitMeshRef as React.RefObject<InstancedMesh>}
        args={[undefined, undefined, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial visible={false} />
      </instancedMesh>
    </>
  );
}
