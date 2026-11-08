// Этап 1. Добыча нефти на шельфе: морская ледостойкая платформа, разрез до пласта, отгрузка на танкер.
// Система координат: уровень моря y = 0, метры; дно y = −20.
import * as THREE from 'three';
import {mountStory} from '../kit/story.js';
import {SEABED} from '../kit/stage.js';
import {makeIce, makeFlow} from '../kit/sea.js';
import {loadPlatform, loadTanker, TANKER_AT_PLATFORM} from '../kit/models.js';
import {makeOffloading} from './offloading.js';

const NAMES = {
  kesson: 'Кессон — основание и нефтехранилище',
  derrick: 'Буровой комплекс',
  prep: 'Подготовка нефти',
  kupon: 'Устройство прямой отгрузки нефти',
  living: 'Жилой модуль и вертолётная площадка',
  tanker: 'Танкер ледового класса',
  wells: 'Скважины',
  pumps: 'Насосы отгрузки нефти',
  hose: 'Шланг налива',
  hawser: 'Швартовный канат',
};

// История по шагам. cam/tgt — положение камеры и точка, на которую она смотрит.
const STEPS = [
  {
    title: 'Платформа в Арктике',
    focus: null,
    cam: [235, 115, 265], tgt: [-5, 25, -5],
    html: `<p>Морская ледостойкая стационарная платформа (МЛСП) объединяет буровую, промысел, нефтехранилище и причал.</p>
      <p>Пример такой платформы — «Приразломная» в Печорском море. С 2013 года она первой в России добывает нефть на арктическом шельфе. Глубина моря здесь около 20 м, до берега около 60 км.</p>
      <p>Большую часть года море покрыто льдом. Поэтому платформа не плавает, а стоит на дне под собственным весом и выдерживает напор ледовых полей.</p>`,
  },
  {
    title: 'Кессон: основание и хранилище',
    focus: 'kesson',
    cam: [170, 38, 190], tgt: [0, -2, 0],
    html: `<p>Нижняя часть платформы — стальной кессон размером около 126 × 126 м. Он стоит прямо на дне, а устойчивость ему придаёт балласт.</p>
      <p>Толстые двойные стены принимают удары льда. Внутри кессона устроены танки, где добытая нефть хранится до прихода танкера.</p>
      <p>Если смотреть сквозь воду, видно: над поверхностью моря только верхняя часть кессона.</p>`,
  },
  {
    title: 'Бурение с платформы',
    focus: 'derrick',
    cam: [150, 100, 150], tgt: [28, 62, 18],
    html: `<p>Скважины бурят прямо с палубы. Устья всех скважин собраны под платформой, а стволы расходятся в стороны: сначала вниз, потом наклонно и горизонтально.</p>
      <p>Так с одной точки на дне можно достать нефть на расстоянии нескольких километров вокруг.</p>`,
  },
  {
    title: 'Скважины и нефтяной пласт',
    focus: 'wells',
    section: true,
    cam: [0, -95, 560], tgt: [0, -120, 0],
    html: `<p>Под дном лежат километры горных пород. Нефть заполняет поры пласта-коллектора на глубине около 2,5 км. Сверху её запирает плотная покрышка.</p>
      <p><b class="c-oil">Добывающие скважины</b> поднимают нефть к устьям на платформе. <b class="c-water">Нагнетательные</b> закачивают воду под нефть и поддерживают давление в пласте, чтобы нефть продолжала поступать.</p>
      <p class="muted">Это схема: масштаб по глубине условный.</p>`,
  },
  {
    title: 'Подготовка нефти',
    focus: 'prep',
    cam: [-140, 150, -175], tgt: [-18, 34, -16],
    html: `<p>Из скважины поднимается не чистая нефть, а смесь нефти, попутного газа, пластовой воды и песка.</p>
      <p>Технологический комплекс на палубе разделяет её. Газ сжигается в турбинах собственной электростанции платформы или закачивается обратно в пласт. Воду очищают и возвращают в пласт через нагнетательные скважины.</p>
      <p>Остаётся товарная нефть. Её перекачивают в танки кессона.</p>`,
  },
  {
    title: 'Отгрузка на танкер',
    focus: 'tanker',
    also: ['kupon', 'pumps', 'hose', 'hawser'],
    flow: true,
    cam: [255, 120, 30], tgt: [92, 22, -105],
    html: `<p>Танкер подходит носом к углу платформы и держится на расстоянии около 80 м. Его удерживают <b>швартовный канат</b> и собственные подруливающие устройства.</p>
      <p><b class="c-oil">Насосы отгрузки</b> забирают нефть из танков кессона и гонят её по трубопроводу вдоль стрелы устройства прямой отгрузки. С вершины стрелы к носовому приёмному устройству танкера спускается <b>шланг налива</b>.</p>
      <p>Танкер встаёт к той стороне, куда его выводят ветер и дрейф льда, поэтому такие устройства стоят на двух противоположных углах платформы.</p>
      <p>Нефть «Приразломной» продаётся как отдельный сорт ARCO (Arctic Oil). Это тяжёлая сернистая нефть.</p>
      <p>Дальше танкер везёт её на перевалку, а затем на нефтеперерабатывающий завод. Там из тяжёлых фракций получают <b>базовые масла</b> — основу гидравлических, турбинных и индустриальных масел.</p>`,
  },
  {
    title: 'Люди на платформе',
    focus: 'living',
    cam: [-215, 85, -20], tgt: [-60, 32, -25],
    html: `<p>На платформе вахтой живут и работают около двухсот человек: буровики, технологи, энергетики, спасатели.</p>
      <p>Людей доставляют вертолётом, грузы — судами снабжения. Жилой модуль, столовая и вертолётная площадка расположены дальше всего от буровой и от зоны отгрузки.</p>`,
  },
];

