// Резервуарный парк «Транснефти» и его обвязка:
//  • СИКН — система измерений количества и показателей качества нефти (на приёме с причала);
//  • трубопроводная сеть: у каждого резервуара приёмный (запад) и раздаточный (восток) патрубки с задвижками,
//    коллекторы вдоль колонок, межколонковая эстакада с синим укрытием, трассы — прямые участки по осям
//    и отводы постоянного радиуса (≈3D), опоры с шагом 8 м, фланцы;
//  • насосная станция (разрез: магистральные насосы с электродвигателями, подпорные вертикальные насосы
//    снаружи, кран-балка) и два магистральных нефтепровода, уходящих по рельефу за горы;
//  • административное здание, молниеотводы, маркировка резервуаров.
import * as THREE from 'three';
import {setLink} from '../kit/sea.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const G = 3;                    // отметка земли площадки
const PY = G + 1.4;             // ось трубопроводов на низких опорах
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.2, ...o});
const M = {
  steel: mat(0xc8d0d6, {metalness: 0.85, roughness: 0.28}),
  white: mat(0xf4f5f2, {roughness: 0.4}),
  red: mat(0xd8262a, {roughness: 0.45}),
  blue: mat(0x1d5fb8, {roughness: 0.45}),
  lblue: mat(0x5fb7d6, {roughness: 0.45}),
  cyan: mat(0x2fd3df, {roughness: 0.35}),
  yellow: mat(0xffc81f, {roughness: 0.45}),
  green: mat(0x2fae4a, {roughness: 0.45}),
  black: mat(0x1d2024, {roughness: 0.5}),
  grey: mat(0x8d969e, {metalness: 0.5}),
  concrete: mat(0xd7d2c4, {roughness: 0.92}),
  beige: mat(0xc7ac98, {roughness: 0.7}),
  panel: mat(0xdadcdc, {roughness: 0.6}),
  dark: mat(0x2f3338, {roughness: 0.6}),
  glass: mat(0x8fb6cf, {metalness: 0.6, roughness: 0.12}),
  roof: mat(0xe9ebea, {roughness: 0.7}),
  floor: mat(0xd9dcd9, {roughness: 0.8}),
  oilGlass: new THREE.MeshStandardMaterial({color: 0xffe08a, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.1, depthWrite: false}),
  roofGlass: new THREE.MeshStandardMaterial({color: 0x3a78c8, transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide}),
};

// ---------- примитивы ----------
function box(p, w, h, d, m, x, y, z, key, ry = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.rotation.y = ry;
  if (key) o.userData.key = key;
  p.add(o);
  return o;
}
function cyl(p, r, h, m, x, y, z, key, rot, seg = 20) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  o.position.set(x, y, z);
  if (rot) o.rotation.set(...rot);
  if (key) o.userData.key = key;
  p.add(o);
  return o;
}
function rod(p, a, b, r, m, key, seg = 8) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), m);
  setLink(o, a, b);
  if (key) o.userData.key = key;
  p.add(o);
  return o;
}
function ring(p, at, dir, r, t, m, key) {
  const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 20), m);
  o.position.copy(at);
  o.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().normalize());
  if (key) o.userData.key = key;
  p.add(o);
  return o;
}

