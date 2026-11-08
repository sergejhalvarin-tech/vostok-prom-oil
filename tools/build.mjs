// Сборка в dist/: бандл src/main.js (минифицированный) + всё из public/.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
fs.rmSync('dist', {recursive: true, force: true});
fs.cpSync('public', 'dist', {recursive: true, filter: (f) => !/main\.js(\.map)?$/.test(f)});
await esbuild.build({absWorkingDir: ROOT, entryPoints: [path.join(ROOT, 'src/main.js')], bundle: true, format: 'esm', minify: true, outdir: 'dist'});
console.log('dist/ готов');
