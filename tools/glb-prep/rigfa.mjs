import {NodeIO} from '@gltf-transform/core';
import {prune, dedup, textureCompress} from '@gltf-transform/functions';
import sharp from 'sharp';
const io=new NodeIO(); const doc=await io.read('../c/fourarms.glb'); const root=doc.getRoot();
const meshNode=root.listNodes().find(n=>n.getMesh()); const prim=meshNode.getMesh().listPrimitives()[0];
const P=prim.getAttribute('POSITION').getArray(); const N=P.length/3;
// bones: name, parent, head[x,y,z], tail[x,y,z], arm side (0 none), kind
const B=[]; const add=(name,parent,head,tail,o={})=>B.push({name,parent,head,tail,...o});
add('root',null,[0,0,0],[0,1.05,0]);
add('hips','root',[0,1.05,0],[0,1.45,0]);
add('spine','hips',[0,1.45,0],[0,1.85,0]);
add('chest','spine',[0,1.85,0],[0,2.2,0]);
add('neck','chest',[0,2.2,0],[0,2.3,0]);
add('head','neck',[0,2.3,0],[0,2.47,0]);
for(const [s,n] of [[1,'L'],[-1,'R']]){
  add('upperArm'+n,'chest',[s*.5,2.05,0],[s*1.25,2.05,0],{arm:s});
  add('foreArm'+n,'upperArm'+n,[s*1.25,2.05,0],[s*1.98,2.02,0],{arm:s});
  add('upperArm2'+n,'chest',[s*.5,1.68,0],[s*.95,1.43,0],{arm:s});
  add('foreArm2'+n,'upperArm2'+n,[s*.95,1.43,0],[s*1.45,1.08,0],{arm:s});
  add('thigh'+n,'hips',[s*.2,1.0,0],[s*.2,.52,.02],{leg:s});
  add('shin'+n,'thigh'+n,[s*.2,.52,.02],[s*.2,.13,0],{leg:s});
  add('foot'+n,'shin'+n,[s*.2,.13,0],[s*.2,.03,.3],{leg:s});
}
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
function segDist(p,a,b){ const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]]; const L=ab[0]**2+ab[1]**2+ab[2]**2||1e-6; let t=(ap[0]*ab[0]+ap[1]*ab[1]+ap[2]*ab[2])/L; t=Math.max(0,Math.min(1,t)); return Math.hypot(p[0]-a[0]-ab[0]*t,p[1]-a[1]-ab[1]*t,p[2]-a[2]-ab[2]*t); }
const J=new Uint16Array(N*4), W=new Float32Array(N*4);
const cnt={}; 
for(let i=0;i<N;i++){ const p=[P[i*3],P[i*3+1],P[i*3+2]]; const ws=[];
  B.forEach((b,bi)=>{ let d=segDist(p,b.head,b.tail); let f=1;
    if(b.arm) f=sstep(.22,.62,b.arm*p[0]);          // arms cannot grab the torso centre / other side
    if(b.leg){ f=sstep(-.03,.05,b.leg*p[0])*(1-sstep(1.05,1.25,p[1])); }
    if(b.name==='root') f=0;
    if(b.name==='hips'&&p[1]<.9) f=Math.max(.0,1-sstep(.95,.7,p[1])*0); 
    if(f<=1e-4) return; ws.push([bi,f/Math.pow(d+.03,4)]); });
  if(!ws.length) ws.push([1,1]);
  ws.sort((a,b)=>b[1]-a[1]); const top=ws.slice(0,4); const sum=top.reduce((s,x)=>s+x[1],0);
  top.forEach((x,k)=>{ J[i*4+k]=x[0]; W[i*4+k]=x[1]/sum; }); const bn=B[top[0][0]].name; cnt[bn]=(cnt[bn]||0)+1; }
console.log(cnt);
// build nodes
const buf=root.listBuffers()[0];
const scene=root.listScenes()[0];
const nodes={}; 
B.forEach(b=>{ const nd=doc.createNode(b.name); nodes[b.name]=nd; const par=b.parent?B.find(x=>x.name===b.parent):null; nd.setTranslation(par?[b.head[0]-par.head[0],b.head[1]-par.head[1],b.head[2]-par.head[2]]:b.head); if(par) nodes[par.name].addChild(nd); });
const ibm=new Float32Array(B.length*16);
B.forEach((b,i)=>{ const m=[1,0,0,0, 0,1,0,0, 0,0,1,0, -b.head[0],-b.head[1],-b.head[2],1]; ibm.set(m,i*16); });
const skin=doc.createSkin('FourArmsSkin').setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buf));
B.forEach(b=>skin.addJoint(nodes[b.name])); skin.setSkeleton(nodes.root);
prim.setAttribute('JOINTS_0',doc.createAccessor().setType('VEC4').setArray(J).setBuffer(buf));
prim.setAttribute('WEIGHTS_0',doc.createAccessor().setType('VEC4').setArray(W).setBuffer(buf));
// re-root: mesh node + skeleton directly under scene, identity
meshNode.getParentNode()?.removeChild(meshNode); meshNode.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]); meshNode.setSkin(skin);
for(const c of scene.listChildren()) scene.removeChild(c);
scene.addChild(nodes.root); scene.addChild(meshNode);
await doc.transform(prune({keepLeaves:true}), dedup(), textureCompress({encoder:sharp,resize:[512,512]}));
await io.write('../out/fourarms.glb',doc);
console.log('ok', B.length);
