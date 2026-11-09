// Береговой ландшафт: живая береговая линия с бухтами, мысами и пляжами; ровная площадка терминала
// с прямой набережной; за ней холмы и невысокие горы, покрытые тайгой, со снегом на вершинах.
// Высота задаётся функцией heightAt(x, z), по ней же расставляется лес.
import * as THREE from 'three';
import {makeVegetation} from './vegetation.js';

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += noise(x * f, y * f) * a; f *= 2.03; a *= 0.5; }
  return s;
}
function ridged(x, y) {
  let sum = 0, amp = 0.55, f = 1, w = 1;
  for (let o = 0; o < 5; o++) {
    let n = 1 - Math.abs(noise(x * f, y * f) * 2 - 1);
    n = n * n * w;
    w = Math.min(1, n * 1.6);
    sum += n * amp;
    f *= 2.05;
    amp *= 0.5;
  }
  return sum;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Площадка терминала: ровно y = 3, прямая набережная x = 1700.
const PAD = {x1: 2470, z: 640}, LAND = 3;
export function coastX(z) {
  const wild = 1720 + 150 * Math.sin(z / 430 + 0.6) + 110 * (fbm(z / 260, 4.2, 3) - 0.5) * 2 + 60 * Math.sin(z / 150);
  return 1700 + (wild - 1700) * smooth(PAD.z, PAD.z + 260, Math.abs(z));
}
// ---------- Магистраль, станции, долина за горами ----------
// Трасса магистрального нефтепровода (z как функция x) от насосной станции терминала до нефтебазы.
export const MAIN = {x0: 2334, x1: 13460};
export const pipeZ = (x) => 468 + 170 * Math.sin((x - 2334) / 1500) * smooth(2334, 3400, x);
// Промежуточные насосные станции: в реальности 100–200 км друг от друга, здесь расстояния сжаты.
export const STATIONS = [
  {name: 'НПС-1', x: 6620, km: 150},
  {name: 'НПС-2', x: 8920, km: 305},
  {name: 'НПС-3', x: 11200, km: 455},
].map((s) => ({...s, z: pipeZ(s.x) + 58, w: 300, d: 200}));
export const DEPOT = {name: 'Нефтебаза', x: 13820, z: pipeZ(13460) - 40, w: 820, d: 640, km: 600};
// Река и озёра долины.
export const riverZ = (x) => 260 + 1250 * Math.sin((x - 5900) / 1450 + 0.4);
const riverL = (x) => 60 - (x - 5600) * 0.0014;
const LAKE4_L = 66;
export const LAKES = [
  {x: 7700, z: -1500, r: 330, L: 57},
  {x: 10150, z: 2150, r: 420, L: 52},
  {x: 12500, z: -1250, r: 300, L: 48},
  {x: 16930, z: 1070, r: 200, L: LAKE4_L},
];
export const riverLevel = riverL;
// Терминал приёмки сырья НПЗ — конечная точка железной дороги от нефтебазы.
export const REFINERY = {name: 'НПЗ', x: 17760, z: 200, w: 1120, d: 860};
// Ось железной дороги (план): от эстакады налива нефтебазы через реку, каньон и вдоль озера к НПЗ.
const TZ0 = DEPOT.z + 170;   // путь налива нефтебазы
export const RAIL_PTS = [[13300, TZ0], [14000, TZ0], [14600, TZ0], [15000, 758], [15500, 725], [16050, 705], [16550, 750], [16950, 800], [17250, 690], [17550, 610], [17900, 600], [18300, 600]];
// Каньон ручья поперёк долины — через него идёт арочный виадук.
export const canyonX = (z) => 16050 + 90 * Math.sin(z / 520);

function natural(x, z) {
  const d = x - coastX(z);
  if (d < 0) return Math.max(-17, d * 0.22);                                   // подводный склон
  // Естественная суша: пляж → луга и холмы → предгорья → горы (до ~420 м) → долина за хребтом.
  const beach = 1.6 * smooth(0, 30, d);
  const hills = 26 * fbm(x / 380, z / 380) * smooth(20, 260, d);
  const range = 1 - smooth(5100, 6700, x);
  // Коридор магистрали: через хребет — широкая седловина с пологим рельефом.
  const cor = x > 2250 && x < 14000 ? 1 - smooth(160, 700, Math.abs(z - pipeZ(x))) : 0;
  const mount = 430 * Math.pow(ridged(x / 1300 + 2.1, z / 1300 - 0.7), 1.25) * smooth(500, 2300, d) * range * (1 - 0.9 * cor);
  const v = smooth(4900, 6500, x);
  const valley = v * (70 + 34 * fbm(x / 650 + 9, z / 650 - 3) * (1 - 0.6 * cor));
  const rim = v * 420 * Math.pow(ridged(x / 1500 - 4.3, z / 1500 + 2.2), 1.3) * smooth(1900, 3300, Math.abs(z - 300)) * (1 - cor);
  // Восточный хребет: скалистые вершины по обе стороны железной дороги.
  const east = smooth(14400, 15400, x) * 380 * Math.pow(ridged(x / 1000 + 3.3, z / 1000 - 1.1), 1.35) * smooth(620, 1500, Math.abs(z - 760));
  let h = 1.2 + beach + hills * (1 - 0.5 * cor) + mount + valley + rim + east;
  // Каньон: отвесные скальные стены, узкое дно.
  if (x > 15500 && x < 16600) h -= 82 * (1 - smooth(26, 175, Math.abs(x - canyonX(z)))) * smooth(-2600, -1800, z);
  if (x > 5500) {
    // Русло реки: дно ниже уровня воды, пологие берега.
    const dzdx = 1250 / 1450 * Math.cos((x - 5900) / 1450 + 0.4);
    const dz = Math.abs(z - riverZ(x)) / Math.sqrt(1 + dzdx * dzdx), L = riverL(x), w = 28;
    h = Math.min(h, dz < w ? L - 3.2 * (1 - (dz / w) ** 2) : L + 0.4 + (dz - w) * 0.28);
    for (const lk of LAKES) {
      const dl = Math.hypot(x - lk.x, (z - lk.z) * 1.25);
      h = Math.min(h, dl < lk.r ? lk.L - 7 * (1 - (dl / lk.r) ** 2) : lk.L + 0.4 + (dl - lk.r) * 0.22);
    }
  }
  return h;
}
const padLevel = (s) => natural(s.x, s.z);
export function heightAt(x, z) {
  const n = natural(x, z);
  // Площадка терминала плавно переходит в естественный рельеф.
  const dd = Math.max(x - PAD.x1, Math.abs(z) - PAD.z, 0);
  const inPad = x >= 1700 && Math.abs(z) <= PAD.z + 260 && x < 3000;
  let h = inPad ? LAND + (n - LAND) * smooth(0, 260, dd) : n;
  // Площадки станций и нефтебазы — ровные.
  if (x > 5800) {
    for (const s of [...STATIONS, DEPOT, REFINERY]) {
      const hw = (s.w || 200) / 2, hd = (s.d || 150) / 2;
      const db = Math.max(Math.abs(x - s.x) - hw, Math.abs(z - s.z) - hd, 0);
      if (db < 200) h = h + ((s.level ??= padLevel(s)) - h) * (1 - smooth(0, 200, db));
    }
  }
  // Земляное полотно: ровная основная площадка, выемки с откосами 1:1, насыпи 1:1,5. На мостах — природный рельеф.
  const r = railNear(x, z);
  if (r && !r.bridge) {
    const a = Math.abs(r.d), t = r.y, core = 7;
    if (a < core) h = t;
    else if (h > t) h = Math.min(h, t + (a - core) * 0.95);
    else h = Math.max(h, t - (a - core) * 0.62);
  }
  return h;
}

// ---------- Железная дорога ----------
// Ось: точки через каждые 4 м с пройденным путём s, касательной и проектной отметкой полотна y.
// Профиль сглажен (уклоны как у магистральной дороги), у нефтебазы и НПЗ — отметки площадок.
// Там, где земля ниже полотна больше чем на 6 м, — мосты.
let RAIL = null;
const RCELL = 64;
export function getRail() {
  if (RAIL) return RAIL;
  const curve = new THREE.CatmullRomCurve3(RAIL_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const len = curve.getLength(), n = Math.ceil(len / 4);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u);
    pts.push({x: p.x, z: p.z, s: u * len, tx: t.x, tz: t.z, g: natural(p.x, p.z), y: 0, bridge: false});
  }
  const depY = padLevel(DEPOT), refY = padLevel(REFINERY);
  // Сглаживание: окно ±320 м, провалы (реки, каньон) не тянут полотно вниз.
  const avg = (src, W) => src.map((_, i) => {
    let a = 0, c = 0;
    for (let k = Math.max(0, i - W); k <= Math.min(src.length - 1, i + W); k++) { a += src[k]; c++; }
    return a / c;
  });
  let y = avg(pts.map((p) => p.g), 80);
  y = avg(pts.map((p, i) => Math.max(p.g, y[i] - 6)), 80);
  const depEnd = DEPOT.x + DEPOT.w / 2, refStart = REFINERY.x - REFINERY.w / 2;
  pts.forEach((p, i) => {
    let v = y[i];
    v = depY + (v - depY) * smooth(depEnd - 150, depEnd + 450, p.x);
    v = refY + (v - refY) * (1 - smooth(refStart - 550, refStart + 20, p.x));
    p.y = v;
  });
  // Мосты.
  pts.forEach((p) => { p.bridge = p.g < p.y - 6; });
  const bridges = [];
  for (let i = 0; i < pts.length; i++) {
    if (!pts[i].bridge) continue;
    let j = i;
    while (j + 1 < pts.length && pts[j + 1].bridge) j++;
    const a = Math.max(0, i - 4), b = Math.min(pts.length - 1, j + 4);
    let deep = 0;
    for (let k = a; k <= b; k++) deep = Math.max(deep, pts[k].y - pts[k].g);
    // Неглубокие лога — просто насыпь.
    for (let k = a; k <= b; k++) pts[k].bridge = deep >= 12;
    if (deep >= 12) bridges.push({i0: a, i1: b, s0: pts[a].s, s1: pts[b].s, deep});
    i = b;
  }
  const grid = new Map();
  pts.forEach((p, i) => {
    const key = Math.floor(p.x / RCELL) + ',' + Math.floor(p.z / RCELL);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  RAIL = {pts, len, bridges, grid, box: [x0 - 130, x1 + 130, z0 - 130, z1 + 130]};
  return RAIL;
}
// Точка пути на расстоянии s: положение оси на отметке полотна и направление.
export function railAt(s, out = {}) {
  const R = getRail(), f = Math.min(R.pts.length - 1.001, Math.max(0, s / (R.len / (R.pts.length - 1)))), i = Math.floor(f), k = f - i;
  const a = R.pts[i], b = R.pts[i + 1];
  out.x = a.x + (b.x - a.x) * k; out.z = a.z + (b.z - a.z) * k; out.y = a.y + (b.y - a.y) * k;
  out.tx = a.tx + (b.tx - a.tx) * k; out.tz = a.tz + (b.tz - a.tz) * k;
  return out;
}
// Ближайшая точка оси: боковое смещение d, отметка полотна y, на мосту ли.
export function railNear(x, z, maxD = 110) {
  const R = getRail(), [bx0, bx1, bz0, bz1] = R.box;
  if (x < bx0 || x > bx1 || z < bz0 || z > bz1) return null;
  const cx = Math.floor(x / RCELL), cz = Math.floor(z / RCELL);
  let best = -1, bd = maxD * maxD;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const list = R.grid.get((cx + a) + ',' + (cz + b));
    if (!list) continue;
    for (const i of list) { const p = R.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } }
  }
  if (best < 0) return null;
  const p = R.pts[best];
  return {d: (x - p.x) * p.tz - (z - p.z) * p.tx, y: p.y, s: p.s, bridge: p.bridge, i: best};
}
// Под полосой рельефа железной дороги (она строится отдельно, мельче) общий рельеф чуть опущен.
export function railDip(x, z) {
  if (x < DEPOT.x + DEPOT.w / 2 - 20) return 0;
  const r = railNear(x, z, 80);
  return r ? 3.5 * (1 - smooth(44, 60, Math.abs(r.d))) : 0;
}

