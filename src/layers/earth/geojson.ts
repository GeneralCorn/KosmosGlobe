import countriesData from "./countries.json";

export type Ring = [number, number][];

export type CountryPolygon = {
  iso: string;
  countryIndex: number;
  outer: Ring;
  holes: Ring[];
};

export type LoadedCountries = {
  polygons: CountryPolygon[];
  indexByIso: Map<string, number>;
  count: number;
};

type RawFeature = {
  iso: string;
  name?: string;
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
};

type RawCollection = {
  type: "FeatureCollection";
  features: RawFeature[];
};

function ringCrossesAntimeridian(ring: Ring): boolean {
  for (let i = 1; i < ring.length; i += 1) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
      return true;
    }
  }
  return false;
}

function shiftRing(ring: Ring): Ring {
  const out: Ring = new Array(ring.length);
  for (let i = 0; i < ring.length; i += 1) {
    const [lng, lat] = ring[i];
    out[i] = [lng < 0 ? lng + 360 : lng, lat];
  }
  return out;
}

function normalizeRing(ring: Ring): Ring {
  if (ringCrossesAntimeridian(ring)) {
    return shiftRing(ring);
  }
  return ring;
}

function stripClose(ring: Ring): Ring {
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return ring.slice(0, -1);
    }
  }
  return ring;
}

function normalizePolygon(rings: number[][][]): {
  outer: Ring;
  holes: Ring[];
} {
  const [outerRaw, ...holeRaws] = rings as Ring[];
  const outer = stripClose(normalizeRing(outerRaw));
  const holes = holeRaws.map((r) => stripClose(normalizeRing(r as Ring)));
  return { outer, holes };
}

let cached: LoadedCountries | null = null;

export function loadCountries(): LoadedCountries {
  if (cached) {
    return cached;
  }
  const data = countriesData as RawCollection;
  const indexByIso = new Map<string, number>();
  const polygons: CountryPolygon[] = [];

  for (const feature of data.features) {
    const iso = feature.iso;
    if (!indexByIso.has(iso)) {
      indexByIso.set(iso, indexByIso.size);
    }
    const countryIndex = indexByIso.get(iso)!;
    const g = feature.geometry;
    if (g.type === "Polygon") {
      const { outer, holes } = normalizePolygon(g.coordinates);
      polygons.push({ iso, countryIndex, outer, holes });
    } else if (g.type === "MultiPolygon") {
      for (const polyRings of g.coordinates) {
        const { outer, holes } = normalizePolygon(polyRings);
        polygons.push({ iso, countryIndex, outer, holes });
      }
    }
  }

  cached = { polygons, indexByIso, count: indexByIso.size };
  return cached;
}
