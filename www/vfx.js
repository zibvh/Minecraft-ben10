/* =====================================================================================
   OMNIVERSE VFX ENGINE  -  sprite-sheet / particle / ribbon effects built from the Brackeys VFX pack (textures in www/vfx/).
   Pure presentation: it never touches gameplay state. The game calls VFX.hit(), VFX.slam(), VFX.attach(...) etc. with world positions.
   Everything is pooled (fixed number of meshes + materials, textures loaded once and shared) so it stays cheap on phones.
   Flipbook playback:  frame = floor(progress*(cols*rows-1)); the shader picks exactly one cell of the sheet.
   ===================================================================================== */
(function(){
const VFX={ ok:false };
let THREE_, scene, camera;
const TEX={}, SHEETS={ // name -> [cols,rows]
  big_hit:[6,5], impact_white:[6,4], charge:[7,6], electric_ring:[6,5], explosion:[6,5], fire_point:[6,5], fire_ring:[6,5], lightstreaks:[6,5],
  star_explosion:[6,5], vortex:[6,5], wavy_blue:[6,5], wavy_purple:[6,5], fire_01:[8,8], flame_01:[16,4], wispy_smoke_01:[8,8], explosion_01:[8,8] };
const FILE={ big_hit:'big_hit_6x5', impact_white:'impact_white_6x4', charge:'charge_7x6', electric_ring:'electric_ring_6x5', explosion:'explosion_6x5', fire_point:'fire_point_6x5', fire_ring:'fire_ring_6x5',
  lightstreaks:'lightstreaks_6x5', star_explosion:'star_explosion_6x5', vortex:'vortex_6x5', wavy_blue:'wavy_blue_6x5', wavy_purple:'wavy_purple_6x5', fire_01:'fire_01_8x8', flame_01:'flame_01_16x4', wispy_smoke_01:'wispy_smoke_01_8x8', explosion_01:'explosion_01_8x8' };
const MAXI=84, MAXP=140;
const insts=[], parts=[], trails=[], free=[], freeP=[];
let quad, loader, qt=null;
const _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _v3=new THREE.Vector3(), _q=new THREE.Quaternion(), _m=new THREE.Matrix4();
function texOf(name){
  let t=TEX[name]; if(t) return t;
  t=TEX[name]={ready:false,tex:null};
  loader.load('vfx/'+(FILE[name]||name)+'.png',tx=>{ tx.minFilter=THREE.LinearFilter; tx.generateMipmaps=false; t.tex=tx; t.ready=true; },undefined,()=>{ t.failed=true; });
  return t;
}
const VS='varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const FS='uniform sampler2D map; uniform vec2 grid; uniform float frame; uniform vec4 tint; uniform float mask; uniform vec2 vr; varying vec2 vUv;'+
 'void main(){ float f=floor(frame); float c=mod(f,grid.x); float r=floor(f/grid.x); vec2 uv=(vec2(c,grid.y-1.0-r)+vec2(vUv.x,mix(vr.x,vr.y,vUv.y)))/grid; vec4 t=texture2D(map,uv); float e=mix(1.0,smoothstep(0.0,.22,min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y))),mask); gl_FragColor=vec4(t.rgb*tint.rgb,t.a*tint.a*e); }';
function mkMat(add){
  const m=new THREE.ShaderMaterial({ uniforms:{ map:{value:null}, grid:{value:new THREE.Vector2(1,1)}, frame:{value:0}, tint:{value:new THREE.Vector4(1,1,1,1)}, mask:{value:0}, vr:{value:new THREE.Vector2(0,1)} },
    vertexShader:VS, fragmentShader:FS, transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:add?THREE.AdditiveBlending:THREE.NormalBlending });
  return m;
}
function acquire(list,freeList,cap){
  let o=freeList.pop();
  if(!o){ if(list.length<cap){ o={mesh:new THREE.Mesh(quad,mkMat(false)),on:false}; o.mesh.frustumCulled=false; o.mesh.visible=false; scene.add(o.mesh); list.push(o); }
    else { let best=null,bt=-1; for(const q of list){ const k=q.age||0; if(k>bt){ bt=k; best=q; } } o=best; } }
  return o;
}
function setBlend(o,add){ const m=o.mesh.material, b=add?THREE.AdditiveBlending:THREE.NormalBlending; if(m.blending!==b){ m.blending=b; m.needsUpdate=true; } }
const col=(c,a)=>{ c=c==null?0xffffff:c; return [((c>>16)&255)/255,((c>>8)&255)/255,(c&255)/255,a==null?1:a]; };

/* ---------- sprite-sheet instance (one-shot or loop, optionally following a callback) ---------- */
// opts: size, sizeEnd, dur, loop, add, tint(0xRRGGBB), alpha, rot, spin, follow(inst)->sets inst.pos, stretch:{from,to,width}, fadeIn, fadeOut
function flip(name,pos,opts){
  if(!VFX.ok) return null; opts=opts||{};
  const T=texOf(name), g=SHEETS[name]||[1,1]; const o=acquire(insts,free,MAXI); if(!o) return null;
  if(!free.includes(o)){} o.on=true; o.age=0; o.name=name; o.T=T; o.g=g; o.frames=g[0]*g[1]; o.dur=opts.dur||.6; o.loop=!!opts.loop; o.size=opts.size||1; o.sizeEnd=opts.sizeEnd||o.size;
  o.add=opts.add!==false; o.tint=col(opts.tint,opts.alpha); o.rot=opts.rot||0; o.spin=opts.spin||0; o.follow=opts.follow||null; o.str=opts.stretch||null; o.fi=opts.fadeIn||0; o.fo=opts.fadeOut==null?.3:opts.fadeOut; o.dead=false; o.mesh.material.uniforms.mask.value=opts.mask?1:0; o.mesh.material.uniforms.vr.value.set(opts.vr?opts.vr[0]:0,opts.vr?opts.vr[1]:1);
  o.pos=o.pos||new THREE.Vector3(); if(pos) o.pos.copy(pos);
  setBlend(o,o.add); const u=o.mesh.material.uniforms; u.grid.value.set(g[0],g[1]); o.mesh.visible=false; o.part=false; return o;
}
function stop(o){ if(Array.isArray(o)) o.forEach(stop); else if(o) o.dead=true; }
function placeBillboard(o,sz){
  o.mesh.position.copy(o.pos); o.mesh.quaternion.copy(camera.quaternion); if(o.rot) o.mesh.rotateZ(o.rot); o.mesh.scale.set(sz,sz,1);
}
function placeStretch(o,a,b,w,up){
  _v.copy(b).sub(a); const L=Math.max(.001,_v.length()); _v.multiplyScalar(1/L); _v2.copy(camera.position).sub(a); // toward camera
  _v3.copy(_v).cross(_v2).normalize();                                                                                // up axis of the quad
  if(_v3.lengthSq()<.5){ _v3.set(0,1,0); }
  _v2.copy(_v3).cross(_v).normalize();                                                                                // facing axis
  if(up){ _v2.copy(_v3).cross(_v).normalize(); _m.makeBasis(_v3,_v,_v2); } else _m.makeBasis(_v,_v3,_v2);
  o.mesh.quaternion.setFromRotationMatrix(_m);
  o.mesh.position.copy(a).add(b).multiplyScalar(.5); if(up) o.mesh.scale.set(w,L,1); else o.mesh.scale.set(L,w,1);
}
/* ---------- single-texture particle ---------- */
// opts: tex, size, sizeEnd, vel, grav, drag, life, tint, alpha, add, spin, rot
function particle(tex,pos,opts){
  if(!VFX.ok) return null; const T=texOf(tex); const o=acquire(parts,freeP,MAXP); if(!o) return null; opts=opts||{};
  o.on=true; o.age=0; o.T=T; o.life=opts.life||.6; o.size=opts.size||.5; o.sizeEnd=opts.sizeEnd==null?o.size:opts.sizeEnd; o.vel=(o.vel||new THREE.Vector3()).copy(opts.vel||_v.set(0,0,0));
  o.grav=opts.grav||0; o.drag=opts.drag||0; o.tint=col(opts.tint,opts.alpha); o.rot=opts.rot||0; o.spin=opts.spin||0; o.pos=o.pos||new THREE.Vector3(); o.pos.copy(pos); o.g=[1,1]; o.part=true; o.fi=opts.fadeIn||.08; o.str=null; o.follow=null;
  setBlend(o,!!opts.add); o.mesh.material.uniforms.grid.value.set(1,1); o.mesh.material.uniforms.frame.value=0; o.mesh.material.uniforms.mask.value=0; o.mesh.visible=false; return o;
}
/* ---------- ribbon trail sampled from recent positions ---------- */
function trail(tex,opts){
  if(!VFX.ok) return null; opts=opts||{}; const N=opts.n||18;
  const g=new THREE.BufferGeometry(), pos=new Float32Array(N*6), uv=new Float32Array(N*4), colr=new Float32Array(N*6), idx=[];
  for(let i=0;i<N;i++){ uv[i*4]=0; uv[i*4+1]=i/(N-1); uv[i*4+2]=1; uv[i*4+3]=i/(N-1); if(i<N-1){ const a=i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); } }
  g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setAttribute('color',new THREE.BufferAttribute(colr,3)); g.setIndex(idx);
  const T=texOf(tex), m=new THREE.MeshBasicMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, vertexColors:true });
  const mesh=new THREE.Mesh(g,m); mesh.frustumCulled=false; mesh.visible=false; scene.add(mesh);
  const t={mesh,N,pts:new Float32Array(N*3),n:0,T,m,width:opts.width||.3,tint:col(opts.tint),life:opts.life||.5,step:opts.step||.5,intensity:0,ages:new Float32Array(N),last:new THREE.Vector3(1e9,0,0)};
  trails.push(t); return t;
}
function trailPush(t,p,intensity){
  if(!t) return; t.intensity=intensity==null?1:intensity;
  if(t.n===0||t.last.distanceTo(p)>t.step){ t.pts.copyWithin(3,0,(t.N-1)*3); t.ages.copyWithin(1,0,t.N-1); t.pts[0]=p.x; t.pts[1]=p.y; t.pts[2]=p.z; t.ages[0]=0; t.n=Math.min(t.N,t.n+1); t.last.copy(p); }
  else { t.pts[0]=p.x; t.pts[1]=p.y; t.pts[2]=p.z; t.ages[0]=0; }
  t.idle=0;
}
function trailClear(t){ if(t){ t.n=0; t.last.set(1e9,0,0); t.mesh.visible=false; } }
function updateTrails(dt){
  for(const t of trails){
    if(t.n<2){ t.mesh.visible=false; continue; }
    if(!t.T.ready){ t.mesh.visible=false; continue; } if(t.m.map!==t.T.tex){ t.m.map=t.T.tex; t.m.needsUpdate=true; }
    t.idle=(t.idle||0)+dt; if(t.idle>.05){ t.intensity=Math.max(0,t.intensity-dt*4); }   // fades out when no longer fed
    for(let i=0;i<t.N;i++) t.ages[i]+=dt;
    const pos=t.mesh.geometry.attributes.position.array, cl=t.mesh.geometry.attributes.color.array; let any=false;
    for(let i=0;i<t.N;i++){
      const j=Math.min(i,t.n-1), a=Math.min(j+1,t.n-1), b=Math.max(j-1,0);
      _v.set(t.pts[b*3]-t.pts[a*3],t.pts[b*3+1]-t.pts[a*3+1],t.pts[b*3+2]-t.pts[a*3+2]); if(_v.lengthSq()<1e-8) _v.set(0,0,1); _v.normalize();
      _v2.set(t.pts[j*3],t.pts[j*3+1],t.pts[j*3+2]).sub(camera.position); _v3.copy(_v).cross(_v2).normalize();       // sideways, facing the camera
      const age=Math.min(1,t.ages[Math.min(i,t.n-1)]/t.life), f=(i<t.n?1:0)*Math.pow(1-i/(t.N-1),1.2)*(1-age)*t.intensity, w=t.width*(1-.55*i/(t.N-1));
      const o=i*6, cx=t.pts[j*3], cy=t.pts[j*3+1], cz=t.pts[j*3+2];
      pos[o]=cx+_v3.x*w; pos[o+1]=cy+_v3.y*w; pos[o+2]=cz+_v3.z*w; pos[o+3]=cx-_v3.x*w; pos[o+4]=cy-_v3.y*w; pos[o+5]=cz-_v3.z*w;
      for(let v=0;v<2;v++){ cl[o+v*3]=t.tint[0]*f; cl[o+v*3+1]=t.tint[1]*f; cl[o+v*3+2]=t.tint[2]*f; } if(f>.01) any=true; }
    t.mesh.geometry.attributes.position.needsUpdate=true; t.mesh.geometry.attributes.color.needsUpdate=true; t.mesh.visible=any;
    if(!any) t.n=0;
  }
}
/* ---------- per-frame ---------- */
function update(dt){
  if(!VFX.ok) return; dt=Math.min(dt,.05);
  for(const o of insts){ if(!o.on) continue;
    o.age+=dt; if(o.follow) o.follow(o);
    let p=o.age/o.dur; if(o.loop){ p=(o.age%o.dur)/o.dur; if(o.dead){ o.fade=(o.fade||0)+dt; if(o.fade>(o.fo||.15)){ kill(o,insts,free); continue; } } }
    else if(p>=1||o.dead&&(o.fade=(o.fade||0)+dt)>(o.fo||.15)){ kill(o,insts,free); continue; }
    if(!o.T.ready){ o.mesh.visible=false; continue; }
    const u=o.mesh.material.uniforms; if(u.map.value!==o.T.tex) u.map.value=o.T.tex;
    u.frame.value=Math.min(o.frames-1,Math.floor(p*(o.frames-1)+.0001));
    let a=o.tint[3]; if(o.fi&&o.age<o.fi) a*=o.age/o.fi; if(!o.loop){ const left=1-p; if(left<o.fo/o.dur) a*=Math.max(0,left/(o.fo/o.dur)); } if(o.dead) a*=Math.max(0,1-(o.fade||0)/(o.fo||.15));
    u.tint.value.set(o.tint[0],o.tint[1],o.tint[2],a);
    const sz=o.size+(o.sizeEnd-o.size)*Math.min(1,o.age/o.dur);
    if(o.str){ placeStretch(o,o.str.from,o.str.to,o.str.width*(o.sizeEnd!==o.size?sz/o.size:1),o.str.up); }
    else { if(o.spin) o.rot+=o.spin*dt; placeBillboard(o,sz); }
    o.mesh.visible=true; }
  for(const o of parts){ if(!o.on) continue;
    o.age+=dt; if(o.age>=o.life){ kill(o,parts,freeP); continue; }
    if(!o.T.ready){ o.mesh.visible=false; continue; }
    if(o.drag){ o.vel.multiplyScalar(Math.max(0,1-o.drag*dt)); } if(o.grav) o.vel.y-=o.grav*dt; o.pos.addScaledVector(o.vel,dt);
    const p=o.age/o.life, u=o.mesh.material.uniforms; if(u.map.value!==o.T.tex) u.map.value=o.T.tex;
    const a=o.tint[3]*Math.min(1,o.age/o.fi)*(1-p*p); u.tint.value.set(o.tint[0],o.tint[1],o.tint[2],a);
    o.rot+=o.spin*dt; placeBillboard(o,o.size+(o.sizeEnd-o.size)*p); o.mesh.visible=true; }
  updateTrails(dt);
}
function kill(o,list,fl){ o.on=false; o.mesh.visible=false; o.follow=null; o.fade=0; if(!fl.includes(o)) fl.push(o); }
function clearAll(){ for(const o of insts) if(o.on) kill(o,insts,free); for(const o of parts) if(o.on) kill(o,parts,freeP); for(const t of trails) trailClear(t); }