// ---------- трассы: прямые по осям + отводы постоянного радиуса ----------
export function routePoints(pts, R) {
  const out = [pts[0].clone()];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], c = pts[i], b = pts[i + 1];
    const d1 = c.clone().sub(a).normalize(), d2 = b.clone().sub(c).normalize();
    const r = Math.min(R, c.distanceTo(a) / 2, c.distanceTo(b) / 2);
    if (Math.abs(d1.dot(d2)) > 0.999 || r < 0.05) { out.push(c.clone()); continue; }
    const T1 = c.clone().addScaledVector(d1, -r), T2 = c.clone().addScaledVector(d2, r), O = T1.clone().addScaledVector(d2, r);
    const u = T1.clone().sub(O), w = T2.clone().sub(O);
    for (let k = 0; k <= 8; k++) {
      const t = (k / 8) * Math.PI / 2;
      out.push(O.clone().addScaledVector(u, Math.cos(t)).addScaledVector(w, Math.sin(t)));
    }
  }
  out.push(pts[pts.length - 1].clone());
  return out;
}
// Труба по трассе: отводы, фланцы по концам и через 12 м, опоры под низкими горизонтальными участками.
export function pipe(p, pts, r, m, key, {R = Math.max(1, r * 3), supports = true, flangeStep = 12, ground = G} = {}) {
  const dense = routePoints(pts, R);
  const curve = new THREE.CatmullRomCurve3(dense, false, 'centripetal');
  const len = curve.getLength();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.ceil(len / 1.5) + dense.length * 2, r, 12), m);
  if (key) tube.userData.key = key;
  p.add(tube);
  const fm = m.transparent ? M.steel : m;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], d = b.clone().sub(a), L = d.length();
    d.normalize();
    for (let s = 0; s <= L; s += flangeStep) {
      if (s < R + 0.5 && i > 0) continue;
      if (L - s < R + 0.5 && i < pts.length - 2) continue;
      ring(p, a.clone().addScaledVector(d, s), d, r * 1.12, r * 0.18, fm, key);
    }
    // Опоры: бетонная тумба + стальное ложе под горизонтальными участками у земли.
    if (supports && Math.abs(d.y) < 0.01 && a.y < ground + 8) {
      for (let s = 4; s < L - 2; s += 8) {
        const q = a.clone().addScaledVector(d, s), h = q.y - r - ground;
        if (h < 0.3) continue;
        box(p, 0.9, h - 0.25, 0.9, M.concrete, q.x, ground + (h - 0.25) / 2, q.z, key);
        box(p, Math.abs(d.x) > 0.5 ? 0.3 : r * 2.4, 0.25, Math.abs(d.z) > 0.5 ? 0.3 : r * 2.4, M.steel, q.x, q.y - r - 0.12, q.z, key);
      }
    }
  }
  return dense;
}
// Задвижка с электроприводом: корпус, фланцы, шпиндель, жёлтый привод.
export function valve(p, at, axis, r, key) {
  const d = axis === 'x' ? V(1, 0, 0) : axis === 'z' ? V(0, 0, 1) : V(0, 1, 0);
  const body = cyl(p, r * 1.5, r * 2.4, M.grey, at.x, at.y, at.z, key);
  body.quaternion.setFromUnitVectors(V(0, 1, 0), d);
  ring(p, at.clone().addScaledVector(d, r * 1.25), d, r * 1.3, r * 0.25, M.grey, key);
  ring(p, at.clone().addScaledVector(d, -r * 1.25), d, r * 1.3, r * 0.25, M.grey, key);
  cyl(p, r * 0.35, r * 2.4, M.grey, at.x, at.y + r * 2.4, at.z, key);
  box(p, r * 2.2, r * 1.6, r * 1.6, M.yellow, at.x, at.y + r * 4, at.z, key);
  cyl(p, r * 0.6, r * 0.4, M.dark, at.x, at.y + r * 4.95, at.z, key);
}

