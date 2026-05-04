export const earthVertexShader = /* glsl */ `
  attribute float countryIndex;
  varying float vCountryIdx;

  void main() {
    vCountryIdx = countryIndex;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const earthFragmentShader = /* glsl */ `
  precision mediump float;
  varying float vCountryIdx;

  void main() {
    vec3 baseColor = vec3(0.2, 0.55, 1.0);
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;
