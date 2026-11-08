// Береговой нефтеналивной терминал (по фото порта): каменная отсыпка берега, дорога,
// трубопроводная эстакада, причал на сваях с эстакадой-подходом, морские стендеры,
// швартовные и отбойные палы с кранцами, резервуарный парк с обвалованием и пожарным кольцом,
// железнодорожный налив, станция налива автоцистерн, ограждение, горы на заднем плане.
// Берег — линия x = 1700, суша в +x. Танкер у причала стоит носом в +z, левым бортом к причалу.
import * as THREE from 'three';
import {setLink, sagPoints} from '../kit/sea.js';
import {makeCoast} from './landscape.js';
import {makeArm} from './loading-arm.js';

export const SHORE_X = 1700;
export const LAND_Y = 3;
export const DECK_Y = 7;                 // верх палубы причала
export const JETTY_FACE_X = 1519.8;       // лицевая грань кранцев
export const BERTH = {pos: new THREE.Vector3(1501.5, 0, 37), rot: Math.PI};
export const ARM_Z = [-10, 0, 10];
const ARM_X = 1528;
const RACK_X = 1767.5, RACK_Y = 9.5;
const COLS = [1870, 1965, 2060];
const ROWS = Array.from({length: 10}, (_, i) => -460 + i * 100);
const TANK_R = 36, TANK_H = 20;
export const TARGET_TANKS = [[0, 4], [0, 5], [0, 6]]; // [колонка, ряд] — принимают нефть с танкера

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.6, metalness: 0.1, ...o});
const C = {
  concrete: mat(0xcfccc3, {roughness: 0.9}), asphalt: mat(0x3a3e43, {roughness: 0.95}), grass: mat(0x8fae5d, {roughness: 1}),
  gravel: mat(0xd9d2bf, {roughness: 1}), white: mat(0xf6f6f2, {roughness: 0.45}), steel: mat(0xc4ced6, {metalness: 0.8, roughness: 0.3}),
  green: mat(0x1fae55, {metalness: 0.3, roughness: 0.4}), yellow: mat(0xffc21a, {roughness: 0.45}), red: mat(0xe8322a, {roughness: 0.45}),
  dark: mat(0x1d1f22, {roughness: 0.8}), blue: mat(0x1d6fe0, {roughness: 0.4}), roof: mat(0x8e959b, {metalness: 0.4, roughness: 0.5}),
  inner: mat(0x5d6368, {roughness: 0.8, side: THREE.BackSide}), glass: mat(0x5aa9e6, {metalness: 0.6, roughness: 0.15}),
  oilPipe: new THREE.MeshStandardMaterial({color: 0xffe08a, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.1, depthWrite: false}),
  rope: mat(0xffd23f, {roughness: 0.8}),
};

function box(w, h, d, m, x, y, z, key) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.userData.key = key;
  return o;
}
function cyl(r, h, m, x, y, z, key, seg = 20) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  o.position.set(x, y, z);
  o.userData.key = key;
  return o;
}
const linkGeo = (r, seg = 12) => new THREE.CylinderGeometry(r, r, 1, seg);
function link(a, b, r, m, key) {
  const o = new THREE.Mesh(linkGeo(r), m);
  setLink(o, a, b);
  o.userData.key = key;
  return o;
}
function tube(points, r, m, key, seg = 120) {
  const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 10), m);
  o.userData.key = key;
  return o;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ======================================================================
