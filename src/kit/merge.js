// Объединение статичных деталей: сотни мелких мешей → по одному мешу на пару (материал, смысловой ключ).
// Это в разы снижает число вызовов отрисовки (и в тенях тоже).
// Не трогает: InstancedMesh, Points, объекты с userData.dynamic и всех их потомков.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];

  (function walk(o) {
    if (o !== root && o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && o.visible && !Array.isArray(o.material)) {
      const key = o.userData.key || '';
      const cast = o.userData.noCast ? 0 : 1;
      const id = `${o.material.uuid}|${key}|${cast}`;
      if (!buckets.has(id)) buckets.set(id, {material: o.material, key, cast, geos: []});
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      buckets.get(id).geos.push(g);
      victims.push(o);
    }
    for (const c of [...o.children]) walk(c);
  })(root);

  for (const v of victims) v.parent.remove(v);

  for (const {material, key, cast, geos} of buckets.values()) {
    const needUv = geos.some((g) => g.attributes.uv);
    const indexed = geos.every((g) => g.index);
    const ready = geos.map((g0) => {
      const g = indexed ? g0 : (g0.index ? g0.toNonIndexed() : g0);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (needUv && !g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!needUv && g.attributes.uv) g.deleteAttribute('uv');
      return g;
    });
    const merged = mergeGeometries(ready, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.userData.key = key || undefined;
    if (!cast) mesh.userData.noCast = true;
    root.add(mesh);
  }
  return root;
}
