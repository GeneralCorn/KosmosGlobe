import React from "react";
import { AdditiveBlending } from "three";
import {
  atmosphereFragmentShader,
  atmosphereVertexShader,
} from "./shaders";

const ATMOSPHERE_RADIUS = 1.05;

export default function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
