import { useThree, useFrame } from "@react-three/fiber/native";
import { Vector2 } from "three";
import type { BufferAttribute } from "three";
import { gestureState } from "./gestureState";
import { hitMeshRef } from "../layers/markers/hitMeshRef";
import { earthMeshRef, earthIsoByIndex } from "../layers/earth/earthTapTarget";
import { useStore } from "../domain/store";

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
      const cats = snapshot.filters.categories;
      const visible =
        cats && cats.length > 0
          ? snapshot.events.filter((e) => cats.includes(e.category))
          : snapshot.events;
      const hits = raycaster.intersectObject(hitMesh, false);
      if (hits.length > 0 && hits[0].instanceId != null) {
        const idx = hits[0].instanceId;
        if (idx < visible.length) {
          gestureState.selectedScreenX = tap.x;
          gestureState.selectedScreenY = tap.y;
          gestureState.hasSelectedScreen = true;
          snapshot.setSelectedSignal(visible[idx].id);
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
          snapshot.setSelectedCountry(code);
          return;
        }
      }
    }

    snapshot.setSelectedSignal(null);
    snapshot.setSelectedCountry(null);
  });

  return null;
}
