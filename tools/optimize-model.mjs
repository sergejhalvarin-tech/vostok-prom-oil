// Готовит модели для веба (исходники в models/source/, не в git):
//   платформа «Приразломная»: spec-gloss → metal-rough (Three.js его больше не читает),
//     текстуры до 4096 px в WebP (высокое качество), геометрия meshopt;
//   танкер: только очистка и meshopt (текстур нет).
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
  run('resize', `${tmp}/p3.glb`, `${tmp}/p4.glb`, '--width', '4096', '--height', '4096');
  run('webp', `${tmp}/p4.glb`, `${tmp}/p5.glb`, '--quality', '90');
  run('meshopt', `${tmp}/p5.glb`, out, '--level', 'medium');
  console.log(`${src} ${mb(src)} → ${out} ${mb(out)}`);
}

// Танкер
{
  const src = 'models/source/tanker_ship.glb', out = 'public/models/tanker.glb';
  run('dedup', src, `${tmp}/t1.glb`);
  run('prune', `${tmp}/t1.glb`, `${tmp}/t2.glb`);
  run('meshopt', `${tmp}/t2.glb`, out, '--level', 'medium');
  console.log(`${src} ${mb(src)} → ${out} ${mb(out)}`);
}
