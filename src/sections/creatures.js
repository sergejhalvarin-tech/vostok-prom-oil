// Тюлень (пятнистая нерпа) и полярная акула: тела вращения с ластами/плавниками и анимацией хвоста.
// Нос в −z. update(t) двигает хвостовую часть.
import * as THREE from 'three';

let seed = 41;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function lathe(profile, len, rad, seg = 32) {
  const g = new THREE.LatheGeometry(profile.map(([u, r]) => new THREE.Vector2(Math.max(0.001, r * rad), u * len)), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -len / 2);
  return g;
}

// Пятнистый мех нерпы: серый фон, тёмные кольца и светлые пятна.
function sealTexture() {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#5f6266'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * S, y = rnd() * S, r = 2 + rnd() * 9;
    g.fillStyle = rnd() < 0.4 ? `rgba(215,218,220,${0.45 + rnd() * 0.4})` : `rgba(30,32,36,${0.55 + rnd() * 0.35})`;
    g.beginPath(); g.ellipse(x, y, r * (1 + rnd()), r, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeSeal() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({map: sealTexture(), roughness: 0.55, metalness: 0.05});
  const len = 2.4, rad = 0.5;
  const body = new THREE.Mesh(lathe([[0, 0.05], [0.03, 0.45], [0.09, 0.72], [0.17, 0.68], [0.26, 0.82], [0.45, 1], [0.65, 0.88], [0.82, 0.5], [0.93, 0.28], [1, 0.22]], len, rad), fur);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 18), fur);
  head.scale.set(1, 0.92, 1.15);
  head.position.set(0, 0.04, -len / 2 + 0.42);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), fur);
  snout.scale.set(1.05, 0.8, 1);
  snout.position.set(0, -0.04, -len / 2 + 0.12);
  g.add(snout);
  // Морда, глаза, вибриссы.
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({color: 0x050608, roughness: 0.1}));
    eye.position.set(s * 0.21, 0.13, -len / 2 + 0.24);
    g.add(eye);
    const pts = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 6 - 0.5) * 0.8;
      pts.push(V(s * 0.1, -0.02, -len / 2 + 0.05), V(s * (0.1 + 0.32 * Math.cos(a)), -0.02 + 0.1 * Math.sin(a) - 0.06, -len / 2 + 0.15));
    }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: 0xf2f2f2, transparent: true, opacity: 0.8})));
  }
  // Передние ласты.
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), fur);
    f.scale.set(0.09, 0.32, 0.17);
    f.position.set(s * 0.38, -0.28, -0.35);
    f.rotation.set(0.5, 0, s * 0.4);
    g.add(f);
  }
  // Задние ласты — веером, машут из стороны в сторону.
  const tail = new THREE.Group();
  tail.position.z = len / 2 - 0.05;
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(0.22, 0.1); finShape.lineTo(0.28, 0.55); finShape.lineTo(0.12, 0.5); finShape.lineTo(0.02, 0.6); finShape.lineTo(-0.08, 0.48); finShape.closePath();
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, {depth: 0.03, bevelEnabled: false}), fur);
    fin.rotation.set(Math.PI / 2, 0, s * 0.35);
    fin.position.x = s * 0.05;
    tail.add(fin);
  }
  g.add(tail);
  g.scale.setScalar(1.3);
  return {group: g, update: (t) => { tail.rotation.y = Math.sin(t * 3) * 0.5; body.rotation.y = Math.sin(t * 3 - 0.8) * 0.04; }};
}

export function makeShark() {
  const g = new THREE.Group();
  const len = 5.5, rad = 0.55;
  const geo = lathe([[0, 0.08], [0.04, 0.5], [0.12, 0.85], [0.3, 1], [0.5, 0.92], [0.7, 0.6], [0.85, 0.32], [1, 0.12]], len, rad);
  // Тёмная спина, светлое брюхо.
  const pos = geo.attributes.position, cols = [];
  const top = new THREE.Color(0x4a4945), bot = new THREE.Color(0xb9b5ad);
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp(0.5 - pos.getY(i) / (rad * 1.4), 0, 1);
    const c = top.clone().lerp(bot, k * k);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.scale(1, 0.85, 1);
  const skin = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.5, metalness: 0.1});
  const finMat = new THREE.MeshStandardMaterial({color: 0x45443f, roughness: 0.55});
  g.add(new THREE.Mesh(geo, skin));
  const fin = (pts, x, y, z, rot, scale = 1) => {
    const s = new THREE.Shape();
    s.moveTo(...pts[0]);
    for (const p of pts.slice(1)) s.lineTo(...p);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, {depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1}), finMat);
    m.position.set(x, y, z);
    m.rotation.set(...rot);
    m.scale.setScalar(scale);
    return m;
  };
  g.add(fin([[0, 0], [0.5, 0.05], [0.2, 0.42]], 0, 0.38, 0.1, [0, Math.PI / 2, 0]));            // спинной
  g.add(fin([[0, 0], [0.35, 0.03], [0.15, 0.28]], 0, 0.28, 1.1, [0, Math.PI / 2, 0]));          // второй спинной
  for (const s of [-1, 1]) g.add(fin([[0, 0], [0.7, -0.15], [0.2, -0.05]], s * 0.45, -0.22, -0.8, [0, s > 0 ? 0 : Math.PI, s * -0.3]));
  // Хвост: верхняя лопасть длиннее (гетероцеркальный).
  const tail = new THREE.Group();
  tail.position.z = len / 2 - 0.2;
  tail.add(fin([[0, 0], [0.5, 0.95], [0.75, 0.9], [0.35, 0], [0.55, -0.45], [0.35, -0.5]], 0, 0, 0, [0, -Math.PI / 2, 0], 1.1));
  g.add(tail);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({color: 0x101418, emissive: 0x0a3a40, emissiveIntensity: 0.6}));
    eye.position.set(s * 0.26, 0.1, -len / 2 + 0.5);
    g.add(eye);
  }
  return {group: g, update: (t) => { tail.rotation.y = Math.sin(t * 1.6) * 0.35; }};
}
