import type { Mesh } from "three";

export const earthMeshRef: { current: Mesh | null } = { current: null };
export const earthIsoByIndex: string[] = [];
