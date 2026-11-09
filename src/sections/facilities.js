// Общие сооружения площадок НПС, нефтебазы и НПЗ: здания с ленточным остеклением, подстанции
// с трансформаторами, ЛЭП, пожарные резервуары и насосная, фильтры-грязеуловители, мачты освещения,
// внутриплощадочные дороги, автоцистерны, технологические колонны, печи, эстакады, факел.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.2, ...o});
export const FM = {
  white: mat(0xf2f3f0, {roughness: 0.5}),
  wall2: mat(0xdfe3e6, {roughness: 0.6}),
  blue: mat(0x1d5fb8, {roughness: 0.45}),
  red: mat(0xcf2128, {roughness: 0.45}),
  yellow: mat(0xffc21f, {roughness: 0.45}),
  green: mat(0x3d7a4a, {roughness: 0.5}),
  tgrey: mat(0x7b858b, {roughness: 0.5, metalness: 0.35}),
  steel: mat(0xc6cdd3, {metalness: 0.85, roughness: 0.3}),
  alu: mat(0xd9dee2, {metalness: 0.7, roughness: 0.35}),
  dark: mat(0x2c3136, {roughness: 0.6}),
  glass: mat(0x5d8fb5, {metalness: 0.7, roughness: 0.1}),
  concrete: mat(0xcfc9bc, {roughness: 0.92}),
  asphalt: mat(0x4a4d50, {roughness: 0.95}),
  ins: mat(0x8a5a3a, {roughness: 0.35}),
  porcelain: mat(0xe9e6e0, {roughness: 0.3}),
  rust: mat(0xa8512a, {roughness: 0.7}),
  lamp: new THREE.MeshStandardMaterial({color: 0xfff6d8, emissive: 0xffe9b0, emissiveIntensity: 1.6}),
};

export const box = (p, w, h, d, m, x, y, z, key, ry = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.rotation.y = ry;
  if (key) o.userData.key = key;
  p.add(o);
  return o;
};
export const cyl = (p, r, h, m, x, y, z, key, rot, seg = 18, r2 = r) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg), m);
  o.position.set(x, y, z);
  if (rot) o.rotation.set(...rot);
  if (key) o.userData.key = key;
  p.add(o);
  return o;
};
export const link = (p, a, b, r, m, key, seg = 6) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.scale.y = a.distanceTo(b);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  if (key) o.userData.key = key;
  p.add(o);
  return o;
};
// Группа в локальных координатах площадки (поворот вокруг вертикали).
export const site = (p, x, y, z, ry = 0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  p.add(g);
  return g;
};

// Здание: стены, цоколь, карниз, ленточное остекление, двери, вентиляция на крыше.
export function building(p, {x, y, z, w, d, h, ry = 0, wall = FM.white, trim = FM.blue, key, floors = Math.max(1, Math.round(h / 4)), door = true}) {
  const g = site(p, x, y, z, ry);
  box(g, w, h, d, wall, 0, h / 2, 0, key);
  box(g, w + 0.1, 0.9, d + 0.1, trim, 0, 0.45, 0, key);
  box(g, w + 0.5, 0.5, d + 0.5, trim, 0, h + 0.25, 0, key);
  for (let f = 0; f < floors; f++) {
    const wy = 1.9 + f * (h - 1.2) / floors;
    box(g, w - 2, 1.1, d + 0.12, FM.glass, 0, wy, 0, key);
    box(g, w + 0.12, 1.1, d - 2, FM.glass, 0, wy, 0, key);
  }
  if (door) {
    box(g, 2.2, 2.6, 0.3, FM.dark, -w / 4, 1.3, d / 2 + 0.05, key);
    box(g, 3.2, 0.2, 1.6, trim, -w / 4, 2.8, d / 2 + 0.8, key);
  }
  for (let i = 0; i < Math.max(1, Math.floor(w / 12)); i++) {
    box(g, 1.6, 1.0, 1.4, FM.alu, -w / 2 + 4 + i * 10, h + 1.0, -d / 4, key);
    cyl(g, 0.35, 1.6, FM.alu, -w / 2 + 6 + i * 10, h + 1.3, d / 4, key, null, 10);
  }
  return g;
}

