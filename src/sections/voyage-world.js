// Мир рейса «платформа → терминал»: платформа, танкер с буксирами, отгрузка, терминал, лёд, след,
// потоки нефти. Всё состояние — функция времени рейса t (с), поэтому и раздел «Транспорт»,
// и облёт могут ставить любое время. update(t, dt, wall, playing) вызывается каждый кадр.
import * as THREE from 'three';
import {makeIce, makeFlow, makeBeads, OIL} from '../kit/sea.js';
import {loadPlatform, loadTanker, TANKER_AT_PLATFORM} from '../kit/models.js';
import {makeOffloading} from './offloading.js';
import {buildTerminal, makeMooring, BERTH, ARM_Z} from './terminal.js';
import {makeTug} from './tug.js';
import {makeCrew} from './crew.js';
import {mergeStatic} from '../kit/merge.js';
import {buildMainline, buildStations, buildDepot, buildPowerTrunk} from './pipeline.js';
import {makeCoast, makeFarLand} from './landscape.js';
import {makeFauna} from './fauna.js';
import {buildRailway} from './railway.js';
import {buildRefinery} from './refinery.js';
import {makeTrain} from './train.js';
import {DEPOT_RACK} from './pipeline.js';
import {getRail, STATIONS, DEPOT, REFINERY, MAIN} from './landscape.js';
const MAIN_END = MAIN.x1;

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
        gl_PointSize = min((10.0 + age * 7.0) * (300.0 / -mv.z), 56.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.95, 0.98, 1.0), (1.0 - smoothstep(0.2, 0.5, d)) * max(0.0, 0.32 - vA * 0.035)); }`,
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

  // Буксиры живут в порту всегда: ждут у мола, подходят к танкеру, прижимают его к причалу и уходят обратно.
  const tugs = [makeTug('ВОСТОК-1'), makeTug('ВОСТОК-2')];
  const TUG_Z = [-30, 110];
  const TUG_WAIT = [{p: V(1385, 0, 265), rot: 0.3}, {p: V(1420, 0, 315), rot: -0.2}];
  tugs.forEach((g) => { stage.scene.add(g); stage.registerTree(g, 'tugs'); });

  // Экипаж на палубе: на баке, у манифольда и на крыльях мостика.
  const crew = makeCrew([
    V(-3, 7.8, -72), V(2.5, 7.8, -68), V(0.5, 7.8, -77),
    V(-10, 7.8, 30), V(-9, 7.8, 41), V(6, 7.8, 36),
    V(13.5, 21, 129), V(-13.5, 21, 129),
  ]);
  tanker.add(crew.group);

  // Терминал.
  const term = buildTerminal();
  mergeStatic(term.group);
  stage.scene.add(term.group);
  stage.scene.add(term.mountains);
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
  const oil = makeBeads(flowCurves, 420, 0.3, OIL, 34);
  stage.scene.add(oil.mesh);
  // Магистраль, промежуточные НПС и нефтебаза — за горами, отдельной группой (видны и с моря на горизонте).
  const inland = new THREE.Group();
  const lineG = new THREE.Group(), stG = new THREE.Group(), depG = new THREE.Group();
  const mainline = buildMainline(lineG);
  buildPowerTrunk(lineG);
  const stations = buildStations(stG);
  const depot = buildDepot(depG);
  // Каждую НПС — в свою группу (по положению), чтобы далёкие не рисовались.
  const stGroups = STATIONS.map(() => new THREE.Group());
  for (const o of [...stG.children]) {
    o.updateMatrixWorld(true);
    const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    let bi = 0, bd = 1e9;
    STATIONS.forEach((st, i) => { const d = Math.abs(wp.x - st.x); if (d < bd) { bd = d; bi = i; } });
    stGroups[bi].add(o);
  }
  for (const g of [lineG, depG, ...stGroups]) { mergeStatic(g); inland.add(g); }
  stage.scene.add(inland);
  const culls = [
    ...stGroups.map((g, i) => ({g, x: STATIONS[i].x, z: STATIONS[i].z, r: 400})),
    {g: depG, x: DEPOT.x, z: DEPOT.z, r: 900},
  ];
  const valley = makeCoast({x0: 6150, x1: 14900, seg: 330, density: {conifers: 16000, broadleaf: 9000, shrubs: 7000, rocks: 3000}});
  stage.scene.add(valley);                                                            // долина за хребтом
  const fauna = makeFauna();
  stage.scene.add(fauna.group);
  // Железная дорога к НПЗ: восточная долина с каньоном и хребтом, путь, мосты, терминал завода, поезд.
  const eastLand = makeCoast({x0: 14900, x1: 18900, seg: 151, density: {conifers: 9500, broadleaf: 5500, shrubs: 4000, rocks: 2600}});
  stage.scene.add(eastLand);
  const farLand = makeFarLand();
  stage.scene.add(farLand);
  const rail = new THREE.Group(), refG = new THREE.Group();
  buildRailway(rail, {sFrom: 720});
  const S_STOP = getRail().len - 62;
  const refinery = buildRefinery(refG, {sStop: S_STOP});
  mergeStatic(rail);
  mergeStatic(refG);
  rail.add(refG);
  culls.push({g: refG, x: REFINERY.x, z: REFINERY.z, r: 800});
  stage.scene.add(rail);
  stage.registerTree(rail);
  const train = makeTrain(stage, {cars: 20, extra: depot.empties});
  stage.scene.add(train.group);
  train.place(DEPOT_RACK.sHead);
  // На НПЗ: из цистерн в коллектор, в насосную и в резервуар (пока состав стоит у эстакады).
  const refFlow = makeBeads([new THREE.CatmullRomCurve3(refinery.flow, false, 'centripetal')], 260, 0.3, OIL, 24);
  refG.add(refFlow.mesh);
  stage.registerTree(inland);
  // Раздача: из резервуара по коллектору и эстакаде в насосную станцию и в магистральный нефтепровод.
  const outflow = makeBeads([new THREE.CatmullRomCurve3([...term.dispatchPath, ...mainline.curves[0].getSpacedPoints(400).slice(0, 6)], false, 'centripetal')], 260, 0.3, OIL, 22);
  term.group.add(outflow.mesh);
  // На нефтебазе: из магистрали в резервуар и на налив в цистерну.
  const depotFlow = makeBeads([new THREE.CatmullRomCurve3(depot.flow, false, 'centripetal')], 360, 0.3, OIL, 26);
  inland.add(depotFlow.mesh);

  const wake = makeWake();
  stage.scene.add(wake.points);

  const targets = term.tanks.filter((tk) => tk.target);
  const info = {
    pose: {pos: V(0, 0, 0), rot: 0, v: 0}, cargo: 70, knots: 0, status: '', tugsOn: false,
    tankerLabel: V(0, 0, 0), tugLabel: V(0, 0, 0), levels: targets.map(() => 0.3),
  };
  const sternW = V(0, 0, 0), sideW = V(0, 0, 0);

  const camPos = V(0, 0, 0);
  function update(t, dt, wall, playing, cam) {
    if (cam) camPos.copy(cam.position);
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

    // Буксиры: от места ожидания к правому борту танкера, упор, потом обратно к молу.
    info.tugsOn = t > 38 && t < 66;
    const kPush = ease(phase(t, [49, 54]));
    const kGo = ease(phase(t, [38, 46])) * (1 - ease(phase(t, [58, 66])));
    tugs.forEach((g, i) => {
      const at = tanker.localToWorld(V(46 - 13 * kPush, 0, TUG_Z[i]));
      const w = TUG_WAIT[i];
      const atRot = pose.rot + Math.PI / 2;
      g.position.set(w.p.x + (at.x - w.p.x) * kGo, Math.sin(wall * 0.9 + i) * 0.2, w.p.z + (at.z - w.p.z) * kGo);
      g.rotation.y = w.rot + Math.atan2(Math.sin(atRot - w.rot), Math.cos(atRot - w.rot)) * kGo;
      const moving = kGo > 0.02 && kGo < 0.98;
      g.userData.spin(dt, playing ? (moving ? 1.2 : info.tugsOn ? 0.4 + kPush : 0.15) : 0);
    });
    info.tugLabel = tugs[0].position.clone().add(V(0, 22, 0));

    crew.update(wall, camPos);

    // Швартовка и стендеры.
    mooring.set(phase(t, T.moor));
    const kArm = ease(phase(t, T.arms));
    term.arms.forEach((arm, i) => {
      const M = tanker.localToWorld(S_MANI[i].clone());
      arm.solve(arm.stowed.clone().lerp(M, kArm).add(V(0, 4 * Math.sin(Math.PI * kArm), 0)));
    });

    // Перекачка и уровень в резервуарах.
    oil.mesh.visible = t >= T.unload[0];
    outflow.update(dt);
    depotFlow.update(dt);
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

  let models = null;
  const load = (onProgress) => Promise.all([loadPlatform(stage, onProgress), loadTanker(stage, tanker)]).then((m) => (models = m));

  // Берег прячем, пока камера у платформы: с шельфа до суши около 60 км, а в сцене — меньше двух.
  const cullShore = (camera) => {
    const cx = camera.position.x, cz = camera.position.z;
    term.group.visible = mooring.group.visible = tugs[0].visible = tugs[1].visible = cx > 650 && cx < 6500;
    term.mountains.visible = cx < 10000;
    if (models) { models[0].visible = cx < 4500; tanker.visible = cx < 6500; }
    oil.mesh.visible = cx < 6500;
    lineG.visible = cx < MAIN_END + 3600;
    train.setExtras(Math.hypot(DEPOT.x - cx, DEPOT.z - cz) < 3200);
    // Далёкие площадки (за туманом) не рисуются.
    for (const c of culls) c.g.visible = Math.hypot(c.x - cx, c.z - cz) < 5200 + c.r;
    term.mountains.userData.update(camera.position);
    valley.userData.update(camera.position);
    fauna.update(camera.position);
    const east = camera.position.x > 9000;
    rail.visible = eastLand.visible = train.group.visible = east;
    // Под водой и в разрезе пластов суша не видна — не рисуем её.
    const dry = camera.position.y > -1;
    farLand.visible = valley.visible = inland.visible = dry;
    if (!dry) { term.mountains.visible = false; rail.visible = eastLand.visible = train.group.visible = false; }
    if (east) eastLand.userData.update(camera.position);
  };
  // Поезд: голова на пути s; у НПЗ — слив нефти.
  let trainS = DEPOT_RACK.sHead;
  const setTrain = (s, dt = 0) => { if (s !== trainS || !train.placed) { trainS = s; train.place(s, dt); train.placed = true; } refFlow.mesh.visible = s >= S_STOP - 0.5; };
  stage.onFrame((dt) => { refinery.update(performance.now() / 1000); if (refFlow.mesh.visible) refFlow.update(dt); });

  return {tanker, plan, ice, targets, update, load, cullShore, stations, depot, fauna, train, setTrain, S_STOP, S_LOAD: DEPOT_RACK.sHead, resetWake: () => wake.reset()};
}
