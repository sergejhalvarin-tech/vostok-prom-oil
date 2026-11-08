// Локальный сервер разработки: собирает src/main.js на лету и раздаёт public/.
//   node tools/dev.mjs            → http://localhost:5180
import * as esbuild from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const port = Number(process.env.PORT || 5180);

const ctx = await esbuild.context({
  absWorkingDir: ROOT,
  entryPoints: [path.join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'esm',
  sourcemap: true,
  outdir: path.join(ROOT, 'public'),
  logLevel: 'info',
});
await ctx.watch();
const {port: p} = await ctx.serve({servedir: path.join(ROOT, 'public'), port});
console.log(`Oil_Shop dev: http://localhost:${p}/`);