// Силовой трансформатор: бак, радиаторы, расширитель, вводы.
export function transformer(p, x, y, z, ry, key) {
  const g = site(p, x, y, z, ry);
  box(g, 6, 0.5, 4, FM.concrete, 0, 0.25, 0, key);
  box(g, 4, 3.4, 2.4, FM.tgrey, 0, 2.2, 0, key);
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) box(g, 0.08, 2.8, 0.9, FM.tgrey, -1.8 + i * 0.45, 2.1, s * 1.75, key);
  cyl(g, 0.45, 3.2, FM.tgrey, 0, 4.6, -0.6, key, [0, 0, Math.PI / 2]);
  for (const xx of [-1.2, 0, 1.2]) {
    for (let k = 0; k < 6; k++) cyl(g, 0.2 - (k % 2) * 0.05, 0.22, FM.porcelain, xx, 4.1 + k * 0.22, 0.5, key, null, 10);
    cyl(g, 0.05, 1.4, FM.steel, xx, 5.9, 0.5, key, null, 6);
  }
  return g;
}

// Открытое распредустройство с порталами и ЗРУ.
export function substation(p, {x, y, z, ry = 0, key}) {
  const g = site(p, x, y, z, ry);
  box(g, 46, 0.15, 30, mat(0xa49f94, {roughness: 1}), 0, 0.08, 0, key);
  transformer(g, -10, 0.15, 3, 0, key);
  transformer(g, 6, 0.15, 3, 0, key);
  // Порталы шинных мостов.
  for (const px of [-18, 18]) {
    for (const dz of [-6, 8]) {
      link(g, V(px, 0, dz), V(px, 14, dz), 0.22, FM.steel, key);
      link(g, V(px - 2, 0, dz), V(px, 14, dz), 0.12, FM.steel, key);
    }
    link(g, V(px, 14, -6), V(px, 14, 8), 0.2, FM.steel, key);
    for (const dz of [-3, 1, 5]) for (let k = 0; k < 6; k++) cyl(g, 0.18 - (k % 2) * 0.05, 0.2, FM.porcelain, px, 13.6 - k * 0.22, dz, key, null, 8);
  }
  // ЗРУ.
  building(g, {x: 0, y: 0, z: -11, w: 30, d: 8, h: 6, wall: FM.wall2, trim: FM.blue, key, floors: 1});
  // Ограда.
  const fence = mat(0x9aa4ad, {transparent: true, opacity: 0.4, depthWrite: false});
  for (const [w, d, xx, zz] of [[46, 0.05, 0, 15], [46, 0.05, 0, -15], [0.05, 30, 23, 0], [0.05, 30, -23, 0]]) {
    const f = box(g, w, 2.2, d, fence, xx, 1.1, zz);
    f.userData.dynamic = true;
  }
  return g;
}

// Решётчатая опора ЛЭП: четыре сужающихся пояса, траверсы, гирлянды изоляторов.
export function powerTower(p, x, y, z, ry, key, H = 30) {
  const g = site(p, x, y, z, ry);
  const w = (h) => 2.4 - h / H * 1.8;
  const C = (h) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => V(a * w(h), h, b * w(h)));
  const lv = [0, H * 0.3, H * 0.55, H * 0.78, H];
  for (let i = 0; i < lv.length - 1; i++) {
    const A = C(lv[i]), B = C(lv[i + 1]);
    for (let c = 0; c < 4; c++) {
      link(g, A[c], B[c], 0.1, FM.steel, key, 4);
      link(g, A[c], B[(c + 1) % 4], 0.05, FM.steel, key, 4);
    }
  }
  for (const [h, L] of [[H * 0.78, 6], [H * 0.95, 4]]) {
    link(g, V(-L, h, 0), V(L, h, 0), 0.12, FM.steel, key, 4);
    for (const s of [-1, 1]) link(g, V(s * L, h, 0), V(s * w(h + 3), h + 3, 0), 0.06, FM.steel, key, 4);
  }
  return {g, arms: [V(-6, H * 0.78 - 1.6, 0), V(6, H * 0.78 - 1.6, 0), V(-4, H * 0.95 - 1.6, 0)]};
}
// ЛЭП по точкам (мировые координаты опор): опоры + провода с провисом.
export function powerLine(p, towers, key) {
  const pts = [];
  const tw = towers.map(([x, y, z], i) => {
    const nx = towers[Math.min(i + 1, towers.length - 1)], pv = towers[Math.max(0, i - 1)];
    const ry = Math.atan2(nx[0] - pv[0], nx[2] - pv[2]) + Math.PI / 2;
    const t = powerTower(p, x, y, z, ry, key);
    t.g.updateMatrixWorld(true);
    return t.arms.map((a) => a.clone().applyMatrix4(t.g.matrix));
  });
  for (let i = 0; i < tw.length - 1; i++) for (let k = 0; k < 3; k++) {
    const A = tw[i][k], B = tw[i + 1][k];
    for (let j = 0; j < 8; j++) {
      const t0 = j / 8, t1 = (j + 1) / 8, sag = (t) => 2.2 * 4 * t * (1 - t);
      const P0 = A.clone().lerp(B, t0), P1 = A.clone().lerp(B, t1);
      P0.y -= sag(t0); P1.y -= sag(t1);
      pts.push(P0, P1);
    }
  }
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: 0x34383c}));
  l.userData.dynamic = true;
  p.add(l);
}

