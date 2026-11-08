// Отгрузка нефти с платформы на танкер: насосная установка на кессоне → трубопровод вдоль стрелы
// устройства прямой отгрузки → шланг налива к носовому приёмному устройству танкера; швартовный канат.
import * as THREE from 'three';
import {TANKER_SCALE} from '../kit/models.js';

// Стрела устройства отгрузки (узел Kran_B_2 модели платформы): опора и вершина, мировые координаты.
const BOOM_BASE = new THREE.Vector3(43.5, 33, -51);
const BOOM_TIP = new THREE.Vector3(60.8, 67.5, -68.6);
const UP = new THREE.Vector3(0, 1, 0);

// tanker — группа танкера (метры, без масштаба), стоящая у платформы; приёмное устройство крепится к ней.
export function makeOffloading(tanker) {
  const group = new THREE.Group();
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.45, metalness: 0.35, ...o});
  const add = (parent, geo, material, key, pos, rot) => {
    const m = new THREE.Mesh(geo, material);
    m.userData.key = key;
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  const S = TANKER_SCALE;
  tanker.updateMatrixWorld(true);
  const onShip = (x, y, z) => tanker.localToWorld(new THREE.Vector3(x * S, y * S, z * S));
  const below = (v, d) => v.clone().add(new THREE.Vector3(0, -d, 0));

  const yellow = mat(0xffc21a), blue = mat(0x1d6fe0), red = mat(0xe8322a), orange = mat(0xff7a1a), dark = mat(0x2a3138);
  const steel = mat(0xc4ced6, {metalness: 0.85, roughness: 0.28});

  // --- Насосная установка: 3 агрегата «электродвигатель + центробежный насос» на общей раме ---
  const skid = new THREE.Group();
  skid.position.set(53, 20.2, -64);
  skid.rotation.y = Math.PI / 4;
  group.add(skid);
  add(skid, new THREE.BoxGeometry(13, 0.6, 7.5), yellow, 'pumps', [0, 0.3, 0]);
  for (const k of [-1, 0, 1]) {
    const x = k * 4;
    add(skid, new THREE.BoxGeometry(2.6, 0.8, 5.6), dark, 'pumps', [x, 1, 0]);
    add(skid, new THREE.CylinderGeometry(0.95, 0.95, 2.8, 24).rotateX(Math.PI / 2), blue, 'pumps', [x, 2.3, 1.2]); // двигатель
    for (let r = 0; r < 8; r++) add(skid, new THREE.TorusGeometry(0.98, 0.06, 6, 24), blue, 'pumps', [x, 2.3, 0.1 + r * 0.32]); // рёбра
    add(skid, new THREE.BoxGeometry(1.1, 1.0, 0.9), orange, 'pumps', [x, 2.2, -0.65]); // кожух муфты
    add(skid, new THREE.CylinderGeometry(1.2, 1.2, 0.9, 28).rotateX(Math.PI / 2), red, 'pumps', [x, 2.3, -1.6]); // улитка
    add(skid, new THREE.CylinderGeometry(0.42, 0.42, 1.8, 16).rotateX(Math.PI / 2), steel, 'pumps', [x, 2.3, -2.8]); // всас
    add(skid, new THREE.CylinderGeometry(0.42, 0.42, 1.6, 16), steel, 'pumps', [x, 1.6, -3.7]);
    add(skid, new THREE.CylinderGeometry(0.36, 0.36, 3.2, 16), steel, 'pumps', [x, 4.3, -1.6]); // нагнетание
    add(skid, new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), dark, 'pumps', [x, 4.1, -1.6]); // задвижка
    add(skid, new THREE.TorusGeometry(0.5, 0.08, 8, 24), red, 'pumps', [x + 0.6, 4.1, -1.6], [0, Math.PI / 2, 0]); // штурвал
  }
  add(skid, new THREE.CylinderGeometry(0.5, 0.5, 11.5, 20).rotateZ(Math.PI / 2), steel, 'pumps', [0, 5.9, -1.6]); // коллектор
  add(skid, new THREE.CylinderGeometry(0.55, 0.55, 10.5, 20).rotateZ(Math.PI / 2), steel, 'pumps', [0, 0.9, -3.7]); // приём
  add(skid, new THREE.CylinderGeometry(0.55, 0.55, 3, 20), steel, 'pumps', [5.5, -0.6, -3.7]); // из танков кессона
  add(skid, new THREE.BoxGeometry(2.2, 3.2, 1.2), mat(0xe6ebef), 'pumps', [-6, 2.2, 2.6]); // шкаф управления
  add(skid, new THREE.SphereGeometry(0.18, 12, 8), mat(0x22ff66, {emissive: 0x22ff66, emissiveIntensity: 2}), 'pumps', [-6.3, 3.4, 3.22]);
  skid.updateMatrixWorld(true);
  const headerEnd = skid.localToWorld(new THREE.Vector3(-5.75, 5.9, -1.6));
  const pumpOut = skid.localToWorld(new THREE.Vector3(0, 5.9, -1.6));

  // --- Трубопровод: от коллектора к опоре стрелы и вдоль стрелы до вершины ---
  const boomDir = BOOM_TIP.clone().sub(BOOM_BASE).normalize();
  const pipeCurve = new THREE.CatmullRomCurve3([
    headerEnd,
    new THREE.Vector3(BOOM_BASE.x + 2, headerEnd.y + 0.3, BOOM_BASE.z - 2),
    new THREE.Vector3(BOOM_BASE.x + 1.5, BOOM_BASE.y - 2, BOOM_BASE.z - 1.5),
    below(BOOM_BASE.clone().addScaledVector(boomDir, 6), 1.2),
    below(BOOM_TIP.clone().addScaledVector(boomDir, -3), 1.2),
    below(BOOM_TIP, 1.6),
  ], false, 'centripetal');
  add(group, new THREE.TubeGeometry(pipeCurve, 160, 0.4, 12), steel, 'pumps');
  for (let k = 0.1; k < 0.98; k += 0.09) { // хомуты-опоры
    const ring = add(group, new THREE.TorusGeometry(0.5, 0.1, 6, 16), yellow, 'pumps');
    ring.position.copy(pipeCurve.getPointAt(k));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pipeCurve.getTangentAt(k));
  }

  // --- Барабан-гусак на вершине стрелы ---
  const tipOut = below(BOOM_TIP, 2.8);
  add(group, new THREE.CylinderGeometry(1.7, 1.7, 2.2, 28).rotateX(Math.PI / 2), orange, 'hose',
    [BOOM_TIP.x, BOOM_TIP.y - 1.7, BOOM_TIP.z], [0, Math.PI / 4, 0]);

  // --- Носовое приёмное устройство танкера ---
  const station = new THREE.Group();
  station.position.set(0, 5.4 * S, -52.5 * S);
  tanker.add(station);
  add(station, new THREE.BoxGeometry(6, 3.2, 4), mat(0xf4f4f0), 'tanker', [0, 1.6, 0]);
  add(station, new THREE.BoxGeometry(6.2, 0.5, 4.2), red, 'tanker', [0, 3.3, 0]);
  add(station, new THREE.CylinderGeometry(0.75, 0.75, 1.8, 20), yellow, 'hose', [0, 4.4, -1.2]); // муфта аварийного разъединения
  station.updateMatrixWorld(true);
  const bowIn = station.localToWorld(new THREE.Vector3(0, 5.3, -1.2));

  // --- Шланг налива: провисает от стрелы к носу танкера ---
  const hosePts = [];
  for (let i = 0; i <= 40; i++) {
    const s = i / 40;
    const p = tipOut.clone().lerp(bowIn, s);
    p.y -= 22 * 4 * s * (1 - s);
    hosePts.push(p);
  }
  const hose = new THREE.CatmullRomCurve3(hosePts);
  const hoseMesh = add(group, new THREE.TubeGeometry(hose, 220, 0.5, 14), mat(0x15171a, {roughness: 0.7, metalness: 0}), 'hose');
  const collars = [];
  const L = hose.getLength();
  for (let d = 4; d < L - 3; d += 5.5) { // яркие поплавковые манжеты
    const k = d / L;
    const c = add(group, new THREE.CylinderGeometry(0.82, 0.82, 1.2, 18), mat(0xff3d1f, {roughness: 0.5, metalness: 0}), 'hose');
    c.position.copy(hose.getPointAt(k));
    c.quaternion.setFromUnitVectors(UP, hose.getTangentAt(k));
    collars.push({mesh: c, k});
  }

  // --- Швартовный канат: кнехт на углу кессона → носовой клюз танкера ---
  const F = new THREE.Vector3(57.5, 20.6, -68.5);
  const T = onShip(0, 6.2, -57);
  add(group, new THREE.CylinderGeometry(0.7, 0.9, 1.6, 16), dark, 'hawser', [F.x, F.y + 0.8, F.z]);
  const hawPts = [];
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    const p = F.clone().add(new THREE.Vector3(0, 1.2, 0)).lerp(T, s);
    p.y -= 3.5 * 4 * s * (1 - s);
    hawPts.push(p);
  }
  const hawserMesh = add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hawPts), 80, 0.28, 8),
    mat(0xfff2b0, {roughness: 0.9, metalness: 0}), 'hawser');

  // Путь нефти для анимации: насосы → стрела → шланг → танкер.
  const flowCurve = new THREE.CatmullRomCurve3([pumpOut, ...pipeCurve.getSpacedPoints(30), ...hosePts]);

  // Отсоединение: k = 0 — шланг и швартов на месте, 1 — шланг поднят к стреле, швартов отдан.
  const tubeCount = (m) => m.geometry.index.count;
  const disconnect = (k) => {
    const kh = THREE.MathUtils.clamp(k * 1.4, 0, 1), kw = THREE.MathUtils.clamp(k * 2 - 1, 0, 1);
    hoseMesh.geometry.setDrawRange(0, Math.round(tubeCount(hoseMesh) * (1 - kh) / 6) * 6);
    for (const c of collars) c.mesh.visible = c.k < 1 - kh;
    hawserMesh.geometry.setDrawRange(0, Math.round(tubeCount(hawserMesh) * (1 - kw) / 6) * 6);
    hawserMesh.visible = kw < 1;
    station.children[2].visible = kh < 0.98;
  };

  return {group, station, flowCurve, disconnect};
}
