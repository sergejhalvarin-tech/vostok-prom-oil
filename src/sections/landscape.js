// Береговой ландшафт: живая береговая линия с бухтами, мысами и пляжами; ровная площадка терминала
// с прямой набережной; за ней холмы и невысокие горы, покрытые тайгой, со снегом на вершинах.
// Высота задаётся функцией heightAt(x, z), по ней же расставляется лес.
import * as THREE from 'three';

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
].map((s) => ({...s, z: pipeZ(s.x) + 58}));
export const DEPOT = {name: 'Нефтебаза', x: 13820, z: pipeZ(13460) - 40, w: 820, d: 640, km: 600};
// Река и озёра долины.
export const riverZ = (x) => 260 + 1250 * Math.sin((x - 5900) / 1450 + 0.4);
const riverL = (x) => 60 - (x - 5600) * 0.0014;
export const LAKES = [
  {x: 7700, z: -1500, r: 330, L: 57},
  {x: 10150, z: 2150, r: 420, L: 52},
  {x: 12500, z: -1250, r: 300, L: 48},
];
export const riverLevel = riverL;

function natural(x, z) {
  const d = x - coastX(z);
  if (d < 0) return Math.max(-17, d * 0.22);                                   // подводный склон
  // Естественная суша: пляж → луга и холмы → предгорья → горы (до ~420 м) → долина за хребтом.
  const beach = 1.6 * smooth(0, 30, d);
  const hills = 26 * fbm(x / 380, z / 380) * smooth(20, 260, d);
  const range = 1 - smooth(5100, 6700, x);
  const mount = 430 * Math.pow(ridged(x / 1300 + 2.1, z / 1300 - 0.7), 1.25) * smooth(500, 2300, d) * range;
  const v = smooth(4900, 6500, x);
  const valley = v * (70 + 34 * fbm(x / 650 + 9, z / 650 - 3));
  const rim = v * 420 * Math.pow(ridged(x / 1500 - 4.3, z / 1500 + 2.2), 1.3) * smooth(1900, 3300, Math.abs(z - 300));
  let h = 1.2 + beach + hills + mount + valley + rim;
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
    for (const s of [...STATIONS, DEPOT]) {
      const hw = (s.w || 200) / 2, hd = (s.d || 150) / 2;
      const db = Math.max(Math.abs(x - s.x) - hw, Math.abs(z - s.z) - hd, 0);
      if (db < 200) h = h + ((s.level ??= padLevel(s)) - h) * (1 - smooth(0, 200, db));
    }
  }
  return h;
}

export function makeCoast({x0 = 1420, x1 = 6200, z0 = -3400, z1 = 3800, seg = 300, trees = 9000} = {}) {
  const W = x1 - x0, D = z1 - z0;
  const geo = new THREE.PlaneGeometry(W, D, seg, Math.round((seg * D) / W)).rotateX(-Math.PI / 2);
  geo.translate(x0 + W / 2, 0, z0 + D / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const nrm = geo.attributes.normal, cols = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xe0cc98), wet = new THREE.Color(0x8f8566), meadow = new THREE.Color(0x86ad55),
    taiga = new THREE.Color(0x2c5530), rock = new THREE.Color(0x8a8379), snow = new THREE.Color(0xf6f9fc), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), slope = 1 - nrm.getY(i), j = hash(x * 0.03, z * 0.03);
    const d = x - coastX(z);
    const nearWater = x > 5500 && (Math.abs(z - riverZ(x)) < 44 || LAKES.some((lk) => Math.hypot(x - lk.x, (z - lk.z) * 1.25) < lk.r + 22));
    if (y < 0) c.copy(wet).lerp(sand, Math.max(0, 1 + y / 4));
    else if (nearWater) c.copy(sand).lerp(meadow, 0.35);
    else if (d < 32 && y < 3.5 && !(x >= 1700 && Math.abs(z) < PAD.z)) c.copy(sand);
    else if (y < 40) c.copy(meadow).lerp(taiga, smooth(8, 40, y) * 0.7);
    else c.copy(taiga).lerp(rock, smooth(0.35, 0.75, slope + j * 0.1));
    const snowLine = 270 + j * 60;
    if (y > snowLine) c.lerp(snow, smooth(snowLine, snowLine + 70, y) * (1 - smooth(0.55, 0.85, slope)));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
  terrain.receiveShadow = true;
  terrain.userData.noCast = true;

  // Тайга: ели на склонах ниже снеговой линии, не на пляже и не на площадке терминала.
  const tree = (() => {
    const parts = [
      new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5).translate(0, 1.1, 0),
      new THREE.ConeGeometry(2.4, 5.2, 7).translate(0, 4.2, 0),
      new THREE.ConeGeometry(1.8, 4.2, 7).translate(0, 6.6, 0),
      new THREE.ConeGeometry(1.1, 3.2, 7).translate(0, 8.8, 0),
    ];
    const g = new THREE.BufferGeometry();
    const merged = parts.map((p) => p.toNonIndexed());
    const n = merged.reduce((a, p) => a + p.attributes.position.count, 0);
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3);
    let o = 0;
    merged.forEach((p, k) => {
      const col = k === 0 ? new THREE.Color(0x5a3b22) : new THREE.Color(0xffffff);
      P.set(p.attributes.position.array, o * 3);
      N.set(p.attributes.normal.array, o * 3);
      for (let i = 0; i < p.attributes.position.count; i++) col.toArray(Cc, (o + i) * 3);
      o += p.attributes.position.count;
    });
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    return g;
  })();
  const N = trees;
  const forest = new THREE.InstancedMesh(tree, new THREE.MeshLambertMaterial({vertexColors: true}), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color();
  let k = 0, tries = 0;
  while (k < N && tries < N * 12) {
    tries++;
    const x = Math.max(x0, 1720) + Math.random() * (Math.min(x1, x0 + 9000) - Math.max(x0, 1720) - 60), z = z0 + 300 + Math.random() * (z1 - z0 - 600);
    if (x < PAD.x1 + 25 && Math.abs(z) < PAD.z + 25) continue;
    if (x > 2300 && Math.abs(z - pipeZ(x)) < 40) continue;
    if (x > 5500 && (Math.abs(z - riverZ(x)) < 60 || LAKES.some((lk) => Math.hypot(x - lk.x, (z - lk.z) * 1.25) < lk.r + 50))) continue;
    if ([...STATIONS, DEPOT].some((s) => Math.abs(x - s.x) < (s.w || 200) / 2 + 40 && Math.abs(z - s.z) < (s.d || 150) / 2 + 40)) continue;
    const y = heightAt(x, z);
    const d = x - coastX(z);
    if (d < 45 || y < 3 || y > 250 + Math.random() * 60) continue;
    const sl = Math.abs(heightAt(x + 6, z) - y) + Math.abs(heightAt(x, z + 6) - y);
    if (sl > 7) continue;
    // Рощи: плотность по шуму, чтобы лес стоял массивами с полянами.
    if (fbm(x / 220, z / 220, 3) < 0.42) continue;
    const sc = 0.8 + Math.random() * 0.9;
    forest.setMatrixAt(k, m4.compose(new THREE.Vector3(x, y - 0.3, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28), s.set(sc, sc * (0.9 + Math.random() * 0.4), sc)));
    forest.setColorAt(k, col.setHSL(0.3 + Math.random() * 0.06, 0.45, 0.17 + Math.random() * 0.1));
    k++;
  }
  forest.count = k;
  forest.userData.noCast = true;

  const group = new THREE.Group();
  group.add(terrain, forest);
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
