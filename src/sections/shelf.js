// Этап 1. Добыча нефти на шельфе: морская ледостойкая платформа, разрез до пласта, отгрузка на танкер.
// Модель «МЛСП Приразломная» © Lightproduction, CC BY 4.0 (sketchfab.com/lightproduction).
// Система координат после загрузки: уровень моря y = 0, метры; дно y = −20.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {makeOffloading, GRADE, TANKER_SCALE, TANKER_POS, TANKER_ROT} from './offloading.js';

const MODEL_URL = 'models/prirazlomnaya.glb';
const TANKER_URL = 'models/tanker.glb';
const SEA_OFFSET = 52.5; // в исходной модели поверхность моря на y = −52,5
const SEABED = -20;

// Узлы модели → смысловые группы (подсветка, подписи, клик).
const NODE_KEY = {
  Kesson_mid: 'kesson', Kesson_DOWN: 'kesson', Kesson_UP: 'kesson',
  Vishka: 'derrick', Vishka_Neft: 'derrick',
  Block_central: 'prep', StufBig_A: 'prep', StufBig_B: 'prep', StufBig_C: 'prep',
  Stuff_onboard: 'prep', AuxUnitGEO: 'prep',
  Kran_B: 'kupon', Kran_B_2: 'kupon',
  Block_living: 'living', Block_living_floor: 'living', HeliPad: 'living',
};
const HIDE_NODES = ['Box001', 'Object264']; // своё море из модели — заменяем анимированным

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

