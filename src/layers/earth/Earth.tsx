import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { DoubleSide, FrontSide } from "three";
import type { BufferAttribute, Mesh } from "three";
import { buildEarthGeometry } from "./buildGeometry";
import { earthFragmentShader, earthVertexShader } from "./shaders";
import { useStore } from "../../domain/store";
import { countryHeatTint } from "../../domain/encodings";
import { earthMeshRef, earthIsoByIndex } from "./earthTapTarget";

const OCEAN_RADIUS = 0.998;
const OCEAN_COLOR = "#0A0E1A";

export default function Earth() {
  const { plate, border, tintData, indexByIso, countryCount } = useMemo(
    () => buildEarthGeometry(),
    [],
  );

  const plateRef = useRef<Mesh>(null);
  const lastVersionRef = useRef(-1);
  const tintByCountry = useMemo(() => new Float32Array(countryCount), [countryCount]);
  const isoByIndex = useMemo(() => {
    const arr = new Array<string>(countryCount);
    for (const [code, idx] of indexByIso) {
      arr[idx] = code;
    }
    earthIsoByIndex.length = 0;
    for (let i = 0; i < arr.length; i++) {
      earthIsoByIndex[i] = arr[i];
    }
    return arr;
  }, [indexByIso, countryCount]);

  useFrame(() => {
    if (plateRef.current && earthMeshRef.current !== plateRef.current) {
      earthMeshRef.current = plateRef.current;
    }
    const snap = useStore.getState();
    if (snap.version === lastVersionRef.current) return;
    lastVersionRef.current = snap.version;

    const events = snap.events;
    const countryHeat = snap.countryHeat;

    for (let ci = 0; ci < countryCount; ci++) {
      const code = isoByIndex[ci];
      tintByCountry[ci] = code ? countryHeatTint(code, events, countryHeat) : 0;
    }

    const countryIdxAttr = plate.getAttribute("countryIndex") as BufferAttribute;
    const tintAttr = plate.getAttribute("tintAmount") as BufferAttribute;
    for (let i = 0; i < tintData.length; i++) {
      tintData[i] = tintByCountry[Math.round(countryIdxAttr.getX(i))];
    }
    tintAttr.needsUpdate = true;
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[OCEAN_RADIUS, 64, 64]} />
        <meshBasicMaterial
          color={OCEAN_COLOR}
          transparent={false}
          depthWrite={true}
          depthTest={true}
          side={FrontSide}
        />
      </mesh>
      <mesh ref={plateRef} geometry={plate}>
        <shaderMaterial
          vertexShader={earthVertexShader}
          fragmentShader={earthFragmentShader}
          side={DoubleSide}
          transparent={false}
          depthWrite={true}
          depthTest={true}
        />
      </mesh>
      <lineSegments geometry={border}>
        <lineBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}
