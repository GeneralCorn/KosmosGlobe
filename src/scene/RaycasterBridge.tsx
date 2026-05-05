import { useThree, useFrame } from "@react-three/fiber/native";
import { Vector2 } from "three";
import { gestureState } from "./gestureState";
import { hitMeshRef } from "../layers/markers/hitMeshRef";
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

    const hitMesh = hitMeshRef.current;
    if (!hitMesh) {
      return;
    }

    ndcVec.x = (tap.x / size.width) * 2 - 1;
    ndcVec.y = -(tap.y / size.height) * 2 + 1;

    raycaster.setFromCamera(ndcVec, camera);
    const hits = raycaster.intersectObject(hitMesh, false);

    const snapshot = useStore.getState();
    const cats = snapshot.filters.categories;
    const visible =
      cats && cats.length > 0
        ? snapshot.events.filter((e) => cats.includes(e.category))
        : snapshot.events;

    if (hits.length > 0 && hits[0].instanceId != null) {
      const idx = hits[0].instanceId;
      if (idx < visible.length) {
        snapshot.setSelectedSignal(visible[idx].id);
        return;
      }
    }
    snapshot.setSelectedSignal(null);
  });

  return null;
}