/* ======================= effect presets (all take world positions) ======================= */
const R=(a,b)=>a+Math.random()*(b-a);
function sparks(pos,n,speed,tint,size,life){ for(let i=0;i<n;i++){ const a=Math.random()*6.283, e=R(.1,1); particle(i%2?'spark_02':'spark_01',pos,{ size:size||.28, sizeEnd:.05, life:life||.4, add:true, tint:tint==null?0xffe9b0:tint, grav:5, drag:1.5,
  vel:_v3.set(Math.cos(a)*speed*e,R(.3,1)*speed*.8,Math.sin(a)*speed*e) }); } }
function dirtBurst(pos,n,s){ for(let i=0;i<n;i++){ const a=Math.random()*6.283; particle(i%2?'dirt_01':'dirt_02',pos,{ size:.35*s, sizeEnd:.7*s, life:R(.45,.8), add:false, tint:0x9a7a55, alpha:.9, grav:7, drag:1,
  vel:_v3.set(Math.cos(a)*R(2,5)*s,R(2,5)*s,Math.sin(a)*R(2,5)*s), spin:R(-3,3) }); } }
function smokePuffs(pos,n,s,tint){ for(let i=0;i<n;i++){ const a=Math.random()*6.283; particle(i%2?'smoke_01':'smoke_05',pos,{ size:.7*s, sizeEnd:1.8*s, life:R(.7,1.2), add:false, tint:tint==null?0xb9b2a6:tint, alpha:.55, grav:-.4, drag:1.2,
  vel:_v3.set(Math.cos(a)*R(.6,2)*s,R(.4,1.4),Math.sin(a)*R(.6,2)*s), spin:R(-1,1) }); } }