// ======================================================================
// Резервуарный парк: сеть трубопроводов.
// tanks — [{x, z, ci, ri}], cols — X колонок. Возвращает трассы потоков нефти.
export function buildPipeNetwork(p, {cols, rows, tankR, rackEnd, recvTargets, dispatchFrom}) {
  const xR = (cx) => cx - tankR - 4, xD = (cx) => cx + tankR + 4; // коллекторы: приём — запад, раздача — восток
  const Z0 = -505, ZN = 523, ZND = 527, YR = G + 6, YD = G + 9;
  const recvGlass = (c) => c === 0, dispGlass = (c) => c === dispatchFrom[0];
  const paths = {recv: [], dispatch: null};

  // Межколонковая эстакада вдоль северной границы парка: портальные рамы, два яруса, синее укрытие.
  const gx0 = cols[0] - 44, gx1 = 2268;
  for (let x = gx0; x <= gx1; x += 8) {
    for (const z of [519, 531]) box(p, 0.45, YD + 2 - G, 0.45, M.blue, x, (YD + 2 + G) / 2, z, 'pipes');
    box(p, 0.4, 0.4, 12.4, M.blue, x, YR - 0.9, 525, 'pipes');
    box(p, 0.4, 0.4, 12.4, M.blue, x, YD - 0.9, 525, 'pipes');
    rod(p, V(x, G + 0.5, 519), V(x, YD - 1, 531), 0.08, M.blue, 'pipes');
  }
  box(p, gx1 - gx0 + 2, 0.25, 13.6, M.blue, (gx0 + gx1) / 2, YD + 2.2, 525, 'pipes');           // кровля укрытия
  for (const z of [518.4, 531.6]) box(p, gx1 - gx0 + 2, 1.2, 0.1, M.blue, (gx0 + gx1) / 2, YD + 1.6, z, 'pipes');

  cols.forEach((cx, c) => {
    // Коллекторы вдоль колонки + подъём на эстакаду.
    pipe(p, [V(xR(cx), PY, Z0), V(xR(cx), PY, ZN), V(xR(cx), YR, ZN)], 0.55, recvGlass(c) ? M.oilGlass : M.steel, 'pipes');
    pipe(p, [V(xD(cx), PY, Z0), V(xD(cx), PY, ZND), V(xD(cx), YD, ZND)], 0.55, dispGlass(c) ? M.oilGlass : M.steel, 'pipes');
    rows.forEach((z, r) => {
      // Приёмный патрубок (запад) и раздаточный (восток) — по радиусу, с задвижками.
      const recvTarget = recvTargets.some(([cc, rr]) => cc === c && rr === r);
      const dispSrc = dispatchFrom[0] === c && dispatchFrom[1] === r;
      pipe(p, [V(xR(cx), PY, z), V(cx - tankR - 0.2, PY, z)], 0.42, recvTarget ? M.oilGlass : M.steel, 'farm', {supports: false});
      pipe(p, [V(cx + tankR + 0.2, PY, z), V(xD(cx), PY, z)], 0.42, dispSrc ? M.oilGlass : M.steel, 'farm', {supports: false});
      valve(p, V(cx - tankR - 2, PY, z), 'x', 0.42, 'farm');
      valve(p, V(cx + tankR + 2, PY, z), 'x', 0.42, 'farm');
      if (recvTarget) {
        // Путь нефти: от эстакады через СИКН по приёмному коллектору колонки к резервуару.
        paths.recv.push({c, r, tail: [V(xR(cx), PY, 16), V(xR(cx), PY, z), V(cx - tankR - 0.2, PY, z)]});
      }
    });
  });
  // Сборные коллекторы на эстакаде: приёмный (нижний ярус) и раздаточный (верхний) — до насосной.
  pipe(p, [V(xR(cols[0]), YR, ZN), V(xR(cols[cols.length - 1]), YR, ZN)], 0.6, M.steel, 'pipes', {supports: false});
  const dSrc = dispatchFrom[0];
  const dispMain = [V(xD(cols[0]), YD, ZND), V(2262, YD, ZND), V(2262, PY, ZND), V(2262, PY, 482), V(2296, PY, 482), V(2296, PY, 466)];
  pipe(p, dispMain.slice(0, 2), 0.7, M.steel, 'pipes', {supports: false});
  pipe(p, [V(xD(cols[dSrc]), YD, ZND), ...dispMain.slice(1)], 0.7, M.oilGlass, 'pipes');

  // Путь раздачи (для анимации): из резервуара-источника к насосной.
  const [sc, sr] = dispatchFrom, scx = cols[sc], sz = rows[sr];
  paths.dispatch = routePoints([V(scx + tankR + 0.2, PY, sz), V(xD(scx), PY, sz), V(xD(scx), PY, ZND), V(xD(scx), YD, ZND), ...dispMain.slice(1)], 2);
  paths.xR0 = xR(cols[0]);
  return paths;
}

