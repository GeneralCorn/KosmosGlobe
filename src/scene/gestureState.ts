export type PendingTap = { x: number; y: number };

export const gestureState = {
  rotX: 0,
  rotY: 0,
  cameraZ: 2.2,
  isInteracting: false,
  lastInteractionTime: 0,
  pinchStartZ: 0,
  pendingTap: null as PendingTap | null,
  isLerpingToSelection: false,
  targetRotX: 0,
  targetRotY: 0,
  selectedScreenX: 0,
  selectedScreenY: 0,
  hasSelectedScreen: false,
};

export function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return from + diff * t;
}