export function buildTerminal() {
  const group = new THREE.Group();
  const add = (...o) => group.add(...o);

  // --- Суша, площадки, дороги ---
  const flat = (o) => { o.userData.noCast = true; return o; };
  const pad = (x0, x1, z0, z1, m, y = LAND_Y + 0.05) => add(flat(box(x1 - x0, 0.1, z1 - z0, m, (x0 + x1) / 2, y, (z0 + z1) / 2)));
  pad(1702, 1740, -640, 640, C.gravel);                        // полоса вдоль берега
  pad(1728, 1744, -640, 640, C.asphalt, LAND_Y + 0.1);         // береговая дорога
  pad(1822, 2110, -520, 500, C.gravel);                         // площадка резервуарного парка
  for (const x of [1917.5, 2012.5, 2112]) pad(x - 4, x + 4, -520, 500, C.asphalt, LAND_Y + 0.12);
  pad(1744, 1822, -540, -520, C.asphalt, LAND_Y + 0.12);
  pad(1750, 1792, 30, 95, C.asphalt, LAND_Y + 0.12);            // стоянка у причала
  // Разметка дороги.
  const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.02, 4), mat(0xffffff), 128);
  for (let i = 0; i < 128; i++) dash.setMatrixAt(i, new THREE.Matrix4().makeTranslation(1736, LAND_Y + 0.13, -635 + i * 10));
  add(dash);

  // --- Каменная отсыпка берега ---
  const N = 1500;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, {roughness: 0.95}), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const x = SHORE_X - 14 + rnd() * 16, z = -660 + rnd() * 1320;
    const y = LAND_Y - ((SHORE_X + 2 - x) / 14) * 9 + rnd() * 0.6;
    const r = 1.2 + rnd() * 1.8;
    q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
    rocks.setMatrixAt(i, m4.compose(V(x, y, z), q, s.set(r, r * (0.6 + rnd() * 0.4), r)));
    rocks.setColorAt(i, col.setHSL(0.08 + rnd() * 0.04, 0.12, 0.42 + rnd() * 0.2));
  }
  add(rocks);
  add(box(6, 1, 1320, C.concrete, SHORE_X + 3, LAND_Y + 0.4, 0)); // кромка набережной

  // --- Фонари вдоль дороги ---
  const lampN = 33;
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, 10, 8), C.steel, lampN);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.35, 0.6), mat(0xfff6d0, {emissive: 0xfff2c0, emissiveIntensity: 0.6}), lampN);
  for (let i = 0; i < lampN; i++) {
    const z = -640 + i * 40;
    poles.setMatrixAt(i, m4.makeTranslation(1726, LAND_Y + 5, z));
    heads.setMatrixAt(i, m4.makeTranslation(1727, LAND_Y + 10, z));
  }
  add(poles, heads);

  // --- Трубопроводная эстакада вдоль берега ---
  const rack = new THREE.Group();
  for (let z = -560; z <= 560; z += 10) {
    rack.add(box(0.5, 9.5, 0.5, C.steel, RACK_X - 7, LAND_Y + 4.75, z, 'pipes'), box(0.5, 9.5, 0.5, C.steel, RACK_X + 7, LAND_Y + 4.75, z, 'pipes'));
    rack.add(box(14.5, 0.5, 0.6, C.steel, RACK_X, LAND_Y + 5.5, z, 'pipes'), box(14.5, 0.5, 0.6, C.steel, RACK_X, RACK_Y - 0.6, z, 'pipes'));
  }
  const pipeCols = [C.steel, C.yellow, C.steel, C.white, C.steel, C.red, C.steel, C.blue];
  pipeCols.forEach((m, i) => {
    const x = RACK_X - 6 + (i % 4) * 4, y = i < 4 ? RACK_Y : LAND_Y + 6.3;
    const p = cyl(i < 4 ? 0.55 : 0.4, 1120, m, x, y, 0, 'pipes', 16);
    p.rotation.x = Math.PI / 2;
    rack.add(p);
  });
  add(rack);

  // --- Причал: эстакада-подход, площадка, сваи ---
  const jetty = new THREE.Group();
  add(jetty);
  jetty.add(box(SHORE_X + 2 - 1560, 1.2, 12, C.concrete, (SHORE_X + 2 + 1560) / 2, DECK_Y - 0.6, 0, 'jetty'));
  jetty.add(box(40, 1.6, 56, C.concrete, 1542, DECK_Y - 0.8, 0, 'jetty'));
  const pileGeo = new THREE.CylinderGeometry(0.6, 0.6, 1, 10);
  const piles = [];
  for (let x = 1566; x < SHORE_X; x += 14) piles.push([x, -5], [x, 5]);
  for (let x = 1526; x <= 1558; x += 8) for (let z = -24; z <= 24; z += 8) piles.push([x, z]);
  // Палы: отбойные (с кранцами) и швартовные.
  const breast = [-62, 62], moor = [-175, 175];
  for (const z of breast) {
    jetty.add(box(10, 3, 10, C.concrete, 1526, DECK_Y - 1.5, z, 'jetty'));
    jetty.add(box(1.6, 7, 9, C.dark, 1520.6, 3.5, z, 'jetty'));
    for (const dz of [-3, 3]) for (const dx of [-3, 3]) piles.push([1526 + dx, z + dz]);
  }
  for (const z of [-18, 18]) jetty.add(box(1.6, 6, 7, C.dark, 1520.6, 4, z, 'jetty'));
  for (const z of moor) {
    jetty.add(box(9, 3, 9, C.concrete, 1545, DECK_Y - 1.5, z, 'jetty'));
    for (const dx of [-2, 2]) jetty.add(cyl(0.55, 1.4, C.yellow, 1545 + dx, DECK_Y + 0.7, z, 'jetty', 12)); // гаки
    for (const dz of [-2.5, 2.5]) for (const dx of [-2.5, 2.5]) piles.push([1545 + dx, z + dz]);
  }
  const pileMesh = new THREE.InstancedMesh(pileGeo, C.concrete, piles.length);
  piles.forEach(([x, z], i) => pileMesh.setMatrixAt(i, m4.compose(V(x, -7, z), q.identity(), s.set(1, 26, 1))));
  jetty.add(pileMesh);
  // Мостики между площадкой и палами.
  const walk = (a, b) => {
    jetty.add(link(a, b, 0.7, C.steel, 'jetty'));
    jetty.add(link(a.clone().add(V(0, 1.2, 0.6)), b.clone().add(V(0, 1.2, 0.6)), 0.06, C.yellow, 'jetty'));
    jetty.add(link(a.clone().add(V(0, 1.2, -0.6)), b.clone().add(V(0, 1.2, -0.6)), 0.06, C.yellow, 'jetty'));
  };
  for (const sg of [-1, 1]) {
    walk(V(1530, DECK_Y, 28 * sg), V(1528, DECK_Y, 57 * sg));
    walk(V(1529, DECK_Y, 67 * sg), V(1544, DECK_Y, 170.5 * sg));
  }
  // Перила эстакады.
  for (const z of [-5.8, 5.8]) jetty.add(box(SHORE_X - 1560, 0.12, 0.12, C.yellow, (SHORE_X + 1560) / 2, DECK_Y + 1.1, z, 'jetty'));
  // Операторная, трап-башня, лафетные стволы, мачты освещения.
  jetty.add(box(7, 3.6, 5, C.white, 1553, DECK_Y + 1.8, -20, 'jetty'));
  jetty.add(box(7.1, 1, 5.1, C.glass, 1553, DECK_Y + 2.6, -20, 'jetty'));
  jetty.add(box(7.4, 0.4, 5.4, C.blue, 1553, DECK_Y + 3.8, -20, 'jetty'));
  jetty.add(box(3, 15, 3, C.steel, 1526, DECK_Y + 7.5, 22, 'jetty'));
  jetty.add(box(10, 0.6, 1.8, C.yellow, 1521, DECK_Y + 12, 22, 'jetty'));
  for (const z of [-25, 25]) {
    jetty.add(cyl(0.5, 14, C.red, 1537, DECK_Y + 7, z, 'jetty', 12));
    jetty.add(box(2.4, 1.2, 2.4, C.red, 1537, DECK_Y + 14, z, 'jetty'));
    jetty.add(link(V(1537, DECK_Y + 14.4, z), V(1532, DECK_Y + 15.5, z * 0.8), 0.25, C.red, 'jetty'));
  }
  for (const [x, z] of [[1560, -27], [1560, 27]]) {
    jetty.add(cyl(0.3, 22, C.steel, x, DECK_Y + 11, z, 'jetty', 10));
    jetty.add(box(2.5, 0.6, 1.2, mat(0xfff6d0, {emissive: 0xfff2c0, emissiveIntensity: 0.6}), x - 1, DECK_Y + 22, z, 'jetty'));
  }
  // Трубопроводы по эстакаде от стендеров к берегу и на эстакаду вдоль берега.
  const trunkY = DECK_Y + 0.9;
  const trunk = [V(ARM_X + 4, trunkY, -2), V(1562, trunkY, -2), V(SHORE_X + 2, trunkY, -2), V(1745, trunkY, -2), V(1752, RACK_Y, -2), V(RACK_X - 6, RACK_Y, -2)];
  jetty.add(tube(trunk, 0.75, C.oilPipe, 'pipes', 260));
  jetty.add(tube(trunk.map((p) => p.clone().add(V(0, 0, -2.4))), 0.45, C.steel, 'pipes', 200));
  jetty.add(tube(trunk.map((p) => p.clone().add(V(0, 0, 2.4))), 0.45, C.steel, 'pipes', 200));
  for (let x = SHORE_X + 8; x < 1752; x += 9) jetty.add(box(0.5, trunkY - LAND_Y, 8, C.steel, x, (trunkY + LAND_Y) / 2 - 0.5, -2, 'pipes'));

  // --- Морские стендеры ---
  const arms = ARM_Z.map((z) => makeArm(V(ARM_X, DECK_Y, z)));
  for (const a of arms) { a.group.userData.dynamic = true; jetty.add(a.group); }
  const armsHeader = tube([V(ARM_X + 1.5, DECK_Y + 0.9, -14), V(ARM_X + 1.5, DECK_Y + 0.9, 14)], 0.75, C.oilPipe, 'arms', 20);
  jetty.add(armsHeader, link(V(ARM_X + 1.5, DECK_Y + 0.9, -2), V(ARM_X + 4, trunkY, -2), 0.75, C.oilPipe, 'arms'));

  // --- Резервуарный парк ---
  const tanks = [];
  COLS.forEach((x, ci) => {
    // Обвалование колонки: продольные стенки и поперечные через каждые два резервуара.
    for (const dx of [-44, 44]) add(box(0.6, 2.2, 1000, C.concrete, x + dx, LAND_Y + 1.1, -10, 'farm'));
    for (let z = -510; z <= 490; z += 200) add(box(88, 2.2, 0.6, C.concrete, x, LAND_Y + 1.1, z, 'farm'));
    // Сборный коллектор вдоль колонки.
    const hdr = cyl(0.5, 990, C.steel, x - 41, LAND_Y + 1.2, -10, 'farm', 12);
    hdr.rotation.x = Math.PI / 2;
    add(hdr);
    ROWS.forEach((z, ri) => {
      const target = TARGET_TANKS.some(([c, r]) => c === ci && r === ri);
      const type = target || (ci + ri) % 4 === 1 ? 'floating' : 'dome';
      const t = makeTank(TANK_R, TANK_H, type, target ? 0.3 : 0.25 + rnd() * 0.6, ci === 0 && ri % 3 === 0);
      t.group.position.set(x, LAND_Y + 0.4, z);
      t.group.rotation.y = t.brand ? 0 : rnd() * Math.PI * 2;
      t.group.traverse((o) => (o.userData.key = target ? 'tanks' : 'farm'));
      if (target && t.roof) t.roof.userData.dynamic = true;
      add(t.group);
      add(link(V(x - 41, LAND_Y + 1.2, z), V(x - TANK_R, LAND_Y + 1.2, z), 0.35, C.steel, 'farm'));
      tanks.push({...t, ci, ri, x, z, target});
    });
  });

  // Ветки от эстакады к принимающим резервуарам — по ним идёт нефть.
  const branches = TARGET_TANKS.map(([ci, ri]) => {
    const x = COLS[ci], z = ROWS[ri];
    const pts = [V(RACK_X - 6, RACK_Y, -2), V(RACK_X - 6, RACK_Y, z), V(RACK_X + 8, RACK_Y, z), V(1806, RACK_Y, z), V(1812, LAND_Y + 2, z), V(x - TANK_R - 0.2, LAND_Y + 2, z)];
    add(tube(pts.slice(1), 0.75, C.oilPipe, 'pipes', 120));
    return pts;
  });

  // --- Здания терминала ---
  const bld = (w, h, d, x, z, m = C.white, roofM = C.blue, key = 'farm') => {
    add(box(w, h, d, m, x, LAND_Y + h / 2, z, key), box(w + 0.6, 0.6, d + 0.6, roofM, x, LAND_Y + h + 0.3, z, key));
    add(box(w + 0.05, 1.2, d + 0.05, C.glass, x, LAND_Y + h * 0.6, z, key));
  };
  bld(26, 9, 16, 1800, -20, mat(0xdfe3e6), C.blue, 'pipes'); // насосная станция
  bld(40, 14, 18, 1795, -620);                               // административное здание
  bld(22, 10, 22, 1795, 640, C.red, C.white);                // пожарное депо
  // Машины на стоянке.
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(4.5, 1.6, 2), mat(0xffffff, {metalness: 0.5, roughness: 0.35}), 48);
  for (let i = 0; i < 48; i++) {
    cars.setMatrixAt(i, m4.makeTranslation(1756 + (i % 8) * 4.8, LAND_Y + 0.9, 36 + Math.floor(i / 8) * 9));
    cars.setColorAt(i, col.setHSL(rnd(), rnd() < 0.4 ? 0 : 0.7, rnd() < 0.3 ? 0.9 : 0.25 + rnd() * 0.35));
  }
  add(cars);
  // --- Железнодорожный путь с наливными цистернами и эстакадой налива ---
  const RAIL_X = 1810, RZ0 = -505, RZ1 = -120;
  add(flat(box(7, 0.5, RZ1 - RZ0, C.gravel, RAIL_X, LAND_Y + 0.25, (RZ0 + RZ1) / 2)));
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 0.18, 0.28), mat(0x5a4632, {roughness: 0.95}), Math.round((RZ1 - RZ0) / 0.65));
  for (let i = 0; i < sleepers.count; i++) sleepers.setMatrixAt(i, m4.makeTranslation(RAIL_X, LAND_Y + 0.55, RZ0 + i * 0.65));
  sleepers.userData.noCast = true;
  add(sleepers);
  for (const dx of [-0.76, 0.76]) add(box(0.12, 0.18, RZ1 - RZ0, C.steel, RAIL_X + dx, LAND_Y + 0.73, (RZ0 + RZ1) / 2));
  // Цистерны: котёл, колпак, площадка, тележки.
  const tankCar = (z, color) => {
    const g = new THREE.Group();
    const body = cyl(1.55, 10.6, mat(color, {roughness: 0.45, metalness: 0.3}), 0, 0, 0, undefined, 24);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    for (const dz of [-5.3, 5.3]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), body.material);
      cap.rotation.x = dz > 0 ? Math.PI / 2 : -Math.PI / 2;
      cap.scale.set(1, 0.35, 1);
      cap.position.z = dz;
      g.add(cap);
    }
    g.add(cyl(0.6, 0.7, C.dark, 0, 1.75, 0, undefined, 14));
    g.add(box(2.2, 0.12, 1.6, C.yellow, 0, 1.62, 1.6));
    for (const dz of [-4, 4]) {
      g.add(box(2.6, 0.7, 2.6, C.dark, 0, -1.8, dz));
      for (const wz of [-0.9, 0.9]) for (const wx of [-0.76, 0.76]) {
        const w = cyl(0.45, 0.15, C.dark, wx, -2.05, dz + wz, undefined, 12);
        w.rotation.z = Math.PI / 2;
        g.add(w);
      }
    }
    g.add(box(2.8, 0.25, 12, C.dark, 0, -1.35, 0));
    g.position.set(RAIL_X, LAND_Y + 3.2, z);
    add(g);
  };
  for (let i = 0; i < 18; i++) tankCar(RZ0 + 12 + i * 13.2, [0x1d2025, 0x24282e, 0x3a2c22][i % 3]);
  // Эстакада налива: портал вдоль пути, площадка, откидные мостики и стояки.
  for (let z = RZ0 + 20; z < RZ0 + 220; z += 12) {
    add(box(0.5, 9, 0.5, C.steel, RAIL_X + 4.2, LAND_Y + 4.5, z), box(0.5, 9, 0.5, C.steel, RAIL_X + 7.2, LAND_Y + 4.5, z));
    add(link(V(RAIL_X + 4.2, LAND_Y + 6.2, z), V(RAIL_X + 1.6, LAND_Y + 6.2, z + 1.5), 0.5, C.yellow));
    add(link(V(RAIL_X + 5.5, LAND_Y + 9.5, z), V(RAIL_X + 0.3, LAND_Y + 6.8, z + 2.5), 0.18, C.steel));
  }
  add(box(3.4, 0.4, 200, C.steel, RAIL_X + 5.7, LAND_Y + 6, RZ0 + 120), box(3.6, 0.4, 202, C.blue, RAIL_X + 5.7, LAND_Y + 9.5, RZ0 + 120));
  add(box(0.08, 0.08, 200, C.yellow, RAIL_X + 4.1, LAND_Y + 7.1, RZ0 + 120), box(0.08, 0.08, 200, C.yellow, RAIL_X + 7.3, LAND_Y + 7.1, RZ0 + 120));

  // --- Станция налива автоцистерн: навес, стояки, бензовозы ---
  const AX = 1800, AZ = 410;
  for (const dx of [-14, 14]) for (const dz of [-18, 0, 18]) add(box(0.7, 8, 0.7, C.steel, AX + dx, LAND_Y + 4, AZ + dz));
  add(box(32, 0.8, 42, C.white, AX, LAND_Y + 8.4, AZ), box(32.4, 0.3, 42.4, C.red, AX, LAND_Y + 8.9, AZ));
  add(flat(box(30, 0.12, 40, C.concrete, AX, LAND_Y + 0.12, AZ)));
  const truck = (x, z, color) => {
    const g = new THREE.Group();
    g.add(box(2.5, 2.6, 2.4, mat(color, {roughness: 0.35, metalness: 0.4}), 0, 1.9, -5.6));     // кабина
    g.add(box(2.4, 0.9, 2.3, C.glass, 0, 2.6, -6.25));
    g.add(box(2.4, 0.5, 13, C.dark, 0, 0.8, 0));                                                   // рама
    const tk = cyl(1.25, 9.5, mat(0xd7dde2, {metalness: 0.85, roughness: 0.25}), 0, 2.4, 1.5, undefined, 22);
    tk.rotation.x = Math.PI / 2;
    tk.scale.set(1.05, 1, 0.85);
    g.add(tk);
    for (const dz of [-3, 0, 3, 6]) g.add(new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 6, 24), C.dark).translateY(2.4).translateZ(1.5 + dz * 0.95));
    for (const wz of [-5.4, 1.5, 3.2, 5]) for (const s2 of [-1, 1]) {
      const w = cyl(0.55, 0.45, C.dark, s2 * 1.15, 0.55, wz, undefined, 14);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
    g.position.set(x, LAND_Y, z);
    add(g);
  };
  truck(AX - 7, AZ - 6, 0xd9342b);
  truck(AX + 7, AZ + 4, 0xf2f2ee);
  truck(AX - 7, AZ + 20, 0x1d6fe0);
  for (const dx of [-3.2, 3.2]) for (const dz of [-12, 6]) {
    add(cyl(0.3, 6, C.steel, AX + dx, LAND_Y + 3, AZ + dz, undefined, 10));
    add(link(V(AX + dx, LAND_Y + 6, AZ + dz), V(AX + dx * 1.6, LAND_Y + 4.5, AZ + dz + 1.5), 0.15, C.yellow));
  }

  // --- Кольцевой пожарный водопровод вокруг парка и гидранты ---
  const FX0 = 1822, FX1 = 2108, FZ0 = -516, FZ1 = 496, FY = LAND_Y + 0.9;
  for (const [a, b] of [[V(FX0, FY, FZ0), V(FX1, FY, FZ0)], [V(FX1, FY, FZ0), V(FX1, FY, FZ1)], [V(FX1, FY, FZ1), V(FX0, FY, FZ1)], [V(FX0, FY, FZ1), V(FX0, FY, FZ0)]]) {
    add(link(a, b, 0.32, C.red));
  }
  for (let z = FZ0; z <= FZ1; z += 50) for (const x of [FX0, FX1, 1917.5, 2012.5]) {
    add(cyl(0.35, 1.4, C.red, x + 4.5, LAND_Y + 0.7, z, undefined, 10), cyl(0.5, 0.25, C.yellow, x + 4.5, LAND_Y + 1.45, z, undefined, 10));
  }
  // Лафетные стволы на мачтах между резервуарами.
  for (const x of [1917.5, 2012.5]) for (let z = -410; z <= 440; z += 200) {
    add(cyl(0.35, 12, C.red, x, LAND_Y + 6, z, undefined, 10), box(1.6, 0.9, 1.6, C.red, x, LAND_Y + 12.2, z));
  }

  // --- Ограждение периметра ---
  const FN = [[1745, -560, 2126, -560], [2126, -560, 2126, 560], [2126, 560, 1745, 560]];
  const fenceMat = new THREE.MeshStandardMaterial({color: 0x9aa4ad, transparent: true, opacity: 0.35, roughness: 0.6, side: THREE.DoubleSide, depthWrite: false});
  let posts = 0;
  for (const [x0, z0, x1, z1] of FN) posts += Math.round(Math.hypot(x1 - x0, z1 - z0) / 4) + 1;
  const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), C.steel, posts);
  let pi = 0;
  for (const [x0, z0, x1, z1] of FN) {
    const L2 = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L2 / 4);
    for (let k = 0; k <= n; k++) postMesh.setMatrixAt(pi++, m4.makeTranslation(x0 + ((x1 - x0) * k) / n, LAND_Y + 1.3, z0 + ((z1 - z0) * k) / n));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(L2, 2.4), fenceMat);
    panel.position.set((x0 + x1) / 2, LAND_Y + 1.3, (z0 + z1) / 2);
    panel.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    panel.userData.noCast = true;
    panel.userData.dynamic = true; // прозрачная сетка — отдельно от слияния
    add(panel);
  }
  postMesh.userData.noCast = true;
  add(postMesh);

  // --- Номера на резервуарах (одна текстура-атлас на все) ---
  const atlas = document.createElement('canvas');
  atlas.width = 1024; atlas.height = 512;
  const ag = atlas.getContext('2d');
  ag.font = '800 64px Inter, Segoe UI, sans-serif';
  ag.textAlign = 'center'; ag.textBaseline = 'middle';
  tanks.forEach((tk, i) => {
    const cx = (i % 6) * 170 + 85, cy = Math.floor(i / 6) * 100 + 50;
    ag.fillStyle = '#123a63';
    ag.fillText(`Р-${i + 1}`, cx, cy);
  });
  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 8;
  const numMat = new THREE.MeshStandardMaterial({map: atlasTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2});
  tanks.forEach((tk, i) => {
    const g = new THREE.PlaneGeometry(7.5, 4.4);
    const uv = g.attributes.uv, u0 = (i % 6) * 170 / 1024, v1 = 1 - Math.floor(i / 6) * 100 / 512;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (170 / 1024), v1 - (1 - uv.getY(k)) * (100 / 512));
    const m = new THREE.Mesh(g, numMat);
    m.position.set(tk.x - TANK_R - 0.12, LAND_Y + 14, tk.z + 9);
    m.rotation.y = -Math.PI / 2;
    m.userData.noCast = true;
    m.userData.key = tk.target ? 'tanks' : 'farm';
    add(m);
  });

  // Мол с маяком.
  add(box(18, 6, 600, C.concrete, 1300, 0.5, 1150));
  add(cyl(2.5, 16, C.red, 1300, 11, 860, undefined, 16), cyl(2.6, 3, C.white, 1300, 20.5, 860, undefined, 16));

  const mountains = makeCoast();
  return {group, arms, tanks, branches, trunk, mountains};
}