// Пожарные резервуары и насосная пожаротушения.
export function fireStation(p, {x, y, z, ry = 0, key, tanks = 2}) {
  const g = site(p, x, y, z, ry);
  for (let i = 0; i < tanks; i++) {
    const tx = -10 + i * 15;
    cyl(g, 6.5, 0.6, FM.concrete, tx, 0.3, 0, key, null, 32);
    cyl(g, 6, 11, FM.white, tx, 6.1, 0, key, null, 40);
    cyl(g, 6.05, 1.2, FM.red, tx, 9, 0, key, null, 40);
    cyl(g, 6.1, 0.25, FM.steel, tx, 11.7, 0, key, null, 40);
    for (let k = 0; k < 10; k++) box(g, 0.9, 0.1, 0.3, FM.steel, tx + 6.3, 1 + k * 1.1, 0, key);
  }
  building(g, {x: -2, y: 0, z: 14, w: 16, d: 9, h: 5, wall: FM.red, trim: FM.white, key, floors: 1});
  return g;
}

// Фильтры-грязеуловители: горизонтальные сосуды на опорах с обвязкой.
export function filters(p, {x, y, z, ry = 0, key, n = 3}) {
  const g = site(p, x, y, z, ry);
  for (let i = 0; i < n; i++) {
    const zz = -5 + i * 5;
    cyl(g, 1.1, 6.5, FM.steel, 0, 2.2, zz, key, [0, 0, Math.PI / 2], 20);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), FM.steel);
      cap.rotation.z = -s * Math.PI / 2;
      cap.scale.y = 0.45;
      cap.position.set(s * 3.25, 2.2, zz);
      cap.userData.key = key;
      g.add(cap);
      box(g, 0.5, 1.4, 1.8, FM.concrete, s * 2, 0.7, zz, key);
    }
    cyl(g, 0.4, 1.4, FM.steel, -1.5, 3.6, zz, key, null, 12);
    cyl(g, 0.4, 1.4, FM.steel, 1.5, 3.6, zz, key, null, 12);
    box(g, 0.8, 0.6, 0.6, FM.yellow, -1.5, 4.5, zz, key);
    box(g, 0.8, 0.6, 0.6, FM.yellow, 1.5, 4.5, zz, key);
  }
  for (const s of [-1, 1]) cyl(g, 0.45, n * 5 + 2, FM.white, s * 1.5, 4.3, 0, key, [Math.PI / 2, 0, 0], 12);
  box(g, 10, 0.12, n * 5 + 4, FM.concrete, 0, 0.06, 0, key);
  return g;
}

