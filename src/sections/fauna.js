// Лесные животные долины: бурые медведи, северные олени, лисы, стая птиц и скала над озером.
// Фигуры низкополигональные, но с правильным силуэтом; ноги ходят, головы опускаются к воде и траве.
// Рисуются только когда камера за хребтом (x > 4500).
import * as THREE from 'three';
import {heightAt, riverZ, riverLevel, LAKES, STATIONS} from './landscape.js';

const S = 2.2; // животные чуть крупнее натуры, чтобы читались с вертолёта
const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({color: c, roughness: r});
const ell = (rx, ry, rz, m, seg = 10) => { const g = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3)), m); g.scale.set(rx, ry, rz); g.castShadow = true; return g; };
const cyl = (r0, r1, h, m, seg = 6) => { const g = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); g.castShadow = true; return g; };

// Четвероногое: вперёд — локальная +z. spec задаёт пропорции и окрас.
function quadruped(sp) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const coat = mat(sp.color), dark = mat(sp.dark ?? 0x221810), light = mat(sp.light ?? sp.color);
  const {len, h, legLen} = sp;
  body.position.y = legLen;
  const torso = ell(sp.w, sp.bh, len / 2, coat, 12);
  body.add(torso);
  if (sp.hump) { const hm = ell(sp.w * 0.85, sp.bh * 0.7, len * 0.22, coat); hm.position.set(0, sp.bh * 0.55, len * 0.25); body.add(hm); }
  if (sp.rump) { const r = ell(sp.w * 0.7, sp.bh * 0.6, 0.12, light); r.position.set(0, sp.bh * 0.15, -len / 2); body.add(r); }
  if (sp.belly) { const b = ell(sp.w * 0.8, sp.bh * 0.5, len * 0.38, light); b.position.y = -sp.bh * 0.45; body.add(b); }
  // Шея и голова (группа — чтобы опускать к воде/траве).
  const neck = new THREE.Group();
  neck.position.set(0, sp.bh * 0.35, len * 0.42);
  body.add(neck);
  const nk = cyl(sp.neckR * 0.8, sp.neckR, sp.neckLen, coat, 7);
  nk.rotation.x = sp.neckTilt; nk.position.set(0, Math.cos(sp.neckTilt) * sp.neckLen / 2, Math.sin(sp.neckTilt) * sp.neckLen / 2);
  neck.add(nk);
  const head = new THREE.Group();
  head.position.set(0, Math.cos(sp.neckTilt) * sp.neckLen, Math.sin(sp.neckTilt) * sp.neckLen);
  neck.add(head);
  head.add(ell(sp.headR, sp.headR * 0.85, sp.headR * 1.1, coat));
  const snout = ell(sp.headR * 0.5, sp.headR * 0.45, sp.snout, light);
  snout.position.set(0, -sp.headR * 0.2, sp.headR * 0.8 + sp.snout * 0.6);
  head.add(snout);
  const nose = ell(sp.headR * 0.2, sp.headR * 0.16, sp.headR * 0.12, dark, 6);
  nose.position.set(0, -sp.headR * 0.15, sp.headR * 0.8 + sp.snout * 1.5);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(sp.earR, sp.earH, 5), sp.earDark ? dark : coat);
    ear.position.set(sx * sp.headR * 0.6, sp.headR * 0.85, -sp.headR * 0.1);
    ear.rotation.z = -sx * 0.35;
    head.add(ear);
  }
  if (sp.antlers) {
    const am = mat(0xd9c7a4, 0.7);
    for (const sx of [-1, 1]) {
      const beam = cyl(0.03, 0.05, 1.1, am, 4);
      beam.position.set(sx * 0.35, sp.headR + 0.45, -0.15); beam.rotation.set(-0.5, 0, -sx * 0.55);
      head.add(beam);
      for (let k = 0; k < 3; k++) {
        const tine = cyl(0.02, 0.03, 0.45, am, 4);
        tine.position.set(sx * (0.45 + k * 0.12), sp.headR + 0.55 + k * 0.22, -0.05 - k * 0.12);
        tine.rotation.set(0.6, 0, -sx * 0.2);
        head.add(tine);
      }
      const brow = cyl(0.02, 0.03, 0.4, am, 4);
      brow.position.set(sx * 0.2, sp.headR + 0.3, 0.2); brow.rotation.set(1.1, 0, 0);
      head.add(brow);
    }
  }
  // Хвост.
  if (sp.tail) {
    const tail = new THREE.Group();
    tail.position.set(0, sp.bh * 0.3, -len / 2);
    const t = ell(sp.tail[0], sp.tail[0], sp.tail[1], coat);
    t.position.z = -sp.tail[1] * 0.8; tail.add(t);
    if (sp.tailTip) { const tt = ell(sp.tail[0] * 0.8, sp.tail[0] * 0.8, sp.tail[1] * 0.35, mat(sp.tailTip)); tt.position.z = -sp.tail[1] * 1.6; tail.add(tt); }
    tail.rotation.x = sp.tailUp ?? -0.4;
    body.add(tail);
    root.userData.tail = tail;
  }
  // Ноги: группа на бедре, качается вокруг x.
  const legs = [];
  const legM = sp.legDark ? dark : coat;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Group();
    leg.position.set(sx * sp.w * 0.62, legLen, sz * len * 0.33);
    const up = cyl(sp.legR * 1.3, sp.legR, legLen * 0.55, coat, 6); up.position.y = -legLen * 0.27; leg.add(up);
    const lo = cyl(sp.legR, sp.legR * 0.85, legLen * 0.5, legM, 6); lo.position.y = -legLen * 0.75; leg.add(lo);
    const paw = ell(sp.legR * 1.2, sp.legR * 0.6, sp.legR * 1.6, dark, 6); paw.position.set(0, -legLen + sp.legR * 0.4, sp.legR * 0.4); leg.add(paw);
    root.add(leg);
    legs.push(leg);
  }
  root.scale.setScalar(S * (sp.scale ?? 1));
  Object.assign(root.userData, {legs, neck, body, gait: sp.gait});
  return root;
}

