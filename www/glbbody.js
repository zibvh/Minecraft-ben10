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
    xlr8:{ face:Math.PI, map:{ hips:['spine_01','tail(1)_045'], chest:['spine001_02'], head:['spine004_05'],
        sL:['upper_armL_010'], eL:['forearmL_011'], sR:['upper_armR_019'], eR:['forearmR_020'],
        tL:['thighL_035'], kL:['shinL_036'], fL:['footL_037'], tR:['thighR_040'], kR:['shinR_041'], fR:['footR_042'] },
      gain:{ chest:.4, head:.7, sL:.8, sR:.8, tL:.8, tR:.8, kL:.85, kR:.85 }, hMul:1.15, leanMul:.2,
      down:{}, tail:['tail(2)_046','tail(3)_047','tail(4)_048','tail(5)_049','tail(6)_050'] },
    echo_echo:{ face:Math.PI, map:{ hips:['Bone_00','Bone009_037','Bone012_041'], chest:['Bone043_01'], head:['Bone018_034','Bone019_035'],
        sL:['Bone006_018'], eL:['Bone007_019'], sR:['Bone002_03'], eR:['Bone003_04'],
        tL:['Bone013_042'], kL:['Bone014_043'], fL:['Bone016_044'], tR:['Bone010_038'], kR:['Bone011_039'], fR:['Bone015_040'] },
      down:{} },
    ben:{ syn:'ben', face:0, map:{ hips:['hips'], chest:['spine'], head:['neck'], sL:['upperArmL'], eL:['foreArmL'], sR:['upperArmR'], eR:['foreArmR'],
        tL:['thighL'], kL:['shinL'], fL:['footL'], tR:['thighR'], kR:['shinR'], fR:['footR'] },
      down:{ upperArmL:['foreArmL',5], foreArmL:[null,5], upperArmR:['foreArmR',5], foreArmR:[null,5] } },
    diamondhead:{ syn:'diamondhead', face:0, hMul:1.145, map:{ hips:['hips'], chest:['spine'], head:['neck'], sL:['upperArmL'], eL:['foreArmL'], sR:['upperArmR'], eR:['foreArmR'],
        tL:['thighL'], kL:['shinL'], fL:['footL'], tR:['thighR'], kR:['shinR'], fR:['footR'] }, down:{} },
    cannonbolt:{ curl:{ Chest_07:-1.0 }, face:Math.PI, map:{ hips:['Hips_01'], chest:['Spine_06'],
        sL:['Left_arm_029'], eL:['Left_elbow_030'], sR:['Right_arm_09'], eR:['Right_elbow_010'],
        tL:['Right_WideLeg_L_048'], kL:['Right_WideKnee_L_049'], fL:['Right_WideAnkle_L_050'],
        tR:['Right_WideLeg_R_02'], kR:['Right_WideKnee_R_03'], fR:['Right_WideAnkle_R_04'] },
      down:{ Left_arm_029:['Left_elbow_030',12], Left_elbow_030:['Left_wrist_Cannonbolt_031',12],
             Right_arm_09:['Right_elbow_010',12], Right_elbow_010:['Right_wrist_Cannonbolt_011',12] } },
    jetray:{ syn:'jetray', face:0, minY:0, map:{ hips:['hips'], chest:['spine'], head:['neck'], sL:['upperArmL'], eL:['foreArmL'], sR:['upperArmR'], eR:['foreArmR'],
        tL:['thighL'], kL:['shinL'], fL:['footL'], tR:['thighR'], kR:['shinR'], fR:['footR'] },
      down:{ upperArmL:['foreArmL',34], foreArmL:[null,34], upperArmR:['foreArmR',34], foreArmR:[null,34] } },
    chromastone:{ syn:'chromastone', face:0, map:{ hips:['hips'], chest:['spine'], head:['neck'], sL:['upperArmL'], eL:['foreArmL'], sR:['upperArmR'], eR:['foreArmR'],
        tL:['thighL'], kL:['shinL'], fL:['footL'], tR:['thighR'], kR:['shinR'], fR:['footR'] },
      down:{ upperArmL:['foreArmL',8], foreArmL:[null,8], upperArmR:['foreArmR',8], foreArmR:[null,8] } },
    wildvine:{ syn:'wildvine', face:0, map:{ hips:['hips'], chest:['spine'], head:['neck'], sL:['upperArmL'], eL:['foreArmL'], sR:['upperArmR'], eR:['foreArmR'],
        fl_t:['thighFL'], fl_k:['shinFL'], fl_f:['footFL'], fr_t:['thighFR'], fr_k:['shinFR'], fr_f:['footFR'],
        bl_t:['thighBL'], bl_k:['shinBL'], bl_f:['footBL'], br_t:['thighBR'], br_k:['shinBR'], br_f:['footBR'] },
      extra:['fl_t','fl_k','fl_f','fr_t','fr_k','fr_f','bl_t','bl_k','bl_f','br_t','br_k','br_f'], tail:['leafL','leafR'],
      down:{ upperArmL:['foreArmL',28], foreArmL:[null,28], upperArmR:['foreArmR',28], foreArmR:[null,28] } }
  };
  const store={}, state={};          // store[kind] = parsed template; state[kind] = 'wait' | 'ok' | 'fail'
  const _qg=new THREE.Quaternion(), _q=new THREE.Quaternion(), _q2=new THREE.Quaternion(), _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _m=new THREE.Matrix4(), _s=new THREE.Vector3();

  function b64ToBuf(s){ const bin=atob(s), n=bin.length, u=new Uint8Array(n); for(let i=0;i<n;i++) u[i]=bin.charCodeAt(i); return u.buffer; }

  // true (skinned, bind-pose) bounds of a model: three.js only knows the unskinned geometry box
  function skinnedBounds(root){
    root.updateMatrixWorld(true);
    const bb=new THREE.Box3(), v=new THREE.Vector3();
    root.traverse(o=>{ if(!o.isSkinnedMesh) return; o.skeleton.update(); const pos=o.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i); o.boneTransform(i,v); v.applyMatrix4(o.matrixWorld); bb.expandByPoint(v); } });
    return bb;
  }


  // ---- Ben & Diamondhead ship as UNSKINNED models (Ben: one T-posed mesh, Diamondhead: 12 separate crystal pieces).
  // synth() bakes them into the rig frame (-Z forward, +X = character's right), builds a real skeleton at the joints and
  // generates skin weights (hard region split + weight diffusion over the mesh), so they retarget like every other alien.
  const BONES=['hips','spine','neck','thighL','shinL','footL','thighR','shinR','footR','upperArmL','foreArmL','upperArmR','foreArmR'];
  const SYN={
    ben:{ xf:(x,y,z)=>[-z,y,x], iter:9,
      joint:{ hips:[0,-.42,0], spine:[0,-.12,0], neck:[0,.5,0], upperArmL:[-.23,.33,0], foreArmL:[-.74,.31,0], upperArmR:[.23,.33,0], foreArmR:[.74,.31,0],
              thighL:[-.13,-.45,0], shinL:[-.13,-.8,0], footL:[-.13,-1.03,0], thighR:[.13,-.45,0], shinR:[.13,-.8,0], footR:[.13,-1.03,0] },
      par:{ spine:'hips', neck:'spine', upperArmL:'spine', upperArmR:'spine', foreArmL:'upperArmL', foreArmR:'upperArmR', thighL:'hips', thighR:'hips', shinL:'thighL', shinR:'thighR', footL:'shinL', footR:'shinR' },
      mesh:(n)=>n==='Object_2'?null:'neck',                                   // eyes / mouth / hair meshes belong to the head
      seg:(x,y,z)=>{ const ax=Math.abs(x), S=x<0?'L':'R';
        if(y>.52) return 'neck';
        if(ax>.25&&y>-.12) return ax<.74?'upperArm'+S:'foreArm'+S;
        if(y<-.45&&ax>.0){ return y<-1.03?'foot'+S:y<-.8?'shin'+S:'thigh'+S; }
        return y>-.1?'spine':'hips'; } },
    diamondhead:{ xf:(x,y,z)=>[-(x-.54),y,-(z+6.4)], iter:2,
      joint:{ hips:[0,5.6,0], spine:[0,6.4,0], neck:[0,10,0], upperArmL:[-2.65,9.6,0], foreArmL:[-2.65,7.3,0], upperArmR:[2.65,9.6,0], foreArmR:[2.65,7.3,0],
              thighL:[-1.15,5.4,0], shinL:[-1.15,3.7,0], footL:[-1.15,1,0], thighR:[1.15,5.4,0], shinR:[1.15,3.7,0], footR:[1.15,1,0] },
      par:{ spine:'hips', neck:'spine', upperArmL:'spine', upperArmR:'spine', foreArmL:'upperArmL', foreArmR:'upperArmR', thighL:'hips', thighR:'hips', shinL:'thighL', shinR:'thighR', footL:'shinL', footR:'shinR' },
      mesh:(n)=>{ const m=/^polySurface(\d+)_/.exec(n), id=m?+m[1]:0;
        const T={9:'upperArmL',10:'foreArmL',8:'foreArmL',4:'spine',12:'upperArmR',11:'foreArmR',16:'foreArmR',15:'spine',6:'neck'};
        if(!m) return 'spine'; return T[id]||null; },                         // pCylinder (Omnitrix) -> chest; 5 / 14 = suit halves incl. a leg: split by height below
      seg:(x,y,z,nm)=>{ const S=/polySurface5_/.test(nm)?'L':'R'; if(y>6.6) return 'spine'; if(y>5.6) return 'hips'; return y<1.0?'foot'+S:y<3.5?'shin'+S:'thigh'+S; } },
    jetray:{ xf:(x,y,z)=>[-x,y,-z], iter:6,
      joint:{ hips:[0,.78,-.1], spine:[0,.98,-.1], neck:[0,1.42,-.1], upperArmL:[-.34,1.3,-.1], foreArmL:[-.72,.97,-.1], upperArmR:[.34,1.3,-.1], foreArmR:[.72,.97,-.1],
              thighL:[-.14,.74,-.1], shinL:[-.27,.42,-.12], footL:[-.32,.1,-.15], thighR:[.14,.74,-.1], shinR:[.27,.42,-.12], footR:[.32,.1,-.15] },
      par:{ spine:'hips', neck:'spine', upperArmL:'spine', upperArmR:'spine', foreArmL:'upperArmL', foreArmR:'upperArmR', thighL:'hips', thighR:'hips', shinL:'thighL', shinR:'thighR', footL:'shinL', footR:'shinR' },
      mesh:()=>null,
      seg:(x,y,z)=>{ const ax=Math.abs(x), S=x<0?'L':'R';
        if(y>1.42) return 'neck';
        if(ax>.5||(ax>.34&&y>.7)) return ax<.72?'upperArm'+S:'foreArm'+S;
        if(y<.7&&ax>.08) return y>.42?'thigh'+S:y>.1?'shin'+S:'foot'+S;
        if(y<.7) return 'hips';
        return y>.98?'spine':'hips'; } },
    chromastone:{ xf:(x,y,z)=>[-100*x,100*y,-100*z], iter:4,
      joint:{ hips:[0,1.28,0], spine:[0,1.5,0], neck:[0,1.98,0], upperArmL:[-.36,1.88,0], foreArmL:[-.85,1.88,0], upperArmR:[.36,1.88,0], foreArmR:[.85,1.88,0],
              thighL:[-.17,1.25,0], shinL:[-.17,.72,0], footL:[-.17,.08,0], thighR:[.17,1.25,0], shinR:[.17,.72,0], footR:[.17,.08,0] },
      par:{ spine:'hips', neck:'spine', upperArmL:'spine', upperArmR:'spine', foreArmL:'upperArmL', foreArmR:'upperArmR', thighL:'hips', thighR:'hips', shinL:'thighL', shinR:'thighR', footL:'shinL', footR:'shinR' },
      mesh:()=>null,
      seg:(x,y,z)=>{ const ax=Math.abs(x), S=x<0?'L':'R';
        if(y>1.97) return 'neck';
        if(ax>.3&&y>1.6) return ax<.85?'upperArm'+S:'foreArm'+S;
        if(y<1.28) return y>.72?'thigh'+S:y>.1?'shin'+S:'foot'+S;
        return y>1.5?'spine':'hips'; } },
    wildvine:{ xf:(x,y,z)=>[-.006*x,.006*y,-.006*z], iter:6,
      bones:['hips','spine','neck','upperArmL','foreArmL','upperArmR','foreArmR','leafL','leafR','thighFL','shinFL','footFL','thighFR','shinFR','footFR','thighBL','shinBL','footBL','thighBR','shinBR','footBR'],
      joint:{ hips:[0,1.05,0], spine:[0,1.45,0], neck:[0,1.78,0], upperArmL:[-.28,1.74,0], foreArmL:[-.8,1.74,0], upperArmR:[.28,1.74,0], foreArmR:[.8,1.74,0], leafL:[-.15,1.9,0], leafR:[.15,1.9,0],
              thighFL:[-.06,1,-.06], shinFL:[-.76,.62,-.6], footFL:[-.78,.1,-.62], thighFR:[.06,1,-.06], shinFR:[.76,.62,-.6], footFR:[.78,.1,-.62],
              thighBL:[-.06,1,.06], shinBL:[-.76,.62,.6], footBL:[-.78,.1,.62], thighBR:[.06,1,.06], shinBR:[.76,.62,.6], footBR:[.78,.1,.62] },
      par:{ spine:'hips', neck:'spine', upperArmL:'spine', upperArmR:'spine', foreArmL:'upperArmL', foreArmR:'upperArmR', leafL:'spine', leafR:'spine',
            thighFL:'hips', shinFL:'thighFL', footFL:'shinFL', thighFR:'hips', shinFR:'thighFR', footFR:'shinFR', thighBL:'hips', shinBL:'thighBL', footBL:'shinBL', thighBR:'hips', shinBR:'thighBR', footBR:'shinBR' },
      mesh:()=>null,
      seg:(x,y,z)=>{ const ax=Math.abs(x), S=x<0?'L':'R';
        if(y<1.05){ const q=(z<0?'F':'B')+S; return y>.64?'thigh'+q:y>.14?'shin'+q:'foot'+q; }
        if(y>1.85&&ax>.2) return 'leaf'+S;
        if(ax>.3&&y>1.4&&y<1.95) return ax<.78?'upperArm'+S:'foreArm'+S;
        if(y>1.8) return 'neck';
        return y>1.45?'spine':'hips'; } }
  };
  function synth(kind,gltf){
    const Z=SYN[kind], BL=Z.bones||BONES, src=gltf.scene; src.updateMatrixWorld(true);
    const bones={}, list=[]; const root=new THREE.Group();
    for(const n of BL){ const b=new THREE.Bone(); b.name=n; bones[n]=b; list.push(b); }
    for(const n of BL){ const p=Z.par[n], j=Z.joint[n]; if(p){ const pj=Z.joint[p]; bones[n].position.set(j[0]-pj[0],j[1]-pj[1],j[2]-pj[2]); bones[p].add(bones[n]); } else { bones[n].position.set(j[0],j[1],j[2]); root.add(bones[n]); } }
    root.updateMatrixWorld(true);
    const skel=new THREE.Skeleton(list), BI={}; BL.forEach((n,i)=>BI[n]=i);
    const meshes=[]; src.traverse(o=>{ if(o.isMesh) meshes.push(o); });
    for(const m of meshes){
      const g=m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
      const pos=g.attributes.position, n=pos.count, V=new THREE.Vector3();
      for(let i=0;i<n;i++){ V.fromBufferAttribute(pos,i); const r=Z.xf(V.x,V.y,V.z); pos.setXYZ(i,r[0],r[1],r[2]); }
      if(g.attributes.normal){ const nm=g.attributes.normal; for(let i=0;i<n;i++){ V.fromBufferAttribute(nm,i); const r=Z.xf(V.x,V.y,V.z); nm.setXYZ(i,r[0],r[1],r[2]); } }
      // mirrored transform (det<0) flips triangle winding -> restore it
      const det=(()=>{ const a=Z.xf(1,0,0),b=Z.xf(0,1,0),c=Z.xf(0,0,1),a0=Z.xf(0,0,0); const e=[[a[0]-a0[0],a[1]-a0[1],a[2]-a0[2]],[b[0]-a0[0],b[1]-a0[1],b[2]-a0[2]],[c[0]-a0[0],c[1]-a0[1],c[2]-a0[2]]];
        return e[0][0]*(e[1][1]*e[2][2]-e[1][2]*e[2][1])-e[0][1]*(e[1][0]*e[2][2]-e[1][2]*e[2][0])+e[0][2]*(e[1][0]*e[2][1]-e[1][1]*e[2][0]); })();
      if(det<0&&g.index){ const ix=g.index; for(let i=0;i<ix.count;i+=3){ const a=ix.getX(i+1); ix.setX(i+1,ix.getX(i+2)); ix.setX(i+2,a); } }
      // initial hard weights
      const whole=Z.mesh(m.name), B=BL.length, W=new Float32Array(n*B);
      for(let i=0;i<n;i++){ const bn=whole||Z.seg(pos.getX(i),pos.getY(i),pos.getZ(i),m.name); W[i*B+BI[bn]]=1; }
      if(!whole){   // diffuse weights across welded neighbours so joints bend smoothly
        const key=new Map(), wid=new Int32Array(n); let nw=0;
        for(let i=0;i<n;i++){ const k=Math.round(pos.getX(i)*500)+','+Math.round(pos.getY(i)*500)+','+Math.round(pos.getZ(i)*500); let id=key.get(k); if(id==null){ id=nw++; key.set(k,id); } wid[i]=id; }
        const nb=Array.from({length:nw},()=>new Set()), ix=g.index;
        for(let t=0;t<ix.count;t+=3){ const a=wid[ix.getX(t)],b=wid[ix.getX(t+1)],c=wid[ix.getX(t+2)]; nb[a].add(b);nb[a].add(c);nb[b].add(a);nb[b].add(c);nb[c].add(a);nb[c].add(b); }
        const nbA=nb.map(s=>Array.from(s));
        let cur=new Float32Array(nw*B); for(let i=0;i<n;i++) for(let k=0;k<B;k++) cur[wid[i]*B+k]=W[i*B+k];
        for(let it=0;it<Z.iter;it++){ const nx=new Float32Array(nw*B);
          for(let v=0;v<nw;v++){ const L=nbA[v]; if(!L.length){ for(let k=0;k<B;k++) nx[v*B+k]=cur[v*B+k]; continue; }
            for(let k=0;k<B;k++){ let s=0; for(let q=0;q<L.length;q++) s+=cur[L[q]*B+k]; nx[v*B+k]=.5*cur[v*B+k]+.5*s/L.length; } }
          cur=nx; }
        for(let i=0;i<n;i++) for(let k=0;k<B;k++) W[i*B+k]=cur[wid[i]*B+k];
      }
      const si=new Uint16Array(n*4), sw=new Float32Array(n*4);
      for(let i=0;i<n;i++){ const top=[]; for(let k=0;k<B;k++){ const w=W[i*B+k]; if(w>.001) top.push([w,k]); } top.sort((a,b)=>b[0]-a[0]); let tot=0; for(let q=0;q<4&&q<top.length;q++) tot+=top[q][0];
        for(let q=0;q<4;q++){ if(q<top.length){ si[i*4+q]=top[q][1]; sw[i*4+q]=top[q][0]/tot; } } }
      g.setAttribute('skinIndex',new THREE.BufferAttribute(si,4)); g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));
      const mat=m.material.clone(); mat.skinning=true;
      const sm=new THREE.SkinnedMesh(g,mat); sm.name=m.name; sm.frustumCulled=false; root.add(sm); meshes[meshes.indexOf(m)]=sm;
    }
    root.updateMatrixWorld(true);
    root.traverse(o=>{ if(o.isSkinnedMesh) o.bind(skel,new THREE.Matrix4()); });
    gltf.scene=root;
  }

  function prep(kind,gltf){
    const C=CFG[kind]; if(C.syn) synth(kind,gltf); const sc=gltf.scene;
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
    const my=(C.minY!=null)?C.minY:bb.min.y; store[kind]={ scene:sc, height:bb.max.y-my, minY:my, cx:hp.x, cz:hp.z };
  }

  function load(kind,buf){
    return new Promise(res=>{
      try{
        new THREE.GLTFLoader().parse(buf,'',g=>{ try{ prep(kind,g); state[kind]='ok'; }catch(e){ state[kind]='fail'; console.warn('GLB '+kind+': '+e.message); } res(); },
          e=>{ state[kind]='fail'; console.warn('GLB '+kind+' parse failed'); res(); });
      }catch(e){ state[kind]='fail'; res(); }
    });
  }
  // Cannonbolt's ready-made ball model (separate GLB): shown while rolling
  let BALL=null;
  async function loadBall(D){
    if(!D.cannonbolt_ball) return;
    await new Promise(res=>{ try{ new THREE.GLTFLoader().parse(b64ToBuf(D.cannonbolt_ball),'',g=>{
      try{ const sc=g.scene; sc.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(sc), sz=bb.getSize(new THREE.Vector3()), c=bb.getCenter(new THREE.Vector3());
        BALL={scene:sc,dia:Math.max(sz.x,sz.y,sz.z),c}; }catch(e){ console.warn('ball',e); } res(); },()=>res()); }catch(e){ res(); } });
    delete D.cannonbolt_ball;
  }
  function attachBall(parts){
    if(!BALL||parts.ball) return;
    const inst=BALL.scene.clone(true), grp=new THREE.Group(), spin=new THREE.Group();
    const wrap=new THREE.Group(); wrap.add(inst); inst.position.sub(BALL.c); // centre the model on the pivot
    const mats=new Map();
    inst.traverse(o=>{ if(!o.isMesh) return; o.frustumCulled=false; o.castShadow=true; const src=o.material; let m=mats.get(src);
      if(!m){ if(src.map) src.map.encoding=THREE.LinearEncoding; m=new THREE.MeshLambertMaterial({color:src.color.clone(),map:src.map||null,side:src.side,transparent:src.transparent,opacity:src.opacity,alphaTest:src.alphaTest,emissive:new THREE.Color(0x1a1608)});
        m.userData.baseEmis=m.emissive.getHex(); mats.set(src,m); parts.all.push(m); } o.material=m; });
    const r=parts.dims.total*.25, k=2*r/BALL.dia; wrap.scale.setScalar(k);
    spin.add(wrap); grp.add(spin); grp.position.y=r; grp.visible=false; parts.g.add(grp); parts.ball={grp,spin,r};
  }
  // curl 0..1: swap the body for the ball once fully curled; spin = roll angle about X
  function setBall(parts,show,spin){
    if(!parts.ball) return false;
    parts.ball.grp.visible=show; parts.ball.spin.rotation.x=spin||0;
    if(parts.glb) parts.glb.pivot.visible=!show && parts.glb.pivot.visible;
    return true;
  }
  async function init(){
    const D=window.__GLB_DATA||{};
    try{ await loadBall(D); }catch(e){}
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
      for(const key of keys) for(const nm of C.map[key]){ const b=byName[nm], i=idx.get(b); ent[i]={key,qb0:qRel0[i].clone(),hipsT:key==='hips'}; }
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
      if(C.extra) C.extra.forEach(k=>{ G.t[k]=new THREE.Quaternion(); });
      // success: only now hide the box anatomy (keeping the cannonbolt roll shell) and mount the GLB body
      g.traverse(o=>{ if(!o.isMesh) return; for(let p=o;p;p=p.parent){ if(p===shellRoot) return; if(p===g) break; } o.visible=false; });
      g.add(pivot); parts.glb=G; apply(parts,0); if(kind==='cannonbolt') attachBall(parts);
      return true;
    }catch(e){ console.warn('GLB attach '+kind+': '+e.message); return false; }
  }


  // Wildvine walks on FOUR tentacle legs set in an X. The rig has two legs, so each diagonal pair (front-left + back-right, front-right + back-left)
  // copies one rig leg: the stride becomes a sweep of the strut around the vertical axis, the knee flex lifts and tucks it.
  const WVL={ fl:{sx:-1,sz:-1,L:1}, br:{sx:1,sz:1,L:1}, fr:{sx:1,sz:-1,L:0}, bl:{sx:-1,sz:1,L:0} };
  const _a1=new THREE.Quaternion(), _a2=new THREE.Quaternion(), _a3=new THREE.Quaternion(), _ax=new THREE.Vector3(), _ay=new THREE.Vector3(0,1,0);
  function wvLegs(p,t,sw,sp){
    let ph=0;
    for(const k in WVL){ const w=WVL[k], Lg=w.L?p.leftLeg:p.rightLeg, Kn=w.L?p.kneeL:p.kneeR, Ft=w.L?p.footL:p.footR;
      const th=Lg.rotation.x, fl=Math.max(0,-Kn.rotation.x), ft=Ft.rotation.x, hl=Math.hypot(w.sx,w.sz);
      _ax.set(w.sz/hl,0,-w.sx/hl);                                         // lift axis: horizontal, perpendicular to the strut
      _a1.setFromAxisAngle(_ay,w.sx*th*1.15);                                // sweep forward / back
      _a2.setFromAxisAngle(_ax,-(fl*.55+Math.max(0,th)*.18+.5*sp));                // raise the strut as the knee folds
      t[k+'_t'].copy(t.hips).multiply(_a1).multiply(_a2);
      const rip=Math.sin(sw*7+ph)*.1; ph+=1.6;
      _a3.setFromAxisAngle(_ax,-(fl*.9)+rip); t[k+'_k'].copy(t[k+'_t']).multiply(_a3);
      _a3.setFromAxisAngle(_ax,ft*.5+fl*.3-rip*1.4); t[k+'_f'].copy(t[k+'_k']).multiply(_a3);
    }
  }
  // Copy the animator's pivot rotations onto the GLB bones. Call right after animateRig().
  function apply(parts,dt){
    const G=parts.glb; if(!G) return; const p=parts, t=G.t, gn=G.gain;
    const Q=(o,k)=>{ const gk=gn&&gn[k]; if(gk==null||gk===1) return o.quaternion; return _qg.identity().slerp(o.quaternion,gk); };
    t.hips.copy(Q(p.hips,'hips'));
    t.chest.copy(t.hips).multiply(Q(p.chest,'chest'));
    t.head.copy(t.chest).multiply(p.neck.quaternion).multiply(Q(p.head,'head'));
    t.sL.copy(t.chest).multiply(Q(p.leftArm,'sL')); t.eL.copy(t.sL).multiply(Q(p.elbowL,'eL'));
    t.sR.copy(t.chest).multiply(Q(p.rightArm,'sR')); t.eR.copy(t.sR).multiply(Q(p.elbowR,'eR'));
    if(p.leftArm2){ t.s2L.copy(t.chest).multiply(Q(p.leftArm2,'s2L')); t.e2L.copy(t.s2L).multiply(Q(p.elbow2L,'e2L'));
      t.s2R.copy(t.chest).multiply(Q(p.rightArm2,'s2R')); t.e2R.copy(t.s2R).multiply(Q(p.elbow2R,'e2R')); }
    t.tL.copy(t.hips).multiply(Q(p.leftLeg,'tL')); t.kL.copy(t.tL).multiply(Q(p.kneeL,'kL')); t.fL.copy(t.kL).multiply(Q(p.footL,'fL'));
    t.tR.copy(t.hips).multiply(Q(p.rightLeg,'tR')); t.kR.copy(t.tR).multiply(Q(p.kneeR,'kR')); t.fR.copy(t.kR).multiply(Q(p.footR,'fR'));
    const dy=p.hips.position.y-p.hipY, dz=p.hips.position.z, dx=p.hips.position.x;
    const sw=(dt>0)?(G.clock+=dt):G.clock, spd=Math.min(1.6,(p.anim&&p.anim.spd||0)/4);
    if(G.kind==='wildvine') wvLegs(p,t,sw,Math.min(1,spd*1.5));
    const n=G.bones.length, vs=p.vStretch;
    if(!G.stSide){ G.stSide=new Int8Array(n).fill(-1); for(let i=0;i<n;i++){ const e=G.ent[i], pe=G.par[i]>=0?G.ent[G.par[i]]:null;
        if(e&&(e.key==='eL'||e.key==='eR')) G.stSide[i]=e.key==='eL'?0:1; else if(pe&&(pe.key==='eL'||pe.key==='eR')&&!e) G.stSide[i]=pe.key==='eL'?0:1; } }
    for(let i=0;i<n;i++){
      const b=G.bones[i], pi=G.par[i], e=G.ent[i];
      const pq = pi>=0 ? G.qw[pi] : G.qParRel[i];
      if(e && t[e.key]){
        _q.copy(t[e.key]).multiply(e.qb0);                         // desired rotation relative to the rig root
        G.qw[i].copy(_q);
        b.quaternion.copy(_q2.copy(pq).invert().multiply(_q));
        b.position.copy(G.pBind[i]); if(vs&&G.stSide[i]>=0&&vs[G.stSide[i]]) b.position.multiplyScalar(1+vs[G.stSide[i]]);
        if(e.hipsT && (dx||dy||dz)){ _v.set(dx,dy,dz).applyQuaternion(_q2.copy(pq).invert()).multiplyScalar(1/G.sPar[i]); b.position.add(_v); }
      } else {
        b.position.copy(G.pBind[i]); if(vs&&G.stSide[i]>=0&&vs[G.stSide[i]]) b.position.multiplyScalar(1+vs[G.stSide[i]]);
        const cv=G.curl&&p.ballK>0?G.curl[b.name]:null;
        if(cv){ b.quaternion.copy(G.qBind[i]).multiply(_q2.setFromAxisAngle(_v.set(1,0,0),cv*p.ballK)); G.qw[i].copy(pq).multiply(b.quaternion); }
        else { b.quaternion.copy(G.qBind[i]); G.qw[i].copy(pq).multiply(G.qBind[i]); }
      }
    }
    // tails: gentle travelling sway that widens with speed
    if(G.tail.length){ for(let j=0;j<G.tail.length;j++){ const i=G.tail[j], b=G.bones[i];
        _q2.setFromAxisAngle(_v.set(0,0,1),Math.sin(sw*(3+3*spd)-j*.7)*(.05+.07*spd)*(1+j*.3)); b.quaternion.multiply(_q2); } }
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
    let y0=1e9,y1=-1e9,x0=1e9,x1=-1e9; const isHead=new Uint8Array(n);
    for(let i=0;i<n;i++){ let best=0,bj=0; for(let k=0;k<4;k++){ if(W4(jw,i,k)>best){ best=W4(jw,i,k); bj=W4(ji,i,k); } }
      if(anc(bj,headN)){ isHead[i]=1; const y=pos.getY(i),x=pos.getX(i); if(y<y0)y0=y; if(y>y1)y1=y; if(x<x0)x0=x; if(x>x1)x1=x; } }
    for(let i=0;i<n;i++){ let best=0,bj=0; for(let k=0;k<4;k++){ if(W4(jw,i,k)>best){ best=W4(jw,i,k); bj=W4(ji,i,k); } }
      let c=W; const nz=nor.getZ(i), ny=nor.getY(i), v=(pos.getY(i)-y0)/Math.max(1e-6,y1-y0);
      if(isHead[i]){
        const front = ECHO_FRONT*nz>.35;
        const hx=(pos.getX(i)-(x0+x1)/2)/Math.max(1e-6,(x1-x0)/2);       // -1..1 across the head
        if(front && v>.52 && v<.6 && Math.abs(hx)>.18 && Math.abs(hx)<.72) c=GREEN;      // two lime eye slits (reference art)
        else if(front && v>.5 && v<.62 && Math.abs(hx)<.8) c=[.78,.8,.84];                // heavy lids / brow in light grey
        else if(front && v>.27 && v<.34 && Math.abs(hx)<.6) c=GREEN;                      // lime frown mouth strip
        else if(Math.abs(nor.getX(i))>.82) c=(v>.4&&v<.7)?BLACK:[.85,.86,.9];            // black headphone cups
      } else if(depthFrom(bj,armN)>=1 && depthFrom(bj,armN)<=99 && anc(bj,armN)){ const d=depthFrom(bj,armN); c = d>=1 && d<=2 ? [.82,.84,.88] : W; }
      else if(anc(bj,legN)) c=[.84,.86,.9];
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
  const PZ={four_arms:.68,heatblast:.68,xlr8:.92,echo_echo:.72,cannonbolt:1,jetray:.82,chromastone:.8,wildvine:.78};
  function topOf(parts){ return parts.glb?(parts.dims.total-.12):null; }

  return { init, attach, attachBall, setBall, apply, scaleBody, topOf, pz:k=>PZ[k]||.7, leanMul:k=>(CFG[k]&&CFG[k].leanMul!=null)?CFG[k].leanMul:1, ready:k=>state[k]==='ok', pending:k=>!!CFG[k]&&(state[k]==='wait'||state[k]===undefined), CFG };
})();
window.GLBBODY=GLBBODY;
try{GLBBODY.init();}catch(e){console.warn('GLB init',e);}