// ======================================================================
// СИКН — по проекту: бетонная площадка с бортиком, блок-бокс операторной, входной и выходной коллекторы,
// измерительные линии (фильтры, струевыпрямители, турбинные преобразователи расхода, задвижки с приводами),
// поверочная установка на площадке с ограждением и лестницей, блок качества (БИК) с ёмкостями, электрошкаф.
export function buildSIKN(p, {x0 = 1779, x1 = 1823, z0 = -80, z1 = 14} = {}) {
  const k = 'sikn', cx = (x0 + x1) / 2;
  box(p, x1 - x0, 0.25, z1 - z0, M.concrete, cx, G + 0.12, (z0 + z1) / 2, k);
  for (const [w, d, x, z] of [[x1 - x0, 0.4, cx, z0], [x1 - x0, 0.4, cx, z1], [0.4, z1 - z0, x0, (z0 + z1) / 2], [0.4, z1 - z0, x1, (z0 + z1) / 2]]) box(p, w, 0.9, d, M.concrete, x, G + 0.45, z, k);
  // Блок-бокс операторной.
  const bz = z0 + 7;
  box(p, 13, 4.2, 9, M.blue, cx - 4, G + 2.35, bz, k);
  for (const s of [-1, 1]) {
    const rf = box(p, 13.6, 0.2, 5.4, M.roof, cx - 4, G + 4.95, bz + s * 2.4, k);
    rf.rotation.x = s * 0.22;
  }
  box(p, 13.1, 1.1, 0.1, M.glass, cx - 4, G + 2.8, bz + 4.52, k);
  box(p, 0.1, 1.2, 1.6, M.glass, cx + 2.55, G + 2.8, bz - 1.5, k);
  rod(p, V(cx + 2.7, G + 1, bz + 3), V(cx + 2.7, G + 7.5, bz + 3), 0.08, M.dark, k);           // антенна/датчик
  // Коллекторы: входной (запад) и выходной (восток).
  const xi = x0 + 7, xo = x1 - 9, zl = [-60, -46, -32, -18];
  pipe(p, [V(xi, PY, zl[0] - 4), V(xi, PY, zl[3] + 6)], 0.6, M.steel, k);
  pipe(p, [V(xo, PY, zl[0] - 4), V(xo, PY, z1 - 6)], 0.6, M.steel, k);
  // Измерительные линии.
  for (const z of zl) {
    pipe(p, [V(xi, PY, z), V(xo, PY, z)], 0.38, M.steel, k, {supports: false});
    valve(p, V(xi + 2.6, PY, z), 'x', 0.38, k);
    cyl(p, 0.9, 1.9, M.green, xi + 6.2, PY + 0.5, z, k);                                        // фильтр
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.green);
    dome.position.set(xi + 6.2, PY + 1.45, z);
    p.add(dome);
    cyl(p, 0.42, 3.4, M.black, xi + 11, PY, z, k, [0, 0, Math.PI / 2]);                          // турбинный ПР
    cyl(p, 0.18, 0.8, M.grey, xi + 11, PY + 0.75, z, k);
    box(p, 0.45, 0.35, 0.3, M.dark, xi + 11, PY + 1.25, z, k);                                    // вторичный прибор
    valve(p, V(xo - 2.6, PY, z), 'x', 0.38, k);
    box(p, xo - xi - 2, 0.15, 1.6, M.lblue, (xi + xo) / 2, G + 0.9, z, k);                        // рама
    for (const x of [xi + 3, (xi + xo) / 2, xo - 3]) box(p, 0.2, PY - G - 1, 0.2, M.lblue, x, (PY + G) / 2, z, k);
  }
  // Поверочная установка: П-образная петля, площадка с ограждением и лестницей.
  const pz = z1 - 13;
  pipe(p, [V(xo, PY, pz), V(xo - 10, PY, pz), V(xo - 10, PY + 3, pz), V(xo - 18, PY + 3, pz), V(xo - 18, PY, pz)], 0.55, M.steel, k, {R: 1.4, supports: false});
  box(p, 8, 0.2, 6, M.blue, xo - 14, G + 6.3, pz + 1, k);
  for (const [x, z] of [[xo - 18, pz - 2], [xo - 10, pz - 2], [xo - 18, pz + 4], [xo - 10, pz + 4]]) box(p, 0.3, 6.2, 0.3, M.blue, x, G + 3.1, z, k);
  for (const [a, b] of [[V(xo - 18, G + 7.4, pz - 2), V(xo - 10, G + 7.4, pz - 2)], [V(xo - 18, G + 7.4, pz + 4), V(xo - 10, G + 7.4, pz + 4)], [V(xo - 18, G + 7.4, pz - 2), V(xo - 18, G + 7.4, pz + 4)], [V(xo - 10, G + 7.4, pz - 2), V(xo - 10, G + 7.4, pz + 4)]]) {
    rod(p, a, b, 0.05, M.yellow, k, 6);
    rod(p, a.clone().setY(G + 6.9), b.clone().setY(G + 6.9), 0.04, M.yellow, k, 6);
  }
  for (let t = 0; t <= 1.001; t += 0.25) for (const z of [pz - 2, pz + 4]) { const x = xo - 18 + 8 * t; rod(p, V(x, G + 6.4, z), V(x, G + 7.4, z), 0.04, M.yellow, k, 4); }
  rod(p, V(xo - 9.6, G + 6.3, pz + 1), V(xo - 3, G + 0.2, pz + 1), 0.6, M.blue, k, 4);              // лестница
  for (let t = 0.08; t < 1; t += 0.08) { const q = V(xo - 9.6, G + 6.3, pz + 1).lerp(V(xo - 3, G + 0.2, pz + 1), t); box(p, 0.3, 0.06, 1.3, M.yellow, q.x, q.y + 0.1, q.z, k); }
  // Блок качества (БИК): голубая рама с ограждением, белая колонна, две бирюзовые ёмкости.
  const bx = x1 - 4.5, bzz = -8;
  for (const [x, z] of [[-2.5, -3], [2.5, -3], [-2.5, 3], [2.5, 3]]) box(p, 0.2, 5, 0.2, M.lblue, bx + x, G + 2.5, bzz + z, k);
  box(p, 5.4, 0.15, 6.4, M.lblue, bx, G + 5, bzz, k);
  for (const z of [-3.2, 3.2]) rod(p, V(bx - 2.7, G + 6, bzz + z), V(bx + 2.7, G + 6, bzz + z), 0.04, M.yellow, k, 4);
  cyl(p, 1, 3.2, M.white, bx, G + 6.6, bzz - 1.2, k);
  cyl(p, 0.18, 1.6, M.grey, bx, G + 8.9, bzz - 1.2, k);
  for (const z of [1.2, 4.2]) {
    cyl(p, 1.2, 2.6, M.cyan, bx - 0.4, G + 1.4, bzz + z, k, null, 24);
    for (const y of [0.7, 1.4, 2.1]) ring(p, V(bx - 0.4, G + y, bzz + z), V(0, 1, 0), 1.22, 0.05, M.cyan, k);
    cyl(p, 0.4, 0.25, M.yellow, bx - 0.4, G + 2.8, bzz + z, k);
  }
  // Электрошкаф на раме и горизонтальная ёмкость.
  box(p, 6, 0.3, 3.2, M.green, x0 + 5, G + 0.35, -4, k);
  box(p, 4.2, 2.8, 2.8, M.white, x0 + 5.5, G + 1.9, -4, k);
  for (let i = 0; i < 3; i++) box(p, 0.06, 0.5, 0.06, M.dark, x0 + 3.5 + i * 1.3, G + 2.2, -2.55, k);
  cyl(p, 0.7, 5, M.steel, x0 + 5, G + 1.2, -10, k, [Math.PI / 2, 0, 0]);
  return {xi, xo, zl, pz, inlet: V(xi, PY, zl[0] - 4), outlet: V(xo, PY, z1 - 6)};
}

