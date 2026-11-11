// Главный экран: съёмка с дрона — быстрый детальный облёт по всем готовым этапам пути нефти.
// Камера идёт по ключевым кадрам (сплайн Эрмита с касательными по времени), часть кадров привязана
// к движущемуся танкеру. Мир рейса живёт по своему времени, которое пересчитывается из времени облёта.
import * as THREE from 'three';
import {createStage} from '../kit/stage.js';
import {buildVoyageWorld} from './voyage-world.js';
import {makeSection} from './geology.js';
import {makeSeaLife} from './sealife.js';
import {makeNarration} from './narration.js';
import {heightAt, pipeZ, STATIONS, DEPOT, getRail, railAt, LAKES, lakeQ, riverZ, riverLevel} from './landscape.js';
import {DEPOT_RACK} from './pipeline.js';

// Точка над рельефом: [x, высота земли + dy, z].
const above = (x, z, dy) => [x, heightAt(x, z) + dy, z];

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
    text: 'Узел учёта СИКН измеряет количество и качество нефти, резервуары «Транснефти» принимают её, а головная насосная станция отправляет по магистрали.', more: 'transport'},
  {t: 166, short: 'Магистраль', kicker: 'Трубопроводный транспорт', title: 'Через хребет — в долину',
    text: 'Две нитки нефтепровода «Транснефти» идут над землёй на опорах с термостабилизаторами: через хребет, над рекой, сквозь тайгу.', more: 'transport'},
  {t: 186, short: 'НПС', kicker: 'Каждые 100–200 км', title: 'Промежуточные насосные станции',
    text: 'НПС-1, НПС-2 и НПС-3 снова поднимают давление, чтобы нефть шла дальше. Расстояния в полёте сжаты.', more: 'transport'},
  {t: 210, short: 'Нефтебаза', kicker: '≈ 600 км от моря', title: 'Нефтебаза и налив в цистерны',
    text: 'Нефть принимают в резервуары нефтебазы и через эстакаду наливают в железнодорожные цистерны — по одной на каждое наливное устройство.', more: 'transport'},
  {t: 228, short: 'Поезд', kicker: 'Железная дорога', title: 'Маршрутный поезд с нефтью',
    text: 'Электровоз 2ЭС6 «Синара» ведёт состав из двадцати цистерн по электрифицированной дороге: через реку, над каньоном по арочному виадуку, вдоль горного озера.', more: 'transport'},
  {t: 279, short: 'НПЗ', kicker: 'Конечная точка', title: 'Терминал приёмки сырья НПЗ',
    text: 'Состав встаёт у сливной эстакады. Нефть через нижний слив уходит в коллектор, приёмная насосная качает её в резервуары, а оттуда — на установки завода.', more: 'transport'},
];
const F_END = 303, F_CARD = 297;

// Темп съёмки: перелёты быстрые, а на зверях и красивых видах дрон «зависает» — время сюжета замедляется.
// Скорость главы — секунд сюжета за секунду показа; DWELL — где задержаться [момент сюжета, сила 0…1].
const SPEED = [1.15, 1.35, 1.15, 1.15, 1.25, 1.7, 1.45, 1.9, 1.05, 1.0, 1.45, 1.6, 1.3];
const DWELL = [[44, 0.6], [181.5, 0.82], [186.8, 0.6], [192.5, 0.85], [200.5, 0.8], [202.8, 0.8], [251, 0.6], [264, 0.7], [270.5, 0.8], [282, 0.5]];
const WARP = (() => {
  const pts = [[0, 0]];
  let T = 0;
  const dF = 0.05;
  for (let f = 0; f < F_END; f += dF) {
    let ci = 0;
    CHAPTERS.forEach((c, i) => { if (f >= c.t) ci = i; });
    let v = f >= F_CARD ? 1 : SPEED[ci] ?? 1.2;
    for (const [fd, k] of DWELL) v *= 1 - k * Math.exp(-(((f - fd) / 1.6) ** 2));
    T += dF / Math.max(0.12, v);
    pts.push([T, f + dF]);
  }
  return pts;
})();
const T_END = WARP[WARP.length - 1][0];
const lerpTab = (tab, v, a, b) => {
  for (let i = 1; i < tab.length; i++) if (v <= tab[i][a]) { const p = tab[i - 1], q = tab[i]; return p[b] + (q[b] - p[b]) * (v - p[a]) / ((q[a] - p[a]) || 1); }
  return tab[tab.length - 1][b];
};
const storyAt = (T) => lerpTab(WARP, T, 0, 1);
const realAt = (F) => lerpTab(WARP, F, 1, 0);

