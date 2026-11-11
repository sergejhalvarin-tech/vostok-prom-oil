// Магистральный нефтепровод «Транснефти» от насосной станции терминала до нефтебазы:
//  • надземная прокладка на опорах (как на фото): пары свай с термостабилизаторами, ригель, ложементы,
//    две нитки в серой изоляции; трасса идёт по рельефу через хребет и долину, пересекает реку;
//  • три промежуточные НПС (в реальности 100–200 км друг от друга; расстояния в сцене сжаты);
//  • нефтебаза: резервуары, обвязка, служебные здания, молниеотводы, железнодорожная эстакада налива
//    с галереей, наливными устройствами, шкафами и составом цистерн.
import * as THREE from 'three';
import {heightAt, pipeZ, MAIN, STATIONS, DEPOT, RAIL_PTS, riverLevel} from './landscape.js';
import {pipe, valve, buildPumpStation, buildLightningRod, routePoints, FARM_MAT as M} from './tankfarm.js';
import {makeTank} from './terminal.js';
import {FM, building, substation, powerLine, fireStation, filters, vessel, lightMast, roads, truck} from './facilities.js';
import {RAIL_TOP, LOCO_LEN, CAR} from './train.js';
const RAIL_X0 = RAIL_PTS[0][0];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.2, ...o});
const PIPE = mat(0xb6bec4, {metalness: 0.45, roughness: 0.38});
const PILE = mat(0xc9ced2, {metalness: 0.3, roughness: 0.5});
const BEAM = mat(0xaeb5ba, {metalness: 0.5, roughness: 0.4});
const box = (p, w, h, d, m, x, y, z, key, ry = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.rotation.y = ry;
  if (key) o.userData.key = key;
  p.add(o);
  return o;
};
const cyl = (p, r, h, m, x, y, z, key, rot) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), m);
  o.position.set(x, y, z);
  if (rot) o.rotation.set(...rot);
  if (key) o.userData.key = key;
  p.add(o);
  return o;
};

// ======================================================================
// Трасса: ось по pipeZ(x), высота — над рельефом с запасом, без провалов в русла рек.
// Компенсационный зигзаг надземной прокладки (температурные удлинения), у станций и концов — прямо.
const tri = (t) => 2 * Math.abs(2 * (t - Math.floor(t + 0.5))) - 1;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function zigZ(x) {
  let k = sm(MAIN.x0, MAIN.x0 + 200, x) * (1 - sm(MAIN.x1 - 200, MAIN.x1, x));
  for (const st of STATIONS) k *= sm(70, 170, Math.abs(x - st.x));
  return pipeZ(x) + 9 * tri((x - MAIN.x0) / 270) * k;
}
function routeProfile(x0, x1, step = 18) {
  const pts = [];
  for (let x = x0; x <= x1; x += step) {
    const z = zigZ(x);
    let h = -1e9;
    for (let dx = -36; dx <= 36; dx += 12) h = Math.max(h, heightAt(x + dx, z));
    pts.push(V(x, h + 2.6, z));
  }
  for (let it = 0; it < 4; it++) for (let i = 1; i < pts.length - 1; i++) pts[i].y = Math.max(pts[i].y, (pts[i - 1].y + pts[i + 1].y) / 2);
  return pts;
}

