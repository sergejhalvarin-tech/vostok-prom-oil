// Загрузка общих моделей: платформа «Приразломная» и танкер.
//   Платформа: «МЛСП Приразломная» © Lightproduction, CC BY 4.0.
//   Танкер: «Tanker Ship» © KoreanNavy, CC BY 4.0 — нос в −z, ватерлиния y = 0, длина 162 ед.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export const PLATFORM_URL = 'models/prirazlomnaya.glb';
export const TANKER_URL = 'models/tanker.glb';
const SEA_OFFSET = 52.5; // в исходной модели платформы поверхность моря на y = −52,5

export const TANKER_SCALE = 257 / 162.3; // челночный танкер ледового класса ≈ 257 м
// Стоянка у платформы: нос в ~80 м от угла кессона, корпус уходит по диагонали.
export const TANKER_AT_PLATFORM = {pos: new THREE.Vector3(184.5, 0, -192.5), rot: (3 * Math.PI) / 4};

// Узлы модели платформы → смысловые группы (подсветка, подписи, клик).
const NODE_KEY = {
  Kesson_mid: 'kesson', Kesson_DOWN: 'kesson', Kesson_UP: 'kesson',
  Vishka: 'derrick', Vishka_Neft: 'derrick',
  Block_central: 'prep', StufBig_A: 'prep', StufBig_B: 'prep', StufBig_C: 'prep',
  Stuff_onboard: 'prep', AuxUnitGEO: 'prep',
  Kran_B: 'kupon', Kran_B_2: 'kupon',
  Block_living: 'living', Block_living_floor: 'living', HeliPad: 'living',
};
const HIDE_NODES = ['Box001', 'Object264']; // своё море из модели — заменяем анимированным

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export function loadPlatform(stage, onProgress) {
  return new Promise((resolve, reject) => {
    loader.load(PLATFORM_URL, (gltf) => {
      const model = gltf.scene;
      model.position.y = SEA_OFFSET;
      model.traverse((o) => {
        if (HIDE_NODES.includes(o.name)) o.visible = false;
        if (!o.isMesh) return;
        let key = null;
        for (let p = o; p && !key; p = p.parent) key = NODE_KEY[p.name] || null;
        stage.register(o, key);
      });
      stage.scene.add(model);
      resolve(model);
    }, onProgress, reject);
  });
}

// Танкер добавляется в parent (группа без масштаба, единицы — метры).
export function loadTanker(stage, parent, key = 'tanker') {
  return new Promise((resolve, reject) => {
    loader.load(TANKER_URL, (gltf) => {
      const m = gltf.scene;
      m.scale.setScalar(TANKER_SCALE);
      m.traverse((o) => {
        if (!o.isMesh) return;
        stage.register(o, key);
        // Яркая окраска: насыщеннее и чуть глянцевее исходных материалов.
        const mat = o.material;
        mat.roughness = Math.min(mat.roughness ?? 1, 0.55);
        mat.metalness = Math.min(mat.metalness ?? 0, 0.3);
        const hsl = mat.color.getHSL({});
        if (hsl.s > 0.2) mat.color.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), Math.min(0.55, hsl.l * 1.15));
      });
      parent.add(m);
      if (gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(m);
        for (const clip of gltf.animations) mixer.clipAction(clip).play();
        stage.onFrame((dt) => mixer.update(dt));
      }
      resolve(m);
    }, undefined, reject);
  });
}
