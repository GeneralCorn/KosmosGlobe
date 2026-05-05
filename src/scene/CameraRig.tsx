import { useFrame, useThree } from "@react-three/fiber/native";
import { Quaternion, Vector3 } from "three";
import { gestureState } from "./gestureState";
import { globeGroupRef } from "./globeGroupRef";
import { setVector3FromLatLng } from "../layers/earth/latlng";
import { markerOrbitRadius } from "../domain/encodings";
import { useStore } from "../domain/store";

const LERP_FACTOR = 0.08;
const STOP_THRESHOLD = 0.0002;

const markerLocalPos = new Vector3();
const targetQuat = new Quaternion();
const CAMERA_FORWARD = new Vector3(0, 0, 1);
const tempVec = new Vector3();

let currentLerpTargetId: string | null = null;

export default function CameraRig() {
  const { size, camera } = useThree();

  useFrame(() => {
    const snapshot = useStore.getState();
    const selId = snapshot.selectedSignalId;

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

    if (ev && (!gestureState.isLerpingToSelection || ev.id !== currentLerpTargetId)) {
      currentLerpTargetId = ev.id;
      setVector3FromLatLng(markerLocalPos, ev.position.lat, ev.position.lng, 1);
      markerLocalPos.normalize();
      targetQuat.setFromUnitVectors(markerLocalPos, CAMERA_FORWARD);
      if (group && group.quaternion.dot(targetQuat) < 0) {
        targetQuat.negate();
      }
      gestureState.isLerpingToSelection = true;
    }

    if (!ev) {
      currentLerpTargetId = null;
      gestureState.isLerpingToSelection = false;
    }

    if (gestureState.isLerpingToSelection && group) {
      group.quaternion.slerp(targetQuat, LERP_FACTOR);

      const diff = 1 - Math.abs(group.quaternion.dot(targetQuat));
      if (diff < STOP_THRESHOLD) {
        gestureState.isLerpingToSelection = false;
        const rx = group.rotation.x;
        const ry = group.rotation.y;
        group.rotation.set(rx, ry, 0);
        gestureState.rotX = rx;
        gestureState.rotY = ry;
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