// Раскраска рельефа по высоте, крутизне и месту.
export function paintTerrain(geo, rail = false) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal, cols = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xe0cc98), wet = new THREE.Color(0x8f8566), meadow = new THREE.Color(0x7fb04a),
    taiga = new THREE.Color(0x2c5530), rock = new THREE.Color(0x8a8379), snow = new THREE.Color(0xf6f9fc), c = new THREE.Color(),
    autumnO = new THREE.Color(0xc8742c), autumnR = new THREE.Color(0x9e3b24), gold = new THREE.Color(0xd6aa3a), gravel = new THREE.Color(0x9c978c);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), slope = 1 - nrm.getY(i), j = hash(x * 0.03, z * 0.03);
    const d = x - coastX(z);
    const nearWater = x > 5500 && (Math.abs(z - riverZ(x)) < 44 || LAKES.some((lk) => Math.hypot(x - lk.x, (z - lk.z) * 1.25) < lk.r + 22));
    if (y < 0) c.copy(wet).lerp(sand, Math.max(0, 1 + y / 4));
    else if (nearWater) c.copy(sand).lerp(meadow, 0.35);
    else if (d < 32 && y < 3.5 && !(x >= 1700 && Math.abs(z) < PAD.z)) c.copy(sand);
    else if (y < 40) c.copy(meadow).lerp(taiga, smooth(8, 40, y) * 0.7);
    else c.copy(taiga).lerp(rock, smooth(0.35, 0.75, slope + j * 0.1));
    // Осенняя тундра и луга: рыжие, золотые и бордовые пятна на открытых местах.
    if (y > 3 && slope < 0.35 && x > 2300) {
      const a = fbm(x / 140 + 7, z / 140 - 2, 3);
      c.lerp(a > 0.55 ? autumnR : autumnO, smooth(0.42, 0.62, a) * 0.55);
      c.lerp(gold, smooth(0.6, 0.75, fbm(x / 90, z / 90 + 5, 2)) * 0.35);
    }
    // Земляное полотно и откосы — щебень и суглинок.
    if (rail) { const rn = railNear(x, z, 30); if (rn && !rn.bridge) c.lerp(gravel, (1 - smooth(9, 22, Math.abs(rn.d))) * 0.8); }
    // Скальные обнажения на крутизне.
    c.lerp(rock, smooth(0.5, 0.8, slope) * 0.85);
    // Площадки станций и нефтебазы — отсыпка гравием.
    if (x > 6000 && [...STATIONS, DEPOT, REFINERY].some((s) => Math.abs(x - s.x) < (s.w || 200) / 2 && Math.abs(z - s.z) < (s.d || 150) / 2)) c.copy(gravel).offsetHSL(0, 0, j * 0.04);
    const snowLine = 270 + j * 60;
    if (y > snowLine) c.lerp(snow, smooth(snowLine, snowLine + 70, y) * (1 - smooth(0.55, 0.85, slope)));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