// ======================================================================
// Административное здание — по проекту: два этажа, плоская кровля с бежевым парапетом,
// ленточные окна в тёмных рамах, центральный вход с козырьком, выступающий блок окон над входом,
// наружная стальная лестница на второй этаж в торце.
export function buildAdmin(p, {x, z, ry = Math.PI / 2}) {
  const g = new THREE.Group();
  g.position.set(x, G, z);
  g.rotation.y = ry;
  p.add(g);
  const L = 62, D = 15, H = 7.8, k = 'admin';
  box(g, L, H, D, M.panel, 0, H / 2, 0, k);
  box(g, L + 0.4, 1.6, D + 0.4, M.beige, 0, H + 0.8, 0, k);                                     // парапет
  box(g, L - 0.6, 0.1, D - 0.6, M.roof, 0, H + 0.2, 0, k);
  for (let i = -L / 2 + 4; i < L / 2; i += 4) box(g, 0.08, 0.06, D - 0.8, M.grey, i, H + 0.28, 0, k);  // швы кровли
  box(g, L + 0.1, 0.12, 0.08, M.grey, 0, H / 2, -D / 2 - 0.04, k);                               // межэтажный пояс
  // Окна: пары в тёмных рамах, между ними — светильник.
  for (const fy of [1.9, 5.7]) for (let i = -L / 2 + 3; i < L / 2 - 2; i += 3.4) {
    if (Math.abs(i) < 7.5) continue;
    box(g, 2.5, 1.7, 0.18, M.dark, i, fy, -D / 2 - 0.05, k);
    box(g, 2.2, 1.45, 0.2, M.glass, i, fy, -D / 2 - 0.06, k);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({color: 0xfff2a0, emissive: 0xffe060, emissiveIntensity: 1.2}));
    lamp.position.set(i + 1.7, fy, -D / 2 - 0.12);
    g.add(lamp);
  }
  // Центр: бежевая вертикальная вставка, выступающий тёмный блок окон, вход с козырьком.
  box(g, 7, H, 0.3, M.beige, -3, H / 2, -D / 2 - 0.12, k);
  box(g, 14, 2.6, 1.2, M.dark, 4, 5.8, -D / 2 - 0.6, k);
  for (let i = -2; i <= 10; i += 2.4) box(g, 2, 1.8, 0.1, M.glass, i, 5.8, -D / 2 - 1.22, k);
  box(g, 6, 3, 2.2, M.dark, 6, 1.5, -D / 2 - 1.1, k);
  box(g, 7.2, 0.35, 4.4, M.dark, 6, 3.2, -D / 2 - 2.0, k);
  box(g, 2.2, 2.4, 0.08, M.glass, 6, 1.25, -D / 2 - 2.22, k);
  // Торцевая лестница на второй этаж: марш, площадка, перила, дверь.
  const ex = -L / 2 - 1.6;
  box(g, 1.2, 2.2, 0.1, M.dark, -L / 2 - 0.05, 1.1, -D / 2 + 3, k, Math.PI / 2);
  box(g, 1.2, 2.2, 0.1, M.dark, -L / 2 - 0.05, 4.95, -D / 2 + 3, k, Math.PI / 2);
  box(g, 3, 0.15, 2.4, M.grey, ex, 3.9, -D / 2 + 3, k);
  rod(g, V(ex, 3.9, -D / 2 + 1.8), V(ex, 0.1, -D / 2 - 6), 0.5, M.grey, k, 4);
  for (let t = 0.06; t < 1; t += 0.065) { const q = V(ex, 3.9, -D / 2 + 1.8).lerp(V(ex, 0.1, -D / 2 - 6), t); box(g, 1.2, 0.05, 0.3, M.dark, q.x, q.y + 0.08, q.z, k); }
  for (const dx of [-0.65, 0.65]) rod(g, V(ex + dx, 4.9, -D / 2 + 1.8), V(ex + dx, 1.1, -D / 2 - 6), 0.04, M.dark, k, 4);
  box(g, 0.05, 1, 2.4, M.dark, ex - 1.5, 4.4, -D / 2 + 3, k);
  box(g, 4, 0.1, 3, M.concrete, ex - 0.4, 0.05, -D / 2 - 7, k);
  return g;
}

