// Горы за терминалом: карта высот из фрактального шума с острыми гребнями,
// раскраска по высоте и крутизне — луга, тайга, скалы, снежные вершины.
import * as THREE from 'three';

// Детерминированный шум значений.
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
// Гребневый шум: острые хребты.
function ridged(x, y) {
  let sum = 0, amp = 0.55, f = 1, w = 1;
  for (let o = 0; o < 6; o++) {
    let n = 1 - Math.abs(noise(x * f, y * f) * 2 - 1);
    n = n * n * w;
    w = Math.min(1, n * 1.6);
    sum += n * amp;
    f *= 2.05;
    amp *= 0.5;
  }
  return sum;
}

// x0 — где горы начинаются (у края суши подножие сходит на нет), x1 — дальний край.
export function makeMountains({x0 = 2250, x1 = 7000, z0 = -3200, z1 = 3600, seg = 230} = {}) {
  const W = x1 - x0, D = z1 - z0;
  const geo = new THREE.PlaneGeometry(W, D, seg, Math.round((seg * D) / W)).rotateX(-Math.PI / 2);
  geo.translate(x0 + W / 2, 0, z0 + D / 2);
  const pos = geo.attributes.position;
  const h = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const k = Math.min(1, Math.max(0, (x - x0) / 1400));           // подъём от подножия
    const far = 0.55 + 0.45 * Math.min(1, (x - x0) / 3200);         // дальше — выше
    const r = ridged(x / 1500 + 3.1, z / 1500 - 1.7);
    const hills = noise(x / 300, z / 300) * 28 * k;
    h[i] = 3 + Math.pow(k, 1.6) * (r * 1250 * far) + hills;
    pos.setY(i, h[i]);
  }
  geo.computeVertexNormals();

  // Цвет по высоте и крутизне.
  const nrm = geo.attributes.normal, cols = new Float32Array(pos.count * 3);
  const meadow = new THREE.Color(0x7fa35a), forest = new THREE.Color(0x2f5b34), rock = new THREE.Color(0x7d776f),
    rockDark = new THREE.Color(0x5a554f), snow = new THREE.Color(0xf4f8fb), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = h[i], slope = 1 - nrm.getY(i), jitter = hash(pos.getX(i) * 0.05, pos.getZ(i) * 0.05);
    if (y < 60) c.copy(meadow).lerp(forest, Math.min(1, y / 60));
    else if (y < 320) c.copy(forest).lerp(rockDark, Math.min(1, Math.max(0, slope * 2.2 - 0.2 + (y - 200) / 400)));
    else c.copy(rock).lerp(rockDark, jitter * 0.6);
    const snowLine = 470 + jitter * 90;
    if (y > snowLine && slope < 0.55) c.lerp(snow, Math.min(1, (y - snowLine) / 90) * (1 - slope * 1.2));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true}));
  mesh.receiveShadow = true;
  mesh.userData.noCast = true;
  return mesh;
}
