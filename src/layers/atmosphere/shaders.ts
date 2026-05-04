export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const atmosphereFragmentShader = /* glsl */ `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float rim = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.5);
    vec3 atmoColor = vec3(0.35, 0.55, 0.85);
    gl_FragColor = vec4(atmoColor * rim, rim);
  }
`;
