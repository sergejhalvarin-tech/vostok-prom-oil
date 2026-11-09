// Терминал приёмки сырья НПЗ — конечная точка железной дороги:
//  • сливная эстакада вдоль пути: галерея, устройства нижнего слива у каждой цистерны, коллектор в лотке;
//  • приёмная насосная, резервуары сырой нефти в обваловании, подстанция, пожарная станция;
//  • за терминалом — установки завода: АВТ (печь, атмосферная и вакуумная колонны), риформинг,
//    шаровые резервуары газа, эстакады трубопроводов, факел с живым пламенем.
import * as THREE from 'three';
import {heightAt, railAt, REFINERY} from './landscape.js';
import {makeTank} from './terminal.js';
import {pipe, valve, buildLightningRod, FARM_MAT as M} from './tankfarm.js';
import {FM, box, cyl, link, building, substation, fireStation, lightMast, roads, column, furnace, pipeRack, flare, vessel, powerLine} from './facilities.js';
import {RAIL_TOP, LOCO_LEN, CAR} from './train.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildRefinery(p, {sStop, cars = 20}) {
  const k = 'refinery', kr = 'unload';
  const {x: cx, z: cz} = REFINERY;
  const y = heightAt(cx, cz);
  box(p, REFINERY.w - 40, 0.12, REFINERY.d - 40, new THREE.MeshStandardMaterial({color: 0x86837c, roughness: 1}), cx, y + 0.06, cz, k).userData.noCast = true;

  // ---------- сливная эстакада вдоль стоянки состава ----------
  const a = {};
  const carX = [];
  for (let i = 0; i < cars; i++) { railAt(sStop - LOCO_LEN - 0.3 - (i + 0.5) * CAR, a); carX.push({x: a.x, z: a.z}); }
  const X0 = carX[cars - 1].x - 10, X1 = carX[0].x + 8, TZ = carX[0].z;
  const GZ = TZ - 5.2, deckY = y + 5.4;
  box(p, X1 - X0, 0.2, 2.6, new THREE.MeshStandardMaterial({color: 0x9aa2a8, metalness: 0.5, roughness: 0.5}), (X0 + X1) / 2, deckY, GZ, kr);
  for (let x = X0; x <= X1; x += 12) {
    for (const dz of [-1.1, 1.1]) box(p, 0.35, deckY - y, 0.35, FM.yellow, x, y + (deckY - y) / 2, GZ + dz, kr);
    box(p, 0.3, 0.3, 2.6, FM.yellow, x, deckY - 1.6, GZ, kr);
  }
  for (const dz of [-1.25, 1.25]) {
    box(p, X1 - X0, 0.07, 0.07, FM.steel, (X0 + X1) / 2, deckY + 1.1, GZ + dz, kr);
    for (let x = X0; x <= X1; x += 2) box(p, 0.05, 1.1, 0.05, FM.steel, x, deckY + 0.55, GZ + dz, kr);
  }
  // Навес над галереей.
  box(p, X1 - X0 + 4, 0.25, 9, new THREE.MeshStandardMaterial({color: 0x2f6fc0, roughness: 0.5}), (X0 + X1) / 2, deckY + 4.2, GZ - 1.5, kr);
  for (let x = X0; x <= X1; x += 24) box(p, 0.3, 4.2, 0.3, FM.steel, x, deckY + 2.1, GZ - 4.5, kr);
  // Лоток с коллектором между рельсами и устройства нижнего слива у каждой цистерны.
  box(p, X1 - X0, 0.3, 1.2, FM.concrete, (X0 + X1) / 2, y + 0.2, TZ, kr);
  const colY = y + 0.9, colZ = GZ - 3.2;
  pipe(p, [V(X1, colY, colZ), V(X0 + 4, colY, colZ)], 0.45, M.oilGlass, kr, {ground: y});
  for (const c of carX) {
    pipe(p, [V(c.x, y + 1.1, TZ - 0.5), V(c.x, y + 1.1, TZ - 2.2), V(c.x, colY, colZ + 0.4)], 0.12, FM.yellow, kr, {supports: false, R: 0.5});
    valve(p, V(c.x, colY + 0.1, colZ + 1.6), 'z', 0.18, kr);
    box(p, 1.2, 1.6, 0.8, new THREE.MeshStandardMaterial({color: 0x2a9fd8}), c.x + 4, y + 0.9, GZ - 0.6, kr);
  }
  // Упор в конце пути.
  railAt(sStop + 40, a);
  box(p, 3.4, 1.4, 1.2, FM.red, a.x, a.y + 1.2, a.z, kr, Math.PI / 2);
  for (let i = 0; i < 4; i++) box(p, 0.5, 0.6, 1.25, FM.white, a.x, a.y + 1.2, a.z - 1.3 + i * 0.85, kr);
  box(p, 2.8, 0.6, 2.6, FM.dark, a.x - 1.6, a.y + 0.6, a.z, kr);

  // ---------- приёмная насосная и резервуары сырой нефти ----------
  building(p, {x: X0 - 40, y, z: GZ - 22, w: 30, d: 14, h: 8, key: k, floors: 1});
  pipe(p, [V(X0 + 4, colY, colZ), V(X0 - 18, colY, colZ), V(X0 - 18, colY, GZ - 16)], 0.45, M.oilGlass, k, {ground: y});
  const tanks = [];
  for (let i = 0; i < 4; i++) for (const dz of [160, 240]) tanks.push([-430 + i * 62, dz - 200]);
  const tankPts = [];
  for (const [dx, dz] of tanks) {
    const t = makeTank(24, 17, 'floating', 0.55, false);
    t.group.position.set(cx + dx, y + 0.3, cz + dz + 200);
    t.group.traverse((o) => (o.userData.key = k));
    p.add(t.group);
    tankPts.push(V(cx + dx, y, cz + dz + 200));
  }
  for (const [x0, x1, z0, z1] of [[cx - 462, cx - 212, cz + 128, cz + 274]]) {
    for (const [A, B] of [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]]) {
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      box(p, len, 1.8, 0.6, FM.concrete, (A[0] + B[0]) / 2, y + 0.9, (A[1] + B[1]) / 2, k, Math.atan2(-(B[1] - A[1]), B[0] - A[0]));
    }
  }
  const PY = y + 1.6;
  const feed = [V(X0 - 40, PY, GZ - 30), V(X0 - 40, PY, cz + 320), V(cx - 306, PY, cz + 320), V(cx - 306, PY, cz + 266)];
  pipe(p, feed, 0.5, M.oilGlass, k, {ground: y, R: 1.6});
  // Из резервуаров — на установки.
  pipe(p, [V(cx - 250, PY, cz + 122), V(cx - 250, PY, cz + 70), V(cx - 180, PY, cz + 70), V(cx - 180, PY, cz - 10)], 0.5, FM.steel, k, {ground: y, R: 1.6});

  // ---------- установки завода ----------
  const U = (dx, dz) => [cx + dx, cz + dz];
  // АВТ.
  {
    const [ux, uz] = U(-180, -90);
    furnace(p, {x: ux - 40, y, z: uz, key: k});
    column(p, {x: ux, y, z: uz - 6, r: 3.2, h: 52, key: k, platforms: 7});
    column(p, {x: ux + 16, y, z: uz - 6, r: 4.6, h: 34, key: k, platforms: 5});
    for (let i = 0; i < 3; i++) column(p, {x: ux + 30 + i * 7, y, z: uz - 10, r: 1.4, h: 26 - i * 3, key: k, platforms: 3});
    for (let i = 0; i < 6; i++) vessel(p, {x: ux + 10, y, z: uz + 16 + i * 4.5, r: 1.1, len: 9, key: k, m: FM.alu});
    box(p, 34, 0.3, 14, FM.yellow, ux + 22, y + 9, uz + 26, k);
    for (const [ox, oz] of [[-16, -6], [16, -6], [-16, 6], [16, 6]]) box(p, 0.5, 9, 0.5, FM.yellow, ux + 22 + ox, y + 4.5, uz + 26 + oz, k);
    for (let i = 0; i < 6; i++) box(p, 4, 2.4, 4, FM.dark, ux + 7 + i * 5.5, y + 10.5, uz + 26, k);           // АВО
  }
  // Риформинг: реакторы-шары, колонна, печь.
  {
    const [ux, uz] = U(20, -90);
    furnace(p, {x: ux, y, z: uz + 24, key: k, ry: Math.PI / 2});
    for (let i = 0; i < 3; i++) {
      const sx = ux + 30 + i * 12;
      cyl(p, 3, 18, FM.alu, sx, y + 9, uz, k, null, 22);
      const s = new THREE.Mesh(new THREE.SphereGeometry(3, 18, 10), FM.alu);
      s.position.set(sx, y + 18, uz);
      s.userData.key = k;
      p.add(s);
    }
    column(p, {x: ux + 72, y, z: uz + 8, r: 2.6, h: 44, key: k, platforms: 6});
  }
  // Шаровые резервуары сжиженного газа.
  for (let i = 0; i < 3; i++) {
    const [sx, sz] = U(200 + i * 26, -170);
    const sp = new THREE.Mesh(new THREE.SphereGeometry(9, 28, 16), FM.white);
    sp.position.set(sx, y + 13, sz);
    sp.userData.key = k;
    p.add(sp);
    for (let j = 0; j < 8; j++) {
      const ang = j / 8 * Math.PI * 2;
      link(p, V(sx + Math.cos(ang) * 8.2, y, sz + Math.sin(ang) * 8.2), V(sx + Math.cos(ang) * 8.6, y + 13, sz + Math.sin(ang) * 8.6), 0.35, FM.steel, k);
    }
    link(p, V(sx + 9, y, sz), V(sx + 2, y + 21, sz), 0.4, FM.yellow, k);
  }
  // Эстакады трубопроводов.
  pipeRack(p, {x0: cx - 240, z0: cz - 20, x1: cx + 160, z1: cz - 20, y, key: k});
  pipeRack(p, {x0: cx + 160, z0: cz - 180, x1: cx + 160, z1: cz - 20, y, key: k});
  pipeRack(p, {x0: cx - 180, z0: cz - 20, x1: cx - 180, z1: cz + 70, y, key: k, levels: [6]});
  // Градирни (вентиляторные).
  for (let i = 0; i < 4; i++) {
    const [gx, gz] = U(-60 + i * 18, -200);
    box(p, 16, 10, 16, FM.wall2, gx, y + 5, gz, k);
    cyl(p, 6, 3, FM.tgrey, gx, y + 11.5, gz, k, null, 24);
  }
  const fl = flare(p, {x: cx + 470, y, z: cz - 300, H: 90, key: k});
  // Плотная застройка завода: технологические установки на сетке участков.
  const busy = [[cx + 470, cz - 300, 70], [cx - 33, cz - 200, 50], [cx + 226, cz - 170, 40], [cx - 450, cz - 120, 40], [cx - 180, cz - 90, 70], [cx + 20, cz - 90, 70], [cx - 60, cz - 330, 6], [cx + 140, cz - 360, 6]];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let gx = cx - 500; gx <= cx + 440; gx += 72) for (let gz = cz - 380; gz <= cz - 150; gz += 64) {
    if (busy.some(([bx, bz, rr]) => Math.hypot(gx - bx, gz - bz) < rr + 30)) continue;
    plotUnit(p, gx, y, gz, rnd, k);
  }
  for (let gx = cx - 160; gx <= cx + 20; gx += 72) for (let gz = cz + 100; gz <= cz + 260; gz += 80) plotUnit(p, gx, y, gz, rnd, k);
  // Товарный парк: резервуары нефтепродуктов.
  for (let i = 0; i < 6; i++) {
    const t = makeTank(14, 14, i % 2 ? 'dome' : 'floating', 0.6, false);
    t.group.position.set(cx + 240 + (i % 3) * 40, y + 0.3, cz - 40 + Math.floor(i / 3) * 44);
    t.group.traverse((o) => (o.userData.key = k));
    p.add(t.group);
  }
  // Высокие дымовые трубы — силуэт завода.
  for (const [dx, dz, H] of [[-60, -330, 120], [140, -360, 100]]) {
    for (let i = 0; i < 8; i++) cyl(p, 3.4 - i * 0.18, H / 8, i % 2 ? FM.white : FM.red, cx + dx, y + H / 16 + i * H / 8, cz + dz, k, null, 20, 3.4 - (i + 1) * 0.18);
  }
  // Административный корпус, подстанция, пожарная станция, ЛЭП.
  building(p, {x: cx - 450, y, z: cz - 120, w: 46, d: 16, h: 13, key: k, floors: 3});
  substation(p, {x: cx + 80, y, z: cz + 180, key: k});
  fireStation(p, {x: cx + 260, y, z: cz + 150, key: k});
  powerLine(p, [[cx + 80, y, cz + 200 + 260], [cx + 80, heightAt(cx + 80, cz + 900), cz + 900], [cx + 140, heightAt(cx + 140, cz + 1500), cz + 1500]].map(([px, py, pz], i) => [px, i ? py : y, pz]), k);
  // Дороги, мачты освещения, молниеотводы.
  roads(p, y, [[cx - 520, cz + 300, cx + 520, cz + 300], [cx - 520, cz - 425, cx + 520, cz - 425], [cx - 520, cz - 425, cx - 520, cz + 300], [cx + 400, cz - 425, cx + 400, cz + 300]], k);
  for (const [dx, dz] of [[-420, 290], [-100, 290], [200, 290], [400, 100], [-420, -80], [0, -240], [300, -240]]) lightMast(p, cx + dx, y, cz + dz, 26, k);
  for (const [dx, dz] of [[-470, 290], [-200, 290], [-470, 110], [-200, 110]]) buildLightningRod(p, cx + dx, cz + dz, 46, y);
  // Ограждение.
  const hw = REFINERY.w / 2 - 22, hd = REFINERY.d / 2 - 22;
  const fence = new THREE.MeshStandardMaterial({color: 0x9aa4ad, transparent: true, opacity: 0.35, depthWrite: false});
  for (const [w, d, ox, oz] of [[hw * 2, 0.06, 0, -hd], [hw * 2, 0.06, 0, hd + 40], [0.06, hd + 380, -hw, (380 - hd) / 2], [0.06, hd * 2 + 40, hw, 20]]) {
    const f = box(p, w, 2.4, d, fence, cx + ox, y + 1.2, cz + oz);
    f.userData.dynamic = true;
  }
  // Путь нефти: из цистерн — в коллектор, в насосную и в резервуар.
  const c0 = carX[6];
  const flowPts = [V(c0.x, y + 1.1, TZ - 0.5), V(c0.x, colY, colZ + 0.4), V(X0 - 18, colY, colZ), ...feed.slice(0)];
  return {update: (t) => fl.update(t), flow: flowPts, y, rack: {X0, X1, TZ}};
}

