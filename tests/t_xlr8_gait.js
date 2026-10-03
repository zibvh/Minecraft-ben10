// XLR8 speed-state gait check: boots the real game + the real GLB bodies in a Node vm and measures the retargeted skeleton.
// Run: node t_xlr8_gait.js   (no dependencies). Prints PASS/FAIL per state; tune numbers in XLR8_LOCO (www/index.html).
const fs=require('fs'), path=require('path'), Module=require('module');
const W=path.join(__dirname,'..','www')+'/';
let src=fs.readFileSync(path.join(__dirname,'vmharness.js'),'utf8');
src=src.replace("vm.runInContext(THREE_SRC,ctx,{filename:'three.min.js'});",`vm.runInContext(THREE_SRC,ctx,{filename:'three.min.js'});
  ctx.atob=s=>Buffer.from(s,'base64').toString('binary'); ctx.TextDecoder=TextDecoder; ctx.TextEncoder=TextEncoder; ctx.Blob=Blob; ctx.URL=URL;
  doc.createElementNS=(ns,t)=>{ const e=new El(t); let _s=''; Object.defineProperty(e,'src',{get:()=>_s,set:v=>{_s=v; setTimeout(()=>{ e.width=e.naturalWidth=4; e.height=e.naturalHeight=4; (e._l.load||[]).forEach(f=>f({})); if(e.onload) e.onload({}); },0);}}); return e; };
  for(const f of ['glb-libs.js','models.js','glbbody.js']) vm.runInContext(fs.readFileSync(${JSON.stringify(W)}+f,'utf8'),ctx,{filename:f});`);
