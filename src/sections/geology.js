// Объёмный геологический блок под платформой: пласты — отдельные 3D-тела с рельефной текстурой породы,
// антиклинальная ловушка с нефтенасыщенной частью, вмурованные валуны, скважины с потоками.
// Блок вырезан по плоскости z = 0 (лицевой срез), уходит вглубь до z = −900. Дно моря — y = −20.
import * as THREE from 'three';
import {makeBeads, glassPipeMaterial, OIL, WATER} from '../kit/sea.js';
import {SEABED} from '../kit/stage.js';

const X0 = -600, X1 = 600, DEPTH = 900, BOT = -340, TOP = SEABED - 0.6;
const C = (x) => Math.cos((Math.PI * x) / 900);
export const RES_TOP = (x) => -200 + 36 * C(x);
export const RES_BOT = (x) => -236 + 36 * C(x);
export const OWC = -188; // водонефтяной контакт

let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Текстура породы: основной тон, зерно, слоистость, трещины, включения. Она же служит картой рельефа.
function rockTexture(base, {grain = 0.5, streaks = 0, cracks = 0, pebbles = 0, pores = 0, shine = false}) {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const c = new THREE.Color(base);
  g.fillStyle = `#${c.getHexString()}`;
  g.fillRect(0, 0, S, S);
  const tone = (k, a) => {
    const t = c.clone().offsetHSL(0, 0, k);
    return `rgba(${(t.r * 255) | 0},${(t.g * 255) | 0},${(t.b * 255) | 0},${a})`;
  };
  for (let i = 0; i < streaks; i++) {                       // слоистость
    const y = rnd() * S, h = 2 + rnd() * 10;
    g.fillStyle = tone((rnd() - 0.5) * 0.18, 0.5);
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
    g.lineTo(S, y + h); g.lineTo(0, y + h); g.fill();
  }
  for (let i = 0; i < 9000 * grain; i++) {                  // зерно
    g.fillStyle = tone((rnd() - 0.5) * 0.3, 0.35);
    const r = 0.6 + rnd() * 2.2;
    g.fillRect(rnd() * S, rnd() * S, r, r);
  }
  for (let i = 0; i < pebbles; i++) {                       // гальки и обломки
    const x = rnd() * S, y = rnd() * S, r = 3 + rnd() * 9;
    g.fillStyle = tone(-0.12 + rnd() * 0.25, 0.9);
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = tone(0.15, 0.5);
    g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.35, r * 0.25, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < pores; i++) {                         // поры коллектора
    g.fillStyle = tone(-0.25, 0.8);
    const r = 1 + rnd() * 3;
    g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = tone(-0.3, 0.7);                          // трещины
  for (let i = 0; i < cracks; i++) {
    g.lineWidth = 1 + rnd() * 1.5;
    let x = rnd() * S, y = rnd() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += 10 + rnd() * 30; g.lineTo(x, y); }
    g.stroke();
  }
  if (shine) {                                               // блики нефти
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(255,190,90,${0.05 + rnd() * 0.12})`;
      g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 6, 1 + rnd() * 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 70, 1 / 70);
  tex.anisotropy = 8;
  return tex;
}

// Тело пласта между кривыми top(x) и bot(x) на отрезке [xa, xb], вытянутое вглубь блока.
function layerGeometry(top, bot, xa = X0, xb = X1) {
  const s = new THREE.Shape();
  const step = 8;
  s.moveTo(xa, top(xa));
  for (let x = xa + step; x <= xb; x += step) s.lineTo(x, top(x));
  s.lineTo(xb, top(xb));
  for (let x = xb; x >= xa; x -= step) s.lineTo(x, bot(x));
  s.lineTo(xa, bot(xa));
  const g = new THREE.ExtrudeGeometry(s, {depth: DEPTH, bevelEnabled: false, steps: 1});
  g.translate(0, 0, -DEPTH);
  return g;
}

export function makeSection() {
  const group = new THREE.Group();
  const mat = (tex, o = {}) => new THREE.MeshStandardMaterial({map: tex, bumpMap: tex, bumpScale: 2.2, roughness: 0.92, metalness: 0, ...o});

  const flat = (y) => () => y;
  const L = [
    {name: 'Донные осадки', top: flat(TOP), tex: rockTexture(0xb7a175, {grain: 1, pebbles: 60, streaks: 12})},
    {name: 'Глины', top: flat(-36), tex: rockTexture(0x8b7f6b, {grain: 0.6, streaks: 30})},
    {name: 'Песчано-глинистая толща', top: (x) => -80 + 8 * C(x), tex: rockTexture(0xa38b62, {grain: 1.1, streaks: 18, pebbles: 30})},
    {name: 'Известняки', top: (x) => -128 + 20 * C(x), tex: rockTexture(0xbdb6a4, {grain: 0.7, cracks: 26, pebbles: 20, streaks: 8})},
    {name: 'Покрышка — плотные глины', top: (x) => -170 + 34 * C(x), bot: RES_TOP, tex: rockTexture(0x544c45, {grain: 0.5, streaks: 40})},
    {name: 'Коллектор (водонасыщенный)', top: (x) => Math.min(RES_TOP(x), OWC), tex: rockTexture(0x587080, {grain: 0.8, pores: 900, cracks: 6})},
    {name: 'Подстилающие породы', top: RES_BOT, tex: rockTexture(0x766c60, {grain: 0.9, cracks: 14, streaks: 10})},
  ];
  L.forEach((l, i) => {
    const bot = l.bot || (i < L.length - 1 ? L[i + 1].top : flat(BOT));
    const m = new THREE.Mesh(layerGeometry(l.top, bot), mat(l.tex));
    m.receiveShadow = true;
    m.userData.noCast = true;
    group.add(m);
  });
  // Нефтенасыщенная часть ловушки — над водонефтяным контактом.
  let xa = X0, xb = X1;
  for (let x = X0; x <= 0; x += 2) if (RES_TOP(x) > OWC) { xa = x; break; }
  xb = -xa;
  const oilTex = rockTexture(0x24160b, {grain: 0.7, pores: 1400, shine: true});
  const oilMesh = new THREE.Mesh(layerGeometry(RES_TOP, flat(OWC), xa, xb),
    mat(oilTex, {roughness: 0.28, metalness: 0.15, bumpScale: 1.4, emissive: 0x2a1404, emissiveIntensity: 0.6}));
  group.add(oilMesh);

  // Валуны, вмурованные в лицевой срез.
  const N = 420;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.9}), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const x = X0 + rnd() * (X1 - X0);
    const y = rnd() < 0.5 ? -22 - rnd() * 14 : -82 - rnd() * 70;
    const r = 0.8 + rnd() * 3;
    rocks.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, -r * 0.4), q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3)), s.set(r, r * 0.7, r)));
    rocks.setColorAt(i, col.setHSL(0.08 + rnd() * 0.05, 0.15, 0.35 + rnd() * 0.25));
  }
  group.add(rocks);

  // Скважины. x — где кончается горизонтальный ствол.
  const Z = 1.5;
  const head = (i) => new THREE.Vector3(-6 + (i - 3.5) * 2.6, SEABED, Z);
  const midOil = (x) => (RES_TOP(x) + Math.max(OWC, RES_BOT(x))) / 2;
  const curve = (i, xe, ye) => {
    const h0 = head(i);
    const xa2 = h0.x + 0.62 * (xe - h0.x);
    return new THREE.CatmullRomCurve3([
      h0,
      new THREE.Vector3(h0.x, SEABED - 40, Z),
      new THREE.Vector3(h0.x + 0.3 * (xe - h0.x), -125, Z),
      new THREE.Vector3(xa2, ye(xa2), Z),
      new THREE.Vector3(xe, ye(xe), Z),
    ], false, 'centripetal');
  };
  const prod = [-300, -195, -95, 60, 165, 285].map((xe, k) => curve([0, 1, 2, 5, 6, 7][k], xe, midOil));
  const inj = [curve(3, -400, () => -212), curve(4, 400, () => -212)];
  // Обсадные колонны — полупрозрачные, с тонированным кантом: добывающие тёплые, нагнетательные синие.
  const mProd = glassPipeMaterial(0xffc27a, 0.3), mInj = glassPipeMaterial(0x8cc8ff, 0.3);
  const ring = (c, m) => new THREE.Mesh(new THREE.TubeGeometry(c, 160, 1.9, 14), m);
  for (const c of prod) group.add(ring(c, mProd));
  for (const c of inj) group.add(ring(c, mInj));

  const oil = makeBeads(prod, 70, 1.05, OIL, 22, true);      // нефть поднимается к устьям
  const wat = makeBeads(inj, 80, 1.0, WATER, 26, false);     // вода уходит в пласт
  group.add(oil.mesh, wat.mesh);

  return {group, update: (dt) => { if (group.visible) { oil.update(dt); wat.update(dt); } }};
}