// Горизонтальная ёмкость (подземная — только горловины; надземная — на седлах).
export function vessel(p, {x, y, z, r, len, ry = 0, m = FM.white, key, buried = false}) {
  const g = site(p, x, y, z, ry);
  if (buried) {
    box(g, len + 2, 0.2, r * 2 + 2, FM.concrete, 0, 0.1, 0, key);
    for (const xx of [-len / 3, 0, len / 3]) { cyl(g, 0.5, 1.1, FM.steel, xx, 0.6, 0, key, null, 12); cyl(g, 0.12, 3.5, FM.steel, xx + 0.8, 1.8, 0.5, key, null, 6); }
    return g;
  }
  cyl(g, r, len, m, 0, r + 0.9, 0, key, [0, 0, Math.PI / 2], 22);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
    cap.rotation.z = -s * Math.PI / 2;
    cap.scale.y = 0.5;
    cap.position.set(s * len / 2, r + 0.9, 0);
    cap.userData.key = key;
    g.add(cap);
    box(g, 0.6, r + 0.9, r * 1.6, FM.concrete, s * len / 3, (r + 0.9) / 2, 0, key);
  }
  return g;
}

// Мачта освещения с прожекторами.
export function lightMast(p, x, y, z, H = 24, key) {
  cyl(p, 0.25, H, FM.steel, x, y + H / 2, z, key, null, 8, 0.16);
  box(p, 2.4, 0.15, 2.4, FM.steel, x, y + H, z, key);
  for (const [a, b] of [[-0.8, 0.9], [0.8, 0.9], [0, -0.9]]) box(p, 0.7, 0.5, 0.3, FM.lamp, x + a, y + H + 0.4, z + b, key);
}

// Внутриплощадочные дороги — асфальт полосами [x0, z0, x1, z1] (прямоугольники по осям).
export function roads(p, y, list, key) {
  for (const [x0, z0, x1, z1] of list) {
    const w = Math.abs(x1 - x0) || 7, d = Math.abs(z1 - z0) || 7;
    const o = box(p, w, 0.12, d, FM.asphalt, (x0 + x1) / 2, y + 0.07, (z0 + z1) / 2, key);
    o.userData.noCast = true;
    const line = box(p, Math.abs(x1 - x0) > 1 ? w : 0.15, 0.02, Math.abs(z1 - z0) > 1 ? d : 0.15, FM.white, (x0 + x1) / 2, y + 0.14, (z0 + z1) / 2, key);
    line.userData.noCast = true;
  }
}

// Автоцистерна (бензовоз): кабина, рама, цистерна, колёса.
export function truck(p, x, y, z, ry, key, color = 0xe8eef2) {
  const g = site(p, x, y, z, ry);
  box(g, 2.5, 2.6, 2.3, mat(0xd8262a), 0, 1.9, 4.6, key);
  box(g, 2.3, 0.9, 1.4, FM.glass, 0, 2.6, 5.2, key);
  box(g, 1.2, 0.35, 10.5, FM.dark, 0, 0.9, 0.6, key);
  cyl(g, 1.25, 7.6, mat(color, {metalness: 0.6, roughness: 0.25}), 0, 2.45, -0.8, key, [Math.PI / 2, 0, 0], 20);
  box(g, 0.9, 0.3, 6, FM.steel, 0, 3.75, -0.8, key);
  for (const zz of [4.3, -2.6, -4.0]) for (const s of [-1, 1]) cyl(g, 0.5, 0.35, FM.dark, s * 1.1, 0.5, zz, key, [0, 0, Math.PI / 2], 14);
  return g;
}

// Технологическая колонна: обечайка (утеплённая — алюминий), площадки обслуживания, лестница.
export function column(p, {x, y, z, r, h, key, m = FM.alu, platforms = 5}) {
  const g = site(p, x, y, z);
  cyl(g, r * 1.3, 3, FM.concrete, 0, 1.5, 0, key, null, 20);
  cyl(g, r, h, m, 0, 3 + h / 2, 0, key, null, 18);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
  dome.scale.y = 0.5;
  dome.position.y = 3 + h;
  dome.userData.key = key;
  g.add(dome);
  for (let i = 1; i <= platforms; i++) {
    const py = 3 + (h * i) / (platforms + 0.5);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 1.0, 0.5, 3, 16), FM.yellow);
    ring.rotation.x = Math.PI / 2;
    ring.scale.z = 0.25;
    ring.position.y = py;
    ring.userData.key = key;
    g.add(ring);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r + 1.45, 0.05, 3, 16), FM.yellow);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = py + 1.1;
    rail.userData.key = key;
    g.add(rail);
  }
  box(g, 0.7, h, 0.25, FM.yellow, r + 0.9, 3 + h / 2, 0, key);
  cyl(g, 0.35, h * 0.85, FM.steel, -r - 0.6, 3 + h * 0.45, 0, key, null, 8);
  return g;
}