VFX.sparks=sparks; VFX.dirtBurst=dirtBurst; VFX.smokePuffs=smokePuffs;
// compact impact: flash offset slightly toward the camera so the fist stays readable, then a few sparks
VFX.hit=function(pos,o){ o=o||{}; const s=o.size||1; _v.copy(camera.position).sub(pos).normalize().multiplyScalar(.25*s); const p=pos.clone().add(_v);
  flip('big_hit',p,{size:(o.heavy?2.6:1.6)*s,sizeEnd:(o.heavy?3.4:2.1)*s,dur:o.heavy?.42:.3,tint:o.tint,rot:R(0,6.28)}); flip('impact_white',p,{size:1.5*s,dur:.22,tint:o.tint});
  sparks(pos,o.heavy?6:3,o.heavy?7:5,o.sparkTint,.3*s); };
VFX.slam=function(pos,r){ r=r||1; const g=pos.clone(); flip('big_hit',g.clone().add(new THREE.Vector3(0,.6,0)),{size:3.4*r,dur:.45}); dirtBurst(g,10,r); smokePuffs(g,5,r);
  for(let i=0;i<14;i++){ const a=i/14*6.283; particle('smoke_05',g.clone().add(new THREE.Vector3(0,.2,0)),{size:.9*r,sizeEnd:1.7*r,life:.7,add:false,tint:0xc8bfae,alpha:.5,drag:2.2,vel:_v3.set(Math.cos(a)*9*r,.15,Math.sin(a)*9*r)}); } };
