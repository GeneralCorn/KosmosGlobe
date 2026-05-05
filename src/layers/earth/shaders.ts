export const earthVertexShader = /* glsl */ `
  attribute float tintAmount;
  varying float vTintAmount;

  void main() {
    vTintAmount = tintAmount;
    vec3 sphereNormal = normalize(position);
    float protrusion = tintAmount * 0.008;
    vec3 displaced = position + sphereNormal * protrusion;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const earthFragmentShader = /* glsl */ `
  precision mediump float;
  varying float vTintAmount;

  void main() {
    vec3 baseColor = vec3(0.039, 0.055, 0.102);
    vec3 heatColor = vec3(0.910, 0.592, 0.365);
    vec3 finalColor = mix(baseColor, heatColor, vTintAmount);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