export function mountShelf(root, sec, next) {
  root.innerHTML = `
    <section class="stage">
      <div class="viewport" id="vp">
        <div class="labels" id="labels"></div>
        <div class="tip" id="tip"></div>
        <div class="loading" id="loading"><div class="bar"><i id="lbar"></i></div><span id="ltext">Загрузка модели платформы…</span></div>
        <div class="vp-tools">
          <button class="chip" id="bSection" title="Показать разрез под дном">Разрез до пласта</button>
          <button class="chip" id="bReset" title="Вернуть общий вид">Общий вид</button>
        </div>
      </div>
      <aside class="panel">
        <div class="kicker">Этап 1 из 6 · Путь нефти</div>
        <h1>Добыча нефти на шельфе</h1>
        <p class="lead">Любое масло начинается с нефти. Посмотрите, как её добывают со дна арктического моря. Вращайте модель, нажимайте на номера и шаги.</p>
        <ol class="steps" id="steps">${STEPS.map((s, i) => `<li><button data-i="${i}"><i>${i + 1}</i>${s.title}</button></li>`).join('')}</ol>
        <article class="card" id="card"></article>
        <div class="nav-row">
          <button class="btn ghost" id="bPrev">←</button>
          <span id="counter"></span>
          <button class="btn" id="bNext">Дальше →</button>
        </div>
        <a class="next-stage" href="#${next.id}"><small>Этап ${next.n}</small>${next.title} →</a>
        <footer class="credits">
          3D-модель: <a href="https://sketchfab.com/3d-models/by-lightproduction-221b011013244993a4a27c2094b8e152" target="_blank" rel="noopener">«МЛСП Приразломная»</a>,
          © <a href="https://sketchfab.com/lightproduction" target="_blank" rel="noopener">Lightproduction</a>,
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>;
          <a href="https://sketchfab.com/3d-models/tanker-ship-96ebf61af42b4062ae98a6ad848e1a25" target="_blank" rel="noopener">«Tanker Ship»</a>,
          © <a href="https://sketchfab.com/KoreanNavy" target="_blank" rel="noopener">KoreanNavy</a>, CC BY 4.0.
          Море, лёд, разрез, насосы и шланг дорисованы.
          Цифры по открытым источникам, округлены.
        </footer>
      </aside>
    </section>`;

  const $ = (id) => root.querySelector('#' + id);
  const vp = $('vp');

  // ---------- рендер ----------
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  vp.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 12000);
  camera.position.set(...STEPS[0].cam);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...STEPS[0].tgt);
  controls.enableDamping = true;
  controls.minDistance = 25;
  controls.maxDistance = 1600;

  // Небо низкого полярного солнца + окружение для отражений.
  const sky = new Sky();
  sky.scale.setScalar(10000);
  const su = sky.material.uniforms;
  su.turbidity.value = 1.8;
  su.rayleigh.value = 2.4;
  su.mieCoefficient.value = 0.003;
  su.mieDirectionalG.value = 0.86;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 19), THREE.MathUtils.degToRad(215));
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyEnv = new Sky();
  skyEnv.scale.setScalar(10000);
  for (const k of Object.keys(su)) skyEnv.material.uniforms[k].value = su[k].value;
  envScene.add(skyEnv);
  const envRT = pmrem.fromScene(envScene, 0, 1, 20000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.0;

  const FOG = new THREE.Color(0xa9cbe6);
  scene.fog = new THREE.Fog(FOG, 900, 3600);

  const sun = new THREE.DirectionalLight(0xfff0d8, 3.4);
  sun.position.copy(sunDir).multiplyScalar(600);
  sun.target.position.set(60, 0, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 1500});
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xd8ebff, 0x3a4a58, 0.75));

  // Пост-обработка: MSAA-буфер, затенение в углах (GTAO), вывод, лёгкая цветокоррекция.
  const rt = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({radius: 4, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 16});
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(GRADE));

  // ---------- море ----------
  const water = makeWater(sunDir, FOG);
  scene.add(water.mesh);

  const seabed = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({color: 0x6f6650, roughness: 1}),
  );
  seabed.position.y = SEABED - 0.2;
  seabed.receiveShadow = true;
  scene.add(seabed);

  const ice = makeIce();
  scene.add(ice);

  // ---------- разрез под дном, скважины ----------
  const section = makeSection();
  section.group.visible = false;
  scene.add(section.group);

  // ---------- танкер ----------
  const groups = {}; // key → [mesh]
  const highlightable = []; // меши, по которым работает клик/наведение
  const register = (o, key) => {
    o.castShadow = o.receiveShadow = true;
    o.material = o.material.clone();
    o.material.userData.e0 = o.material.emissive?.clone();
    if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (!key) return;
    (groups[key] ||= []).push(o);
    o.userData.key = key;
    highlightable.push(o);
  };

  const tanker = new THREE.Group();
  tanker.position.copy(TANKER_POS);
  tanker.rotation.y = TANKER_ROT;
  scene.add(tanker);
  let mixer = null;

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.load(TANKER_URL, (gltf) => {
    const m = gltf.scene;
    m.scale.setScalar(TANKER_SCALE);
    m.traverse((o) => {
      if (!o.isMesh) return;
      register(o, 'tanker');
      // Яркая окраска: насыщеннее и чуть глянцевее исходных серых материалов.
      const mat = o.material;
      mat.roughness = Math.min(mat.roughness ?? 1, 0.55);
      mat.metalness = Math.min(mat.metalness ?? 0, 0.3);
      const hsl = mat.color.getHSL({});
      if (hsl.s > 0.2) mat.color.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), Math.min(0.55, hsl.l * 1.15));
    });
    tanker.add(m);
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(m);
      for (const clip of gltf.animations) mixer.clipAction(clip).play();
    }
  });

  // ---------- отгрузка: насосы, трубопровод по стреле, шланг, швартовный канат ----------
  tanker.updateMatrixWorld(true);
  const offload = makeOffloading(tanker);
  scene.add(offload.group);
  offload.group.traverse((o) => o.isMesh && register(o, o.userData.key));
  const shipFlow = makeFlow([offload.flowCurve], 140, 0xffa31a, 2.6, false, 30);
  shipFlow.points.visible = false;
  scene.add(shipFlow.points);

  // ---------- модель платформы ----------
  loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    model.position.y = SEA_OFFSET;
    model.traverse((o) => {
      if (HIDE_NODES.includes(o.name)) o.visible = false;
      if (!o.isMesh) return;
      let key = null;
      for (let p = o; p && !key; p = p.parent) key = NODE_KEY[p.name] || null;
      register(o, key);
    });
    scene.add(model);
    $('loading').classList.add('done');
  }, (e) => {
    if (!e.total) return;
    const k = e.loaded / e.total;
    $('lbar').style.width = (k * 100).toFixed(0) + '%';
    $('ltext').textContent = `Загрузка модели платформы… ${(e.loaded / 1e6).toFixed(1)} из ${(e.total / 1e6).toFixed(1)} МБ`;
  }, (err) => {
    console.error(err);
    $('ltext').textContent = 'Не удалось загрузить модель.';
  });

  // ---------- подписи ----------
  const labelsEl = $('labels');
  const hsEls = HOTSPOTS.map((h, i) => {
    const el = document.createElement('button');
    el.className = 'hs';
    el.innerHTML = `<i>${h.step + 1}</i><span>${NAMES[h.key]}</span>`;
    el.onclick = () => go(h.step);
    labelsEl.append(el);
    return {...h, el, v: new THREE.Vector3(...h.p)};
  });
  const depthEls = DEPTH_MARKS.map((d) => {
    const el = document.createElement('div');
    el.className = 'depth';
    el.textContent = d.t;
    labelsEl.append(el);
    return {el, v: new THREE.Vector3(-262, d.y, 2)};
  });

  // ---------- шаги ----------
  let step = -1;
  let sectionOn = false;
  let fly = null; // {p0,t0,p1,t1,start}
  const stepBtns = [...$('steps').querySelectorAll('button')];

  function setSection(on) {
    sectionOn = on;
    section.group.visible = on;
    water.setOpacity(on ? 0.35 : 0.8);
    ice.visible = !on;
    controls.maxPolarAngle = on ? Math.PI * 0.98 : Math.PI * 0.485;
    $('bSection').classList.toggle('on', on);
    for (const d of depthEls) d.el.style.display = on ? '' : 'none';
  }

  function go(i) {
    i = Math.max(0, Math.min(STEPS.length - 1, i));
    step = i;
    const s = STEPS[i];
    stepBtns.forEach((b, j) => b.classList.toggle('on', j === i));
    $('card').innerHTML = `<h2><i>${i + 1}</i>${s.title}</h2>${s.html}`;
    $('counter').textContent = `${i + 1} / ${STEPS.length}`;
    $('bPrev').disabled = i === 0;
    $('bNext').textContent = i === STEPS.length - 1 ? 'Сначала ↺' : 'Дальше →';
    setSection(!!s.section);
    shipFlow.points.visible = !!s.flow;
    fly = {
      p0: camera.position.clone(), t0: controls.target.clone(),
      p1: new THREE.Vector3(...s.cam), t1: new THREE.Vector3(...s.tgt), start: performance.now(),
    };
    if (matchMedia('(max-width: 900px)').matches) $('card').scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }

  stepBtns.forEach((b) => (b.onclick = () => go(+b.dataset.i)));
  $('bPrev').onclick = () => go(step - 1);
  $('bNext').onclick = () => go(step === STEPS.length - 1 ? 0 : step + 1);
  $('bReset').onclick = () => go(0);
  $('bSection').onclick = () => {
    if (sectionOn) go(0); else go(3);
  };

  // ---------- наведение и клик по модели ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tip = $('tip');
  let hoverKey = null;
  let downAt = null;
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(highlightable, false)[0];
    return hit?.object.userData.key || null;
  };
  const onMove = (e) => {
    if (e.buttons) return;
    hoverKey = pick(e);
    renderer.domElement.style.cursor = hoverKey ? 'pointer' : '';
    if (hoverKey) {
      const r = vp.getBoundingClientRect();
      tip.textContent = NAMES[hoverKey];
      tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
      tip.classList.add('on');
    } else tip.classList.remove('on');
  };
  const onDown = (e) => (downAt = [e.clientX, e.clientY]);
  const onUp = (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const key = pick(e);
    const i = STEPS.findIndex((s) => s.focus === key || s.also?.includes(key));
    if (i >= 0) go(i);
  };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointerleave', () => tip.classList.remove('on'));

  // ---------- размер ----------
  const resize = () => {
    const w = vp.clientWidth, h = vp.clientHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(vp);
  resize();

  // ---------- кадр ----------
  const tmp = new THREE.Vector3();
  const ORANGE = new THREE.Color(1, 0.5, 0.08);
  const timer = new THREE.Timer();
  timer.connect(document);
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();

    if (fly) {
      const k = Math.min(1, (performance.now() - fly.start) / 1600);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (k >= 1) fly = null;
    }
    controls.update();

    water.update(t);
    section.update(dt);
    shipFlow.update(dt);
    tanker.position.y = Math.sin(t * 0.6) * 0.15;
    mixer?.update(dt);

    // Подсветка: выбранная группа пульсирует, наведённая светится ровно.
    const focus = STEPS[step]?.focus, also = STEPS[step]?.also;
    const pulse = 0.18 + 0.12 * Math.sin(t * 3.2);
    for (const [key, meshes] of Object.entries(groups)) {
      const amt = key === hoverKey ? 0.32 : key === focus ? pulse : also?.includes(key) ? pulse * 0.6 : 0;
      for (const m of meshes) {
        if (!m.material.emissive) continue;
        if (amt) m.material.emissive.copy(ORANGE).multiplyScalar(amt);
        else m.material.emissive.copy(m.material.userData.e0 || tmp.set(0, 0, 0));
      }
    }

    // Подписи следуют за точками в 3D.
    const w = vp.clientWidth, h = vp.clientHeight;
    const place = (el, v, show) => {
      tmp.copy(v).project(camera);
      const vis = show && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      el.style.visibility = vis ? 'visible' : 'hidden';
      if (vis) el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
    };
    for (const hs of hsEls) {
      place(hs.el, hs.v, !hs.section || sectionOn);
      hs.el.classList.toggle('on', hs.step === step);
    }
    for (const d of depthEls) place(d.el, d.v, sectionOn);

    composer.render();
  }

  go(0);
  frame();

  return () => {
    cancelAnimationFrame(raf);
    timer.dispose();
    ro.disconnect();
    controls.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
    envRT.dispose();
    rt.dispose();
    gtao.dispose();
    composer.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}