src=src.replace("main=main.replace('// initial portrait render for Ben',bridge+'// initial portrait render for Ben');","main=main.replace('// initial portrait render for Ben',bridge+'window.__x={XLR8_LOCO,animateRig};// initial portrait render for Ben');");
const m=new Module(path.join(__dirname,'vmharness_glb.js')); m.paths=Module._nodeModulePaths(__dirname); m._compile(src,path.join(__dirname,'vmharness_glb.js'));
const {boot}=m.exports;
const g=boot(); let fails=0; const check=(n,c,x='')=>{ console.log((c?'PASS ':'FAIL ')+n+(x?'  ['+x+']':'')); if(!c) fails++; };
setTimeout(()=>{
  g.start(); g.step(5);
  const d=g.d, x=g.win.__x, p=d.player, THREE=g.win.THREE;
  const xl=d.ALIENS.find(a=>a.id==='xlr8'); d.setForm(xl,'xlr8');
  const parts=p.model.userData.parts, G=parts.glb, A=parts.anim, C=x.XLR8_LOCO;
  check('XLR8 GLB body attached with leg data',!!(G&&G.leg));
  const bones={}; G.bones.forEach(b=>bones[b.name]=b);
  const P=n=>{ parts.g.updateMatrixWorld(true); return parts.g.worldToLocal(bones[n].getWorldPosition(new THREE.Vector3())); };
  const DT=1/60, fwd={x:0,z:-1}, deg=r=>r*180/Math.PI;
  const run=(v)=>{ C.forceV=v; const inp={pos:{x:0,z:0},fwd,grounded:true,moving:true,xl:true}; A.px=null; let yMin=1e9,yMax=-1e9,zMin=1e9,zMax=-1e9;
    for(let i=0;i<240;i++){ inp.pos.z-=11.84*Math.pow(13,v)*DT; x.animateRig(parts,DT,inp);
      if(i>=150){ for(const n of ['heel02L_end_039','heel02R_end_044']){ const q=P(n); yMin=Math.min(yMin,q.y); yMax=Math.max(yMax,q.y); zMin=Math.min(zMin,q.z); zMax=Math.max(zMax,q.z); } } }
    const hp=P('spine_01'), nk=P('spine004_05'), t1=P('tail(1)_045'), tt=P('tail(6)_end_051');
    return {lean:deg(Math.atan2(-(nk.z-hp.z),nk.y-hp.y)), yMin,yMax, zSpan:zMax-zMin, tailRise:deg(Math.atan2(tt.y-t1.y,tt.z-t1.z)), tailX:Math.abs(tt.x)}; };
  const w=run(0), r=run(.5), s=run(1);
  check('WALK torso ~30 deg',Math.abs(w.lean-30)<3,w.lean.toFixed(1));
  check('RUN torso ~60 deg',Math.abs(r.lean-60)<3,r.lean.toFixed(1));
  check('SPRINT torso 80-85 deg',s.lean>=80&&s.lean<=85,s.lean.toFixed(1));
  check('WALK soles stay on the floor (y locked)',w.yMax-w.yMin<.08,(w.yMax-w.yMin).toFixed(3));
  check('RUN soles stay on the floor (y locked)',r.yMax-r.yMin<.12,(r.yMax-r.yMin).toFixed(3));
  check('SPRINT soles locked rigid on the floor',s.yMax-s.yMin<.02&&Math.abs(s.yMin-G.leg.L.soleY)<.03,(s.yMax-s.yMin).toFixed(3));
  check('RUN stride roughly doubles WALK',r.zSpan/w.zSpan>1.8&&r.zSpan/w.zSpan<2.8,(r.zSpan/w.zSpan).toFixed(2)+'x');
  check('SPRINT stride narrows drastically',s.zSpan<.25*w.zSpan,s.zSpan.toFixed(2)+' vs walk '+w.zSpan.toFixed(2));
  check('tail trails the body in every state (|rise|<8 deg)',[w,r,s].every(o=>Math.abs(o.tailRise)<8),[w,r,s].map(o=>o.tailRise.toFixed(1)).join('/'));
  check('SPRINT tail straight (no sideways swish)',s.tailX<.05,s.tailX.toFixed(3));
  // smooth blend: a fast stride legitimately moves a leg ~0.5 rad/frame, an angle-wrap or IK branch flip would jump 3+ rad
  
  C.forceV=0; const inp={pos:{x:0,z:0},fwd,grounded:true,moving:true,xl:true}; A.px=null; let prev=null,maxJ=0,bad=false;
  for(let i=0;i<480;i++){ const v=i<240?i/240:2-i/240; C.forceV=v; inp.pos.z-=11.84*Math.pow(13,v)*DT; x.animateRig(parts,DT,inp);
    const k=[parts.hips.rotation.x,parts.hips.position.y,parts.leftLeg.rotation.x,parts.kneeL.rotation.x,parts.footL.rotation.x,parts.leftArm.rotation.x,parts.elbowL.rotation.x,parts.head.rotation.x]; if(k.some(n=>!isFinite(n))) bad=true;
    if(prev) k.forEach((n,j)=>{ maxJ=Math.max(maxJ,Math.abs(n-prev[j])); }); prev=k; }
  check('velocity sweep 0->1->0: finite values, no wrap/branch pops (<0.8 rad/frame)',!bad&&maxJ<.8,maxJ.toFixed(3));
  // real game loop: holding RUN as XLR8 drives the states from actual speed and never throws
  C.forceV=null; A.px=null; p.runLatch=true; d.moveInput.x=0; d.moveInput.y=1; let peak=0;
  for(let i=0;i<600;i++){ p.energy=xl.maxEnergy; g.step(1); if(A.xlState) peak=Math.max(peak,A.xlState.v); }
  check('holding RUN reaches SPRINT in the live game',peak>.9,'peak v '+peak.toFixed(2));
  p.runLatch=false; d.moveInput.y=0; for(let i=0;i<240;i++) g.step(1);
  check('stopping returns to the idle stance (gait faded out)',A.xlState&&A.xlState.mvX<.05,'mvX '+(A.xlState&&A.xlState.mvX).toFixed(2));
  check('no JS errors',g.errors.length===0,g.errors[0]||'');
  console.log(fails?('\n'+fails+' FAILED'):'\nall passed'); process.exit(fails?1:0);
},5000);
