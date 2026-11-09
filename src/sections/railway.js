// Электрифицированная железная дорога от нефтебазы до терминала приёмки сырья НПЗ:
//  • полоса рельефа вдоль пути (мелкая сетка: выемки, насыпи, откосы), балластная призма, шпалы, рельсы;
//  • контактная сеть: железобетонные опоры с консолями, несущий трос и контактный провод со струнами;
//  • мост через реку — стальные фермы с ездой понизу на массивных опорах;
//  • виадук над каньоном — бетонная арка с надарочными стойками и подходами на высоких опорах.
import * as THREE from 'three';
import {getRail, railAt, heightAt, paintTerrain, DEPOT} from './landscape.js';
import {RAIL_TOP} from './train.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.6, metalness: 0.15, ...o});
const M = {
  ballast: mat(0x8d8478, {roughness: 1}),
  sleeper: mat(0x6d6a64, {roughness: 0.9}),
  rail: mat(0x9aa0a6, {metalness: 0.85, roughness: 0.35}),
  concrete: mat(0xc9c3b6, {roughness: 0.9}),
  stone: mat(0xb8afa0, {roughness: 0.95}),
  truss: mat(0x5f7f86, {metalness: 0.55, roughness: 0.45}),
  mast: mat(0xb9b6ad, {roughness: 0.8}),
  steel: mat(0x8c949a, {metalness: 0.7, roughness: 0.4}),
  ins: mat(0x6b4a33, {roughness: 0.4}),
};
export const WIRE_H = 6.4;   // контактный провод над головкой рельса

// Поперечный «прогон» профиля [(d, h)] вдоль точек пути — лента/призма произвольного сечения.
function sweep(pts, prof, m, closed = false) {
  const P = [], I = [];
  const nP = prof.length;
  for (const p of pts) for (const [d, h] of prof) P.push(p.x + p.tz * d, p.y + h, p.z - p.tx * d);
  const segs = closed ? nP : nP - 1;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * nP + j, b = i * nP + (j + 1) % nP, c = a + nP, d = b + nP;
    I.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}
const boxAt = (p, w, h, d, m, x, y, z, ry = 0, key) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.rotation.y = ry;
  if (key) o.userData.key = key;
  p.add(o);
  return o;
};
const link = (p, a, b, r, m, seg = 6) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.scale.y = a.distanceTo(b);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  p.add(o);
  return o;
};