const BEAR = {len: 2.0, w: 0.55, bh: 0.62, legLen: 0.7, legR: 0.14, neckLen: 0.45, neckR: 0.32, neckTilt: 1.25, headR: 0.3, snout: 0.22,
  earR: 0.09, earH: 0.14, color: 0x5a3820, dark: 0x1e140c, light: 0x6e4a2c, hump: true, belly: true, tail: [0.08, 0.08], gait: 2.4};
const DEER = {len: 1.7, w: 0.36, bh: 0.42, legLen: 1.0, legR: 0.06, neckLen: 0.75, neckR: 0.16, neckTilt: 0.55, headR: 0.17, snout: 0.2,
  earR: 0.07, earH: 0.22, color: 0x8a6440, dark: 0x2a1c12, light: 0xe8dcc6, rump: true, belly: true, antlers: true, tail: [0.07, 0.1], tailUp: 0.4, gait: 3.2};
const DOE = {...DEER, antlers: false, scale: 0.9, color: 0x9a7048};
const FOX = {len: 0.75, w: 0.17, bh: 0.19, legLen: 0.33, legR: 0.035, neckLen: 0.22, neckR: 0.09, neckTilt: 0.8, headR: 0.12, snout: 0.15,
  earR: 0.05, earH: 0.13, earDark: true, color: 0xd8611c, dark: 0x1a120c, light: 0xf2ece0, legDark: true, belly: true,
  tail: [0.11, 0.35], tailTip: 0xf5f1ea, tailUp: -0.25, gait: 5.5, scale: 1.4};

