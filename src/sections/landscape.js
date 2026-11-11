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
  {x: 7700, z: -1500, r: 300, L: 57, e: 1.55, rot: 0.45, s: 1.3, cliffA: 1.95},
  {x: 10150, z: 2150, r: 380, L: 52, e: 1.85, rot: -0.4, s: 4.1, island: [70, -40, 60]},
  {x: 12500, z: -1250, r: 280, L: 45.5, e: 1.35, rot: 1.1, s: 2.2, cliffA: -2.2},
  {x: 16930, z: 1070, r: 190, L: LAKE4_L, e: 1.6, rot: 0.2, s: 5.7, cliffA: 1.3},
];
// Нормированное расстояние до берега озера: 1 — урез воды, меньше — вода.
export function lakeQ(lk, x, z) {
  const dx = x - lk.x, dz = z - lk.z, c = Math.cos(lk.rot), sn = Math.sin(lk.rot);
  const u = dx * c + dz * sn, v = (-dx * sn + dz * c) / lk.e;
  const a = Math.atan2(v, u);
  const wob = 1 + 0.2 * Math.sin(3 * a + lk.s) + 0.12 * Math.sin(5 * a + 2 * lk.s) + 0.06 * Math.sin(9 * a + 3 * lk.s) + 0.18 * (fbm(x / 160 + lk.s, z / 160 - lk.s, 3) - 0.5);
  return Math.hypot(u, v) / (lk.r * wob);
}
const lakeExtent = (lk) => lk.r * lk.e * 1.5 + 60;
export const riverLevel = riverL;
// Терминал приёмки сырья НПЗ — конечная точка железной дороги от нефтебазы.
export const REFINERY = {name: 'НПЗ', x: 17840, z: 340, w: 760, d: 600};
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
    // Утёсы: на отдельных участках (то одном, то другом берегу) берег встаёт скальной стеной до ~34 м.
    const side = z > riverZ(x) ? 1 : -1;
    // (у перехода нефтепровода берега пологие — там медведь у воды и опоры трубы).
    const cf = smooth(0.4, 0.55, fbm(x / 1100 + (side > 0 ? 3.1 : 7.7), 1.3, 3)) * smooth(250, 600, Math.abs(x - 5700));
    const e = dz - w;
    // Терраса над утёсом: берег приподнят, а у воды обрывается скальной стеной.
    h += cf * 30 * (1 - smooth(70, 320, dz)) * (0.85 + 0.3 * fbm(x / 60, z / 60, 2));
    h = Math.min(h, dz < w ? L - 3.2 * (1 - (dz / w) ** 2) : L + 0.4 + e * 0.28 + cf * (Math.min(36, Math.max(0, e - 3) * 3.2) + smooth(3, 12, e) * 7 * (fbm(x / 21, z / 21, 3) - 0.5) + 3 * Math.round(Math.max(0, e - 3) * 0.25) * 0.4));
    for (const lk of LAKES) {
      if (Math.abs(x - lk.x) > lakeExtent(lk) || Math.abs(z - lk.z) > lakeExtent(lk)) continue;
      const q = lakeQ(lk, x, z), out = (q - 1) * lk.r;
      let lh;
      if (q < 1) lh = lk.L - 8 * (1 - q * q);
      else {
        const cl = lk.cliffA === undefined ? 0 : smooth(0.55, 0.85, Math.cos(Math.atan2(z - lk.z, x - lk.x) - lk.cliffA));
        lh = lk.L + 0.4 + out * 0.22 + cl * Math.min(30, Math.max(0, out - 4) * 1.6);
      }
      if (lk.island) {
        const [ix, iz, ir] = lk.island, di = Math.hypot(x - lk.x - ix, z - lk.z - iz);
        if (di < ir) lh = Math.max(lh, lk.L + 9 * (1 - (di / ir) ** 2) - 2 + 4 * fbm(x / 30, z / 30, 2));
      }
      h = Math.min(h, lh);
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
// Мелкая сетка вдоль реки (±150 м по z) и вокруг озёр: общий рельеф под ней опущен.
const RIVER_HALF = 150;
export function waterDip(x, z) {
  let inside = -1;
  if (x > 5650) inside = RIVER_HALF - Math.abs(z - riverZ(x));
  for (const lk of LAKES) {
    const P = lakeExtent(lk);
    inside = Math.max(inside, P - Math.max(Math.abs(x - lk.x), Math.abs(z - lk.z)));
  }
  return inside > 0 ? 30 * smooth(6, 40, inside) : 0;
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
  const sand = new THREE.Color(0xf0dc9c), wet = new THREE.Color(0x9a8e64), meadow = new THREE.Color(0x86c94a),
    taiga = new THREE.Color(0x2f7a3a), rock = new THREE.Color(0x8f8476), snow = new THREE.Color(0xf6f9fc), c = new THREE.Color(),
    autumnO = new THREE.Color(0xd99a2e), autumnR = new THREE.Color(0xc0682a), gold = new THREE.Color(0xe6c84a), gravel = new THREE.Color(0x9c978c),
    lush = new THREE.Color(0x5fb33c), teal = new THREE.Color(0x3f8f5a), rockW = new THREE.Color(0xb39d82);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), slope = 1 - nrm.getY(i), j = hash(x * 0.03, z * 0.03);
    const d = x - coastX(z);
    const nearWater = x > 5500 && (Math.abs(z - riverZ(x)) < 40 || LAKES.some((lk) => Math.abs(x - lk.x) < lakeExtent(lk) && Math.abs(z - lk.z) < lakeExtent(lk) && lakeQ(lk, x, z) < 1.08));
    if (y < 0) c.copy(wet).lerp(sand, Math.max(0, 1 + y / 4));
    else if (nearWater) c.copy(meadow).lerp(wet, 0.25).lerp(sand, 0.18);
    else if (d < 32 && y < 3.5 && !(x >= 1700 && Math.abs(z) < PAD.z)) c.copy(sand);
    else if (y < 40) c.copy(meadow).lerp(taiga, smooth(8, 40, y) * 0.7);
    else c.copy(taiga).lerp(rock, smooth(0.35, 0.75, slope + j * 0.1));
    // Живописные «мазки»: крупные пятна разных зелёных, золотые поляны и редкие рыжие куртины.
    if (y > 3 && slope < 0.4) {
      const a = fbm(x / 210 + 7, z / 210 - 2, 3), b = fbm(x / 95, z / 95 + 5, 2);
      c.lerp(a > 0.5 ? lush : teal, Math.abs(a - 0.5) * 1.2);
      c.lerp(gold, smooth(0.62, 0.76, b) * 0.45);
      if (x > 2300) c.lerp(b > 0.5 ? autumnO : autumnR, smooth(0.66, 0.78, fbm(x / 140 + 3, z / 140, 3)) * 0.4);
    }
    // Земляное полотно и откосы — щебень и суглинок.
    if (rail) { const rn = railNear(x, z, 30); if (rn && !rn.bridge) c.lerp(gravel, (1 - smooth(9, 22, Math.abs(rn.d))) * 0.8); }
    // Скальные обнажения на крутизне.
    // Скалы: камень на крутизне, на стенах — слоистые тёплые полосы песчаника.
    c.lerp(rock, smooth(0.36, 0.62, slope) * 0.92).lerp(rockW, smooth(0.5, 0.8, slope) * (0.35 + 0.5 * (0.5 + 0.5 * Math.sin(y * 0.55 + fbm(x / 50, z / 50, 2) * 4))));
    // Площадки станций и нефтебазы — отсыпка гравием.
    if (x > 6000 && [...STATIONS, DEPOT, REFINERY].some((s) => Math.abs(x - s.x) < (s.w || 200) / 2 && Math.abs(z - s.z) < (s.d || 150) / 2)) c.copy(gravel).offsetHSL(0, 0, j * 0.04);
    const snowLine = 270 + j * 60;
    if (y > snowLine) c.lerp(snow, smooth(snowLine, snowLine + 70, y) * (1 - smooth(0.55, 0.85, slope)));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

export const RIVER_TIME = {value: 0};
// Мелкая сетка рельефа у воды (шаг 7–8 м): чёткие утёсы, изрезанные берега, острова.
// Кусками по ~1 км — далёкие не рисуются.
function waterDetail(x0, x1, z0, z1) {
  const group = new THREE.Group(), parts = [];
  const mat = new THREE.MeshLambertMaterial({vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2});
  const grid = (cols, rows, at) => {
    const P = [], I = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const [x, z] = at(i, j);
      P.push(x, heightAt(x, z), z);
      if (i && j) { const a = (i - 1) * cols + j - 1, b = a + 1, c = a + cols, d = c + 1; I.push(a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(I);
    g.computeVertexNormals();
    paintTerrain(g);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.userData.noCast = true;
    g.computeBoundingSphere();
    group.add(m);
    parts.push({m, c: g.boundingSphere.center, r: g.boundingSphere.radius});
  };
  // Река: полоса ±150 м по z вдоль русла.
  const xa = Math.max(x0, 5650), STEP = 7, rows = Math.round((2 * RIVER_HALF) / STEP) + 1;
  for (let cx = xa; cx < x1; cx += 1050) {
    const cx1 = Math.min(x1, cx + 1050), cols = Math.round((cx1 - cx) / STEP) + 1;
    grid(cols, rows, (i, j) => { const x = cx + j * STEP; return [x, riverZ(x) - RIVER_HALF + i * STEP]; });
  }
  // Озёра: квадрат вокруг каждого.
  for (const lk of LAKES) {
    if (lk.x < x0 || lk.x >= x1) continue;
    const P = lakeExtent(lk), n = Math.round((2 * P) / 8) + 1;
    grid(n, n, (i, j) => [lk.x - P + j * 8, lk.z - P + i * 8]);
  }
  return {group, update(cam) { for (const p of parts) p.m.visible = Math.hypot(p.c.x - cam.x, p.c.z - cam.z) < 6000 + p.r; }};
}

// Дальний план вокруг всей карты: тот же рельеф, а за краем — горные хребты до горизонта.
// Внутри подробной карты сетка утоплена (её закрывает подробный рельеф), у края совпадает с ним.
export const CORE = {x0: 1420, x1: 18900, z0: -3400, z1: 3800};
export function makeFarLand() {
  const X0 = -3000, X1 = 27000, Z0 = -13000, Z1 = 13000, STEP = 200;
  const cols = Math.round((X1 - X0) / STEP) + 1, rows = Math.round((Z1 - Z0) / STEP) + 1;
  const P = [], I = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const x = X0 + j * STEP, z = Z0 + i * STEP;
    const out = Math.max(CORE.x0 - x, x - CORE.x1, CORE.z0 - z, z - CORE.z1);
    let y = natural(x, z);
    if (y < 0) y = -60;                       // море: дно глубоко (не мешает подводным сценам у платформы)
    else if (out < -20) y -= 40;
    else {
      const k = smooth(0, 3500, out);
      y += k * 230 * Math.pow(ridged(x / 2200 + 1.3, z / 2200 - 4.1), 1.6) * (y > 0 ? 1 : 0) - 1.5;
    }
    P.push(x, y, z);
    if (i && j) { const a = (i - 1) * cols + j - 1, b = a + 1, c = a + cols, d = c + 1; I.push(a, c, b, b, c, d); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  paintTerrain(g);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true}));
  m.userData.noCast = true;
  m.frustumCulled = false;
  return m;
}

export function makeCoast({x0 = 1420, x1 = 6200, z0 = -3400, z1 = 3800, seg = 300, density = {conifers: 11000, broadleaf: 5000, shrubs: 4000, rocks: 2000}} = {}) {
  const W = x1 - x0, D = z1 - z0;
  const geo = new THREE.PlaneGeometry(W, D, seg, Math.round((seg * D) / W)).rotateX(-Math.PI / 2);
  geo.translate(x0 + W / 2, 0, z0 + D / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const X = pos.getX(i), Z = pos.getZ(i); pos.setY(i, heightAt(X, Z) - Math.max(railDip(X, Z), waterDip(X, Z))); }
  geo.computeVertexNormals();
  paintTerrain(geo);

  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
  terrain.receiveShadow = true;
  terrain.userData.noCast = true;

  // Смешанный лес, кустарник и скалы (квадратами, дальние не рисуются).
  const accept = (x, z, y) => {
    if (x < PAD.x1 + 25 && Math.abs(z) < PAD.z + 25) return false;
    if (x > 2300 && Math.abs(z - pipeZ(x)) < 45) return false;
    if (x > 5500 && Math.abs(z - riverZ(x)) < 46) return false;
    if ([...STATIONS, DEPOT, REFINERY].some((s) => Math.abs(x - s.x) < (s.w || 200) / 2 + 40 && Math.abs(z - s.z) < (s.d || 150) / 2 + 40)) return false;
    if (x > 5500 && LAKES.some((lk) => Math.abs(x - lk.x) < lakeExtent(lk) && Math.abs(z - lk.z) < lakeExtent(lk) && lakeQ(lk, x, z) < 1.12)) return false;
    const rn = railNear(x, z, 40);
    if (rn && Math.abs(rn.d) < 32) return false;
    if (x > 15500 && x < 16600 && Math.abs(x - canyonX(z)) < 30) return false;
    return x - coastX(z) > 45 && y > 3;
  };
  const veg = makeVegetation({x0: Math.max(x0, 1720), x1: x1 - 40, z0: z0 + 250, z1: z1 - 250, heightAt, accept, ...density});
  const group = new THREE.Group();
  group.add(terrain, veg.group);
  const detail = waterDetail(x0, x1, z0, z1);
  group.add(detail.group);
  group.userData.update = (cam) => { veg.update(cam); detail.update(cam); RIVER_TIME.value = performance.now() / 1000; };
  // Вода реки и озёр в долине.
  if (x1 > 5600) {
    const waterMat = new THREE.MeshStandardMaterial({color: 0x23a3b8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.86});
    // Бурная река: пена бежит по течению полосами, на перекатах — белая вода, лёгкая рябь поверхности.
    const riverMat = new THREE.MeshStandardMaterial({color: 0x2bb3c4, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9});
    riverMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = RIVER_TIME;
      sh.vertexShader = 'attribute vec2 aFlow;' + String.fromCharCode(10) + 'varying vec2 vFlow;' + String.fromCharCode(10) + 'uniform float uTime;' + String.fromCharCode(10) + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vFlow = aFlow;
        float rap = smoothstep(0.45, 0.75, sin(aFlow.x * 0.012) * 0.5 + 0.5);
        transformed.y += (sin(aFlow.x * 0.9 - uTime * 6.0) * 0.12 + sin(aFlow.x * 0.37 + aFlow.y * 9.0 - uTime * 4.0) * 0.1) * (0.4 + rap);`);
      sh.fragmentShader = 'varying vec2 vFlow;' + String.fromCharCode(10) + 'uniform float uTime;' + String.fromCharCode(10) + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = vFlow.x, v = vFlow.y;
          float rap = smoothstep(0.45, 0.75, sin(u * 0.012) * 0.5 + 0.5);
          float st = sin(u * 0.22 - uTime * 7.0 + sin(v * 23.0) * 2.0) * sin(v * 41.0 + sin(u * 0.05) * 3.0);
          float st2 = sin(u * 0.61 - uTime * 11.0 + v * 17.0) * sin(v * 67.0 - u * 0.03);
          float edge = smoothstep(0.32, 0.5, abs(v - 0.5));
          float foam = smoothstep(0.55, 0.95, st * 0.6 + st2 * 0.5 + rap * 0.7 + edge * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb * mix(0.75, 1.15, abs(v - 0.5) * 2.0), vec3(0.96, 0.99, 1.0), foam * 0.85);
          diffuseColor.a = mix(diffuseColor.a, 1.0, foam);
          // На перекате (фотоскан ручья) вода прозрачная — видно каменистое дно.
          diffuseColor.a *= mix(1.0, 0.42, 1.0 - smoothstep(55.0, 75.0, abs(u - 9180.0)));
        }`);
    };
    const pts = [], idx = [], flow = [];
    const xa = Math.max(x0, 5600), xb = x1;
    for (let x = xa, i = 0; x <= xb; x += 6, i++) {
      const zc = riverZ(x), y = riverLevel(x) - 0.7;
      for (let j = 0; j <= 6; j++) { pts.push(x, y, zc - 40 + j * (80 / 6)); flow.push(x, j / 6); }
      if (i) for (let j = 0; j < 6; j++) { const a = (i - 1) * 7 + j, c = a + 7; idx.push(a, a + 1, c, c, a + 1, c + 1); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    rg.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const river = new THREE.Mesh(rg, riverMat);
    river.userData.noCast = true;
    group.add(river);
    // Камни в русле: валуны торчат из воды, вокруг — пенные буруны.
    {
      const rocks = [], foams = [];
      let sd = Math.floor(xa) + 17;
      const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let x = xa + 5; x < xb; x += 7) {
        if (rr() > 0.62) continue;
        const z = riverZ(x) + (rr() - 0.5) * 46, s = 1.2 + rr() * 3.4, L = riverLevel(x) - 0.7;
        rocks.push([x, L - s * 0.35, z, s, rr() * 6.28]);
        foams.push([x, L + 0.08, z, s * 1.7]);
      }
      const rockM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 1), new THREE.MeshStandardMaterial({color: 0x8b8378, roughness: 0.9, flatShading: true}), rocks.length);
      const foamM = new THREE.InstancedMesh(new THREE.RingGeometry(0.55, 1.15, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xf4fbff, transparent: true, opacity: 0.5, depthWrite: false}), foams.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), v = new THREE.Vector3();
      rocks.forEach(([x, y, z, sz, r], i) => rockM.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromEuler(e.set(r, r * 2, r * 0.5)), sc.set(sz * 1.3, sz * 0.8, sz))));
      foams.forEach(([x, y, z, sz], i) => foamM.setMatrixAt(i, m4.compose(v.set(x, y, z), q.identity(), sc.set(sz * 1.05, 1, sz * 0.75))));
      rockM.userData.noCast = foamM.userData.noCast = true;
      group.add(rockM, foamM);
    }
    for (const lk of LAKES) {
      if (lk.x < x0 || lk.x > x1) continue;
      // Зеркало по форме берега (чуть шире уреза — край прячется под берегом).
      const shape = new THREE.Shape();
      for (let k = 0; k < 160; k++) {
        const a = (k / 160) * Math.PI * 2;
        let t = lk.r * 0.3;
        while (t < lk.r * lk.e * 1.6 && lakeQ(lk, lk.x + Math.cos(a) * t, lk.z + Math.sin(a) * t) < 1.07) t += 3;
        const px = Math.cos(a) * t, pz = Math.sin(a) * t;
        if (k) shape.lineTo(px, -pz); else shape.moveTo(px, -pz);
      }
      const lake = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2), waterMat);
      lake.position.set(lk.x, lk.L - 0.7, lk.z);
      lake.userData.noCast = true;
      group.add(lake);
    }
  }
  return group;
}
