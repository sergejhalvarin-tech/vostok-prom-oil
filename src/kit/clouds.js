// Облака: сотни мягких «клубов», нарисованных одной отрисовкой (инстансы-билборды, всегда лицом к камере).
// Освещение закатное: сторона к солнцу тёплая и светлая, тень — сиреневая.
import * as THREE from 'three';

function puffTexture() {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = S * (0.25 + rnd() * 0.5), y = S * (0.3 + rnd() * 0.45), r = S * (0.12 + rnd() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  return t;
}

export function makeClouds(sunDir, {count = 170, area = [-2600, 5600, -3800, 3800], y = [420, 900]} = {}) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  // Облако = кучка из 5–8 клубов вокруг центра.
  const centers = [], sizes = [], shades = [];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let c = 0; c < count; c++) {
    const cx = area[0] + rnd() * (area[1] - area[0]), cz = area[2] + rnd() * (area[3] - area[2]), cy = y[0] + rnd() * (y[1] - y[0]);
    const big = 0.6 + rnd() * 1.2, n = 5 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      centers.push(cx + (rnd() - 0.5) * 260 * big, cy + (rnd() - 0.3) * 50 * big, cz + (rnd() - 0.5) * 160 * big);
      sizes.push((110 + rnd() * 140) * big);
      shades.push(rnd());
    }
  }
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(new Float32Array(centers), 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 1));
  geo.setAttribute('aShade', new THREE.InstancedBufferAttribute(new Float32Array(shades), 1));
  geo.instanceCount = sizes.length;

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTex: {value: puffTexture()},
      uSun: {value: sunDir.clone().normalize()},
      uLit: {value: new THREE.Color(0xffd2a6)},
      uGlow: {value: new THREE.Color(0xff9a5c)},
      uShadow: {value: new THREE.Color(0x8d86a8)},
      uFog: {value: new THREE.Color(0xd8c4b4)},
      uTime: {value: 0},
    },
    vertexShader: /* glsl */ `
      attribute vec3 aCenter; attribute float aSize; attribute float aShade;
      uniform float uTime;
      varying vec2 vUv; varying float vShade; varying vec3 vW;
      void main() {
        vec3 c = aCenter + vec3(uTime * 3.0, 0.0, uTime * 1.2);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 w = c + (right * position.x + up * position.y * 0.62) * aSize;
        vUv = uv; vShade = aShade; vW = w;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform vec3 uSun, uLit, uGlow, uShadow, uFog;
      varying vec2 vUv; varying float vShade; varying vec3 vW;
      void main() {
        float a = texture2D(uTex, vUv).a;
        if (a < 0.01) discard;
        vec3 v = normalize(vW - cameraPosition);
        float toSun = pow(max(dot(v, uSun), 0.0), 6.0);
        vec3 col = mix(uShadow, uLit, clamp(vUv.y * 1.1 + vShade * 0.25, 0.0, 1.0));
        col = mix(col, uGlow, toSun * 0.85);
        float d = length(vW - cameraPosition);
        col = mix(col, uFog, smoothstep(2500.0, 6500.0, d) * 0.6);
        gl_FragColor = vec4(col, a * 0.95 * (1.0 - smoothstep(5000.0, 7500.0, d)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return {mesh, update: (t) => (mat.uniforms.uTime.value = t)};
}