// Скала-останец над озером: стопка крупных глыб.
function crag(x, z, top) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({color: 0x7d746a, roughness: 0.95, flatShading: true});
  const base = heightAt(x, z) - 3;
  let y = base;
  const rnd = (i) => Math.abs(Math.sin(i * 91.7) * 4375.3 % 1);
  for (let i = 0; y < base + top - 6; i++) {
    const r = 14 - i * 1.6 + rnd(i) * 3, hgt = 6 + rnd(i + 5) * 3;
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const b = new THREE.Mesh(geo, m);
    b.scale.set(r, hgt, r * (0.8 + rnd(i + 9) * 0.3));
    b.rotation.y = rnd(i + 3) * 6;
    b.position.set(x + (rnd(i + 1) - 0.5) * 3, y + hgt * 0.8, z + (rnd(i + 2) - 0.5) * 3);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    y += hgt * 1.25;
  }
  // Ровный уступ наверху.
  const ledge = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 3, 7), m);
  ledge.position.set(x, y + 1.5, z);
  ledge.castShadow = ledge.receiveShadow = true;
  g.add(ledge);
  return {group: g, top: y + 3};
}

// Птица: тельце и два крыла, машут.
function bird(m) {
  const g = new THREE.Group();
  g.add(ell(0.18, 0.15, 0.55, m, 6));
  const wings = [-1, 1].map((sx) => {
    const w = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, sx * 1.4, 0, -0.1, 0, 0, -0.3], 3));
    geo.computeVertexNormals();
    w.add(new THREE.Mesh(geo, m));
    g.add(w);
    return w;
  });
  g.userData.wings = wings;
  g.scale.setScalar(2.4);
  return g;
}

