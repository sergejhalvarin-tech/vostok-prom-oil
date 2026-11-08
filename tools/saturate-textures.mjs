// Делает цветные текстуры (baseColor) модели насыщеннее и контрастнее, чтобы детали читались чётко.
//   node tools/saturate-textures.mjs in.glb out.glb [насыщенность=1.45] [контраст=1.12]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';

const [src, out, satArg, conArg] = process.argv.slice(2);
const sat = Number(satArg || 1.45), con = Number(conArg || 1.12);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);

const colorTex = new Set();
for (const m of doc.getRoot().listMaterials()) {
  const t = m.getBaseColorTexture();
  if (t) colorTex.add(t);
  // Однотонные материалы: тот же сдвиг насыщенности для множителя цвета.
  const [r, g, b, a] = m.getBaseColorFactor();
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const s = (c) => Math.min(1, Math.max(0, l + (c - l) * sat));
  m.setBaseColorFactor([s(r), s(g), s(b), a]);
}

let n = 0;
for (const t of colorTex) {
  const img = t.getImage();
  if (!img) continue;
  const mime = t.getMimeType();
  let p = sharp(Buffer.from(img)).modulate({saturation: sat}).linear(con, -(128 * con - 128));
  p = mime === 'image/png' ? p.png() : p.jpeg({quality: 95});
  t.setImage(new Uint8Array(await p.toBuffer()));
  n++;
}
await io.write(out, doc);
console.log(`насыщенность ×${sat}, контраст ×${con}: ${n} текстур → ${out}`);
