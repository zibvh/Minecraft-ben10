import {NodeIO} from '@gltf-transform/core';
import {prune, weld, simplify, textureCompress, dedup} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
const io=new NodeIO();
const name=process.argv[2], ratio=+process.argv[3]||0, tex=+process.argv[4]||512;
const doc=await io.read(`../c/${name}.glb`);
const root=doc.getRoot();
if(name==='echoecho'){
  const skin0=root.listSkins()[0];
  const keep=root.listNodes().find(n=>n.getSkin()===skin0 && n.getMesh());
  console.log('keep mesh node',keep.getName(),keep.getMesh().getName());
  for(const n of root.listNodes()){ if(n.getMesh() && n!==keep) n.setMesh(null); if(n.getSkin() && n!==keep) n.setSkin(null); }
  for(const a of root.listAnimations()){ a.listChannels().forEach(c=>c.dispose()); a.listSamplers().forEach(c=>c.dispose()); a.dispose(); }
  // drop the two extra armatures' skins
  root.listSkins().forEach(s=>{ if(s!==skin0) s.dispose(); });
}
if(ratio){ await MeshoptSimplifier.ready; await doc.transform(weld({tolerance:+(process.env.WT||1e-5)}), simplify({simplifier:MeshoptSimplifier, ratio, error:+(process.argv[5]||0.02), lockBorder:false})); }
await doc.transform(prune({keepLeaves:false}), dedup(), textureCompress({encoder:sharp,resize:[tex,tex]}));
for(const a of root.listAccessors()) if(a.listParents().every(p=>p.propertyType==='Root')) a.dispose();
await io.write(`../out/${name}.glb`,doc);
let v=0; root.listMeshes().forEach(m=>m.listPrimitives().forEach(p=>v+=p.getAttribute('POSITION').getCount()));
console.log(name,'verts',v);
