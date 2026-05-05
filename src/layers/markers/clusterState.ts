export const MAX_RENDER = 100;

export const clusterPX = new Float32Array(MAX_RENDER);
export const clusterPY = new Float32Array(MAX_RENDER);
export const clusterPZ = new Float32Array(MAX_RENDER);
export const clusterCnt = new Int32Array(MAX_RENDER);
export const clusterCatIdx = new Int32Array(MAX_RENDER);
export const clusterEventIdx = new Int32Array(MAX_RENDER).fill(-1);
export const clusterEventId: string[] = new Array(MAX_RENDER).fill("");
export const clusterOrbit = new Float32Array(MAX_RENDER);
export const clusterSeverity = new Float32Array(MAX_RENDER);
export const clusterFreshness = new Float32Array(MAX_RENDER);

export const clusterBridge = { renderCount: 0 };
