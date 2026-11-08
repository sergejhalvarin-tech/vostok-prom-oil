// Общие элементы морских сцен: вода, лёд, частицы потока, цветокоррекция.
import * as THREE from 'three';
import {mergeStatic} from './merge.js';

// Море: волны в вершинном шейдере, френель, блик солнца, туман по дальности.
export function makeWater(sunDir, fogColor) {
  const uniforms = {
    uTime: {value: 0},
    uSun: {value: sunDir.clone().normalize()},
    uDeep: {value: new THREE.Color(0x064766)},
    uSky: {value: new THREE.Color(0x7fb8dc)},
    uFog: {value: fogColor},
    uOpacity: {value: 0.8},
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vW; varying vec3 vN;
      float h(vec2 p) {
        return 0.30 * sin(p.x * 0.045 + uTime * 0.9)
             + 0.22 * sin(p.y * 0.063 - uTime * 1.15)
             + 0.12 * sin((p.x + p.y) * 0.11 + uTime * 1.8)
             + 0.06 * sin((p.x - p.y) * 0.23 + uTime * 2.6);
      }
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float e = 0.6, hh = h(w.xz);
        vN = normalize(vec3(-(h(w.xz + vec2(e, 0.0)) - hh) / e, 1.0, -(h(w.xz + vec2(0.0, e)) - hh) / e));
        w.y += hh;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uDeep, uSky, uFog; uniform float uOpacity;
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 col = mix(uDeep, uSky, clamp(0.06 + fr * 0.9, 0.0, 1.0));
        vec3 hv = normalize(v + uSun);
        col += vec3(1.0, 0.86, 0.68) * pow(max(dot(n, hv), 0.0), 400.0) * 1.6;
        float d = length(cameraPosition - vW);
        float f = smoothstep(800.0, 3400.0, d);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, mix(uOpacity + fr * 0.2, 1.0, f));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // Сетка гуще в центре не нужна: волны мелкие, 7×7 км хватает на обе сцены.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 220, 220).rotateX(-Math.PI / 2), mat);
  mesh.position.x = 900;
  mesh.renderOrder = 2;
  return {
    mesh,
    update: (t) => (uniforms.uTime.value = t),
    setOpacity: (a) => (uniforms.uOpacity.value = a),
  };
}

// Дрейфующий лёд вокруг платформы. exclude(x, z) → true: льдину здесь не ставить.
export function makeIce(exclude = () => false, count = 90) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color: 0xf0f6fa, roughness: 0.8});
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = 230 + rnd() * 900;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const size = 6 + rnd() * 26;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6 + Math.floor(rnd() * 4));
    const sx = 0.6 + rnd() * 0.8, sz = 0.6 + rnd() * 0.8, rot = rnd() * Math.PI;
    if (exclude(x, z, size)) continue;
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const s = 0.75 + rnd() * 0.5;
      pos.setX(k, pos.getX(k) * s);
      pos.setZ(k, pos.getZ(k) * s);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(size * sx, 1.4, size * sz);
    m.position.set(x, 0.1, z);
    m.rotation.y = rot;
    m.receiveShadow = true;
    g.add(m);
  }
  return mergeStatic(g);
}

// Частицы, бегущие вдоль кривых (поток нефти/воды). reverse — от конца к началу.
export function makeFlow(curves, perCurve, color, size, reverse, speed = 45) {
  const n = curves.length * perCurve;
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const t = Float32Array.from({length: n}, (_, i) => (i % perCurve) / perCurve);
  const lens = curves.map((c) => c.getLength());
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  }));
  points.renderOrder = 3;
  points.frustumCulled = false;
  const v = new THREE.Vector3();
  const update = (dt) => {
    if (!points.visible) return;
    for (let i = 0; i < n; i++) {
      const ci = Math.floor(i / perCurve);
      t[i] = (t[i] + (dt * speed) / lens[ci]) % 1;
      curves[ci].getPointAt(reverse ? 1 - t[i] : t[i], v);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  points.visible = true;
  update(0);
  return {points, update};
}

// Цветокоррекция после тонмаппинга: насыщенность и контраст.
export const GRADE = {
  uniforms: {tDiffuse: {value: null}, sat: {value: 1.22}, con: {value: 1.06}},
  vertexShader: /* glsl */ `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float sat, con; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 g = mix(vec3(l), c.rgb, sat);
      g = (g - 0.5) * con + 0.5;
      gl_FragColor = vec4(clamp(g, 0.0, 1.0), c.a);
    }`,
};

// Отрезок-цилиндр между двумя точками (рычаги, канаты, мостики).
const Y = new THREE.Vector3(0, 1, 0);
export function setLink(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
  mesh.scale.set(1, Math.max(len, 1e-3), 1);
}

// Провисающая линия между точками (шланг, швартов): парабола с прогибом sag.
export function sagPoints(a, b, sag, n = 32) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const p = a.clone().lerp(b, s);
    p.y -= sag * 4 * s * (1 - s);
    pts.push(p);
  }
  return pts;
}
