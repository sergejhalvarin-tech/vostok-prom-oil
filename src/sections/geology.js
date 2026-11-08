// Геологическое строение под всей картой. Задняя стенка разреза (плоскость z = FACE_Z) тянется через всю
// карту — от открытого моря под платформой до гор — и сверху повторяет настоящий рельеф (дно, склон, суша).
// Пласты неровные: складки, подъём под горами, разная толщина, выклинивание известняков, два разлома со сдвигом.
// Перед стенкой массив «вырезан»: границы пластов показаны полупрозрачными поверхностями, нефтяная залежь —
// полупрозрачным куполом, внутри — куст скважин во все стороны с бегущей нефтью и водой.
import * as THREE from 'three';
import {makeBeads, glassPipeMaterial, OIL, WATER} from '../kit/sea.js';
import {SEABED} from '../kit/stage.js';
import {heightAt} from './landscape.js';

export const FACE_Z = -300;
const X0 = -3600, X1 = 6200;
export const OWC = -188; // водонефтяной контакт

let seed = 5;
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

// Поверхность: дно моря или суша.
export function surfaceAt(x, z) { return x < 1420 ? SEABED : Math.max(SEABED, heightAt(x, z)); }

// Купол (антиклиналь) под платформой.
const dome = (x, z) => Math.cos(Math.min(1, Math.hypot(x, z * 1.1) / 600) * Math.PI / 2);
const RES_T = (x, z) => -200 + 36 * dome(x, z) + (fbm(x / 160, z / 160) - 0.5) * 6;
const RES_B = (x, z) => -236 + 36 * dome(x, z) + (fbm(x / 140 + 3, z / 140) - 0.5) * 8;
export const RES_TOP = (x) => RES_T(x, 0);
export const RES_BOT = (x) => RES_B(x, 0);

// Кровли пластов (сверху вниз). Учитывают складки, подъём под горами, разломы и выклинивание.
function boundaries(x, z) {
  const S = surfaceAt(x, z);
  const land = smooth(1500, 4200, x);
  const lift = land * 130;                                                // подъём толщи под горами
  const foldAmp = 1 + 2.2 * land;
  const fold = (Math.sin(x / 520 + z / 900) + 0.55 * Math.sin(x / 230 - z / 410 + 1.3)) * foldAmp;
  const n = (k) => (fbm(x / 210 + k * 7.1, z / 210 - k * 3.3) - 0.5) * 2;
  // Разломы: справа от линии разлома блок опущен (F1) или поднят (F2).
  const f1 = x > 820 + 0.25 * z ? -24 : 0;
  const f2 = x > 2650 - 0.18 * z ? 38 : 0;
  const shift = f1 + f2;
  const d = dome(x, z);
  const b = [];
  b[0] = Math.min(S - 4, -34 + lift * 0.35 + n(1) * 5 + fold * 2);                                    // осадки | глины
  b[1] = -78 + 8 * d + lift * 0.6 + fold * 6 + n(2) * 7 + shift * 0.6;                                // глины | песчано-глинистая
  b[2] = -124 + 20 * d + lift * 0.75 + fold * 10 + n(3) * 9 + shift;                                  // | известняки
  const lime = 0.15 + 0.85 * (1 - smooth(1150, 1450, x) * (1 - smooth(1750, 2050, x)));              // известняки выклиниваются
  b[3] = b[2] - (40 + 12 * d + n(4) * 10) * lime;                                                    // | покрышка
  b[4] = x < 1000 ? RES_T(x, z) + shift : b[3] - 32 + n(5) * 6;                                      // | коллектор
  b[4] = Math.min(b[4], b[3] - 6);
  b[5] = x < 1000 ? RES_B(x, z) + shift : b[4] - 30 + n(6) * 8;                                      // | подстилающие
  b[6] = -430 + lift * 0.4 + fold * 8;                                                               // низ разреза
  for (let i = 0; i < b.length; i++) b[i] = Math.min(b[i], (i ? b[i - 1] : S) - 2.5);
  return {S, b};
}

