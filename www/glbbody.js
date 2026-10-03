/* =========================================================================
   GLB BODIES
   Skinned GLB models (www/models.js, base64) that replace the box anatomy of buildCharacter(). The procedural
   animator (animateRig) keeps driving the original joint pivots; after every animateRig() call GLBBODY.apply()
   copies each pivot's rotation onto the matching bone of the GLB skeleton (retargeting), so walk / run / sprint /
   idle / jump / fly / punch / hit / death / roll all play on the real bodies with no extra animation data.

   How the retarget works: every mapped bone gets  worldRot = pivotWorldRot * A * bindWorldRot  where pivotWorldRot is
   the pivot's rotation accumulated from the rig root (all rig pivots start at identity = arms/legs hanging straight
   down), bindWorldRot is the bone's rotation in the GLB bind pose, and A is an optional one-off "relax" rotation that
   brings T-posed arms down beside the body. Bones that are not mapped (fingers, tails, jaw...) keep their bind-local
   rotation and simply follow their parent. If anything is missing the original box body is kept as a fallback.
========================================================================= */
const GLBBODY=(function(){
  const CFG={
    four_arms:{ face:Math.PI, map:{ hips:['hips'], chest:['spine'], head:['neck'],
        sL:['upperArmL'], eL:['foreArmL'], sR:['upperArmR'], eR:['foreArmR'],
        s2L:['upperArm2L'], e2L:['foreArm2L'], s2R:['upperArm2R'], e2R:['foreArm2R'],
        tL:['thighL'], kL:['shinL'], fL:['footL'], tR:['thighR'], kR:['shinR'], fR:['footR'] },
      down:{ upperArmL:['foreArmL',12], foreArmL:[null,12], upperArmR:['foreArmR',12], foreArmR:[null,12],
             upperArm2L:['foreArm2L',34], foreArm2L:[null,34], upperArm2R:['foreArm2R',34], foreArm2R:[null,34] } },
    heatblast:{ face:Math.PI/2, statics:{ Omnitrix:'bip_spine_2_04', fire01:'bip_head_07' }, map:{ hips:['bip_pelvis_01'], chest:['bip_spine_1_03'], head:['bip_neck_06'],
        sL:['bip_upperArm_L_029'], eL:['bip_lowerArm_L_030'], sR:['bip_upperArm_R_010'], eR:['bip_lowerArm_R_011'],
        tL:['bip_hip_L_052'], kL:['bip_knee_L_053'], fL:['bip_foot_L_054'], tR:['bip_hip_R_047'], kR:['bip_knee_R_048'], fR:['bip_foot_R_049'] },
      down:{ bip_upperArm_L_029:['bip_lowerArm_L_030',10], bip_lowerArm_L_030:['bip_hand_L_031',10],
             bip_upperArm_R_010:['bip_lowerArm_R_011',10], bip_lowerArm_R_011:['bip_hand_R_012',10] } },
    xlr8:{ face:Math.PI, plant:true, tailW:true, map:{ hips:['spine_01'], tail0:['tail(1)_045'], c1:['spine001_02'], c2:['spine002_03'], chest:['spine003_04'], head:['spine004_05'],
        sL:['upper_armL_010'], eL:['forearmL_011'], sR:['upper_armR_019'], eR:['forearmR_020'],
        tL:['thighL_035'], kL:['shinL_036'], fL:['footL_037'], tR:['thighR_040'], kR:['shinR_041'], fR:['footR_042'] },
      gain:{ head:.9 }, hMul:1.0, leanMul:.2,
      down:{}, tail:['tail(2)_046','tail(3)_047','tail(4)_048','tail(5)_049','tail(6)_050'] },
    echo_echo:{ face:Math.PI, map:{ hips:['Bone_00','Bone009_037','Bone012_041'], chest:['Bone043_01'], head:['Bone018_034','Bone019_035'],
        sL:['Bone006_018'], eL:['Bone007_019'], sR:['Bone002_03'], eR:['Bone003_04'],
        tL:['Bone013_042'], kL:['Bone014_043'], fL:['Bone016_044'], tR:['Bone010_038'], kR:['Bone011_039'], fR:['Bone015_040'] },
      down:{} },
    cannonbolt:{ curl:{ Chest_07:-1.0 }, face:Math.PI, map:{ hips:['Hips_01'], chest:['Spine_06'],
        sL:['Left_arm_029'], eL:['Left_elbow_030'], sR:['Right_arm_09'], eR:['Right_elbow_010'],
        tL:['Right_WideLeg_L_048'], kL:['Right_WideKnee_L_049'], fL:['Right_WideAnkle_L_050'],
        tR:['Right_WideLeg_R_02'], kR:['Right_WideKnee_R_03'], fR:['Right_WideAnkle_R_04'] },
      down:{ Left_arm_029:['Left_elbow_030',12], Left_elbow_030:['Left_wrist_Cannonbolt_031',12],
             Right_arm_09:['Right_elbow_010',12], Right_elbow_010:['Right_wrist_Cannonbolt_011',12] } }
  };
  const store={}, state={};          // store[kind] = parsed template; state[kind] = 'wait' | 'ok' | 'fail'
  const _qc=new THREE.Quaternion(), _qd=new THREE.Quaternion(), _qa=new THREE.Quaternion(), _qg=new THREE.Quaternion(), _q=new THREE.Quaternion(), _q2=new THREE.Quaternion(), _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _m=new THREE.Matrix4(), _s=new THREE.Vector3();

  function b64ToBuf(s){ const bin=atob(s), n=bin.length, u=new Uint8Array(n); for(let i=0;i<n;i++) u[i]=bin.charCodeAt(i); return u.buffer; }

  // true (skinned, bind-pose) bounds of a model: three.js only knows the unskinned geometry box
  function skinnedBounds(root){
    root.updateMatrixWorld(true);
    const bb=new THREE.Box3(), v=new THREE.Vector3();
    root.traverse(o=>{ if(!o.isSkinnedMesh) return; o.skeleton.update(); const pos=o.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i); o.boneTransform(i,v); v.applyMatrix4(o.matrixWorld); bb.expandByPoint(v); } });
    return bb;
  }

  function prep(kind,gltf){
    const C=CFG[kind], sc=gltf.scene;
    const bones={}; sc.traverse(o=>{ if(o.isBone) bones[o.name]=o; });
    const need=[]; for(const k in C.map) for(const n of C.map[k]) need.push(n);
    for(const n of need) if(!bones[n]) throw new Error('missing bone '+n);
    if(C.statics){   // unskinned props (head flame, Omnitrix) would stay behind: parent them to a bone, keeping their world transform
      sc.updateMatrixWorld(true); const free=[];
      sc.traverse(o=>{ if(o.isMesh&&!o.isSkinnedMesh){ let inBone=false; for(let p=o.parent;p;p=p.parent) if(p.isBone){ inBone=true; break; } if(!inBone) free.push(o); } });
      for(const o of free){ const mn=(o.material&&o.material.name)||''; for(const key in C.statics){ if(mn.indexOf(key)>=0&&bones[C.statics[key]]){ bones[C.statics[key]].attach(o); break; } } }
    }
    sc.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.castShadow=true; } });
    const bb=skinnedBounds(sc);
    const hb=bones[C.map.hips[0]]; hb.updateWorldMatrix(true,false); const hp=new THREE.Vector3().setFromMatrixPosition(hb.matrixWorld);
    store[kind]={ scene:sc, height:bb.max.y-bb.min.y, minY:bb.min.y, cx:hp.x, cz:hp.z };
  }

  function load(kind,buf){
    return new Promise(res=>{
      try{
        new THREE.GLTFLoader().parse(buf,'',g=>{ try{ prep(kind,g); state[kind]='ok'; }catch(e){ state[kind]='fail'; console.warn('GLB '+kind+': '+e.message); } res(); },
          e=>{ state[kind]='fail'; console.warn('GLB '+kind+' parse failed'); res(); });
      }catch(e){ state[kind]='fail'; res(); }
    });
  }
  async function init(){
    const D=window.__GLB_DATA||{};
    for(const kind in CFG){ if(!D[kind]){ state[kind]='fail'; continue; } state[kind]='wait';
      await new Promise(r=>setTimeout(r,0));
      try{ await load(kind,b64ToBuf(D[kind])); }catch(e){ state[kind]='fail'; }
      delete D[kind]; }                       // the base64 text is no longer needed once parsed
    try{ if(window.__glbReady) window.__glbReady(); }catch(e){}
  }

  // Attach a clone of the GLB body to a freshly built rig. Returns true on success (box body is then hidden).
  function attach(kind,parts,shellRoot){
    const C=CFG[kind], T=store[kind]; if(!C||!T||state[kind]!=='ok') return false;
    try{
      const g=parts.g, inst=THREE.SkeletonUtils.clone(T.scene);
      const k=(parts.dims.total-.12)/T.height*(C.hMul||1);
      const pivot=new THREE.Group(); pivot.rotation.y=C.face; pivot.scale.setScalar(k);
      const cs=Math.cos(C.face), sn=Math.sin(C.face);                       // rotate the hips (x,z) by the facing turn
      pivot.position.set(-(T.cx*cs+T.cz*sn)*k, -T.minY*k, -(-T.cx*sn+T.cz*cs)*k);
      pivot.add(inst);
      // per-instance materials (hit-flash must not leak between clones); Lambert to match the game's lighting
      const mats=new Map();
      inst.traverse(o=>{ if(!o.isMesh) return; o.castShadow=true; o.frustumCulled=false;
        const src=o.material; let m=mats.get(src);
        if(!m){ if(src.map) src.map.encoding=THREE.LinearEncoding;
          m=new THREE.MeshLambertMaterial({color:src.color.clone(),map:src.map||null,emissive:src.emissive?src.emissive.clone():new THREE.Color(0),emissiveMap:src.emissiveMap||null,
            side:src.side,transparent:src.transparent,opacity:src.opacity,alphaTest:src.alphaTest,skinning:!!o.isSkinnedMesh});
          if(src.emissiveMap) src.emissiveMap.encoding=THREE.LinearEncoding;
          if(kind==='xlr8'||kind==='cannonbolt') m.emissive.setHex(kind==='xlr8'?0x16293a:0x1a1608); // dark suits stay readable at night
          m.userData.baseEmis=m.emissive.getHex(); mats.set(src,m); parts.all.push(m); }
        if(kind==='echo_echo'&&o.isSkinnedMesh){ try{ paintEcho(o); m.vertexColors=true; m.color.set(0xffffff); m.map=null; m.needsUpdate=true; }catch(e){ console.warn('paintEcho',e); } }
        o.material=m; });
      pivot.updateMatrixWorld(true);
      // collect skeleton, bind data
      const bones=[], idx=new Map(), byName={};
      inst.traverse(o=>{ if(o.isBone){ idx.set(o,bones.length); bones.push(o); byName[o.name]=o; } });
      const n=bones.length, par=new Int16Array(n), qBind=[], pBind=[], qRel0=[], qParRel=[], sPar=new Float32Array(n);
      for(let i=0;i<n;i++){ const b=bones[i]; par[i]=b.parent&&idx.has(b.parent)?idx.get(b.parent):-1;
        qBind.push(b.quaternion.clone()); pBind.push(b.position.clone());
        b.matrixWorld.decompose(_v,_q,_s); qRel0.push(_q.clone());
        if(par[i]<0){ const pw=b.parent?b.parent.matrixWorld:new THREE.Matrix4(); pw.decompose(_v,_q,_s); qParRel.push(_q.clone()); sPar[i]=_s.x; }
        else { qParRel.push(null); bones[par[i]].matrixWorld.decompose(_v,_q,_s); sPar[i]=_s.x; } }
      // mapping: bone index -> {key, qb0}
      const ent=new Array(n).fill(null), world=p=>new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
      const keys=Object.keys(C.map);
      for(const key of keys) for(const nm of C.map[key]){ const b=byName[nm], i=idx.get(b); ent[i]={key,qb0:qRel0[i].clone(),hipsT:key==='hips'||key==='tail0'}; }
      // relax alignment: swing T-posed limbs down beside the body
      for(const nm in (C.down||{})){ const [childName,deg]=C.down[nm], b=byName[nm], i=idx.get(b); if(!ent[i]) continue;
        const p0=world(b); let d;
        if(childName){ d=world(byName[childName]).sub(p0); } else if(par[i]>=0){ d=p0.clone().sub(world(bones[par[i]])); } else continue;
        d.normalize(); const h=new THREE.Vector3(d.x,0,d.z); if(h.length()<.15) h.set(Math.sign(p0.x)||1,0,0); h.normalize();
        const phi=deg*Math.PI/180, t=h.multiplyScalar(Math.sin(phi)).add(new THREE.Vector3(0,-Math.cos(phi),0));
        const A=new THREE.Quaternion().setFromUnitVectors(d,t.normalize()); ent[i].qb0.premultiply(A); }
      const tail=(C.tail||[]).map(nm=>idx.get(byName[nm])).filter(i=>i!=null);
      const G={ kind, gain:C.gain||null, curl:C.curl||null, pivot, k, base:pivot.position.clone(), bones, par, qBind, pBind, qParRel, sPar, ent, tail, qw:bones.map(()=>new THREE.Quaternion()),
        t:{hips:new THREE.Quaternion(),chest:new THREE.Quaternion(),head:new THREE.Quaternion(),sL:new THREE.Quaternion(),eL:new THREE.Quaternion(),sR:new THREE.Quaternion(),eR:new THREE.Quaternion(),
           s2L:new THREE.Quaternion(),e2L:new THREE.Quaternion(),s2R:new THREE.Quaternion(),e2R:new THREE.Quaternion(),
           tL:new THREE.Quaternion(),kL:new THREE.Quaternion(),fL:new THREE.Quaternion(),tR:new THREE.Quaternion(),kR:new THREE.Quaternion(),fR:new THREE.Quaternion()}, clock:Math.random()*10 };
      for(const key of keys) if(!G.t[key]) G.t[key]=new THREE.Quaternion();
      G.qBindW=qRel0; G.ankL=C.map.fL?idx.get(byName[C.map.fL[0]]):-1; G.ankR=C.map.fR?idx.get(byName[C.map.fR[0]]):-1;
      G.plant=!!C.plant; G.plantY=0; G.tailW=!!C.tailW; G.tailRoot=C.tailW?idx.get(byName[C.map.tail0[0]]):-1;
      // success: only now hide the box anatomy (keeping the cannonbolt roll shell) and mount the GLB body
      g.traverse(o=>{ if(!o.isMesh) return; for(let p=o;p;p=p.parent){ if(p===shellRoot) return; if(p===g) break; } o.visible=false; });
      g.add(pivot); parts.glb=G; apply(parts,0);
      return true;
    }catch(e){ console.warn('GLB attach '+kind+': '+e.message); return false; }
  }

  // Copy the animator's pivot rotations onto the GLB bones. Call right after animateRig().
  function apply(parts,dt){
    const G=parts.glb; if(!G) return; const p=parts, t=G.t, gn=G.gain;
    const Q=(o,k)=>{ const gk=gn&&gn[k]; if(gk==null||gk===1) return o.quaternion; return _qg.identity().slerp(o.quaternion,gk); };
    t.hips.copy(Q(p.hips,'hips'));
    const cq=_qc.copy(Q(p.chest,'chest')); t.chest.copy(t.hips).multiply(cq);
    if(t.c1){ t.c1.copy(t.hips).multiply(_qd.identity().slerp(cq,.34)); t.c2.copy(t.hips).multiply(_qd.identity().slerp(cq,.67)); }   // spread the torso bend over the spine so the mesh curves
    if(t.tail0) t.tail0.setFromAxisAngle(_v.set(0,1,0),p.hips.rotation.y*.5);                                                          // tail root ignores body pitch
    t.head.copy(t.chest).multiply(p.neck.quaternion).multiply(Q(p.head,'head'));
    t.sL.copy(t.chest).multiply(Q(p.leftArm,'sL')); t.eL.copy(t.sL).multiply(Q(p.elbowL,'eL'));
    t.sR.copy(t.chest).multiply(Q(p.rightArm,'sR')); t.eR.copy(t.sR).multiply(Q(p.elbowR,'eR'));
    if(p.leftArm2){ t.s2L.copy(t.chest).multiply(Q(p.leftArm2,'s2L')); t.e2L.copy(t.s2L).multiply(Q(p.elbow2L,'e2L'));
      t.s2R.copy(t.chest).multiply(Q(p.rightArm2,'s2R')); t.e2R.copy(t.s2R).multiply(Q(p.elbow2R,'e2R')); }
    t.tL.copy(t.hips).multiply(Q(p.leftLeg,'tL')); t.kL.copy(t.tL).multiply(Q(p.kneeL,'kL')); t.fL.copy(t.kL).multiply(Q(p.footL,'fL'));
    t.tR.copy(t.hips).multiply(Q(p.rightLeg,'tR')); t.kR.copy(t.tR).multiply(Q(p.kneeR,'kR')); t.fR.copy(t.kR).multiply(Q(p.footR,'fR'));
    const dy=p.hips.position.y-p.hipY, dz=p.hips.position.z, dx=p.hips.position.x;
    const sw=(dt>0)?(G.clock+=dt):G.clock, spd=Math.min(1.6,(p.anim&&p.anim.spd||0)/4);
    const n=G.bones.length;
    for(let i=0;i<n;i++){
      const b=G.bones[i], pi=G.par[i], e=G.ent[i];
      const pq = pi>=0 ? G.qw[pi] : G.qParRel[i];
      if(e && t[e.key]){
        _q.copy(t[e.key]).multiply(e.qb0);                         // desired rotation relative to the rig root
        G.qw[i].copy(_q);
        b.quaternion.copy(_q2.copy(pq).invert().multiply(_q));
        b.position.copy(G.pBind[i]);
        if(e.hipsT && (dx||dy||dz)){ _v.set(dx,dy,dz).applyQuaternion(_q2.copy(pq).invert()).multiplyScalar(1/G.sPar[i]); b.position.add(_v); }
      } else {
        b.position.copy(G.pBind[i]);
        const cv=G.curl&&p.ballK>0?G.curl[b.name]:null;
        if(cv){ b.quaternion.copy(G.qBind[i]).multiply(_q2.setFromAxisAngle(_v.set(1,0,0),cv*p.ballK)); G.qw[i].copy(pq).multiply(b.quaternion); }
        else { b.quaternion.copy(G.qBind[i]); G.qw[i].copy(pq).multiply(G.qBind[i]); }
      }
    }
    // tails
    if(G.tail.length){
      const A=p.anim;
      if(G.tailW && A && A.wW!==undefined){   // XLR8: world-space horizontal wave, state driven (lazy S-curve -> snappy -> rigid with micro-noise)
        const amp=A.wW*.24+A.wR*.11+A.wS*.035, fr=A.wW*3.2+A.wR*15+A.wS*52, lag=A.wW*.75+A.wR*.5+A.wS*.2;
        G.tp=(G.tp||0)+(dt>0?dt*Math.min(fr,1.5/dt):0);
        let pw=G.qw[G.tailRoot];
        for(let j=0;j<G.tail.length;j++){ const i=G.tail[j];
          _qa.setFromAxisAngle(_v.set(0,1,0),Math.sin(G.tp-j*lag)*amp*(1+j*.35)).multiply(G.qBindW[i]);
          G.bones[i].quaternion.copy(_q2.copy(pw).invert().multiply(_qa)); pw=G.qw[i].copy(_qa); }
      } else { for(let j=0;j<G.tail.length;j++){ const i=G.tail[j], b=G.bones[i];
          _q2.setFromAxisAngle(_v.set(0,0,1),Math.sin(sw*(3+3*spd)-j*.7)*(.05+.07*spd)*(1+j*.3)); b.quaternion.multiply(_q2); } }
    }
    // ground lock: keep the lowest ankle at its rest height (Y=0) whatever the crouch / tilt, so the feet glide instead of sinking or floating
    if(G.plant){
      const A=p.anim, on=!!(A&&A.plantOn); G.pivot.updateMatrixWorld(true); _m.copy(p.g.matrixWorld).invert();
      const yl=_v.setFromMatrixPosition(G.bones[G.ankL].matrixWorld).applyMatrix4(_m).y, yr=_v.setFromMatrixPosition(G.bones[G.ankR].matrixWorld).applyMatrix4(_m).y, h=Math.min(yl,yr);
      if(G.H0===undefined) G.H0=h;
      else if(on) G.plantY+=(G.H0-h)*.8; else G.plantY-=G.plantY*Math.min(1,dt*8);
      G.pivot.position.y=G.base.y+G.plantY;
    }
  }

  // Echo Echo colouring: the source model is one flat white mesh. Paint it per vertex (bone region + facial position)
  // to match the cartoon design: white body, dark visor and eyes, steel-grey speaker ears and cuffs, black/green Omnitrix.
  const W4=(a,i,k)=>k===0?a.getX(i):k===1?a.getY(i):k===2?a.getZ(i):a.getW(i);
  function paintEcho(mesh){
    const g=mesh.geometry, pos=g.attributes.position, nor=g.attributes.normal, ji=g.attributes.skinIndex, jw=g.attributes.skinWeight, n=pos.count;
    const bones=mesh.skeleton.bones, par=bones.map(b=>bones.indexOf(b.parent));
    const anc=(j,names)=>{ for(let i=j;i>=0;i=par[i]) if(names.includes(bones[i].name)) return true; return false; };
    const depthFrom=(j,names)=>{ let d=0; for(let i=j;i>=0;i=par[i],d++) if(names.includes(bones[i].name)) return d; return -1; };
    const M=CFG.echo_echo.map, headN=M.head, armN=[...M.eL,...M.eR], legN=[...M.fL,...M.fR], chestN=M.chest;
    const col=new Float32Array(n*3), W=[.95,.96,.98], DARK=[.16,.19,.25], STEEL=[.42,.47,.55], BLACK=[.03,.03,.04], GREEN=[.2,.95,.35];
    // head bounds (for eye/visor bands)
    let y0=1e9,y1=-1e9; const isHead=new Uint8Array(n);
    for(let i=0;i<n;i++){ let best=0,bj=0; for(let k=0;k<4;k++){ if(W4(jw,i,k)>best){ best=W4(jw,i,k); bj=W4(ji,i,k); } }
      if(anc(bj,headN)){ isHead[i]=1; const y=pos.getY(i); if(y<y0)y0=y; if(y>y1)y1=y; } }
    for(let i=0;i<n;i++){ let best=0,bj=0; for(let k=0;k<4;k++){ if(W4(jw,i,k)>best){ best=W4(jw,i,k); bj=W4(ji,i,k); } }
      let c=W; const nz=nor.getZ(i), ny=nor.getY(i), v=(pos.getY(i)-y0)/Math.max(1e-6,y1-y0);
      if(isHead[i]){
        const front = ECHO_FRONT*nz>.35;
        if(front && v>.38 && v<.62) c = (v>.47&&v<.57)?BLACK:DARK;      // visor band with dark eye slit
        else if(front && v>.2 && v<.36) c=DARK;                         // mouth grille
        else if(Math.abs(nor.getX(i))>.82) c=STEEL;                     // speaker ears
      } else if(depthFrom(bj,armN)>=1 && depthFrom(bj,armN)<=99 && anc(bj,armN)){ const d=depthFrom(bj,armN); c = d>=1 && d<=2 ? STEEL : W; }
      else if(anc(bj,legN)) c=STEEL;
      else if(anc(bj,chestN)){ const x=pos.getX(i), yy=pos.getY(i); /* Omnitrix disc handled below */ }
      col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2]; }
    g.setAttribute('color',new THREE.BufferAttribute(col,3));
  }
  const ECHO_FRONT=1;

  // Cannonbolt curl: shrink the GLB body toward the hips as the shell grows
  function scaleBody(parts,s){
    const G=parts.glb; if(!G) return; s=Math.max(.001,s);
    G.pivot.scale.setScalar(G.k*s); G.pivot.visible=s>.02;
    G.pivot.position.set(G.base.x*s, G.base.y*s+parts.hipY*(1-s), G.base.z*s);
  }
  // true top of the model (portrait framing: Box3.setFromObject cannot measure skinned meshes)
  const PZ={four_arms:.68,heatblast:.68,xlr8:.92,echo_echo:.72,cannonbolt:1};
  function topOf(parts){ return parts.glb?(parts.dims.total-.12):null; }

  return { init, attach, apply, scaleBody, topOf, pz:k=>PZ[k]||.7, leanMul:k=>(CFG[k]&&CFG[k].leanMul!=null)?CFG[k].leanMul:1, ready:k=>state[k]==='ok', pending:k=>!!CFG[k]&&(state[k]==='wait'||state[k]===undefined), CFG };
})();
window.GLBBODY=GLBBODY;
try{GLBBODY.init();}catch(e){console.warn('GLB init',e);}
