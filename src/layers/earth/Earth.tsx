import React, { useMemo } from "react";
import { DoubleSide } from "three";
import { buildEarthGeometry } from "./buildGeometry";
import { earthFragmentShader, earthVertexShader } from "./shaders";

export default function Earth() {
  const { plate, border } = useMemo(() => buildEarthGeometry(), []);
  return (
    <>
      <mesh geometry={plate}>
        <shaderMaterial
          vertexShader={earthVertexShader}
          fragmentShader={earthFragmentShader}
          side={DoubleSide}
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