export function buildRailway(p, {sFrom}) {
  const R = getRail();
  const k = 'railway';
  const pts = R.pts.filter((q) => q.s >= sFrom - 4);
  const yawOf = (q) => Math.atan2(q.tx, q.tz);

  // 1. Полоса рельефа вдоль пути: шаг 4 м вдоль, 4 м поперёк, ±64 м.
  {
    const strip = R.pts.filter((q) => q.x > DEPOT.x + DEPOT.w / 2 - 30);
    const cols = 33, P = [], I = [];
    strip.forEach((q, i) => {
      for (let j = 0; j < cols; j++) {
        const d = -64 + j * 4, x = q.x + q.tz * d, z = q.z - q.tx * d;
        P.push(x, heightAt(x, z), z);
        if (i && j) { const a = (i - 1) * cols + j - 1, b = a + 1, c = a + cols, e = c + 1; I.push(a, b, c, b, e, c); }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(I);
    g.computeVertexNormals();
    // Порядок вершин может дать нормали вниз — развернём при необходимости.
    if (g.attributes.normal.getY(Math.floor(P.length / 6)) < 0) {
      for (let i = 0; i < I.length; i += 3) [I[i + 1], I[i + 2]] = [I[i + 2], I[i + 1]];
      g.setIndex(I);
      g.computeVertexNormals();
    }
    paintTerrain(g, true);
    const t = new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true}));
    t.receiveShadow = true;
    t.userData.noCast = true;
    t.userData.dynamic = true;                 // не сливать: цвета вершин
    p.add(t);
  }

  // 2. Верхнее строение пути: балластная призма (на мостах — по плите), шпалы, рельсы.
  const ballast = sweep(pts, [[-4.6, -0.6], [-3.0, 0.6], [3.0, 0.6], [4.6, -0.6]], M.ballast);
  ballast.userData.noCast = true;
  ballast.userData.key = k;
  p.add(ballast);
  for (const sx of [-0.79, 0.71]) {
    const r = sweep(pts, [[sx, RAIL_TOP - 0.18], [sx, RAIL_TOP], [sx + 0.08, RAIL_TOP], [sx + 0.08, RAIL_TOP - 0.18]], M.rail, true);
    r.userData.key = k;
    r.userData.noCast = true;
    p.add(r);
  }
  {
    const n = Math.floor((pts[pts.length - 1].s - pts[0].s) / 0.9);
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.75, 0.17, 0.27), M.sleeper, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), a = {};
    for (let i = 0; i < n; i++) {
      railAt(pts[0].s + i * 0.9, a);
      q.setFromAxisAngle(V(0, 1, 0), Math.atan2(a.tx, a.tz));
      sl.setMatrixAt(i, m4.compose(V(a.x, a.y + RAIL_TOP - 0.26, a.z), q, V(1, 1, 1)));
    }
    sl.userData.noCast = true;
    p.add(sl);
  }

  // 3. Мосты.
  for (const br of R.bridges) {
    const span = R.pts.slice(br.i0, br.i1 + 1);
    const deck = sweep(span, [[-4.2, -0.62], [-4.2, -2.0], [4.2, -2.0], [4.2, -0.62]], M.concrete, true);
    deck.userData.key = k;
    p.add(deck);
    // Парапеты-ограждения.
    for (const s of [-1, 1]) {
      const rail = sweep(span, [[s * 4.1, -0.6], [s * 4.1, 0.5], [s * 4.25, 0.5], [s * 4.25, -0.6]], M.steel, true);
      rail.userData.key = k;
      p.add(rail);
    }
    if (br.deep > 45) archBridge(p, span, k); else trussBridge(p, span, k);
  }

  // 4. Контактная сеть.
  const wires = [];
  {
    const step = 50, a = {};
    const masts = [];
    for (let s = pts[0].s + 10; s < pts[pts.length - 1].s - 5; s += step) {
      railAt(s, a);
      const side = 5.0;
      const x = a.x + a.tz * side, z = a.z - a.tx * side;
      const top = a.y + RAIL_TOP + 8.6;
      const near = R.pts[Math.round(s / (R.len / (R.pts.length - 1)))];
      const g = near.bridge ? a.y - 0.6 : Math.min(heightAt(x, z), a.y + 0.2) - 0.3;
      masts.push({s, x, z, top, g, tx: a.tx, tz: a.tz, y: a.y, stagger: masts.length % 2 ? 0.3 : -0.3});
    }
    const mastG = new THREE.CylinderGeometry(0.15, 0.24, 1, 8);
    const ms = new THREE.InstancedMesh(mastG, M.mast, masts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    masts.forEach((m, i) => ms.setMatrixAt(i, m4.compose(V(m.x, (m.g + m.top) / 2, m.z), q.identity(), V(1, m.top - m.g, 1))));
    p.add(ms);
    const cant = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), M.steel, masts.length * 3);
    const insul = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 8), M.ins, masts.length * 2);
    const up = V(0, 1, 0);
    const setRod = (im, i, A, B) => {
      const d = B.clone().sub(A);
      im.setMatrixAt(i, m4.compose(A.clone().add(B).multiplyScalar(0.5), q.setFromUnitVectors(up, d.clone().normalize()), V(1, d.length(), 1)));
    };
    const cw = [], mw = [], drop = [];
    masts.forEach((m, i) => {
      const off = (d, h) => V(m.x - m.tz * d, h, m.z + m.tx * d);
      // Консоль: верхняя тяга, горизонтальный кронштейн, фиксатор.
      const cy = m.y + RAIL_TOP;
      setRod(cant, i * 3, off(0, cy + 8.2), off(5.0 + m.stagger, cy + 7.4));
      setRod(cant, i * 3 + 1, off(0, cy + 6.9), off(5.0 + m.stagger + 0.6, cy + 7.3));
      setRod(cant, i * 3 + 2, off(4.3, cy + 6.95), off(5.0 + m.stagger, cy + WIRE_H));
      insul.setMatrixAt(i * 2, m4.compose(off(0.5, cy + 8.0), q.setFromUnitVectors(up, V(m.tz, 0, -m.tx).negate()), V(1, 1, 1)));
      insul.setMatrixAt(i * 2 + 1, m4.compose(off(0.5, cy + 6.95), q, V(1, 1, 1)));
      cw.push(off(5.0 + m.stagger, cy + WIRE_H));
      mw.push(off(5.0 + m.stagger, cy + 7.45));
    });
    for (const im of [cant, insul, ms]) { im.userData.noCast = true; p.add(im); }
    // Провода: несущий трос с провисом и контактный провод, струны через ~8 м.
    const lines = [];
    for (let i = 0; i < cw.length - 1; i++) {
      const A = cw[i], B = cw[i + 1], A2 = mw[i], B2 = mw[i + 1];
      lines.push(A, B);
      for (let k2 = 0; k2 < 6; k2++) {
        const t0 = k2 / 6, t1 = (k2 + 1) / 6;
        const sag = (t) => 0.8 * 4 * t * (1 - t);
        const P0 = A2.clone().lerp(B2, t0), P1 = A2.clone().lerp(B2, t1);
        P0.y -= sag(t0); P1.y -= sag(t1);
        lines.push(P0, P1);
        if (k2) { const D = A.clone().lerp(B, t0); lines.push(D, P0); }
      }
    }
    const lg = new THREE.BufferGeometry().setFromPoints(lines);
    const wl = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color: 0x2a2d30}));
    wl.userData.dynamic = true;
    p.add(wl);
    wires.push(wl);
  }
  return {wires};
}

