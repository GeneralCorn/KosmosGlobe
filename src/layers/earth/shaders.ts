export const earthVertexShader = /* glsl */ `
  attribute float tintAmount;
  varying float vTintAmount;

  void main() {
    vTintAmount = tintAmount;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