export function buildMainline(p) {
  const k = 'trunk';
  const axis = routeProfile(MAIN.x0, MAIN.x1);
  // Нитки смещены поперёк трассы (по нормали к оси), чтобы лежать на ложементах ригелей.
  const sideAt = (i) => {
    const d = axis[Math.min(axis.length - 1, i + 1)].clone().sub(axis[Math.max(0, i - 1)]).setY(0).normalize();
    return V(d.z, 0, -d.x);
  };
  const lines = [-3, 3].map((off) => axis.map((a, i) => a.clone().addScaledVector(sideAt(i), off)));
  const curves = lines.map((pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  for (const c of curves) {
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, axis.length, 0.72, 12), PIPE);
    t.userData.key = k;
    p.add(t);
  }
  // Опоры (инстансы): две сваи, ригель, ложементы, термостабилизаторы на сваях, швы изоляции.
  const n = axis.length;
  const piles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 1, 8), PILE, n * 2);
  const collars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 8), BEAM, n * 2);
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 11), BEAM, n);
  const shoes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.5, 1.1), BEAM, n * 2);
  const thermo = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), mat(0x8f979d, {metalness: 0.7}), n * 2);
  const seams = new THREE.InstancedMesh(new THREE.TorusGeometry(0.74, 0.04, 3, 12), mat(0x8f979d, {metalness: 0.6}), n * 2);
  const markers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), mat(0xd8262a), Math.ceil(n / 28));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(1, 1, 1), up = V(0, 1, 0);
  let mi = 0;
  axis.forEach((a, i) => {
    const b = axis[Math.min(n - 1, i + 1)], pa = axis[Math.max(0, i - 1)];
    const dir = b.clone().sub(pa).setY(0).normalize(), yaw = Math.atan2(dir.x, dir.z);
    q.setFromAxisAngle(up, yaw);
    const side = V(dir.z, 0, -dir.x);
    const beamY = a.y - 0.72 - 0.5;
    beams.setMatrixAt(i, m4.compose(V(a.x, beamY, a.z), q, s.set(1, 1, 1)));
    [-1, 1].forEach((sg, j) => {
      const at = a.clone().addScaledVector(side, sg * 5.2);
      const ground = heightAt(at.x, at.z) - 1;
      const hh = beamY - ground;
      piles.setMatrixAt(i * 2 + j, m4.compose(V(at.x, ground + hh / 2, at.z), q, s.set(1, Math.max(0.5, hh), 1)));
      collars.setMatrixAt(i * 2 + j, m4.compose(V(at.x, beamY - 0.4, at.z), q, s.set(1, 1, 1)));
      thermo.setMatrixAt(i * 2 + j, m4.compose(V(at.x + dir.x * 0.25, beamY + 1.9, at.z + dir.z * 0.25), q, s.set(1, 1, 1)));
      const ps = a.clone().addScaledVector(side, sg * 3);
      shoes.setMatrixAt(i * 2 + j, m4.compose(V(ps.x, beamY + 0.4, ps.z), q, s.set(1, 1, 1)));
      seams.setMatrixAt(i * 2 + j, m4.compose(ps.clone().setY(a.y).addScaledVector(dir, 9), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir), s.set(1, 1, 1)));
    });
    if (i % 28 === 14) {
      const at = a.clone().addScaledVector(side, 8.5);
      markers.setMatrixAt(mi++, m4.compose(V(at.x, heightAt(at.x, at.z) + 1.1, at.z), q.identity(), s.set(1, 1, 1)));
    }
  });
  markers.count = mi;
  for (const im of [piles, collars, beams, shoes, thermo, seams, markers]) { im.userData.noCast = true; p.add(im); }
  return {curves, axis};
}

