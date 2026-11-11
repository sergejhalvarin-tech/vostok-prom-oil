// Растительность и камни ландшафта: ели и сосны, берёзы и осины в осенних красках, кустарник,
// скальные выходы и валуны. Всё — инстансы, разбитые на квадраты 900 м: далёкие квадраты не рисуются.
import * as THREE from 'three';

function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) c.toArray(arr, i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
// Мягкие «облачные» нормали: от центра кроны наружу (с подъёмом вверх) — живописная заливка без граней.
function soften(g, cx, cy, cz, up = 0.35) {
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) - cx, (p.getY(i) - cy) + up, p.getZ(i) - cz).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
function merge(parts) {
  const n = parts.reduce((a, p) => a + p.attributes.position.count, 0);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    P.set(p.attributes.position.array, o * 3);
    N.set(p.attributes.normal.array, o * 3);
    C.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g;
}

// Ель: ствол и четыре яруса хвои (крона белая — цвет задаёт инстанс).
const SPRUCE = merge([
  colored(new THREE.CylinderGeometry(0.25, 0.4, 2.4, 5).translate(0, 1.2, 0), 0x5a3b22),
  soften(colored(new THREE.ConeGeometry(2.7, 5.4, 8).translate(0, 4.2, 0), 0xffffff), 0, 5.5, 0, 1.2),
  soften(colored(new THREE.ConeGeometry(2.1, 4.6, 8).translate(0, 6.8, 0), 0xffffff), 0, 7.6, 0, 1.2),
  soften(colored(new THREE.ConeGeometry(1.4, 3.8, 8).translate(0, 9.2, 0), 0xffffff), 0, 9.8, 0, 1.2),
  soften(colored(new THREE.ConeGeometry(0.7, 2.4, 6).translate(0, 11.2, 0), 0xffffff), 0, 11.5, 0, 1.2),
]);
// Берёза/осина: светлый ствол, пышная крона из нескольких «облаков».
const BIRCH = (() => {
  const parts = [colored(new THREE.CylinderGeometry(0.18, 0.28, 6.5, 6).translate(0, 3.2, 0), 0xe9e6dc)];
  for (const [x, y, z, r] of [[0, 7.2, 0, 2.6], [1.3, 6.2, 0.6, 1.9], [-1.2, 6.5, -0.5, 2], [0.3, 8.6, -0.4, 1.7], [-0.5, 5.6, 1.2, 1.6]]) {
    const g = new THREE.IcosahedronGeometry(r, 0).translate(x, y, z);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.92 + Math.random() * 0.16), p.getY(i) * (0.9 + Math.random() * 0.2), p.getZ(i) * (0.92 + Math.random() * 0.16));
    parts.push(soften(colored(g, 0xffffff), 0, 6.8, 0, 0.6));
  }
  return merge(parts);
})();
// Кустарник (карликовая берёза, ивняк) — низкие пышные кочки.
const SHRUB = merge([0, 1, 2].map((k) => soften(colored(new THREE.IcosahedronGeometry(0.9 + k * 0.2, 1).translate(k * 0.8 - 0.8, 0.5, (k % 2) * 0.6), 0xffffff), 0, 0, 0.3, 0.4)));
// Камень: деформированный многогранник.
const ROCK = (() => {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.5;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return colored(g, 0xffffff);
})();

// Дальние упрощённые варианты (LOD): тот же масштаб и цвет инстанса.
const SPRUCE_LO = soften(colored(new THREE.ConeGeometry(2.6, 11, 6, 1, true).translate(0, 6.2, 0), 0xffffff), 0, 6.5, 0, 2);
const BIRCH_LO = soften(colored(new THREE.IcosahedronGeometry(2.9, 0).scale(1, 1.15, 1).translate(0, 7, 0), 0xffffff), 0, 6.6, 0, 0.5);
const ROCK_LO = colored(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.8, 1), 0xffffff);

// Сочная летняя листва с редкими золотыми и рыжими кронами.
const AUTUMN = [0x8fd14f, 0x6cc23e, 0xa6d84a, 0x4fae3c, 0x7bc95a, 0xc5dd52, 0xf0c534, 0xe8902a];
const CONIFER = [[0.36, 0.55, 0.2], [0.33, 0.6, 0.17], [0.4, 0.5, 0.22], [0.31, 0.5, 0.19]];