// Поезд: путь головы состава как функция времени облёта (монотонный кубический сплайн).
const S_LOAD = DEPOT_RACK.sHead, S_STOP = getRail().len - 62;
const TS = [[0, S_LOAD], [229, S_LOAD], [234, S_LOAD + 50], [240, S_LOAD + 300], [246, 1290], [252, 1830], [258, 2350], [264, 2950], [270, 3600],
  [276, 4230], [282, 4720], [287, S_STOP - 22], [291, S_STOP], [9999, S_STOP]];
const trainS = (() => {
  const n = TS.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((TS[i + 1][1] - TS[i][1]) / (TS[i + 1][0] - TS[i][0]));
  for (let i = 0; i < n; i++) m.push(i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (f) => {
    let i = 0;
    while (i < n - 2 && f > TS[i + 1][0]) i++;
    const [x0, y0] = TS[i], [x1, y1] = TS[i + 1], h = x1 - x0, t = Math.min(1, Math.max(0, (f - x0) / h));
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1];
  };
})();
// Над рекой у моста: вдоль русла на dx от моста, на h над водой.
const BRIDGE_X = railAt(1730).x;
const overRiver = (dx, h) => { const x = BRIDGE_X + dx; return [x, riverLevel(x) + h, riverZ(x)]; };
// Точка у пути: s — по оси, d — поперёк (м), h — над полотном.
const rp = (s, d = 0, h = 0) => { const a = railAt(s); return [a.x + a.tz * d, a.y + h, a.z - a.tx * d]; };