// ======================================================================
// Промежуточная НПС (как на типовых станциях «Транснефти»):
// магистральная насосная (разрез), узел подключения с задвижками, фильтры-грязеуловители, узел регулирования
// давления, камеры пуска-приёма средств очистки и диагностики, ёмкость сбора утечек, подстанция с ЛЭП,
// операторная, котельная, пожарные резервуары с насосной, дороги, мачты освещения, молниеотводы, ограждение.
export function buildStations(p) {
  const out = [];
  for (const st of STATIONS) {
    const y = heightAt(st.x, st.z), k = 'nps';
    const L = (dx, dz) => [st.x + dx, st.z + dz];
    const zp = pipeZ(st.x), yp = routeHeight(st.x), zl = zp - st.z;      // zl — магистраль в местных координатах
    // Технологическая площадка под бетон, остальное — гравий.
    box(p, 120, 0.25, 70, M.concrete, st.x, y + 0.13, st.z - 8, k).userData.noCast = true;
    buildPumpStation(p, {cx: st.x, cz: st.z, cy: y + 0.3, scale: 0.72, key: k});
    // Узел подключения: две нитки заходят на станцию через задвижки и выходят обратно.
    for (const dx of [-46, 46]) {
      pipe(p, [V(st.x + dx, yp, zp + 3), V(st.x + dx, yp, zp + 16), V(st.x + dx, y + 1.6, zp + 16), V(st.x + dx, y + 1.6, st.z - 14)], 0.55, M.white, k, {ground: y, R: 1.6});
      valve(p, V(st.x + dx, y + 1.6, zp + 26), 'z', 0.55, k);
      valve(p, V(st.x + dx, y + 1.6, zp + 36), 'z', 0.55, k);
    }
    // Фильтры-грязеуловители на входе и узел регулирования давления на выходе.
    filters(p, {x: st.x - 66, y, z: st.z - 22, key: k, n: 3});
    pipe(p, [V(st.x - 46, y + 1.6, st.z - 22), V(st.x - 61.5, y + 1.6, st.z - 22)], 0.45, M.white, k, {ground: y});
    building(p, {x: st.x + 68, y, z: st.z - 24, w: 18, d: 10, h: 6, key: k, floors: 1, wall: FM.wall2});
    for (const dz of [-27, -21]) pipe(p, [V(st.x + 46, y + 1.4, st.z + dz), V(st.x + 59, y + 1.4, st.z + dz)], 0.4, M.white, k, {ground: y});
    // Камеры пуска-приёма СОД: корпус, концевой затвор, байпас, площадка.
    for (const [dx, dir] of [[-108, 1], [108, -1]]) {
      const [tx, tz] = L(dx, zl + 22);
      cyl(p, 1.0, 14, M.steel, tx, y + 1.8, tz, k, [0, 0, Math.PI / 2]);
      cyl(p, 1.35, 0.8, M.yellow, tx - dir * 7.4, y + 1.8, tz, k, [0, 0, Math.PI / 2]);
      box(p, 0.6, 0.6, 0.6, M.dark, tx - dir * 7.9, y + 1.8, tz, k);
      cyl(p, 0.6, 3, M.steel, tx + dir * 8.5, y + 1.8, tz, k, [0, 0, Math.PI / 2]);
      pipe(p, [V(tx + dir * 10, y + 1.8, tz), V(tx + dir * 14, y + 1.8, tz), V(tx + dir * 14, yp, tz), V(tx + dir * 14, yp, zp + 3)], 0.55, M.steel, k, {ground: y, supports: false});
      for (const ox of [-4, 4]) box(p, 0.8, 1.2, 0.8, M.concrete, tx + ox, y + 0.6, tz, k);
      box(p, 16, 0.15, 6, M.concrete, tx, y + 0.08, tz, k);
    }
    // Ёмкость сбора утечек (подземная) и котельная.
    vessel(p, {x: st.x + 28, y, z: st.z - 34, r: 1.5, len: 10, key: k, buried: true});
    building(p, {x: st.x + 22, y, z: st.z + 62, w: 14, d: 10, h: 6, key: k, floors: 1, wall: FM.wall2, trim: FM.red});
    cyl(p, 0.7, 24, M.grey, st.x + 30, y + 12, st.z + 62, k);
    // Подстанция и ЛЭП.
    substation(p, {x: st.x - 96, y, z: st.z + 48, key: k});
    {                                                                                              // отпайка от ВЛ 110 кВ
      const tx = st.x - 96, tz = pipeZ(tx) + 190, dir = Math.atan2(pipeZ(tx + 300) - pipeZ(tx - 300), 600);
      powerLine(p, [[tx, y, st.z + 66], [tx, heightAt(tx, tz), tz]], k, {skip: [1], ry: {1: Math.PI / 2 - dir + Math.PI / 2}});
    }
    // Операторная, пожарная насосная с резервуарами.
    building(p, {x: st.x + 64, y, z: st.z + 52, w: 30, d: 14, h: 8, key: k, floors: 2});
    fireStation(p, {x: st.x + 118, y, z: st.z + 34, key: k});
    // Дороги, освещение, молниеотводы.
    roads(p, y, [[st.x - 140, st.z + 82, st.x + 140, st.z + 82], [st.x - 140, st.z - 40, st.x - 140, st.z + 82], [st.x + 140, st.z - 40, st.x + 140, st.z + 82],
      [st.x - 140, st.z - 40, st.x + 140, st.z - 40], [st.x, st.z + 82, st.x, st.z + 150]], k);
    for (const [dx, dz] of [[-138, -36], [138, -36], [-138, 80], [138, 80], [0, 24]]) lightMast(p, st.x + dx, y, st.z + dz, 22, k);
    for (const [dx, dz] of [[-70, 18], [70, -10]]) buildLightningRod(p, st.x + dx, st.z + dz, 40, y);
    // Ограждение с воротами.
    const fm = new THREE.MeshStandardMaterial({color: 0x9aa4ad, transparent: true, opacity: 0.38, depthWrite: false});
    for (const [w, d, ox, oz] of [[290, 0.06, 0, -96], [140, 0.06, -75, 96], [140, 0.06, 75, 96], [0.06, 192, -145, 0], [0.06, 192, 145, 0]]) {
      const f = box(p, w, 2.4, d, fm, st.x + ox, y + 1.2, st.z + oz);
      f.userData.dynamic = true;
    }
    box(p, 8, 4, 6, M.white, st.x - 12, y + 2, st.z + 102, k);                                   // КПП
    box(p, 8.6, 0.4, 6.6, M.blue, st.x - 12, y + 4.2, st.z + 102, k);
    out.push({...st, y});
  }
  return out;
}
let PROFILE = null;
function routeHeight(x) {
  PROFILE ??= routeProfile(MAIN.x0, MAIN.x1);
  const i = Math.max(0, Math.min(PROFILE.length - 1, Math.round((x - MAIN.x0) / 18)));
  return PROFILE[i].y;
}