// ======================================================================
// Море: волны в вершинном шейдере, френель, блик солнца, туман по дальности.
function makeWater(sunDir, fogColor) {
  const uniforms = {
    uTime: {value: 0},
    uSun: {value: sunDir.clone().normalize()},
    uDeep: {value: new THREE.Color(0x064766)},
    uSky: {value: new THREE.Color(0x7fb8dc)},
    uFog: {value: fogColor},
    uOpacity: {value: 0.8},
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vW; varying vec3 vN;
      float h(vec2 p) {
        return 0.30 * sin(p.x * 0.045 + uTime * 0.9)
             + 0.22 * sin(p.y * 0.063 - uTime * 1.15)
             + 0.12 * sin((p.x + p.y) * 0.11 + uTime * 1.8)
             + 0.06 * sin((p.x - p.y) * 0.23 + uTime * 2.6);
      }
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float e = 0.6, hh = h(w.xz);
        vN = normalize(vec3(-(h(w.xz + vec2(e, 0.0)) - hh) / e, 1.0, -(h(w.xz + vec2(0.0, e)) - hh) / e));
        w.y += hh;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uDeep, uSky, uFog; uniform float uOpacity;
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 col = mix(uDeep, uSky, clamp(0.06 + fr * 0.9, 0.0, 1.0));
        vec3 hv = normalize(v + uSun);
        col += vec3(1.0, 0.86, 0.68) * pow(max(dot(n, hv), 0.0), 400.0) * 1.6;
        float d = length(cameraPosition - vW);
        float f = smoothstep(700.0, 3200.0, d);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, mix(uOpacity + fr * 0.2, 1.0, f));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000, 280, 280).rotateX(-Math.PI / 2), mat);
  mesh.renderOrder = 2;
  return {
    mesh,
    update: (t) => (uniforms.uTime.value = t),
    setOpacity: (a) => (uniforms.uOpacity.value = a),
  };
}