// Трубчатая печь с дымовой трубой.
export function furnace(p, {x, y, z, ry = 0, key}) {
  const g = site(p, x, y, z, ry);
  box(g, 22, 16, 12, mat(0xb8bcbf, {metalness: 0.3}), 0, 8, 0, key);
  box(g, 22.4, 1.2, 12.4, FM.red, 0, 16.6, 0, key);
  box(g, 10, 6, 6, mat(0xb8bcbf, {metalness: 0.3}), 0, 20, 0, key);
  cyl(g, 1.8, 46, mat(0xd8dadb), 0, 23 + 23, 0, key, null, 20, 1.5);
  for (const yy of [56, 62]) cyl(g, 1.62, 1.8, FM.red, 0, yy, 0, key, null, 20);
  for (let i = 0; i < 6; i++) box(g, 0.15, 14, 0.15, FM.dark, -10 + i * 4, 8, 6.05, key);
  return g;
}

// Эстакада трубопроводов: рамы через 8 м, пакеты труб на двух ярусах.
export function pipeRack(p, {x0, z0, x1, z1, y, key, levels = [6, 9]}) {
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const L = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let s = 0; s <= L; s += 8) {
    const px = along ? Math.min(x0, x1) + s : cx, pz = along ? cz : Math.min(z0, z1) + s;
    for (const o of [-3, 3]) box(p, 0.4, levels[levels.length - 1], 0.4, FM.steel, px + (along ? 0 : o), y + levels[levels.length - 1] / 2, pz + (along ? o : 0), key);
    for (const lv of levels) box(p, along ? 0.4 : 6.4, 0.4, along ? 6.4 : 0.4, FM.steel, px, y + lv, pz, key);
  }
  const cols = [0xd8dcdf, 0x6f7a80, 0xe2c86a, 0xd8dcdf, 0x9a5a3c];
  levels.forEach((lv, li) => {
    for (let i = 0; i < 5; i++) {
      const o = -2.4 + i * 1.2, r = 0.22 + (i % 3) * 0.12;
      const m = mat(cols[(i + li) % cols.length], {metalness: 0.6, roughness: 0.35});
      cyl(p, r, L, m, cx + (along ? 0 : o), y + lv + 0.2 + r, cz + (along ? o : 0), key, along ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], 10);
    }
  });
}

// Факельная установка: ствол с оттяжками и живое пламя.
export function flare(p, {x, y, z, H = 80, key}) {
  for (let i = 0; i < 6; i++) cyl(p, 0.9, H / 6, i % 2 ? FM.white : FM.red, x, y + H / 12 + i * H / 6, z, key, null, 12);
  for (let a = 0; a < 3; a++) {
    const ang = a * 2.09;
    link(p, V(x, y + H * 0.7, z), V(x + Math.cos(ang) * 40, y, z + Math.sin(ang) * 40), 0.06, FM.steel, key, 4);
  }
  const flame = new THREE.Group();
  flame.position.set(x, y + H + 0.6, z);
  const fm = (c, o) => new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending});
  const outer = new THREE.Mesh(new THREE.ConeGeometry(2.6, 11, 12, 1, true), fm(0xff6a1a, 0.55));
  outer.position.y = 5.3;
  const inner = new THREE.Mesh(new THREE.ConeGeometry(1.3, 7, 10, 1, true), fm(0xffe08a, 0.85));
  inner.position.y = 3.4;
  flame.add(outer, inner);
  flame.userData.dynamic = true;
  p.add(flame);
  const light = new THREE.PointLight(0xff8a3a, 2.5, 180, 1.6);
  light.position.set(x, y + H + 6, z);
  p.add(light);
  return {update(t) {
    const f = 1 + 0.12 * Math.sin(t * 13) + 0.08 * Math.sin(t * 29 + 1);
    outer.scale.set(f, 1 + 0.18 * Math.sin(t * 7), f);
    inner.scale.set(1 / f, 1 + 0.12 * Math.sin(t * 11 + 2), 1 / f);
    outer.rotation.z = 0.12 * Math.sin(t * 1.7);
    light.intensity = 2.2 + 0.6 * Math.sin(t * 17);
  }};
}
