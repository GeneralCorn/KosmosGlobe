import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { BufferAttribute, BufferGeometry } from "three";
import { useStore } from "../../domain/store";
import { setVector3FromLatLng } from "../earth/latlng";
import { Vector3 } from "three";
import type { NewsEvent } from "../../domain/types";

const ARC_SEGS = 14;
const MAX_ARCS = 7;
const ARC_RADIUS = 1.009;
const TOTAL_FLOATS = MAX_ARCS * ARC_SEGS * 2 * 3;

const arcPositions = new Float32Array(TOTAL_FLOATS);
const tempA = new Vector3();
const tempB = new Vector3();

function slerpWriteArc(
  out: Float32Array,
  offset: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const tiny = sinAngle < 0.001;

  for (let s = 0; s < ARC_SEGS; s++) {
    for (let j = 0; j < 2; j++) {
      const t = (s + j) / ARC_SEGS;
      let px: number;
      let py: number;
      let pz: number;
      if (tiny) {
        px = ax;
        py = ay;
        pz = az;
      } else {
        const w0 = Math.sin((1 - t) * angle) / sinAngle;
        const w1 = Math.sin(t * angle) / sinAngle;
        px = w0 * ax + w1 * bx;
        py = w0 * ay + w1 * by;
        pz = w0 * az + w1 * bz;
      }
      out[offset++] = px * ARC_RADIUS;
      out[offset++] = py * ARC_RADIUS;
      out[offset++] = pz * ARC_RADIUS;
    }
  }
  return offset;
}

function selectArcTargets(events: NewsEvent[]): NewsEvent[] {
  let geo: NewsEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    if (events[i].category === "geopolitics") {
      geo.push(events[i]);
    }
  }
  geo.sort((a, b) => a.freshnessHours - b.freshnessHours);
  if (geo.length < 2) {
    const copy = events.slice().sort((a, b) => a.freshnessHours - b.freshnessHours);
    geo = copy;
  }
  return geo.slice(0, MAX_ARCS + 1);
}

export default function Arcs() {
  const lastVersionRef = useRef(-1);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(arcPositions, 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  useFrame(() => {
    const snap = useStore.getState();
    if (snap.version === lastVersionRef.current) return;
    lastVersionRef.current = snap.version;

    const targets = selectArcTargets(snap.events);
    if (targets.length < 2) {
      geo.setDrawRange(0, 0);
      return;
    }

    const hub = targets[0];
    setVector3FromLatLng(tempA, hub.position.lat, hub.position.lng, 1);
    const hax = tempA.x;
    const hay = tempA.y;
    const haz = tempA.z;

    let offset = 0;
    const numArcs = Math.min(targets.length - 1, MAX_ARCS);

    for (let i = 0; i < numArcs; i++) {
      const spoke = targets[i + 1];
      setVector3FromLatLng(tempB, spoke.position.lat, spoke.position.lng, 1);
      offset = slerpWriteArc(
        arcPositions,
        offset,
        hax,
        hay,
        haz,
        tempB.x,
        tempB.y,
        tempB.z,
      );
    }

    const posAttr = geo.getAttribute("position") as BufferAttribute;
    posAttr.needsUpdate = true;
    geo.setDrawRange(0, numArcs * ARC_SEGS * 2);
  });

  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <lineBasicMaterial
        color="#FFFFFF"
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </lineSegments>
  );
}
