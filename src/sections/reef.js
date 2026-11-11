// Каменистое дно у подножия платформы (по фото Баренцева моря): рельеф с валунами и грядами,
// корковые красные водоросли на камнях, песок в ложбинах; золотисто-бурая ламинария, нитчатые
// водоросли, высокие актинии-метридиумы с кружевными венчиками, бочковидные губки, веерные горгонарии,
// морские звёзды, ежи. Всё — инстансы, водоросли колышутся в шейдере.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SEABED} from '../kit/stage.js';

let seed = 77;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const R = {x0: -280, x1: 280, z0: 66, z1: 540};
const BASE = SEABED + 0.05;

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2.1, y * 2.1) * 0.25 + noise(x * 4.3, y * 4.3) * 0.13 + noise(x * 8.7, y * 8.7) * 0.06;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Высота дна: гряды и валуны, по краям участка сходят к ровному дну.
export function reefHeight(x, z) {
  const edge = smooth(0, 40, Math.min(x - R.x0, R.x1 - x, z - R.z0, R.z1 - z));
  const ridges = Math.pow(fbm(x / 34 + 5, z / 34 - 2), 1.5) * 8.5 + Math.pow(Math.max(0, fbm(x / 11, z / 11) - 0.45), 1.2) * 6;
  const bumps = fbm(x / 7, z / 7) * 1.1;
  const path = 1 - 0.72 * smooth(70, 0, Math.abs(x + 15)) * smooth(140, 320, z) * smooth(420, 300, z); // ложбина под маршрутом камеры
  return BASE + (ridges * path + bumps) * edge;
}

