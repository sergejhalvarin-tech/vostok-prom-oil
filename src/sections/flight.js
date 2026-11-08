// Главный экран: облёт с борта вертолёта от первого лица по всем готовым этапам пути нефти.
// Камера идёт по ключевым кадрам (сплайн Эрмита с касательными по времени), часть кадров привязана
// к движущемуся танкеру. Мир рейса живёт по своему времени, которое пересчитывается из времени облёта.
import * as THREE from 'three';
import {createStage} from '../kit/stage.js';
import {buildVoyageWorld} from './voyage-world.js';
import {makeSection} from './geology.js';
import {makeSeaLife} from './sealife.js';
import {makeRotorSound} from './rotor-sound.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;

// Главы облёта: время начала (с), подпись на шкале, титр, раздел «подробнее».
const CHAPTERS = [
  {t: 0, short: 'Взлёт', kicker: 'Арктический шельф', title: 'Взлёт с платформы «Приразломная»',
    text: 'Печорское море, около 60 км от берега. Здесь начинается путь нефти, из которой потом сделают ваше масло.', more: 'shelf'},
  {t: 14, short: 'Платформа', kicker: 'Добыча', title: 'Морская ледостойкая платформа',
    text: 'Буровая, промысел, нефтехранилище и причал в одном сооружении. Платформа стоит на дне под собственным весом и держит напор льда.', more: 'shelf'},
  {t: 34, short: 'Под водой', kicker: 'Печорское море', title: 'Жизнь у подножия платформы',
    text: 'Косяки сельди и морского окуня, белухи и гренландский кит. На дне ламинария, актинии, мягкие кораллы и морские звёзды.', more: 'shelf'},
  {t: 50, short: 'К пласту', kicker: 'Под дном моря', title: '2,5 километра вглубь',
    text: 'Слой за слоем: донные осадки, глины, известняки, плотная покрышка и пористый коллектор с нефтью. Добывающие скважины поднимают нефть, нагнетательные закачивают воду.', more: 'shelf'},
  {t: 65.5, short: 'Отгрузка', kicker: 'Отгрузка', title: 'Нефть уходит на танкер',
    text: 'Насосы гонят нефть из танков кессона по шлангу на челночный танкер. Когда его танки полны, шланг поднимают на стрелу, и танкер отходит.', more: 'shelf'},
  {t: 79.5, short: 'Рейс', kicker: 'Транспорт', title: 'Рейс через лёд',
    text: 'Танкер ледового класса везёт около 70 тысяч тонн нефти к береговому терминалу. Время в полёте ускорено.', more: 'transport'},
  {t: 111.5, short: 'Порт', kicker: 'Береговой терминал', title: 'Швартовка и стендеры',
    text: 'Буксиры прижимают танкер к причалу, швартовщики заводят концы, морские стендеры стыкуются с манифольдом.', more: 'transport'},
  {t: 134.5, short: 'Резервуары', kicker: 'Приёмка', title: 'Резервуарный парк',
    text: 'Насосы танкера гонят нефть по эстакаде в резервуары с плавающими крышами. Отсюда она пойдёт на завод. Это следующий этап.', more: 'transport'},
];
const F_END = 167.5, F_CARD = 161.5;

// Время рейса как функция времени облёта (кусочно-линейно).
const VT = [[0, 0], [65.5, 0], [79.5, 15], [111.5, 44], [134.5, 70], [158.5, 106], [F_END, 106]];
const voyageTime = (f) => {
  for (let i = 1; i < VT.length; i++) {
    const [f0, t0] = VT[i - 1], [f1, t1] = VT[i];
    if (f <= f1) return t0 + ((t1 - t0) * (f - f0)) / (f1 - f0);
  }
  return VT[VT.length - 1][1];
};

