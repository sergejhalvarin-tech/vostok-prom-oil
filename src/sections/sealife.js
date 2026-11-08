// Морская жизнь у платформы: косяки рыб (сельдь, морской окунь, треска), белухи и гренландский кит,
// донная фауна (ламинария, актинии, мягкие кораллы, морские звёзды, ежи, губки, валуны),
// световые столбы от поверхности и морской «снег». Всё обновляется, только когда камера под водой.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SEABED} from '../kit/stage.js';
import {makeReef} from './reef.js';
import {makeSeal, makeShark} from './creatures.js';

let seed = 21;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FLOOR = SEABED - 0.2;
// Зона жизни: перед лицевой стороной кессона (камера облёта ныряет здесь).
const AREA = {x0: -220, x1: 220, z0: 70, z1: 460};

// ----------------------------------------------------------------------
function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 12, 8);
  body.scale(0.32, 0.42, 1.25);
  const tail = new THREE.ConeGeometry(0.32, 0.55, 4);
  tail.rotateX(-Math.PI / 2);
  tail.scale(0.18, 1, 1);
  tail.translate(0, 0, 0.82);
  const fin = new THREE.ConeGeometry(0.12, 0.3, 3);
  fin.translate(0, 0.28, 0.05);
  return mergeGeometries([body, tail, fin].map((g) => g.toNonIndexed()));
}

function makeSchools() {
  const kinds = [
    {n: 90, color: 0xc9d8e8, var: 0.08, size: 1.1, c: V(-60, -8, 300), r: 55, h: 3, speed: 0.16, spread: [9, 3, 6]},  // сельдь
    {n: 50, color: 0xff6a3d, var: 0.05, size: 1.6, c: V(70, -13, 230), r: 38, h: 2, speed: -0.12, spread: [7, 2.5, 5]}, // морской окунь
    {n: 36, color: 0x8b8a5a, var: 0.06, size: 2.2, c: V(10, -16.5, 380), r: 70, h: 1, speed: 0.07, spread: [10, 1.5, 7]}, // треска у дна
    {n: 70, color: 0x9fc6ff, var: 0.1, size: 0.9, c: V(-20, -5, 170), r: 30, h: 2, speed: -0.22, spread: [6, 2, 5]},    // мойва
  ];
  const total = kinds.reduce((a, k) => a + k.n, 0);
  const mesh = new THREE.InstancedMesh(fishGeometry(), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.3, metalness: 0.55}), total);
  mesh.frustumCulled = false;
  const fish = [];
  const col = new THREE.Color();
  kinds.forEach((k) => {
    for (let i = 0; i < k.n; i++) {
      const j = fish.length;
      fish.push({k, off: V((rnd() - 0.5) * 2 * k.spread[0], (rnd() - 0.5) * 2 * k.spread[1], (rnd() - 0.5) * 2 * k.spread[2]), ph: rnd() * 6.28, s: k.size * (0.8 + rnd() * 0.4)});
      mesh.setColorAt(j, col.set(k.color).offsetHSL((rnd() - 0.5) * k.var, 0, (rnd() - 0.5) * 0.12));
    }
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = V(0, 0, 0), ahead = V(0, 0, 0), up = V(0, 1, 0);
  const center = (k, t) => V(k.c.x + Math.cos(t * k.speed) * k.r, k.c.y + Math.sin(t * k.speed * 2.3) * k.h, k.c.z + Math.sin(t * k.speed) * k.r * 0.7);
  return {
    mesh,
    update(t) {
      fish.forEach((f, i) => {
        const k = f.k, tt = t + f.ph * 0.15;
        const c0 = center(k, tt), c1 = center(k, tt + 0.3);
        const wob = Math.sin(t * 2 + f.ph) * 0.8;
        p.copy(c0).add(f.off).add(V(wob, Math.sin(t * 1.3 + f.ph) * 0.4, 0));
        ahead.copy(c1).add(f.off).add(V(Math.sin(t * 2 + 0.6 + f.ph) * 0.8, 0, 0));
        p.y = Math.min(p.y, -1.5);
        m4.lookAt(p, ahead, up);
        q.setFromRotationMatrix(m4);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.sin(t * 9 + f.ph) * 0.12)); // взмах хвостом
        mesh.setMatrixAt(i, m4.compose(p, q, sc.setScalar(f.s)));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ----------------------------------------------------------------------
// Кит из тела вращения, плавников и подвижных лопастей хвоста. Нос в −z.
function makeWhale({len, rad, color, belly, profile}) {
  const g = new THREE.Group();
  const pts = profile.map(([u, r]) => new THREE.Vector2(r * rad, u * len));
  const body = new THREE.LatheGeometry(pts, 28);
  body.rotateX(Math.PI / 2);
  body.translate(0, 0, -len / 2);
  const mat = new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.05});
  // Светлое брюхо — вершинными цветами.
  const pos = body.attributes.position, cols = [];
  const top = new THREE.Color(color), bot = new THREE.Color(belly);
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp(0.5 - pos.getY(i) / (rad * 1.6), 0, 1);
    const c = top.clone().lerp(bot, k * k);
    cols.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  mat.vertexColors = true;
  const bodyMesh = new THREE.Mesh(body, mat);
  g.add(bodyMesh);
  const finMat = new THREE.MeshStandardMaterial({color, roughness: 0.6});
  for (const s of [1, -1]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), finMat);
    fin.scale.set(rad * 0.9, rad * 0.08, rad * 0.35);
    fin.position.set(s * rad * 0.95, -rad * 0.45, -len * 0.18);
    fin.rotation.set(0, s * 0.5, s * -0.5);
    g.add(fin);
  }
  // Хвост: стебель + две лопасти, качаются вверх-вниз.
  const tail = new THREE.Group();
  tail.position.set(0, 0, len / 2 - len * 0.02);
  const fl = new THREE.Shape();
  const w = rad * 2.6, d = rad * 1.1;
  fl.moveTo(0, 0);
  fl.bezierCurveTo(w * 0.3, d * 0.2, w * 0.8, d * 0.6, w, d * 1.1);
  fl.bezierCurveTo(w * 0.6, d * 0.9, w * 0.2, d * 0.95, 0, d * 0.55);
  fl.bezierCurveTo(-w * 0.2, d * 0.95, -w * 0.6, d * 0.9, -w, d * 1.1);
  fl.bezierCurveTo(-w * 0.8, d * 0.6, -w * 0.3, d * 0.2, 0, 0);
  const flukes = new THREE.Mesh(new THREE.ExtrudeGeometry(fl, {depth: rad * 0.08, bevelEnabled: true, bevelSize: rad * 0.04, bevelThickness: rad * 0.04, bevelSegments: 2}), finMat);
  flukes.rotation.x = Math.PI / 2;
  tail.add(flukes);
  g.add(tail);
  // Глаза.
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.07, 8, 6), new THREE.MeshStandardMaterial({color: 0x0b0d10, roughness: 0.2}));
    eye.position.set(s * rad * 0.62, rad * 0.05, -len * 0.38);
    g.add(eye);
  }
  return {group: g, tail};
}