// Колыхание: сдвиг вершин в зависимости от высоты над основанием инстанса.
function sway(mat, timeU, amp = 1.2, len = 6) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hk = clamp(position.y / ${len.toFixed(1)}, 0.0, 1.0);
      float ph = instanceMatrix[3].x * 0.23 + instanceMatrix[3].z * 0.19;
      transformed.x += sin(uTime * 0.9 + ph + hk * 2.2) * hk * hk * ${amp.toFixed(2)};
      transformed.z += cos(uTime * 0.7 + ph * 1.3) * hk * hk * ${(amp * 0.6).toFixed(2)};`);
  };
  return mat;
}

// Раскидать инстансы по дну; where(x,z,h) решает, подходит ли место.
function plant(geo, mat, n, where, look) {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = V(1, 1, 1), col = new THREE.Color();
  let k = 0, tries = 0;
  while (k < n && tries < n * 30) {
    tries++;
    const x = R.x0 + 20 + rnd() * (R.x1 - R.x0 - 40), z = R.z0 + 15 + rnd() * (R.z1 - R.z0 - 30);
    const h = reefHeight(x, z);
    if (!where(x, z, h)) continue;
    const o = look(col, x, z, h);
    q.setFromEuler(e.set(o.rx || 0, rnd() * 6.28, o.rz || 0));
    mesh.setMatrixAt(k, m4.compose(V(x, h + (o.dy || 0), z), q, s.set(o.sx || o.s, o.s, o.sz || o.s)));
    mesh.setColorAt(k, col);
    k++;
  }
  mesh.count = k;
  mesh.receiveShadow = true;
  mesh.userData.noCast = true;
  return mesh;
}

function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) c.toArray(arr, i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

export function makeReef(timeU) {
  const group = new THREE.Group();

  // --- рельеф дна ---
  const W = R.x1 - R.x0, D = R.z1 - R.z0;
  const geo = new THREE.PlaneGeometry(W, D, 200, 170).rotateX(-Math.PI / 2);
  geo.translate((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, reefHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal, cols = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xb3a684), rock = new THREE.Color(0x5f5c57), red = new THREE.Color(0x6a2a34), purple = new THREE.Color(0x7a5a6e),
    moss = new THREE.Color(0x6b6a32), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i) - BASE, sl = 1 - nrm.getY(i);
    const rocky = Math.min(1, smooth(0.8, 2.6, y) + sl * 1.4);
    c.copy(sand).lerp(rock, rocky);
    const alg = fbm(x / 5 + 11, z / 5);                                      // корковые красные водоросли на камнях
    c.lerp(alg > 0.62 ? red : purple, smooth(0.55, 0.72, alg) * rocky * 0.45);
    c.lerp(moss, smooth(0.6, 0.8, fbm(x / 14, z / 14 + 7)) * 0.35);
    c.multiplyScalar(0.85 + hash(x * 0.7, z * 0.7) * 0.3);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const floor = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
  floor.receiveShadow = true;
  group.add(floor);

  const onRock = (x, z, h) => h - BASE > 1.8;
  const onSand = (x, z, h) => h - BASE < 1.2;

  // --- валуны ---
  group.add(plant(new THREE.DodecahedronGeometry(1, 1), new THREE.MeshLambertMaterial({color: 0xffffff}), 260, () => true, (c, x, z) => {
    c.setHSL(0.07, 0.08, 0.32 + rnd() * 0.18);
    if (rnd() < 0.45) c.lerp(new THREE.Color(0x8a2b3d), 0.5);
    const s = 0.6 + rnd() * 2.4;
    return {s, sx: s * (1 + rnd() * 0.6), sz: s * (1 + rnd() * 0.5), dy: -s * 0.25, rx: rnd() * 0.6, rz: rnd() * 0.6};
  }));

  // --- ламинария: ножка + длинная волнистая пластина ---
  const blade = new THREE.PlaneGeometry(0.75, 6, 2, 16);
  {
    const p = blade.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 3, w = Math.sin(Math.min(1, y / 1.2) * Math.PI / 2) * (1 - Math.max(0, (y - 4.6) / 1.6) * 0.8);
      p.setX(i, p.getX(i) * w + Math.sin(y * 3.1) * 0.06);
      p.setZ(i, Math.abs(p.getX(i)) > 0.2 ? Math.sin(y * 5 + p.getX(i) * 9) * 0.08 : 0); // гофрированный край
      p.setY(i, y + 1.4);
    }
    blade.computeVertexNormals();
  }
  const kelp = mergeGeometries([colored(new THREE.CylinderGeometry(0.04, 0.06, 1.5, 5).translate(0, 0.75, 0), 0x6b4a1a), colored(blade, 0xffffff)]);
  group.add(plant(kelp, sway(new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide}), timeU, 1.4, 7.4), 520,
    (x, z, h) => onRock(x, z, h) && fbm(x / 30, z / 30) > 0.42,
    (c) => { c.setHSL(0.09 + rnd() * 0.03, 0.62, 0.32 + rnd() * 0.12); return {s: 0.7 + rnd() * 0.8}; }));

  // --- нитчатые водоросли: пучки тонких золотистых нитей ---
  const strands = [];
  for (let k = 0; k < 14; k++) {
    const a = rnd() * 6.28, len = 1.4 + rnd() * 1.8, lean = 0.2 + rnd() * 0.5;
    const s = new THREE.PlaneGeometry(0.05, len, 1, 5).translate(0, len / 2, 0);
    const p = s.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.pow(Math.max(0, y / len), 1.6) * lean * len); }
    s.rotateY(a);
    strands.push(s.toNonIndexed());
  }
  group.add(plant(mergeGeometries(strands), sway(new THREE.MeshLambertMaterial({color: 0xffffff, side: THREE.DoubleSide}), timeU, 0.5, 3), 900,
    (x, z, h) => fbm(x / 22 + 3, z / 22) > 0.4,
    (c) => { c.setHSL(0.1 + rnd() * 0.03, 0.7, 0.42 + rnd() * 0.12); return {s: 0.8 + rnd() * 0.7}; }));

  // --- актинии-метридиумы: высокий гладкий столбик и кружевной венчик ---
  const crown = new THREE.CylinderGeometry(0.62, 0.17, 0.42, 40, 3, true);
  {
    const p = crown.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      const top = (y + 0.21) / 0.42;
      const lobe = Math.sin(a * 7) * 0.13 * top + Math.sin(a * 19) * 0.04 * top;
      p.setX(i, Math.cos(a) * (r + lobe * 0.8)); p.setZ(i, Math.sin(a) * (r + lobe * 0.8)); p.setY(i, y + lobe);
    }
    crown.computeVertexNormals();
  }
  const fluff = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * 6.28, r = 0.45 + rnd() * 0.15;
    fluff.push(new THREE.IcosahedronGeometry(0.12 + rnd() * 0.06, 0).translate(Math.cos(a) * r, 0.25 + rnd() * 0.08, Math.sin(a) * r));
  }
  const metr = (h) => mergeGeometries([
    colored(new THREE.CylinderGeometry(0.24, 0.34, h, 16).translate(0, h / 2, 0), 0xa89a3c),
    colored(crown.clone().scale(1.9, 1.6, 1.9).translate(0, h + 0.3, 0), 0xfff4d8),
    ...fluff.map((f) => colored(f.clone().scale(1.9, 1.6, 1.9).translate(0, h + 0.1, 0), 0xfff0c8)),
    colored(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).translate(0, h + 0.62, 0), 0xd9b25a),
  ]);
  const metrMat = sway(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.55, emissive: 0x1a1408, emissiveIntensity: 0.4}), timeU, 0.18, 2.5);
  for (const [h, n] of [[2.0, 120], [3.0, 110], [4.2, 70]]) {
    group.add(plant(metr(h), metrMat, n, (x, z, hh) => fbm(x / 26 - 4, z / 26 + 9) > 0.45 && hh - BASE > 0.6, (c) => {
      // Окраска столбика и венчика: кремовые, жёлтые, оливковые, белые.
      c.set([0xffffff, 0xfff1b0, 0xe8f0c0, 0xffe2b8][Math.floor(rnd() * 4)]);
      return {s: 0.8 + rnd() * 0.5};
    }));
  }

  // --- бочковидные губки ---
  const barrel = new THREE.LatheGeometry([[0.35, 0], [0.7, 0.2], [0.85, 0.7], [0.95, 1.3], [1.05, 1.8], [0.9, 1.9], [0.75, 1.85], [0.7, 1.4], [0.6, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  {
    const p = barrel.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x);
      const k = 1 + Math.sin(a * 9 + y * 4) * 0.05 + (noise(a * 3, y * 3) - 0.5) * 0.12;
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    barrel.computeVertexNormals();
  }
  group.add(plant(barrel, new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide}), 46, onRock, (c) => {
    c.set([0xd0505a, 0xe0707a, 0xc0404a, 0xff8a66][Math.floor(rnd() * 4)]);
    return {s: 0.8 + rnd() * 0.9, dy: -0.2};
  }));

  // --- веерные горгонарии ---
  const fan = [];
  const branch = (x, y, a, len, w, depth) => {
    const x2 = x + Math.sin(a) * len, y2 = y + Math.cos(a) * len;
    const c = new THREE.CylinderGeometry(w * 0.7, w, len, 4).translate(0, len / 2, 0);
    c.rotateZ(-a);
    c.translate(x, y, 0);
    fan.push(c.toNonIndexed());
    if (depth > 0) for (const da of [-0.45, 0.4]) branch(x2, y2, a + da + (rnd() - 0.5) * 0.3, len * 0.78, w * 0.72, depth - 1);
  };
  branch(0, 0, 0, 0.9, 0.08, 5);
  group.add(plant(mergeGeometries(fan.map((g) => { g.deleteAttribute('uv'); return g; })), sway(new THREE.MeshLambertMaterial({color: 0xffffff}), timeU, 0.12, 3), 70, onRock, (c) => {
    c.set([0x9a7a52, 0xb08a5a, 0x8a5a7a][Math.floor(rnd() * 3)]);
    return {s: 1.2 + rnd() * 1.1};
  }));

  // --- красные корковые наросты и мелкие кустики ---
  const tuft = mergeGeometries(Array.from({length: 7}, () => new THREE.IcosahedronGeometry(0.16 + rnd() * 0.12, 0).translate((rnd() - 0.5) * 0.5, rnd() * 0.15, (rnd() - 0.5) * 0.5)));
  group.add(plant(tuft, new THREE.MeshLambertMaterial({color: 0xffffff}), 900, onRock, (c) => {
    c.set([0x9e2a3c, 0x7a2c5e, 0xc0485a, 0xe6d8d0][Math.floor(rnd() * 4)]);
    return {s: 0.8 + rnd() * 1.4};
  }));

  // --- морские звёзды и ежи ---
  const star = new THREE.Shape();
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI * 2, r = k % 2 ? 0.2 : 0.62;
    k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(r, 0);
  }
  group.add(plant(new THREE.ExtrudeGeometry(star, {depth: 0.07, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1}).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.7}), 200, () => true, (c) => {
      c.set([0xff6b1a, 0xe8323a, 0xa64dff, 0xffb02e][Math.floor(rnd() * 4)]);
      return {s: 0.6 + rnd() * 0.7, dy: 0.05};
    }));
  const urch = [new THREE.SphereGeometry(0.33, 10, 8).toNonIndexed()];
  for (let k = 0; k < 30; k++) {
    const d = V(rnd() - 0.5, rnd() * 0.8, rnd() - 0.5).normalize();
    urch.push(new THREE.ConeGeometry(0.025, 0.5, 3).translate(0, 0.45, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d)).toNonIndexed());
  }
  group.add(plant(mergeGeometries(urch), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.5}), 220, onSand, (c) => {
    c.set([0x5b1f6b, 0x2c3a1e, 0x8a2a4a, 0xb85a2a][Math.floor(rnd() * 4)]);
    return {s: 0.7 + rnd() * 0.7, dy: 0.12};
  }));

  return group;
}