// ======================================================================
// Нефтебаза: резервуарный парк в обваловании, насосная налива, железнодорожная эстакада налива
// под маршрут из 20 цистерн с электровозом, автоналив с бензовозами, подстанция, администрация,
// пожарная станция, дороги, освещение, молниеотводы, ограждение.
const RTZ = DEPOT.z + 170;
export const DEPOT_RACK = (() => {
  const X0 = DEPOT.x - 262, X1 = X0 + 20 * CAR + 8;
  return {X0, X1, TZ: RTZ, sHead: X1 + 2 + LOCO_LEN - RAIL_X0};
})();
export function buildDepot(p) {
  const {x: cx, z: cz} = DEPOT;
  const y = heightAt(cx, cz), PY = y + 1.5, k = 'depot', kr = 'rail';
  box(p, DEPOT.w - 40, 0.12, DEPOT.d - 40, mat(0x9a968b, {roughness: 1}), cx, y + 0.06, cz, k).userData.noCast = true;
  // Резервуары: четыре больших и два малых, в обваловании; лестницы, пеногенераторы.
  const tanks = [[-250, -150, 28], [-170, -150, 28], [-250, -60, 28], [-170, -60, 28], [-80, -200, 14], [-80, -160, 14]];
  for (const [dx, dz, r] of tanks) {
    const t = makeTank(r, r > 20 ? 17 : 12, 'dome', 0.5, false);
    t.group.position.set(cx + dx, y + 0.4, cz + dz);
    t.group.traverse((o) => (o.userData.key = k));
    p.add(t.group);
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + 0.4;
      box(p, 0.8, 1.2, 0.8, M.red, cx + dx + Math.cos(ang) * (r + 0.6), y + (r > 20 ? 16 : 11), cz + dz + Math.sin(ang) * (r + 0.6), k);
    }
  }
  for (const [x0, x1, z0, z1] of [[-290, -130, -190, -20], [-100, -60, -225, -135]]) {
    for (const [a, b] of [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]]) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      box(p, len, 1.8, 0.5, M.concrete, cx + (a[0] + b[0]) / 2, y + 0.9, cz + (a[1] + b[1]) / 2, k, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    }
  }
  // Приём с магистрали: узел подключения, коллектор к резервуарам.
  const inlet = V(MAIN.x1, routeHeight(MAIN.x1), pipeZ(MAIN.x1) - 3);
  const toTank = [inlet, V(MAIN.x1 + 20, inlet.y, inlet.z), V(MAIN.x1 + 20, PY, inlet.z), V(MAIN.x1 + 20, PY, cz - 105), V(cx - 250, PY, cz - 105), V(cx - 250, PY, cz - 122)];
  pipe(p, toTank, 0.6, M.oilGlass, k, {ground: y, R: 1.8});
  pipe(p, [V(cx - 250, PY, cz - 105), V(cx - 170, PY, cz - 105), V(cx - 170, PY, cz - 122)], 0.5, M.steel, k, {ground: y});
  pipe(p, [V(cx - 250, PY, cz - 105), V(cx - 250, PY, cz - 88)], 0.5, M.steel, k, {ground: y});
  for (const dx of [-250, -170]) valve(p, V(cx + dx, PY, cz - 112), 'z', 0.5, k);
  // Насосная налива, операторная, лаборатория, администрация.
  building(p, {x: cx - 20, y, z: cz - 110, w: 30, d: 14, h: 7, key: k, floors: 1});
  for (let i = 0; i < 4; i++) cyl(p, 0.55, 3.2, M.blue, cx - 30 + i * 6.5, y + 1.6, cz - 96, k);
  building(p, {x: cx + 60, y, z: cz - 180, w: 40, d: 16, h: 9, key: k, floors: 2, wall: FM.wall2});
  building(p, {x: cx + 140, y, z: cz - 180, w: 24, d: 14, h: 6, key: k, floors: 1});
  building(p, {x: cx + 270, y, z: cz + 30, w: 46, d: 16, h: 13, key: k, floors: 3});
  substation(p, {x: cx + 120, y, z: cz + 70, key: k});
  powerLine(p, [[cx + 120, cz + 86], [cx + 160, cz - 330], [cx + 210, cz - 720]].map(([x, z], i) => [x, i ? heightAt(x, z) : y, z]), k);
  fireStation(p, {x: cx + 320, y, z: cz - 220, key: k, tanks: 3});
  // Автоналив: навес на три поста, наливные стояки, бензовозы.
  {
    const ax = cx + 20, az = cz + 40;
    box(p, 34, 0.5, 20, mat(0x2f6fc0), ax, y + 7.2, az, k);
    box(p, 34.4, 0.8, 20.4, M.white, ax, y + 6.6, az, k);
    for (const [ox, oz] of [[-15, -8], [15, -8], [-15, 8], [15, 8], [0, -8], [0, 8]]) box(p, 0.5, 6.4, 0.5, M.white, ax + ox, y + 3.2, az + oz, k);
    for (const ox of [-10, 0, 10]) {
      box(p, 1.2, 3.6, 1.2, M.grey, ax + ox + 3, y + 1.8, az, k);
      pipe(p, [V(ax + ox + 3, y + 3.6, az), V(ax + ox + 3, y + 4.6, az), V(ax + ox + 0.6, y + 4.6, az)], 0.12, M.steel, k, {supports: false, R: 0.4});
    }
    truck(p, ax - 10, y, az, 0, k);
    truck(p, ax + 10, y, az, 0, k, 0xf3c400);
    for (let i = 0; i < 4; i++) truck(p, cx + 340, y, cz + 110 + i * 9, Math.PI / 2, k, i % 2 ? 0xe8eef2 : 0xf3c400);
    pipe(p, [V(cx - 20, PY, cz - 103), V(cx - 20, PY, az - 14), V(ax + 13, PY, az - 14), V(ax + 13, PY, az)], 0.3, M.steel, k, {ground: y});
  }
  roads(p, y, [[cx - 390, cz + 120, cx + 390, cz + 120], [cx - 40, cz - 280, cx - 40, cz + 120], [cx + 390, cz - 280, cx + 390, cz + 120], [cx - 40, cz - 280, cx + 390, cz - 280],
    [cx + 20, cz + 15, cx + 20, cz + 65], [cx + 200, cz + 120, cx + 200, cz + 340]], k);
  for (const [dx, dz] of [[-300, 110], [-100, 110], [100, 110], [300, 110], [-40, -120], [380, -140], [200, -260]]) lightMast(p, cx + dx, y, cz + dz, 26, k);
  // Железнодорожные пути налива: основной (под маршрут) и отстойный с порожними цистернами.
  const TZ = RTZ, X0 = DEPOT_RACK.X0, X1 = DEPOT_RACK.X1;
  const railFrom = cx - 900, railTo = RAIL_X0 + 720;
  for (const [tz, x1] of [[TZ, railTo], [TZ + 14, cx + 120]]) {
    box(p, x1 - railFrom, 0.6, 6, mat(0x8d8478, {roughness: 1}), (railFrom + x1) / 2, y + 0.3, tz, kr).userData.noCast = true;
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.27, 0.17, 2.75), mat(0x6d6a64), Math.round((x1 - railFrom) / 0.9));
    for (let i = 0; i < sl.count; i++) sl.setMatrixAt(i, new THREE.Matrix4().makeTranslation(railFrom + i * 0.9, y + RAIL_TOP - 0.26, tz));
    sl.userData.noCast = true;
    p.add(sl);
    for (const dz of [-0.75, 0.75]) box(p, x1 - railFrom, 0.18, 0.08, M.steel, (railFrom + x1) / 2, y + RAIL_TOP - 0.09, tz + dz, kr);
  }
  box(p, 1.2, 1.4, 3.4, M.red, cx + 122, y + 1.2, TZ + 14, kr);                                     // упор отстойного пути
  // Галерея на опорах с лестницами и навесом.
  const deckY = y + 5.4, GZ = TZ + 5.2;
  box(p, X1 - X0, 0.2, 2.6, mat(0x9aa2a8, {metalness: 0.5}), (X0 + X1) / 2, deckY, GZ, kr);
  box(p, X1 - X0 + 4, 0.25, 9, mat(0x2f6fc0), (X0 + X1) / 2, deckY + 4.4, GZ + 1.5, kr);
  for (let x = X0; x <= X1; x += 12) {
    for (const dz of [-1.1, 1.1]) box(p, 0.35, deckY - y, 0.35, M.red, x, y + (deckY - y) / 2, GZ + dz, kr);
    box(p, 0.3, 0.3, 2.6, M.red, x, deckY - 1.6, GZ, kr);
  }
  for (let x = X0; x <= X1; x += 24) box(p, 0.3, 4.4, 0.3, M.steel, x, deckY + 2.2, GZ + 4.5, kr);
  for (const dz of [-1.25, 1.25]) {
    box(p, X1 - X0, 0.07, 0.07, M.steel, (X0 + X1) / 2, deckY + 1.1, GZ + dz, kr);
    box(p, X1 - X0, 0.05, 0.05, M.steel, (X0 + X1) / 2, deckY + 0.6, GZ + dz, kr);
    for (let x = X0; x <= X1; x += 2) box(p, 0.05, 1.1, 0.05, M.steel, x, deckY + 0.55, GZ + dz, kr);
  }
  for (const sx of [X0 - 1, X1 + 1]) {
    const dir = sx < cx ? -1 : 1;
    const a = V(sx, deckY, GZ), b = V(sx + dir * 7, y + 0.2, GZ);
    const st = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1.6), M.steel);
    st.position.copy(a.clone().lerp(b, 0.5));
    st.scale.x = a.distanceTo(b);
    st.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    st.userData.key = kr;
    p.add(st);
  }
  // Коллектор налива под галереей и наливные устройства над люком каждой цистерны.
  const fromTank = [V(cx - 170, PY, cz - 60), V(cx - 120, PY, cz - 60), V(cx - 120, PY, GZ + 3.5), V(X0, PY, GZ + 3.5), V(X0, deckY - 1, GZ + 3.5), V(X1, deckY - 1, GZ + 3.5)];
  pipe(p, fromTank, 0.45, M.oilGlass, kr, {ground: y, R: 1.4});
  const arms = [];
  for (let i = 0; i < 20; i++) {
    const x = DEPOT_RACK.sHead + RAIL_X0 - LOCO_LEN - 0.3 - (i + 0.5) * CAR;
    const hatch = y + RAIL_TOP + 4.75;
    const top = V(x, deckY + 3.4, GZ + 0.6);
    pipe(p, [V(x, deckY - 1, GZ + 3.5), V(x, deckY - 1, GZ + 0.6), top], 0.2, M.red, kr, {supports: false, R: 0.6});
    pipe(p, [top, V(x, deckY + 3.4, TZ), V(x, hatch, TZ)], 0.17, mat(0x1d5fd0), kr, {supports: false, R: 0.8});
    box(p, 0.6, 0.6, 0.6, M.yellow, x, deckY + 3.4, GZ + 0.6, kr);
    box(p, 1.4, 1.6, 0.9, mat(0x2a9fd8), x + 4, y + 1.1, TZ + 4.4, kr);                              // шкаф управления
    box(p, 1.6, 0.12, 2.4, M.yellow, x, deckY + 0.1, GZ - 2.4, kr);                                 // откидной мостик
    arms.push(V(x, hatch, TZ));
  }
  // Молниеотводы и ограждение.
  for (const [dx, dz] of [[-300, -230], [-120, -230], [-300, 20], [40, -40], [260, 120], [260, -230]]) buildLightningRod(p, cx + dx, cz + dz, 44, y);
  const hw = DEPOT.w / 2 - 15, hd = DEPOT.d / 2 - 15;
  for (const [a, b] of [[[-hw, -hd], [hw, -hd]], [[hw, -hd], [hw, 150]], [[hw, 200], [hw, hd]], [[hw, hd], [-hw, hd]], [[-hw, hd], [-hw, -hd]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const f = box(p, len, 2.4, 0.06, new THREE.MeshStandardMaterial({color: 0x9aa4ad, transparent: true, opacity: 0.35, depthWrite: false}), cx + (a[0] + b[0]) / 2, y + 1.2, cz + (a[1] + b[1]) / 2, undefined, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    f.userData.dynamic = true;
  }
  // Путь нефти: магистраль → резервуар → налив в цистерну.
  const pick = arms[6] || arms[0];
  const flow = [...routePoints(toTank, 1.8), V(cx - 250, PY, cz - 60), ...routePoints(fromTank.slice(0, 5), 1.4), V(pick.x, deckY - 1, GZ + 3.5), V(pick.x, deckY - 1, GZ + 0.6), V(pick.x, deckY + 3.4, GZ + 0.6), V(pick.x, deckY + 3.4, TZ), pick];
  // Порожние цистерны на отстойном пути.
  const empties = [];
  for (let i = 0; i < 14; i++) empties.push({x: cx - 200 + i * CAR, y: y + RAIL_TOP + 0.08, z: TZ + 14, yaw: Math.PI / 2});
  return {flow, rackZ: TZ, y, empties};
}

// ======================================================================
// ВЛ 110 кВ вдоль трассы: питает головную насосную и все НПС, опоры через ~300 м по рельефу
// (не в русле реки), у каждой НПС — опора напротив подстанции для отпайки.
export function buildPowerTrunk(p) {
  const k = 'power', xs = [];
  for (let x = 2620; x < DEPOT.x - DEPOT.w / 2 - 60; x += 300) xs.push(x);
  for (const st of STATIONS) {
    const sx = st.x - 96;
    for (let i = xs.length - 1; i >= 0; i--) if (Math.abs(xs[i] - sx) < 150) xs.splice(i, 1);
    xs.push(sx);
  }
  xs.sort((a, b) => a - b);
  const towers = xs.map((x) => {
    let xx = x;
    const zAt = (q) => pipeZ(q) + 190;
    for (let t = 0; t < 8 && heightAt(xx, zAt(xx)) < riverLevel(xx) + 2 && xx > 5500; t++) xx += 25;     // не ставить в воду
    return [xx, heightAt(xx, zAt(xx)), zAt(xx)];
  });
  powerLine(p, towers, k);
}