// ======================================================================
// Молниеотвод — решётчатая башня из четырёх поясов с крестовой решёткой, красно-белая, с площадками и шпилем.
export function buildLightningRod(p, x, z, H = 48, gy = G) {
  const k = 'rods', levels = [0, 7, 14, 21, 28, 35, 42, H];
  const G0 = gy;
  const w = (y) => 3.2 - (y / H) * 2.4;
  const corners = (y) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => V(x + a * w(y), G0 + y, z + b * w(y)));
  for (let i = 0; i < levels.length - 1; i++) {
    const m = i % 2 ? M.white : M.red;
    const A = corners(levels[i]), B = corners(levels[i + 1]);
    for (let c = 0; c < 4; c++) {
      rod(p, A[c], B[c], 0.14, m, k, 6);
      const n = (c + 1) % 4;
      rod(p, A[c], B[n], 0.06, m, k, 4);
      rod(p, A[n], B[c], 0.06, m, k, 4);
      rod(p, B[c], B[n], 0.07, m, k, 4);
    }
  }
  for (const y of [21, 35]) {
    box(p, w(y) * 2 + 1.2, 0.12, w(y) * 2 + 1.2, M.white, x, G0 + y + 0.05, z, k);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) rod(p, V(x + a * (w(y) + 0.6), G0 + y, z + b * (w(y) + 0.6)), V(x + a * (w(y) + 0.6), G0 + y + 1.1, z + b * (w(y) + 0.6)), 0.04, M.white, k, 4);
  }
  rod(p, V(x, G0 + H, z), V(x, G0 + H + 7, z), 0.09, M.steel, k, 6);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(p, 1.2, 0.6, 1.2, M.concrete, x + a * w(0), G0 + 0.3, z + b * w(0), k);
}

