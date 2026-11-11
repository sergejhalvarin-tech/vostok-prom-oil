// Перекат на реке — фотоскан горного ручья с камнями («Stream» © Paul, CC BY 4.0), вписан в русло:
// длинная ось — по течению, ширина — по руслу, уровень — по воде реки.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {riverZ, riverLevel} from './landscape.js';

export const RAPIDS_X = 9180;
const SCALE = 1.7;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export function loadStream(parent, {y0 = 0} = {}) {
  return new Promise((resolve) => {
    loader.load('models/stream.glb', (gltf) => {
      const m = gltf.scene;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.material.emissiveMap = null;
        o.material.emissive?.set(0);
        o.material.roughness = 0.85;
        o.receiveShadow = true;
      });
      // Центр скана по длине и ширине — в начало координат.
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3());
      m.position.set(-c.x, -y0, -c.z);
      const g = new THREE.Group();
      g.add(m);
      const x = RAPIDS_X, slope = (1250 / 1450) * Math.cos((x - 5900) / 1450 + 0.4);
      g.position.set(x, riverLevel(x) + 2.6, riverZ(x));
      g.rotation.y = Math.atan2(-slope, 1);
      g.scale.setScalar(SCALE);
      parent.add(g);
      resolve(g);
    }, undefined, () => resolve(null));
  });
}
