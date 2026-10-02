// Offline GLB pipeline regression test for the supplied alien assets.
// Verifies: real skin attributes, bind-pose bounds, fitted placement, and bone-driven deformation.
const fs=require('fs'),vm=require('vm');
const ROOT=__dirname+'/../';
const ctx={console,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},TextDecoder,
  fetch:async(url)=>{const b=fs.readFileSync(ROOT+'www/'+url);return {arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}},
  btoa:s=>Buffer.from(s,'binary').toString('base64')};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+'www/three.min.js','utf8'),ctx);
ctx.THREE.TextureLoader.prototype.load=function(_url,onLoad){const t=new ctx.THREE.Texture();t.image={width:1,height:1};t.needsUpdate=true;onLoad(t);return t;};
ctx.window=ctx;
vm.runInContext(fs.readFileSync(ROOT+'www/gltf-mini-loader.js','utf8'),ctx);
const T=ctx.THREE;
function skinnedBounds(root){
  root.updateMatrixWorld(true); let out=null; const v=new T.Vector3();
  root.traverse(o=>{
    if(!o.isMesh) return;
    let bb=null;
    if(o.isSkinnedMesh){
      o.skeleton.update(); const p=o.geometry.attributes.position;
      const mn=new T.Vector3(Infinity,Infinity,Infinity), mx=new T.Vector3(-Infinity,-Infinity,-Infinity);
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);mn.min(v);mx.max(v);}
      bb=new T.Box3(mn,mx);
    } else {
      if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
      bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    }
    if(!out)out=bb;else out.union(bb);
  });
  return out;
}
function fit(root,height,kind){
  if(kind==='cannonbolt')root.rotation.z=Math.PI/2;
  root.updateMatrixWorld(true);
  let b=skinnedBounds(root), size=b.getSize(new T.Vector3());
  const center=new T.Vector3((b.min.x+b.max.x)/2,0,(b.min.z+b.max.z)/2);
  const scale=height/Math.max(0.0001,size.y); root.scale.setScalar(scale);
  root.position.x-=center.x*scale; root.position.z-=center.z*scale; root.updateMatrixWorld(true);
  b=skinnedBounds(root); root.position.y-=b.min.y; root.updateMatrixWorld(true);
  return skinnedBounds(root);
}
function poseChange(mesh,bone){
  const p=mesh.geometry.attributes.position,v=new T.Vector3(),step=Math.max(1,Math.floor(p.count/500));
  mesh.skeleton.update(); const before=[];
  for(let i=0;i<p.count;i+=step){v.fromBufferAttribute(p,i);mesh.boneTransform(i,v);before.push(v.x,v.y,v.z);}
  bone.rotation.x+=0.5; bone.updateMatrixWorld(true); mesh.updateMatrixWorld(true); mesh.skeleton.update();
  let delta=0,k=0;
  for(let i=0;i<p.count;i+=step){v.fromBufferAttribute(p,i);mesh.boneTransform(i,v);delta+=Math.hypot(v.x-before[k++],v.y-before[k++],v.z-before[k++]);}
  bone.rotation.x-=0.5; bone.updateMatrixWorld(true); mesh.updateMatrixWorld(true); mesh.skeleton.update();
  return delta;
}
(async()=>{
  const specs={
    xlr8:['xlr8_rigged.glb',2.8],heatblast:['heatblast.glb',3.2],
    cannonbolt:['cannonbolt.glb',2.7],echo_echo:['echoecho.glb',2.55]
  };
  let fail=0;
  for(const [kind,[file,height]] of Object.entries(specs)){
    const root=await ctx.MiniGLTF.load('assets/aliens/'+file,{meshFilter:kind==='echo_echo'?((n)=>[55,56,57].includes(n.mesh)):undefined});
    const skins=[]; root.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
    const attrs=skins.every(o=>o.geometry.getAttribute('skinIndex')&&o.geometry.getAttribute('skinWeight'));
    const b=fit(root,height,kind), size=b.getSize(new T.Vector3()), finite=[...size.toArray(),...root.position.toArray()].every(Number.isFinite);
    const testBone=skins[0]?.skeleton?.bones?.[0]; const moved=!!testBone&&poseChange(skins[0],testBone)>1e-4;
    const ok=skins.length>0&&attrs&&finite&&Math.abs(size.y-height)<0.05&&moved;
    console.log(`${ok?'PASS':'FAIL'} ${kind}: skins=${skins.length} bones=${skins[0]?.skeleton?.bones?.length||0} size=${size.toArray().map(x=>x.toFixed(3)).join(',')} moved=${moved}`);
    if(!ok)fail++;
  }
  process.exit(fail?1:0);
})();