// Подписи-маркеры в 3D. section: показывать только в разрезе.
const HOTSPOTS = [
  {key: 'kesson', p: [-6, 10, 64], step: 1},
  {key: 'derrick', p: [37, 122, 30], step: 2},
  {key: 'wells', p: [60, -150, 2], step: 3, section: true},
  {key: 'prep', p: [-20, 54, -12], step: 4},
  {key: 'kupon', p: [48, 74, -56], step: 5},
  {key: 'pumps', p: [53, 27, -64], step: 5},
  {key: 'hose', p: [92, 30, -98], step: 5},
  {key: 'hawser', p: [88, 14, -96], step: 5},
  {key: 'tanker', p: [190, 48, -196], step: 5},
  {key: 'living', p: [-58, 48, -6], step: 6},
];

const DEPTH_MARKS = [
  {y: 0, t: 'уровень моря'},
  {y: SEABED, t: 'дно ≈ 20 м'},
  {y: -176, t: 'покрышка'},
  {y: -190, t: 'нефтяной пласт ≈ 2,5 км'},
];

export const CREDITS = `
  3D-модели: <a href="https://sketchfab.com/3d-models/by-lightproduction-221b011013244993a4a27c2094b8e152" target="_blank" rel="noopener">«МЛСП Приразломная»</a>,
  © <a href="https://sketchfab.com/lightproduction" target="_blank" rel="noopener">Lightproduction</a>;
  <a href="https://sketchfab.com/3d-models/tanker-ship-96ebf61af42b4062ae98a6ad848e1a25" target="_blank" rel="noopener">«Tanker Ship»</a>,
  © <a href="https://sketchfab.com/KoreanNavy" target="_blank" rel="noopener">KoreanNavy</a>;
  обе по лицензии <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.`;