export function makeCoast({x0 = 1420, x1 = 6200, z0 = -3400, z1 = 3800, seg = 300, density = {conifers: 11000, broadleaf: 5000, shrubs: 4000, rocks: 2000}} = {}) {
  const W = x1 - x0, D = z1 - z0;
  const geo = new THREE.PlaneGeometry(W, D, seg, Math.round((seg * D) / W)).rotateX(-Math.PI / 2);
  geo.translate(x0 + W / 2, 0, z0 + D / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) - railDip(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  paintTerrain(geo);

  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
  terrain.receiveShadow = true;
  terrain.userData.noCast = true;

  // Смешанный лес, кустарник и скалы (квадратами, дальние не рисуются).
  const accept = (x, z, y) => {
    if (x < PAD.x1 + 25 && Math.abs(z) < PAD.z + 25) return false;
    if (x > 2300 && Math.abs(z - pipeZ(x)) < 45) return false;
    if (x > 5500 && (Math.abs(z - riverZ(x)) < 52 || LAKES.some((lk) => Math.hypot(x - lk.x, (z - lk.z) * 1.25) < lk.r + 28))) return false;
    if ([...STATIONS, DEPOT, REFINERY].some((s) => Math.abs(x - s.x) < (s.w || 200) / 2 + 40 && Math.abs(z - s.z) < (s.d || 150) / 2 + 40)) return false;
    const rn = railNear(x, z, 40);
    if (rn && Math.abs(rn.d) < 32) return false;
    if (x > 15500 && x < 16600 && Math.abs(x - canyonX(z)) < 30) return false;
    return x - coastX(z) > 45 && y > 3;
  };
  const veg = makeVegetation({x0: Math.max(x0, 1720), x1: x1 - 40, z0: z0 + 250, z1: z1 - 250, heightAt, accept, ...density});
  const group = new THREE.Group();
  group.add(terrain, veg.group);
  group.userData.update = veg.update;
  // Вода реки и озёр в долине.
  if (x1 > 5600) {
    const waterMat = new THREE.MeshStandardMaterial({color: 0x2c6f93, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.9});
    const pts = [], idx = [];
    const xa = Math.max(x0, 5600), xb = x1;
    for (let x = xa, i = 0; x <= xb; x += 15, i++) {
      const zc = riverZ(x), y = riverLevel(x) - 0.7;
      pts.push(x, y, zc - 40, x, y, zc + 40);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const river = new THREE.Mesh(rg, waterMat);
    river.userData.noCast = true;
    group.add(river);
    for (const lk of LAKES) {
      if (lk.x < x0 || lk.x > x1) continue;
      const lake = new THREE.Mesh(new THREE.CircleGeometry(lk.r + 60, 64).rotateX(-Math.PI / 2), waterMat);
      lake.scale.z = 1 / 1.25;
      lake.position.set(lk.x, lk.L - 0.7, lk.z);
      lake.userData.noCast = true;
      group.add(lake);
    }
  }
  return group;
}
