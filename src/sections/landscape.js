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
export function heightAt(x, z) {
  const d = x - coastX(z);
  if (d < 0) return Math.max(-17, d * 0.22);                                   // подводный склон
  // Естественная суша: пляж → луга и холмы → предгорья → горы (до ~420 м).
  const beach = 1.6 * smooth(0, 30, d);
  const hills = 26 * fbm(x / 380, z / 380) * smooth(20, 260, d);
  const mount = 430 * Math.pow(ridged(x / 1300 + 2.1, z / 1300 - 0.7), 1.25) * smooth(500, 2300, d);
  const natural = 1.2 + beach + hills + mount;
  // Площадка терминала плавно переходит в естественный рельеф.
  const dd = Math.max(x - PAD.x1, Math.abs(z) - PAD.z, 0);
  const inPad = x >= 1700 && Math.abs(z) <= PAD.z + 260;
  return inPad ? LAND + (natural - LAND) * smooth(0, 260, dd) : natural;
}

export function makeCoast({x0 = 1420, x1 = 6200, z0 = -3400, z1 = 3800, seg = 300} = {}) {
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
    if (y < 0) c.copy(wet).lerp(sand, Math.max(0, 1 + y / 4));
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
  const N = 9000;
  const forest = new THREE.InstancedMesh(tree, new THREE.MeshLambertMaterial({vertexColors: true}), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color();
  let k = 0, tries = 0;
  while (k < N && tries < N * 12) {
    tries++;
    const x = 1720 + Math.random() * 3200, z = -3000 + Math.random() * 6400;
    if (x < PAD.x1 + 25 && Math.abs(z) < PAD.z + 25) continue;
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
  return group;
}
