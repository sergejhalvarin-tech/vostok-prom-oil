// Морское дно на всё море (от горизонта до берега): гряды, валуны и ложбины, песок, корковые красные
// водоросли и мох на камнях; по участкам 400 м — ламинария (колышется), валуны, губки, актинии, морские
// звёзды; косяки рыб держатся вокруг камеры, когда она под водой. Подробный риф у платформы — свой (reef.js).
import * as THREE from 'three';
import {SEABED} from '../kit/stage.js';
import {FACE_Z} from './geology.js';

const X0 = -4400, X1 = 1420, Z0 = -4600, Z1 = 4600, CH = 400;
const REEF = {x0: -280, x1: 280, z0: 66, z1: 540};
let seed = 31;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2.1, y * 2.1) * 0.25 + noise(x * 4.3, y * 4.3) * 0.13 + noise(x * 8.7, y * 8.7) * 0.06;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Высота дна. У рифа, у кессона и у стенки разреза дно ровное (там свои объекты), к берегу — подъём.
export function floorHeight(x, z) {
  const inReef = Math.min(x - REEF.x0, REEF.x1 - x, z - REEF.z0, REEF.z1 - z);
  let k = smooth(0, -40, inReef);                                           // 0 внутри рифа
  k *= smooth(110, 200, Math.hypot(x, z));                                  // кессон
  k *= smooth(30, 90, Math.abs(z - FACE_Z));                                // стенка разреза
  const ridges = Math.pow(fbm(x / 120 + 3, z / 120 - 1), 1.6) * 9 + Math.pow(Math.max(0, fbm(x / 26, z / 26) - 0.5), 1.2) * 5;
  const dunes = Math.sin(x / 18 + fbm(x / 60, z / 60) * 6) * 0.35;
  return SEABED - 0.6 + (ridges + dunes + fbm(x / 7, z / 7) * 0.8) * k + smooth(900, 1420, x) * 2;
}

