// Готовит модели для веба (исходники в models/source/, не в git):
//   платформа «Приразломная»: spec-gloss → metal-rough (Three.js его больше не читает),
//     текстуры до 2048 px (баланс чёткости и видеопамяти), насыщеннее и контрастнее, WebP, геометрия meshopt;
//   танкер: очистка, упрощение сетки (мелкие детали вроде винта весили ~40 тыс. треугольников), meshopt.
//   node tools/optimize-model.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tmp = 'models/tmp';
fs.mkdirSync(tmp, {recursive: true});
fs.mkdirSync('public/models', {recursive: true});

const cli = path.resolve('node_modules/@gltf-transform/cli/bin/cli.js');
const run = (...args) => {
  console.log('gltf-transform', args.join(' '));
  execFileSync(process.execPath, [cli, ...args], {stdio: 'inherit'});
};
const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(1) + ' MB';

// Платформа
{
  const src = 'models/source/prirazlomnaya.glb', out = 'public/models/prirazlomnaya.glb';
  run('metalrough', src, `${tmp}/p1.glb`);
  run('dedup', `${tmp}/p1.glb`, `${tmp}/p2.glb`);
  run('prune', `${tmp}/p2.glb`, `${tmp}/p3.glb`);
  run('resize', `${tmp}/p3.glb`, `${tmp}/p4.glb`, '--width', '2048', '--height', '2048');
  execFileSync(process.execPath, ['tools/saturate-textures.mjs', `${tmp}/p4.glb`, `${tmp}/p4s.glb`, '1.45', '1.12'], {stdio: 'inherit'});
  run('webp', `${tmp}/p4s.glb`, `${tmp}/p5.glb`, '--quality', '92');
  run('meshopt', `${tmp}/p5.glb`, out, '--level', 'medium');
  console.log(`${src} ${mb(src)} → ${out} ${mb(out)}`);
}

// Танкер
{
  const src = 'models/source/tanker_ship.glb', out = 'public/models/tanker.glb';
  run('dedup', src, `${tmp}/t1.glb`);
  run('prune', `${tmp}/t1.glb`, `${tmp}/t2.glb`);
  run('weld', `${tmp}/t2.glb`, `${tmp}/t3.glb`);
  run('simplify', `${tmp}/t3.glb`, `${tmp}/t4.glb`, '--ratio', '0.3', '--error', '0.004');
  run('meshopt', `${tmp}/t4.glb`, out, '--level', 'medium');
  console.log(`${src} ${mb(src)} → ${out} ${mb(out)}`);
}