// ----------------------------------------------------------------------
function rockTexture(base, {grain = 0.5, streaks = 0, cracks = 0, pebbles = 0, pores = 0}) {
  const Sz = 512, cv = document.createElement('canvas');
  cv.width = cv.height = Sz;
  const g = cv.getContext('2d');
  const c = new THREE.Color(base);
  g.fillStyle = `#${c.getHexString()}`;
  g.fillRect(0, 0, Sz, Sz);
  const tone = (k, a) => { const t = c.clone().offsetHSL(0, 0, k); return `rgba(${(t.r * 255) | 0},${(t.g * 255) | 0},${(t.b * 255) | 0},${a})`; };
  for (let i = 0; i < streaks; i++) {
    const y = rnd() * Sz, h = 2 + rnd() * 10;
    g.fillStyle = tone((rnd() - 0.5) * 0.18, 0.5);
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= Sz; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
    g.lineTo(Sz, y + h); g.lineTo(0, y + h); g.fill();
  }
  for (let i = 0; i < 9000 * grain; i++) { g.fillStyle = tone((rnd() - 0.5) * 0.3, 0.35); const r = 0.6 + rnd() * 2.2; g.fillRect(rnd() * Sz, rnd() * Sz, r, r); }
  for (let i = 0; i < pebbles; i++) {
    const x = rnd() * Sz, y = rnd() * Sz, r = 3 + rnd() * 9;
    g.fillStyle = tone(-0.12 + rnd() * 0.25, 0.9);
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < pores; i++) { g.fillStyle = tone(-0.25, 0.8); g.beginPath(); g.arc(rnd() * Sz, rnd() * Sz, 1 + rnd() * 3, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = tone(-0.3, 0.7);
  for (let i = 0; i < cracks; i++) {
    g.lineWidth = 1 + rnd() * 1.5;
    let x = rnd() * Sz, y = rnd() * Sz;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += 10 + rnd() * 30; g.lineTo(x, y); }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const LAYERS = [
  {name: 'Донные осадки и почвы', color: 0xb7a175, tex: {grain: 1, pebbles: 60, streaks: 12}},
  {name: 'Глины', color: 0x8b7f6b, tex: {grain: 0.6, streaks: 30}},
  {name: 'Песчано-глинистая толща', color: 0xa38b62, tex: {grain: 1.1, streaks: 18, pebbles: 30}},
  {name: 'Известняки', color: 0xbdb6a4, tex: {grain: 0.7, cracks: 26, pebbles: 20, streaks: 8}},
  {name: 'Покрышка — плотные глины', color: 0x544c45, tex: {grain: 0.5, streaks: 40}},
  {name: 'Коллектор', color: 0x587080, tex: {grain: 0.8, pores: 900, cracks: 6}},
  {name: 'Подстилающие породы', color: 0x766c60, tex: {grain: 0.9, cracks: 14, streaks: 10}},
];

// Лента слоя на стенке разреза: между двумя кривыми, с неровной (рельефной) поверхностью скола.
function faceStrip(topFn, botFn, rows = 6, step = 6) {
  const cols = Math.ceil((X1 - X0) / step);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= cols; i++) {
    const x = X0 + i * step, t = topFn(x), b = botFn(x);
    for (let j = 0; j <= rows; j++) {
      const y = t + (b - t) * (j / rows);
      const jag = (fbm(x / 9, y / 9) - 0.5) * 2.6 + (fbm(x / 40, y / 40) - 0.5) * 3;
      pos.push(x, y, FACE_Z + jag);
      uv.push(x / 70, y / 70);
    }
  }
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const a = i * (rows + 1) + j, c = a + rows + 1;
    idx.push(a, a + 1, c, c, a + 1, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Полупрозрачная неровная поверхность (граница пласта) над участком перед стенкой.
function sheet(fn, {x0 = -560, x1 = 560, z0 = FACE_Z, z1 = 360, seg = 96} = {}) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, seg, Math.round((seg * (z1 - z0)) / (x1 - x0))).rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, fn(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  return geo;
}
function gridTexture(color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1120 / 40, 660 / 40);
  return t;
}

// ======================================================================
export function makeSection() {
  const group = new THREE.Group();

  // --- стенка разреза на всю карту ---
  const cache = new Map();
  const B = (x) => { if (!cache.has(x)) cache.set(x, boundaries(x, FACE_Z)); return cache.get(x); };
  const tops = [(x) => B(x).S - 0.3, ...[0, 1, 2, 3, 4, 5].map((k) => (x) => B(x).b[k])];
  const bottomFn = (x) => B(x).b[6];
  LAYERS.forEach((L, i) => {
    const tex = rockTexture(L.color, L.tex);
    const mat = new THREE.MeshStandardMaterial({map: tex, bumpMap: tex, bumpScale: 2.2, roughness: 0.92});
    const m = new THREE.Mesh(faceStrip(tops[i], i < LAYERS.length - 1 ? tops[i + 1] : bottomFn), mat);
    m.userData.noCast = true;
    group.add(m);
  });
  // Разломы: тёмные трещины на стенке.
  for (const fx of [820 + 0.25 * FACE_Z, 2650 - 0.18 * FACE_Z]) {
    const top = B(Math.round(fx / 6) * 6).S, bot = -470;
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(2.2, top - bot), new THREE.MeshBasicMaterial({color: 0x1a1512}));
    crack.position.set(fx, (top + bot) / 2, FACE_Z + 3.5);
    crack.rotation.z = 0.12;
    group.add(crack);
  }

  // --- границы пластов перед стенкой: полупрозрачные неровные поверхности ---
  const sheetMat = (c, o) => new THREE.MeshStandardMaterial({map: gridTexture(c), transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8});
  const SH = [['#8b7f6b', 0.09, 0], ['#a38b62', 0.08, 1], ['#bdb6a4', 0.09, 2], ['#544c45', 0.14, 3]];
  for (const [c, o, k] of SH) {
    const m = new THREE.Mesh(sheet((x, z) => boundaries(x, z).b[k]), sheetMat(c, o));
    m.renderOrder = 4;
    group.add(m);
  }
  // Подошва коллектора (водонасыщенная часть) — голубоватая.
  const wb = new THREE.Mesh(sheet((x, z) => boundaries(x, z).b[5]), sheetMat('#4f7a96', 0.12));
  wb.renderOrder = 4;
  group.add(wb);

  // --- нефтяная залежь: полупрозрачный купол над водонефтяным контактом ---
  const top = sheet((x, z) => Math.max(OWC, RES_T(x, z)), {x0: -460, x1: 460, z0: -460, z1: 460, seg: 120});
  const bottom = sheet(() => OWC, {x0: -460, x1: 460, z0: -460, z1: 460, seg: 4});
  const oilMat = new THREE.MeshStandardMaterial({color: 0x7a3c0a, emissive: 0x4a2000, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.1,
    transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide});
  for (const g of [top, bottom]) { const m = new THREE.Mesh(g, oilMat); m.renderOrder = 5; group.add(m); }

  // --- куст скважин во все стороны ---
  const heads = [];
  for (let i = 0; i < 12; i++) heads.push(new THREE.Vector3(-14 + (i % 4) * 6, SEABED, -12 + Math.floor(i / 4) * 8));
  const midOil = (x, z) => (Math.max(RES_T(x, z), OWC + 2) + OWC) / 2;
  const midWater = (x, z) => (Math.min(RES_T(x, z), OWC) + RES_B(x, z)) / 2;
  const well = (h, az, R, depthFn) => {
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    if (dir.z < -0.05) R = Math.min(R, (h.z - FACE_Z - 25) / -dir.z);
    const at = (k, y) => h.clone().addScaledVector(dir, R * k).setY(y);
    const p3 = at(0.62, 0), p4 = at(1, 0);
    p3.y = depthFn(p3.x, p3.z);
    p4.y = depthFn(p4.x, p4.z);
    return new THREE.CatmullRomCurve3([h.clone(), at(0, SEABED - 45), at(0.28, -128), p3, p4], false, 'centripetal');
  };
  const prod = [], inj = [];
  for (let k = 0; k < 8; k++) prod.push(well(heads[k], (k / 8) * Math.PI * 2 + 0.2, 200 + (k % 3) * 55, midOil));
  for (let k = 0; k < 4; k++) inj.push(well(heads[8 + k], (k / 4) * Math.PI * 2 + 0.6, 500, midWater));
  const mProd = glassPipeMaterial(0xffc27a, 0.3), mInj = glassPipeMaterial(0x8cc8ff, 0.3);
  for (const c of prod) group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 160, 1.9, 14), mProd));
  for (const c of inj) group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 160, 1.9, 14), mInj));
  const oil = makeBeads(prod, 70, 1.05, OIL, 22, true);
  const wat = makeBeads(inj, 80, 1.0, WATER, 26, false);
  group.add(oil.mesh, wat.mesh);

  return {group, update: (dt) => { if (group.visible) { oil.update(dt); wat.update(dt); } }};
}