// ======================================================================
// Вертикальный стальной резервуар. type: 'floating' — открытый верх с плавающей крышей, 'dome' — стационарная крыша.
let shellTex = null, brandTex = null, SHELL_MAT = null, BRAND_MAT = null;
function textures() {
  if (shellTex) return;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#f7f7f3'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = 'rgba(80,90,100,0.35)'; g.fillRect(0, 62, 512, 2);           // горизонтальный шов пояса
  for (let x = 0; x < 512; x += 128) g.fillRect(x + (x % 256 ? 64 : 0), 0, 1.5, 62); // вертикальные швы вразбежку
  g.fillStyle = 'rgba(120,110,90,0.08)'; g.fillRect(0, 40, 512, 22);          // лёгкие подтёки
  shellTex = new THREE.CanvasTexture(cv);
  shellTex.colorSpace = THREE.SRGBColorSpace;
  shellTex.wrapS = shellTex.wrapT = THREE.RepeatWrapping;
  shellTex.repeat.set(8, TANK_H / 2.4);
  shellTex.anisotropy = 8;

  const bc = document.createElement('canvas');
  bc.width = 1024; bc.height = 160;
  const b = bc.getContext('2d');
  b.font = '800 104px Inter, Segoe UI, sans-serif';
  b.textAlign = 'center'; b.textBaseline = 'middle';
  b.fillStyle = '#123a63'; b.fillText('ВОСТОК', 300, 84);
  b.fillStyle = '#f08a12'; b.fillText('ПРОМ', 640, 84);
  b.fillStyle = '#123a63'; b.fillText('ОЙЛ', 880, 84);
  brandTex = new THREE.CanvasTexture(bc);
  brandTex.colorSpace = THREE.SRGBColorSpace;
  brandTex.anisotropy = 8;
}

