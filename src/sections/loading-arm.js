// Морской стендер (по фото): основание с косынками, синий стояк с лестницей в ограждении и гидростанцией,
// поворотная голова; внутреннее плечо с жёлтым противовесом и большим зубчатым шкивом на заднем конце,
// площадкой оператора; балка-пантограф над плечом; наружное плечо — синий коробчатый рычаг с отверстиями
// и серебристая труба; тройной шарнир с клапаном и быстроразъёмным соединителем висит вертикально.
// solve(T) раскладывает плечи так, чтобы соединитель пришёл во фланец манифольда T.
import * as THREE from 'three';

const L1 = 13, L2 = 13, SWIVEL = 2.6;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = {
  blue: new THREE.MeshStandardMaterial({color: 0x2a86c8, roughness: 0.42, metalness: 0.3}),
  yellow: new THREE.MeshStandardMaterial({color: 0xe3a21f, roughness: 0.45, metalness: 0.25}),
  silver: new THREE.MeshStandardMaterial({color: 0xcfd6dc, roughness: 0.22, metalness: 0.9}),
  grey: new THREE.MeshStandardMaterial({color: 0x8f989f, roughness: 0.4, metalness: 0.7}),
  dark: new THREE.MeshStandardMaterial({color: 0x1d2a35, roughness: 0.6}),
  green: new THREE.MeshStandardMaterial({color: 0x2f8a5a, roughness: 0.45, metalness: 0.3}),
  red: new THREE.MeshStandardMaterial({color: 0xd83a2a, roughness: 0.45}),
};
const Y = V(0, 1, 0);

function mesh(geo, mat, parent, x = 0, y = 0, z = 0, rot) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  if (rot) o.rotation.set(...rot);
  o.userData.key = 'arms';
  parent.add(o);
  return o;
}
const rod = (parent, a, b, r, mat, seg = 10) => {
  const d = b.clone().sub(a), len = d.length();
  const o = mesh(new THREE.CylinderGeometry(r, r, len, seg), mat, parent);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(Y, d.normalize());
  return o;
};