export function mountFlight(root, sec, next) {
  document.body.classList.add('immersive');
  root.innerHTML = `
    <section class="flight">
      <div class="viewport fl-vp" id="vp">
        <div class="labels"></div>
        <div class="tip"></div>
        <div class="fl-under" id="under"></div>
        <div class="fl-frame"></div>
        <div class="fl-hud" id="hud">
          <div class="fl-tape"><div class="fl-tape-in" id="tape"></div><i class="fl-tape-mark"></i><b id="hdg">000</b></div>
          <div class="fl-gauge fl-left"><small>ВЫСОТА</small><b id="alt">0</b><small>м</small></div>
          <div class="fl-gauge fl-right"><small>СКОРОСТЬ</small><b id="spd">0</b><small>км/ч</small></div>
          <div class="fl-cap" id="cap"></div>
        </div>
        <div class="fl-bar" id="bar">
          <div class="fl-chapters" id="chapters"></div>
          <div class="fl-ctl">
            <button class="fl-btn" id="bPause" title="Пауза">❚❚</button>
            <button class="fl-btn" id="bSound" title="Звук">ЗВУК ВЫКЛ</button>
            <a class="fl-btn" id="bMore" href="#shelf">Подробнее об этапе</a>
            <button class="fl-btn" id="bSkip">Пропустить облёт →</button>
          </div>
        </div>
        <div class="fl-intro" id="intro">
          <div class="fl-intro-in">
            <div class="fl-brand"><span class="brand-drop"></span>ВОСТОК<b>ПРОМ</b>ОЙЛ</div>
            <h1>Путь нефти</h1>
            <p>Облёт с борта вертолёта: от арктической платформы на шельфе до резервуаров берегового терминала. Около двух с половиной минут.</p>
            <div class="fl-start">
              <button class="fl-go" id="bGo" disabled><span id="goText">Загрузка 0%</span></button>
              <label class="fl-snd"><input type="checkbox" id="cSound"> со звуком</label>
            </div>
            <a class="fl-alt" href="#shelf">Смотреть по разделам →</a>
          </div>
          <div class="fl-hint">Во время полёта можно зажать мышь и осмотреться</div>
        </div>
        <div class="fl-end" id="end">
          <div class="fl-end-in">
            <div class="fl-kick">Нефть в резервуарах</div>
            <h2>Дальше — переработка, базовые масла и ваше масло</h2>
            <p>Гидравлические, трансмиссионные, турбинные, компрессорные и индустриальные масла. Бочки, кубы IBC и налив по всей России.</p>
            <div class="fl-end-btns">
              <a class="fl-go" href="#contacts">Запросить КП</a>
              <a class="fl-btn2" href="#catalog">Каталог масел</a>
              <a class="fl-btn2" href="#shelf">Этапы подробно</a>
              <button class="fl-btn2" id="bReplay">Повторить облёт ↺</button>
            </div>
          </div>
        </div>
      </div>
    </section>`;
  const $ = (id) => root.querySelector('#' + id);
  const vp = $('vp');

  const stage = createStage(vp, {cam: [-64, 42.5, -64], tgt: [30, 60, 25], pick: false});
  if (location.hostname === 'localhost') window.__stage = stage; // для отладки
  const camera = stage.camera;
  camera.fov = 55;
  camera.updateProjectionMatrix();

  const world = buildVoyageWorld(stage);
  const section = makeSection();
  const life = makeSeaLife();
  stage.scene.add(life.group);
  section.group.visible = false;
  stage.scene.add(section.group);

  // ---------- ключевые кадры ----------
  const rel = (x, y, z) => () => world.tanker.localToWorld(V(x, y, z));
  const tankerAt = (dy = 10) => () => world.tanker.localToWorld(V(0, dy, 20));
  const K = [
    {t: 0, p: [-64, 42.5, -64], l: [30, 60, 25]},
    {t: 4, p: [-64, 47, -64], l: [30, 62, 25]},
    {t: 9, p: [-100, 80, -120], l: [0, 40, 0]},
    {t: 14, p: [-170, 105, 20], l: [0, 35, 0]},
    {t: 20, p: [-60, 95, 210], l: [10, 45, 10]},
    {t: 26, p: [150, 120, 180], l: [30, 62, 20]},
    {t: 31, p: [190, 70, -60], l: [55, 40, -60]},
    {t: 36, p: [120, 22, 230], l: [0, 0, 40]},
    {t: 39.5, p: [70, 2, 300], l: [20, -10, 240]},
    {t: 42.5, p: [45, -7, 275], l: [0, -9, 220]},
    {t: 46.5, p: [-10, -14, 240], l: [-60, -18, 170]},
    {t: 50, p: [-30, -17.5, 200], l: [0, -30, 60]},
    {t: 53.5, p: [0, -60, 330], l: [0, -110, 0]},
    {t: 57.5, p: [30, -150, 360], l: [0, -195, 0]},
    {t: 61, p: [90, -50, 330], l: [40, -12, 200]},
    {t: 63.5, p: [110, -8, 280], l: [60, -6, 200]},
    {t: 66, p: [190, 35, 160], l: [150, 15, -150]},
    {t: 69.5, p: [110, 45, -90], l: [150, 10, -170]},
    {t: 75.5, p: [330, 90, -60], l: tankerAt()},
    {t: 79.5, p: rel(160, 70, 200), l: tankerAt()},
    {t: 85.5, p: rel(110, 40, 40), l: rel(0, 10, -60)},
    {t: 93.5, p: rel(60, 16, -230), l: rel(0, 8, -40)},
    {t: 101.5, p: rel(-110, 30, -110), l: rel(0, 10, 0)},
    {t: 109.5, p: rel(-150, 110, -200), l: [1540, 10, 0]},
    {t: 116.5, p: [1600, 60, -170], l: tankerAt(5)},
    {t: 122.5, p: [1430, 40, 110], l: [1505, 5, 30]},
    {t: 128.5, p: [1468, 28, 70], l: [1525, 10, 30]},
    {t: 133.5, p: [1494, 34, -40], l: [1524, 14, 2]},
    {t: 139.5, p: [1545, 20, -14], l: [1650, 9, -2]},
    {t: 145.5, p: [1700, 24, -8], l: [1780, 10, -2]},
    {t: 150.5, p: [1785, 55, -120], l: [1870, 15, 40]},
    {t: 156.5, p: [1830, 105, -60], l: [1880, 10, 40]},
    {t: 162.5, p: [1560, 300, -560], l: [1700, 0, 0]},
    {t: F_END, p: [1500, 360, -650], l: [1700, 0, 0]},
  ];
  const at = (k, key) => (typeof k[key] === 'function' ? k[key]() : V(...k[key]));
  // Эрмит с касательными по соседним кадрам, нормированными на время: скорость непрерывна.
  function sample(f, key, out) {
    let i = 0;
    while (i < K.length - 2 && f >= K[i + 1].t) i++;
    const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
    const P0 = at(k0, key), P1 = at(k1, key), P2 = at(k2, key), P3 = at(k3, key);
    const d = k2.t - k1.t, u = clamp((f - k1.t) / d, 0, 1);
    const m1 = i === 0 ? V(0, 0, 0) : P2.clone().sub(P0).divideScalar(k2.t - k0.t);
    const m2 = i + 2 >= K.length ? V(0, 0, 0) : P3.clone().sub(P1).divideScalar(k3.t - k1.t);
    const u2 = u * u, u3 = u2 * u;
    return out.copy(P1).multiplyScalar(2 * u3 - 3 * u2 + 1)
      .addScaledVector(m1, (u3 - 2 * u2 + u) * d)
      .addScaledVector(P2, -2 * u3 + 3 * u2)
      .addScaledVector(m2, (u3 - u2) * d);
  }

  // ---------- подписи в полёте ----------
  const tag = (text, p, f0, f1) => stage.addLabel({
    html: `<span>${text}</span>`, cls: 'ftag', at: typeof p === 'function' ? p : V(...p), visible: () => F >= f0 && F < f1,
  });
  let info = world.update(0, 0, 0, false);
  tag('Буровой комплекс', [37, 122, 30], 16, 31);
  tag('Кессон — основание и хранилище', [-6, 12, 64], 24, 37);
  tag('Стрела устройства отгрузки', [48, 76, -56], 28, 34);
  tag('Стрела устройства отгрузки', [48, 76, -56], 64, 74);
  tag('Белухи', () => life.belugaPos, 40, 49);
  tag('Скважины', [60, -150, 2], 52.5, 61);
  tag('Нефтяной пласт ≈ 2,5 км', [-150, -192, 2], 52.5, 61);
  tag('Покрышка — плотные глины', [-260, -150, 2], 52.5, 61);
  tag('Известняки', [-300, -112, 2], 52.5, 61);
  tag('Челночный танкер · 70 тыс. т', () => info.tankerLabel, 69.5, 111.5);
  tag('Буксиры', () => info.tugLabel, 114.5, 127.5);
  tag('Морские стендеры', [1528, 36, 6], 127.5, 139.5);
  tag('Эстакада с трубопроводами', [1640, 16, -2], 137.5, 146.5);
  const levelTags = world.targets.map((tk) => stage.addLabel({html: '', cls: 'level', at: V(tk.x, 34, tk.z), visible: () => F >= 143.5 && F < F_CARD + 2}));

  // ---------- шкала глав ----------
  const chEl = $('chapters');
  chEl.innerHTML = CHAPTERS.map((c, i) => {
    const end = CHAPTERS[i + 1]?.t ?? F_END;
    return `<button class="fl-ch" data-i="${i}" style="flex:${end - c.t}"><i><em></em></i><span>${String(i + 1).padStart(2, '0')} ${c.short}</span></button>`;
  }).join('');
  const chBtns = [...chEl.children];
  chBtns.forEach((b) => (b.onclick = () => jump(CHAPTERS[+b.dataset.i].t)));

  // ---------- состояние полёта ----------
  let F = 0, started = false, paused = false, chapter = -1;
  let yawOff = 0, pitchOff = 0, dragging = null;
  let roll = 0, yawPrev = null, yawRate = 0, spdSmooth = 0;
  const P = V(0, 0, 0), Lk = V(0, 0, 0), prevPos = V(-64, 42.5, -64), fwd = V(0, 0, 0);
  const sound = makeRotorSound();

  stage.setManual(() => Lk);

  function jump(f) {
    F = clamp(f, 0, F_END);
    world.resetWake();
    yawPrev = null;
    if (!started) start();
    paused = false;
    $('bPause').textContent = '❚❚';
    $('end').classList.toggle('on', F >= F_CARD);
    vp.classList.toggle('ended', F >= F_CARD);
  }
  function start() {
    started = true;
    $('intro').classList.add('off');
    vp.classList.add('flying');
    if ($('cSound').checked) setSound(true);
  }
  function setSound(on) {
    on ? sound.start() : sound.stop();
    $('bSound').textContent = on ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ';
    $('bSound').classList.toggle('on', on);
  }

  $('bGo').onclick = () => { F = 0; start(); };
  $('bPause').onclick = () => { paused = !paused; $('bPause').textContent = paused ? '▶' : '❚❚'; };
  $('bSound').onclick = () => setSound(!sound.on);
  $('bSkip').onclick = () => jump(F_CARD);
  $('bReplay').onclick = () => jump(0);

  // Осмотреться: перетаскивание мышью/пальцем, по отпусканию взгляд плавно возвращается по курсу.
  const onDown = (e) => { if (e.target === stage.renderer.domElement) dragging = {x: e.clientX, y: e.clientY, yaw: yawOff, pitch: pitchOff}; };
  const onMove = (e) => {
    if (!dragging) return;
    yawOff = clamp(dragging.yaw - (e.clientX - dragging.x) * 0.004, -1.6, 1.6);
    pitchOff = clamp(dragging.pitch - (e.clientY - dragging.y) * 0.003, -0.7, 0.5);
  };
  const onUp = () => (dragging = null);
  vp.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);

  // Лента курса.
  const tape = $('tape');
  tape.innerHTML = Array.from({length: 109}, (_, i) => {
    const deg = i * 10 - 360, d = ((deg % 360) + 360) % 360;
    const lab = {0: 'С', 90: 'В', 180: 'Ю', 270: 'З'}[d] ?? (d % 30 === 0 ? String(d) : '');
    return `<span style="left:${(deg + 360) * 4}px" class="${lab ? 'big' : ''}">${lab}</span>`;
  }).join('');

  // ---------- кадр ----------
  stage.onFrame((dt, wall) => {
    if (started && !paused) F = Math.min(F_END, F + dt);
    const playing = started && !paused;

    // Мир рейса.
    info = world.update(voyageTime(F), playing ? dt : 0, wall, playing);
    world.targets.forEach((tk, i) => {
      const html = `<b>Р-${tk.ri + 1}</b> ${Math.round(info.levels[i] * 100)}%`;
      if (levelTags[i].el.innerHTML !== html) levelTags[i].el.innerHTML = html;
    });

    // Разрез под дном — когда камера уходит под воду.
    const under = F > 38 && F < 65;
    if (section.group.visible !== under) section.group.visible = under;
    if (under) section.update(dt);

    // Камера: точка и цель по сплайну, тряска ротора, крен в поворотах, свободный взгляд.
    sample(F, 'p', P);
    sample(F, 'l', Lk);
    const air = clamp((F - 1.5) / 3, 0, 1) * (started ? 1 : 0);
    const shake = V(Math.sin(wall * 1.7) * 0.25 + Math.sin(wall * 4.1) * 0.06, Math.sin(wall * 2.3) * 0.2, Math.cos(wall * 1.3) * 0.25).multiplyScalar(air);
    if (!started) shake.set(0, Math.sin(wall * 0.8) * 0.05, 0);
    camera.position.copy(P).add(shake);
    camera.up.set(0, 1, 0);
    camera.lookAt(Lk);
    camera.getWorldDirection(fwd);
    const yaw = Math.atan2(fwd.x, -fwd.z);
    if (yawPrev !== null && dt > 0) {
      const r = Math.atan2(Math.sin(yaw - yawPrev), Math.cos(yaw - yawPrev)) / dt;
      yawRate += (r - yawRate) * Math.min(1, dt * 2.5);
    }
    yawPrev = yaw;
    roll += (clamp(-yawRate * 0.55, -0.26, 0.26) * air - roll) * Math.min(1, dt * 3);
    if (!dragging) { yawOff *= Math.pow(0.08, dt); pitchOff *= Math.pow(0.08, dt); }
    camera.rotateY(yawOff);
    camera.rotateX(pitchOff);
    camera.rotateZ(roll + Math.sin(wall * 13) * 0.0015 * air);

    world.cullShore(camera);
    life.update(dt, wall, camera.position);

    // Табло.
    if (dt > 0) {
      const v = camera.position.distanceTo(prevPos) / dt * 3.6;
      spdSmooth += (v - spdSmooth) * Math.min(1, dt * 2);
    }
    prevPos.copy(camera.position);
    const alt = camera.position.y;
    $('alt').textContent = alt < 0 ? `−${Math.round(-alt)}` : Math.round(alt);
    $('spd').textContent = Math.round(started ? spdSmooth : 0);
    const hdg = ((yaw * 180) / Math.PI + 360) % 360;
    $('hdg').textContent = String(Math.round(hdg) % 360).padStart(3, '0');
    tape.style.transform = `translateX(${-(hdg + 360) * 4}px)`;
    $('under').style.opacity = clamp(-alt / 6, 0, 1) * 0.9;
    sound.setSpeed(started ? spdSmooth : 0);

    // Глава, титр, прогресс.
    let ci = 0;
    CHAPTERS.forEach((c, i) => { if (F >= c.t) ci = i; });
    if (ci !== chapter) {
      chapter = ci;
      const c = CHAPTERS[ci];
      const cap = $('cap');
      cap.classList.remove('in');
      void cap.offsetWidth;
      cap.innerHTML = `<div class="fl-kick">${String(ci + 1).padStart(2, '0')} · ${c.kicker}</div><h2>${c.title}</h2><p>${c.text}</p>`;
      cap.classList.add('in');
      $('bMore').href = '#' + c.more;
    }
    chBtns.forEach((b, i) => {
      const c0 = CHAPTERS[i].t, c1 = CHAPTERS[i + 1]?.t ?? F_END;
      b.firstChild.firstChild.style.width = `${clamp((F - c0) / (c1 - c0), 0, 1) * 100}%`;
      b.classList.toggle('on', i === ci);
    });
    if (started && F >= F_CARD) { $('end').classList.add('on'); vp.classList.add('ended'); }
  });

  // ---------- загрузка ----------
  world.load((e) => {
    if (e.total && $('goText')) $('goText').textContent = `Загрузка ${Math.round((e.loaded / e.total) * 100)}%`;
  }).then(() => {
    if (!$('bGo')) return;
    $('bGo').disabled = false;
    $('goText').textContent = 'Начать облёт';
  }, (err) => { console.error(err); if ($('goText')) $('goText').textContent = 'Не удалось загрузить'; });

  return () => {
    document.body.classList.remove('immersive');
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
    sound.dispose();
    stage.dispose();
  };
}
