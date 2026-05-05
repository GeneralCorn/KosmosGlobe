import { useFrame, useThree } from "@react-three/fiber/native";
import { Vector3 } from "three";
import { gestureState, lerpAngle } from "./gestureState";
import { globeGroupRef } from "./globeGroupRef";
import { setVector3FromLatLng } from "../layers/earth/latlng";
import { markerOrbitRadius } from "../domain/encodings";
import { useStore } from "../domain/store";

const LERP_FACTOR = 0.09;
const SELECTION_CAMERA_Z = 1.65;
const STOP_THRESHOLD = 0.0015;

const markerVec = new Vector3();
const tempVec = new Vector3();

let currentLerpTargetId: string | null = null;
let prevFlyTarget: { lat: number; lng: number } | null = null;
let targetRotX = 0;
let targetRotY = 0;

function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export default function CameraRig() {
  const { size, camera } = useThree();

  useFrame(() => {
    const snapshot = useStore.getState();
    const selId = snapshot.selectedSignalId;
    const flyTo = snapshot.flyToTarget;

    let ev = null;
    if (selId) {
      const evts = snapshot.events;
      for (let i = 0; i < evts.length; i += 1) {
        if (evts[i].id === selId) {
          ev = evts[i];
          break;
        }
      }
    }

    const group = globeGroupRef.current;
    const targetPos = ev ? ev.position : (flyTo ?? null);
    const targetId = ev ? ev.id : (flyTo ? "fly" : null);

    const hasNewTarget =
      targetPos !== null &&
      (!gestureState.isLerpingToSelection ||
        (ev ? ev.id !== currentLerpTargetId : flyTo !== prevFlyTarget));

    if (hasNewTarget) {
      currentLerpTargetId = targetId;
      prevFlyTarget = flyTo ?? null;
      setVector3FromLatLng(markerVec, targetPos!.lat, targetPos!.lng, 1);
      const mx = markerVec.x;
      const my = markerVec.y;
      const mz = markerVec.z;
      targetRotY = Math.atan2(-mx, mz);
      targetRotX = Math.atan2(my, Math.sqrt(mx * mx + mz * mz));
      gestureState.isLerpingToSelection = true;
      if (ev && !gestureState.isInteracting) {
        gestureState.targetCameraZ = SELECTION_CAMERA_Z;
      }
    }

    if (!targetPos) {
      currentLerpTargetId = null;
      prevFlyTarget = null;
      gestureState.isLerpingToSelection = false;
    }

    if (gestureState.isLerpingToSelection && group) {
      gestureState.rotX = lerpAngle(gestureState.rotX, targetRotX, LERP_FACTOR);
      gestureState.rotY = lerpAngle(gestureState.rotY, targetRotY, LERP_FACTOR);
      group.rotation.set(gestureState.rotX, gestureState.rotY, 0);

      const dx = Math.abs(angleDelta(gestureState.rotX, targetRotX));
      const dy = Math.abs(angleDelta(gestureState.rotY, targetRotY));
      if (dx < STOP_THRESHOLD && dy < STOP_THRESHOLD) {
        gestureState.rotX = targetRotX;
        gestureState.rotY = targetRotY;
        group.rotation.set(targetRotX, targetRotY, 0);
        gestureState.isLerpingToSelection = false;
        if (flyTo) snapshot.setFlyToTarget(null);
      }
    }

    if (ev && group) {
      setVector3FromLatLng(tempVec, ev.position.lat, ev.position.lng, markerOrbitRadius(ev));
      tempVec.applyQuaternion(group.quaternion);
      tempVec.project(camera);
      gestureState.selectedScreenX = (tempVec.x * 0.5 + 0.5) * size.width;
      gestureState.selectedScreenY = (-tempVec.y * 0.5 + 0.5) * size.height;
      gestureState.hasSelectedScreen = tempVec.z < 1;
    } else {
      gestureState.hasSelectedScreen = false;
    }
  });

  return null;
}