// spec: {x0, x1, z0, z1, heightAt, accept(x, z, y), conifers, broadleaf, shrubs, rocks}
export function makeVegetation(spec) {
  const {x0, x1, z0, z1, heightAt, accept} = spec;
  const CH = 900, chunks = new Map();
  const put = (type, x, z, y, s, rotY, col, tilt = 0) => {
    const key = `${Math.floor(x / CH)}|${Math.floor(z / CH)}`;
    if (!chunks.has(key)) chunks.set(key, {cx: (Math.floor(x / CH) + 0.5) * CH, cz: (Math.floor(z / CH) + 0.5) * CH, items: {spruce: [], birch: [], shrub: [], rock: []}});
    chunks.get(key).items[type].push([x, y, z, s, rotY, col, tilt]);
  };
  const slopeAt = (x, z, y) => (Math.abs(heightAt(x + 5, z) - y) + Math.abs(heightAt(x, z + 5) - y)) / 5;
  const rnd = Math.random;
  const scatter = (n, type, ok, size, colorFn, tries = 14) => {
    let k = 0, t = 0;
    while (k < n && t < n * tries) {
      t++;
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), y = heightAt(x, z);
      if (!accept(x, z, y)) continue;
      const sl = slopeAt(x, z, y);
      if (!ok(x, z, y, sl)) continue;
      put(type, x, z, y, size(), rnd() * 6.28, colorFn(x, z, y), type === 'rock' ? rnd() : 0);
      k++;
    }
  };
  const grove = (x, z) => Math.sin(x / 173) * Math.cos(z / 211) + Math.sin((x + z) / 97) * 0.5;
  scatter(spec.conifers, 'spruce', (x, z, y, sl) => sl < 0.9 && y < 280 + rnd() * 50 && grove(x, z) > -0.6, () => 0.8 + rnd() * 1.1,
    () => { const c = CONIFER[Math.floor(rnd() * CONIFER.length)]; return new THREE.Color().setHSL(c[0] + rnd() * 0.03, c[1], c[2] + rnd() * 0.08); });
  scatter(spec.broadleaf, 'birch', (x, z, y, sl) => sl < 0.6 && y < 200 && grove(x + 400, z) > -0.2, () => 0.8 + rnd() * 0.9,
    () => new THREE.Color(AUTUMN[Math.floor(rnd() * AUTUMN.length)]).offsetHSL(0, 0.05, (rnd() - 0.5) * 0.08));
  scatter(spec.shrubs, 'shrub', (x, z, y, sl) => sl < 0.5 && y < 220, () => 0.8 + rnd() * 1.6,
    () => new THREE.Color([0x6cbf3e, 0x8fd14f, 0x4f9e3a, 0xb6d24a, 0xe0a83a][Math.floor(rnd() * 5)]));
  scatter(spec.rocks, 'rock', (x, z, y, sl) => sl > 0.32 || rnd() < 0.12, () => (rnd() < 0.15 ? 9 + rnd() * 22 : 1.5 + rnd() * 6),
    () => new THREE.Color().setHSL(0.07 + rnd() * 0.05, 0.12 + rnd() * 0.1, 0.3 + rnd() * 0.14), 30);

  const group = new THREE.Group();
  const geos = {spruce: SPRUCE, birch: BIRCH, shrub: SHRUB, rock: ROCK};
  const lows = {spruce: SPRUCE_LO, birch: BIRCH_LO, rock: ROCK_LO};
  const mats = {
    spruce: new THREE.MeshLambertMaterial({vertexColors: true}),
    birch: new THREE.MeshLambertMaterial({vertexColors: true}),
    shrub: new THREE.MeshLambertMaterial({vertexColors: true}),
    rock: new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.95, flatShading: true}),
  };
  const meshes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (const ch of chunks.values()) {
    for (const [type, items] of Object.entries(ch.items)) {
      if (!items.length) continue;
      const im = new THREE.InstancedMesh(geos[type], mats[type], items.length);
      items.forEach(([x, y, z, sc, ry, col, tilt], i) => {
        q.setFromEuler(e.set(tilt * 0.6, ry, tilt * 0.4));
        const sy = type === 'rock' ? sc * 0.7 : sc * (0.9 + (i % 7) * 0.05);
        im.setMatrixAt(i, m4.compose(v.set(x, y - (type === 'rock' ? sc * 0.25 : 0.3), z), q, s.set(sc, sy, sc)));
        im.setColorAt(i, col);
      });
      im.computeBoundingSphere();
      im.userData.noCast = true;
      group.add(im);
      // Дальний вариант делит с ближним матрицы и цвета инстансов.
      let lo = null;
      if (lows[type]) {
        lo = new THREE.InstancedMesh(lows[type], mats[type], items.length);
        lo.instanceMatrix = im.instanceMatrix;
        lo.instanceColor = im.instanceColor;
        lo.boundingSphere = im.boundingSphere;
        lo.visible = false;
        group.add(lo);
      }
      meshes.push({im, lo, ch, near: type === 'shrub' ? 1100 : 1250, far: type === 'shrub' ? 0 : type === 'rock' ? 3000 : 4600});
    }
  }
  return {
    group,
    // Ближние квадраты — полные модели, дальние — упрощённые, за ~3 км (туман) — ничего.
    update(cam) {
      for (const m of meshes) {
        const d = Math.hypot(m.ch.cx - cam.x, m.ch.cz - cam.z);
        m.im.visible = d < m.near;
        if (m.lo) m.lo.visible = d >= m.near && d < m.far;
      }
    },
  };
}