export function makeFauna() {
  const group = new THREE.Group();
  const actors = [];
  const add = (spec, x, z, beh) => {
    const a = quadruped(spec);
    group.add(a);
    const st = {a, x, z, heading: beh.heading ?? 0, t: Math.random() * 10, off: Math.random(), ...beh};
    actors.push(st);
    return st;
  };

  // 1. Медведь пьёт из реки у перехода магистрали.
  const bx = 5610;
  let bz = riverZ(bx);
  while (heightAt(bx, bz) < riverLevel(bx) + 0.4) bz += 1.5;
  add(BEAR, bx, bz + 1.5, {kind: 'drink', heading: Math.PI});
  // 2. Медведь бродит вдоль берега выше по течению.
  const wz = riverZ(5450) + 70;
  add(BEAR, 5450, wz, {kind: 'patrol', path: [[5380, wz - 10], [5560, wz + 30]], speed: 1.6});
  // 3. Олень на скале над озером.
  const L1 = LAKES[0], cx = L1.x - 120, cz = L1.z + L1.r / 1.25 + 40;
  const c = crag(cx, cz, 34);
  group.add(c.group);
  add(DEER, cx, cz, {kind: 'stand', heading: Math.PI * 0.9, fixedY: c.top});
  // 4. Стадо у НПС-2 пасётся на лугу.
  const s2 = STATIONS[1];
  for (let i = 0; i < 9; i++) {
    const hx = s2.x - 260 + (i % 3) * 22 + Math.random() * 14, hz = s2.z + 210 + Math.floor(i / 3) * 20 + Math.random() * 10;
    add(i === 0 ? DEER : i < 4 ? DEER : DOE, hx, hz, {kind: 'graze', heading: Math.random() * 6.28, home: [hx, hz], speed: 0.9});
  }
  // 5. Лисы у НПС-1.
  const s1 = STATIONS[0];
  add(FOX, s1.x - 160, s1.z + 140, {kind: 'patrol', path: [[s1.x - 230, s1.z + 120], [s1.x - 120, s1.z + 190]], speed: 3.2});
  add(FOX, s1.x - 140, s1.z + 160, {kind: 'graze', home: [s1.x - 140, s1.z + 160], speed: 2.4});

  // Стая птиц кругами над долиной.
  const bm = new THREE.MeshStandardMaterial({color: 0x2a2622, roughness: 0.8, side: THREE.DoubleSide});
  const birds = [];
  for (let i = 0; i < 24; i++) { const b = bird(bm); group.add(b); birds.push({b, ph: Math.random() * 6.28, r: 30 + Math.random() * 60, dy: Math.random() * 25, off: Math.random() * 1.2}); }
  const flock = {x: 7300, z: -900, y: 170};

  // Позиции для облёта и подписей.
  const spots = {
    bear: actors[0], deerCliff: actors[2], herd: actors[3], fox: actors[actors.length - 2], flock,
  };

  const clock = new THREE.Clock();
  let tt = 0;
  const step = (st, dt) => {
    const {a} = st, ud = a.userData;
    st.t += dt;
    let moving = 0, headDown = 0;
    if (st.kind === 'drink') {
      headDown = 0.85 + 0.12 * Math.sin(st.t * 2.2);
    } else if (st.kind === 'stand') {
      st.heading += Math.sin(st.t * 0.3) * 0.002;
      headDown = -0.25 + 0.15 * Math.sin(st.t * 0.4);
      ud.neck.rotation.y = 0.5 * Math.sin(st.t * 0.25);
    } else if (st.kind === 'patrol') {
      const [p0, p1] = st.path, D = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const u = (st.t * st.speed / D) % 2, k = u < 1 ? u : 2 - u;
      const nx = p0[0] + (p1[0] - p0[0]) * k, nz = p0[1] + (p1[1] - p0[1]) * k;
      const h = Math.atan2(nx - st.x, nz - st.z);
      if (Math.hypot(nx - st.x, nz - st.z) > 1e-4) st.heading = h;
      st.x = nx; st.z = nz; moving = 1;
      headDown = 0.15;
    } else if (st.kind === 'graze') {
      // Шаг — пасётся — шаг: медленно бродит вокруг «дома».
      const cyc = (st.t * 0.15 + st.off) % 1;
      if (cyc < 0.3) {
        moving = 0.6;
        const [hx, hz] = st.home, back = Math.hypot(st.x - hx, st.z - hz) > 18 ? Math.atan2(hx - st.x, hz - st.z) : st.heading + Math.sin(st.t) * 0.02;
        st.heading += (back - st.heading) * 0.05;
        st.x += Math.sin(st.heading) * st.speed * dt; st.z += Math.cos(st.heading) * st.speed * dt;
        headDown = 0.1;
      } else headDown = 1.0 + 0.1 * Math.sin(st.t * 3);
    }
    const y = st.fixedY ?? heightAt(st.x, st.z);
    a.position.set(st.x, y, st.z);
    a.rotation.y = st.heading;
    ud.neck.rotation.x += (headDown - ud.neck.rotation.x) * Math.min(1, dt * 3);
    const ph = st.t * ud.gait * (moving ? 1 : 0);
    ud.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 * moving : leg.rotation.x * 0.9; });
    ud.body.position.y = ud.legs[0].position.y + (moving ? Math.abs(Math.sin(ph)) * 0.04 : Math.sin(st.t * 1.6) * 0.01);
    if (ud.tail) ud.tail.rotation.y = Math.sin(st.t * (moving ? 5 : 1.5)) * 0.25;
  };

  return {
    group, spots,
    update(cam) {
      const dt = Math.min(clock.getDelta(), 0.1);
      group.visible = cam.x > 4500;
      if (!group.visible) return;
      tt += dt;
      for (const st of actors) if (Math.hypot(st.x - cam.x, st.z - cam.z) < 1600) step(st, dt);
      for (const [i, o] of birds.entries()) {
        const ang = tt * 0.12 + o.ph, r = 220 + o.r;
        const x = flock.x + Math.cos(ang) * r, z = flock.z + Math.sin(ang) * r * 0.7, y = flock.y + o.dy + Math.sin(tt * 0.5 + i) * 4;
        o.b.position.set(x, y, z);
        o.b.rotation.set(0, Math.atan2(-Math.sin(ang), 0.7 * Math.cos(ang)), 0.25);
        const f = Math.sin(tt * 9 + o.off * 6) * 0.6;
        o.b.userData.wings[0].rotation.z = f; o.b.userData.wings[1].rotation.z = -f;
      }
    },
  };
}
