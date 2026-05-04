import React, { useMemo } from "react";
import { FrontSide } from "three";
import { buildEarthGeometry } from "./buildGeometry";
import { earthFragmentShader, earthVertexShader } from "./shaders";

const OCEAN_RADIUS = 0.998;
const OCEAN_COLOR = "#0A0E1A";

export default function Earth() {
  const { plate, border } = useMemo(() => buildEarthGeometry(), []);
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
      <mesh geometry={plate}>
        <shaderMaterial
          vertexShader={earthVertexShader}
          fragmentShader={earthFragmentShader}
          side={FrontSide}
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
