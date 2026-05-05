import type { NewsEvent } from "../../domain/types";
import { markerOrbitRadius } from "../../domain/encodings";

const MAX_EVENTS = 50;
const MAX_NODES = MAX_EVENTS * 2;
const DEG = Math.PI / 180;
const CAMERA_CLOSE = 1.5;
const CAMERA_FAR = 5.0;
const THRESHOLD_CLOSE = 0.003; // ~0.17° at min zoom — even close jitter separates
const THRESHOLD_FAR = 0.18; // ~10° at max zoom — country-level clusters form

// Per-node data (pre-allocated for up to MAX_NODES = 100)
const _posX = new Float32Array(MAX_NODES);
const _posY = new Float32Array(MAX_NODES);
const _posZ = new Float32Array(MAX_NODES);
const _count = new Int32Array(MAX_NODES);
const _catIdx = new Int32Array(MAX_NODES);
const _mergeDist = new Float32Array(MAX_NODES);
const _left = new Int32Array(MAX_NODES).fill(-1);
const _right = new Int32Array(MAX_NODES).fill(-1);
const _alive = new Uint8Array(MAX_NODES);

// Leaf-only data
const _leafEventIdx = new Int32Array(MAX_NODES).fill(-1);
const _leafEventId: string[] = new Array(MAX_NODES).fill("");
const _leafOrbit = new Float32Array(MAX_NODES);
const _leafSeverity = new Float32Array(MAX_NODES);
const _leafFreshness = new Float32Array(MAX_NODES);

// Walk stack (pre-allocated)
const _walkStack = new Int32Array(MAX_NODES);

let _nodeCount = 0;
let _root = -1;

export function buildClusterTree(events: NewsEvent[], n: number): void {
  _nodeCount = n;
  _root = n === 0 ? -1 : 0;

  for (let i = 0; i < n; i++) {
    const phi = events[i].position.lat * DEG;
    const theta = -events[i].position.lng * DEG;
    const cp = Math.cos(phi);
    _posX[i] = cp * Math.cos(theta);
    _posY[i] = Math.sin(phi);
    _posZ[i] = cp * Math.sin(theta);
    _count[i] = 1;
    _catIdx[i] = catToIdx(events[i].category);
    _mergeDist[i] = 0;
    _left[i] = -1;
    _right[i] = -1;
    _alive[i] = 1;
    _leafEventIdx[i] = i;
    _leafEventId[i] = events[i].id;
    _leafOrbit[i] = markerOrbitRadius(events[i]);
    _leafSeverity[i] = events[i].severity;
    _leafFreshness[i] = events[i].freshnessHours;
  }

  for (let i = n; i < MAX_NODES; i++) {
    _alive[i] = 0;
  }

  if (n <= 1) {
    return;
  }

  let aliveCount = n;

  while (aliveCount > 1) {
    let bestDist = Infinity;
    let bestI = -1;
    let bestJ = -1;

    for (let i = 0; i < _nodeCount; i++) {
      if (!_alive[i]) continue;
      for (let j = i + 1; j < _nodeCount; j++) {
        if (!_alive[j]) continue;
        const dot = _posX[i] * _posX[j] + _posY[i] * _posY[j] + _posZ[i] * _posZ[j];
        const d = Math.acos(Math.min(1, Math.max(-1, dot)));
        if (d < bestDist) {
          bestDist = d;
          bestI = i;
          bestJ = j;
        }
      }
    }

    const k = _nodeCount++;
    const ci = _count[bestI];
    const cj = _count[bestJ];
    const total = ci + cj;

    let nx = (_posX[bestI] * ci + _posX[bestJ] * cj) / total;
    let ny = (_posY[bestI] * ci + _posY[bestJ] * cj) / total;
    let nz = (_posZ[bestI] * ci + _posZ[bestJ] * cj) / total;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0.00001) {
      nx /= len;
      ny /= len;
      nz /= len;
    }

    _posX[k] = nx;
    _posY[k] = ny;
    _posZ[k] = nz;
    _count[k] = total;
    _catIdx[k] = ci >= cj ? _catIdx[bestI] : _catIdx[bestJ];
    _mergeDist[k] = bestDist;
    _left[k] = bestI;
    _right[k] = bestJ;
    _alive[k] = 1;
    _alive[bestI] = 0;
    _alive[bestJ] = 0;
    _leafEventIdx[k] = -1;
    _leafEventId[k] = "";
    _leafOrbit[k] = 1.055;
    _leafSeverity[k] = 0;
    _leafFreshness[k] = Infinity;

    aliveCount--;
  }

  _root = _nodeCount - 1;
}

export function thresholdFromCameraZ(cameraZ: number): number {
  const t = Math.min(1, Math.max(0, (cameraZ - CAMERA_CLOSE) / (CAMERA_FAR - CAMERA_CLOSE)));
  return THRESHOLD_CLOSE + (THRESHOLD_FAR - THRESHOLD_CLOSE) * t;
}

export function walkClusterTree(
  threshold: number,
  outPX: Float32Array,
  outPY: Float32Array,
  outPZ: Float32Array,
  outCnt: Int32Array,
  outCatIdx: Int32Array,
  outEventIdx: Int32Array,
  outEventId: string[],
  outOrbit: Float32Array,
  outSeverity: Float32Array,
  outFreshness: Float32Array,
  maxOut: number,
): number {
  if (_root < 0) return 0;

  let outLen = 0;
  let top = 0;
  _walkStack[top++] = _root;

  while (top > 0 && outLen < maxOut) {
    const node = _walkStack[--top];
    const isLeaf = _left[node] === -1;

    if (isLeaf || _mergeDist[node] <= threshold) {
      outPX[outLen] = _posX[node];
      outPY[outLen] = _posY[node];
      outPZ[outLen] = _posZ[node];
      outCnt[outLen] = _count[node];
      outCatIdx[outLen] = _catIdx[node];
      outEventIdx[outLen] = _leafEventIdx[node];
      outEventId[outLen] = _leafEventId[node];
      outOrbit[outLen] = _leafOrbit[node];
      outSeverity[outLen] = _leafSeverity[node];
      outFreshness[outLen] = _leafFreshness[node];
      outLen++;
    } else {
      _walkStack[top++] = _left[node];
      _walkStack[top++] = _right[node];
    }
  }

  return outLen;
}

function catToIdx(cat: string): number {
  if (cat === "geopolitics") return 0;
  if (cat === "economics") return 1;
  if (cat === "health") return 2;
  return 3;
}