export function makeArm(base) {
  const g = new THREE.Group();
  g.userData.dynamic = true;
  const P = base.clone().add(V(0, 13, 0));
  const u = V(-1, 0, 0); // к морю

  // ---------- неподвижная часть ----------
  mesh(new THREE.BoxGeometry(4.6, 0.4, 4.6), M.blue, g, base.x, base.y + 0.2, base.z);
  for (let k = 0; k < 4; k++) {                                                   // косынки
    const a = (k / 4) * Math.PI * 2;
    const gs = mesh(new THREE.BoxGeometry(0.12, 1.6, 1.5), M.blue, g, base.x + Math.cos(a) * 1.1, base.y + 1.1, base.z + Math.sin(a) * 1.1);
    gs.rotation.y = -a;
  }
  const riserTop = P.y - 1.1;
  mesh(new THREE.CylinderGeometry(0.62, 0.7, riserTop - base.y - 0.4, 24), M.blue, g, base.x, (riserTop + base.y + 0.4) / 2, base.z);
  for (const k of [0.3, 0.62]) mesh(new THREE.TorusGeometry(0.66, 0.1, 8, 24), M.blue, g, base.x, base.y + (riserTop - base.y) * k, base.z, [Math.PI / 2, 0, 0]);
  // Лестница с ограждением на стороне берега.
  const lx = base.x + 1.05, y0 = base.y + 1.2, y1 = riserTop - 0.6;
  for (const dz of [-0.32, 0.32]) rod(g, V(lx, y0, base.z + dz), V(lx, y1, base.z + dz), 0.04, M.grey, 6);
  for (let y = y0 + 0.3; y < y1; y += 0.3) rod(g, V(lx, y, base.z - 0.32), V(lx, y, base.z + 0.32), 0.022, M.grey, 4);
  for (let y = y0 + 2; y < y1; y += 0.9) mesh(new THREE.TorusGeometry(0.45, 0.025, 4, 16, Math.PI), M.grey, g, lx + 0.02, y, base.z, [Math.PI / 2, 0, -Math.PI / 2]);
  for (const dz of [-0.45, 0, 0.45]) rod(g, V(lx + 0.45, y0 + 2, base.z + dz), V(lx + 0.45, y1, base.z + dz), 0.02, M.grey, 4);
  // Гидростанция у основания.
  const hx = base.x + 2.4, hz = base.z - 2.2;
  mesh(new THREE.BoxGeometry(2.6, 0.15, 1.6), M.blue, g, hx, base.y + 0.5, hz);
  for (const [dx, dz] of [[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]]) mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), M.blue, g, hx + dx, base.y + 0.9, hz + dz);
  mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), M.blue, g, hx, base.y + 1.6, hz - 0.7);
  mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16), M.green, g, hx - 0.4, base.y + 0.95, hz, [0, 0, Math.PI / 2]);
  mesh(new THREE.BoxGeometry(0.8, 0.6, 0.9), M.grey, g, hx + 0.6, base.y + 0.9, hz);
  rod(g, V(hx + 0.6, base.y + 1.2, hz), V(base.x + 0.7, base.y + 2.2, base.z - 0.3), 0.06, M.blue, 6);
  // Поворотная голова.
  mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.45, 28), M.grey, g, P.x, riserTop + 0.2, P.z);
  mesh(new THREE.BoxGeometry(1.5, 1.2, 1.7), M.blue, g, P.x, riserTop + 0.9, P.z);

  // ---------- внутреннее плечо (поворачивается вокруг P) ----------
  const inner = new THREE.Group();
  inner.position.copy(P);
  g.add(inner);
  mesh(new THREE.CylinderGeometry(0.46, 0.46, L1 + 7, 20), M.blue, inner, (L1 - 7) / 2, 0, 0, [0, 0, Math.PI / 2]);
  for (const x of [-1, 4, 8.5]) mesh(new THREE.TorusGeometry(0.5, 0.09, 8, 22), M.blue, inner, x, 0, 0, [0, Math.PI / 2, 0]);
  mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 20), M.grey, inner, 0, 0, 0, [Math.PI / 2, 0, 0]);   // шарнир
  // Противовес и зубчатый шкив на заднем конце.
  const cw = mesh(new THREE.BoxGeometry(1.4, 4.6, 2.5), M.yellow, inner, -6.6, 1.6, 0);
  cw.rotation.z = -0.55;
  mesh(new THREE.BoxGeometry(0.2, 3.4, 2.6), M.dark, inner, -5.9, 1.0, 0, [0, 0, -0.55]);
  mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.32, 40), M.grey, inner, -4.7, -0.1, 0, [Math.PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(1.7, 0.09, 6, 48), M.dark, inner, -4.7, -0.1, 0);
  mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16), M.dark, inner, -4.7, -0.1, 0, [Math.PI / 2, 0, 0]);
  // Подкос под плечом и хомуты по трубе.
  rod(inner, V(-0.6, -0.55, 0), V(10.5, -0.55, 0), 0.06, M.grey, 6);
  rod(inner, V(0.4, -0.5, 0), V(2.4, -0.05, 0), 0.08, M.grey, 6);
  for (let x = 2; x < L1 - 1; x += 1.8) mesh(new THREE.BoxGeometry(0.08, 0.45, 0.5), M.dark, inner, x, 0.55, 0);
  // Площадка оператора с лестницей и перилами.
  mesh(new THREE.BoxGeometry(1.8, 0.1, 1.5), M.blue, inner, 1.6, 1.25, 0);
  for (const [x, z] of [[0.75, -0.7], [2.45, -0.7], [0.75, 0.7], [2.45, 0.7]]) mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), M.blue, inner, x, 1.8, z);
  mesh(new THREE.BoxGeometry(1.8, 0.05, 0.05), M.blue, inner, 1.6, 2.35, -0.7);
  mesh(new THREE.BoxGeometry(1.8, 0.05, 0.05), M.blue, inner, 1.6, 2.35, 0.7);
  mesh(new THREE.BoxGeometry(0.05, 0.05, 1.4), M.blue, inner, 2.45, 2.35, 0);
  for (const dz of [-0.25, 0.25]) rod(inner, V(1.0, 1.25, dz), V(1.0, 3.6, dz), 0.03, M.blue, 4);
  for (let y = 1.5; y < 3.6; y += 0.3) rod(inner, V(1.0, y, -0.25), V(1.0, y, 0.25), 0.02, M.blue, 4);

  // ---------- наружное плечо (висит от локтя) ----------
  const outer = new THREE.Group();
  g.add(outer);
  // Коробчатый рычаг: от вершины (над локтем) вниз, с отверстиями облегчения.
  mesh(new THREE.BoxGeometry(1.2, 10.6, 0.7), M.blue, outer, 0, -1.7, 0);
  mesh(new THREE.BoxGeometry(0.85, 10.2, 0.75), M.blue, outer, 0.18, -1.9, 0);
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14), M.dark, outer, 0, 2.6 - k * 1.7, s * 0.38, [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 18), M.grey, outer, 0, 0, 0, [Math.PI / 2, 0, 0]);    // локоть
  mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 18), M.grey, outer, 0, 3.6, 0, [Math.PI / 2, 0, 0]);  // вершина
  // Серебристая труба и гидролинии.
  mesh(new THREE.CylinderGeometry(0.32, 0.32, L2 - 7, 16), M.silver, outer, 0, -7 - (L2 - 7) / 2, 0);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, L2 - 6, 6), M.grey, outer, 0.5, -6.5 - (L2 - 6) / 2, 0.2);
  for (let k = 0; k < 4; k++) mesh(new THREE.TorusGeometry(0.36, 0.06, 6, 16), M.grey, outer, 0, -7.5 - k * 1.4, 0, [Math.PI / 2, 0, 0]);

  // ---------- пантограф: балка от шкива противовеса к вершине наружного плеча ----------
  const panto = new THREE.Group();
  g.add(panto);
  for (const dz of [-0.32, 0.32]) mesh(new THREE.BoxGeometry(1, 0.22, 0.1), M.blue, panto, 0.5, 0, dz);
  for (let k = 1; k < 18; k++) mesh(new THREE.BoxGeometry(0.008, 0.08, 0.64), M.blue, panto, k / 18, -0.06, 0);
  for (let k = 1; k < 7; k++) mesh(new THREE.TorusGeometry(0.22, 0.03, 4, 10, Math.PI), M.blue, panto, k / 7, 0.1, 0, [0, Math.PI / 2, 0]);

  // ---------- тройной шарнир, клапан, соединитель (вертикально под наружным плечом) ----------
  const sw = new THREE.Group();
  g.add(sw);
  mesh(new THREE.TorusGeometry(0.5, 0.3, 10, 18, Math.PI / 2), M.silver, sw, -0.5, 0, 0, [0, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 18), M.grey, sw, 0, -0.55, 0);
  mesh(new THREE.SphereGeometry(0.48, 16, 12), M.silver, sw, 0, -1.0, 0);                          // клапан
  mesh(new THREE.BoxGeometry(0.25, 0.5, 0.25), M.grey, sw, 0.5, -1.0, 0);                          // привод клапана
  mesh(new THREE.TorusGeometry(0.42, 0.26, 10, 18, Math.PI / 2), M.silver, sw, 0.42, -1.6, 0, [0, 0, Math.PI]);
  mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 18), M.grey, sw, 0, -2.0, 0);
  mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.35, 18), M.red, sw, 0, -2.4, 0);                    // соединитель
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    mesh(new THREE.BoxGeometry(0.08, 0.5, 0.14), M.grey, sw, Math.cos(a) * 0.58, -2.4, Math.sin(a) * 0.58);
  }
  rod(sw, V(-0.35, -0.3, 0.35), V(-0.35, -2.2, 0.35), 0.05, M.grey, 6);                           // гидроцилиндр

  // ---------- решение положения ----------
  const E = new THREE.Vector3();
  const stowed = P.clone().addScaledVector(u, 1.6).add(V(0, -9.5 - SWIVEL, 0));
  const basis = new THREE.Matrix4();
  const X = new THREE.Vector3(), Yv = new THREE.Vector3(), Z = V(0, 0, 1);
  const rear = new THREE.Vector3(), apex = new THREE.Vector3();
  function solve(T) {
    const tip = T.clone().add(V(0, SWIVEL, 0));
    const d = tip.clone().sub(P);
    const h = d.dot(u), v = d.y;
    const D = Math.min(Math.hypot(h, v), L1 + L2 - 0.01);
    const a = Math.atan2(v, h);
    const B = Math.acos(THREE.MathUtils.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
    const th = a + B; // локоть вверх
    // Внутреннее плечо: локальная +x — вдоль плеча к морю.
    X.copy(u).multiplyScalar(Math.cos(th)).add(V(0, Math.sin(th), 0)).normalize();
    Yv.crossVectors(Z, X).normalize();
    inner.quaternion.setFromRotationMatrix(basis.makeBasis(X, Yv, Z));
    inner.updateWorldMatrix(true, false);
    E.copy(P).addScaledVector(X, L1);
    E.z = P.z;
    // Наружное плечо: локальная −y — от локтя к концу.
    const down = tip.clone().sub(E).normalize();
    Yv.copy(down).negate();
    X.crossVectors(Yv, Z).normalize();
    outer.position.copy(E);
    outer.quaternion.setFromRotationMatrix(basis.makeBasis(X, Yv, Z));
    outer.updateWorldMatrix(true, false);
    // Пантограф.
    rear.set(-4.7, 2.0, 0); inner.localToWorld(rear);
    apex.set(0, 3.6, 0); outer.localToWorld(apex);
    const pd = apex.clone().sub(rear);
    panto.position.copy(rear);
    panto.quaternion.setFromUnitVectors(V(1, 0, 0), pd.clone().normalize());
    panto.scale.set(pd.length(), 1, 1);
    sw.position.copy(tip);
  }
  g.updateMatrixWorld(true);
  solve(stowed);
  return {group: g, solve, stowed, P, elbow: E};
}
