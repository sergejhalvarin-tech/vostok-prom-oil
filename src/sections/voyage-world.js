// Мир рейса «платформа → терминал»: платформа, танкер с буксирами, отгрузка, терминал, лёд, след,
// потоки нефти. Всё состояние — функция времени рейса t (с), поэтому и раздел «Транспорт»,
// и облёт могут ставить любое время. update(t, dt, wall, playing) вызывается каждый кадр.
import * as THREE from 'three';
import {makeIce, makeFlow} from '../kit/sea.js';
import {loadPlatform, loadTanker, TANKER_AT_PLATFORM} from '../kit/models.js';
import {makeOffloading} from './offloading.js';
import {buildTerminal, makeMooring, BERTH, ARM_Z} from './terminal.js';
import {makeTug} from './tug.js';
import {mergeStatic} from '../kit/merge.js';

// Шкала времени рейса, с.
export const T = {disc: [0, 4], back: [4, 10], turn: [10, 15], sea: [15, 52], push: [52, 57], moor: [57, 63], arms: [63, 70], unload: [70, 106]};
export const T_END = 106;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const phase = (t, [a, b]) => clamp01((t - a) / (b - a));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const headingOf = (dir) => Math.atan2(-dir.x, -dir.z); // нос танкера — локальная −z
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ======================================================================
// Траектория танкера: заранее просчитанные положение и курс на каждые 1/20 с.
function planVoyage() {
  const start = TANKER_AT_PLATFORM.pos.clone(), rot0 = TANKER_AT_PLATFORM.rot;
  const stern = V(Math.sin(rot0), 0, Math.cos(rot0));
  const backed = start.clone().addScaledVector(stern, 80);
  const path = new THREE.CatmullRomCurve3([
    backed, V(420, 0, -365), V(800, 0, -470), V(1150, 0, -470), V(1380, 0, -400), V(1470, 0, -260), V(1494, 0, -110), V(1497, 0, 20),
  ], false, 'centripetal');
  const L = path.getLength();
  // Профиль скорости на переходе: разгон, ход, замедление у порта, подход малым ходом.
  const [s0, s1] = T.sea;
  const f = (t) => (t < s0 + 4 ? (t - s0) / 4 : t < 38 ? 1 : t < 46 ? 1 - 0.88 * ((t - 38) / 8) : t < 50 ? 0.12 : 0.12 * (1 - (t - 50) / 2));
  const DT = 0.05, n = Math.round(T.push[1] / DT) + 1;
  let F = 0;
  for (let t = s0; t < s1; t += DT) F += f(t) * DT;
  const scale = L / F;
  const h1 = headingOf(path.getTangentAt(0));
  const xs = new Float32Array(n), zs = new Float32Array(n), hs = new Float32Array(n), vs = new Float32Array(n);
  let dist = 0, h = rot0, p52 = null, h52 = 0;
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    let p;
    if (t < T.back[0]) p = start;
    else if (t < T.turn[0]) p = start.clone().lerp(backed, ease(phase(t, T.back)));
    else if (t < s0) { p = backed; h = rot0 + wrap(h1 - rot0) * ease(phase(t, T.turn)); }
    else if (t < s1) {
      p = path.getPointAt(Math.min(1, dist / L));
      const want = headingOf(path.getTangentAt(Math.min(1, dist / L)));
      h += THREE.MathUtils.clamp(wrap(want - h), -0.35 * DT, 0.35 * DT);
      vs[i] = f(t);
      dist += f(t) * scale * DT;
      p52 = p; h52 = h;
    } else {
      const k = ease(phase(t, T.push));
      p = p52.clone().lerp(BERTH.pos, k);
      h = h52 + wrap(BERTH.rot - h52) * k;
    }
    xs[i] = p.x; zs[i] = p.z; hs[i] = h;
  }
  return {
    path,
    pose(t, out) {
      if (t >= T.push[1]) { out.pos.copy(BERTH.pos); out.rot = BERTH.rot; out.v = 0; return out; }
      const x = Math.max(0, t) / DT, i = Math.floor(x), k = x - i, j = Math.min(n - 1, i + 1);
      out.pos.set(xs[i] + (xs[j] - xs[i]) * k, 0, zs[i] + (zs[j] - zs[i]) * k);
      out.rot = hs[i] + wrap(hs[j] - hs[i]) * k;
      out.v = vs[i];
      return out;
    },
  };
}

