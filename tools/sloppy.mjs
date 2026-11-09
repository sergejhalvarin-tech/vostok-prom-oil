// Грубое упрощение тяжёлых примитивов (тележки вагона-цистерны): node tools/sloppy.mjs in.glb out.glb [maxTris] [ratio]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
await MeshoptSimplifier.ready;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const [, , inp, out, maxT = '2500', ratio = '0.25'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder});
const doc = await io.read(inp);
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const idx = prim.getIndices(); if (!idx) continue;
  const tris = idx.getCount() / 3; if (tris <= +maxT) continue;
  const pos = prim.getAttribute('POSITION');
  const P = new Float32Array(pos.getCount() * 3);
  for (let i = 0, e = []; i < pos.getCount(); i++) { pos.getElement(i, e); P.set(e, i * 3); }
  const I = new Uint32Array(idx.getArray());
  const target = Math.floor(I.length * +ratio / 3) * 3;
  const [res] = MeshoptSimplifier.simplifySloppy(I, P, 3, null, target, 0.08);
  idx.setArray(new Uint32Array(res));
  console.log(mesh.getName(), tris, '→', res.length / 3);
}
await io.write(out, doc);