// Технологический участок: этажерка с оборудованием, колонны, реакторы, печь или АВО — по жребию.
function plotUnit(p, x, y, z, rnd, k) {
  const kind = Math.floor(rnd() * 4);
  const frame = (fx, fz, w, d, lv) => {
    const m = rnd() < 0.5 ? FM.yellow : FM.green;
    for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]]) box(p, 0.5, lv * 6, 0.5, m, fx + ox, y + lv * 3, fz + oz, k);
    for (let i = 1; i <= lv; i++) {
      box(p, w + 0.6, 0.25, d + 0.6, FM.tgrey, fx, y + i * 6, fz, k);
      box(p, w + 0.6, 0.06, 0.06, m, fx, y + i * 6 + 1.1, fz + d / 2 + 0.3, k);
      for (let j = 0; j < 3; j++) vessel(p, {x: fx - w / 3 + j * w / 3, y: y + i * 6 + 0.1, z: fz, r: 0.8 + rnd() * 0.5, len: 3 + rnd() * 2, key: k, m: rnd() < 0.5 ? FM.alu : FM.white});
    }
  };
  box(p, 60, 0.15, 50, FM.concrete, x, y + 0.08, z, k).userData.noCast = true;
  if (kind === 0) {
    frame(x - 12, z, 22, 12, 3);
    column(p, {x: x + 12, y, z: z - 8, r: 2 + rnd() * 1.6, h: 30 + rnd() * 30, key: k, platforms: 5});
    column(p, {x: x + 20, y, z: z + 10, r: 1.4 + rnd(), h: 22 + rnd() * 18, key: k, platforms: 4});
  } else if (kind === 1) {
    furnace(p, {x: x - 10, y, z, key: k, ry: rnd() < 0.5 ? 0 : Math.PI / 2});
    column(p, {x: x + 18, y, z: z + 4, r: 2.4 + rnd(), h: 36 + rnd() * 20, key: k, platforms: 6});
  } else if (kind === 2) {
    for (let i = 0; i < 3; i++) {
      const rx = x - 16 + i * 14, rr = 2.6 + rnd() * 1.2, hh = 16 + rnd() * 14;
      cyl(p, rr, hh, FM.alu, rx, y + 2 + hh / 2, z - 6, k, null, 22);
      const d = new THREE.Mesh(new THREE.SphereGeometry(rr, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), FM.alu);
      d.position.set(rx, y + 2 + hh, z - 6);
      d.userData.key = k;
      p.add(d);
    }
    frame(x, z + 14, 30, 10, 2);
  } else {
    for (let i = 0; i < 4; i++) vessel(p, {x: x - 14 + i * 9, y, z: z - 10, r: 1.4 + rnd() * 0.8, len: 10, ry: Math.PI / 2, key: k, m: FM.white});
    column(p, {x: x + 18, y, z: z + 10, r: 1.8 + rnd(), h: 26 + rnd() * 20, key: k, platforms: 4});
    box(p, 30, 0.3, 10, FM.tgrey, x - 4, y + 8, z + 12, k);
    for (let i = 0; i < 5; i++) box(p, 4, 2.2, 4, FM.dark, x - 16 + i * 6, y + 9.4, z + 12, k);
    for (const [ox, oz] of [[-19, 7], [11, 7], [-19, 17], [11, 17]]) box(p, 0.5, 8, 0.5, FM.yellow, x + ox, y + 4, z + oz, k);
  }
}