function swayMat(color, timeU, amp, len) {
  const m = new THREE.MeshLambertMaterial({color, side: THREE.DoubleSide, vertexColors: false});
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hk = clamp(position.y / ${len.toFixed(1)}, 0.0, 1.0);
      float ph = instanceMatrix[3].x * 0.23 + instanceMatrix[3].z * 0.19;
      transformed.x += sin(uTime * 0.9 + ph + hk * 2.2) * hk * hk * ${amp.toFixed(2)};
      transformed.z += cos(uTime * 0.7 + ph * 1.3) * hk * hk * ${(amp * 0.6).toFixed(2)};`);
  };
  return m;
}

export function makeSeaFloor() {
  const group = new THREE.Group();
  const timeU = {value: 0};

  // --- рельеф дна ---
  const STEP = 20, cols = Math.round((X1 - X0) / STEP) + 1, rows = Math.round((Z1 - Z0) / STEP) + 1;
  const P = new Float32Array(cols * rows * 3), C = new Float32Array(cols * rows * 3), I = [];
  const sand = new THREE.Color(0xd2c08e), rock = new THREE.Color(0x6a655c), red = new THREE.Color(0x8a3442), purple = new THREE.Color(0x7d5a78),
    moss = new THREE.Color(0x6f7a34), c = new THREE.Color();
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const x = X0 + j * STEP, z = Z0 + i * STEP, y = floorHeight(x, z), k = i * cols + j;
    P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = z;
    const rocky = smooth(SEABED + 1.5, SEABED + 5, y);
    c.copy(sand).lerp(rock, rocky);
    const alg = fbm(x / 30 + 11, z / 30);
    c.lerp(alg > 0.6 ? red : purple, smooth(0.52, 0.7, alg) * (0.3 + rocky * 0.5));
    c.lerp(moss, smooth(0.58, 0.78, fbm(x / 80, z / 80 + 7)) * 0.4);
    c.multiplyScalar(0.88 + hash(x, z) * 0.2);
    C[k * 3] = c.r; C[k * 3 + 1] = c.g; C[k * 3 + 2] = c.b;
    if (i && j) { const a = (i - 1) * cols + j - 1, b = a + 1, d = a + cols, e = d + 1; I.push(a, d, b, b, d, e); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setIndex(I);
  geo.computeVertexNormals();
  const floor = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
  floor.receiveShadow = true;
  floor.userData.noCast = true;
  group.add(floor);

  // --- флора и камни участками ---
  const kelpGeo = (() => {
    const parts = [];
    for (let b = 0; b < 3; b++) {
      const g = new THREE.PlaneGeometry(0.7, 7 + b * 1.5, 1, 10).translate(0, (7 + b * 1.5) / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 0.8 + b) * 0.35); }
      g.rotateY(b * 2.1);
      parts.push(g);
    }
    return mergeGeos(parts);
  })();
  const KIND = [
    {geo: kelpGeo, mat: swayMat(0xb98a2e, timeU, 1.4, 8), n: 140, s: [0.8, 1.6], where: (h) => h > SEABED + 0.6},
    {geo: new THREE.DodecahedronGeometry(1, 1), mat: new THREE.MeshLambertMaterial({color: 0x7a7268}), n: 50, s: [0.8, 4.2], where: () => true, sink: 0.3},
    {geo: new THREE.CylinderGeometry(0.5, 0.75, 1.6, 10, 1, true).translate(0, 0.8, 0), mat: new THREE.MeshLambertMaterial({color: 0xe0a33a, side: THREE.DoubleSide}), n: 30, s: [0.7, 1.8], where: (h) => h > SEABED + 1},
    {geo: mergeGeos([new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8).translate(0, 0.8, 0), new THREE.SphereGeometry(0.55, 12, 8).scale(1, 0.55, 1).translate(0, 1.75, 0)]), mat: swayMat(0xfff1e6, timeU, 0.15, 2), n: 40, s: [0.7, 1.5], where: (h) => h > SEABED + 0.8},
    {geo: (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.18 : 0.6, a = (i / 10) * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, {depth: 0.08, bevelEnabled: false}).rotateX(-Math.PI / 2); })(),
      mat: new THREE.MeshLambertMaterial({color: 0xff6a3a}), n: 30, s: [0.7, 1.4], where: (h) => h < SEABED + 1.2},
  ];
  const chunks = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), v = new THREE.Vector3();
  for (let cx = X0; cx < X1; cx += CH) for (let cz = Z0; cz < Z1; cz += CH) {
    const meshes = [];
    for (const K of KIND) {
      const im = new THREE.InstancedMesh(K.geo, K.mat, K.n);
      let k = 0;
      for (let t = 0; t < K.n * 4 && k < K.n; t++) {
        const x = cx + rnd() * CH, z = cz + rnd() * CH, h = floorHeight(x, z);
        if (Math.min(x - REEF.x0, REEF.x1 - x, z - REEF.z0, REEF.z1 - z) > -10) continue;     // риф — свой
        if (Math.hypot(x, z) < 150 || Math.abs(z - FACE_Z) < 40 || !K.where(h)) continue;
        const s = K.s[0] + rnd() * (K.s[1] - K.s[0]);
        q.setFromEuler(e.set(K.sink ? rnd() : 0, rnd() * 6.28, K.sink ? rnd() * 0.5 : 0));
        im.setMatrixAt(k++, m4.compose(v.set(x, h - (K.sink || 0) * s, z), q, sc.set(s * (K.sink ? 1 + rnd() * 0.5 : 1), s, s)));
      }
      im.count = k;
      im.userData.noCast = true;
      im.visible = false;
      group.add(im);
      meshes.push(im);
    }
    chunks.push({x: cx + CH / 2, z: cz + CH / 2, meshes});
  }

  // --- косяки рыб вокруг камеры ---
  const fishGeo = new THREE.ConeGeometry(0.16, 0.7, 5).rotateX(Math.PI / 2);
  const SCH = [{c: 0x9fb8c8, n: 70, r: 7}, {c: 0xc8d2d8, n: 50, r: 5}, {c: 0x6f8fa8, n: 40, r: 9}];
  const schools = SCH.map((s, i) => {
    const im = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({color: s.c, metalness: 0.7, roughness: 0.3}), s.n);
    im.frustumCulled = false;
    im.userData.noCast = true;
    group.add(im);
    return {im, ...s, ph: i * 2.1, off: Array.from({length: s.n}, () => [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() * 6.28])};
  });

  return {
    group,
    update(dt, t, cam) {
      timeU.value = t;
      const under = cam.y < 12;
      for (const ch of chunks) {
        const on = under && Math.hypot(ch.x - cam.x, ch.z - cam.z) < 650 && cam.x < X1 + 300;
        for (const m of ch.meshes) m.visible = on;
      }
      for (const s of schools) {
        s.im.visible = cam.y < 0 && cam.y > SEABED - 2;
        if (!s.im.visible) continue;
        const a = t * 0.15 + s.ph;
        const cx = cam.x + Math.cos(a) * 45, cz = cam.z + Math.sin(a) * 45, cy = Math.max(SEABED + 4, Math.min(-3, cam.y - 2 + Math.sin(t * 0.4 + s.ph) * 3));
        const dir = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2;
        s.off.forEach(([ox, oy, oz, ph], i) => {
          const w = Math.sin(t * 2 + ph) * 0.4;
          v.set(cx + ox * s.r * 2 + w, cy + oy * s.r, cz + oz * s.r * 2);
          q.setFromEuler(e.set(0, dir + Math.sin(t * 3 + ph) * 0.15, 0));
          s.im.setMatrixAt(i, m4.compose(v, q, sc.set(1, 1, 1)));
        });
        s.im.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

function mergeGeos(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = geos.reduce((a, g) => a + g.attributes.position.count, 0);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    P.set(g.attributes.position.array, o * 3);
    N.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}
