// Этап 2. Транспорт: танкер отходит от платформы, идёт к берегу, швартуется у причала терминала,
// подключаются морские стендеры, и нефть перекачивается в резервуарный парк.
// Всё движение — функция времени T (секунды), поэтому любой шаг можно открыть сразу.
import * as THREE from 'three';
import {mountStory} from '../kit/story.js';
import {makeIce, makeFlow} from '../kit/sea.js';
import {loadPlatform, loadTanker, TANKER_AT_PLATFORM} from '../kit/models.js';
import {makeOffloading} from './offloading.js';
import {buildTerminal, makeMooring, makeTug, BERTH, ARM_Z, TARGET_TANKS} from './terminal.js';
import {CREDITS} from './shelf.js';

const NAMES = {
  tanker: 'Челночный танкер ледового класса',
  tugs: 'Буксиры',
  mooring: 'Швартовные концы',
  jetty: 'Причал на сваях, отбойные и швартовные палы',
  arms: 'Морские стендеры',
  pipes: 'Трубопроводы и насосная станция',
  tanks: 'Резервуары, принимающие нефть',
  farm: 'Резервуарный парк',
  kupon: 'Устройство прямой отгрузки на платформе',
  hose: 'Шланг налива',
  pumps: 'Насосы отгрузки',
};

// Шкала времени рейса, с.
const T = {disc: [0, 4], back: [4, 10], turn: [10, 15], sea: [15, 52], push: [52, 57], moor: [57, 63], arms: [63, 70], unload: [70, 106]};
const T_END = 106;