VFX.land=function(pos,k){ k=Math.max(.4,Math.min(2.2,k||1)); dirtBurst(pos,Math.round(3+4*k),.7*k); smokePuffs(pos,Math.round(2+2*k),.7*k); if(k>1.2) flip('wispy_smoke_01',pos.clone().add(new THREE.Vector3(0,.5,0)),{size:2.2*k,dur:.8,add:false,alpha:.6,tint:0xd4cbbb}); };
VFX.takeoff=function(pos,k){ k=k||1; dirtBurst(pos,4,.5*k); smokePuffs(pos,3,.6*k); };
VFX.explosion=function(pos,s,smoke){ s=s||1; flip('explosion',pos,{size:4.2*s,dur:.65,rot:R(0,6.28)}); flip('explosion_01',pos.clone().add(new THREE.Vector3(0,.3,0)),{size:3.4*s,dur:.9,add:true,alpha:.8});
  smokePuffs(pos,smoke===false?0:5,1.1*s,0x4a4640); sparks(pos,8,9*s,0xffb050,.35*s,.6); };
VFX.starBurst=function(pos,s,tint){ s=s||1; flip('star_explosion',pos,{size:3.2*s,dur:.5,tint,rot:R(0,6.28)}); flip('impact_white',pos,{size:1.8*s,dur:.22,tint}); sparks(pos,7,8*s,tint||0xffffff,.3*s,.5); for(let i=0;i<3;i++) particle(i?'star_02':'star_01',pos,{size:.5*s,sizeEnd:.1,life:.5,add:true,tint,vel:_v3.set(R(-3,3),R(1,4),R(-3,3)),spin:4}); };
VFX.sonicRing=function(pos,s,tint){ s=s||1; flip('electric_ring',pos,{size:1.2*s,sizeEnd:7*s,dur:.5,tint,rot:R(0,6.28)}); flip('wavy_blue',pos,{size:2.2*s,sizeEnd:5*s,dur:.5,tint:0xdff2ff,alpha:.8}); };
VFX.dashBurst=function(pos){ flip('vortex',pos.clone().add(new THREE.Vector3(0,.8,0)),{size:2.6,dur:.4,tint:0x9fe8ff}); sparks(pos,5,7,0x9fe8ff,.3,.35); particle('twirl_01',pos.clone().add(new THREE.Vector3(0,.8,0)),{size:1.8,sizeEnd:.4,life:.35,add:true,tint:0xaaf0ff,spin:9}); };
VFX.slide=function(pos,back,k){ dirtBurst(pos,3,.5*k); for(let i=0;i<3;i++) particle('smoke_01',pos,{size:.5,sizeEnd:1.3,life:.6,add:false,tint:0xc9c0b0,alpha:.5,vel:_v3.copy(back).multiplyScalar(R(2,5)*k).add(_v2.set(R(-.5,.5),R(.3,1),R(-.5,.5)))}); };
// looping effect that follows a callback until stop() (charge glow, beams, projectile bodies). follow(inst) must set inst.pos
VFX.attach=function(name,follow,o){ o=o||{}; o.loop=o.loop!==false; o.follow=follow; return flip(name,null,o); };
// pooled trail acquisition so projectiles never allocate meshes per shot
VFX.trailGet=function(tex,opts){ if(!VFX.ok) return null; opts=opts||{}; let t=null;
  for(const q of trails){ if(!q.busy&&q.n===0&&q.texName===tex&&q.N===(opts.n||18)){ t=q; break; } }
  if(!t){ t=trail(tex,opts); if(!t) return null; t.texName=tex; }
  t.busy=true; t.width=opts.width||.3; t.tint=col(opts.tint); t.life=opts.life||.5; t.step=opts.step||.5; t.n=0; t.last.set(1e9,0,0); return t; };
