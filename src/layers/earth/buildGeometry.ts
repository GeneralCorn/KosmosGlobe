import { BufferAttribute, BufferGeometry } from "three";
import earcut from "earcut";
import { loadCountries, type Ring } from "./geojson";
import { writeLatLngToFloat32 } from "./latlng";

export const SPHERE_RADIUS = 1.0;
export const PLATE_TOP_RADIUS = 1.005;
export const BORDER_RADIUS = 1.0055;

export type EarthGeometry = {
  plate: BufferGeometry;
  border: BufferGeometry;
  countryCount: number;
};

let cached: EarthGeometry | null = null;

export function buildEarthGeometry(): EarthGeometry {
  if (cached) {
    return cached;
  }
  const { polygons, count } = loadCountries();

  const positionList: number[] = [];
  const countryIndexList: number[] = [];
  const indexList: number[] = [];
  const borderPositionList: number[] = [];

  let vertOffset = 0;

  function pushVertex(lng: number, lat: number, radius: number): void {
    const phi = (lat * Math.PI) / 180;
    const theta = (-lng * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    positionList.push(
      radius * cosPhi * Math.cos(theta),
      radius * Math.sin(phi),
      radius * cosPhi * Math.sin(theta),
    );
  }

  function pushBorderVertex(lng: number, lat: number): void {
    const phi = (lat * Math.PI) / 180;
    const theta = (-lng * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    borderPositionList.push(
      BORDER_RADIUS * cosPhi * Math.cos(theta),
      BORDER_RADIUS * Math.sin(phi),
      BORDER_RADIUS * cosPhi * Math.sin(theta),
    );
  }

  for (const poly of polygons) {
    const flat: number[] = [];
    const holeIndices: number[] = [];
    const rings: Ring[] = [poly.outer, ...poly.holes];

    for (const [lng, lat] of poly.outer) {
      flat.push(lng, lat);
    }
    for (const hole of poly.holes) {
      holeIndices.push(flat.length / 2);
      for (const [lng, lat] of hole) {
        flat.push(lng, lat);
      }
    }
    const ringPointCount = flat.length / 2;
    if (ringPointCount < 3) {
      continue;
    }

    const bottomBase = vertOffset;
    const topBase = vertOffset + ringPointCount;

    for (let i = 0; i < ringPointCount; i += 1) {
      const lng = flat[i * 2];
      const lat = flat[i * 2 + 1];
      pushVertex(lng, lat, SPHERE_RADIUS);
      countryIndexList.push(poly.countryIndex);
    }
    for (let i = 0; i < ringPointCount; i += 1) {
      const lng = flat[i * 2];
      const lat = flat[i * 2 + 1];
      pushVertex(lng, lat, PLATE_TOP_RADIUS);
      countryIndexList.push(poly.countryIndex);
    }
    vertOffset += ringPointCount * 2;

    const tris = earcut(flat, holeIndices, 2);
    for (let i = 0; i < tris.length; i += 1) {
      indexList.push(topBase + tris[i]);
    }

    let ringStart = 0;
    for (const ring of rings) {
      const m = ring.length;
      for (let i = 0; i < m; i += 1) {
        const a = ringStart + i;
        const b = ringStart + ((i + 1) % m);
        const bottomA = bottomBase + a;
        const bottomB = bottomBase + b;
        const topA = topBase + a;
        const topB = topBase + b;
        indexList.push(bottomA, bottomB, topA);
        indexList.push(bottomB, topB, topA);

        pushBorderVertex(ring[i][0], ring[i][1]);
        pushBorderVertex(ring[(i + 1) % m][0], ring[(i + 1) % m][1]);
      }
      ringStart += m;
    }
  }

  const positions = new Float32Array(positionList);
  const countryIndices = new Float32Array(countryIndexList);
  const indices =
    vertOffset > 65535
      ? new Uint32Array(indexList)
      : new Uint16Array(indexList);
  const borderPositions = new Float32Array(borderPositionList);

  const plate = new BufferGeometry();
  plate.setAttribute("position", new BufferAttribute(positions, 3));
  plate.setAttribute("countryIndex", new BufferAttribute(countryIndices, 1));
  plate.setIndex(new BufferAttribute(indices, 1));

  const border = new BufferGeometry();
  border.setAttribute("position", new BufferAttribute(borderPositions, 3));

  cached = { plate, border, countryCount: count };
  console.log("[earth] geometry built:", {
    countries: count,
    polygons: polygons.length,
    plateVertices: positionList.length / 3,
    plateIndices: indexList.length,
    borderVertices: borderPositionList.length / 3,
  });
  return cached;
}
