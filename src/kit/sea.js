// Общие элементы морских сцен: вода, лёд, частицы потока, цветокоррекция.
import * as THREE from 'three';
import {mergeStatic} from './merge.js';

// Море: крупная зыбь в вершинном шейдере (несколько направленных волн), мелкая рябь — в нормалях
// пиксельного шейдера, белые барашки на гребнях, френель, блик солнца, туман по дальности.
export function makeWater(sunDir, fogColor) {
  const uniforms = {
    uTime: {value: 0},
    uSun: {value: sunDir.clone().normalize()},
    uDeep: {value: new THREE.Color(0x0b5f7e)},
    uSky: {value: new THREE.Color(0xa6dcef)},
    uFoam: {value: new THREE.Color(0xf4fbff)},
    uFog: {value: fogColor},
    uOpacity: {value: 0.82},
  };
  const WAVES = /* glsl */ `
    uniform float uTime;
    // Зыбь: направление, длина волны, высота, скорость.
    float swell(vec2 p, out vec2 g) {
      float h = 0.0; g = vec2(0.0);
      vec2 D[4]; float L[4]; float A[4];
      D[0] = normalize(vec2(1.0, 0.35)); L[0] = 190.0; A[0] = 0.95;
      D[1] = normalize(vec2(0.7, -0.6)); L[1] = 128.0; A[1] = 0.6;
      D[2] = normalize(vec2(-0.3, 1.0)); L[2] = 96.0;  A[2] = 0.38;
      D[3] = normalize(vec2(1.0, 1.2));  L[3] = 74.0;  A[3] = 0.24;
      for (int i = 0; i < 4; i++) {
        float k = 6.2832 / L[i], w = sqrt(9.81 * k);
        float ph = dot(D[i], p) * k - uTime * w;
        h += A[i] * sin(ph);
        g += A[i] * k * cos(ph) * D[i];
      }
      return h;
    }`;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${WAVES}
      varying vec3 vW; varying float vH;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 g; float hh = swell(w.xz, g);
        w.y += hh;
        vW = w.xyz; vH = hh;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${WAVES}
      uniform vec3 uSun, uDeep, uSky, uFoam, uFog; uniform float uOpacity;
      varying vec3 vW; varying float vH;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 g; swell(vW.xz, g);
        // Рябь: шумовые нормали двух масштабов, бегущие в разные стороны — без регулярного узора.
        float t = uTime;
        vec2 q1 = vW.xz * 0.09 + vec2(t * 0.35, t * 0.12), q2 = vW.xz * 0.23 + vec2(-t * 0.25, t * 0.4);
        float e = 0.35;
        vec2 r = vec2(vnoise(q1 + vec2(e, 0.0)) - vnoise(q1 - vec2(e, 0.0)), vnoise(q1 + vec2(0.0, e)) - vnoise(q1 - vec2(0.0, e))) * 0.16
               + vec2(vnoise(q2 + vec2(e, 0.0)) - vnoise(q2 - vec2(e, 0.0)), vnoise(q2 + vec2(0.0, e)) - vnoise(q2 - vec2(0.0, e))) * 0.09;
        vec3 n = normalize(vec3(-(g.x + r.x), 1.0, -(g.y + r.y)));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 col = mix(uDeep, uSky, clamp(0.08 + fr * 0.9, 0.0, 1.0));
        // Подсветка гребней (свет сквозь волну) и барашки.
        col += vec3(0.05, 0.22, 0.2) * smoothstep(0.2, 1.4, vH);
        float foam = smoothstep(1.05, 1.75, vH + vnoise(vW.xz * 0.12 + t * 0.2) * 0.7) * smoothstep(0.3, 0.7, vnoise(vW.xz * 0.45 - t * 0.3));
        col = mix(col, uFoam, foam * 0.85);
        vec3 hv = normalize(v + uSun);
        col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, hv), 0.0), 220.0) * 1.8;
        float d = length(cameraPosition - vW);
        float f = clamp((d - 450.0) / 9050.0, 0.0, 1.0);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, mix(uOpacity + fr * 0.2 + foam * 0.3, 1.0, f));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // Ближняя вода — сетка 30 м (зыбь от 74 м), дальняя — крупная, до горизонта.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 300, 300).rotateX(-Math.PI / 2), mat);
  mesh.position.x = 900;
  mesh.renderOrder = 2;
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000, 60, 60).rotateX(-Math.PI / 2), mat);
  far.position.set(-12900, -1.2, 0);
  far.renderOrder = 1;
  mesh.add(far);
  return {
    mesh,
    update: (t) => (uniforms.uTime.value = t),
    setOpacity: (a) => (uniforms.uOpacity.value = a),
  };
}