// ======================================================================
// Насосная станция — разрез: двускатная синяя кровля (южный скат прозрачный), белые стены с синим цоколем,
// четыре магистральных насоса (синие корпуса с красным поясом, жёлтые болты) с электродвигателями,
// белые трубопроводы с красными полосами, кран-балка; снаружи — подпорные вертикальные насосы на площадках.
export function buildPumpStation(p, {cx = 2296, cz = 453, cy = G, scale = 1, key = 'pumpst'} = {}) {
  const k = key, L = 72, D = 26, H = 10;
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  g.scale.setScalar(scale);
  p.add(g);
  box(g, L, 0.3, D, M.floor, 0, 0.15, 0, k);
  for (let x = -L / 2 + 4; x < L / 2; x += 6) box(g, 0.08, 0.02, D - 2, M.yellow, x, 0.32, 0, k);
  // Стены: север и торцы целиком, юг — только цоколь (разрез).
  box(g, L, H, 0.4, M.white, 0, H / 2, D / 2, k);
  box(g, L, 1.4, 0.45, M.blue, 0, 0.7, D / 2 + 0.02, k);
  box(g, L, 0.8, 0.45, M.blue, 0, H - 0.4, D / 2 + 0.02, k);
  box(g, L - 6, 1.6, 0.45, M.glass, 0, 6.6, D / 2 + 0.03, k);
  for (const s of [-1, 1]) {
    box(g, 0.4, H, D, M.white, s * L / 2, H / 2, 0, k);
    box(g, 0.45, 1.4, D, M.blue, s * (L / 2 + 0.02), 0.7, 0, k);
    const gab = new THREE.Shape();
    gab.moveTo(-D / 2, 0); gab.lineTo(D / 2, 0); gab.lineTo(0, 5); gab.closePath();
    const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(gab, {depth: 0.4, bevelEnabled: false}), M.white);
    gm.rotation.y = Math.PI / 2;
    gm.position.set(s * L / 2 - 0.2, H, 0);
    gm.userData.key = k;
    g.add(gm);
  }
  box(g, L, 1.4, 0.45, M.blue, 0, 0.7, -D / 2, k);
  // Кровля: северный скат синий, южный — прозрачный.
  const slope = Math.atan2(5, D / 2), sl = Math.hypot(5, D / 2) + 0.6;
  for (const s of [-1, 1]) {
    const rf = new THREE.Mesh(new THREE.BoxGeometry(L + 1.4, 0.3, sl), s > 0 ? M.blue : M.roofGlass);
    rf.position.set(0, H + 2.5, s * D / 4);
    rf.rotation.x = s * slope;
    rf.userData.key = k;
    g.add(rf);
  }
  // Магистральные насосные агрегаты.
  const stripes = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const x2 = c.getContext('2d');
    x2.fillStyle = '#ffd21f'; x2.fillRect(0, 0, 64, 64);
    x2.fillStyle = '#1a1a1a';
    for (let i = -64; i < 128; i += 22) { x2.beginPath(); x2.moveTo(i, 0); x2.lineTo(i + 11, 0); x2.lineTo(i + 75, 64); x2.lineTo(i + 64, 64); x2.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map: t, roughness: 0.5});
  })();
  const pumpBlue = mat(0x1e62c8, {roughness: 0.35, metalness: 0.3});
  for (const x of [-24, -8, 8, 24]) {
    box(g, 9.5, 0.5, 5, M.grey, x + 2, 0.55, 0, k);
    const casing = cyl(g, 1.7, 2.6, pumpBlue, x, 2.6, 0, k, [0, 0, Math.PI / 2], 28);
    casing.scale.set(1, 1, 1.1);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), pumpBlue);
    top.scale.set(1.25, 0.6, 1.05);
    top.position.set(x, 3.2, 0);
    top.userData.key = k;
    g.add(top);
    box(g, 2.7, 0.35, 4.1, M.red, x, 2.75, 0, k);                                                    // пояс разъёма
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), M.yellow);
      b.position.set(x - 1.2 + (i % 5) * 0.6, 2.98, i < 5 ? 1.95 : -1.95);
      g.add(b);
    }
    cyl(g, 0.8, 2.2, M.yellow, x + 2.2, 2.6, 0, k, [0, 0, Math.PI / 2]);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.5), stripes);
    guard.position.set(x + 2.2, 2.6, 0);
    g.add(guard);
    cyl(g, 1.35, 3.6, mat(0x2b5f9e, {metalness: 0.4}), x + 4.9, 2.6, 0, k, [0, 0, Math.PI / 2], 24);  // двигатель
    for (let f = 0; f < 7; f++) ring(g, V(x + 3.4 + f * 0.5, 2.6, 0), V(1, 0, 0), 1.38, 0.06, mat(0x2b5f9e), k);
    // Всас и нагнетание: белые трубы с красными полосами.
    pipe(g, [V(x, 2.6, -2), V(x, 2.6, -6), V(x, -0.5, -6)], 0.7, M.white, k, {supports: false, R: 1.6});
    pipe(g, [V(x, 4, 0), V(x, 7, 0), V(x, 7, 9), V(x, 2.2, 9)], 0.6, M.white, k, {supports: false, R: 1.4});
    for (const q of [V(x, 2.6, -4.3), V(x, 7, 5)]) ring(g, q, q.z < 0 ? V(0, 0, 1) : V(0, 0, 1), 0.74, 0.12, M.red, k);
    box(g, 1, 1.8, 0.6, M.dark, x - 3, 0.9, 3, k);                                                  // щит управления
  }
  // Коллектор нагнетания вдоль северной стены и выход к магистралям.
  pipe(g, [V(-L / 2 + 2, 2.2, 9), V(L / 2 + 2, 2.2, 9)], 0.8, M.white, k, {supports: false});
  for (let x = -L / 2 + 6; x < L / 2; x += 9) ring(g, V(x, 2.2, 9), V(1, 0, 0), 0.85, 0.14, M.red, k);
  // Кран-балка.
  for (const z of [-D / 2 + 1, D / 2 - 1]) box(g, L - 2, 0.5, 0.5, M.yellow, 0, H - 1.2, z, k);
  box(g, 1.2, 1.2, D - 2, M.yellow, -10, H - 0.7, 0, k);
  box(g, 1.4, 1, 1.6, M.dark, -10, H - 1.7, 2, k);
  // Вытяжная труба.
  cyl(g, 0.7, 22, M.grey, L / 2 - 3, 11, D / 2 + 2, k);
  // Подпорные насосы снаружи — вертикальные, на площадках с лестницами.
  for (const x of [-27, -13, 1, 15]) {
    const zb = D / 2 + 9;
    cyl(g, 0.9, 1.2, M.dark, x, 0.6, zb, k);
    cyl(g, 0.55, 4.2, pumpBlue, x, 3.2, zb, k);
    cyl(g, 0.85, 0.9, pumpBlue, x, 2.2, zb, k);
    cyl(g, 0.8, 1.6, M.red, x, 6.2, zb, k);
    box(g, 3.2, 0.15, 3.2, M.yellow, x, 5.2, zb, k);
    for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) box(g, 0.1, 6.2, 0.1, M.yellow, x + a, 3.1, zb + b, k);
    for (const s of [-1.6, 1.6]) rod(g, V(x - 1.6, 6.3, zb + s), V(x + 1.6, 6.3, zb + s), 0.04, M.yellow, k, 4);
    rod(g, V(x + 1.7, 5.2, zb), V(x + 5.5, 0.1, zb), 0.45, M.yellow, k, 4);
    pipe(g, [V(x, 1.4, zb), V(x, 1.4, D / 2 + 3), V(x, 1.4, 6), V(x, 2.6, 6)], 0.35, M.white, k, {supports: false, R: 1});
  }
  return {out: [V(cx + L / 2 + 2, G + 2.2, cz + 9)]};
}