const BELUGA = [[0, 0.05], [0.03, 0.42], [0.08, 0.72], [0.14, 0.86], [0.22, 0.8], [0.35, 0.95], [0.5, 1], [0.65, 0.85], [0.8, 0.5], [0.92, 0.22], [1, 0.12]];
const BOWHEAD = [[0, 0.05], [0.04, 0.55], [0.12, 0.85], [0.22, 0.97], [0.35, 1], [0.5, 0.95], [0.66, 0.72], [0.8, 0.4], [0.92, 0.18], [1, 0.1]];

// ----------------------------------------------------------------------
// Световые столбы от поверхности.
function makeRays() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, 64, 256);
  const side = c.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = side;
  c.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({map: tex, color: 0x9fe8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false});
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6 + rnd() * 8, 26), mat);
    m.position.set(AREA.x0 + rnd() * (AREA.x1 - AREA.x0), -12, AREA.z0 + rnd() * (AREA.z1 - AREA.z0));
    m.rotation.set(0, rnd() * 3, 0.25);
    m.userData.ph = rnd() * 6;
    g.add(m);
  }
  return g;
}

// Морской «снег» — взвесь вокруг камеры.
function makeSnow() {
  const N = 1600, R = 45;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rnd() - 0.5) * 2 * R;
    pos[i * 3 + 1] = -0.6 - rnd() * 19;
    pos[i * 3 + 2] = (rnd() - 0.5) * 2 * R;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({color: 0xdff6ff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false}));
  pts.frustumCulled = false;
  return {
    points: pts,
    update(cam, t) {
      // Облако взвеси переносится за камерой шагами по 10 м и медленно оседает.
      pts.position.set(Math.round(cam.x / 10) * 10, -((t * 0.15) % 1), Math.round(cam.z / 10) * 10);
    },
  };
}

