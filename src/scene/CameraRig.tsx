import { useFrame, useThree } from "@react-three/fiber/native";
import { Euler, Vector3 } from "three";
import { gestureState, lerpAngle } from "./gestureState";
import { useStore } from "../domain/store";
import { setVector3FromLatLng } from "../layers/earth/latlng";
import { markerOrbitRadius } from "../domain/encodings";

const DEG = Math.PI / 180;
const LERP_FACTOR = 0.05;
const STOP_THRESHOLD = 0.008;

const tempVec = new Vector3();
const tempEuler = new Euler();

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

    if (ev && !gestureState.isLerpingToSelection) {
      gestureState.targetRotX = -ev.position.lat * DEG;
      gestureState.targetRotY = -Math.PI / 2 - ev.position.lng * DEG;
      gestureState.isLerpingToSelection = true;
    }

    if (gestureState.isLerpingToSelection) {
      const nextX = lerpAngle(gestureState.rotX, gestureState.targetRotX, LERP_FACTOR);
      const nextY = lerpAngle(gestureState.rotY, gestureState.targetRotY, LERP_FACTOR);
      gestureState.rotX = nextX;
      gestureState.rotY = nextY;

      const dX = Math.abs(gestureState.targetRotX - nextX);
      const dY = Math.abs(lerpAngle(nextY, gestureState.targetRotY, 1));
      if (dX < STOP_THRESHOLD && dY < STOP_THRESHOLD) {
        gestureState.isLerpingToSelection = false;
      }
    }

    if (ev) {
      setVector3FromLatLng(
        tempVec,
        ev.position.lat,
        ev.position.lng,
        markerOrbitRadius(ev),
      );
      tempEuler.set(gestureState.rotX, gestureState.rotY, 0);
      tempVec.applyEuler(tempEuler);
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
