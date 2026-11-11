// Грузовой электровоз 2ЭС6 «Синара» — одна секция, построена с нуля по фотографиям прототипа.
// Кузов — сплошная оболочка со скруглёнными рёбрами (лофт по сечениям), нос: вертикальный низ, наклонное
// лобовое стекло, скат крыши, скруглённые углы. Окраска — лак (clearcoat), окна — настоящие стёкла в рамах,
// двери, поручни, подножки, жалюзи из ламелей, буферный брус, путеочиститель, прожекторы, тележки с
// колёсами-«точёнками», буксами, витыми пружинами, тяговыми двигателями; одноплечий токоприёмник.
// Локальные оси: x — поперёк, y — вверх от головки рельса, z — вперёд (кабина в +z).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeStatic} from '../kit/merge.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HL = 8.3, NOSE0 = 5.55, W = 1.56, Y0 = 1.28, YS = 4.02, YR = 4.64, RW = 1.1;

// ---------------------------------------------------------------- окраска
function livery() {
  const Wt = 4096, Ht = 1024, c = document.createElement('canvas');
  c.width = Wt; c.height = Ht;
  const g = c.getContext('2d');
  const paint = (x0, frontLeft) => {
    const L = 2 * HL, px = (Wt / 2) / L, py = Ht / (YR - Y0);
    const X = (z) => x0 + (frontLeft ? (HL - z) : (z + HL)) * px;
    const Y = (y) => Ht - (y - Y0) * py;
    g.save();
    g.beginPath(); g.rect(x0, 0, Wt / 2, Ht); g.clip();
    g.fillStyle = '#c9ccce'; g.fillRect(x0, 0, Wt / 2, Ht);
    const edge = (z) => (z < -1.6 ? 3.5 : z > 4.4 ? 2.22 : 3.5 - ((z + 1.6) / 6.0) * 1.28);
    const band = (off, col) => {
      g.fillStyle = col; g.beginPath();
      g.moveTo(X(-HL), Y(YR));
      for (let z = -HL; z <= HL + 0.01; z += 0.1) g.lineTo(X(z), Y(edge(z) - off));
      g.lineTo(X(HL), Y(YR)); g.closePath(); g.fill();
    };
    band(0.44, '#f7f7f5');
    band(0, '#c4111b');
    g.fillStyle = '#8a8f93'; g.fillRect(x0, Y(1.56), Wt / 2, Y(Y0) - Y(1.56));
    g.fillStyle = '#b3b7b9'; g.fillRect(x0, Y(2.02), Wt / 2, 4);
    // Логотип РЖД и номер.
    g.fillStyle = '#c4111b';
    g.font = `italic 900 ${Math.round(0.66 * py)}px Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('РЖД', X(0.4), Y(2.78));
    g.fillStyle = '#1c1c1c'; g.font = `700 ${Math.round(0.16 * py)}px Arial, sans-serif`;
    g.fillText('2ЭС6-126', X(5.0), Y(2.42));
    // Швы панелей обшивки.
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3;
    for (const z of [-7.8, -4.6, -2.6, 0.2, 2.5, 3.65]) { g.beginPath(); g.moveTo(X(z), Y(1.36)); g.lineTo(X(z), Y(4.0)); g.stroke(); }
    g.restore();
  };
  paint(0, true);
  paint(Wt / 2, false);
  g.fillStyle = '#8f9498'; g.fillRect(Wt - 16, 0, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 12;
  return t;
}
function frontLivery() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const Y = (y) => S - ((y - Y0) / (YR - Y0)) * S;
  g.fillStyle = '#c4111b'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#8f9498'; g.fillRect(0, 0, S, Y(4.08));
  g.fillStyle = '#f06a16'; g.fillRect(0, Y(2.62), S, Y(1.9) - Y(2.62));
  g.fillStyle = '#b8bcbe'; g.fillRect(0, Y(1.9), S, Y(Y0) - Y(1.9));
  g.fillStyle = '#fff'; g.font = 'italic 900 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('РЖД', S / 2, Y(2.46));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let MAT = null;
function mats() {
  if (MAT) return MAT;
  const m = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.45, metalness: 0.2, ...o});
  MAT = {
    paint: new THREE.MeshPhysicalMaterial({map: livery(), roughness: 0.32, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.12}),
    nose: new THREE.MeshPhysicalMaterial({map: frontLivery(), roughness: 0.32, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.12}),
    red: new THREE.MeshPhysicalMaterial({color: 0xc4111b, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12}),
    orange: new THREE.MeshPhysicalMaterial({color: 0xf06a16, roughness: 0.35, clearcoat: 0.6}),
    grey: m(0x8f9498, {roughness: 0.5}),
    lgrey: m(0xc3c7c9, {roughness: 0.45}),
    dark: m(0x24282c, {roughness: 0.55, metalness: 0.4}),
    black: m(0x121416, {roughness: 0.7}),
    steel: m(0xc5ccd2, {metalness: 0.9, roughness: 0.25}),
    wheel: m(0x3a3e42, {metalness: 0.7, roughness: 0.35}),
    tread: m(0xd9dee2, {metalness: 1, roughness: 0.18}),
    glass: new THREE.MeshPhysicalMaterial({color: 0x1d3446, metalness: 0.1, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6}),
    frame: m(0x111315, {roughness: 0.4}),
    rubber: m(0x101113, {roughness: 0.95}),
    ins: m(0xa8784a, {roughness: 0.3}),
    porcelain: m(0xe8e4dc, {roughness: 0.25}),
    lampW: new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 2.4}),
    lampR: new THREE.MeshStandardMaterial({color: 0xff2a2a, emissive: 0xc00000, emissiveIntensity: 1.2}),
    yellow: m(0xffc21f),
  };
  return MAT;
}

const mesh = (p, geo, mt, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(geo, mt);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = true;
  p.add(o);
  return o;
};
const rbox = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (r, h, s = 16, r2 = r) => new THREE.CylinderGeometry(r2, r, h, s);
const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8);

// ---------------------------------------------------------------- кузов
// Сечение: низ, вертикальный борт, скругление, скат крыши, скругление, крыша — по часовой с правого низа.
function profile() {
  const pts = [];
  const arc = (cx, cy, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  pts.push([W - 0.06, Y0]);
  arc(W - 0.06, Y0 + 0.06, 0.06, -Math.PI / 2, 0, 3);
  pts.push([W, 2.05], [W, 2.75], [W, YS - 0.18]);
  arc(W - 0.22, YS - 0.18, 0.22, 0, Math.PI * 0.3, 4);
  const cR = 0.24;
  arc(RW + 0.1, YR - cR, cR, Math.PI * 0.32, Math.PI / 2, 4);
  pts.push([0.4, YR], [-0.4, YR]);
  const n = pts.length;
  for (let i = n - 1; i >= 0; i--) { const [x, y] = pts[i]; if (x > 0.41) pts.push([-x, y]); }
  return pts;
}
const PROF = profile();
// Нос: где по высоте y стоит лобовая поверхность.
const zFront = (y) => {
  if (y < 2.72) return HL;
  if (y < 3.98) return HL - (y - 2.72) * 0.42;
  return HL - (3.98 - 2.72) * 0.42 - (y - 3.98) * 1.45;
};
function shell() {
  const rings = [];
  const ring = (z, t) => PROF.map(([x, y]) => {
    if (t === undefined) return [x, y, z];
    const k = t * t * (3 - 2 * t);
    const narrow = 1 - 0.12 * Math.pow(t, 2.2) * (y > 2.72 ? 1.4 : 1);
    return [x * narrow, y, NOSE0 + (zFront(y) - NOSE0) * k];
  });
  rings.push(ring(-HL), ring(-HL + 0.2), ring(NOSE0 - 3), ring(NOSE0));
  for (let i = 1; i <= 14; i++) rings.push(ring(0, i / 14));
  const P = [], UV = [], I = [];
  const NP = PROF.length;
  rings.forEach((rg, ri) => rg.forEach(([x, y, z]) => {
    P.push(x, y, z);
    const v = Math.min(1, Math.max(0, (y - Y0) / (YR - Y0)));
    const side = y > YS + 0.25 ? 0 : x > 0 ? 1 : -1;
    UV.push(side === 0 ? 0.998 : side > 0 ? 0.5 * (HL - z) / (2 * HL) : 0.5 + 0.5 * (z + HL) / (2 * HL), side === 0 ? 0.998 : v);
  }));
  for (let r = 0; r < rings.length - 1; r++) for (let j = 0; j < NP - 1; j++) {
    const a = r * NP + j, b = a + 1, c = a + NP, d = c + 1;
    I.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  // Лоб и задний торец: веер из центра последнего/первого кольца.
  const cap = (rg, front) => {
    const c = rg.reduce((a, p) => [a[0] + p[0] / rg.length, a[1] + p[1] / rg.length, a[2] + p[2] / rg.length], [0, 0, 0]);
    const p = [], uv = [];
    for (let j = 0; j < rg.length - 1; j++) {
      const tri = front ? [c, rg[j], rg[j + 1]] : [c, rg[j + 1], rg[j]];
      for (const q of tri) { p.push(...q); uv.push((q[0] + W) / (2 * W), (q[1] - Y0) / (YR - Y0)); }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    cg.computeVertexNormals();
    return cg;
  };
  return {body: g, front: cap(rings[rings.length - 1], true), back: cap(rings[0], false), lastRing: rings[rings.length - 1]};
}

// Окно: стекло в чёрной раме, чуть утоплено в борт. axis: 'x' — на борту, иначе — на лбу.
function sideWindow(p, M, sx, z0, z1, y0, y1) {
  const w = z1 - z0, h = y1 - y0, zc = (z0 + z1) / 2, yc = (y0 + y1) / 2;
  mesh(p, rbox(0.06, h + 0.12, w + 0.12, 0.04), M.frame, sx * (W + 0.005), yc, zc);
  mesh(p, rbox(0.03, h, w, 0.03), M.glass, sx * (W + 0.03), yc, zc);
}

// ---------------------------------------------------------------- тележка
function wheelGeo() {
  // Профиль колеса для токарного тела: ступица, диск, обод с ребордой.
  const pr = [[0.1, -0.09], [0.12, -0.09], [0.12, -0.05], [0.5, -0.04], [0.56, -0.07], [0.6, -0.07], [0.62, -0.075], [0.66, -0.075], [0.66, -0.045], [0.625, -0.04], [0.62, 0.07], [0.56, 0.07], [0.5, 0.035], [0.12, 0.045], [0.12, 0.09], [0.1, 0.09]];
  return new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 28).rotateZ(Math.PI / 2);
}
function spring(r, h, turns = 5) {
  const pts = [];
  for (let i = 0; i <= turns * 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push(V(Math.cos(a) * r, (i / (turns * 16)) * h - h / 2, Math.sin(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, 0.035, 6);
}
function bogie(M) {
  const g = new THREE.Group();
  const wheels = [];
  const WG = wheelGeo();
  for (const sx of [-1, 1]) {
    // Боковина рамы: верхний пояс, наклонные концы, проёмы над буксами.
    mesh(g, rbox(0.26, 0.34, 4.2, 0.05), M.dark, sx * 1.1, 1.08, 0);
    mesh(g, rbox(0.26, 0.42, 1.2, 0.05), M.dark, sx * 1.1, 0.72, 0);
    for (const sz of [-1.3, 1.3]) {
      mesh(g, rbox(0.26, 0.18, 0.95, 0.04), M.dark, sx * 1.1, 0.4, sz);          // нижняя тяга проёма
      mesh(g, rbox(0.3, 0.36, 0.42, 0.06), M.grey, sx * 1.12, 0.63, sz);        // букса
      mesh(g, cyl(0.15, 0.08, 18), M.orange, sx * 1.3, 0.63, sz, 0, 0, Math.PI / 2);
      for (const dz of [-0.36, 0.36]) mesh(g, spring(0.12, 0.42), M.black, sx * 1.1, 0.95, sz + dz);
    }
    mesh(g, cyl(0.07, 0.62, 10), M.steel, sx * 1.28, 1.0, 0, Math.PI / 2 - 0.5, 0, 0);       // гидродемпфер
    mesh(g, rbox(0.36, 0.3, 0.5, 0.05), M.black, sx * 1.22, 0.85, 2.1);                     // песочница
  }
  for (const sz of [-1.3, 1.3]) {
    const ws = new THREE.Group();
    ws.position.set(0, 0.625, sz);
    g.add(ws);
    mesh(ws, cyl(0.095, 1.86, 12), M.steel, 0, 0, 0, 0, 0, Math.PI / 2);
    for (const sx of [-0.79, 0.79]) {
      const w = mesh(ws, WG, M.wheel, sx, 0, 0);
      w.scale.x = sx < 0 ? -1 : 1;
      mesh(ws, cyl(0.665, 0.03, 32), M.tread, sx * 1.0, 0, 0, 0, 0, Math.PI / 2);
    }
    mesh(g, rbox(1.3, 0.78, 0.92, 0.12), M.dark, 0, 0.74, sz * 0.48);                     // тяговый двигатель
    wheels.push(ws);
  }
  mesh(g, rbox(2.45, 0.28, 0.84, 0.06), M.grey, 0, 1.16, 0);                              // шкворневая балка
  for (const sx of [-1, 1]) mesh(g, cyl(0.12, 0.35, 12), M.dark, sx * 0.8, 1.3, 0);
  g.userData.wheels = wheels;
  return g;
}

// ---------------------------------------------------------------- токоприёмник
function pantograph(M) {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.75, -0.6], [0.75, -0.6], [-0.75, 0.6], [0.75, 0.6]]) {
    for (let k = 0; k < 5; k++) mesh(g, cyl(0.14 - (k % 2) * 0.035, 0.07, 14), M.porcelain, x, 0.06 + k * 0.07, z);
  }
  mesh(g, rbox(1.75, 0.14, 1.55, 0.04), M.red, 0, 0.42, 0);
  mesh(g, rbox(0.5, 0.36, 0.46, 0.06), M.red, 0, 0.62, -0.4);
  const lower = new THREE.Group(), upper = new THREE.Group(), head = new THREE.Group();
  lower.position.set(0, 0.62, -0.4);
  g.add(lower);
  mesh(lower, rbox(0.14, 0.14, 1.9, 0.04), M.red, 0, 0, 0.95);
  mesh(lower, cyl(0.035, 1.8, 8), M.red, 0.2, 0, 0.95, Math.PI / 2);
  upper.position.set(0, 0, 1.9);
  lower.add(upper);
  mesh(upper, cyl(0.045, 1.95, 8), M.red, 0, 0, -0.975, Math.PI / 2);
  mesh(upper, cyl(0.025, 1.9, 6), M.red, 0.12, 0, -0.95, Math.PI / 2);
  head.position.set(0, 0, -1.95);
  upper.add(head);
  for (const dz of [-0.2, 0.2]) mesh(head, rbox(1.95, 0.07, 0.09, 0.02), M.steel, 0, 0.05, dz);
  for (const sx of [-1, 1]) mesh(head, new THREE.TorusGeometry(0.24, 0.025, 6, 14, Math.PI), M.steel, sx * 1.0, 0, 0, 0, sx * Math.PI / 2, 0);
  g.userData.raise = (h) => {
    const a = 1.9, b = 1.95, zh = -0.3, d = Math.min(a + b - 0.05, Math.hypot(zh, h));
    const phi = Math.atan2(h, zh + 0.4), al = Math.acos((a * a + d * d - b * b) / (2 * a * d));
    lower.rotation.x = -(phi - al);
    upper.rotation.x = Math.acos((a * a + b * b - d * d) / (2 * a * b));
    head.rotation.x = -(lower.rotation.x + upper.rotation.x);
  };
  return g;
}

// ---------------------------------------------------------------- секция
export function makeLocoSection() {
  const M = mats();
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const sh = shell();
  mesh(body, sh.body, M.paint);
  mesh(body, sh.front, M.nose);
  mesh(body, sh.back, M.grey);

  // --- лоб: панорамное лобовое стекло в раме, дворники, буферные фонари, номер ---
  {
    const y0 = 2.86, y1 = 3.9, xs = W * 0.86 - 0.18;
    const glassPts = [];
    for (const [x, y] of [[-xs, y0], [xs, y0], [xs * 0.96, y1], [-xs * 0.96, y1]]) glassPts.push(V(x, y, zFront(y) + 0.035));
    const gg = new THREE.BufferGeometry().setFromPoints([glassPts[0], glassPts[1], glassPts[2], glassPts[0], glassPts[2], glassPts[3]]);
    gg.computeVertexNormals();
    mesh(body, gg, M.glass);
    const fr = [...glassPts, glassPts[0]];
    for (let i = 0; i < 4; i++) mesh(body, tube([fr[i], fr[i + 1]], 0.055, 2), M.frame);
    for (const x of [-0.55, 0.45]) mesh(body, tube([V(x, y0 + 0.08, zFront(y0) + 0.08), V(x + 0.18, y0 + 0.8, zFront(y0 + 0.8) + 0.08)], 0.018, 2), M.frame);
    for (const s of [-1, 1]) {
      mesh(body, cyl(0.12, 0.08, 20), M.lampW, s * 0.95, 2.28, HL + 0.03, Math.PI / 2);
      mesh(body, cyl(0.15, 0.06, 20), M.steel, s * 0.95, 2.28, HL + 0.005, Math.PI / 2);
      mesh(body, cyl(0.09, 0.08, 18), M.lampR, s * 1.27, 2.28, HL + 0.03, Math.PI / 2);
    }
    mesh(body, rbox(0.86, 0.2, 0.04, 0.02), M.black, 0, 2.12, HL + 0.02);
    // Прожектор на крыше кабины.
    mesh(body, rbox(0.66, 0.44, 0.62, 0.12), M.grey, 0, YR + 0.05, zFront(YR) - 0.25);
    mesh(body, cyl(0.17, 0.06, 20), M.lampW, 0, YR + 0.05, zFront(YR) + 0.08, Math.PI / 2);
    // Зеркала заднего вида.
    for (const s of [-1, 1]) { mesh(body, rbox(0.06, 0.42, 0.26, 0.03), M.black, s * (W + 0.18), 3.35, 6.3); mesh(body, cyl(0.02, 0.2, 6), M.black, s * (W + 0.08), 3.35, 6.3, 0, 0, Math.PI / 2); }
  }
  // --- буферный брус, автосцепка, путеочиститель, рукава ---
  mesh(body, rbox(2.95, 0.5, 0.42, 0.06), M.orange, 0, 1.46, HL - 0.12);
  {
    const s = new THREE.Shape();
    s.moveTo(-1.45, 0); s.lineTo(1.45, 0); s.lineTo(1.18, -0.82); s.lineTo(-1.18, -0.82); s.closePath();
    const pl = mesh(body, new THREE.ExtrudeGeometry(s, {depth: 0.36, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2}), M.orange, 0, 1.2, HL - 0.5);
    pl.rotation.x = -0.12;
  }
  mesh(body, rbox(0.38, 0.3, 0.75, 0.05), M.dark, 0, 1.05, HL + 0.32);
  mesh(body, rbox(0.5, 0.36, 0.2, 0.05), M.dark, 0, 1.05, HL + 0.72);
  for (const [x, m] of [[-0.62, M.dark], [-0.3, M.red], [0.3, M.yellow], [0.62, M.dark]]) mesh(body, tube([V(x, 1.4, HL + 0.15), V(x, 1.0, HL + 0.35), V(x * 0.7, 0.85, HL + 0.25)], 0.035, 10), m);
  // --- кабина: окна, дверь с окошком, поручни, подножки ---
  for (const sx of [-1, 1]) {
    sideWindow(body, M, sx, 4.75, 5.45, 2.95, 3.78);
    sideWindow(body, M, sx, 3.98, 4.38, 3.2, 3.62);
    // Дверь — контур шва и ручки.
    mesh(body, rbox(0.02, 2.2, 0.03, 0.01), M.black, sx * (W + 0.012), 2.85, 3.86);
    mesh(body, rbox(0.02, 2.2, 0.03, 0.01), M.black, sx * (W + 0.012), 2.85, 4.5);
    mesh(body, rbox(0.02, 0.03, 0.67, 0.01), M.black, sx * (W + 0.012), 3.94, 4.18);
    for (const zz of [3.7, 4.66]) mesh(body, tube([V(sx * W, 1.6, zz), V(sx * (W + 0.1), 1.65, zz), V(sx * (W + 0.1), 3.5, zz), V(sx * W, 3.55, zz)], 0.025, 12), M.steel);
    for (let k = 0; k < 3; k++) mesh(body, rbox(0.38, 0.04, 0.6, 0.01), M.steel, sx * (W - 0.1), 0.65 + k * 0.3, 4.18);
    // Окна машинного отделения.
    for (const z of [-6.6, -3.9, 1.6]) sideWindow(body, M, sx, z, z + 0.62, 3.02, 3.4);
    // Жалюзи вентиляции: рамка + наклонные ламели.
    for (const z0 of [-2.4, -0.4]) {
      mesh(body, rbox(0.04, 0.62, 1.72, 0.02), M.frame, sx * (W + 0.008), 3.72, z0 + 0.86);
      for (let k = 0; k < 9; k++) mesh(body, rbox(0.06, 0.035, 1.64, 0.01), M.lgrey, sx * (W + 0.03), 3.47 + k * 0.064, z0 + 0.86, 0, 0, sx * 0.5);
    }
    // Поручни вдоль борта у торца.
    mesh(body, tube([V(sx * W, 1.6, -7.7), V(sx * (W + 0.09), 1.65, -7.7), V(sx * (W + 0.09), 3.2, -7.7), V(sx * W, 3.25, -7.7)], 0.025, 10), M.steel);
  }
  // --- подкузовное оборудование и рама ---
  mesh(body, rbox(3.02, 0.3, 16.0, 0.05), M.grey, 0, 1.18, 0);
  for (const sx of [-1, 1]) mesh(body, rbox(0.06, 0.3, 15.6, 0.02), M.dark, sx * 1.5, 1.18, 0);
  for (const [z, w] of [[-0.6, 2.6], [1.8, 1.4]]) mesh(body, rbox(2.5, 0.7, w, 0.08), M.grey, 0, 0.92, z);
  for (const sx of [-1, 1]) mesh(body, cyl(0.3, 2.4, 20), M.lgrey, sx * 0.85, 0.85, -2.7, Math.PI / 2);
  // --- крыша: шины, изоляторы, ограждения, вентиляторы, люки ---
  const roof = new THREE.Group();
  body.add(roof);
  for (let z = -7.2; z < 3.4; z += 2.6) for (const sx of [-1, 1]) {
    mesh(roof, rbox(0.07, 0.3, 0.07, 0.015), M.orange, sx * 1.02, YR + 0.15, z);
    mesh(roof, rbox(0.07, 0.3, 0.07, 0.015), M.orange, sx * 1.02, YR + 0.15, z + 1.8);
    mesh(roof, rbox(0.09, 0.07, 1.94, 0.02), M.orange, sx * 1.02, YR + 0.32, z + 0.9);
  }
  for (const z of [-5.6, -1.5]) {
    mesh(roof, cyl(0.62, 0.22, 28), M.grey, 0, YR + 0.1, z);
    mesh(roof, cyl(0.56, 0.04, 28), M.frame, 0, YR + 0.22, z);
  }
  for (const [x, z] of [[-0.55, 1.2], [0.55, 1.2], [-0.55, 5.0], [0.55, 5.0], [0, -3.6]]) {
    for (let k = 0; k < 6; k++) mesh(roof, cyl(0.15 - (k % 2) * 0.04, 0.065, 16), M.porcelain, x, YR + 0.04 + k * 0.065, z);
  }
  mesh(roof, cyl(0.03, 9.0, 8), M.steel, 0.55, YR + 0.42, -0.6, Math.PI / 2);
  mesh(roof, rbox(1.3, 0.05, 0.8, 0.02), M.frame, -0.3, YR + 0.03, -7.0);
  // --- переход между секциями ---
  for (let k = 0; k < 7; k++) mesh(body, rbox(2.0, 2.6, 0.06, 0.03), M.rubber, 0, 2.95, -HL - 0.04 - k * 0.06);
  // --- токоприёмник ---
  const pan = pantograph(M);
  pan.position.set(0, YR, 3.1);
  pan.rotation.y = Math.PI;
  body.add(pan);
  pan.userData.raise(0.3);
  // --- тележки ---
  const bogies = [-4.5, 4.5].map((z) => { const b = bogie(M); b.position.set(0, 0, z); g.add(b); return b; });

  // Сотни деталей → несколько мешей: кузов, тележки, колёсные пары (крутятся), токоприёмник (поднимается).
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
