import { useThree, useFrame } from "@react-three/fiber/native";
import { Vector2 } from "three";
import type { BufferAttribute } from "three";
import { gestureState } from "./gestureState";
import { hitMeshRef } from "../layers/markers/hitMeshRef";
import { clusterEventId, clusterBridge, clusterPX, clusterPY, clusterPZ } from "../layers/markers/clusterState";
import { earthMeshRef, earthIsoByIndex } from "../layers/earth/earthTapTarget";
import { getCentroid } from "../lib/countryCentroids";
import { useStore } from "../domain/store";

const CLUSTER_ZOOM_FACTOR = 0.6;
const CAMERA_CLOSE_MIN = 1.6;
const RAD_TO_DEG = 180 / Math.PI;

const ndcVec = new Vector2();

export default function RaycasterBridge() {
  const { size, camera, raycaster } = useThree();

  useFrame(() => {
    const tap = gestureState.pendingTap;
    if (!tap) {
      return;
    }
    gestureState.pendingTap = null;

    ndcVec.x = (tap.x / size.width) * 2 - 1;
    ndcVec.y = -(tap.y / size.height) * 2 + 1;

    raycaster.setFromCamera(ndcVec, camera);

    const snapshot = useStore.getState();

    const hitMesh = hitMeshRef.current;
    if (hitMesh) {
      const hits = raycaster.intersectObject(hitMesh, false);
      if (hits.length > 0 && hits[0].instanceId != null) {
        const idx = hits[0].instanceId;
        if (idx < clusterBridge.renderCount) {
          const evId = clusterEventId[idx];
          if (evId) {
            gestureState.selectedScreenX = tap.x;
            gestureState.selectedScreenY = tap.y;
            gestureState.hasSelectedScreen = true;
            snapshot.setSelectedSignal(evId);
          } else {
            const newZ = Math.max(CAMERA_CLOSE_MIN, gestureState.cameraZ * CLUSTER_ZOOM_FACTOR);
            gestureState.targetCameraZ = newZ;
            const lat = Math.asin(clusterPY[idx]) * RAD_TO_DEG;
            const lng = -Math.atan2(clusterPZ[idx], clusterPX[idx]) * RAD_TO_DEG;
            snapshot.setFlyToTarget({ lat, lng });
          }
          return;
        }
      }
    }

    const earthMesh = earthMeshRef.current;
    if (earthMesh) {
      const earthHits = raycaster.intersectObject(earthMesh, false);
      if (earthHits.length > 0 && earthHits[0].face) {
        const attr = earthMesh.geometry.getAttribute("countryIndex") as BufferAttribute;
        const ci = Math.round(attr.getX(earthHits[0].face.a));
        const code = earthIsoByIndex[ci];
        if (code) {
          const hasHeat = snapshot.countryHeat.some((h) => h.code === code);
          if (hasHeat) {
            snapshot.setSelectedCountry(code);
            const centroid = getCentroid(code);
            if (centroid) {
              snapshot.setFlyToTarget(centroid);
            }
            return;
          }
        }
      }
    }

    snapshot.setSelectedSignal(null);
    snapshot.setSelectedCountry(null);
  });

  return null;
}