// Та же зыбь на CPU — для качки судов: высота и уклон поверхности в точке (x, z) в момент t.
const SW = [[1, 0.35, 190, 0.95], [0.7, -0.6, 128, 0.6], [-0.3, 1, 96, 0.38], [1, 1.2, 74, 0.24]].map(([dx, dz, L, A]) => {
  const n = Math.hypot(dx, dz), k = (2 * Math.PI) / L;
  return {dx: dx / n, dz: dz / n, k, w: Math.sqrt(9.81 * k), A};
});
export function swellAt(x, z, t, out = {h: 0, gx: 0, gz: 0}) {
  out.h = out.gx = out.gz = 0;
  for (const s of SW) {
    const ph = (s.dx * x + s.dz * z) * s.k - t * s.w;
    out.h += s.A * Math.sin(ph);
    const c = s.A * s.k * Math.cos(ph);
    out.gx += c * s.dx; out.gz += c * s.dz;
  }
  return out;
}

// Дрейфующий лёд вокруг платформы. exclude(x, z) → true: льдину здесь не ставить.
export function makeIce(exclude = () => false, count = 90) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color: 0xf0f6fa, roughness: 0.8});
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = 230 + rnd() * 900;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const size = 6 + rnd() * 26;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6 + Math.floor(rnd() * 4));
    const sx = 0.6 + rnd() * 0.8, sz = 0.6 + rnd() * 0.8, rot = rnd() * Math.PI;
    if (exclude(x, z, size)) continue;
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const s = 0.75 + rnd() * 0.5;
      pos.setX(k, pos.getX(k) * s);
      pos.setZ(k, pos.getZ(k) * s);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(size * sx, 1.4, size * sz);
    m.position.set(x, 0.1, z);
    m.rotation.y = rot;
    m.receiveShadow = true;
    g.add(m);
  }
  return mergeStatic(g);
}

// Частицы, бегущие вдоль кривых (поток нефти/воды). reverse — от конца к началу.
export function makeFlow(curves, perCurve, color, size, reverse, speed = 45) {
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
    if (!points.visible) return;
    for (let i = 0; i < n; i++) {
      const ci = Math.floor(i / perCurve);
      t[i] = (t[i] + (dt * speed) / lens[ci]) % 1;
      curves[ci].getPointAt(reverse ? 1 - t[i] : t[i], v);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  points.visible = true;
  update(0);
  return {points, update};
}


// Поток «шариками»: объёмные бусины, бегущие по кривым внутри прозрачных труб. Одна отрисовка на поток.
export const OIL = {color: 0x7a3f0c, emissive: 0x3d1a00};
export const WATER = {color: 0x2f8fff, emissive: 0x06306e};
export function makeBeads(curves, perCurve, radius, look, speed = 30, reverse = false) {
  const n = curves.length * perCurve;
  const mat = new THREE.MeshStandardMaterial({color: look.color, emissive: look.emissive, emissiveIntensity: 0.9, roughness: 0.18, metalness: 0.25});
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 12, 8), mat, n);
  mesh.frustumCulled = false;
  mesh.userData.noCast = true;
  const t = Float32Array.from({length: n}, (_, i) => (i % perCurve) / perCurve);
  const lens = curves.map((c) => c.getLength());
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  const update = (dt) => {
    if (!mesh.visible) return;
    for (let i = 0; i < n; i++) {
      const ci = Math.floor(i / perCurve);
      t[i] = (t[i] + (dt * speed) / lens[ci]) % 1;
      curves[ci].getPointAt(reverse ? 1 - t[i] : t[i], v);
      mesh.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return {mesh, update};
}
// Прозрачная «смотровая» труба, внутри которой видны бусины.
export function glassPipeMaterial(tint = 0xd8e6ef, opacity = 0.32) {
  return new THREE.MeshStandardMaterial({color: tint, transparent: true, opacity, roughness: 0.08, metalness: 0.1, depthWrite: false});
}

// Цветокоррекция после тонмаппинга: насыщенность и контраст.
export const GRADE = {
  uniforms: {tDiffuse: {value: null}, sat: {value: 1.22}, con: {value: 1.06}},
  vertexShader: /* glsl */ `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float sat, con; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 g = mix(vec3(l), c.rgb, sat);
      g = (g - 0.5) * con + 0.5;
      gl_FragColor = vec4(clamp(g, 0.0, 1.0), c.a);
    }`,
};

// Отрезок-цилиндр между двумя точками (рычаги, канаты, мостики).
const Y = new THREE.Vector3(0, 1, 0);
export function setLink(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
  mesh.scale.set(1, Math.max(len, 1e-3), 1);
}

// Провисающая линия между точками (шланг, швартов): парабола с прогибом sag.
export function sagPoints(a, b, sag, n = 32) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const p = a.clone().lerp(b, s);
    p.y -= sag * 4 * s * (1 - s);
    pts.push(p);
  }
  return pts;
}