// Время рейса как функция времени облёта (кусочно-линейно).
const VT = [[0, 0], [65.5, 0], [79.5, 15], [111.5, 44], [134.5, 70], [160, 106], [F_END, 106]];
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
          <div class="osd osd-tl"><i class="rec"></i>REC <b id="rec">00:00</b><span>4K · 60</span></div>
          <div class="osd osd-tr"><span>GPS ▮▮▮▮ 18</span><span class="bat"><i id="batBar"></i></span><b id="bat">98</b>%</div>
          <div class="osd osd-bl"><span>H</span><b id="alt">0</b>м<span>D</span><b id="dist">0.0</b>км</div>
          <div class="osd osd-br"><span>H.S</span><b id="spd">0</b>км/ч<span>V.S</span><b id="vs">0.0</b>м/с</div>
          <div class="osd-grid"></div>
          <div class="fl-cap" id="cap"></div>
        </div>
        <div class="fl-bar" id="bar">
          <div class="fl-chapters" id="chapters"></div>
          <div class="fl-ctl">
            <button class="fl-btn" id="bPause" title="Пауза">❚❚</button>
            <a class="fl-btn" id="bMore" href="#shelf">Подробнее об этапе</a>
            <button class="fl-btn" id="bSkip">Пропустить облёт →</button>
          </div>
        </div>
        <div class="fl-intro" id="intro">
          <div class="fl-intro-in">
            <div class="fl-brand"><span class="brand-drop"></span>ВОСТОК<b>ПРОМ</b>ОЙЛ</div>
            <h1>Путь нефти</h1>
            <p>Съёмка с дрона: от арктической платформы на шельфе до нефтеперерабатывающего завода — море, терминал, магистраль, нефтебаза и железная дорога. Около четырёх с половиной минут.</p>
            <div class="fl-start">
              <button class="fl-go" id="bGo" disabled><span id="goText">Загрузка 0%</span></button>
            </div>
            <a class="fl-alt" href="#shelf">Смотреть по разделам →</a>
          </div>
          <div class="fl-hint">Во время полёта можно зажать мышь и осмотреться</div>
        </div>
        <div class="fl-end" id="end">
          <div class="fl-end-in">
            <div class="fl-kick">Нефть на заводе</div>
            <h2>Дальше — переработка, базовые масла и ваше масло</h2>
            <p>Гидравлические, трансмиссионные, турбинные, компрессорные и индустриальные масла. Бочки, кубы IBC и налив по всей России.</p>
            <div class="fl-end-btns">
              <a class="fl-go" href="#contacts">Запросить КП</a>
              <a class="fl-btn2" href="#catalog">Каталог масел</a>
              <a class="fl-btn2" href="#shelf">Этапы подробно</a>
              <button class="fl-btn2" id="bReplay">Повторить облёт ↺</button>
            </div>
            <p class="fl-credits">3D-модели «МЛСП Приразломная» © Lightproduction, «Tanker Ship» © KoreanNavy, «Вагон цистерна для поезда» © mamont nikita, небо «FREE — SkyBox Mountain View» © Paul, перекат «Stream» © Paul — CC BY 4.0 (Sketchfab).</p>
          </div>
        </div>
      </div>
    </section>`;
  const $ = (id) => root.querySelector('#' + id);
  const vp = $('vp');

  const stage = createStage(vp, {cam: [-64, 42.5, -64], tgt: [30, 60, 25], pick: false});
  let dbg = null;
  if (location.hostname === 'localhost') { window.__stage = stage; window.__fl = {scan: () => { const out = []; const q = V(0, 0, 0); for (let f = 0; f < F_END; f += 0.25) { if (f > 33 && f < 66) continue; sample(f, 'p', q); let g = -1e9; for (const [dx, dz] of [[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14]]) g = Math.max(g, heightAt(q.x + dx, q.z + dz)); if (q.y < g + 7) out.push([f, Math.round(g + 7 - q.y)]); } return out; }, jump: (f) => jump(f), pause: () => { paused = true; }, look: (p, l) => { dbg = p ? [V(...p), V(...l)] : null; }}; } // для отладки
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
  // Олень на скале у озера: камера с суши, за оленем — озеро.
  const deerShot = (cam) => {
    const d = world.fauna.spots.deerCliff, lk = LAKES[0];
    const ux = d.x - lk.x, uz = d.z - lk.z, n = Math.hypot(ux, uz);
    const y = d.fixedY ?? heightAt(d.x, d.z);
    return cam ? [d.x + (ux / n) * 60, y + 14, d.z + (uz / n) * 60] : [d.x - (ux / n) * 25, y + 2, d.z - (uz / n) * 25];
  };
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
    {t: 46.5, p: [-10, -13, 240], l: [-60, -17, 170]},
    {t: 50, p: [-30, -14.8, 200], l: [0, -30, 60]},
    {t: 53.5, p: [0, -60, 470], l: [0, -125, -40]},
    {t: 57.5, p: [110, -150, 500], l: [0, -190, -60]},
    {t: 61, p: [90, -45, 470], l: [40, -12, 240]},
    {t: 63.5, p: [110, -8, 280], l: [60, -6, 200]},
    {t: 66, p: [190, 35, 160], l: [150, 15, -150]},
    {t: 69.5, p: [110, 45, -90], l: [150, 10, -170]},
    {t: 75.5, p: [330, 90, -60], l: tankerAt()},
    {t: 79.5, p: rel(160, 70, 200), l: tankerAt()},
    {t: 85.5, p: rel(110, 40, 40), l: rel(0, 10, -60)},
    {t: 93.5, p: rel(60, 16, -230), l: rel(0, 8, -40)},
    {t: 97.5, p: rel(26, 17, -96), l: rel(0, 9, -72)},
    {t: 101.5, p: rel(-110, 30, -110), l: rel(0, 10, 0)},
    {t: 109.5, p: rel(-150, 110, -200), l: [1540, 10, 0]},
    {t: 116.5, p: [1600, 60, -170], l: tankerAt(5)},
    {t: 122.5, p: [1430, 40, 110], l: [1505, 5, 30]},
    {t: 128.5, p: [1468, 28, 70], l: [1525, 10, 30]},
    {t: 133.5, p: [1494, 34, -40], l: [1524, 14, 2]},
    {t: 139.5, p: [1545, 20, -14], l: [1650, 9, -2]},
    {t: 145.5, p: [1700, 24, -8], l: [1780, 10, -2]},
    {t: 149.5, p: [1760, 40, -110], l: [1800, 6, -40]},
    {t: 154.5, p: [1850, 70, -60], l: [1880, 12, 40]},
    {t: 159.5, p: [2150, 75, 330], l: [2290, 8, 460]},
    {t: 164.5, p: [2390, 120, 360], l: [2900, 60, 470]},
    {t: 170, p: above(2980, 470, 30), l: above(3400, pipeZ(3400), 20)},
    {t: 176, p: above(4100, 520, 120), l: above(4800, pipeZ(4800), 40)},
    {t: 181.5, p: above(5566, 604, 16), l: above(5612, 548, 1.5)},
    {t: 187, p: above(6380, 600, 40), l: above(6540, 650, 4)},
    {t: 192.5, p: deerShot(1), l: deerShot(0)},
    {t: 196.5, p: above(8050, -300, 150), l: above(8600, 400, 20)},
    {t: 200.5, p: above(8630, 470, 26), l: above(8700, 600, 2)},
    {t: 201.7, p: above(8850, 760, 24), l: [9050, 58, riverZ(9050)]},
    {t: 202.8, p: [9010, 67, riverZ(9010)], l: [9330, 61, riverZ(9330)]},
    {t: 205.5, p: above(9760, 150, 80), l: [9840, 55, 305]},
    {t: 210, p: above(11050, 300, 65), l: above(STATIONS[2].x, STATIONS[2].z, 4)},
    {t: 215.5, p: above(13250, 330, 110), l: above(DEPOT.x, DEPOT.z, 0)},
    {t: 220.5, p: above(13560, 815, 22), l: above(13760, DEPOT.z + 170, 6)},
    {t: 225.5, p: above(13950, DEPOT.z + 150, 8), l: above(14120, DEPOT.z + 170, 5)},
    {t: 229.5, p: rp(S_LOAD + 26, 15, 6), l: rp(S_LOAD - 12, 0, 3)},
    {t: 235, p: rp(trainS(235) + 26, -17, 8), l: rp(trainS(235) - 18, 0, 3)},
    {t: 241, p: rp(trainS(241) + 120, 46, 32), l: rp(trainS(241) - 70, 0, 2)},
    {t: 246.5, p: overRiver(-330, 26), l: rp(1730, 0, -6)},
    {t: 251, p: overRiver(-250, 17), l: rp(trainS(251) - 140, 0, 4)},
    {t: 256.5, p: rp(trainS(256.5) + 210, 70, 75), l: rp(trainS(256.5), 0, 0)},
    {t: 261.5, p: rp(2840, -150, -50), l: rp(2840, 0, -14)},
    {t: 265.5, p: rp(2860, -105, -28), l: rp(trainS(265.5) - 110, 0, 2)},
    {t: 268, p: above(16600, 860, 55), l: [16935, 70, 1060]},
    {t: 270.5, p: [16935, 82, 1010], l: rp(trainS(270.5) - 90, 0, 3)},
    {t: 276, p: rp(trainS(276) + 260, -90, 62), l: rp(trainS(276), 0, 0)},
    {t: 282, p: [17440, 190, 760], l: [17860, 110, 330]},
    {t: 287.5, p: rp(S_STOP - 120, -24, 11), l: rp(S_STOP - 200, 0, 2)},
    {t: 292.5, p: [18140, 165, 120], l: [17700, 120, 360]},
    {t: 297.5, p: [18400, 250, 760], l: [17820, 100, 340]},
    {t: F_END, p: [18560, 320, 860], l: [17780, 100, 320]},
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
  tag('СИКН — учёт количества и качества нефти', [1800, 14, -40], 147, 153);
  tag('Насосная станция', [2296, 22, 453], 157, 167);
  tag('Магистральный нефтепровод «Транснефть»', [2600, 30, 470], 161, 176);
  tag('Опоры с термостабилизаторами', () => V(2990, heightAt(2990, pipeZ(2990)) + 8, pipeZ(2990)), 168, 175);
  tag('Переход через реку', [5730, 75, 600], 179, 185);
  STATIONS.forEach((st, i) => tag(`${st.name} · ≈${st.km} км`, () => V(st.x, heightAt(st.x, st.z) + 26, st.z), [185, 198.5, 207][i], [190, 203.5, 213][i]));
  const fa = world.fauna.spots;
  const onA = (st, dy) => () => V(st.a.position.x, st.a.position.y + dy, st.a.position.z);
  tag('Бурый медведь', onA(fa.bear, 6), 178.5, 184.5);
  tag('Лисы', onA(fa.fox, 3), 184.5, 189.5);
  tag('Северный олень на скале', onA(fa.deerCliff, 7), 189.5, 195);
  tag('Утёсы над рекой', () => V(9250, 92, riverZ(9250) + 50), 201.5, 205);
  tag('Стадо северных оленей', onA(fa.herd, 7), 198, 203.5);
  tag('Нефтебаза · ≈600 км', () => V(DEPOT.x - 150, heightAt(DEPOT.x, DEPOT.z) + 40, DEPOT.z - 100), 211, 226);
  tag('Эстакада налива в цистерны', () => V(13700, heightAt(13700, DEPOT.z + 175) + 16, DEPOT.z + 175), 215, 228);
  const locoA = world.train.sections[0];
  tag('Электровоз 2ЭС6 «Синара»', () => V(locoA.position.x, locoA.position.y + 7, locoA.position.z), 228.5, 240);
  tag('Цистерны с нефтью · 20 вагонов', () => V(...rp(trainS(F) - 160, 0, 7)), 235, 241);
  tag('Мост через реку', () => V(...rp(1730, 0, 16)), 245, 252.5);
  tag('Арочный виадук над каньоном', () => V(...rp(2830, 0, 14)), 259.5, 267.5);
  tag('Горное озеро', [16930, 84, 1070], 268.5, 274);
  tag('Терминал приёмки сырья НПЗ', [17840, 150, 520], 279.5, 287);
  tag('Сливная эстакада', () => V(...rp(S_STOP - 160, 6, 12)), 284.5, 291);
  tag('Резервуары сырой нефти', [17565, 130, 507], 283, 290);
  tag('Установка АВТ', [17632, 170, 384], 290, 297);
  tag('Факел', [18175, 190, 75], 290, 297);
  const levelTags = world.targets.map((tk) => stage.addLabel({html: '', cls: 'level', at: V(tk.x, 34, tk.z), visible: () => F >= 143.5 && F < 166}));

  // ---------- шкала глав ----------
  const chEl = $('chapters');
  chEl.innerHTML = CHAPTERS.map((c, i) => {
    const end = CHAPTERS[i + 1]?.t ?? F_END;
    return `<button class="fl-ch" data-i="${i}" style="flex:${end - c.t}"><i><em></em></i><span>${String(i + 1).padStart(2, '0')} ${c.short}</span></button>`;
  }).join('');
  const chBtns = [...chEl.children];
  chBtns.forEach((b) => (b.onclick = () => jump(CHAPTERS[+b.dataset.i].t)));

  // ---------- состояние полёта ----------
  let F = 0, T = 0, started = false, paused = false, chapter = -1;
  let yawOff = 0, pitchOff = 0, dragging = null;
  let roll = 0, yawPrev = null, yawRate = 0, spdSmooth = 0, clear = 0, vsSmooth = 0;
  const P = V(0, 0, 0), Lk = V(0, 0, 0), prevPos = V(-64, 42.5, -64), fwd = V(0, 0, 0);
  let prevY = 42.5;
  const voice = makeNarration();
  let finaleSaid = false;

  stage.setManual(() => Lk);

  function jump(f) {
    F = clamp(f, 0, F_END);
    T = realAt(F);
    world.resetWake();
    yawPrev = null;
    if (!started) start();
    paused = false;
    $('bPause').textContent = '❚❚';
    $('end').classList.toggle('on', F >= F_CARD);
    vp.classList.toggle('ended', F >= F_CARD);
    // Глава читается заново с начала; финал — на заставке.
    chapter = -1;
    finaleSaid = F >= F_CARD;
    if (finaleSaid) voice.play('finale');
  }
  function start() {
    started = true;
    $('intro').classList.add('off');
    vp.classList.add('flying');
    // Озвучка пока выключена (файлы и тексты сохранены — можно вернуть).
  }
  function setSound(on) {
    voice.set(on);
  }

  $('bGo').onclick = () => { F = 0; T = 0; chapter = -1; start(); };
  $('bPause').onclick = () => {
    paused = !paused;
    $('bPause').textContent = paused ? '▶' : '❚❚';
    paused ? voice.pause() : voice.resume();
  };
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

  // ---------- кадр ----------
  stage.onFrame((dt, wall) => {
    if (started && !paused) { T = Math.min(T_END, T + dt); F = storyAt(T); }
    const playing = started && !paused;

    // Мир рейса.
    info = world.update(voyageTime(F), playing ? dt : 0, wall, playing, camera);
    world.setTrain(trainS(F));
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
    if (dbg) { P.copy(dbg[0]); Lk.copy(dbg[1]); }
    // Над землёй и водой — всегда с запасом (кроме сцены под водой у платформы).
    if (!(F > 33 && F < 66)) {
      let g = -1e9;
      for (const [dx, dz] of [[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14]]) g = Math.max(g, heightAt(P.x + dx, P.z + dz));
      if (P.x > 5500 && Math.abs(P.z - riverZ(P.x)) < 70) g = Math.max(g, riverLevel(P.x));
      for (const lk of LAKES) if (Math.abs(P.x - lk.x) < 900 && Math.abs(P.z - lk.z) < 900 && lakeQ(lk, P.x, P.z) < 1.15) g = Math.max(g, lk.L);
      if (P.x < 1700) g = Math.max(g, 0);
      const want = g + 7;
      clear += ((want > P.y ? want - P.y : 0) - clear) * Math.min(1, dt * 6);
      P.y += Math.max(clear, want - P.y - 3, 0);
    }
    const shake = V(Math.sin(wall * 0.37) * 0.12, Math.sin(wall * 0.29) * 0.08, Math.cos(wall * 0.31) * 0.12).multiplyScalar(started ? 1 : 0.4);
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
    roll = 0;
    if (!dragging) { yawOff *= Math.pow(0.08, dt); pitchOff *= Math.pow(0.08, dt); }
    camera.rotateY(yawOff);
    camera.rotateX(pitchOff);


    world.cullShore(camera);
    life.update(dt, wall, camera.position);

    // Табло.
    if (dt > 0) {
      const v = camera.position.distanceTo(prevPos) / dt * 3.6;
      spdSmooth += (v - spdSmooth) * Math.min(1, dt * 2);
    }
    prevPos.copy(camera.position);
    const alt = camera.position.y - Math.max(0, heightAt(camera.position.x, camera.position.z));
    if (dt > 0) vsSmooth += ((camera.position.y - prevY) / dt - vsSmooth) * Math.min(1, dt * 2);
    prevY = camera.position.y;
    $('alt').textContent = camera.position.y < 0 ? `−${Math.round(-camera.position.y)}` : Math.round(Math.max(0, alt));
    $('spd').textContent = Math.round(started ? spdSmooth : 0);
    $('vs').textContent = (started ? vsSmooth : 0).toFixed(1);
    $('dist').textContent = (Math.hypot(camera.position.x + 64, camera.position.z + 64) / 1000).toFixed(1);
    const sec = Math.floor(started ? T : 0);
    $('rec').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    const bat = Math.round(98 - (T / T_END) * 61);
    $('bat').textContent = bat;
    $('batBar').style.width = bat + '%';
    $('under').style.opacity = clamp(-alt / 6, 0, 1) * 0.9;

    // Глава, титр, прогресс.
    let ci = 0;
    CHAPTERS.forEach((c, i) => { if (F >= c.t) ci = i; });
    if (ci !== chapter) {
      chapter = ci;
      if (started && F < F_CARD) voice.play(ci);
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
    if (started && F >= F_CARD) {
      $('end').classList.add('on');
      vp.classList.add('ended');
      if (!finaleSaid) { finaleSaid = true; voice.play('finale'); }
    }
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
    voice.dispose();
    stage.dispose();
  };
}
