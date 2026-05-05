const DEG_TO_RAD = Math.PI / 180;
const CLUSTER_COS_THRESHOLD = Math.cos(15 * DEG_TO_RAD);

const _xs = new Float32Array(100);
const _ys = new Float32Array(100);
const _zs = new Float32Array(100);

type HasPosition = { position: { lat: number; lng: number } };

export function computeClusterBoosts(
  events: HasPosition[],
  out: Float32Array,
  n: number,
): void {
  for (let i = 0; i < n; i++) {
    const phi = events[i].position.lat * DEG_TO_RAD;
    const theta = -events[i].position.lng * DEG_TO_RAD;
    const cp = Math.cos(phi);
    _xs[i] = cp * Math.cos(theta);
    _ys[i] = Math.sin(phi);
    _zs[i] = cp * Math.sin(theta);
  }

  for (let i = 0; i < n; i++) {
    let count = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dot = _xs[i] * _xs[j] + _ys[i] * _ys[j] + _zs[i] * _zs[j];
      if (dot > CLUSTER_COS_THRESHOLD) {
        count++;
      }
    }
    out[i] = 1.0 + Math.log2(count + 1) * 0.4;
  }
}