function makeTank(r, h, type, level, brand) {
  textures();
  const g = new THREE.Group();
  const shellMat = SHELL_MAT ||= new THREE.MeshStandardMaterial({color: 0xffffff, map: shellTex, roughness: 0.45, metalness: 0.1});
  g.add(cyl(r + 1.6, 0.8, C.concrete, 0, 0, 0, undefined, 64));                     // фундаментное кольцо
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, true), shellMat);
  shell.position.y = h / 2 + 0.4;
  g.add(shell);
  const top = h + 0.4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.5, 0.32, 6, 96), C.white);   // кольцо жёсткости
  ring.rotation.x = Math.PI / 2;
  ring.position.y = top - 1.5;
  g.add(ring);
  let roof = null;
  if (type === 'floating') {
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.05, r - 0.05, h, 96, 1, true), C.inner);
    inner.position.y = h / 2 + 0.4;
    roof = new THREE.Group();
    roof.add(new THREE.Mesh(new THREE.CylinderGeometry(r - 0.7, r - 0.7, 0.9, 96), C.roof));
    const pont = new THREE.Mesh(new THREE.TorusGeometry(r - 3, 0.6, 8, 96), mat(0xaab1b7, {metalness: 0.4}));
    pont.rotation.x = Math.PI / 2;
    pont.position.y = 0.6;
    roof.add(pont);
    roof.add(cyl(1.5, 1.2, mat(0x6f777e), 0, 0.8, 0, undefined, 16));
    g.add(inner, roof);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 4, 96), C.yellow);       // перила по верху
    rail.rotation.x = Math.PI / 2;
    rail.position.y = top + 1.1;
    g.add(rail);
  } else {
    const hd = 3.2, Rs = (r * r + hd * hd) / (2 * hd);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(Rs, 96, 16, 0, Math.PI * 2, 0, Math.asin(r / Rs)), C.white);
    dome.position.y = top + hd - Rs;
    g.add(dome);
    g.add(cyl(1.2, 1.4, C.steel, r * 0.5, top + 2.4, 0, undefined, 12));               // дыхательный клапан
  }
  // Винтовая лестница по стенке.
  const a0 = 0.4, a1 = 1.7, R = r + 1.2;
  const helix = (dr, dy) => Array.from({length: 40}, (_, i) => {
    const k = i / 39, a = a0 + (a1 - a0) * k;
    return V(Math.sin(a) * (R + dr), 0.6 + k * (top - 0.6) + dy, Math.cos(a) * (R + dr));
  });
  g.add(tube(helix(0, 0), 0.5, C.yellow, undefined, 80), tube(helix(0.6, 1.1), 0.07, C.yellow, undefined, 80));
  const landing = box(3, 0.3, 3, C.yellow, Math.sin(a1) * R, top + 0.1, Math.cos(a1) * R);
  g.add(landing);
  // Пенокамеры пожаротушения по верхнему поясу.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.2;
    g.add(box(1, 1.4, 1, C.red, Math.sin(a) * (r + 0.6), top - 0.6, Math.cos(a) * (r + 0.6)));
  }
  // Фирменная надпись.
  if (brand) {
    const decal = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.06, r + 0.06, 7, 48, 1, true, Math.PI * 1.5 - 0.62, 1.24),
      BRAND_MAT ||= new THREE.MeshStandardMaterial({map: brandTex, transparent: true, roughness: 0.5}),
    );
    decal.position.y = h * 0.55;
    g.add(decal);
  }
  const setLevel = (k) => { if (roof) roof.position.y = 0.9 + k * (h - 2); };
  setLevel(level);
  return {group: g, roof, setLevel, type, brand};
}

