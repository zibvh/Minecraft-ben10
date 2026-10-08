/* =========================================================================
   OMNIVERSE: ZERO  -  VFX ENGINE  (Brackeys CC0 pack: Picster / Kenney / Thomas Iche / CodeManu)
   Everything is pooled and shares textures, so it stays cheap on phones.
     sheet()     animated sprite-sheet billboard (predrawn + flipbooks), one clock per instance
     particle()  single-texture billboard sprite (sparks, dust, smoke, embers)
     streak()    quad stretched along a direction (laser beams, projectile trails)
     ribbon()    camera-facing trail sampled from recent positions (flight / run trails)
     presets     impact, explosion, dust, slam, ring, muzzle, sparks
   Paths are relative to www/ (assets live in www/vfx/).
========================================================================= */
const VFX=(function(){
  const BASE='vfx/';
  // name: [file, cols, rows, firstFrame, lastFrame]  (first/last = the frames that actually contain art; the sheets have blank cells)
  const SHEET={
    big_hit:['big_hit_6x5.png',6,5,1,10], impact_white:['impact_white_6x4.png',6,4,0,10], star_explosion:['star_explosion_6x5.png',6,5,1,23],
    charge:['charge_7x6.png',7,6,1,10], electric_ring:['electric_ring_6x5.png',6,5,0,29], lightstreaks:['lightstreaks_6x5.png',6,5,0,29],
    wavy_blue:['wavy_blue_6x5.png',6,5,0,29], wavy_purple:['wavy_purple_6x5.png',6,5,0,29], fire_point:['fire_point_6x5.png',6,5,0,29],
    explosion:['explosion_6x5.png',6,5,1,22], fire_ring:['fire_ring_6x5.png',6,5,0,29], vortex:['vortex_6x5.png',6,5,1,22],
    fire:['fire_01_8x8.png',8,8,0,63], smoke:['wispy_smoke_01_8x8.png',8,8,0,63], blast:['explosion_01_8x8.png',8,8,0,63]
  };
  const PART=['trace_01','trace_03','trace_04','trace_05','trace_06','spark_01','spark_04','star_01','star_04','flame_01','flame_02','flame_03','flame_04',
              'dirt_01','dirt_02','smoke_01','smoke_05','light_01','light_02','twirl_01','circle_02','muzzle_01','flare_01'];
  const MAX_SHEETS=44, MAX_PARTS=170;
  let scene=null, camera=null, root=null;
  const texCache={}, tmpV=new THREE.Vector3(), tmpV2=new THREE.Vector3(), tmpV3=new THREE.Vector3(), tmpQ=new THREE.Quaternion(), tmpM=new THREE.Matrix4();
  function tex(file){
    if(texCache[file]) return texCache[file];
    let t; try{ t=new THREE.TextureLoader().load(BASE+file,()=>{ t.userData.ready=true; }); }catch(e){ t=new THREE.Texture(); }
    t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    t.userData={ready:false}; texCache[file]=t; return t;
  }
  const ptex=n=>tex(n+'.png');
  function init(sc,cam){
    scene=sc; camera=cam; root=new THREE.Group(); root.name='vfx'; scene.add(root);
    for(const k in SHEET) tex(SHEET[k][0]);              // preload so the first hit is not blank
    PART.forEach(ptex);
  }
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const hex=c=>new THREE.Color(c);

  /* ---------------- sprite-sheet instances ---------------- */
  const sheetPool=[], sheets=[];
  function acquireSheet(){
    let o=sheetPool.pop();
    if(!o){ const geo=new THREE.PlaneGeometry(1,1), mat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide}), mesh=new THREE.Mesh(geo,mat);
      mesh.frustumCulled=false; mesh.renderOrder=30; o={mesh,mat,uv:geo.attributes.uv}; }
    return o;
  }
  function setFrame(o,sh,f){
    const C=sh[1], R=sh[2], c=f%C, r=(f/C)|0, a=o.uv.array, u0=c/C, u1=(c+1)/C, v1=1-r/R, v0=1-(r+1)/R;
    a[0]=u0; a[1]=v1; a[2]=u1; a[3]=v1; a[4]=u0; a[5]=v0; a[6]=u1; a[7]=v0; o.uv.needsUpdate=true;
  }
  function resolveFollow(f,out){
    if(!f) return null;
    if(typeof f==='function') return f(out)||null;
    if(f.isObject3D){ if(!f.parent) return null; return f.getWorldPosition(out); }
    return null;
  }
  /* sheet(name,pos,{size,dur,loop,add,color,grow,face,follow,delay,roll,from,to,opacity,offset,fadeOut}) -> handle {kill()} */
  function sheet(name,pos,op){
    const sh=SHEET[name]; if(!sh||!root) return null; op=op||{};
    if(sheets.length>=MAX_SHEETS && !op.force) return null;
    const t=tex(sh[0]); if(!t.userData.ready && !op.force) return null;
    const o=acquireSheet(), m=o.mat;
    m.map=t; m.blending=op.add===false?THREE.NormalBlending:THREE.AdditiveBlending; m.color.set(op.color!=null?op.color:0xffffff); m.opacity=0; m.needsUpdate=true;
    const f0=op.from!=null?op.from:sh[3], f1=op.to!=null?op.to:sh[4];
    const inst={o,sh,f0,f1,t:-(op.delay||0),dur:op.dur||.5,loop:!!op.loop,size:op.size||1,grow:op.grow||0,face:op.face||null,follow:op.follow||null,roll:op.roll||0,spin:op.spin||0,
      opacity:op.opacity!=null?op.opacity:1,fadeOut:op.fadeOut!=null?op.fadeOut:.3,offset:op.offset||0,stretch:op.stretch||1,dead:false,pos:pos?pos.clone():new THREE.Vector3(),hold:!!op.hold};
    o.mesh.position.copy(inst.pos); o.mesh.visible=false; setFrame(o,sh,f0); root.add(o.mesh); sheets.push(inst);
    inst.kill=()=>{ inst.dead=true; }; return inst;
  }
  function updateSheets(dt){
    for(let i=sheets.length-1;i>=0;i--){
      const s=sheets[i], o=s.o, mesh=o.mesh; s.t+=dt;
      if(s.t<0) continue;
      let p=s.t/s.dur;
      if(s.loop){ p=p%1; } else if(p>=1 && !s.hold) s.dead=true;
      if(s.follow){ const q=resolveFollow(s.follow,tmpV3); if(q) s.pos.copy(q); else s.dead=true; }
      if(s.dead){ if(s.killT==null) s.killT=0; s.killT+=dt; if(s.killT>.12 || s.t>=s.dur){ root.remove(mesh); sheetPool.push(o); sheets.splice(i,1); continue; } }
      const pc=Math.min(1,p), n=s.f1-s.f0, fr=s.f0+Math.min(n,Math.floor(pc*(n+1)));
      if(fr!==s.last){ s.last=fr; setFrame(o,s.sh,fr); }
      mesh.visible=true;
      mesh.position.copy(s.pos);
      if(s.face){ tmpV.copy(s.pos).add(s.face); mesh.lookAt(tmpV); }
      else { mesh.quaternion.copy(camera.quaternion); if(s.roll||s.spin){ s.roll+=s.spin*dt; mesh.rotateZ(s.roll); } if(s.offset){ tmpV.copy(camera.position).sub(s.pos).normalize(); mesh.position.addScaledVector(tmpV,s.offset); } }
      const sc=s.size*(1+s.grow*s.t); mesh.scale.set(sc*s.stretch,sc,1);
      let a=s.opacity; if(!s.loop && s.fadeOut>0){ const fo=1-s.fadeOut; if(pc>fo) a*=Math.max(0,(1-pc)/s.fadeOut); }
      if(s.dead) a*=Math.max(0,1-s.killT/.12);
      o.mat.opacity=Math.min(1,a*Math.min(1,s.t*30+.2));
    }
  }

  /* ---------------- single-texture particles ---------------- */
  const sprPool=[], parts=[];
  function particle(name,pos,op){
    if(!root||parts.length>=MAX_PARTS) return null; op=op||{};
    const t=ptex(name); if(!t.userData.ready) return null;
    let sp=sprPool.pop();
    if(!sp){ sp=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false,fog:false})); sp.frustumCulled=false; sp.renderOrder=28; }
    const m=sp.material; m.map=t; m.color.set(op.color!=null?op.color:0xffffff); m.blending=op.add===false?THREE.NormalBlending:THREE.AdditiveBlending; m.rotation=op.rot||0; m.opacity=0; m.needsUpdate=true;
    sp.position.copy(pos); sp.scale.setScalar(op.size||.5); root.add(sp);
    const P={sp,vel:op.vel?op.vel.clone():new THREE.Vector3(),life:op.life||.5,max:op.life||.5,size:op.size||.5,grow:op.grow||0,grav:op.grav||0,drag:op.drag||0,spin:op.spin||0,a:op.a!=null?op.a:1,fin:op.fadeIn||0,ground:op.ground!=null?op.ground:null,delay:op.delay||0,follow:op.follow||null};
    if(P.delay>0) sp.visible=false;
    parts.push(P); return P;
  }
  function updateParts(dt){
    for(let i=parts.length-1;i>=0;i--){
      const P=parts[i], sp=P.sp;
      if(P.delay>0){ P.delay-=dt; if(P.delay>0) continue; sp.visible=true; }
      P.life-=dt; if(P.life<=0){ root.remove(sp); sprPool.push(sp); parts.splice(i,1); continue; }
      if(P.follow){ const q=resolveFollow(P.follow,tmpV3); if(q) sp.position.copy(q); else P.life=0; }
      if(P.grav) P.vel.y+=P.grav*dt; if(P.drag){ P.vel.multiplyScalar(Math.max(0,1-P.drag*dt)); }
      if(!P.follow) sp.position.addScaledVector(P.vel,dt);
      if(P.ground!=null && sp.position.y<P.ground){ sp.position.y=P.ground; P.vel.set(P.vel.x*.4,0,P.vel.z*.4); }
      const k=1-P.life/P.max, sc=P.size*(1+P.grow*k); sp.scale.set(sc,sc,1); if(P.spin) sp.material.rotation+=P.spin*dt;
      const fi=P.fin>0?Math.min(1,k/P.fin):1; sp.material.opacity=Math.max(0,Math.min(1,fi*(1-k)*(1-k*.2)*P.a)); }
  }

  /* ---------------- streaks: a quad stretched along a direction (laser / projectile tail) ---------------- */
  const streakPool=[], streaks=[];
  /* streak(name,{pos|follow, dir|dirFn, len, width, color, add, life, fadeIn, opacity, behind}) */
  function streak(name,op){
    if(!root) return null; const t=ptex(name); if(!t.userData.ready) return null;
    let o=streakPool.pop();
    if(!o){ const m=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide}); o=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m); o.frustumCulled=false; o.renderOrder=29; }
    const m=o.material; m.map=t; m.color.set(op.color!=null?op.color:0xffffff); m.blending=op.add===false?THREE.NormalBlending:THREE.AdditiveBlending; m.opacity=0; m.needsUpdate=true;
    root.add(o);
    const S={o,pos:op.pos?op.pos.clone():new THREE.Vector3(),follow:op.follow||null,dir:op.dir?op.dir.clone().normalize():new THREE.Vector3(0,0,-1),dirFn:op.dirFn||null,len:op.len||2,width:op.width||.3,life:op.life||0,age:0,opacity:op.opacity!=null?op.opacity:1,fin:op.fadeIn||0,behind:op.behind!=null?op.behind:.5,lenFn:op.lenFn||null,widthFn:op.widthFn||null,alphaFn:op.alphaFn||null,dead:false};
    streaks.push(S); S.kill=()=>{ S.dead=true; }; return S;
  }
  function updateStreaks(dt){
    for(let i=streaks.length-1;i>=0;i--){
      const S=streaks[i]; S.age+=dt;
      if(S.follow){ const q=resolveFollow(S.follow,tmpV3); if(q) S.pos.copy(q); else S.dead=true; }
      if(S.life>0 && S.age>=S.life) S.dead=true;
      if(S.dead){ root.remove(S.o); streakPool.push(S.o); streaks.splice(i,1); continue; }
      if(S.dirFn){ const d=S.dirFn(tmpV2); if(d) S.dir.copy(d).normalize(); }
      const len=S.lenFn?S.lenFn(S.age):S.len, wid=S.widthFn?S.widthFn(S.age):S.width, o=S.o;
      tmpV.copy(camera.position).sub(S.pos); const right=tmpV2.copy(S.dir).cross(tmpV); if(right.lengthSq()<1e-6) right.set(1,0,0); right.normalize();
      const fwd=tmpV3.copy(right).cross(S.dir).normalize();
      tmpM.makeBasis(right,S.dir,fwd); o.quaternion.setFromRotationMatrix(tmpM);
      o.position.copy(S.pos).addScaledVector(S.dir,-len*(S.behind-.5)); o.scale.set(wid,len,1);
      let a=S.opacity; if(S.life>0){ const k=S.age/S.life; a*=Math.min(1,k/(S.fin||.001))*(1-k); } if(S.alphaFn) a*=S.alphaFn(S.age);
      o.material.opacity=Math.max(0,Math.min(1,a)); }
  }

  /* ---------------- ribbons: camera-facing trails sampled from recent positions ---------------- */
  const ribbons=[];
  /* ribbon({tex:'trace_01', n:40, add:true}) -> {push(x,y,z,minStep), update(width,alpha,[r,g,b]), clear(), idle(dt)} */
  function ribbon(op){
    op=op||{}; const n=op.n||40, geo=new THREE.BufferGeometry(), pos=new Float32Array(n*6), col=new Float32Array(n*6), uv=new Float32Array(n*4), idx=[];
    for(let i=0;i<n;i++){ uv[i*4]=0; uv[i*4+1]=i/(n-1); uv[i*4+2]=1; uv[i*4+3]=i/(n-1); }
    for(let i=0;i<n-1;i++){ const a=i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); }
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('color',new THREE.BufferAttribute(col,3)); geo.setAttribute('uv',new THREE.BufferAttribute(uv,2)); geo.setIndex(idx);
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:ptex(op.tex||'trace_01'),vertexColors:true,transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide,blending:op.add===false?THREE.NormalBlending:THREE.AdditiveBlending}));
    mesh.frustumCulled=false; mesh.visible=false; mesh.renderOrder=27; if(root) root.add(mesh);
    const R={mesh,n,pts:new Float32Array(n*3),cnt:0,last:new THREE.Vector3(1e9,0,0),idleT:0,pos,col,
      push(x,y,z,step){ this.idleT=0; if(this.cnt===0 || Math.hypot(x-this.last.x,y-this.last.y,z-this.last.z)>(step||.5)){ this.pts.copyWithin(3,0,(n-1)*3); this.pts[0]=x; this.pts[1]=y; this.pts[2]=z; this.cnt=Math.min(n,this.cnt+1); this.last.set(x,y,z); }
        else { this.pts[0]=x; this.pts[1]=y; this.pts[2]=z; } },
      update(width,alpha,c){
        const cnt=this.cnt; this.mesh.visible=cnt>1; if(cnt<2) return; c=c||[1,1,1];
        for(let i=0;i<n;i++){
          const j=Math.min(i,cnt-1), a=Math.min(j+1,cnt-1), b=Math.max(j-1,0);
          tmpV.set(this.pts[b*3]-this.pts[a*3],this.pts[b*3+1]-this.pts[a*3+1],this.pts[b*3+2]-this.pts[a*3+2]); if(tmpV.lengthSq()<1e-8) tmpV.set(0,0,1); tmpV.normalize();
          tmpV2.set(this.pts[j*3]-camera.position.x,this.pts[j*3+1]-camera.position.y,this.pts[j*3+2]-camera.position.z); tmpV2.cross(tmpV); if(tmpV2.lengthSq()<1e-8) tmpV2.set(1,0,0); tmpV2.normalize();
          const live=i<cnt?1:0, fall=Math.pow(Math.max(0,1-i/Math.max(6,cnt)),1.4), w=width*(.25+.75*fall)*live, o=i*6, f=fall*alpha*live;
          this.pos[o]=this.pts[j*3]+tmpV2.x*w; this.pos[o+1]=this.pts[j*3+1]+tmpV2.y*w; this.pos[o+2]=this.pts[j*3+2]+tmpV2.z*w;
          this.pos[o+3]=this.pts[j*3]-tmpV2.x*w; this.pos[o+4]=this.pts[j*3+1]-tmpV2.y*w; this.pos[o+5]=this.pts[j*3+2]-tmpV2.z*w;
          for(let v=0;v<2;v++){ this.col[o+v*3]=c[0]*f; this.col[o+v*3+1]=c[1]*f; this.col[o+v*3+2]=c[2]*f; } }
        this.mesh.geometry.attributes.position.needsUpdate=true; this.mesh.geometry.attributes.color.needsUpdate=true; },
      clear(){ this.cnt=0; this.last.set(1e9,0,0); this.mesh.visible=false; },
      // when the source stops, the tail collapses quickly (~0.15 s) instead of hanging in the air
      fade(dt,width,alpha,c){ this.idleT+=dt; if(this.cnt>0){ const drop=Math.ceil(this.cnt*Math.min(1,dt/.15)); this.cnt=Math.max(0,this.cnt-drop); if(this.cnt<2){ this.clear(); return; } this.update(width,alpha*Math.max(0,1-this.idleT/.2),c); } }
    };
    ribbons.push(R); return R;
  }

  /* ---------------- presets ---------------- */
  const WARM=[0xff7a1a,0xffb02e,0xffe27a], COOL=[0x8fe0ff,0xd8f8ff,0xffffff];
  function sparks(pos,n,col,speed,op){ op=op||{};
    for(let i=0;i<n;i++){ const a=Math.random()*6.283, e=Math.random()*1.2-.2, s=speed*rnd(.5,1.1);
      particle(op.tex||(Math.random()<.5?'spark_01':'star_01'),pos,{vel:new THREE.Vector3(Math.cos(a)*s,e*s*.8+1,Math.sin(a)*s),life:rnd(.25,.5),size:rnd(.18,.34)*(op.size||1),grow:-.4,grav:-9,drag:1.4,color:Array.isArray(col)?col[(Math.random()*col.length)|0]:col,rot:Math.random()*6.28}); } }
  /* impact: compact bright flash at the collision point (nudged toward the camera so the fist stays readable) + a few sparks */
  function impact(pos,op){ op=op||{}; const heavy=!!op.heavy, tint=op.tint!=null?op.tint:0xffffff, sc=(op.scale||1);
    tmpV.copy(camera.position).sub(pos).normalize();
    const p=pos.clone().addScaledVector(tmpV,.3);
    sheet(heavy?'big_hit':'impact_white',p,{size:(heavy?2.6:1.5)*sc,dur:heavy?.38:.28,color:tint,roll:rnd(0,6.28),fadeOut:.2});
    if(op.star) sheet('star_explosion',p,{size:2.2*sc,dur:.45,color:op.star,roll:rnd(0,6.28)});
    sparks(pos,heavy?5:3,op.sparkCol||tint,heavy?7:5,{size:sc}); }
  function explosion(pos,sc,tint){ sc=sc||1;
    sheet('explosion',pos,{size:3.4*sc,dur:.55,color:tint!=null?tint:0xffffff,roll:rnd(0,6.28),offset:.4,fadeOut:.25});
    sheet('smoke',pos.clone().add(new THREE.Vector3(0,.4*sc,0)),{size:2.6*sc,dur:1.2,add:false,color:0x4a4038,opacity:.55,delay:.18,grow:.5,roll:rnd(0,6.28),fadeOut:.5});
    sparks(pos,8,WARM,9*sc,{size:sc}); }
  function dust(pos,sc,dirV){ sc=sc||1;
    const n=Math.min(5,2+Math.round(sc*1.5));
    for(let i=0;i<n;i++){ const a=Math.random()*6.283, v=new THREE.Vector3(Math.cos(a)*1.4*sc,rnd(.6,1.4),Math.sin(a)*1.4*sc); if(dirV) v.addScaledVector(dirV,-2.5*sc);
      particle('smoke_01',pos,{vel:v,life:rnd(.5,.85),size:rnd(.8,1.3)*sc,grow:1.2,drag:2.2,add:false,color:0xb6a98e,a:.5,rot:Math.random()*6.28,spin:rnd(-1,1)}); }
    for(let i=0;i<Math.min(4,n);i++){ const a=Math.random()*6.283, s=rnd(2,4.5)*sc; particle(Math.random()<.5?'dirt_01':'dirt_02',pos,{vel:new THREE.Vector3(Math.cos(a)*s,rnd(2,4)*sc,Math.sin(a)*s),life:rnd(.4,.7),size:rnd(.5,.9)*sc,grav:-12,drag:.8,add:false,color:0x8d7a5c,a:.9,rot:Math.random()*6.28,spin:rnd(-3,3)}); } }
  /* slam: horizontal dust ring that expands along the ground (not upward) + bright hit at the centre */
  function slam(pos,radius,op){ op=op||{}; const r=Math.max(1,radius||2), n=Math.min(12,6+Math.round(r*2));
    for(let i=0;i<n;i++){ const a=i/n*6.283+rnd(-.15,.15), s=r*rnd(2.4,3.4); particle('smoke_01',pos,{vel:new THREE.Vector3(Math.cos(a)*s,rnd(.1,.5),Math.sin(a)*s),life:rnd(.45,.7),size:rnd(.7,1.1)*Math.min(1.6,r*.5),grow:1.1,drag:3.2,add:false,color:0xb0a488,a:.5,rot:Math.random()*6.28}); }
    for(let i=0;i<4;i++){ const a=Math.random()*6.283, s=rnd(3,6); particle(i%2?'dirt_01':'dirt_02',pos,{vel:new THREE.Vector3(Math.cos(a)*s,rnd(3,6),Math.sin(a)*s),life:rnd(.4,.7),size:rnd(.5,.8),grav:-14,add:false,color:0x8a785a,a:.9,rot:Math.random()*6.28,spin:rnd(-4,4)}); }
    if(op.hit!==false) impact(pos.clone().add(new THREE.Vector3(0,.4,0)),{heavy:true,tint:op.tint,scale:Math.min(1.5,.6+r*.25)}); }
  /* pressure ring facing a direction (sonic burst) */
  function ring(pos,dir,op){ op=op||{}; return sheet(op.sheet||'electric_ring',pos,{size:op.size||1.6,dur:op.dur||.5,grow:op.grow||2.4,face:dir,color:op.color!=null?op.color:0xcfefff,fadeOut:.55,roll:0}); }
  function muzzle(pos,dir,tint,sc){ sc=sc||1;
    sheet('fire_point',pos,{size:1.2*sc,dur:.2,color:tint!=null?tint:0xffffff,fadeOut:.4,roll:rnd(0,6.28)});
    particle('flare_01',pos,{life:.14,size:1.1*sc,grow:.8,color:tint!=null?tint:0xffffff,rot:rnd(0,6.28)}); }
  function landing(pos,speed,heavy){ const k=Math.min(2.2,Math.max(.4,(speed-5)/8)); dust(pos,k*(heavy?1.3:.9)); if(heavy&&speed>11) slam(pos,1.6+k,{hit:false}); }

  function update(dt){
    if(!root) return; dt=Math.min(dt,.05);
    updateSheets(dt); updateParts(dt); updateStreaks(dt);
  }
  function clearAll(){ for(let i=sheets.length-1;i>=0;i--) sheets[i].dead=true; for(const P of parts){ P.life=0; } for(const S of streaks) S.dead=true; }
  const G=f=>function(){ return root?f.apply(null,arguments):null; };
  return {init,update:G(update),tex,ptex,sheet:G(sheet),particle:G(particle),streak:G(streak),ribbon:function(o){ return root?ribbon(o):{push(){},update(){},clear(){},fade(){}}; },
          sparks:G(sparks),impact:G(impact),explosion:G(explosion),dust:G(dust),slam:G(slam),ring:G(ring),muzzle:G(muzzle),landing:G(landing),clearAll:G(clearAll),WARM,COOL,SHEET,
          get ready(){ return !!root; }};
})();