// ======================================================================
export function makeSeaLife() {
  const group = new THREE.Group();
  const timeU = {value: 0};
  const schools = makeSchools();
  const seabed = makeReef(timeU);
  const rays = makeRays();
  const snow = makeSnow();
  group.add(schools.mesh, seabed, rays, snow.points);

  // Белухи — стайка из трёх, и гренландский кит.
  const belugas = [0, 1, 2].map((i) => {
    const w = makeWhale({len: 5, rad: 0.85, color: 0xeef3f4, belly: 0xffffff, profile: BELUGA});
    w.ph = i * 0.9;
    group.add(w.group);
    return w;
  });
  const bowhead = makeWhale({len: 16, rad: 2.6, color: 0x23282e, belly: 0xd8dcd8, profile: BOWHEAD});
  group.add(bowhead.group);

  // Нерпы — играют у дна среди ламинарии; полярные акулы медленно кружат в толще.
  const seals = [0, 1].map((i) => { const s = makeSeal(); s.ph = i * 2.4; group.add(s.group); return s; });
  const sharks = [0, 1, 2].map((i) => { const s = makeShark(); s.ph = i * 2.1; group.add(s.group); return s; });

  const up = V(0, 1, 0), m4 = new THREE.Matrix4();
  const swim = (w, p, ahead, t, amp) => {
    w.group.position.copy(p);
    m4.lookAt(p, ahead, up);
    w.group.quaternion.setFromRotationMatrix(m4);
    w.group.rotateX(Math.sin(t * 1.6) * 0.05);
    if (w.tail) w.tail.rotation.x = Math.sin(t * 1.6 + 0.8) * amp;
  };

  const api = {
    group,
    belugaPos: V(0, 0, 0),
    update(dt, t, camPos) {
      // Только когда камера в воде или у самой поверхности рядом с платформой.
      const on = camPos.y < 4 && camPos.y > SEABED - 2 && Math.abs(camPos.x) < 700 && camPos.z > -300 && camPos.z < 900;
      group.visible = on;
      if (!on) return;
      timeU.value = t;
      schools.update(t);
      belugas.forEach((w, i) => {
        const a = t * 0.11 + w.ph * 0.35, b = a + 0.05;
        const P = (k) => V(40 + Math.cos(k) * 75 + i * 6, -9 + Math.sin(k * 3 + i) * 1.5 + i * 1.2, 270 + Math.sin(k) * 55 + i * 4);
        swim(w, P(a), P(b), t + w.ph, 0.45);
      });
      api.belugaPos.copy(belugas[1].group.position).add(V(0, 3, 0));
      {
        const a = t * 0.045, b = a + 0.03;
        const P = (k) => V(-30 + Math.cos(k) * 170, -12 + Math.sin(k * 2) * 1.5, 320 + Math.sin(k) * 110);
        swim(bowhead, P(a), P(b), t * 0.6, 0.3);
      }
      seals.forEach((sl, i) => {
        const k = t * 0.22 + sl.ph, k2 = k + 0.04;
        const P = (q) => V(-40 + Math.cos(q) * 45 + Math.sin(q * 2.3) * 12, -13 + Math.sin(q * 1.7) * 2.5, 250 + Math.sin(q) * 40 + i * 25);
        swim(sl, P(k), P(k2), t + sl.ph, 0);
        sl.update(t + sl.ph);
      });
      sharks.forEach((sh, i) => {
        const k = t * 0.05 + sh.ph, k2 = k + 0.02;
        const P = (q) => V(20 + Math.cos(q) * (110 + i * 25), -10 - i * 2 + Math.sin(q * 2) * 1.5, 300 + Math.sin(q) * (80 + i * 15));
        swim(sh, P(k), P(k2), t, 0);
        sh.update(t + sh.ph);
      });
      rays.children.forEach((r) => { r.rotation.z = 0.25 + Math.sin(t * 0.3 + r.userData.ph) * 0.06; r.material.opacity = 0.22; });
      snow.update(camPos, t);
    },
  };
  return api;
}