// Пенный след за кормой.
function makeWake() {
  const N = 900;
  const pos = new Float32Array(N * 3), age = new Float32Array(N).fill(99);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('age', new THREE.BufferAttribute(age, 1));
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `attribute float age; varying float vA;
      void main() { vA = age;
        // Погасшие частицы убираем за экран, размер ограничиваем: иначе вблизи они
        // превращаются в огромные прозрачные квадраты и съедают всю скорость отрисовки.
        if (age > 9.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min((14.0 + age * 9.0) * (300.0 / -mv.z), 72.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.95, 0.98, 1.0), (1.0 - smoothstep(0.2, 0.5, d)) * max(0.0, 0.55 - vA * 0.06)); }`,
  }));
  points.frustumCulled = false;
  points.renderOrder = 3;
  let head = 0, acc = 0;
  return {
    points,
    reset() { age.fill(99); geo.attributes.age.needsUpdate = true; },
    update(dt, stern, side, rate) {
      for (let i = 0; i < N; i++) age[i] += dt;
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const j = head++ % N;
        const sj = (Math.random() - 0.5) * 2;
        pos[j * 3] = stern.x + side.x * sj * 9; pos[j * 3 + 1] = 0.6; pos[j * 3 + 2] = stern.z + side.z * sj * 9;
        age[j] = 0;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.age.needsUpdate = true;
    },
  };
}