// ======================================================================
// Швартовные концы от танкера у причала к палам. set(k): 0 — не заведены, 1 — все заведены.
export function makeMooring(tanker) {
  const group = new THREE.Group();
  tanker.updateMatrixWorld(true);
  const w = (x, y, z) => tanker.localToWorld(V(x, y, z));
  const lines = [
    [w(-6, 9.5, -84), V(1545, DECK_Y + 1.2, 175)], [w(-8, 9.5, -78), V(1545, DECK_Y + 1.2, 173)],
    [w(-14, 9, -50), V(1526, DECK_Y + 0.5, 62)], [w(-14, 9, 100), V(1526, DECK_Y + 0.5, -62)],
    [w(-8, 10, 150), V(1545, DECK_Y + 1.2, -173)], [w(-6, 10, 156), V(1545, DECK_Y + 1.2, -175)],
  ].map(([a, b]) => {
    const m = tube(sagPoints(a, b, 1.6, 24), 0.22, C.rope, 'mooring', 60);
    group.add(m);
    return m;
  });
  const set = (k) => lines.forEach((m, i) => {
    const ki = THREE.MathUtils.clamp(k * lines.length - i, 0, 1);
    m.visible = ki > 0;
    m.geometry.setDrawRange(0, Math.round((m.geometry.index.count * ki) / 6) * 6);
  });
  set(0);
  return {group, set};
}