VFX.trailRelease=function(t){ if(t) t.busy=false; };
VFX.stop=stop; VFX.flip=flip; VFX.particle=particle; VFX.trail=trail; VFX.trailPush=trailPush; VFX.trailClear=trailClear; VFX.update=update; VFX.clear=clearAll;
// stretched sprite between two points (beam body / laser bolt); call each frame with new endpoints through follow()
VFX.beam=function(name,fromFn,toFn,width,o){ o=o||{}; const st={from:new THREE.Vector3(),to:new THREE.Vector3(),width:width||.5,up:!!o.up}; o.stretch=st; o.loop=true;
  o.follow=inst=>{ fromFn(st.from); toFn(st.to); inst.pos.copy(st.from); }; return flip(name,new THREE.Vector3(),o); };

/* ---------- PRISM (Chromastone): his energy is white-hot with pink/yellow/green/cyan/blue fringes (reference video).
   Built only from the pack textures: each sprite is drawn three times in pure R, G and B (additive) with a slow orbiting offset,
   so the core overlaps to white and the edges split into rainbow fringes; coloured blots shed from it in the video's palette. ---------- */
const PAL=[0xff2fd0,0xffe030,0x30e0ff,0x40ff70,0x4a6bff,0xff6a3a,0xffffff];
const _pa=new THREE.Vector3(), _pb=new THREE.Vector3();
function camRight(out){ return out.set(1,0,0).applyQuaternion(camera.quaternion); }
VFX.prismAttach=function(name,follow,o){ o=o||{}; const base=o.size||1;
  return [0xff0000,0x00ff00,0x0000ff].map((c,i)=>{ const oo=Object.assign({},o,{tint:c});
    return VFX.attach(name,f=>{ follow(f); const t=(typeof performance!=='undefined'?performance.now():0)*.006+i*2.094, m=.06*(f.size||base);
      f.pos.addScaledVector(camRight(_pa),Math.cos(t)*m).y+=Math.sin(t)*m; },oo); }); };
