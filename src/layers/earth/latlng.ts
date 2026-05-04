import { Vector3 } from "three";

const DEG = Math.PI / 180;

export function setVector3FromLatLng(
  out: Vector3,
  lat: number,
  lng: number,
  radius = 1,
): void {
  const phi = lat * DEG;
  const theta = -lng * DEG;
  const cosPhi = Math.cos(phi);
  out.x = radius * cosPhi * Math.cos(theta);
  out.y = radius * Math.sin(phi);
  out.z = radius * cosPhi * Math.sin(theta);
}

export function latLngToVector3(
  lat: number,
  lng: number,
  radius = 1,
): Vector3 {
  const v = new Vector3();
  setVector3FromLatLng(v, lat, lng, radius);
  return v;
}