// Мост с ездой понизу: фермы с треугольной решёткой (Уоррен + стойки), пролёты ≈ 66 м, опоры с ледорезами.
function trussBridge(p, span, k) {
  const L = span[span.length - 1].s - span[0].s;
  const nSpan = Math.max(1, Math.round(L / 66)), sl = L / nSpan;
  const H = 10, half = 3.9;
  const a = {}, b = {};
  const piece = (A, B, w) => link(p, A, B, w, M.truss, 4);
  const at = (s, d, h) => { railAt(s, a); return V(a.x + a.tz * d, a.y + h, a.z - a.tx * d); };
  for (let n = 0; n < nSpan; n++) {
    const s0 = span[0].s + n * sl, s1 = s0 + sl, panels = 8, pl = sl / panels;
    for (const d of [-half, half]) {
      for (let i = 0; i < panels; i++) {
        const sa = s0 + i * pl, sb = sa + pl;
        piece(at(sa, d, -0.9), at(sb, d, -0.9), 0.32);                                   // нижний пояс
        if (i > 0) piece(at(sa, d, H), at(Math.min(sb, s1 - pl), d, H), 0.32);           // верхний пояс
        piece(at(sa, d, -0.9), at(sa, d, i === 0 ? -0.9 : H), 0.18);                    // стойки
        piece(i % 2 ? at(sa, d, H) : at(sa, d, -0.9), i % 2 ? at(sb, d, -0.9) : at(sb, d, H), 0.22); // раскосы
      }
      piece(at(s0, d, -0.9), at(s0 + pl, d, H), 0.3);                                      // опорные раскосы
      piece(at(s1, d, -0.9), at(s1 - pl, d, H), 0.3);
    }
    // Верхние связи и порталы.
    for (let i = 1; i < panels; i++) piece(at(s0 + i * pl, -half, H), at(s0 + i * pl, half, H), 0.12);
    for (let i = 1; i < panels - 1; i++) piece(at(s0 + i * pl, -half, H), at(s0 + (i + 1) * pl, half, H), 0.08);
    // Опора: тело, оголовок, ледорез.
    if (n > 0) pier(p, s0, true);
  }
  for (const s of [span[0].s, span[span.length - 1].s]) pier(p, s, false);
  function pier(pp, s, mid) {
    railAt(s, b);
    const g = heightAt(b.x, b.z) - 3, top = b.y - 2.0;
    if (top - g < 1) return;
    const ry = Math.atan2(b.tx, b.tz);
    boxAt(pp, mid ? 10 : 11, top - g, mid ? 4.2 : 6, M.concrete, b.x, (top + g) / 2, b.z, ry, k);
    boxAt(pp, 11.4, 1.2, mid ? 5 : 6.6, M.concrete, b.x, top - 0.6, b.z, ry, k);
    if (mid) for (const s2 of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, top - g - 1.2, 16), M.concrete);
      c.position.set(b.x + b.tz * s2 * 5, (top - 1.2 + g) / 2, b.z - b.tx * s2 * 5);
      c.userData.key = k;
      pp.add(c);
    }
  }
}