VFX.prismFlip=function(name,pos,o){ o=o||{}; const m=.05*(o.size||1);
  return [0xff0000,0x00ff00,0x0000ff].map((c,i)=>flip(name,pos.clone().addScaledVector(camRight(_pa),(i-1)*m),Object.assign({},o,{tint:c}))); };
VFX.prismBlots=function(pos,n,spread,speed,size,life){ for(let i=0;i<n;i++){ const a=Math.random()*6.283, e=Math.random()*2-1, r=Math.sqrt(1-e*e);
  particle(i%3?'light_01':'circle_01',pos.clone().add(new THREE.Vector3(Math.cos(a)*r*spread,e*spread,Math.sin(a)*r*spread)),{size:(size||.4)*(.6+Math.random()*.8),sizeEnd:.05,life:(life||.5)*(.6+Math.random()*.8),add:true,tint:PAL[(Math.random()*PAL.length)|0],drag:1.2,
    vel:new THREE.Vector3(Math.cos(a)*r*speed,e*speed,Math.sin(a)*r*speed),spin:R(-3,3)}); } };
VFX.prismBurst=function(pos,s){ s=s||1; VFX.prismFlip('star_explosion',pos,{size:3.8*s,dur:.5,rot:R(0,6.28)}); VFX.prismFlip('impact_white',pos,{size:2.8*s,dur:.3});
  VFX.prismBlots(pos,Math.round(14+14*s),.5*s,7*s,.55*s,.6); sparks(pos,6,8*s,0xffffff,.3*s,.5); };
