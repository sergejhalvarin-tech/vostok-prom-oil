// Этап 2. Транспорт: танкер отходит от платформы, идёт к берегу, швартуется у причала терминала,
// подключаются морские стендеры, и нефть перекачивается в резервуарный парк.
// Всё движение — функция времени T (секунды), поэтому любой шаг можно открыть сразу.
import * as THREE from 'three';
import {mountStory} from '../kit/story.js';
import {buildVoyageWorld, T, T_END} from './voyage-world.js';
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
    title: 'Швартовка у причала', t0: 44, focus: 'mooring', also: ['jetty'],
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
      {key: 'tanker', step: 1, p: () => world.info.tankerLabel},
      {key: 'tugs', step: 2, p: () => world.info.tugLabel, visible: () => world.info.tugsOn},
      {key: 'jetty', step: 2, p: [1545, 24, -32]},
      {key: 'arms', step: 3, p: [1528, 34, 6]},
      {key: 'pipes', step: 4, p: [1640, 15, -2]},
      {key: 'farm', step: 5, p: [1965, 36, -300]},
    ],
    build,
  });
}

let world = null;

function build(stage, api) {
  let t = 0, playing = true;
  const w = buildVoyageWorld(stage);
  world = {info: w.update(0, 0, 0, false)};

  // Подписи уровня в принимающих резервуарах.
  const levelLabels = w.targets.map((tk) => stage.addLabel({
    html: '', cls: 'level', at: new THREE.Vector3(tk.x, 34, tk.z), visible: () => t >= T.unload[0] - 2,
  }));
  const hud = api.$('hud');
  let lastStep = -1, lastHud = '';

  stage.onFrame((dt, wall) => {
    if (playing) t = Math.min(T_END, t + dt);
    if (t >= T_END && playing) { playing = false; api.$('bPlay').textContent = '▶ Повторить'; }
    const info = w.update(t, dt, wall, playing);
    w.cullShore(stage.camera);
    world.info = info;

    w.targets.forEach((tk, i) => {
      const html = `<b>Р-${tk.ri + 1}</b> ${Math.round(info.levels[i] * 100)}%`;
      if (levelLabels[i].el.innerHTML !== html) levelLabels[i].el.innerHTML = html;
    });

    // Шаг истории по времени.
    let si = 0;
    STEPS.forEach((s, i) => { if (t >= s.t0) si = i; });
    if (si !== lastStep && si !== api.step()) api.go(si, {byUser: false});
    lastStep = si;

    const h = `<b>${info.status}</b><span>Скорость <i>${info.knots} уз</i></span><span>Груз <i>${info.cargo.toFixed(1)} тыс. т</i></span>`;
    if (h !== lastHud) { hud.innerHTML = h; lastHud = h; }
  });

  api.$('bPlay').onclick = () => {
    if (t >= T_END) { t = 0; w.resetWake(); api.go(0); }
    playing = !playing || t === 0;
    api.$('bPlay').textContent = playing ? '❚❚ Пауза' : '▶ Продолжить';
  };

  w.load((e) => e.total && api.progress(e.loaded, e.total, 'Загрузка моделей…'))
    .then(api.loaded, (err) => { console.error(err); api.error('Не удалось загрузить модель.'); });

  return {
    onStep(i, byUser) {
      const s = STEPS[i];
      if (byUser) {
        t = s.t0;
        playing = true;
        lastStep = i;
        w.resetWake();
        api.$('bPlay').textContent = '❚❚ Пауза';
      }
      if (s.follow) {
        const p = w.plan.pose(Math.max(t, s.t0), {pos: new THREE.Vector3(), rot: 0, v: 0}).pos;
        stage.setFollow(w.tanker);
        stage.flyTo([p.x - 230, 95, p.z + 170], [p.x + 40, 5, p.z]);
      }
    },
  };
}