export function mountShelf(root, sec, next) {
  let sectionOn = false;
  return mountStory(root, {
    stageNo: 1,
    title: 'Добыча нефти на шельфе',
    lead: 'Любое масло начинается с нефти. Посмотрите, как её добывают со дна арктического моря. Вращайте модель, нажимайте на номера и шаги.',
    steps: STEPS,
    names: NAMES,
    hotspots: HOTSPOTS.map((h) => ({...h, visible: h.section ? () => sectionOn : undefined})),
    next,
    credits: CREDITS + ' Море, лёд, разрез, насосы и шланг дорисованы. Цифры по открытым источникам, округлены.',
    tools: [{id: 'bSection', label: 'Разрез до пласта', title: 'Показать разрез под дном'}],
    build(stage, api) {
      const ice = makeIce((x, z) => x > 60 && z < -60 && x - z < 700); // коридор танкера чистый
      stage.scene.add(ice);

      const section = makeSection();
      section.group.visible = false;
      stage.scene.add(section.group);

      const tanker = new THREE.Group();
      tanker.position.copy(TANKER_AT_PLATFORM.pos);
      tanker.rotation.y = TANKER_AT_PLATFORM.rot;
      stage.scene.add(tanker);
      const offload = makeOffloading(tanker);
      stage.scene.add(offload.group);
      stage.registerTree(offload.group);
      stage.registerTree(offload.station);
      const shipFlow = makeFlow([offload.flowCurve], 140, 0xffa31a, 2.6, false, 30);
      stage.scene.add(shipFlow.points);

      for (const d of DEPTH_MARKS) {
        stage.addLabel({html: d.t, cls: 'depth', at: new THREE.Vector3(-262, d.y, 2), visible: () => sectionOn});
      }

      stage.onFrame((dt, t) => {
        if (sectionOn) section.update(dt);
        shipFlow.update(dt);
        tanker.position.y = Math.sin(t * 0.6) * 0.15;
      });

      const setSection = (on) => {
        sectionOn = on;
        section.group.visible = on;
        stage.water.setOpacity(on ? 0.35 : 0.8);
        ice.visible = !on;
        stage.controls.maxPolarAngle = on ? Math.PI * 0.98 : Math.PI * 0.485;
        api.$('bSection').classList.toggle('on', on);
      };
      api.$('bSection').onclick = () => api.go(sectionOn ? 0 : 3);

      Promise.all([
        loadPlatform(stage, (e) => e.total && api.progress(e.loaded, e.total, 'Загрузка модели платформы…')),
        loadTanker(stage, tanker),
      ]).then(api.loaded, (err) => { console.error(err); api.error('Не удалось загрузить модель.'); });

      return {
        onStep(i) {
          const s = STEPS[i];
          setSection(!!s.section);
          shipFlow.points.visible = !!s.flow;
        },
      };
    },
  });
}

// ======================================================================
// Геологический разрез в плоскости z = 0: слои, антиклинальная ловушка с нефтью, скважины, потоки.
const SEC = {x0: -430, x1: 430, top: SEABED, bot: -340};
const C = (x) => Math.cos((Math.PI * x) / 900);
const RES_TOP = (x) => -200 + 36 * C(x);
const RES_BOT = (x) => -236 + 36 * C(x);
const OWC = -188; // водонефтяной контакт