VFX.prismTrail=function(o){ o=o||{}; return [0xff2020,0x20ff20,0x2020ff].map(c=>VFX.trailGet('trace_06',Object.assign({},o,{tint:c}))); };
VFX.prismTrailPush=function(arr,p,k){ if(!arr) return; const r=camRight(_pb), w=(arr[0]&&arr[0].width||.3)*.35; arr.forEach((t,i)=>{ VFX.trailPush(t,p.clone().addScaledVector(r,(i-1)*w),k); }); };
VFX.prismTrailRelease=function(arr){ if(arr) arr.forEach(t=>VFX.trailRelease(t)); };
VFX.preload=function(){ ['big_hit','impact_white','star_explosion','explosion','charge','wispy_smoke_01','electric_ring','lightstreaks','wavy_blue','fire_01','flame_01','vortex','fire_point',
  'spark_01','spark_02','dirt_01','dirt_02','smoke_01','smoke_05','trace_01','trace_02','trace_03','trace_04','trace_05','trace_06','star_01','star_02','twirl_01','light_01','light_02','flare_01'].forEach(texOf); };
VFX.init=function(T,sc,cam){ THREE=T; THREE_=T; scene=sc; camera=cam; quad=new THREE.PlaneGeometry(1,1); loader=new THREE.TextureLoader(); VFX.ok=true; VFX.preload(); };
window.VFX=VFX;
})();
