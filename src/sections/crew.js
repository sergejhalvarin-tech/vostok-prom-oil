// Экипаж на палубе танкера: фигурки в оранжевых комбинезонах и касках, машут вертолёту,
// когда он пролетает рядом, и поворачиваются к нему.
import * as THREE from 'three';

const SKIN = new THREE.MeshStandardMaterial({color: 0xe8b48f, roughness: 0.7});
const SUIT = [0xff6a13, 0xff8a1f, 0x1d6fe0];
const HELMET = [0xffffff, 0xffd21a];

function makePerson(i) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({color: SUIT[i % 3], roughness: 0.6});
  const dark = new THREE.MeshStandardMaterial({color: 0x22262c, roughness: 0.8});
  const part = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.2, 0.85, 0.24), suit, s * 0.13, 0.43, 0);   // ноги
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.22, 0.12, 0.32), dark, s * 0.13, 0.06, -0.04); // ботинки
  part(new THREE.BoxGeometry(0.5, 0.65, 0.28), suit, 0, 1.18, 0);                                     // туловище
  part(new THREE.BoxGeometry(0.52, 0.06, 0.3), new THREE.MeshStandardMaterial({color: 0xd9ff3d, emissive: 0x334400, roughness: 0.4}), 0, 1.3, 0); // светоотражающая полоса
  part(new THREE.SphereGeometry(0.15, 12, 10), SKIN, 0, 1.68, 0);                                     // голова
  const helmet = part(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({color: HELMET[i % 2], roughness: 0.3}), 0, 1.72, 0);
  helmet.scale.set(1.05, 0.9, 1.1);
  // Левая рука опущена, правая — на шарнире в плече, машет.
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.31, 1.45, 0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), suit);
    a.position.y = -0.31;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), SKIN);
    hand.position.y = -0.64;
    pivot.add(a, hand);
    g.add(pivot);
    return pivot;
  };
  arm(-1).rotation.z = -0.08;
  const wave = arm(1);
  g.scale.setScalar(1.35); // чуть крупнее реального — чтобы читалось с вертолёта
  return {group: g, wave, ph: i * 1.7};
}

// spots — точки на палубе в координатах группы танкера (метры).
export function makeCrew(spots) {
  const group = new THREE.Group();
  const people = spots.map((p, i) => {
    const m = makePerson(i);
    m.group.position.copy(p);
    group.add(m.group);
    return m;
  });
  const w = new THREE.Vector3(), local = new THREE.Vector3();
  return {
    group,
    // cam — положение вертолёта в мире; машут, если он ближе ~400 м.
    update(t, cam) {
      group.updateMatrixWorld();
      for (const m of people) {
        m.group.getWorldPosition(w);
        const near = w.distanceTo(cam) < 400;
        // Повернуться к вертолёту (в плоскости палубы).
        local.copy(cam);
        m.group.parent.worldToLocal(local);
        m.group.rotation.y = Math.atan2(local.x - m.group.position.x, local.z - m.group.position.z);
        m.wave.rotation.z = near ? 2.5 + Math.sin(t * 7 + m.ph) * 0.45 : 0.1;
        m.wave.rotation.x = near ? Math.sin(t * 3.5 + m.ph) * 0.15 : 0;
      }
    },
  };
}