// Дрейфующий лёд вокруг платформы.
function makeIce() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color: 0xe8f0f6, roughness: 0.85});
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 230 + rnd() * 900;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x > 60 && z < -60 && x - z < 700) continue; // коридор танкера чистый
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6 + Math.floor(rnd() * 4));
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const s = 0.75 + rnd() * 0.5;
      pos.setX(k, pos.getX(k) * s);
      pos.setZ(k, pos.getZ(k) * s);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    const size = 6 + rnd() * 26;
    m.scale.set(size * (0.6 + rnd() * 0.8), 1.4, size * (0.6 + rnd() * 0.8));
    m.position.set(x, 0.1, z);
    m.rotation.y = rnd() * Math.PI;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
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

// Частицы, бегущие вдоль кривых: нефть вверх (reverse), вода вниз.
function makeFlow(curves, perCurve, color, size, reverse, speed = 45) {
  const n = curves.length * perCurve;
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const t = Float32Array.from({length: n}, (_, i) => (i % perCurve) / perCurve);
  const lens = curves.map((c) => c.getLength());
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  }));
  points.renderOrder = 3;
  points.frustumCulled = false;
  const v = new THREE.Vector3();
  const update = (dt) => {
    for (let i = 0; i < n; i++) {
      const ci = Math.floor(i / perCurve);
      t[i] = (t[i] + (dt * speed) / lens[ci]) % 1;
      curves[ci].getPointAt(reverse ? 1 - t[i] : t[i], v);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  update(0);
  return {points, update};
}

