// Убирает надписи с текстур модели платформы: название на борту и логотипы на вышке —
// участки с надписями заменяются чистыми участками тех же текстур.
// node tools/clean-platform.mjs → models/source/prirazlomnaya_clean.glb
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('models/source/prirazlomnaya.glb');
const tex = doc.getRoot().listTextures();
async function patch(i, jobs) {
  const t = tex[i], src = Buffer.from(t.getImage());
  const comps = [];
  for (const {from, to, tile} of jobs) {
    const piece = await sharp(src).extract(from).toBuffer();
    if (!tile) { comps.push({input: await sharp(piece).resize(to.width, to.height, {fit: 'fill'}).toBuffer(), left: to.left, top: to.top}); continue; }
    for (let x = 0; x < to.width; x += from.width) for (let y = 0; y < to.height; y += from.height) {
      const w = Math.min(from.width, to.width - x), h = Math.min(from.height, to.height - y);
      comps.push({input: await sharp(piece).extract({left: 0, top: 0, width: w, height: h}).toBuffer(), left: to.left + x, top: to.top + y});
    }
  }
  const out = await sharp(src).composite(comps).toFormat(t.getMimeType() === 'image/png' ? 'png' : 'jpeg', {quality: 92}).toBuffer();
  t.setImage(new Uint8Array(out));
}
// 36 (4096×1024): полоса с названием y≈380–660 ← чистая полоса сверху.
await patch(36, [{from: {left: 0, top: 60, width: 4096, height: 290}, to: {left: 0, top: 375, width: 4096, height: 290}}]);
// 37 и 38 (2048×2048): три панели с логотипами ← фактура соседней чистой панели.
for (const i of [37, 38]) await patch(i, [[18, 178], [188, 348], [356, 508]].map(([y0, y1]) => ({from: {left: 1540, top: 6, width: 138, height: 240}, to: {left: 1700, top: y0, width: 314, height: y1 - y0}, tile: true})));
await io.write('models/source/prirazlomnaya_clean.glb', doc);
console.log('ok');
