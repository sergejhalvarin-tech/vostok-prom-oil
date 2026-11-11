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

  // ---------- компактный завод: всё в местных координатах от центра площадки ----------
  const P = (dx, dz) => [cx + dx, cz + dz];
  const PY = y + 1.6;
  // Приёмная насосная у западного конца эстакады и коллектор к резервуарам сырой нефти.
  building(p, {x: X0 - 40, y, z: GZ - 22, w: 30, d: 14, h: 8, key: k, floors: 1, wall: FM.white, trim: FM.blue});
  pipe(p, [V(X0 + 4, colY, colZ), V(X0 - 18, colY, colZ), V(X0 - 18, colY, GZ - 16)], 0.45, M.oilGlass, k, {ground: y});
  const feed = [V(X0 - 40, PY, GZ - 30), V(X0 - 40, PY, cz + 248), V(cx - 275, PY, cz + 248), V(cx - 275, PY, cz + 214)];
  pipe(p, feed, 0.5, M.oilGlass, k, {ground: y, R: 1.6});
  for (const dx of [-330, -275, -220]) for (const dz of [140, 195]) {
    const t = makeTank(18, 15, 'floating', 0.6, false);
    t.group.position.set(cx + dx, y + 0.3, cz + dz);
    t.group.traverse((o) => (o.userData.key = k));
    p.add(t.group);
  }
  for (const [A, B] of [[[-356, 112], [-194, 112]], [[-194, 112], [-194, 222]], [[-194, 222], [-356, 222]], [[-356, 222], [-356, 112]]]) {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    box(p, len, 1.8, 0.6, FM.concrete, cx + (A[0] + B[0]) / 2, y + 0.9, cz + (A[1] + B[1]) / 2, k, Math.atan2(-(B[1] - A[1]), B[0] - A[0]));
  }
  pipe(p, [V(cx - 275, PY, cz + 112), V(cx - 275, PY, cz + 80), V(cx - 230, PY, cz + 80), V(cx - 230, PY, cz + 5)], 0.5, FM.steel, k, {ground: y, R: 1.6});

  // Яркие материалы установок.
  const BR = {
    blue: new THREE.MeshStandardMaterial({color: 0x1f6fe0, roughness: 0.45, metalness: 0.3}),
    green: new THREE.MeshStandardMaterial({color: 0x23a05a, roughness: 0.45, metalness: 0.3}),
    white: new THREE.MeshStandardMaterial({color: 0xf6f7f5, roughness: 0.35, metalness: 0.2}),
  };
  // Этажерка: стойки, перекрытия с ограждением, лестница, оборудование на ярусах.
  const frame = (fx, fz, w, d, lv, m) => {
    for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]]) box(p, 0.5, lv * 6, 0.5, m, fx + ox, y + lv * 3, fz + oz, k);
    for (let i = 1; i <= lv; i++) {
      box(p, w + 0.6, 0.25, d + 0.6, FM.tgrey, fx, y + i * 6, fz, k);
      for (const s2 of [-1, 1]) box(p, w + 0.6, 0.06, 0.06, FM.yellow, fx, y + i * 6 + 1.1, fz + s2 * (d / 2 + 0.3), k);
      for (let j = 0; j < 3; j++) vessel(p, {x: fx - w / 3 + j * w / 3, y: y + i * 6 + 0.1, z: fz, r: 0.75 + (j % 2) * 0.35, len: 3.5 + j, key: k, m: j % 2 ? BR.white : FM.alu});
    }
    for (let i = 0; i < lv * 6; i += 0.6) box(p, 0.9, 0.06, 0.25, FM.yellow, fx + w / 2 + 0.9, y + i + 0.3, fz - d / 2 + 1 + ((i * 0.4) % (d - 2)), k);
  };
  // Пучок цветных трубопроводов по осям.
  const cols = [0xf6f7f5, 0x1f6fe0, 0xffc21f, 0x23a05a, 0xe8541e, 0x9aa4ab];
  const bundle = (pts, n = 4, y0 = 7) => {
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 0.9;
      const m = new THREE.MeshStandardMaterial({color: cols[i % cols.length], metalness: 0.5, roughness: 0.35});
      pipe(p, pts.map(([x, z]) => V(x + o * 0.3, y + y0 + i * 0.05, z + o)), 0.28 + (i % 2) * 0.12, m, k, {supports: false, R: 2});
    }
  };
  // АВТ: печь, атмосферная и вакуумная колонны, стриппинги, АВО.
  {
    const [ux, uz] = P(-230, 30);
    furnace(p, {x: ux - 20, y, z: uz, key: k});
    column(p, {x: ux + 22, y, z: uz + 14, r: 3.0, h: 50, key: k, platforms: 7, m: BR.white});
    column(p, {x: ux + 38, y, z: uz + 14, r: 4.3, h: 32, key: k, platforms: 5});
    for (let i = 0; i < 3; i++) column(p, {x: ux + 50 + i * 6, y, z: uz + 6, r: 1.3, h: 24 - i * 3, key: k, platforms: 3, m: i % 2 ? BR.white : FM.alu});
    frame(ux + 30, uz + 42, 30, 12, 2, FM.yellow);
    for (let i = 0; i < 5; i++) box(p, 4, 2.2, 4, FM.dark, ux + 18 + i * 6, y + 13.2, uz + 42, k);
  }
  // Риформинг: печь, реакторы на колоннах, стабилизационная колонна.
  {
    const [ux, uz] = P(-80, 30);
    furnace(p, {x: ux, y, z: uz, key: k, ry: Math.PI / 2});
    for (let i = 0; i < 3; i++) {
      const sx = ux + 22 + i * 11;
      cyl(p, 2.8, 16, BR.white, sx, y + 8, uz + 2, k, null, 22);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 10), BR.white);
      sp.position.set(sx, y + 16, uz + 2); sp.userData.key = k; p.add(sp);
      box(p, 6, 0.3, 6, FM.yellow, sx, y + 12, uz + 2, k);
    }
    column(p, {x: ux + 62, y, z: uz + 20, r: 2.4, h: 42, key: k, platforms: 6});
    frame(ux + 34, uz + 30, 26, 10, 3, BR.blue);
  }
  // Гидрокрекинг: толстостенные реакторы, колонна, этажерка, печь.
  {
    const [ux, uz] = P(70, 30);
    for (let i = 0; i < 3; i++) column(p, {x: ux + i * 13, y, z: uz, r: 3.3, h: 30, key: k, platforms: 4, m: BR.white});
    column(p, {x: ux + 48, y, z: uz + 22, r: 2.6, h: 46, key: k, platforms: 6});
    frame(ux + 18, uz + 30, 34, 12, 3, BR.green);
    furnace(p, {x: ux + 70, y, z: uz, key: k, ry: Math.PI / 2});
  }
  // Межустановочная эстакада и обвязка.
  pipeRack(p, {x0: cx - 300, z0: cz - 8, x1: cx + 250, z1: cz - 8, y, key: k});
  pipeRack(p, {x0: cx + 110, z0: cz - 8, x1: cx + 110, z1: cz + 205, y, key: k, levels: [6]});
  bundle([[cx - 200, cz + 30], [cx - 200, cz - 8], [cx - 100, cz - 8]], 3);
  bundle([[cx - 40, cz + 30], [cx - 40, cz - 8], [cx + 60, cz - 8]], 3, 8);
  bundle([[cx + 100, cz + 30], [cx + 100, cz - 8], [cx + 140, cz - 8]], 3, 9);
  // Дымовые трубы печей — красно-белые.
  for (const [dx, dz, H] of [[-250, -35, 90], [-60, -38, 80], [150, -36, 76]]) {
    for (let i = 0; i < 8; i++) cyl(p, 2.8 - i * 0.15, H / 8, i % 2 ? FM.white : FM.red, cx + dx, y + H / 16 + i * H / 8, cz + dz, k, null, 20, 2.8 - (i + 1) * 0.15);
  }
  // Градирни.
  for (let i = 0; i < 4; i++) {
    const [gx, gz] = P(-330 + i * 22, -235);
    box(p, 18, 11, 18, BR.blue, gx, y + 5.5, gz, k);
    cyl(p, 6.5, 3, FM.tgrey, gx, y + 12.5, gz, k, null, 24);
    box(p, 18.4, 0.6, 18.4, FM.white, gx, y + 11, gz, k);
  }
  // Шаровые резервуары газа: белые с синим поясом.
  for (let i = 0; i < 3; i++) {
    const [sx, sz] = P(150 + i * 26, -225);
    const sp = new THREE.Mesh(new THREE.SphereGeometry(9, 28, 16), BR.white);
    sp.position.set(sx, y + 13, sz); sp.userData.key = k; p.add(sp);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(9.05, 0.5, 6, 40), BR.blue);
    belt.rotation.x = Math.PI / 2; belt.position.set(sx, y + 13, sz); belt.userData.key = k; p.add(belt);
    for (let j = 0; j < 8; j++) {
      const ang = (j / 8) * Math.PI * 2;
      link(p, V(sx + Math.cos(ang) * 8.2, y, sz + Math.sin(ang) * 8.2), V(sx + Math.cos(ang) * 8.6, y + 13, sz + Math.sin(ang) * 8.6), 0.35, FM.steel, k);
    }
    link(p, V(sx + 9, y, sz), V(sx + 2, y + 21, sz), 0.35, FM.yellow, k);
  }
  // Товарный парк.
  for (let i = 0; i < 8; i++) {
    const t = makeTank(12, 13, i % 2 ? 'dome' : 'floating', 0.6, false);
    t.group.position.set(cx - 150 + (i % 4) * 32, y + 0.3, cz - 205 + Math.floor(i / 4) * 34);
    t.group.traverse((o) => (o.userData.key = k));
    p.add(t.group);
  }
  const fl = flare(p, {x: cx + 335, y, z: cz - 265, H: 75, key: k});
  // Технологические участки в оставшихся местах — плотная застройка.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [dx, dz] of [[190, 40], [270, 40], [190, -120], [270, -120], [-330, -120], [-250, -120], [-170, -120]]) plotUnit(p, cx + dx, y, cz + dz, rnd, k);
  // Операторная, администрация, подстанция, пожарная станция.
  building(p, {x: cx + 300, y, z: cz + 150, w: 40, d: 14, h: 12, key: k, floors: 3, wall: FM.white, trim: FM.blue});
  building(p, {x: cx - 120, y, z: cz + 150, w: 34, d: 12, h: 7, key: k, floors: 2, wall: FM.white, trim: FM.red});
  substation(p, {x: cx + 20, y, z: cz + 165, key: k});
  fireStation(p, {x: cx + 220, y, z: cz + 170, key: k});
  // Газоны между установками.
  const lawn = new THREE.MeshStandardMaterial({color: 0x5fbf45, roughness: 1});
  for (const [dx, dz, w, d] of [[-120, -95, 120, 50], [60, -95, 140, 50], [-290, 70, 80, 40], [300, 220, 120, 50], [-60, 210, 100, 40], [330, -200, 60, 120]]) {
    box(p, w, 0.15, d, lawn, cx + dx, y + 0.1, cz + dz, k).userData.noCast = true;
  }
  // Дороги, мачты освещения, молниеотводы, ограждение.
  roads(p, y, [[cx - 370, cz + 100, cx + 370, cz + 100], [cx - 370, cz - 60, cx + 370, cz - 60], [cx - 370, cz - 285, cx + 370, cz - 285],
    [cx - 370, cz - 285, cx - 370, cz + 230], [cx + 370, cz - 285, cx + 370, cz + 230], [cx - 20, cz - 285, cx - 20, cz - 60]], k);
  for (const [dx, dz] of [[-360, 230], [-120, 100], [120, 100], [360, 100], [-360, -60], [0, -60], [360, -60], [-200, -285], [200, -285]]) lightMast(p, cx + dx, y, cz + dz, 26, k);
  for (const [dx, dz] of [[-362, 230], [-188, 230], [-362, 106], [-188, 106]]) buildLightningRod(p, cx + dx, cz + dz, 44, y);
  const hw = REFINERY.w / 2 - 8, hd = REFINERY.d / 2 - 8;
  const fence = new THREE.MeshStandardMaterial({color: 0x9aa4ad, transparent: true, opacity: 0.35, depthWrite: false});
  for (const [w, d, ox, oz] of [[hw * 2, 0.06, 0, -hd], [hw * 2, 0.06, 0, hd + 30], [0.06, hd * 2 - 30, -hw, -15], [0.06, hd * 2 + 30, hw, 15]]) {
    const f = box(p, w, 2.4, d, fence, cx + ox, y + 1.2, cz + oz);
    f.userData.dynamic = true;
  }
  // Путь нефти: из цистерн — в коллектор, в насосную и в резервуар.
  const c0 = carX[6];
  const flowPts = [V(c0.x, y + 1.1, TZ - 0.5), V(c0.x, colY, colZ + 0.4), V(X0 - 18, colY, colZ), ...feed];
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
