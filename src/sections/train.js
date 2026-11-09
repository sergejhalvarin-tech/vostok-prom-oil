// Маршрутный поезд с нефтью: грузовой электровоз 2ЭС6 «Синара» (две секции, построен по фотографиям)
// и вагоны-цистерны (модель «Вагон цистерна для поезда» © mamont nikita, CC BY 4.0).
// Кузова ставятся по двум точкам пути (центрам тележек), тележки поворачиваются по касательной — состав
// честно вписывается в кривые и мосты.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {railAt} from './landscape.js';
import {mergeStatic} from '../kit/merge.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.25, ...o});
export const RAIL_TOP = 0.9;                  // головка рельса над отметкой полотна
export const SEC = 16.6, GAP = 0.7;            // секция электровоза по автосцепкам, гармошка перехода
export const CAR = 12.42;                      // вагон-цистерна по автосцепкам
export const LOCO_LEN = 2 * SEC + GAP;

// ---------------------------------------------------------------- электровоз
// Окраска боковин: светло-серый низ, белая полоса и красный верх, уходящие диагональю к кабине, логотип.
function sideTexture() {
  const W = 2048, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // Полуполотно на сторону: front — у какого края кабина.
  const paint = (x0, frontLeft) => {
    const L = 16.6, px = (W / 2) / L, Y0 = 1.3, Y1 = 4.62, py = H / (Y1 - Y0);
    const X = (z) => x0 + (frontLeft ? (L / 2 - z) : (z + L / 2)) * px;   // z от −8,3 (переход) до +8,3 (кабина)
    const Yp = (y) => H - (y - Y0) * py;
    g.save();
    g.beginPath(); g.rect(x0, 0, W / 2, H); g.clip();
    g.fillStyle = '#c3c6c8'; g.fillRect(x0, 0, W / 2, H);
    // Красный верх с диагональю к кабине и белая полоса под ним.
    const edge = (z) => (z < -1.5 ? 3.45 : z > 4.6 ? 2.25 : 3.45 - (z + 1.5) / 6.1 * 1.2);
    const band = (off, color) => {
      g.fillStyle = color; g.beginPath();
      g.moveTo(X(-8.3), Yp(4.62));
      for (let z = -8.3; z <= 8.31; z += 0.2) g.lineTo(X(z), Yp(edge(z) - off));
      g.lineTo(X(8.3), Yp(4.62)); g.closePath(); g.fill();
    };
    band(0.42, '#f4f4f2');
    band(0, '#c8141c');
    // Тёмная нижняя кромка кузова и цокольная линия.
    g.fillStyle = '#7d8286'; g.fillRect(x0, Yp(1.55), W / 2, Yp(1.3) - Yp(1.55));
    g.fillStyle = '#a7abad'; g.fillRect(x0, Yp(2.0), W / 2, 3);
    // Кабина: боковое окно, дверь с овальным окошком, поручни.
    const rect = (z0, z1, y0, y1, fill, stroke) => {
      const xa = Math.min(X(z0), X(z1)), xb = Math.max(X(z0), X(z1));
      g.fillStyle = fill; g.fillRect(xa, Yp(y1), xb - xa, Yp(y0) - Yp(y1));
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.strokeRect(xa, Yp(y1), xb - xa, Yp(y0) - Yp(y1)); }
    };
    rect(6.35, 7.35, 2.95, 3.85, '#28323a', '#111');
    rect(6.85, 6.9, 2.95, 3.85, '#111');
    rect(5.0, 5.75, 1.75, 3.95, '#c8141c', '#7a0c10');
    g.fillStyle = '#28323a'; g.beginPath();
    g.ellipse((X(5.2) + X(5.55)) / 2, Yp(3.35), Math.abs(X(5.55) - X(5.2)) / 2, (Yp(3.0) - Yp(3.7)) / 2, 0, 0, Math.PI * 2); g.fill();
    for (const z of [4.85, 5.9]) rect(z, z + 0.05, 1.5, 3.6, '#d9dcdc');
    // Окна машинного отделения и жалюзи.
    for (const z of [-6.4, -3.6, 1.2]) rect(z, z + 0.62, 3.0, 3.38, '#3a4248', '#e6e6e6');
    for (const z0 of [-2.4, -0.4]) {
      rect(z0, z0 + 1.7, 3.5, 4.05, '#9aa1a5', '#6c7275');
      g.fillStyle = '#5b6266';
      for (let y = 3.55; y < 4.02; y += 0.06) g.fillRect(Math.min(X(z0), X(z0 + 1.7)) + 3, Yp(y), Math.abs(X(z0 + 1.7) - X(z0)) - 6, 2);
    }
    // Логотип и номер.
    g.fillStyle = '#c8141c';
    g.font = `italic 900 ${Math.round(0.62 * py)}px Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('РЖД', X(0.6), Yp(2.75));
    g.fillStyle = '#222'; g.font = `700 ${Math.round(0.17 * py)}px Arial, sans-serif`;
    g.fillText('2ЭС6-126', X(6.6), Yp(2.45));
    // Швы панелей.
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
    for (const z of [-7.9, -4.4, -2.6, 0.2, 2.6, 4.9]) { g.beginPath(); g.moveTo(X(z), Yp(1.4)); g.lineTo(X(z), Yp(4.6)); g.stroke(); }
    g.restore();
  };
  paint(0, true);        // правый борт (+x): кабина видна слева
  paint(W / 2, false);   // левый борт (−x): кабина справа
  // Угол текстуры — серый для крыши.
  g.fillStyle = '#8e9397'; g.fillRect(W - 8, 0, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// Лобовая часть: красная маска, лобовое стекло, оранжевый буфер с огнями, номер.
function frontTexture() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const X = (x) => (x + 1.55) / 3.1 * S, Y = (y) => S - (y - 1.3) / 3.32 * S;
  g.fillStyle = '#c8141c'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#8e9397'; g.fillRect(0, 0, S, Y(4.05));
  g.fillStyle = '#ef6a1a'; g.fillRect(0, Y(2.6), S, Y(1.95) - Y(2.6));
  g.fillStyle = '#b8bcbe'; g.fillRect(0, Y(1.95), S, Y(1.3) - Y(1.95));
  // Лобовое стекло с рамой и дворниками.
  g.fillStyle = '#1b2a36'; g.fillRect(X(-1.12), Y(3.92), X(1.12) - X(-1.12), Y(2.85) - Y(3.92));
  const grd = g.createLinearGradient(0, Y(3.92), 0, Y(2.85));
  grd.addColorStop(0, 'rgba(160,200,230,0.55)'); grd.addColorStop(1, 'rgba(40,70,90,0.2)');
  g.fillStyle = grd; g.fillRect(X(-1.1), Y(3.9), X(1.1) - X(-1.1), Y(2.87) - Y(3.9));
  g.strokeStyle = '#0d0d0d'; g.lineWidth = 5; g.strokeRect(X(-1.12), Y(3.92), X(1.12) - X(-1.12), Y(2.85) - Y(3.92));
  g.strokeStyle = '#111'; g.lineWidth = 3;
  for (const x of [-0.75, 0.55]) { g.beginPath(); g.moveTo(X(x), Y(2.9)); g.lineTo(X(x + 0.18), Y(3.65)); g.stroke(); }
  // Буферные фонари: белые прожекторы и красные хвостовые.
  for (const s of [-1, 1]) {
    g.fillStyle = '#fafafa'; g.beginPath(); g.arc(X(s * 0.95), Y(2.28), 15, 0, 7); g.fill();
    g.fillStyle = '#e01919'; g.beginPath(); g.arc(X(s * 1.25), Y(2.28), 13, 0, 7); g.fill();
    g.fillStyle = '#eceff0'; g.fillRect(X(s * 0.95) - 26, Y(2.12), 52, 14);
  }
  g.fillStyle = '#fff'; g.font = '900 italic 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('РЖД', X(0), Y(2.45));
  g.fillStyle = '#1b1b1b'; g.fillRect(X(-0.42), Y(2.2), X(0.42) - X(-0.42), 26);
  g.fillStyle = '#fff'; g.font = '700 20px Arial'; g.fillText('2ЭС6-126', X(0), Y(2.2) + 13);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Кузов секции: «лофт» по кольцам сечения; нос — лобовое стекло наклонено, углы срезаны.
const RING = [[1.55, 1.3], [1.55, 2.05], [1.55, 2.75], [1.55, 3.95], [1.3, 4.4], [0.95, 4.62], [-0.95, 4.62], [-1.3, 4.4], [-1.55, 3.95], [-1.55, 2.75], [-1.55, 2.05], [-1.55, 1.3]];
const HL = 8.3, NOSE0 = 5.9;
const noseZ = (y) => (y <= 2.75 ? HL : y <= 3.95 ? HL - (y - 2.75) * 0.5 : HL - 0.6 - (y - 3.95) * 1.7);
function bodyGeometry() {
  const rings = [];
  const ringAt = (t, zBody) => RING.map(([x, y]) => {
    if (zBody !== undefined) return [x, y, zBody];
    const k = t * t;
    const sx = 1 - 0.16 * Math.pow(t, 2.4) * (y > 2.75 ? 1.25 : 1);
    return [x * sx, y, NOSE0 + (noseZ(y) - NOSE0) * k ** 0.5 * t ** 0.5];
  });
  rings.push(ringAt(0, -HL), ringAt(0, -HL + 0.4), ringAt(0, NOSE0));
  for (let k = 1; k <= 6; k++) rings.push(ringAt(k / 6));
  const P = [], N = [], UV = [];
  const uvOf = (x, y, z, side) => {
    if (side === 0) return [0.998, 0.998];
    const v = Math.min(1, Math.max(0, (y - 1.3) / 3.32));
    return side > 0 ? [0.5 * (HL - z) / (2 * HL), v] : [0.5 + 0.5 * (z + HL) / (2 * HL), v];
  };
  const quad = (a, b, c, d) => {
    const ax = (a[0] + b[0] + c[0] + d[0]) / 4, ay = (a[1] + b[1] + c[1] + d[1]) / 4;
    const side = ay > 4.15 ? 0 : ax > 0 ? 1 : -1;
    const n = V(...b).sub(V(...a)).cross(V(...d).sub(V(...a))).normalize();
    for (const p of [a, b, c, a, c, d]) { P.push(...p); N.push(n.x, n.y, n.z); UV.push(...uvOf(...p, side)); }
  };
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let j = 0; j < RING.length - 1; j++) quad(A[j], A[j + 1], B[j + 1], B[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  // Лоб и задний торец — веером из центра.
  const cap = (ring, front) => {
    const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length, a[2] + p[2] / ring.length], [0, 0, 0]);
    const p = [], n = [], uv = [];
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j], b = ring[(j + 1) % ring.length];
      const tri = front ? [c, a, b] : [c, b, a];
      const nn = V(...tri[1]).sub(V(...tri[0])).cross(V(...tri[2]).sub(V(...tri[0]))).normalize();
      for (const q of tri) { p.push(...q); n.push(nn.x, nn.y, nn.z); uv.push((q[0] + 1.55) / 3.1, (q[1] - 1.3) / 3.32); }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    cg.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return cg;
  };
  return {body: g, front: cap(rings[rings.length - 1], true), back: cap(rings[0], false)};
}

let LOCO_PARTS = null;
function locoParts() {
  if (LOCO_PARTS) return LOCO_PARTS;
  const geo = bodyGeometry();
  LOCO_PARTS = {
    geo,
    side: new THREE.MeshStandardMaterial({map: sideTexture(), roughness: 0.5, metalness: 0.05}),
    front: new THREE.MeshStandardMaterial({map: frontTexture(), roughness: 0.4, metalness: 0.05}),
    grey: mat(0x8e9397, {roughness: 0.55}),
    dark: mat(0x2c3034, {roughness: 0.6}),
    steel: mat(0xc9ced2, {metalness: 0.85, roughness: 0.3}),
    red: mat(0xc8141c, {roughness: 0.4}),
    orange: mat(0xef6a1a, {roughness: 0.45}),
    rail: mat(0xb2471a, {roughness: 0.5}),
    ins: mat(0xb9bdbf, {roughness: 0.35, metalness: 0.1}),
    rubber: mat(0x16181a, {roughness: 0.9}),
    lamp: new THREE.MeshStandardMaterial({color: 0xfff4d0, emissive: 0xfff0c0, emissiveIntensity: 2.2}),
    glass: mat(0x1d2c38, {metalness: 0.7, roughness: 0.08}),
  };
  return LOCO_PARTS;
}

const add = (g, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = true;
  g.add(o);
  return o;
};
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylG = (r, h, s = 12) => new THREE.CylinderGeometry(r, r, h, s);

// Тележка: боковины, колёсные пары, буксы, пружины, тяговые двигатели. Вперёд — +z.
function bogie(P) {
  const g = new THREE.Group();
  const wheels = [];
  for (const sx of [-1, 1]) {
    add(g, boxG(0.32, 0.5, 4.0), P.dark, sx * 1.12, 0.78, 0);
    add(g, boxG(0.3, 0.26, 4.4), P.dark, sx * 1.12, 1.08, 0);
    for (const sz of [-1.3, 1.3]) {
      add(g, boxG(0.42, 0.42, 0.5), P.grey, sx * 1.22, 0.63, sz);                            // букса
      add(g, cylG(0.13, 0.48, 8), P.rubber, sx * 1.12, 1.0, sz - 0.42);                       // пружины
      add(g, cylG(0.13, 0.48, 8), P.rubber, sx * 1.12, 1.0, sz + 0.42);
      add(g, cylG(0.16, 0.1, 10), P.orange, sx * 1.45, 0.63, sz, 0, 0, Math.PI / 2);           // крышка буксы
    }
    add(g, cylG(0.12, 0.6, 8), P.steel, sx * 1.36, 0.95, 0.0, 0, 0, Math.PI / 2);              // гидродемпфер
  }
  for (const sz of [-1.3, 1.3]) {
    const ws = new THREE.Group();
    ws.position.set(0, 0.625, sz);
    g.add(ws);
    add(ws, cylG(0.09, 1.9, 8), P.steel, 0, 0, 0, 0, 0, Math.PI / 2);
    for (const sx of [-0.79, 0.79]) {
      add(ws, cylG(0.625, 0.14, 22), P.dark, sx, 0, 0, 0, 0, Math.PI / 2);
      add(ws, cylG(0.66, 0.035, 22), P.steel, sx * 0.94, 0, 0, 0, 0, Math.PI / 2);              // гребень
      add(ws, boxG(0.16, 0.9, 0.14), P.grey, sx, 0, 0);                                         // спица/диск
    }
    add(g, boxG(1.3, 0.75, 0.9), P.dark, 0, 0.72, sz * 0.45);                                   // тяговый двигатель
    wheels.push(ws);
  }
  add(g, boxG(2.4, 0.3, 0.8), P.grey, 0, 1.15, 0);                                              // шкворневая балка
  g.userData.wheels = wheels;
  return g;
}

// Токоприёмник (одноплечий): основание на изоляторах, нижнее и верхнее плечо, полоз с двумя вставками.
function pantograph(P) {
  const g = new THREE.Group();
  add(g, boxG(1.7, 0.16, 1.5), P.red, 0, 0.42, 0);
  for (const [x, z] of [[-0.75, -0.6], [0.75, -0.6], [-0.75, 0.6], [0.75, 0.6]]) {
    for (let k = 0; k < 4; k++) add(g, cylG(0.13 - (k % 2) * 0.03, 0.08, 10), P.ins, x, 0.06 + k * 0.08, z);
  }
  add(g, boxG(0.5, 0.35, 0.45), P.red, 0, 0.62, -0.4);
  const lower = new THREE.Group(), upper = new THREE.Group(), head = new THREE.Group();
  lower.position.set(0, 0.62, -0.4);
  g.add(lower);
  add(lower, boxG(0.16, 0.16, 1.9), P.red, 0, 0, 0.95);
  add(lower, cylG(0.04, 1.9, 6), P.red, 0.22, 0, 0.95, Math.PI / 2);
  upper.position.set(0, 0, 1.9);
  lower.add(upper);
  add(upper, cylG(0.05, 1.95, 6), P.red, 0, 0, -0.975, Math.PI / 2);
  head.position.set(0, 0, -1.95);
  upper.add(head);
  for (const dz of [-0.2, 0.2]) add(head, boxG(1.9, 0.07, 0.1), P.steel, 0, 0.05, dz);
  for (const sx of [-1, 1]) add(head, new THREE.TorusGeometry(0.22, 0.025, 4, 10, Math.PI), P.steel, sx * 1.0, 0.0, 0, 0, sx * Math.PI / 2, 0);
  // Поднять полоз на высоту h над шарниром основания.
  g.userData.raise = (h) => {
    const a = 1.9, b = 1.95, zh = -0.3, d = Math.min(a + b - 0.05, Math.hypot(zh, h));
    const phi = Math.atan2(h, zh + 0.4), al = Math.acos((a * a + d * d - b * b) / (2 * a * d));
    const th = phi - al;                                    // угол нижнего плеча от +z вверх
    lower.rotation.x = -th;
    const be = Math.acos((a * a + b * b - d * d) / (2 * a * b));
    upper.rotation.x = be;
    head.rotation.x = -(lower.rotation.x + upper.rotation.x);
  };
  return g;
}

// Секция электровоза: кабина в +z, переход — в −z.
function locoSection() {
  const P = locoParts();
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  add(body, P.geo.body, P.side, 0, 0, 0);
  add(body, P.geo.front, P.front, 0, 0, 0);
  add(body, P.geo.back, P.grey, 0, 0, 0);
  // Рама и подкузовное оборудование.
  add(body, boxG(3.0, 0.32, 16.2), P.grey, 0, 1.2, 0);
  for (const z of [-0.9, 1.6]) add(body, boxG(2.6, 0.7, 2.2), P.grey, 0, 0.95, z);
  add(body, boxG(2.7, 0.55, 1.3), P.dark, 0, 0.9, -2.6);
  add(body, cylG(0.32, 2.4, 12), P.steel, 0.9, 0.85, 3.1, Math.PI / 2);                           // главные резервуары
  add(body, cylG(0.32, 2.4, 12), P.steel, -0.9, 0.85, 3.1, Math.PI / 2);
  // Лобовая часть: путеочиститель, автосцепка, рукава, лобовой прожектор, зеркала.
  const plow = new THREE.Shape();
  plow.moveTo(-1.45, 0); plow.lineTo(1.45, 0); plow.lineTo(1.25, -0.75); plow.lineTo(-1.25, -0.75); plow.closePath();
  const pl = add(body, new THREE.ExtrudeGeometry(plow, {depth: 0.5, bevelEnabled: false}), P.orange, 0, 1.15, HL - 0.55);
  pl.scale.z = 1;
  add(body, boxG(2.9, 0.45, 0.5), P.orange, 0, 1.45, HL - 0.2);
  add(body, boxG(0.42, 0.32, 0.9), P.dark, 0, 1.05, HL + 0.35);
  for (const x of [-0.6, 0, 0.6]) add(body, new THREE.TorusGeometry(0.2, 0.03, 4, 10, Math.PI), P.dark, x, 1.15, HL + 0.12, 0, 0, Math.PI);
  add(body, boxG(0.6, 0.42, 0.5), P.grey, 0, 4.6, HL - 1.1);
  add(body, new THREE.CircleGeometry(0.17, 14), P.lamp, 0, 4.6, HL - 0.84);
  for (const s of [-1, 1]) {
    add(body, new THREE.CircleGeometry(0.11, 12), P.lamp, s * 0.95, 2.28, HL + 0.02);
    add(body, boxG(0.06, 0.45, 0.28), P.dark, s * 1.62, 3.3, HL - 1.55);
  }
  // Крыша: токоприёмник у кабины, изоляторы, шины, ограждения, жалюзи, антенна.
  const pan = pantograph(P);
  pan.position.set(0, 4.62, 3.9);
  pan.rotation.y = Math.PI;
  body.add(pan);
  for (const [x, z] of [[-0.6, 1.8], [0.6, 1.8], [-0.6, 5.3], [0.6, 5.3], [0, -4.8], [0.5, -5.6]]) {
    for (let k = 0; k < 5; k++) add(body, cylG(0.15 - (k % 2) * 0.04, 0.07, 10), P.ins, x, 4.66 + k * 0.07, z);
  }
  add(body, cylG(0.035, 11, 6), P.steel, 0.6, 5.05, -0.4, Math.PI / 2);                          // крышевая шина
  for (let z = -7.4; z < 3; z += 2.4) {
    for (const s of [-1, 1]) {
      add(body, boxG(0.08, 0.32, 0.08), P.rail, s * 1.0, 4.78, z);
      add(body, boxG(0.08, 0.32, 0.08), P.rail, s * 1.0, 4.78, z + 1.6);
      add(body, boxG(0.1, 0.08, 1.8), P.rail, s * 1.0, 4.96, z + 0.8);
    }
  }
  add(body, boxG(1.2, 0.04, 0.7), P.dark, -0.4, 4.63, -2.0);
  add(body, boxG(1.0, 0.04, 0.5), P.dark, 0.4, 4.63, 6.3);
  add(body, cylG(0.02, 1.4, 4), P.steel, -0.9, 5.3, -7.4);
  // Переход между секциями.
  for (let k = 0; k < 6; k++) add(body, boxG(2.0, 2.6, 0.06), P.rubber, 0, 3.0, -HL - 0.05 - k * 0.06);
  // Тележки.
  const bogies = [-4.5, 4.5].map((z) => { const b = bogie(P); b.position.set(0, 0, z); g.add(b); return b; });
  pan.userData.raise(0.3);
  // Сотни деталей → несколько мешей: кузов целиком, тележки, колёсные пары (крутятся).
  pan.userData.dynamic = true;
  mergeStatic(body);
  for (const b of bogies) {
    for (const ws of b.userData.wheels) { ws.userData.dynamic = true; mergeStatic(ws); }
    mergeStatic(b);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = {body, bogies, pan, panH: 0.3};
  return g;
}

// ---------------------------------------------------------------- вагоны-цистерны (инстансы)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function loadTankCar(count) {
  return new Promise((resolve, reject) => {
    loader.load('models/tankcar.glb', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const body = [], bogie = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        // Квантованные атрибуты (meshopt) → float, иначе перенос в мировые координаты обрежет значения.
        const g = new THREE.BufferGeometry();
        for (const [name, at] of Object.entries(o.geometry.attributes)) {
          const arr = new Float32Array(at.count * at.itemSize);
          for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) arr[i * at.itemSize + c] = at.getComponent(i, c);
          g.setAttribute(name, new THREE.BufferAttribute(arr, at.itemSize));
        }
        g.setIndex(o.geometry.index);
        // Тележки — относительно своего шкворня, чтобы поворачиваться в кривых.
        const isBogie = /bogie/.test(o.parent?.name || '');
        const m4 = o.matrixWorld.clone();
        if (isBogie) {
          const pv = new THREE.Vector3().setFromMatrixPosition(o.parent.matrixWorld);
          m4.premultiply(new THREE.Matrix4().makeTranslation(-pv.x, -pv.y, -pv.z));
          if (pv.z > 0) return;                                  // одна тележка-образец; вторая — тот же инстанс
        }
        g.applyMatrix4(m4);
        const mt = o.material;
        mt.roughness = Math.min(mt.roughness ?? 1, 0.6);
        const im = new THREE.InstancedMesh(g, mt, isBogie ? count * 2 : count);
        im.frustumCulled = false;
        im.castShadow = true;
        im.userData.noCast = false;
        (isBogie ? bogie : body).push(im);
      });
      resolve({body, bogie});
    }, undefined, reject);
  });
}

// ---------------------------------------------------------------- состав
// cars — сколько вагонов в поезде; extra — неподвижные вагоны: [{x, y, z, yaw}].
export function makeTrain(stage, {cars = 20, extra = []} = {}) {
  const group = new THREE.Group();
  const secs = [locoSection(), locoSection()];
  secs[1].userData.flip = true;
  for (const s of secs) group.add(s);
  const total = cars + extra.length;
  let inst = null;
  const ready = loadTankCar(total).then((r) => {
    inst = r;
    for (const im of [...r.body, ...r.bogie]) group.add(im);
    extra.forEach((e, i) => placeCarStatic(cars + i, e));
    place(lastS);
  });
  const a = {}, b = {}, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), up = V(0, 1, 0);
  const pA = V(0, 0, 0), pB = V(0, 0, 0);
  const yawQ = (dx, dz) => q.setFromAxisAngle(up, Math.atan2(dx, dz));
  // Кузов между двумя точками пути (центры тележек) — уклон и поворот.
  const orient = (obj, sFront, sBack, flip) => {
    railAt(sFront, a); railAt(sBack, b);
    pA.set(a.x, a.y + RAIL_TOP, a.z); pB.set(b.x, b.y + RAIL_TOP, b.z);
    const dir = pA.clone().sub(pB).normalize();
    if (flip) dir.negate();
    obj.position.copy(pA).add(pB).multiplyScalar(0.5);
    obj.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
  };
  function placeCarStatic(i, e) {
    if (!inst) return;
    q.setFromAxisAngle(up, e.yaw ?? Math.PI / 2);
    m4.compose(V(e.x, e.y, e.z), q, one);
    for (const im of inst.body) { im.setMatrixAt(i, m4); im.instanceMatrix.needsUpdate = true; }
    for (const [k, dz] of [[0, -3.86], [1, 3.86]]) {
      const bm = new THREE.Matrix4().compose(V(e.x, e.y, e.z).add(V(0, 0, dz).applyQuaternion(q)), q, one);
      for (const im of inst.bogie) { im.setMatrixAt(i * 2 + k, bm); im.instanceMatrix.needsUpdate = true; }
    }
  }
  let lastS = 0, spin = 0;
  const tmpO = new THREE.Object3D();
  // sHead — путь головы поезда (лоб первой секции) по оси железной дороги.
  function place(sHead) {
    spin += (sHead - lastS) / 0.625;
    lastS = sHead;
    // Секции электровоза: первая кабиной вперёд, вторая — назад.
    const c0 = sHead - SEC / 2, c1 = sHead - SEC - GAP - SEC / 2;
    orient(secs[0], c0 + 4.5, c0 - 4.5, false);
    orient(secs[1], c1 + 4.5, c1 - 4.5, true);
    for (const [k, s] of secs.entries()) {
      const cc = k === 0 ? c0 : c1;
      s.userData.bogies.forEach((bg, j) => {
        const sb = cc + (j === 0 ? -4.5 : 4.5) * (k === 0 ? 1 : -1);
        railAt(sb, a);
        const w = new THREE.Vector3(a.x, a.y + RAIL_TOP, a.z);
        s.worldToLocal(w);
        bg.position.set(0, w.y, bg.position.z);
        const t = V(a.tx, 0, a.tz).transformDirection(new THREE.Matrix4().copy(s.matrixWorld).invert());
        bg.rotation.y = Math.atan2(t.x, t.z) + (k === 1 ? Math.PI : 0);
        bg.userData.wheels.forEach((w2) => (w2.rotation.x = spin * (k === 1 ? -1 : 1)));
      });
      s.updateMatrixWorld();
    }
    // Токоприёмник задней секции поднят под контактный провод (сеть начинается за эстакадой налива).
    const want = 0.3 + 0.8 * Math.min(1, Math.max(0, (sHead - 735) / 25));
    const sp = secs[1].userData;
    if (Math.abs(sp.panH - want) > 0.01) { sp.panH = want; sp.pan.userData.raise(want); }
    if (!inst) return;
    // Вагоны.
    for (let i = 0; i < cars; i++) {
      const c = sHead - LOCO_LEN - 0.3 - (i + 0.5) * CAR;
      orient(tmpO, c + 3.86, c - 3.86, false);
      tmpO.position.y += 0.08;
      tmpO.updateMatrix();
      for (const im of inst.body) im.setMatrixAt(i, tmpO.matrix);
      for (const [k, sb] of [[0, c - 3.86], [1, c + 3.86]]) {
        railAt(sb, a);
        yawQ(a.tx, a.tz);
        m4.compose(V(a.x, a.y + RAIL_TOP + 0.08, a.z), q, one);
        for (const im of inst.bogie) im.setMatrixAt(i * 2 + k, m4);
      }
    }
    for (const im of [...inst.body, ...inst.bogie]) im.instanceMatrix.needsUpdate = true;
  }
  stage.registerTree?.(group, 'train');
  // Неподвижные вагоны (отстойный путь нефтебазы) рисуются, только когда камера рядом.
  let extrasOn = true;
  const setExtras = (on) => {
    if (!inst || on === extrasOn) return;
    extrasOn = on;
    for (const im of inst.body) im.count = on ? total : cars;
    for (const im of inst.bogie) im.count = (on ? total : cars) * 2;
  };
  return {group, place, ready, head: () => lastS, sections: secs, setExtras};
}
