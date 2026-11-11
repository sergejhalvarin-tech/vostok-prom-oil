// 3D-сцена раздела: лёгкий прямой рендер (MSAA, нейтральная цветопередача, адаптивное разрешение),
// полярное небо, море, свет, камера,
// подсветка смысловых групп, наведение/клик, HTML-подписи, перелёты и слежение камеры.
// Система координат: уровень моря y = 0, метры.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {makeWater} from './sea.js';
import {makeClouds} from './clouds.js';

export const SEABED = -20;
const ORANGE = new THREE.Color(1, 0.5, 0.08);

export function createStage(vp, {cam, tgt, names = {}, onPick, pick = true} = {}) {
  const aa = new URLSearchParams(location.search).get('aa') !== '0';
  const renderer = new THREE.WebGLRenderer({antialias: aa, powerPreference: 'high-performance', stencil: false});
  // Разрешение подстраивается под скорость кадра: от 0,75 до maxPR.
  const maxPR = Math.min(devicePixelRatio, 1.75);
  let pr = Math.min(maxPR, 1.25);
  renderer.setPixelRatio(pr);
  // Нейтральная цветопередача не выбеливает насыщенные цвета, в отличие от ACES.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  vp.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 14000);
  camera.position.set(...cam);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...tgt);
  controls.enableDamping = true;
  controls.minDistance = 20;
  controls.maxDistance = 3200;
  controls.maxPolarAngle = Math.PI * 0.485;

  // Небо: стилизованная панорама гор и облаков (FREE — SkyBox Mountain View © Paul, CC BY 4.0).
  // Пока она грузится — процедурное дневное небо. Солнце стоит там же, где на панораме.
  const sky = new Sky();
  sky.scale.setScalar(12000);
  const su = sky.material.uniforms;
  su.turbidity.value = 2.2;
  su.rayleigh.value = 1.2;
  su.mieCoefficient.value = 0.004;
  su.mieDirectionalG.value = 0.85;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 39), THREE.MathUtils.degToRad(128));
  su.sunPosition.value.copy(sunDir);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyEnv = new Sky();
  skyEnv.scale.setScalar(10000);
  for (const k of Object.keys(su)) skyEnv.material.uniforms[k].value = su[k].value;
  envScene.add(skyEnv);
  const envRT = pmrem.fromScene(envScene, 0, 1, 20000);
  scene.environment = envRT.texture;
  const skyRT = new THREE.WebGLCubeRenderTarget(1024, {type: THREE.HalfFloatType});
  const skyScene = new THREE.Scene();
  skyScene.add(sky);
  new THREE.CubeCamera(1, 20000, skyRT).update(renderer, skyScene);
  scene.background = skyRT.texture;
  let skyTex = null;
  new THREE.TextureLoader().load('textures/sky.webp', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    skyTex = t;
    scene.backgroundRotation.set(0, -0.05, 0);
    scene.environmentRotation.set(0, -0.05, 0);
    const env = pmrem.fromEquirectangular(t);
    scene.environment = env.texture;
    if (medium === 'air') scene.background = t;
  });
  const airBg = () => skyTex || skyRT.texture;
  // Морской горизонт без гор: кольцо дымки вокруг камеры, видимое только там, где горизонт над морем
  // (дальняя точка западнее берега). Над сушей горы панорамы остаются.
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(9000, 9000, 2400, 96, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      uniforms: {uCol: {value: new THREE.Color(0xc9dcea)}, uTop: {value: new THREE.Color(0xb7d4ec)}},
      vertexShader: `varying vec3 vW; varying float vY; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vY = position.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uCol, uTop; varying vec3 vW; varying float vY;
        void main() {
          float sea = smoothstep(2600.0, 900.0, vW.x);
          float up = 1.0 - smoothstep(-150.0, 900.0, vY);
          gl_FragColor = vec4(mix(uTop, uCol, up), sea * clamp(up * 1.15, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
    }),
  );
  haze.renderOrder = -1;
  haze.frustumCulled = false;
  scene.add(haze);

  // Голубая воздушная дымка: даль растворяется в цвете горизонта панорамы.
  const FOG = new THREE.Color(0xc9dcea);
  const FOG_NEAR = 450, FOG_FAR = 9500;
  scene.fog = new THREE.Fog(FOG, FOG_NEAR, FOG_FAR);

  // Солнце с тенью следует за точкой, на которую смотрит камера. Свет тёплый, тени — голубые от неба.
  const SUN_C = 0xfff0d2, HEMI_SKY = 0xbfe2ff, HEMI_GROUND = 0x557a3a;
  const sun = new THREE.DirectionalLight(SUN_C, 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, {left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 1600});
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, 1.25);
  scene.add(hemi);
  const clouds = makeClouds(sunDir);
  scene.add(clouds.mesh);

  const water = makeWater(sunDir, FOG);
  scene.add(water.mesh);
  // Поверхность моря снизу: светлый «потолок», уходящий в туман.
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({color: 0x8fd8ea, transparent: true, opacity: 0.9}));
  ceiling.position.set(900, 0.05, 0);
  scene.add(ceiling);
  // Среды: над водой — небо и дымка; в воде — бирюзовая мгла; ниже дна — тёмный «музейный» фон разреза.
  const UW = new THREE.Color(0x1a7f93), DEEP = new THREE.Color(0x0a0e13);
  let medium = '';
  function setMedium(y) {
    const m = y > 0 ? 'air' : y > SEABED - 0.5 ? 'water' : 'rock';
    if (m === medium) return;
    medium = m;
    clouds.mesh.visible = m === 'air';
    if (m === 'air') { scene.background = airBg(); scene.fog.color.copy(FOG); scene.fog.near = FOG_NEAR; scene.fog.far = FOG_FAR; }
    if (m === 'water') { scene.background = UW; scene.fog.color.copy(UW); scene.fog.near = 4; scene.fog.far = 175; }
    // Под водой красный свет поглощается: солнце и небо становятся сине-зелёными.
    sun.color.set(m === 'water' ? 0xbfeff2 : SUN_C);
    sun.intensity = m === 'water' ? 2.2 : 3.1;
    hemi.color.set(m === 'water' ? 0x9fe6ee : HEMI_SKY);
    hemi.groundColor.set(m === 'water' ? 0x1d4a52 : HEMI_GROUND);
    if (m === 'rock') { scene.background = DEEP; scene.fog.color.copy(DEEP); scene.fog.near = 900; scene.fog.far = 5000; }
  }
  const seabed = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({color: 0x9a8e68}),
  );
  seabed.position.set(900, SEABED - 0.2, 0);
  scene.add(seabed);

  // ---------- смысловые группы ----------
  const groups = {}; // key → [mesh]
  const highlightable = [];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function register(o, key, {shadow = true} = {}) {
    o.castShadow = shadow && o.userData.noCast !== true;
    o.receiveShadow = true;
    o.material = o.material.clone();
    o.material.userData.e0 = o.material.emissive?.clone();
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (o.material[k]) o.material[k].anisotropy = maxAniso;
    if (!key) return;
    (groups[key] ||= []).push(o);
    o.userData.key = key;
    highlightable.push(o);
  }
  // Зарегистрировать все меши объекта; ключ — свой у каждого меша (userData.key) или общий.
  function registerTree(root, key) {
    root.traverse((o) => o.isMesh && register(o, key ?? o.userData.key));
  }
  let focus = null, also = [];
  const setFocus = (f, a = []) => { focus = f; also = a; };

  // ---------- подписи ----------
  const labelsEl = vp.querySelector('.labels');
  const labels = [];
  function addLabel({html, cls = 'hs', at, visible = () => true, onClick, active = () => false}) {
    const el = document.createElement(onClick ? 'button' : 'div');
    el.className = cls;
    el.innerHTML = html;
    if (onClick) el.onclick = onClick;
    labelsEl.append(el);
    const l = {el, at: typeof at === 'function' ? at : () => at, visible, active};
    labels.push(l);
    return l;
  }

  // ---------- наведение и клик ----------
  const tip = vp.querySelector('.tip');
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hoverKey = null, downAt = null;
  const pickAt = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(highlightable, false).find((h) => h.object.visible)?.object.userData.key || null;
  };
  const el = renderer.domElement;
  let lastPick = 0;
  if (pick) el.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    const now = performance.now();
    if (now - lastPick < 120) return;
    lastPick = now;
    hoverKey = pickAt(e);
    el.style.cursor = hoverKey ? 'pointer' : '';
    if (hoverKey && names[hoverKey]) {
      const r = vp.getBoundingClientRect();
      tip.textContent = names[hoverKey];
      tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
      tip.classList.add('on');
    } else tip.classList.remove('on');
  });
  el.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  el.addEventListener('pointerup', (e) => {
    if (!onPick || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const key = pickAt(e);
    if (key) onPick?.(key);
  });
  el.addEventListener('pointerleave', () => { tip.classList.remove('on'); hoverKey = null; });

  // ---------- камера: перелёт и слежение ----------
  let fly = null;
  let follow = null, followPrev = new THREE.Vector3();
  function flyTo(p, t, ms = 1600) {
    fly = {p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), start: performance.now(), ms};
  }
  // Ручная камера (облёт): orbit-управление выключено, камеру ставит вызывающий код,
  // focus() — точка, вокруг которой строится тень солнца.
  let manual = null;
  function setManual(focus) {
    manual = focus;
    controls.enabled = !focus;
  }
  function setFollow(obj) {
    follow = obj;
    if (obj) obj.getWorldPosition(followPrev);
  }

  // ---------- размер ----------
  const resize = () => {
    const w = vp.clientWidth, h = vp.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(vp);
  resize();

  // ---------- кадр ----------
  const hooks = [];
  const onFrame = (fn) => hooks.push(fn);
  const tmp = new THREE.Vector3(), d = new THREE.Vector3();
  const timer = new THREE.Timer();
  timer.connect(document);
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();

    for (const fn of hooks) fn(dt, t);

    if (!manual && follow) {
      follow.getWorldPosition(tmp);
      d.subVectors(tmp, followPrev);
      followPrev.copy(tmp);
      camera.position.add(d);
      controls.target.add(d);
      if (fly) { fly.p0.add(d); fly.p1.add(d); fly.t0.add(d); fly.t1.add(d); }
    }
    if (!manual && fly) {
      const k = Math.min(1, (performance.now() - fly.start) / fly.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (k >= 1) fly = null;
    }
    if (!manual) controls.update();

    setMedium(camera.position.y);
    haze.position.set(camera.position.x, camera.position.y * 0.3, camera.position.z);
    haze.visible = medium === 'air';
    const focusPt = manual ? manual() : controls.target;
    sun.target.position.copy(focusPt);
    sun.position.copy(focusPt).addScaledVector(sunDir, 700);
    water.update(t);
    clouds.update(t);

    // Подсветка: выбранная группа пульсирует, связанные — слабее, под курсором — ровно.
    const pulse = 0.18 + 0.12 * Math.sin(t * 3.2);
    for (const [key, meshes] of Object.entries(groups)) {
      const amt = key === hoverKey ? 0.32 : key === focus ? pulse : also.includes(key) ? pulse * 0.6 : 0;
      for (const m of meshes) {
        const em = m.material.emissive;
        if (!em) continue;
        if (amt) em.copy(ORANGE).multiplyScalar(amt);
        else em.copy(m.material.userData.e0 || tmp.set(0, 0, 0));
      }
    }

    // Подписи следуют за точками в 3D.
    const w = vp.clientWidth, h = vp.clientHeight;
    for (const l of labels) {
      const show = l.visible();
      if (show) tmp.copy(l.at()).project(camera);
      const vis = show && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      l.el.style.visibility = vis ? 'visible' : 'hidden';
      if (vis) l.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
      l.el.classList.toggle('on', l.active());
    }

    renderer.shadowMap.needsUpdate = (frameNo++ & 1) === 0;
    renderer.render(scene, camera);

    // Адаптивное разрешение: держим ~60 кадров/с.
    if (dt > 0) {
      ftAvg += (dt * 1000 - ftAvg) * 0.05;
      if (++ftN > 90) {
        const next = ftAvg > 22 ? pr - 0.1 : ftAvg < 15 ? pr + 0.05 : pr;
        const c = Math.min(maxPR, Math.max(0.6, next));
        if (Math.abs(c - pr) > 0.01) { pr = c; renderer.setPixelRatio(pr); resize(); }
        ftN = 0;
      }
    }
  }
  let ftAvg = 16, ftN = 0, frameNo = 0;
  renderer.shadowMap.autoUpdate = false;
  frame();

  function dispose() {
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
    skyRT.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  return {
    renderer, scene, camera, controls, sun, sunDir, water, seabed,
    register, registerTree, setFocus, addLabel, flyTo, setFollow, setManual, onFrame, dispose,
  };
}
