// Готовит модель МЛСП «Приразломная» для веба:
// spec-gloss → metal-rough (Three.js его больше не читает), текстуры ≤2048 px в WebP, геометрия meshopt.
//   node tools/optimize-model.mjs [src.glb] [out.glb]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] || 'models/source/prirazlomnaya.glb';
const out = process.argv[3] || 'public/models/prirazlomnaya.glb';
const tmp = 'models/tmp';
fs.mkdirSync(tmp, {recursive: true});
fs.mkdirSync(path.dirname(out), {recursive: true});

const cli = path.resolve('node_modules/@gltf-transform/cli/bin/cli.js');
const run = (...args) => {
  console.log('gltf-transform', args.join(' '));
  execFileSync(process.execPath, [cli, ...args], {stdio: 'inherit'});
};

run('metalrough', src, `${tmp}/1.glb`);
run('dedup', `${tmp}/1.glb`, `${tmp}/2.glb`);
run('prune', `${tmp}/2.glb`, `${tmp}/3.glb`);
run('resize', `${tmp}/3.glb`, `${tmp}/4.glb`, '--width', '2048', '--height', '2048');
run('webp', `${tmp}/4.glb`, `${tmp}/5.glb`, '--quality', '82');
run('meshopt', `${tmp}/5.glb`, out, '--level', 'medium');

const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(1) + ' MB';
console.log(`${src} ${mb(src)} → ${out} ${mb(out)}`);