// ======================================================================
export function buildVoyageWorld(stage) {
  const plan = planVoyage();

  // Лёд у платформы, коридор по маршруту чистый.
  const samples = plan.path.getSpacedPoints(80);
  const ice = makeIce((x, z, size) => samples.some((p) => Math.hypot(p.x - x, p.z - z) < 70 + size)
    || Math.hypot(x - 210, z + 220) < 150 + size);
  stage.scene.add(ice);

  // Танкер (группа в метрах) и всё, что ездит с ним.
  const tanker = new THREE.Group();
  tanker.position.copy(TANKER_AT_PLATFORM.pos);
  tanker.rotation.y = TANKER_AT_PLATFORM.rot;
  stage.scene.add(tanker);
  const offload = makeOffloading(tanker);
  stage.scene.add(offload.group);
  stage.registerTree(offload.group);
  stage.registerTree(offload.station);
  const hoseFlow = makeFlow([offload.flowCurve], 140, 0xffa31a, 2.6, false, 30);
  stage.scene.add(hoseFlow.points);

  // Манифольд танкера: три приёмных патрубка по левому борту напротив стендеров.
  const S_MANI = ARM_Z.map((z) => V(-12.5, 9.2, BERTH.pos.z - z));
  const steel = new THREE.MeshStandardMaterial({color: 0xc4ced6, metalness: 0.8, roughness: 0.3});
  const red = new THREE.MeshStandardMaterial({color: 0xe8322a, roughness: 0.45});
  for (const m of S_MANI) {
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 14), steel);
    riser.position.copy(m).add(V(0, -0.8, 0));
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 18), red);
    flange.position.copy(m);
    const run = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12.5, 14).rotateZ(Math.PI / 2), steel);
    run.position.set(m.x / 2, m.y - 1.6, m.z);
    for (const o of [riser, flange, run]) { tanker.add(o); stage.register(o, 'tanker'); }
  }

  // Буксиры — дети танкера, чтобы двигаться с ним.
  const tugs = [makeTug('ВОСТОК-1'), makeTug('ВОСТОК-2')];
  const TUG_Z = [-30, 110];
  tugs.forEach((g) => { g.rotation.y = Math.PI / 2; tanker.add(g); stage.registerTree(g, 'tugs'); });

  // Терминал.
  const term = buildTerminal();
  mergeStatic(term.group);
  stage.scene.add(term.group);
  stage.registerTree(term.group);

  // Швартовы считаем по положению танкера у причала.
  const berthDummy = new THREE.Object3D();
  berthDummy.position.copy(BERTH.pos);
  berthDummy.rotation.y = BERTH.rot;
  const mooring = makeMooring(berthDummy);
  stage.scene.add(mooring.group);
  stage.registerTree(mooring.group, 'mooring');

  // Потоки нефти: манифольд → стендер → эстакада → резервуар (по одному на стендер/резервуар).
  berthDummy.updateMatrixWorld(true);
  const flowCurves = term.arms.map((arm, i) => {
    const M = berthDummy.localToWorld(S_MANI[i].clone());
    arm.solve(M);
    const z = ARM_Z[i];
    const pts = [M.clone().add(V(0, 1.6, 0)), arm.elbow.clone(), arm.P.clone(), V(arm.P.x, 8, z), V(arm.P.x + 1.5, 7.9, z), V(arm.P.x + 1.5, 7.9, -2),
      ...term.trunk.slice(1), ...term.branches[i].slice(1)];
    arm.solve(arm.stowed);
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  });
  const oil = makeFlow(flowCurves, 320, 0xffa31a, 1.3, false, 40);
  stage.scene.add(oil.points);

  const wake = makeWake();
  stage.scene.add(wake.points);

  const targets = term.tanks.filter((tk) => tk.target);
  const info = {
    pose: {pos: V(0, 0, 0), rot: 0, v: 0}, cargo: 70, knots: 0, status: '', tugsOn: false,
    tankerLabel: V(0, 0, 0), tugLabel: V(0, 0, 0), levels: targets.map(() => 0.3),
  };
  const sternW = V(0, 0, 0), sideW = V(0, 0, 0);

  function update(t, dt, wall, playing) {
    const pose = plan.pose(t, info.pose);
    const rise = 3 * clamp01(phase(t, T.unload));
    tanker.position.set(pose.pos.x, Math.sin(wall * 0.6) * 0.15 + rise, pose.pos.z);
    tanker.rotation.y = pose.rot;
    tanker.updateMatrixWorld(true);
    info.tankerLabel = tanker.localToWorld(V(0, 48, 30));

    // Отсоединение от платформы; пока шланг подключён — по нему идёт нефть.
    offload.disconnect(phase(t, T.disc));
    hoseFlow.points.visible = t < T.disc[0] + 0.8;
    hoseFlow.update(dt);

    // Пенный след за кормой на ходу.
    sternW.copy(tanker.localToWorld(V(0, 0, 170)));
    sideW.set(Math.cos(pose.rot), 0, -Math.sin(pose.rot));
    wake.update(playing ? dt : 0, sternW, sideW, pose.v * 160 + (t > T.back[0] && t < T.sea[0] ? 25 : 0));

    // Буксиры: подходят к правому борту и прижимают танкер к причалу.
    info.tugsOn = t > 42 && t < 61;
    const kPush = ease(phase(t, [49, 54]));
    tugs.forEach((g, i) => {
      g.visible = info.tugsOn;
      g.position.set(46 - 13 * kPush, -tanker.position.y + Math.sin(wall * 0.9 + i) * 0.2, TUG_Z[i]);
      if (info.tugsOn) g.userData.spin(dt, playing ? 0.4 + kPush : 0);
    });
    info.tugLabel = tanker.localToWorld(V(40, 22, TUG_Z[0]));

    // Швартовка и стендеры.
    mooring.set(phase(t, T.moor));
    const kArm = ease(phase(t, T.arms));
    term.arms.forEach((arm, i) => {
      const M = tanker.localToWorld(S_MANI[i].clone());
      arm.solve(arm.stowed.clone().lerp(M, kArm).add(V(0, 4 * Math.sin(Math.PI * kArm), 0)));
    });

    // Перекачка и уровень в резервуарах.
    oil.points.visible = t >= T.unload[0];
    oil.update(dt);
    targets.forEach((tk, i) => {
      const level = 0.3 + 0.55 * clamp01((t - T.unload[0] - i * 6) / 24);
      tk.setLevel(level);
      info.levels[i] = level;
    });

    info.cargo = 70 * (1 - clamp01(phase(t, T.unload)));
    info.knots = Math.round(14 * pose.v);
    info.status = t < T.back[0] ? 'Отсоединение от платформы' : t < T.sea[0] ? 'Отход и разворот'
      : t < 44 ? 'Переход морем' : t < T.moor[0] ? 'Подход к причалу' : t < T.arms[0] ? 'Швартовка'
      : t < T.unload[0] ? 'Подключение стендеров' : t < T_END ? 'Выгрузка в резервуары' : 'Выгрузка завершена';
    return info;
  }

  const load = (onProgress) => Promise.all([loadPlatform(stage, onProgress), loadTanker(stage, tanker)]);

  // Берег прячем, пока камера у платформы: с шельфа до суши около 60 км, а в сцене — меньше двух.
  const cullShore = (camera) => { term.group.visible = mooring.group.visible = camera.position.x > 650; };

  return {tanker, plan, ice, targets, update, load, cullShore, resetWake: () => wake.reset()};
}