// ======================================================================
// Маркировка резервуаров «Транснефть»: одна текстура-атлас (две дуги — синяя и красная, название, номер).
export {M as FARM_MAT};
export function tankMarkings(p, tanks, tankR, tankH) {
  const COLS = 4, ROWS = 8, CW = 512, CH = 128;
  const cv = document.createElement('canvas');
  cv.width = CW * COLS; cv.height = CH * ROWS;
  const g = cv.getContext('2d');
  tanks.forEach((tk, i) => {
    const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
    g.save();
    g.translate(ox, oy);
    g.lineWidth = 9; g.lineCap = 'round';
    g.strokeStyle = '#1d4fa0';
    g.beginPath(); g.moveTo(22, 120); g.bezierCurveTo(40, 70, 55, 30, 70, 6); g.stroke();
    g.strokeStyle = '#d8262a';
    g.beginPath(); g.moveTo(42, 122); g.bezierCurveTo(60, 72, 75, 32, 90, 8); g.stroke();
    g.fillStyle = '#1d4fa0';
    g.font = '800 58px Inter, Segoe UI, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('ТРАНСНЕФТЬ', 112, 44);
    g.font = '700 30px Inter, Segoe UI, sans-serif';
    g.fillStyle = '#20262c';
    g.fillText(`Р-${i + 1} · Нефть · Огнеопасно`, 114, 98);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2});
  const arc = 0.95;
  tanks.forEach((tk, i) => {
    const geo = new THREE.CylinderGeometry(tankR + 0.08, tankR + 0.08, 8.5, 40, 1, true, Math.PI * 1.5 - arc / 2, arc);
    const uv = geo.attributes.uv, u0 = (i % COLS) / COLS, v1 = 1 - Math.floor(i / COLS) / ROWS;
    for (let n = 0; n < uv.count; n++) uv.setXY(n, u0 + uv.getX(n) / COLS, v1 - (1 - uv.getY(n)) / ROWS);
    const d = new THREE.Mesh(geo, m);
    d.position.set(tk.x, G + 0.4 + tankH * 0.55, tk.z);
    d.userData.noCast = true;
    d.userData.key = tk.target ? 'tanks' : 'farm';
    p.add(d);
  });
}
