// Портовый буксир с азимутальными винторулевыми колонками (ASD), по ракурсам эталонных снимков:
// чёрный корпус с бортовыми покрышками-кранцами и привальным брусом, жёлтая двухъярусная надстройка
// с остеклённой рубкой, мачта, выхлопные трубы, красные кран-балки и дефлекторы, носовая и кормовая
// лебёдки, кнехты, буксирная скоба, две колонки в насадках с латунными винтами.
// Размеры ≈ 32 × 11,6 м. Нос в −z, ватерлиния y = 0. Мелкие детали сливаются в несколько мешей по материалам.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const L = 32, B = 11.6, Z0 = -16;
const halfW = (t) => {
  if (t < 0.42) { const u = (0.42 - t) / 0.42; return (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(u, 2.2)), 0.55); }
  const u = (t - 0.42) / 0.58;
  return (B / 2) * (1 - 0.1 * u * u);
};
const deckY = (t) => 2.9 + 1.3 * Math.pow(1 - t, 3);
const keelY = (t) => {
  if (t < 0.18) { const k = t / 0.18; return -0.6 - 2.2 * (k * k * (3 - 2 * k)); }
  if (t < 0.75) return -2.8;
  return -2.8 + 1.3 * ((t - 0.75) / 0.25);
};
const zOf = (t) => Z0 + t * L;
const tOf = (z) => (z - Z0) / L;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const M = {
  hull: new THREE.MeshStandardMaterial({color: 0x1b1e23, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide}),
  boot: new THREE.MeshStandardMaterial({color: 0x2a1a17, roughness: 0.7, metalness: 0.1}),
  deck: new THREE.MeshStandardMaterial({color: 0x3b4552, roughness: 0.85, metalness: 0.2, side: THREE.DoubleSide}),
  rubber: new THREE.MeshStandardMaterial({color: 0x111214, roughness: 0.9}),
  yellow: new THREE.MeshStandardMaterial({color: 0xf2c218, roughness: 0.45, metalness: 0.15}),
  black: new THREE.MeshStandardMaterial({color: 0x15171b, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide}),
  glass: new THREE.MeshStandardMaterial({color: 0x1e3550, roughness: 0.08, metalness: 0.7}),
  red: new THREE.MeshStandardMaterial({color: 0xc8231f, roughness: 0.4, metalness: 0.2}),
  steel: new THREE.MeshStandardMaterial({color: 0xc9d0d6, roughness: 0.25, metalness: 0.9}),
  grey: new THREE.MeshStandardMaterial({color: 0x8d969e, roughness: 0.5, metalness: 0.5}),
  white: new THREE.MeshStandardMaterial({color: 0xf2f2ee, roughness: 0.4}),
  rope: new THREE.MeshStandardMaterial({color: 0xd9cfb4, roughness: 0.9}),
  brass: new THREE.MeshStandardMaterial({color: 0xd9a63a, roughness: 0.22, metalness: 1}),
};