const STEPS = [
  {
    title: 'Отход от платформы', t0: 0, focus: 'tanker', also: ['hose', 'kupon'],
    cam: [420, 200, 190], tgt: [120, 10, -140],
    html: `<p>Танки танкера заполнены. Налив прекращают, шланг поднимают на стрелу устройства отгрузки, швартовный канат отдают.</p>
      <p>Танкер отходит от платформы задним ходом и разворачивается носом к берегу с помощью подруливающих устройств.</p>`,
  },
  {
    title: 'Переход морем', t0: 15, focus: 'tanker', follow: true,
    html: `<p>Челночный танкер ледового класса сам идёт через битый лёд. На борту около 70 тысяч тонн нефти.</p>
      <p>Путь до берегового терминала занимает несколько суток, здесь время сильно ускорено. Камера следует за танкером, и её можно вращать.</p>`,
  },
  {
    title: 'Швартовка у причала', t0: 44, focus: 'tugs', also: ['mooring', 'jetty'],
    cam: [1330, 120, 250], tgt: [1520, 5, 20],
    html: `<p>У входа в порт танкер встречают буксиры. Они разворачивают его и мягко прижимают левым бортом к причалу.</p>
      <p>Удар гасят <b>кранцы</b> на отбойных палах. Затем швартовщики заводят <b>швартовные концы</b> на гаки швартовных палов: с носа, с кормы и по борту.</p>`,
  },
  {
    title: 'Подключение стендеров', t0: 63, focus: 'arms',
    cam: [1478, 34, -58], tgt: [1522, 13, 2],
    html: `<p><b>Морские стендеры</b> — это шарнирные стальные трубопроводы с противовесами. Их разворачивают с причала и стыкуют с манифольдом танкера — приёмо-сдаточным узлом на палубе.</p>
      <p>Шарниры позволяют стендеру следовать за танкером: судно всплывает по мере выгрузки и покачивается на волне.</p>`,
  },
  {
    title: 'Перекачка в резервуары', t0: 70, focus: 'pipes', also: ['arms', 'tanks'],
    cam: [1440, 230, -430], tgt: [1660, 5, -40],
    html: `<p>Нефть откачивают <b class="c-oil">грузовые насосы танкера</b>. Через стендеры она уходит в трубопровод на эстакаде причала, затем по эстакаде вдоль берега попадает в резервуары.</p>
      <p>Чем меньше груза остаётся, тем выше поднимается танкер: его осадка уменьшается.</p>`,
  },
  {
    title: 'Резервуарный парк', t0: 88, focus: 'tanks', also: ['farm'],
    cam: [1700, 150, -330], tgt: [1880, 12, 40],
    html: `<p>Нефть принимают в вертикальные стальные резервуары объёмом в десятки тысяч кубометров.</p>
      <p>У многих резервуаров <b>плавающая крыша</b>. Она лежит прямо на нефти и поднимается вместе с уровнем, поэтому над нефтью не скапливаются пары. Каждая группа резервуаров окружена обвалованием на случай разлива.</p>
      <p>Отсюда нефть по трубопроводу уходит на нефтеперерабатывающий завод. Это следующий этап.</p>`,
  },
];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const phase = (t, [a, b]) => clamp01((t - a) / (b - a));
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
      void main() { vA = age; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (14.0 + age * 9.0) * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
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
export function mountTransport(root, sec, next) {
  return mountStory(root, {
    stageNo: 2,
    title: 'Транспорт: от платформы до берега',
    lead: 'Танкер забирает нефть у платформы, идёт к береговому терминалу и выгружает её в резервуары. Анимация идёт сама; шаг можно выбрать справа.',
    steps: STEPS,
    names: NAMES,
    next,
    credits: CREDITS + ' Терминал, причал, стендеры, буксиры и резервуары нарисованы по фотографии порта.',
    tools: [{id: 'bPlay', label: '❚❚ Пауза', title: 'Остановить или продолжить анимацию'}],
    hotspots: [
      {key: 'tanker', step: 1, p: () => tankerLabel},
      {key: 'tugs', step: 2, p: () => tugLabel, visible: () => tugsOn},
      {key: 'jetty', step: 2, p: [1545, 24, -32]},
      {key: 'arms', step: 3, p: [1528, 34, 6]},
      {key: 'pipes', step: 4, p: [1640, 15, -2]},
      {key: 'farm', step: 5, p: [1965, 36, -300]},
    ],
    build,
  });
}

let tankerLabel = V(0, 0, 0), tugLabel = V(0, 0, 0), tugsOn = false;

function build(stage, api) {
  const plan = planVoyage();
  let t = 0, playing = true;

  // Лёд у платформы, коридор по маршруту чистый.
  const samples = plan.path.getSpacedPoints(80);
  stage.scene.add(makeIce((x, z, size) => samples.some((p) => Math.hypot(p.x - x, p.z - z) < 70 + size)
    || Math.hypot(x - 210, z + 220) < 150 + size));

  // Танкер (группа в метрах) и всё, что ездит с ним.
  const tanker = new THREE.Group();
  tanker.position.copy(TANKER_AT_PLATFORM.pos);
  tanker.rotation.y = TANKER_AT_PLATFORM.rot;
  stage.scene.add(tanker);
  const offload = makeOffloading(tanker);
  stage.scene.add(offload.group);
  stage.registerTree(offload.group);
  stage.registerTree(offload.station);

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
  const tugs = [makeTug(), makeTug()];
  const TUG_Z = [-30, 110];
  tugs.forEach((g) => { g.rotation.y = Math.PI / 2; tanker.add(g); stage.registerTree(g, 'tugs'); });

  // Терминал.
  const term = buildTerminal();
  stage.scene.add(term.group);
  stage.registerTree(term.group);
  for (const tk of term.tanks) tk.group.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));

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
  const oil = makeFlow(flowCurves, 260, 0xffa31a, 2.2, false, 40);
  stage.scene.add(oil.points);

  const wake = makeWake();
  stage.scene.add(wake.points);

  // Подписи уровня в принимающих резервуарах.
  const targets = term.tanks.filter((tk) => tk.target);
  const levelLabels = targets.map((tk, i) => stage.addLabel({
    html: '', cls: 'level', at: V(tk.x, 34, tk.z), visible: () => t >= T.unload[0] - 2,
  }));

  // HUD: этап, скорость, груз.
  const hud = api.$('hud');

  // ---------- кадр ----------
  const pose = {pos: V(0, 0, 0), rot: 0, v: 0};
  const sternW = V(0, 0, 0), sideW = V(0, 0, 0);
  let lastStep = -1, lastHud = '';
  stage.onFrame((dt, wall) => {
    if (playing) t = Math.min(T_END, t + dt);
    if (t >= T_END && playing) { playing = false; api.$('bPlay').textContent = '▶ Повторить'; }

    // Танкер.
    plan.pose(t, pose);
    const rise = 3 * clamp01(phase(t, T.unload));
    tanker.position.set(pose.pos.x, Math.sin(wall * 0.6) * 0.15 + rise, pose.pos.z);
    tanker.rotation.y = pose.rot;
    tanker.updateMatrixWorld(true);
    tankerLabel = tanker.localToWorld(V(0, 48, 30));

    // Отсоединение от платформы.
    offload.disconnect(phase(t, T.disc));

    // Пенный след за кормой на ходу.
    sternW.copy(tanker.localToWorld(V(0, 0, 170)));
    sideW.set(Math.cos(pose.rot), 0, -Math.sin(pose.rot));
    wake.update(playing ? dt : 0, sternW, sideW, pose.v * 160 + (t > T.back[0] && t < T.sea[0] ? 25 : 0));

    // Буксиры: подходят к правому борту и прижимают танкер к причалу.
    tugsOn = t > 42 && t < 61;
    const kPush = ease(phase(t, [49, 54]));
    tugs.forEach((g, i) => {
      g.visible = tugsOn;
      g.position.set(46 - 13 * kPush, -tanker.position.y + Math.sin(wall * 0.9 + i) * 0.2, TUG_Z[i]);
    });
    tugLabel = tanker.localToWorld(V(40, 22, TUG_Z[0]));

    // Швартовка и стендеры.
    mooring.set(phase(t, T.moor));
    const kArm = ease(phase(t, T.arms));
    term.arms.forEach((arm, i) => {
      const M = tanker.localToWorld(S_MANI[i].clone());
      const target = arm.stowed.clone().lerp(M, kArm).add(V(0, 4 * Math.sin(Math.PI * kArm), 0));
      arm.solve(target);
    });

    // Перекачка и уровень в резервуарах.
    oil.points.visible = t >= T.unload[0];
    oil.update(dt);
    targets.forEach((tk, i) => {
      const k = clamp01((t - T.unload[0] - i * 6) / 24);
      const level = 0.3 + 0.55 * k;
      tk.setLevel(level);
      const html = `<b>Р-${tk.ri + 1}</b> ${Math.round(level * 100)}%`;
      if (levelLabels[i].el.innerHTML !== html) levelLabels[i].el.innerHTML = html;
    });

    // Шаг истории по времени.
    let si = 0;
    STEPS.forEach((s, i) => { if (t >= s.t0) si = i; });
    if (si !== lastStep && si !== api.step()) api.go(si, {byUser: false});
    lastStep = si;

    const cargo = 70 * (1 - clamp01(phase(t, T.unload)));
    const knots = Math.round(14 * pose.v);
    const status = t < T.back[0] ? 'Отсоединение от платформы' : t < T.sea[0] ? 'Отход и разворот'
      : t < 44 ? 'Переход морем' : t < T.moor[0] ? 'Подход к причалу' : t < T.arms[0] ? 'Швартовка'
      : t < T.unload[0] ? 'Подключение стендеров' : t < T_END ? 'Выгрузка в резервуары' : 'Выгрузка завершена';
    const h = `<b>${status}</b><span>Скорость <i>${knots} уз</i></span><span>Груз <i>${cargo.toFixed(1)} тыс. т</i></span>`;
    if (h !== lastHud) { hud.innerHTML = h; lastHud = h; }
  });

  api.$('bPlay').onclick = () => {
    if (t >= T_END) { t = 0; wake.reset(); api.go(0); }
    playing = !playing || t === 0;
    api.$('bPlay').textContent = playing ? '❚❚ Пауза' : '▶ Продолжить';
  };

  Promise.all([
    loadPlatform(stage, (e) => e.total && api.progress(e.loaded, e.total, 'Загрузка моделей…')),
    loadTanker(stage, tanker),
  ]).then(api.loaded, (err) => { console.error(err); api.error('Не удалось загрузить модель.'); });

  return {
    onStep(i, byUser) {
      const s = STEPS[i];
      if (byUser) {
        t = s.t0;
        playing = true;
        lastStep = i;
        wake.reset();
        api.$('bPlay').textContent = '❚❚ Пауза';
      }
      if (s.follow) {
        plan.pose(Math.max(t, s.t0), pose);
        const p = pose.pos;
        stage.setFollow(tanker);
        stage.flyTo([p.x - 230, 95, p.z + 170], [p.x + 40, 5, p.z]);
      }
    },
  };
}