// Арочный виадук: две арочные рёбра на скальных пятах, надарочные стойки, подходы на опорах.
function archBridge(p, span, k) {
  const a = {};
  const at = (s, d, h) => { railAt(s, a); return V(a.x + a.tz * d, a.y + h, a.z - a.tx * d); };
  const ground = (s) => { railAt(s, a); return heightAt(a.x, a.z); };
  // Пяты арки — где глубина каньона становится заметной.
  let sA = span[0].s, sB = span[span.length - 1].s;
  const deckY = (s) => (railAt(s, a), a.y);
  for (let s = span[0].s; s < sB; s += 2) if (deckY(s) - ground(s) > 26) { sA = s; break; }
  for (let s = span[span.length - 1].s; s > sA; s -= 2) if (deckY(s) - ground(s) > 26) { sB = s; break; }
  sA -= 8; sB += 8;
  const springY = Math.min(ground(sA), ground(sB)) - 1, crownY = deckY((sA + sB) / 2) - 3.2;
  const archH = (s) => { const t = (s - sA) / (sB - sA); return springY + (crownY - springY) * (1 - (2 * t - 1) ** 2); };
  for (const d of [-2.8, 2.8]) {
    const N = 40;
    for (let i = 0; i < N; i++) {
      const s0 = sA + (sB - sA) * i / N, s1 = sA + (sB - sA) * (i + 1) / N;
      const A = at(s0, d, 0), B = at(s1, d, 0);
      A.y = archH(s0); B.y = archH(s1);
      const o = link(p, A, B, 1.15, M.stone, 6);
      o.userData.key = k;
    }
  }
  // Связи между рёбрами арки.
  for (let i = 1; i < 10; i++) {
    const s = sA + (sB - sA) * i / 10;
    const A = at(s, -2.8, 0), B = at(s, 2.8, 0);
    A.y = B.y = archH(s);
    link(p, A, B, 0.45, M.stone, 6).userData.key = k;
  }
  // Надарочные стойки и опоры подходов.
  for (let s = span[0].s + 12; s < span[span.length - 1].s - 6; s += 14) {
    const top = deckY(s) - 2.0;
    const base = s > sA && s < sB ? archH(s) + 0.8 : ground(s) - 2;
    if (top - base < 1.5) continue;
    for (const d of [-2.8, 2.8]) {
      const A = at(s, d, 0), B = at(s, d, 0);
      A.y = base; B.y = top;
      link(p, A, B, s > sA && s < sB ? 0.55 : 1.1, M.stone, 8).userData.key = k;
    }
    const A = at(s, -3.4, 0), B = at(s, 3.4, 0);
    A.y = B.y = top - 0.4;
    link(p, A, B, 0.5, M.stone, 6).userData.key = k;
  }
}
