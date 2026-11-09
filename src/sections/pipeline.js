// Магистральный нефтепровод «Транснефти» от насосной станции терминала до нефтебазы:
//  • надземная прокладка на опорах (как на фото): пары свай с термостабилизаторами, ригель, ложементы,
//    две нитки в серой изоляции; трасса идёт по рельефу через хребет и долину, пересекает реку;
//  • три промежуточные НПС (в реальности 100–200 км друг от друга; расстояния в сцене сжаты);
//  • нефтебаза: резервуары, обвязка, служебные здания, молниеотводы, железнодорожная эстакада налива
//    с галереей, наливными устройствами, шкафами и составом цистерн.
import * as THREE from 'three';
import {heightAt, pipeZ, MAIN, STATIONS, DEPOT} from './landscape.js';
import {pipe, valve, buildPumpStation, buildLightningRod, routePoints, FARM_MAT as M} from './tankfarm.js';
import {makeTank} from './terminal.js';

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
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, axis.length * 2, 0.72, 14), PIPE);
    t.userData.key = k;
    p.add(t);
  }
  // Опоры (инстансы): две сваи, ригель, ложементы, термостабилизаторы на сваях, швы изоляции.
  const n = axis.length;
  const piles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 1, 12), PILE, n * 2);
  const collars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 12), BEAM, n * 2);
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 11), BEAM, n);
  const shoes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.5, 1.1), BEAM, n * 2);
  const thermo = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), mat(0x8f979d, {metalness: 0.7}), n * 2);
  const seams = new THREE.InstancedMesh(new THREE.TorusGeometry(0.74, 0.04, 4, 20), mat(0x8f979d, {metalness: 0.6}), n * 2);
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
// Промежуточная НПС: насосный цех (разрез), камеры пуска-приёма средств очистки, молниеотводы, ограждение.
export function buildStations(p) {
  const out = [];
  for (const st of STATIONS) {
    const y = heightAt(st.x, st.z);
    const k = 'nps';
    box(p, 190, 0.3, 120, M.concrete, st.x, y + 0.15, st.z + 6, k);
    buildPumpStation(p, {cx: st.x, cz: st.z, cy: y + 0.3, scale: 0.72, key: k});
    // Отвод от магистрали к станции и обратно (нитка «−3» заходит, «+3» выходит).
    const zp = pipeZ(st.x), yp = routeHeight(st.x);
    for (const dx of [-40, 40]) {
      pipe(p, [V(st.x + dx, yp, zp + 3), V(st.x + dx, yp, zp + 18), V(st.x + dx, y + 1.6, zp + 18), V(st.x + dx, y + 1.6, st.z - 12)], 0.55, M.white, k, {ground: y, R: 1.6});
      valve(p, V(st.x + dx, y + 1.6, zp + 30), 'z', 0.55, k);
    }
    // Камеры пуска-приёма средств очистки и диагностики.
    for (const dx of [-70, 70]) {
      cyl(p, 0.9, 12, M.steel, st.x + dx, y + 1.6, st.z - 30, k, [Math.PI / 2, 0, 0]);
      cyl(p, 1.2, 0.5, M.yellow, st.x + dx, y + 1.6, st.z - 36.2, k, [Math.PI / 2, 0, 0]);
      for (const dz of [-34, -26]) box(p, 0.6, 1.2, 0.6, M.concrete, st.x + dx, y + 0.6, st.z + dz, k);
    }
    // Служебный блок и молниеотводы.
    box(p, 16, 4.5, 9, M.white, st.x - 70, y + 2.25, st.z + 32, k);
    box(p, 16.6, 0.5, 9.6, M.blue, st.x - 70, y + 4.75, st.z + 32, k);
    box(p, 16.1, 1.1, 9.1, M.glass, st.x - 70, y + 2.8, st.z + 32, k);
    for (const [dx, dz] of [[-88, -50], [88, 60]]) buildLightningRod(p, st.x + dx, st.z + dz, 40, y);
    // Ограждение.
    for (const [a, b] of [[[-95, -54], [95, -54]], [[95, -54], [95, 66]], [[95, 66], [-95, 66]], [[-95, 66], [-95, -54]]]) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const f = box(p, len, 2.2, 0.06, new THREE.MeshStandardMaterial({color: 0x9aa4ad, transparent: true, opacity: 0.35, depthWrite: false}), st.x + (a[0] + b[0]) / 2, y + 1.1, st.z + (a[1] + b[1]) / 2, undefined, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
      f.userData.dynamic = true;
    }
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
// Нефтебаза с железнодорожной эстакадой налива.
export function buildDepot(p) {
  const {x: cx, z: cz} = DEPOT;
  const y = heightAt(cx, cz), G1 = y + 0.05, PY = y + 1.5, k = 'depot', kr = 'rail';
  box(p, DEPOT.w - 40, 0.12, DEPOT.d - 40, mat(0x9a968b, {roughness: 1}), cx, y + 0.06, cz, k);
  // Резервуары: четыре больших и два малых, в обваловании.
  const tanks = [[-250, -150, 28], [-170, -150, 28], [-250, -60, 28], [-170, -60, 28], [-80, -200, 14], [-80, -160, 14]];
  for (const [dx, dz, r] of tanks) {
    const t = makeTank(r, r > 20 ? 17 : 12, 'dome', 0.5, false);
    t.group.position.set(cx + dx, y + 0.4, cz + dz);
    t.group.traverse((o) => (o.userData.key = k));
    p.add(t.group);
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
  for (const dx of [-170]) pipe(p, [V(cx - 250, PY, cz - 105), V(cx + dx, PY, cz - 105), V(cx + dx, PY, cz - 122)], 0.5, M.steel, k, {ground: y});
  pipe(p, [V(cx - 250, PY, cz - 105), V(cx - 250, PY, cz - 88)], 0.5, M.steel, k, {ground: y});
  // Насосная налива и служебные здания.
  for (const [dx, dz, w, d, h] of [[-20, -110, 30, 14, 7], [60, -180, 40, 16, 9], [140, -180, 24, 14, 6], [200, -60, 30, 18, 8]]) {
    box(p, w, h, d, M.white, cx + dx, y + h / 2, cz + dz, k);
    box(p, w + 0.6, 0.6, d + 0.6, M.blue, cx + dx, y + h + 0.3, cz + dz, k);
    box(p, w + 0.05, 1.2, d + 0.05, M.glass, cx + dx, y + h * 0.6, cz + dz, k);
  }
  // Железнодорожная эстакада налива: путь, галерея на красных опорах, наливные устройства, шкафы.
  const TZ = cz + 170, X0 = cx - 260, X1 = cx + 270;
  const railFrom = cx - 900, railTo = cx + 900;
  box(p, railTo - railFrom, 0.5, 6, mat(0x9b8f7c, {roughness: 1}), cx, y + 0.25, TZ, kr);
  box(p, railTo - railFrom, 0.5, 6, mat(0x9b8f7c, {roughness: 1}), cx, y + 0.25, TZ + 14, kr);
  for (const tz of [TZ, TZ + 14]) {
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.18, 2.7), mat(0x6a5a46), Math.round((railTo - railFrom) / 0.7));
    for (let i = 0; i < sl.count; i++) sl.setMatrixAt(i, new THREE.Matrix4().makeTranslation(railFrom + i * 0.7, y + 0.55, tz));
    sl.userData.noCast = true;
    p.add(sl);
    for (const dz of [-0.76, 0.76]) box(p, railTo - railFrom, 0.18, 0.12, M.steel, cx, y + 0.73, tz + dz, kr);
  }
  const deckY = y + 5.4, GZ = TZ + 5.2;
  box(p, X1 - X0, 0.2, 2.6, mat(0x9aa2a8, {metalness: 0.5}), (X0 + X1) / 2, deckY, GZ, kr);
  for (let x = X0; x <= X1; x += 12) {
    for (const dz of [-1.1, 1.1]) box(p, 0.35, deckY - y, 0.35, M.red, x, y + (deckY - y) / 2, GZ + dz, kr);
    box(p, 0.3, 0.3, 2.6, M.red, x, deckY - 1.6, GZ, kr);
  }
  for (const dz of [-1.25, 1.25]) {
    box(p, X1 - X0, 0.07, 0.07, M.steel, (X0 + X1) / 2, deckY + 1.1, GZ + dz, kr);
    box(p, X1 - X0, 0.05, 0.05, M.steel, (X0 + X1) / 2, deckY + 0.6, GZ + dz, kr);
    for (let x = X0; x <= X1; x += 2) box(p, 0.05, 1.1, 0.05, M.steel, x, deckY + 0.55, GZ + dz, kr);
  }
  for (const sx of [X0 - 1, X1 + 1]) {                                                            // лестницы
    const dir = sx < cx ? -1 : 1;
    const a = V(sx, deckY, GZ), b = V(sx + dir * 7, y + 0.2, GZ);
    const st = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1.6), M.steel);
    st.position.copy(a.clone().lerp(b, 0.5));
    st.scale.x = a.distanceTo(b);
    st.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    st.userData.key = kr;
    p.add(st);
  }
  // Коллектор налива под галереей и наливные устройства у каждой цистерны.
  const fromTank = [V(cx - 170, PY, cz - 60), V(cx - 120, PY, cz - 60), V(cx - 120, PY, GZ + 3.5), V(X0, PY, GZ + 3.5), V(X0, deckY - 1, GZ + 3.5), V(X1, deckY - 1, GZ + 3.5)];
  pipe(p, fromTank, 0.45, M.oilGlass, kr, {ground: y, R: 1.4});
  const arms = [];
  for (let i = 0; i < 20; i++) {
    const x = X0 + 16 + i * 13.2;
    const top = V(x, deckY + 3.6, GZ + 0.6);
    pipe(p, [V(x, deckY - 1, GZ + 3.5), V(x, deckY - 1, GZ + 0.6), top], 0.2, M.red, kr, {supports: false, R: 0.6});
    pipe(p, [top, V(x, deckY + 3.6, TZ), V(x, y + 4.3, TZ)], 0.18, mat(0x1d5fd0), kr, {supports: false, R: 0.8});
    box(p, 0.6, 0.6, 0.6, M.yellow, x, deckY + 3.6, GZ + 0.6, kr);
    box(p, 1.4, 1.6, 0.9, mat(0x2a9fd8), x + 4, y + 1.1, TZ - 4.2, kr);                            // шкаф управления
    arms.push(V(x, y + 4.3, TZ));
  }
  // Состав цистерн: зелёные котлы со светлыми днищами, тележки.
  const green = mat(0x3a6a22, {roughness: 0.5}), endM = mat(0xe8ece6), wheel = mat(0x23262a);
  const car = (x, tz) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 10.4, 24), green);
    body.rotation.z = Math.PI / 2;
    g.add(body);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), endM);
      cap.rotation.z = -s * Math.PI / 2;
      cap.scale.set(1, 0.3, 1);
      cap.position.x = s * 5.2;
      g.add(cap);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), green);
      dot.position.x = s * 5.66;
      dot.rotation.y = s * Math.PI / 2;
      g.add(dot);
    }
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.8, 14), green);
    dome.position.y = 1.7;
    g.add(dome);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 2.4), mat(0x2f7a2a));
    frame.position.y = -1.55;
    g.add(frame);
    for (const s of [-4, 4]) for (const wz of [-0.76, 0.76]) for (const wx of [-0.9, 0.9]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 12), wheel);
      w.rotation.x = Math.PI / 2;
      w.position.set(s + wx, -2.05, wz);
      g.add(w);
    }
    g.position.set(x, y + 3.25, tz);
    g.traverse((o) => (o.userData.key = kr));
    p.add(g);
  };
  for (let i = 0; i < 20; i++) car(X0 + 16 + i * 13.2, TZ);
  for (let i = 0; i < 14; i++) car(X0 + 60 + i * 13.2, TZ + 14);
  // Тепловоз.
  const loco = new THREE.Group();
  box(loco, 18, 3.4, 3, mat(0xc8322a), 0, 1.7, 0);
  box(loco, 4, 1.4, 3.05, mat(0xe8e2d0), -6, 3.2, 0);
  box(loco, 18.4, 0.6, 3.2, mat(0x23262a), 0, -0.1, 0);
  loco.position.set(X0 + 16 + 20 * 13.2 + 3, y + 1.4, TZ);
  loco.traverse((o) => (o.userData.key = kr));
  p.add(loco);
  // Молниеотводы и ограждение.
  for (const [dx, dz] of [[-300, -230], [-120, -230], [-300, 20], [40, 60], [260, 120], [260, -230]]) buildLightningRod(p, cx + dx, cz + dz, 44, y);
  const hw = DEPOT.w / 2 - 15, hd = DEPOT.d / 2 - 15;
  for (const [a, b] of [[[-hw, -hd], [hw, -hd]], [[hw, -hd], [hw, hd]], [[hw, hd], [-hw, hd]], [[-hw, hd], [-hw, -hd]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const f = box(p, len, 2.4, 0.06, new THREE.MeshStandardMaterial({color: 0x9aa4ad, transparent: true, opacity: 0.35, depthWrite: false}), cx + (a[0] + b[0]) / 2, y + 1.2, cz + (a[1] + b[1]) / 2, undefined, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    f.userData.dynamic = true;
  }
  // Путь нефти для анимации: магистраль → резервуар → налив в цистерну.
  const pick = arms[6] || arms[0];
  const flow = [...routePoints(toTank, 1.8), V(cx - 250, PY, cz - 60), ...routePoints(fromTank.slice(0, 5), 1.4), V(pick.x, deckY - 1, GZ + 3.5), V(pick.x, deckY - 1, GZ + 0.6), V(pick.x, deckY + 3.6, GZ + 0.6), V(pick.x, deckY + 3.6, TZ), pick];
  return {flow, rackZ: TZ, y};
}