function makeSection() {
  const group = new THREE.Group();

  // Слои рисуем на канвасе: x → ширина, y → высота.
  const W = 2048, H = Math.round((W * (SEC.top - SEC.bot)) / (SEC.x1 - SEC.x0));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const px = (x) => ((x - SEC.x0) / (SEC.x1 - SEC.x0)) * W;
  const py = (y) => ((SEC.top - y) / (SEC.top - SEC.bot)) * H;
  const layer = (topFn, color) => {
    g.fillStyle = color;
    g.beginPath();
    for (let x = SEC.x0; x <= SEC.x1; x += 10) g.lineTo(px(x), py(topFn(x)));
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  };
  layer(() => SEABED, '#a8966f');                          // донные осадки
  layer(() => -36, '#857a68');                             // глины
  layer((x) => -80 + 8 * C(x), '#978668');                 // песчано-глинистая толща
  layer((x) => -128 + 20 * C(x), '#a29d90');               // известняки
  layer((x) => -170 + 34 * C(x), '#575049');               // покрышка — плотные глины
  layer(RES_TOP, '#4d5d68');                               // пласт-коллектор (водонасыщенный)
  layer(RES_BOT, '#766d63');                               // подстилающие породы
  // Нефть — в своде ловушки, выше водонефтяного контакта.
  g.fillStyle = '#20140a';
  g.beginPath();
  const xs = [];
  for (let x = SEC.x0; x <= SEC.x1; x += 4) if (RES_TOP(x) > OWC) xs.push(x);
  xs.forEach((x) => g.lineTo(px(x), py(RES_TOP(x))));
  [...xs].reverse().forEach((x) => g.lineTo(px(x), py(Math.max(OWC, RES_BOT(x)))));
  g.closePath(); g.fill();
  // Зерно породы.
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
    g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 1 + rnd() * 2);
  }
  // Границы слоёв.
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
  for (const f of [() => -36, (x) => -80 + 8 * C(x), (x) => -128 + 20 * C(x), (x) => -170 + 34 * C(x), RES_TOP, RES_BOT]) {
    g.beginPath();
    for (let x = SEC.x0; x <= SEC.x1; x += 10) g.lineTo(px(x), py(f(x)));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(SEC.x1 - SEC.x0, SEC.top - SEC.bot),
    new THREE.MeshBasicMaterial({map: tex, fog: false, toneMapped: false}),
  );
  face.position.set((SEC.x0 + SEC.x1) / 2, (SEC.top + SEC.bot) / 2, 0);
  group.add(face);

  // Толща воды в разрезе.
  const waterFace = new THREE.Mesh(
    new THREE.PlaneGeometry(SEC.x1 - SEC.x0, -SEABED),
    new THREE.MeshBasicMaterial({color: 0x2d6f86, transparent: true, opacity: 0.45, fog: false, depthWrite: false}),
  );
  waterFace.position.set(0, SEABED / 2, -0.5);
  group.add(waterFace);

  // Скважины. x — где кончается горизонтальный ствол.
  const head = (i) => new THREE.Vector3(-6 + (i - 3.5) * 2.6, SEABED, 1.5);
  const midOil = (x) => (RES_TOP(x) + Math.max(OWC, RES_BOT(x))) / 2;
  const curve = (i, xe, ye) => {
    const h0 = head(i);
    const xa = h0.x + 0.62 * (xe - h0.x);
    return new THREE.CatmullRomCurve3([
      h0,
      new THREE.Vector3(h0.x, SEABED - 40, 1.5),
      new THREE.Vector3(h0.x + 0.3 * (xe - h0.x), -125, 1.5),
      new THREE.Vector3(xa, ye(xa), 1.5),
      new THREE.Vector3(xe, ye(xe), 1.5),
    ], false, 'centripetal');
  };
  const prod = [-300, -195, -95, 60, 165, 285].map((xe, k) => curve([0, 1, 2, 5, 6, 7][k], xe, midOil));
  const inj = [curve(3, -400, () => -212), curve(4, 400, () => -212)];
  const tubeMat = (c) => new THREE.MeshStandardMaterial({color: c, roughness: 0.4, metalness: 0.5, emissive: c, emissiveIntensity: 0.25});
  const mProd = tubeMat(0xd9822b), mInj = tubeMat(0x3d8fd6);
  for (const c of prod) group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 120, 1.5, 8), mProd));
  for (const c of inj) group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 120, 1.5, 8), mInj));

  const oil = makeFlow(prod, 34, 0xffb340, 4.2, true);
  const wat = makeFlow(inj, 40, 0x7cc4ff, 4.0, false);
  group.add(oil.points, wat.points);

  return {group, update: (dt) => { if (group.visible) { oil.update(dt); wat.update(dt); } }};
}