// ----------------------------------------------------------------------
// Корпус: сечения по шпангоутам (правый борт → киль → левый борт), палуба, транец.
function hullGeometry() {
  const N = 72;
  const prof = (t) => {
    const w = halfW(t), yd = deckY(t), k = keelY(t), flare = t < 0.35 ? 0.93 + 0.07 * (t / 0.35) : 1;
    return [[1, yd], [flare, yd * 0.55], [0.99 * flare, 0.6], [0.95, -0.4], [0.86, k * 0.55], [0.66, k * 0.85], [0.36, k * 0.97], [0, k]]
      .map(([f, y]) => [f * w, y]);
  };
  const P = prof(0).length;
  const R = 2 * P - 1;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = zOf(t), pr = prof(t);
    const ring = [...pr.map(([x, y]) => [x, y]), ...pr.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
    for (const [x, y] of ring) pos.push(x, y, z);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R - 1; j++) {
    const a = i * R + j, b = a + R;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // Транец: веер из центра.
  const base = pos.length / 3;
  const last = N * R;
  let cy = 0;
  for (let j = 0; j < R; j++) cy += pos[(last + j) * 3 + 1];
  pos.push(0, cy / R, zOf(1));
  for (let j = 0; j < R - 1; j++) idx.push(last + j, base, last + j + 1);
  idx.push(last + R - 1, base, last);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Лента между двумя кривыми (палуба, фальшборт).
function ribbon(a, b) {
  const pos = [], idx = [];
  a.forEach((p, i) => pos.push(p.x, p.y, p.z, b[i].x, b[i].y, b[i].z));
  for (let i = 0; i < a.length - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ----------------------------------------------------------------------
export function makeTug(name = 'ВОСТОК-1') {
  const group = new THREE.Group();
  const parts = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1);
  const put = (geo, mat, p = V(0, 0, 0), r = [0, 0, 0], s = one) => {
    geo.applyMatrix4(m4.compose(p, q.setFromEuler(e.set(...r)), s));
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(geo);
  };
  const box = (w, h, d, mat, x, y, z, r) => put(new THREE.BoxGeometry(w, h, d), mat, V(x, y, z), r);
  const cyl = (r1, r2, h, mat, x, y, z, rot, seg = 16) => put(new THREE.CylinderGeometry(r1, r2, h, seg), mat, V(x, y, z), rot);
  const rod = (a, b, r, mat, seg = 8) => {
    const d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.applyMatrix4(m4.compose(a.clone().addScaledVector(d, 0.5), q.setFromUnitVectors(V(0, 1, 0), d.normalize()), one));
    put(g, mat);
  };
  const tube = (pts, r, mat, closed = false, seg) => put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg || pts.length * 6, r, 8, closed), mat);
  // Леер: верхний и средний пояс + стойки.
  const rail = (pts, h, mat, closed = false) => {
    const up = (k) => pts.map((p) => p.clone().add(V(0, k, 0)));
    const poly = (arr) => { for (let i = 0; i < arr.length - (closed ? 0 : 1); i++) rod(arr[i], arr[(i + 1) % arr.length], 0.045, mat, 6); };
    poly(up(h)); poly(up(h * 0.5));
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(a.distanceTo(b) / 1.3));
      for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n); rod(p, p.clone().add(V(0, h, 0)), 0.04, mat, 6); }
    }
  };
  const rect = (x0, x1, z0, z1, y) => [V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1)];

  // --- Корпус, палуба, фальшборт, привальный брус ---
  put(hullGeometry(), M.hull);
  const T = Array.from({length: 61}, (_, i) => i / 60);
  const edge = (side, dy = 0, inset = 0) => T.map((t) => V(side * Math.max(0, halfW(t) - inset), deckY(t) + dy, zOf(t)));
  put(ribbon(edge(1), edge(-1)), M.deck);
  for (const s of [1, -1]) {
    put(ribbon(edge(s, 0), edge(s, 1.05)), M.hull);              // наружная стенка фальшборта
    put(ribbon(edge(s, 1.05, 0.28), edge(s, 0, 0.28)), M.hull);   // внутренняя
    put(ribbon(edge(s, 1.05), edge(s, 1.05, 0.28)), M.black);     // планширь
  }
  box(B * 0.9, 1.05, 0.28, M.hull, 0, deckY(1) + 0.52, zOf(1) - 0.2);    // фальшборт на корме
  // Привальный брус по контуру от кормы через нос к корме.
  const fenderLine = [...T.slice().reverse().map((t) => V(halfW(t) + 0.25, deckY(t) - 0.35, zOf(t))), ...T.slice(1).map((t) => V(-halfW(t) - 0.25, deckY(t) - 0.35, zOf(t)))];
  tube(fenderLine.filter((_, i) => i % 2 === 0), 0.42, M.rubber, false, 240);
  // Скуловые кили и скег.
  for (const s of [1, -1]) box(0.15, 0.5, 9, M.hull, s * halfW(0.5) * 0.83, -1.75, 0, [0, 0, s * 0.6]);
  box(0.45, 1.2, 9, M.hull, 0, -3.3, 2);

  // --- Покрышки-кранцы на борту и у носа ---
  const tyre = new THREE.TorusGeometry(0.58, 0.27, 10, 18);
  for (const s of [1, -1]) {
    for (let t = 0.02; t < 0.9; t += 0.066) {
      const w = halfW(t), yd = deckY(t), z = zOf(t);
      const dz = (halfW(t + 0.005) - halfW(t - 0.005)) / (0.01 * L);
      const n = V(s, 0, -dz).normalize();
      const p = V(s * w, yd - 1.35, z).addScaledVector(n, 0.62);
      const g = tyre.clone();
      g.applyMatrix4(m4.compose(p, q.setFromUnitVectors(V(0, 0, 1), n), one));
      put(g, M.rubber);
      rod(p.clone().add(V(0, 0.5, 0)), V(s * (w - 0.1), yd + 1.05, z), 0.03, M.rope, 4);   // подвес
    }
  }

  // --- Надстройка ---
  const dY = deckY(0.5);
  const y1 = dY + 2.8, y2 = y1 + 2.2, y3 = y2 + 2.9;
  box(7.6, 2.8, 10, M.yellow, 0, dY + 1.4, 0);                         // главная рубка
  box(7.7, 0.25, 10.1, M.black, 0, dY + 0.12, 0);                      // цоколь
  box(6.4, 2.2, 6.5, M.yellow, 0, y1 + 1.1, -1.2);                     // второй ярус
  for (const s of [1, -1]) {
    box(1.5, 1.9, 3.6, M.black, s * 3.1, y1 + 0.95, 3.1);              // кожухи выхлопа
    box(1.55, 0.3, 3.65, M.grey, s * 3.1, y1 + 2.0, 3.1);              // решётки
    // Иллюминаторы и спасательные круги по бортам рубки.
    for (const z of [-3.5, -1, 1.5]) box(0.06, 0.4, 0.7, M.glass, s * 3.81, dY + 1.9, z);
    put(new THREE.TorusGeometry(0.35, 0.09, 8, 18), M.red, V(s * 3.84, dY + 1.6, 3.6), [0, Math.PI / 2, 0]);
    put(new THREE.TorusGeometry(0.35, 0.09, 8, 18), M.red, V(s * 3.25, y1 + 1.2, -3.2), [0, Math.PI / 2, 0]);
    for (const z of [-3.6, -2]) box(0.06, 0.45, 0.6, M.glass, s * 3.21, y1 + 1.3, z);
  }
  // Рубка: восьмигранник с наклонными окнами и нависающей крышей.
  const wh = (rTop, rBot, h, mat, y) => put(new THREE.CylinderGeometry(rTop, rBot, h, 8, 1), mat, V(0, y, -2), [0, Math.PI / 8, 0], V(1.05, 1, 0.82));
  wh(3.05, 3.0, 0.9, M.yellow, y2 + 0.45);
  wh(3.3, 3.05, 1.6, M.glass, y2 + 1.7);
  for (let k = 0; k < 8; k++) {                                         // стойки окон
    const a = (k / 8) * Math.PI * 2;
    rod(V(Math.cos(a) * 3.08 * 1.05, y2 + 0.9, -2 + Math.sin(a) * 3.08 * 0.82), V(Math.cos(a) * 3.33 * 1.05, y2 + 2.5, -2 + Math.sin(a) * 3.33 * 0.82), 0.09, M.yellow, 6);
  }
  wh(3.6, 3.5, 0.35, M.yellow, y2 + 2.65);
  // Леера: на втором ярусе, на крыше рубки, на передней части главной рубки.
  rail(rect(-3.1, 3.1, -4.35, 1.95, y2), 1.0, M.yellow, true);
  rail(rect(-2.8, 2.8, -4.4, 0.4, y3 - 0.05), 0.9, M.yellow, true);
  rail([V(-3.7, y1, -5), V(3.7, y1, -5)], 1.0, M.yellow);
  // Трапы.
  for (const s of [1, -1]) {
    const x = s * 3.35, z = -5.15;
    rod(V(x - 0.3, dY, z), V(x - 0.3, y1 + 1, z), 0.04, M.yellow, 6);
    rod(V(x + 0.3, dY, z), V(x + 0.3, y1 + 1, z), 0.04, M.yellow, 6);
    for (let y = dY + 0.3; y < y1; y += 0.3) rod(V(x - 0.3, y, z), V(x + 0.3, y, z), 0.025, M.yellow, 4);
  }
  // Выхлопные трубы: стальные с чёрными колпаками, загнуты назад.
  for (const s of [1, -1]) for (const dx of [-0.35, 0.35]) {
    const x = s * 3.1 + dx;
    cyl(0.2, 0.2, 5.4, M.steel, x, y1 + 2.7, 2.6);
    cyl(0.22, 0.22, 1.1, M.black, x, y1 + 5.5, 2.6);
    tube([V(x, y1 + 5.9, 2.6), V(x, y1 + 6.3, 2.8), V(x, y1 + 6.4, 3.3)], 0.2, M.black);
  }
  // Красные дефлекторы-гусаки у мачты.
  for (const s of [1, -1]) {
    cyl(0.22, 0.22, 3.4, M.red, s * 2.4, y2 + 1.7, 0.9);
    tube([V(s * 2.4, y2 + 3.4, 0.9), V(s * 2.4, y2 + 3.9, 0.7), V(s * 2.4, y2 + 3.8, 0.15)], 0.22, M.red);
  }
  // Мачта с реями, антеннами, ходовыми огнями.
  const mastY0 = y3 + 0.18;
  cyl(0.16, 0.12, 9.5, M.white, 0, mastY0 + 4.75, -0.8);
  for (const [y, w] of [[mastY0 + 4, 2.8], [mastY0 + 6.2, 2.2]]) {
    box(w, 0.12, 0.12, M.white, 0, y, -0.8);
    for (const s of [1, -1]) cyl(0.06, 0.06, 0.9, M.grey, s * w * 0.45, y + 0.45, -0.8);
  }
  for (let y = mastY0 + 0.4; y < mastY0 + 8; y += 0.4) box(0.5, 0.04, 0.04, M.grey, 0, y, -0.55);
  box(1.8, 0.12, 0.3, M.black, 0, mastY0 + 2.2, -0.8); // радар (вращается отдельно — см. ниже)

  // --- Палубное оборудование ---
  const winch = (z) => {
    const y = deckY(tOf(z));
    box(3.6, 0.3, 1.8, M.black, 0, y + 0.15, z);
    for (const s of [1, -1]) {
      box(0.25, 1.9, 1.6, M.black, s * 1.75, y + 1.1, z);
      cyl(0.72, 0.72, 1.3, M.grey, s * 0.85, y + 1.2, z, [0, 0, Math.PI / 2], 20);
      for (const d of [-0.68, 0.68]) cyl(1.0, 1.0, 0.1, M.black, s * 0.85 + d, y + 1.2, z, [0, 0, Math.PI / 2], 20);
    }
    box(0.3, 1.9, 1.6, M.black, 0, y + 1.1, z);
  };
  winch(-8.6);
  winch(8.6);
  // Носовая буксирная скоба и кнехты.
  const yb = deckY(0.06);
  put(new THREE.TorusGeometry(1.0, 0.28, 10, 20, Math.PI), M.black, V(0, yb + 1.05, zOf(0.06)), [0, 0, 0]);
  for (const s of [1, -1]) {
    cyl(0.3, 0.3, 1.1, M.black, s * 1.4, deckY(0.14) + 0.55, zOf(0.14));
    cyl(0.3, 0.3, 1.1, M.black, s * 1.4, deckY(0.14) + 0.55, zOf(0.14) + 0.9);
  }
  // Кормовая П-образная стойка (буксирные штыри) и кнехты.
  const ys = deckY(0.9);
  for (const x of [-2.2, -0.75, 0.75, 2.2]) cyl(0.18, 0.18, 1.6, M.black, x, ys + 0.8, 12.6);
  for (const y of [ys + 0.7, ys + 1.5]) box(4.8, 0.18, 0.18, M.black, 0, y, 12.6);
  for (const s of [1, -1]) for (const dz of [0, 0.9]) cyl(0.28, 0.28, 1, M.black, s * 4, ys + 0.5, 13.6 + dz);
  // Бухта троса на корме.
  put(new THREE.TorusGeometry(0.8, 0.1, 6, 24), M.rope, V(1.8, ys + 0.12, 11), [Math.PI / 2, 0, 0]);
  put(new THREE.TorusGeometry(0.6, 0.1, 6, 24), M.rope, V(2.3, ys + 0.22, 10.7), [Math.PI / 2, 0, 0]);
  // Кран-балки.
  const davit = (x, z, dir) => {
    const y = deckY(tOf(z));
    cyl(0.28, 0.34, 3.2, M.red, x, y + 1.6, z);
    const top = V(x, y + 3.2, z), tip = V(x + dir * 3.4, y + 4.1, z);
    rod(top, tip, 0.18, M.red);
    rod(tip, tip.clone().add(V(0, -0.9, 0)), 0.12, M.red);
    rod(V(x, y + 2.2, z), top.clone().lerp(tip, 0.5), 0.1, M.red);
  };
  davit(3.0, -6.3, 1);
  davit(-3.0, 6.6, -1);

  // --- Азимутальные колонки: насадки и стойки (винты — отдельные меши, вращаются) ---
  const props = [];
  const hubZ = 12.6, hubY = -3.65;
  for (const s of [1, -1]) {
    const x = s * 2.7;
    rod(V(x, keelY(tOf(hubZ)) + 0.3, hubZ - 0.2), V(x, hubY + 1.0, hubZ - 0.2), 0.32, M.black, 12);
    put(new THREE.CylinderGeometry(1.3, 1.22, 1.8, 28, 1, true), new THREE.MeshStandardMaterial({color: 0x1b1e23, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide}), V(x, hubY, hubZ), [Math.PI / 2, 0, 0]);
    put(new THREE.TorusGeometry(1.3, 0.1, 8, 28), M.black, V(x, hubY, hubZ + 0.9));
    put(new THREE.TorusGeometry(1.26, 0.1, 8, 28), M.black, V(x, hubY, hubZ - 0.9));
    const prop = new THREE.Group();
    prop.position.set(x, hubY, hubZ);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), M.brass);
    hub.scale.set(1, 1, 1.4);
    prop.add(hub);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.06), M.brass);
      blade.geometry.translate(0, 0.62, 0);
      blade.rotation.set(0.45, 0, (k / 4) * Math.PI * 2);
      prop.add(blade);
    }
    group.add(prop);
    props.push(prop);
  }

  // --- Слияние деталей по материалам ---
  for (const [mat, geos] of parts) {
    const merged = mergeGeometries(geos.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k);
      if (!n.attributes.normal) n.computeVertexNormals();
      return n;
    }));
    const mesh = new THREE.Mesh(merged, mat);
    group.add(mesh);
  }

  // --- Надписи и знаки: название на скулах, логотип на рубке, марки углубления ---
  const tex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const nameTex = tex(512, 96, (g, w, h) => {
    g.font = '800 64px Inter, Segoe UI, sans-serif';
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, w / 2, h / 2);
  });
  const logoTex = tex(256, 320, (g, w, h) => {
    g.fillStyle = '#15171b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f08a12';
    g.beginPath(); g.moveTo(128, 40); g.bezierCurveTo(70, 120, 60, 150, 60, 175); g.arc(128, 175, 68, Math.PI, 0, true); g.bezierCurveTo(196, 150, 186, 120, 128, 40); g.fill();
    g.font = '800 36px Inter, Segoe UI, sans-serif'; g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.fillText('ВОСТОК', 128, 282); g.font = '700 26px Inter, Segoe UI, sans-serif'; g.fillStyle = '#f08a12'; g.fillText('ПРОМОЙЛ', 128, 310);
  });
  const draftTex = tex(64, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) g.fillRect(i % 2 ? 24 : 8, i * 32 + 4, i % 2 ? 20 : 36, 6);
    g.fillRect(4, 0, 4, h);
  });
  const decal = (texture, w, h, p, n) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: texture, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2}));
    m.position.copy(p);
    m.quaternion.setFromUnitVectors(V(0, 0, 1), n);
    group.add(m);
  };
  for (const s of [1, -1]) {
    const t = 0.24, z = zOf(t), w = halfW(t), yd = deckY(t);
    const dz = (halfW(t + 0.005) - halfW(t - 0.005)) / (0.01 * L);
    const n = V(s, 0, -dz).normalize();
    decal(nameTex, 4.4, 0.82, V(s * w, yd + 0.5, z).addScaledVector(n, 0.04), n); // на фальшборте над кранцами
    decal(logoTex, 1.2, 1.5, V(s * 3.82, dY + 1.6, 2.3), V(s, 0, 0));
    const t2 = 0.07, n2 = V(s, 0, -(halfW(t2 + 0.005) - halfW(t2 - 0.005)) / (0.01 * L)).normalize();
    decal(draftTex, 0.5, 2.2, V(s * (halfW(t2) * 0.98 + 0.05), 0.4, zOf(t2)).addScaledVector(n2, 0.05), n2);
  }
  // Ходовые огни.
  const light = (color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 2.5}));
    m.position.set(x, y, z);
    group.add(m);
  };
  light(0x22ff55, 3.4, y2 + 2.95, -3.4);
  light(0xff2222, -3.4, y2 + 2.95, -3.4);
  light(0xffffff, 0, mastY0 + 9.5, -0.8);
  light(0xffd040, 0, mastY0 + 7.4, -0.8);

  // Вращающийся радар.
  const radar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.35), M.black);
  radar.position.set(0, mastY0 + 2.45, -0.8);
  group.add(radar);

  group.traverse((o) => { if (o.isMesh) o.userData.key = 'tugs'; });
  // power: 0 — винты стоят, 1 — полный упор.
  group.userData.spin = (dt, power = 1) => {
    for (const p of props) p.rotation.z += dt * power * 14;
    radar.rotation.y += dt * 2.5;
  };
  return group;
}
