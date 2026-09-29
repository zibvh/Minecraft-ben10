
window.addEventListener('error',function(e){
  var p=document.getElementById('menu-panel'); if(!p) return;
  p.style.display='block'; p.style.color='#ff8080'; p.style.maxWidth='90vw'; p.style.wordBreak='break-word';
  p.textContent='ERROR: '+e.message+' (line '+e.lineno+')';
});



(function(){
'use strict';
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* =========================================================================
   AUDIO — lightweight generated sfx (no external files)
========================================================================= */
const Audio_ = (function(){
  let ctx = null;
  function ac(){ if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return ctx; }

  // Real audio files: dropped into a "sounds/" folder next to index.html.
  // Missing files fail silently (caught) so the game still runs without them.
  const musicTracks = ['sounds/back1.mp3', 'sounds/back2.mp3'];
  let musicEls = [], curTrack = -1, musicVol = 0.35;
  function initMusic(){
    if(musicEls.length) return;
    musicEls = musicTracks.map(src=>{
      const a = new Audio(src); a.preload='auto'; a.volume=musicVol;
      a.addEventListener('error', ()=>{}, true);
      return a;
    });
  }
  function playNextTrack(){
    if(!musicEls.length) return;
    curTrack = (curTrack+1) % musicEls.length;
    const el = musicEls[curTrack];
    el.currentTime = 0;
    el.play().catch(()=>{});
    el.onended = playNextTrack;
  }
  function stopMusic(){ musicEls.forEach(a=>{ try{ a.pause(); }catch(e){} }); }

  const mutateSfx = new Audio('sounds/mutate.mp3');
  mutateSfx.preload = 'auto'; mutateSfx.volume = 0.7;
  mutateSfx.addEventListener('error', ()=>{}, true);
  function playMutate(){ try{ mutateSfx.currentTime = 0; mutateSfx.play().catch(()=>{}); }catch(e){} }
  function beep(freq, dur, type, vol, glideTo){
    const a = ac(); if(!a) return;
    const o = a.createOscillator(); const g = a.createGain();
    o.type = type||'sine'; o.frequency.setValueAtTime(freq, a.currentTime);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, a.currentTime+dur);
    g.gain.setValueAtTime(vol||0.15, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime+dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+dur);
  }
  function noise(dur, vol){
    const a = ac(); if(!a) return;
    const buf = a.createBuffer(1, a.sampleRate*dur, a.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src = a.createBufferSource(); src.buffer = buf;
    const g = a.createGain(); g.gain.value = vol||0.2;
    src.connect(g); g.connect(a.destination); src.start();
  }
  return {
    footstep(){ noise(0.06, 0.05); },
    jump(){ beep(300,0.15,'square',0.12,520); },
    land(){ noise(0.08,0.12); },
    breakBlock(){ noise(0.12,0.18); },
    place(){ beep(200,0.08,'square',0.1,260); },
    attack(){ beep(150,0.1,'sawtooth',0.15,90); },
    heavyHit(){ beep(90,0.22,'sawtooth',0.22,45); noise(0.1,0.15); },
    hit(){ noise(0.08,0.2); },
    transform(){ beep(220,0.35,'sine',0.18,880); setTimeout(()=>beep(880,0.2,'sine',0.15,440),120); playMutate(); },
    special(){ beep(400,0.3,'sawtooth',0.18,700); },
    death(){ beep(400,0.6,'sawtooth',0.2,60); },
    resume(){
      const a=ac(); if(a && a.state==='suspended') a.resume();
      initMusic();
      if(curTrack===-1) playNextTrack();
    },
    setMusicVolume(v){ musicVol=v; musicEls.forEach(a=>a.volume=v); },
    stopMusic, playNextTrack
  };
})();

/* =========================================================================
   GRAPHICS QUALITY
========================================================================= */
const QUALITY = { level:'MEDIUM',
  presets:{
    LOW:{shadow:false,shadowSize:512,fogFar:44,pixelRatio:1,renderDist:22},
    MEDIUM:{shadow:true,shadowSize:1024,fogFar:70,pixelRatio:Math.min(devicePixelRatio,1.5),renderDist:32},
    HIGH:{shadow:true,shadowSize:2048,fogFar:100,pixelRatio:Math.min(devicePixelRatio,2),renderDist:42}
  }
};

/* =========================================================================
   RENDERER / SCENE / CAMERA
========================================================================= */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff3d0, 1.0);
sun.castShadow = true;
scene.add(sun);
scene.add(sun.target);

function applyQuality(){
  const p = QUALITY.presets[QUALITY.level];
  renderer.setPixelRatio(p.pixelRatio);
  renderer.shadowMap.enabled = p.shadow;
  sun.castShadow = p.shadow;
  sun.shadow.mapSize.set(p.shadowSize, p.shadowSize);
  sun.shadow.camera.left=-45; sun.shadow.camera.right=45;
  sun.shadow.camera.top=45; sun.shadow.camera.bottom=-45;
  sun.shadow.camera.far=120;
  scene.fog = new THREE.Fog(0x8fc7f2, 14, p.fogFar);
}
applyQuality();

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Declared here (ahead of the terrain/chunk system) because chunk generation spawns
// parked cars via makeBoulder(), which needs DEB and props to already exist.
const props=[], fx=[], actCd={}; let carried=null, timeScale=1, tornado=null, actEls=[];
const DEB=new THREE.BoxGeometry(1,1,1);

/* =========================================================================
   STAGE 7 — VERTICAL CITY
   Rooftops, balconies, fire escapes and deterministic stair access are layered onto the existing
   streamed city. The original chunk lifecycle remains authoritative; these surfaces are chunk-owned.
========================================================================= */
/* =========================================================================
   WORLD / VOXEL TERRAIN  —  CHUNK STREAMING
   The world is logically WORLD x WORLD columns, but nothing is generated
   or held in memory until the player gets near it. Chunks are CHUNK x CHUNK
   columns each; only chunks within LOAD_RADIUS of the player are live.
   Every public function used elsewhere in the file (groundTopAt, blockedAt,
   isSolid, addBlockAt, removeBlockAt) keeps its exact old signature so nothing
   downstream (movement, enemies, props, block editing) needs to change.
========================================================================= */
const WORLD = 4096;                // logical world extent (columns per side) — effectively unbounded for play purposes
const HALF = WORLD/2;
const WATER_LEVEL = 0;
const BLOCK_TYPES = ['grass','dirt','stone','sand','wood','leaves','asphalt','concrete'];
const BLOCK_COLOR = { grass:0x5fae3c, dirt:0x6b4a2d, stone:0x8a8a8a, sand:0xdfd0a0, wood:0x6b4a2d, leaves:0x2e8b3d, asphalt:0x3a3a40, concrete:0xb4b4ac };

const CHUNK = 16;                  // columns per chunk side — matches the old city-cell grid exactly
const LOAD_RADIUS = 3;             // chunks around the player kept live (3 => 7x7 chunk area, 112 units across)
const UNLOAD_RADIUS = 4;           // hysteresis: unload only past this, so edge-crossing doesn't thrash

// Deterministic per-chunk RNG so a chunk regenerates identically every time it streams back in.
function chunkSeed(cx,cz){ let h = (cx*374761393 + cz*668265263) ^ (cx*2246822519); h = (h ^ (h>>>15)) * 2246822519; h = (h ^ (h>>>13)) >>> 0; return h; }
function seededRng(seed){ let s = seed>>>0; return function(){ s ^= s<<13; s ^= s>>>17; s ^= s<<5; s>>>=0; return (s>>>0) / 4294967296; }; }

function surfaceHeight(x,z){ return 1; }
function zoneType(x,z){ const a=((x%16)+16)%16, b=((z%16)+16)%16; if(a<4||b<4) return 'asphalt'; if(a===4||a===15||b===4||b===15) return 'concrete'; return 'grass'; }

// block registry: key "x,y,z" -> {type, chunkKey, idx, active}
const blocks = new Map();
const keyOf = (x,y,z)=> x+','+y+','+z;
const colKey = (x,z)=> x+','+z;
const columnHeight = {}; // top solid y per column, for quick ground lookup (persists across unload/reload)

const chunkKeyOf = (cx,cz)=> cx+','+cz;
const chunks = new Map(); // chunkKey -> chunk record
let curChunkX = 0, curChunkZ = 0;

const dummy = new THREE.Object3D();

// Shared materials (one per block type, reused by every chunk) — avoids recreating a Material object on every chunk generation.
const blockMaterials = {};
BLOCK_TYPES.forEach(t=>{ blockMaterials[t] = new THREE.MeshLambertMaterial({ color: BLOCK_COLOR[t] }); });
const sharedBoxGeo = new THREE.BoxGeometry(1,1,1);

function newChunkMeshes(){
  // Lazy: no InstancedMesh is actually created until a block of that type is placed in this chunk
  // (getOrCreate below). Most chunks only ever need 2-3 of the 8 block types as terrain, so this
  // avoids 5-6 unnecessary GPU buffer allocations per chunk — the main cost behind the movement stutter.
  return {};
}
function getOrCreateMesh(chunk, type){
  let m = chunk.meshes[type];
  if(!m){
    const cap = CHUNK*CHUNK*3 + 200; // headroom for player-placed blocks within this chunk
    m = new THREE.InstancedMesh(sharedBoxGeo, blockMaterials[type], cap);
    m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false;
    scene.add(m); chunk.meshes[type] = m; chunk.freeSlots[type] = []; chunk.usedCount[type] = 0;
  }
  return m;
}

function isSolid(x,y,z){ const b = blocks.get(keyOf(x,y,z)); return !!(b && b.active); }
function recomputeColumnTop(x,z){
  let top = -99;
  for(let y=-14;y<=20;y++){ if(isSolid(x,y,z)) top = Math.max(top,y); }
  return top;
}

function setInstance(chunk, type, x, y, z){
  const mesh = getOrCreateMesh(chunk, type);
  let idx;
  if(chunk.freeSlots[type].length){ idx = chunk.freeSlots[type].pop(); }
  else { idx = chunk.usedCount[type]++; mesh.count = Math.max(mesh.count, chunk.usedCount[type]); }
  dummy.position.set(x,y,z); dummy.scale.set(1,1,1); dummy.updateMatrix();
  mesh.setMatrixAt(idx, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
  blocks.set(keyOf(x,y,z), {type, chunkKey:chunk.key, idx, active:true});
  return idx;
}
function addBlockAt(type, x, y, z){
  const k = keyOf(x,y,z);
  if(blocks.has(k) && blocks.get(k).active) return false;
  const chunk = chunkAtColumn(x,z);
  if(!chunk) return false; // outside any currently-loaded chunk; ignore (shouldn't happen for player-driven edits)
  setInstance(chunk, type, x, y, z);
  columnHeight[colKey(x,z)] = Math.max(columnHeight[colKey(x,z)]===undefined?-99:columnHeight[colKey(x,z)], y);
  return true;
}
function removeBlockAt(x,y,z){
  const k = keyOf(x,y,z); const b = blocks.get(k);
  if(!b || !b.active) return null;
  const chunk = chunks.get(b.chunkKey);
  if(chunk){
    const mesh = chunk.meshes[b.type];
    dummy.position.set(0,-9999,0); dummy.scale.set(0,0,0); dummy.updateMatrix();
    mesh.setMatrixAt(b.idx, dummy.matrix); mesh.instanceMatrix.needsUpdate = true;
    chunk.freeSlots[b.type].push(b.idx);
  }
  b.active = false;
  columnHeight[colKey(x,z)] = recomputeColumnTop(x,z);
  return b.type;
}

function chunkCoordOf(x,z){ return [Math.floor((x+HALF)/CHUNK), Math.floor((z+HALF)/CHUNK)]; }
function chunkAtColumn(x,z){ const [cx,cz]=chunkCoordOf(x,z); return chunks.get(chunkKeyOf(cx,cz)) || null; }

// ---- city props (buildings/roads/trees/cars), scoped per chunk ----
const colliders=[], cityGroup=new THREE.Group(); scene.add(cityGroup);
const UB=new THREE.BoxGeometry(1,1,1), GY=1.5;
// Stage 7: walkable vertical-city surfaces. These are kept separate from wall colliders so
// rooftops can be real gameplay spaces without turning the whole building into a solid block.
const walkSurfaces=[];
function blockedAt(x,z,fy){
  for(let i=colliders.length-1;i>=0;i--){
    const c=colliders[i];
    if(x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1){
      // Once the player is at/above the roof access height, the roof itself is the walkable
      // surface; the building's old volume collider must not prevent stepping onto it.
      const accessY = c.roofAccessY===undefined ? c.top : c.roofAccessY;
      if(fy < accessY-0.3) return true;
    }
  }
  return false;
}
function cityScaledPoint(x,z,ownerList){
  const cx=ownerList&&ownerList._centerX!==undefined?ownerList._centerX:0;
  const cz=ownerList&&ownerList._centerZ!==undefined?ownerList._centerZ:0;
  const k=ownerList&&ownerList._cityScale||CITY_PRESENTATION_SCALE;
  return [cx+(x-cx)*k, cz+(z-cz)*k];
}
function cityScaledY(y,ownerList){
  const k=ownerList&&ownerList._cityScale||CITY_PRESENTATION_SCALE;
  return GY+(y-GY)*k;
}
function cbox(cx,by,cz,w,h,d,mat,solid,ownerList,opts){
  const k=ownerList&&ownerList._cityScale||CITY_PRESENTATION_SCALE;
  const [sx,sz]=cityScaledPoint(cx,cz,ownerList);
  const sy=cityScaledY(by,ownerList), sh=h*k, sw=w*k, sd=d*k;
  const m=new THREE.Mesh(UB,mat); m.scale.set(sw,sh,sd); m.position.set(sx,sy+sh/2,sz); m.castShadow=true; cityGroup.add(m);
  ownerList.meshes.push(m);
  if(solid){
    const c={x0:sx-sw/2,x1:sx+sw/2,z0:sz-sd/2,z1:sz+sd/2,top:sy+sh,
      roofAccessY:opts&&opts.roofAccessY!==undefined?cityScaledY(opts.roofAccessY,ownerList):sy+sh};
    colliders.push(c); ownerList.colliders.push(c);
  }
  return m;
}
function addWalkSurface(x0,x1,z0,z1,top,ownerList){
  const [sx0,sz0]=cityScaledPoint(x0,z0,ownerList), [sx1,sz1]=cityScaledPoint(x1,z1,ownerList);
  const s={x0:Math.min(sx0,sx1),x1:Math.max(sx0,sx1),z0:Math.min(sz0,sz1),z1:Math.max(sz0,sz1),top:cityScaledY(top,ownerList)};
  walkSurfaces.push(s); ownerList.platforms.push(s); return s;
}
function roofDeck(cx,cz,w,d,top,ownerList,style){
  addWalkSurface(cx-w/2+0.12,cx+w/2-0.12,cz-d/2+0.12,cz+d/2-0.12,top,ownerList);
  const deck=cbox(cx,top-0.08,cz,w,.16,d,flat(style||0x3d4248),false,ownerList);
  deck.receiveShadow=true;
  // Small rooftop service units make the roof a usable space rather than an empty box.
  const unitMat=flat(0x555b62);
  [[-w*.22,-d*.18],[w*.18,-d*.2],[w*.22,d*.18]].forEach(([ox,oz],i)=>{
    cbox(cx+ox,top+.02,cz+oz,.9+.15*(i%2),.65,.65,unitMat,false,ownerList);
  });
}
function rooftopProps(cx,cz,w,d,top,ownerList,rng,style){
  roofDeck(cx,cz,w,d,top,ownerList,style);
  // Low parapet sections leave an obvious entry/exit gap at the stair side.
  const pm=flat(0x4b5056), gapZ=cz+d/2-.35;
  cbox(cx-w/2+.08,top+.1,cz,.16,.7,d-.8,pm,false,ownerList);
  cbox(cx+w/2-.08,top+.1,cz,.16,.7,d-.8,pm,false,ownerList);
  cbox(cx,top+.1,cz-d/2+.08,w-.8,.7,.16,pm,false,ownerList);
  // Balcony/roof vegetation or antenna variety.
  if(rng()<0.5) cbox(cx+1.4,top+.45,cz-1.1,.55,.8,.55,flat(0x2f7d4a),false,ownerList);
}
function accessStairs(cx,cz,roofTop,ownerList,side){
  const sx=cx + (side==='east' ? 4.9 : side==='west' ? -4.9 : 0);
  const sz=cz + (side==='south' ? 4.9 : side==='north' ? -4.9 : 0);
  const vertical = side==='east'||side==='west';
  const dir = vertical ? (side==='east'?1:-1) : (side==='south'?1:-1);
  const steps=Math.max(5,Math.min(12,Math.ceil((roofTop-(GY+.55))/0.72)));
  const run=Math.min(5.2,Math.max(3.8,steps*.45));
  const stepMat=flat(0x666b70);
  // Stairs sit outside the building footprint. Each step is both visible geometry and a
  // walkable surface, so normal movement code can climb them without special-case controls.
  for(let i=0;i<steps;i++){
    const t=(i+1)/steps, h=GY+.5+t*(roofTop-(GY+.5));
    // Start at street level outside the building and finish at the building wall,
    // so the final tread meets the roof deck instead of stopping beside it.
    const along=(1-t)*run;
    const x=vertical?sx+along*dir:cx;
    const z=vertical?cz:sz+along*dir;
    const w=vertical?1.8:.9, d=vertical?.9:1.8;
    cbox(x,h-.16,z,w,.32,d,stepMat,false,ownerList);
    addWalkSurface(x-w/2,x+w/2,z-d/2,z+d/2,h,ownerList);
  }
  // A simple handrail communicates the route visually.
  const railMat=flat(0x777d82);
  const railX=vertical?sx+dir*run/2:cx;
  const railZ=vertical?cz:sz+dir*run/2;
  cbox(railX, GY+.9, railZ, vertical? .12:1.4, 1.4, vertical?1.4:.12, railMat,false,ownerList);
}
function accessRamp(cx,cz,roofTop,ownerList){
  const h=roofTop-(GY+.5), run=6.0, rampMat=flat(0x5a6067), k=ownerList&&ownerList._cityScale||CITY_PRESENTATION_SCALE;
  const [rx,rz]=cityScaledPoint(cx+4.9,cz,ownerList);
  const rh=h*k, rr=run*k;
  const ramp=new THREE.Mesh(new THREE.BoxGeometry(1.9*k,.28*k,rr),rampMat);
  ramp.rotation.x=-Math.atan2(rh,rr); ramp.position.set(rx,GY+.5*k+rh*.5,rz);
  ramp.castShadow=true; cityGroup.add(ramp); ownerList.meshes.push(ramp);
}
function fireEscape(cx,cz,roofTop,ownerList){
  const z=cz-4.15, fm=flat(0x3f464d);
  const levels=Math.max(1,Math.floor((roofTop-GY)/4));
  for(let i=0;i<levels;i++){
    const y=GY+1.2+i*4;
    cbox(cx+4.25,y,z,1.5,.18,2.2,fm,false,ownerList);
    addWalkSurface(cx+3.5,cx+5.0,z-1.0,z+1.0,y+.1,ownerList);
    cbox(cx+4.25,y,z-1.0,1.5,1.1,.08,fm,false,ownerList);
  }
  cbox(cx+4.25,GY,z, .12, roofTop-GY+1.0,.12,fm,false,ownerList);
}
function wallMat(base,win,cols,rows){
  const cv=document.createElement('canvas'); cv.width=cv.height=32; const g=cv.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,32,32); g.fillStyle=win; g.fillRect(6,7,20,16); g.fillStyle='rgba(255,255,255,0.35)'; g.fillRect(6,7,20,3);
  const tx=new THREE.CanvasTexture(cv); tx.wrapS=tx.wrapT=THREE.RepeatWrapping; tx.repeat.set(cols,rows); tx.magFilter=THREE.NearestFilter;
  return new THREE.MeshLambertMaterial({map:tx});
}
function signMat(txt,bg){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=32; const g=cv.getContext('2d');
  g.fillStyle=bg; g.fillRect(0,0,128,32); g.fillStyle='#fff'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.fillText(txt,64,24);
  return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)});
}
const flat=c=>new THREE.MeshLambertMaterial({color:c});
const rnd=n=>Math.floor(Math.random()*n); // global RNG helper used by NPCs/debris/gang spawn elsewhere in the file (distinct from generateChunk's local seeded rnd, which is deterministic per-chunk)
const PAST=['#e8d5b0','#d9a8a0','#b7d3c2','#c9c3e0','#f0e2a0'];
const CARCOL=[0xd63a3a,0x2f6fd6,0xe8c33a,0xf0f0f0,0x2a2a2e,0x3aa860];

function house(cx,cz,rnd,ownerList){
  const h=3.2;
  cbox(cx,GY,cz,6,h,6,wallMat(PAST[rnd(5)],'#6ab0d8',3,1),true,ownerList);
  const r=new THREE.Mesh(new THREE.ConeGeometry(5,2.2,4),flat(0x8a3b2a)); r.rotation.y=Math.PI/4; r.position.set(cx,GY+4.3,cz); r.castShadow=true; cityGroup.add(r); ownerList.meshes.push(r);
  cbox(cx,GY,cz+3.02,1.1,2,.1,flat(0x5a3a22),false,ownerList); cbox(cx+2,GY+3.2,cz-1,.8,2,.8,flat(0x7a4a3a),false,ownerList);
  // A low rear balcony gives low-rise structures a playable perch without pretending the pitched roof is flat.
  const top=GY+h; cbox(cx-1.7,top,cz-3.35,3.0,.16,1.6,flat(0x6a4a34),false,ownerList);
  addWalkSurface(cx-3.0,cx-.4,cz-4.0,cz-2.8,top+.08,ownerList);
  cbox(cx-1.7,top+.1,cz-4.0,3,.9,.1,flat(0x555a5e),false,ownerList);
  ownerList.treeSpots.push([cx-4,cz-4],[cx+4,cz-4]);
}
function shop(cx,cz,rnd,ownerList){
  const h=4, top=GY+h;
  cbox(cx,GY,cz,8,h,7,wallMat('#cfcfd6','#bfe6f5',4,1),true,ownerList);
  cbox(cx,GY+4,cz,8.3,.4,7.3,flat(0x555560),false,ownerList);
  cbox(cx,GY+2.6,cz+3.9,8,.5,1.4,flat([0xd85a4a,0x4a7bd8,0xd8b84a][rnd(3)]),false,ownerList);
  cbox(cx,GY+3.3,cz+3.6,5,.9,.2,signMat(['CAFE','MARKET','PIZZA','BOOKS'][rnd(4)],'#222'),false,ownerList);
  rooftopProps(cx,cz,8,7,top,ownerList,rnd,0x555560); accessStairs(cx,cz,top,ownerList,'south');
}
function apartment(cx,cz,rnd,ownerList){
  const h=6+rnd(3)*3, top=GY+h;
  cbox(cx,GY,cz,7,h,7,wallMat('#b0855f','#f3e39a',3,h/3),true,ownerList);
  cbox(cx,GY+h,cz,7.4,.4,7.4,flat(0x444444),false,ownerList);
  rooftopProps(cx,cz,7,7,top,ownerList,rnd,0x444444);
  accessStairs(cx,cz,top,ownerList,'east'); fireEscape(cx,cz,top,ownerList);
  // Balconies on alternating sides create intermediate fighting/landing points.
  for(let i=0;i<Math.max(1,Math.floor(h/3));i++){
    const y=GY+2.2+i*3;
    cbox(cx-3.8,y,cz,1.5,.16,2.0,flat(0x5d4634),false,ownerList);
    cbox(cx-4.45,y+.1,cz,0.1,.9,2.0,flat(0x555a5e),false,ownerList);
    addWalkSurface(cx-4.55,cx-3.7,cz-1,cz+1,y+.08,ownerList);
  }
}
function tower(cx,cz,rnd,ownerList){
  const h=18+rnd(4)*5, top=GY+h;
  cbox(cx,GY,cz,8,h,8,wallMat('#2a3f5a','#7fc4ee',4,h/3),true,ownerList);
  cbox(cx,GY+h,cz,8.4,.5,8.4,flat(0x333a44),false,ownerList);
  cbox(cx,GY+h+.5,cz,.4,4,.4,flat(0xcc2222),false,ownerList);
  rooftopProps(cx,cz,8,8,top,ownerList,rnd,0x333a44); accessStairs(cx,cz,top,ownerList,'west'); fireEscape(cx,cz,top,ownerList);
  // Deep balconies at two heights make towers useful traversal points for flying and jumping.
  [Math.max(GY+5,top*.38), Math.max(GY+10,top*.68)].forEach((y,i)=>{
    cbox(cx+(i?4.2:-4.2),y,cz,1.6,.18,3.0,flat(0x4a4f58),false,ownerList);
    addWalkSurface(cx+(i?3.7:-5.0),cx+(i?5.0:-3.7),cz-1.5,cz+1.5,y+.09,ownerList);
  });
}
function school(cx,cz,rnd,ownerList){
  cbox(cx,GY,cz-2.5,9.4,5.5,4,wallMat('#c9553a','#cfe8f5',6,2),true,ownerList); cbox(cx,GY+5.5,cz-2.5,9.8,.5,4.4,flat(0x333333),false,ownerList);
  cbox(cx,GY+6,cz-2.5,2.6,3.5,2.6,wallMat('#c9553a','#ffe28a',1,1),false,ownerList);
  cbox(cx,GY+3.4,cz-.4,6,1,.3,signMat('SCHOOL','#1a4b8c'),false,ownerList);
  cbox(cx-3.5,GY,cz+3,.15,7,.15,flat(0xdddddd),false,ownerList); cbox(cx-3.1,GY+6,cz+3,.9,.6,.05,flat(0xdd3333),false,ownerList);
  [-1,1].forEach(s=>cbox(cx+s*3.5,GY,cz+3.6,.2,2,2.5,flat(0xffffff),false,ownerList));
  rooftopProps(cx,cz-2.5,9.4,4, GY+5.5, ownerList, rnd, 0x333333);
  accessStairs(cx,cz-2.5,GY+5.5,ownerList,'east'); accessRamp(cx,cz-2.5,GY+5.5,ownerList);
}
function park(cx,cz,rnd,ownerList){
  cbox(cx,GY,cz,3,.4,3,flat(0x4aa8e0),false,ownerList); cbox(cx,GY+.4,cz,.6,1.2,.6,flat(0xbbbbbb),false,ownerList); cbox(cx,GY,cz+4.3,2.2,.5,.6,flat(0x6b4a2d),false,ownerList);
  for(let i=0;i<8;i++){ const a=i*.785+.3; ownerList.treeSpots.push([cx+Math.cos(a)*4,cz+Math.sin(a)*4]); }
}
const KINDS=[house,house,shop,apartment,tower,park,house,shop];

const trunkMat = new THREE.MeshLambertMaterial({color:0x6b4a2d});
const leafMat = new THREE.MeshLambertMaterial({color:0x2e8b3d});

// Generates one chunk's terrain + city cell + trees + roadlines + cars. Deterministic from (cx,cz).
function generateChunk(cx, cz){
  const key = chunkKeyOf(cx,cz);
  const meshes = newChunkMeshes();
  const chunk = { key, cx, cz, meshes, freeSlots:{}, usedCount:{}, colliders:[], props:{ meshes:[], colliders:[], treeSpots:[], platforms:[] } };
  // freeSlots/usedCount for each block type are created lazily in getOrCreateMesh, only when that chunk actually uses that type
  chunks.set(key, chunk);

  const x0 = cx*CHUNK - HALF, z0 = cz*CHUNK - HALF; // world-space column origin of this chunk

  // terrain voxels
  for(let lx=0; lx<CHUNK; lx++){
    for(let lz=0; lz<CHUNK; lz++){
      const gx = x0+lx, gz = z0+lz;
      const h = surfaceHeight(gx,gz);
      const topType = zoneType(gx,gz);
      for(let y = h-2; y <= h; y++){
        let type;
        if(y === h) type = topType;
        else if(y >= h-1) type = (topType==='sand') ? 'sand' : 'dirt';
        else type = 'stone';
        addBlockAt(type, gx, y, gz);
      }
    }
  }

  // city cell: one building/park per chunk, deterministic by chunk coord (special-cases mirror the old fixed 8x8 map at the origin, then repeats the pattern outward so it tiles forever)
  const rnd = seededRng(chunkSeed(cx,cz));
  const rndInt = n => Math.floor(rnd()*n);
  const centerCx = x0 + CHUNK/2 - 0.5, centerCz = z0 + CHUNK/2 - 0.5;
  chunk.props._centerX=centerCx; chunk.props._centerZ=centerCz; chunk.props._cityScale=CITY_PRESENTATION_SCALE;
  const kindPick = (cx===128&&cz===128) ? park : (cx===128&&cz===127) ? school : KINDS[(((cx%8)+8)%8*3 + ((cz%8)+8)%8*5 + cx*cz)%8];
  kindPick(centerCx, centerCz, rndInt, chunk.props);

  // road markings along this chunk's cell edges
  const mkPts = [];
  for(let s=-CHUNK/2+2; s<CHUNK/2-2; s+=4){
    mkPts.push([x0+1, GY+.02, z0+CHUNK/2-0.5+ (s) ]);
  }
  if(mkPts.length){
    const rm = new THREE.InstancedMesh(UB, new THREE.MeshBasicMaterial({color:0xf2e6a0}), mkPts.length*2);
    let n=0;
    mkPts.forEach(([mx,my,mz])=>{
      dummy.scale.set(.25,.05,1.6); dummy.position.set(x0+0.5,my,mz); dummy.updateMatrix(); rm.setMatrixAt(n++,dummy.matrix);
      dummy.scale.set(1.6,.05,.25); dummy.position.set(mz-z0+x0, my, z0+0.5); dummy.updateMatrix(); rm.setMatrixAt(n++,dummy.matrix);
    });
    rm.count=n; rm.frustumCulled=false; scene.add(rm); chunk.props.meshes.push(rm);
  }

  // trees for this chunk
  const spots = chunk.props.treeSpots;
  if(spots.length){
    for(let i=0;i<spots.length;i++){ const q=cityScaledPoint(spots[i][0],spots[i][1],chunk.props); spots[i][0]=q[0]; spots[i][1]=q[1]; }
    const trunkI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6,2.2,0.6), trunkMat, spots.length);
    const leafI = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2,2.2,2.2), leafMat, spots.length);
    spots.forEach((s,n)=>{
      dummy.scale.set(1,1,1); dummy.position.set(s[0],GY+1.1,s[1]); dummy.updateMatrix(); trunkI.setMatrixAt(n,dummy.matrix);
      dummy.position.y=GY+2.9; dummy.updateMatrix(); leafI.setMatrixAt(n,dummy.matrix);
    });
    trunkI.count=leafI.count=spots.length; [trunkI,leafI].forEach(m=>{m.frustumCulled=false;m.castShadow=true;scene.add(m);});
    chunk.props.meshes.push(trunkI, leafI);
  }

  // one parked car for this chunk cell, skipping the origin cell (player spawn stays clear)
  if(!(cx===128&&cz===128) && rnd()<0.55){
    const vert = rnd()<0.5, lane = rndInt(2)+1;
    const carX = vert ? centerCx - CHUNK/2 + lane*3 : centerCx + (rnd()-0.5)*8;
    const carZ = vert ? centerCz + (rnd()-0.5)*8 : centerCz - CHUNK/2 + lane*3;
    const car = makeBoulder(carX, GY+.95, carZ, 1.9, CARCOL[rndInt(6)], true);
    car.mesh.rotation.y = vert?0:Math.PI/2;
    chunk.props.carRef = car; // tracked so it can be cleaned up on unload
  }

  return chunk;
}

function disposeChunk(chunk){
  // Only remove the InstancedMesh from the scene — geometry and material are shared across
  // every chunk now (see blockMaterials/sharedBoxGeo above), so they must never be disposed here.
  Object.values(chunk.meshes).forEach(m=>{ scene.remove(m); });
  chunk.props.meshes.forEach(m=>{ scene.remove(m); if(m.geometry&&m.geometry!==UB) m.geometry.dispose(); if(m.material&&!Array.isArray(m.material)) m.material.dispose(); });
  chunk.props.colliders.forEach(c=>{ const i=colliders.indexOf(c); if(i>=0) colliders.splice(i,1); });
  chunk.props.platforms.forEach(s=>{ const i=walkSurfaces.indexOf(s); if(i>=0) walkSurfaces.splice(i,1); });
  if(chunk.props.carRef){ const i=props.indexOf(chunk.props.carRef); if(i>=0) props.splice(i,1); }
  // clear this chunk's block registry entries (terrain memory is freed; columnHeight persists so ground queries outside load radius still resolve sanely)
  const x0 = chunk.cx*CHUNK - HALF, z0 = chunk.cz*CHUNK - HALF;
  for(let lx=0; lx<CHUNK; lx++) for(let lz=0; lz<CHUNK; lz++){
    for(let y=-14;y<=20;y++){ const k=keyOf(x0+lx,y,z0+lz); if(blocks.has(k)) blocks.delete(k); }
  }
  chunks.delete(chunk.key);
}

// Loads/unloads chunks around (px,pz). Cheap to call every frame — it only queues work when the
// player has crossed into a new chunk, and actual generation is budgeted (a few chunks per frame)
// so fast movement (XLR8, rolling Cannonbolt, flying Heatblast) never stalls a single frame by
// generating many chunks at once. Missing chunks are queued nearest-first so the ground/buildings
// immediately around the player are always the first to appear.
const loadQueue = [];
const queuedKeys = new Set();
const CHUNKS_PER_FRAME = 2;      // baseline budget when standing/walking
const MAX_CHUNKS_PER_FRAME = 5;  // ceiling at extreme speed - bounded so one frame can never freeze the phone
const LOOKAHEAD_MAX = 3;         // extra chunks to reach ahead of the player at full speed (on top of LOAD_RADIUS)

// Track the player's actual movement (derived from position deltas) so streaming can be biased toward
// where they are heading rather than loading a symmetric square around where they currently stand.
let prevStreamX = null, prevStreamZ = null, velX = 0, velZ = 0, lastStreamKey = '';

function updateChunkStreaming(px,pz,dt){
  // --- estimate velocity (smoothed) ---
  if(prevStreamX !== null && dt > 0){
    const vx = (px-prevStreamX)/dt, vz = (pz-prevStreamZ)/dt;
    velX += (vx-velX)*Math.min(1, dt*8); velZ += (vz-velZ)*Math.min(1, dt*8);
  }
  prevStreamX = px; prevStreamZ = pz;
  const speed = Math.hypot(velX, velZ);
  const dirX = speed>0.5 ? velX/speed : 0, dirZ = speed>0.5 ? velZ/speed : 0;
  // 0 at walking pace, 1 at ~60 units/sec (full XLR8 speed)
  const speedFrac = Math.max(0, Math.min(1, (speed-8)/50));

  const [ccx,ccz] = chunkCoordOf(px,pz);
  // Re-plan when the chunk changes OR the heading meaningfully changes (bucketed to avoid re-planning every frame).
  const headingBucket = speedFrac>0.05 ? Math.round(Math.atan2(dirZ,dirX)/0.6)+':'+Math.round(speedFrac*3) : 'still';
  const planKey = ccx+','+ccz+'|'+headingBucket;

  if(planKey !== lastStreamKey || chunks.size===0){
    lastStreamKey = planKey;
    curChunkX = ccx; curChunkZ = ccz;

    // How far ahead to reach: further at higher speed. Chunk units.
    const ahead = Math.round(LOOKAHEAD_MAX*speedFrac);
    const reach = LOAD_RADIUS + ahead;

    const missing = [];
    for(let dx=-reach; dx<=reach; dx++){
      for(let dz=-reach; dz<=reach; dz++){
        const cx=ccx+dx, cz=ccz+dz, key=chunkKeyOf(cx,cz);
        // Chunks beyond the normal radius are only wanted if they lie in the forward direction.
        const chebyshev = Math.max(Math.abs(dx),Math.abs(dz));
        if(chebyshev > LOAD_RADIUS){
          const len = Math.hypot(dx,dz)||1;
          const alignment = (dx/len)*dirX + (dz/len)*dirZ; // 1 = dead ahead, -1 = directly behind
          if(alignment < 0.55) continue;
        }
        if(chunks.has(key) || queuedKeys.has(key)) continue;
        // Priority: how soon we'll reach it. Chunks ahead of us are pulled forward in the queue;
        // chunks behind us are pushed back (they matter least when moving fast).
        const dist2 = dx*dx+dz*dz;
        const along = dx*dirX + dz*dirZ;              // positive = ahead
        const priority = dist2 - along*2.5*speedFrac*Math.abs(along) ;
        missing.push([cx,cz,priority]); queuedKeys.add(key);
      }
    }
    missing.sort((a,b)=>a[2]-b[2]);
    missing.forEach(([cx,cz])=>loadQueue.push([cx,cz]));

    // Re-sort the whole existing queue by the new heading so stale far-behind entries fall to the back.
    loadQueue.sort((a,b)=>{
      const ax=a[0]-ccx, az=a[1]-ccz, bx=b[0]-ccx, bz=b[1]-ccz;
      const pa=ax*ax+az*az-((ax*dirX+az*dirZ)*2.5*speedFrac*Math.abs(ax*dirX+az*dirZ));
      const pb=bx*bx+bz*bz-((bx*dirX+bz*dirZ)*2.5*speedFrac*Math.abs(bx*dirX+bz*dirZ));
      return pa-pb;
    });

    // Drop queued chunks that are now too far from us (bounded queue, even when sprinting in a line).
    const keepR = reach + 1;
    for(let i=loadQueue.length-1;i>=0;i--){
      const [cx,cz] = loadQueue[i];
      if(Math.abs(cx-ccx) > keepR || Math.abs(cz-ccz) > keepR){ queuedKeys.delete(chunkKeyOf(cx,cz)); loadQueue.splice(i,1); }
    }

    // Unload: distant chunks go, and behind-us chunks are released earlier when moving fast, so the
    // number of live chunks (and memory) stays bounded even though we're now reaching further ahead.
    const behindR = speedFrac>0.3 ? UNLOAD_RADIUS-1 : UNLOAD_RADIUS;
    for(const chunk of [...chunks.values()]){
      const dx = chunk.cx-ccx, dz = chunk.cz-ccz;
      const ahd = dx*dirX + dz*dirZ;
      const limit = ahd >= 0 ? UNLOAD_RADIUS+ahead : behindR;
      if(Math.abs(dx) > limit || Math.abs(dz) > limit) disposeChunk(chunk);
    }
  }

  // Budget scales with speed: more chunks per frame when moving fast, but hard-capped.
  const budget = Math.min(MAX_CHUNKS_PER_FRAME, CHUNKS_PER_FRAME + Math.round(speedFrac*(MAX_CHUNKS_PER_FRAME-CHUNKS_PER_FRAME)));
  for(let i=0;i<budget && loadQueue.length;i++){
    const [cx,cz] = loadQueue.shift();
    const key = chunkKeyOf(cx,cz);
    queuedKeys.delete(key);
    if(!chunks.has(key)) generateChunk(cx,cz);
  }
}
// Used once at startup only: generates every currently-queued chunk immediately (a one-time loading
// pause is fine before the player can even see or move), so the spawn area is fully solid on frame one.
function drainChunkQueueFully(){
  while(loadQueue.length){
    const [cx,cz] = loadQueue.shift();
    const key = chunkKeyOf(cx,cz);
    queuedKeys.delete(key);
    if(!chunks.has(key)) generateChunk(cx,cz);
  }
}

// water plane — generously sized and re-centered on the player each streaming update so it always covers the loaded area
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(CHUNK*(LOAD_RADIUS*2+3), CHUNK*(LOAD_RADIUS*2+3)),
  new THREE.MeshLambertMaterial({ color:0x2d6fae, transparent:true, opacity:0.65 })
);
water.rotation.x = -Math.PI/2; water.position.y = WATER_LEVEL + 0.4;
water.visible=false; scene.add(water);

// Returns the Y of the walkable surface (top face of the highest solid block).
function groundTopAt(x,z){
  const gx = Math.round(x), gz = Math.round(z);
  const t = columnHeight[colKey(gx,gz)];
  let best = Math.max(t===undefined ? -3 : t, -14) + 0.5;
  // Walkable roofs, balconies and individual stair treads override the voxel ground when
  // the player is inside their small footprint.
  for(let i=walkSurfaces.length-1;i>=0;i--){
    const s=walkSurfaces[i];
    if(gx>=s.x0&&gx<=s.x1&&gz>=s.z0&&gz<=s.z1 && s.top>best) best=s.top;
  }
  return best;
}

/* =========================================================================
   DAY / NIGHT CYCLE
========================================================================= */
const DAY_LENGTH = 240; // seconds per full cycle
let dayT = 0.25; // start mid-morning
const skyDay = new THREE.Color(0x8fc7f2), skyNight = new THREE.Color(0x0a1020);
const fogDay = new THREE.Color(0x8fc7f2), fogNight = new THREE.Color(0x0a1020);
function updateDayNight(dt){
  dayT = (dayT + dt/DAY_LENGTH) % 1;
  const angle = dayT * Math.PI * 2;
  sun.position.set(player.pos.x + Math.cos(angle)*60, Math.max(8,Math.sin(angle)*70), player.pos.z + Math.sin(angle)*30);
  sun.target.position.copy(player.pos);      // keep the shadow frustum centered on the player as they roam
  const light = Math.max(0.08, Math.sin(angle));
  const mix = THREE.MathUtils.clamp(light,0,1);
  scene.background = skyNight.clone().lerp(skyDay, mix);
  scene.fog.color.copy(fogNight.clone().lerp(fogDay, mix));
  ambient.intensity = 0.25 + 0.4*mix;
  sun.intensity = 0.3 + 0.9*mix;
}

/* =========================================================================
   CHARACTER / WORLD PRESENTATION PASS
   Preserves the existing gameplay units and streamed-world architecture while making
   characters read larger, heavier and more physically present against the city.
========================================================================= */
const PRESENTATION = {
  characterScale: 1.34, npcScale: 1.12, enemyScale: 1.12, cityScale: 1.16,
  cameraDist: 5.55, cameraHeight: 1.48, cameraFollow: 0.13, cameraLookAhead: 7.5
};
const CITY_PRESENTATION_SCALE = PRESENTATION.cityScale;

/* =========================================================================
   CHARACTER MODEL BUILDER
========================================================================= */
function buildCharacter(kind){
  const g = new THREE.Group();
  const parts = {};
  function mat(color){ return new THREE.MeshLambertMaterial({color}); }
  function box(w,h,d,color){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color)); m.castShadow=true; return m; }
  function joint(radius,color){ const m=new THREE.Mesh(new THREE.SphereGeometry(radius,8,6),mat(color)); m.castShadow=true; return m; }
  function limb(side, upperW, upperH, lowerW, lowerH, color, jointColor, kindName){
    const root=new THREE.Group();
    const upper=box(upperW,upperH,upperW,color); upper.geometry.translate(0,-upperH/2,0); root.add(upper);
    const elbow=joint(Math.max(.075,Math.min(upperW,.14)),jointColor); elbow.position.y=-upperH; root.add(elbow);
    const lower=box(lowerW,lowerH,lowerW,color); lower.geometry.translate(0,-lowerH/2,0); lower.position.y=-upperH; root.add(lower);
    const wrist=joint(Math.max(.06,Math.min(lowerW,.11)),jointColor); wrist.position.y=-(upperH+lowerH); root.add(wrist);
    root.userData.life={upper,lower,elbow,wrist,baseX:0,side,kind:kindName};
    return root;
  }

  let scaleY = 1, palette;
  switch(kind){
    case 'four_arms': palette = {skin:0xd8432e, torso:0x2244aa, accent:0x111111}; scaleY=1.25; break;
    case 'heatblast': palette = {skin:0xff9a2e, torso:0xff5a1e, accent:0xffe27a}; break;
    case 'xlr8':      palette = {skin:0x1c3fbf, torso:0x0c2270, accent:0x8fd6ff}; scaleY=0.95; break;
    case 'diamondhead': palette = {skin:0x35c9c0, torso:0x1e8f88, accent:0xdfffff}; break;
    case 'echo_echo': palette = {skin:0xf1f4f7, torso:0xdde3e9, accent:0x1a1a1a}; scaleY=0.85; break;
    case 'cannonbolt': palette = {skin:0xd8862e, torso:0x8a4a12, accent:0xf2c14e}; scaleY=0.8; break;
    default: palette = {skin:0xe0a878, torso:0x2c7a3d, accent:0x111111}; kind='ben';
  }
  const torsoWidth = kind==='four_arms' ? 1.35 : kind==='cannonbolt' ? 1.4 : 0.68;
  const torsoDepth = kind==='four_arms' ? 0.68 : kind==='cannonbolt' ? 1.25 : 0.38;
  const legWidth   = kind==='four_arms' ? 0.2  : kind==='cannonbolt' ? 0.4 : 0.24;
  const legH = 1.0, torsoH = 1.15, headH = 0.55;
  const hipY = legH * scaleY;
  const torsoCenterY = hipY + (torsoH/2) * scaleY;
  const shoulderY = hipY + torsoH * 0.82 * scaleY;
  const headCenterY = hipY + (torsoH + headH/2) * scaleY;

  const pelvis=box(torsoWidth*.78,.16,torsoDepth*.82,palette.accent); pelvis.position.y=hipY+.02; g.add(pelvis); parts.pelvis=pelvis;
  const hipL=joint(legWidth*.62,palette.accent), hipR=joint(legWidth*.62,palette.accent); hipL.position.set(-0.26,hipY,0); hipR.position.set(0.26,hipY,0); g.add(hipL,hipR); parts.hipL=hipL; parts.hipR=hipR;

  const head = box(0.52,0.55,0.52, kind==='diamondhead'?palette.accent:palette.skin); head.position.y=headCenterY;
  if(kind==='echo_echo'){ const vz=box(0.5,0.14,0.06,0x111111); vz.position.set(0,headCenterY+0.05,-0.36); g.add(vz); }
  if(kind==='diamondhead'){ head.geometry = new THREE.OctahedronGeometry(0.42); }
  if(kind==='cannonbolt'){ head.geometry = new THREE.SphereGeometry(0.38,10,8); }
  g.add(head); parts.head=head; parts.neck=joint(.16,palette.skin); parts.neck.position.set(0,headCenterY-headH/2-.02,0); g.add(parts.neck);

  if(kind==='cannonbolt'){
    const shell = new THREE.Group(); const shellCenterY=torsoCenterY-.05;
    const core=new THREE.Mesh(new THREE.SphereGeometry(.62,14,10),mat(palette.skin)); core.castShadow=true; shell.add(core);
    for(let i=0;i<4;i++){ const band=new THREE.Mesh(new THREE.TorusGeometry(.63,.045,6,16),mat(palette.accent)); band.rotation.x=Math.PI/2; band.position.y=-.35+i*.24; band.castShadow=true; shell.add(band); }
    shell.position.y=shellCenterY; shell.scale.setScalar(.001); g.add(shell); parts.shell=shell; parts.shellBaseY=shellCenterY;
  }

  const torso=box(torsoWidth,torsoH,torsoDepth,palette.torso); torso.position.y=torsoCenterY; g.add(torso); parts.torso=torso;
  if(kind==='echo_echo'){ [-.27,.27].forEach(x=>{ const c=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.08,10),mat(0x111111)); c.rotation.x=Math.PI/2; c.position.set(x,torsoCenterY+.12,-torsoDepth/2-.03); g.add(c); }); }

  const armGeo=kind==='four_arms'?[.3,.95,.3]:[.19,.85,.19];
  const armSpacing=kind==='four_arms'?torsoWidth/2+.18:.46;
  function makeArm(x,extra,lowerBias=0){
    const arm=limb(x<0?'left':'right',armGeo[0],armGeo[1]*.54,armGeo[0]*.92,armGeo[1]*.46,extra?palette.accent:palette.skin,palette.skin,kind);
    arm.position.set(x,shoulderY+lowerBias,0); arm.userData.life.baseY=arm.position.y; g.add(arm); return arm;
  }
  parts.leftArm=makeArm(-armSpacing); parts.rightArm=makeArm(armSpacing);
  parts.shoulderL=joint(armGeo[0]*.58,palette.skin); parts.shoulderR=joint(armGeo[0]*.58,palette.skin); parts.shoulderL.position.set(-armSpacing,shoulderY,0); parts.shoulderR.position.set(armSpacing,shoulderY,0); g.add(parts.shoulderL,parts.shoulderR);
  if(kind==='four_arms'){
    parts.leftArm2=makeArm(-armSpacing*.68,true,-.25); parts.rightArm2=makeArm(armSpacing*.68,true,-.25);
    parts.shoulderL2=joint(armGeo[0]*.5,palette.skin); parts.shoulderR2=joint(armGeo[0]*.5,palette.skin); parts.shoulderL2.position.set(-armSpacing*.68,shoulderY-.25,0); parts.shoulderR2.position.set(armSpacing*.68,shoulderY-.25,0); g.add(parts.shoulderL2,parts.shoulderR2);
  }

  function makeLeg(x){
    const leg=limb(x<0?'left':'right',legWidth,legH*.52,legWidth*.96,legH*.48,palette.accent,palette.accent,kind);
    leg.position.set(x,hipY,0); leg.userData.life.baseY=hipY; g.add(leg); return leg;
  }
  const legSpacing=kind==='four_arms'?.18:.26; parts.leftLeg=makeLeg(-legSpacing); parts.rightLeg=makeLeg(legSpacing);
  const footL=box(legWidth*1.35,.12,legWidth*1.7,palette.accent), footR=box(legWidth*1.35,.12,legWidth*1.7,palette.accent);
  footL.position.set(-legSpacing,-.02,-.07); footR.position.set(legSpacing,-.02,-.07); g.add(footL,footR); parts.footL=footL; parts.footR=footR;

  const o=new THREE.Group(); g.position.y=-.9; o.add(g); o.rotation.order='YXZ'; o.userData.parts=parts; o.userData.kind=kind; o.userData.life={t:Math.random()*6.28,phase:Math.random()*6.28,breath:Math.random()*6.28};
  return o;
}
// tiny portrait renderer (renders each alien to a mini canvas for the HUD)
function renderPortrait(kind){
  const size = 92;
  const pr = new THREE.WebGLRenderer({antialias:true, alpha:true});
  pr.setSize(size,size);
  const psc = new THREE.Scene();
  psc.add(new THREE.AmbientLight(0xffffff,0.9));
  const pl = new THREE.DirectionalLight(0xffffff,0.8); pl.position.set(2,3,4); psc.add(pl);
  const model = buildCharacter(kind);
  model.rotation.y = Math.PI*0.25;
  model.position.y = -0.1;
  psc.add(model);
  const pcam = new THREE.PerspectiveCamera(35,1,0.1,10);
  pcam.position.set(0,0.6,3.3); pcam.lookAt(0,0.5,0);
  pr.render(psc, pcam);
  return pr.domElement;
}

/* =========================================================================
   ALIEN DATA
========================================================================= */
const ICON={SMASH:'👊',GRAB:'✊',THROW:'🎯',DROP:'⬇️',SLAM:'💥',DASH:'💨',TORNADO:'🌪️','SLOW TIME':'⏳',FIREBALL:'🔥',FLY:'🚀',LAND:'🛬',BURN:'☄️',SPRAY:'✨',SHARD:'💎',SHIELD:'🛡️',WALL:'🧱',SPEED:'💨',SCREAM:'📢',SPLIT:'👥',REPLICAS:'🎛️','SONIC DOOM':'🔊',LEVITATE:'🪽'};
const ACT={
 scream:{label:'SCREAM',cost:20,cd:1.4,run:()=>sonicBlast(player.pos,flatFwd(player.yaw),25,10)},
 split:{label:'SPLIT',cost:25,cd:1,run:()=>splitEcho()},
 reps:{label:'REPLICAS',cost:0,cd:.2,show:()=>squad.length>1,run:()=>{ panelOpen=!panelOpen; renderSquad(); }},
 doom:{label:'SONIC DOOM',hold:v=>{ doomHeld=v; doomT=0; },cost:0,cd:0,show:()=>squad.length>1},
 spray:{label:'SPRAY',hold:v=>{ player.sprayHeld=v; },cost:0,cd:0},
 shard:{label:'SHARD',cost:15,cd:.5,run:()=>spawnProjectile({pos:player.pos,yaw:player.yaw,pitch:player.pitch*.5},0x35e0d6,30,32,true,'crystal')},
 shield:{label:'SHIELD',cost:30,cd:8,run:()=>crystalShield()},
 wall:{label:'WALL',cost:30,cd:6,run:()=>crystalWall()},
 lev:{label:()=>player.flying?'LAND':'LEVITATE',cost:0,cd:.3,run:()=>doJump()},
 smash:{label:'SMASH',cost:10,cd:0.6,run:()=>smash()},
 grab:{label:()=>carried?'THROW':'GRAB',cost:0,cd:0.3,run:()=>carried?throwProp():grabProp()},
 drop:{label:'DROP',cost:0,cd:0.2,show:()=>!!carried,run:()=>dropProp()},
 slam:{label:'SLAM',cost:35,cd:5,run:()=>{shockwaveAt(player.pos,4.5,40,true);shakeCamera(0.3);shatterNear(player.pos,4.5);}},
 dash:{label:'SPEED',hold:v=>{player.superHeld=v;},cost:0,cd:0},
 tornado:{label:'TORNADO',cost:35,cd:8,run:()=>spawnTornado()},
 slow:{label:'SLOW TIME',cost:30,cd:9,run:()=>{player.slowT=6;statusText('TIME SLOWED');}},
 fire:{label:'FIREBALL',hold:v=>{ if(v){ player.flameHeld=true; flameTime=0; } else if(player.flameHeld){ player.flameHeld=false; if(flameTime<.22&&player.energy>=15){ player.energy-=15; spawnProjectile(player,0xff5a1e,28,22,false,'fire'); } } },cost:0,cd:0},
 fly:{label:()=>player.flying?'LAND':'FLY',cost:0,cd:0.3,run:()=>doJump()},
 burn:{label:'BURN',cost:25,cd:6,run:()=>{player.boostT=2.5;statusText('AFTERBURNER');}},
 roll:{label:()=>player.rolling?'UNROLL':'ROLL',hold:v=>{player.rollHeld=v;},cost:0,cd:0}
};
const ALIENS = [
  { id:'four_arms', name:'FOUR ARMS', actions:[ACT.smash,ACT.grab,ACT.drop,ACT.slam], maxHealth:160, maxEnergy:100, speed:3.4, jump:6.6,
    atkDamage:22, atkRange:2.4, atkCooldown:0.7, modelScale:1.22,
    special:{ name:'GROUND SLAM', cost:35, cooldown:5,
      run(ctx){ shockwaveAt(ctx.player.pos, 4.5, 40, true); shakeCamera(0.3); } } },
  { id:'heatblast', name:'HEATBLAST', actions:[ACT.fire,ACT.fly,ACT.burn], maxHealth:100, maxEnergy:120, speed:3.0, jump:5.6, flies:true, flySpeed:22,
    atkDamage:14, atkRange:1.8, atkCooldown:0.5, modelScale:1.05,
    special:{ name:'FIREBALL', cost:20, cooldown:1.2,
      run(ctx){ spawnProjectile(ctx.player, 0xff5a1e, 26, 18, false); } } },
  { id:'xlr8', name:'XLR8', actions:[ACT.dash,ACT.tornado,ACT.slow], maxHealth:90, maxEnergy:110, speed:7.4, jump:6.0,
    atkDamage:10, atkRange:1.6, atkCooldown:0.28, modelScale:1.02,
    special:{ name:'SPEED BURST', cost:8, cooldown:0.1, duration:4, speedMult:1.9, drainPerSec:8,
      run(ctx){ ctx.player.speedBurstT = 4; } } },
  { id:'diamondhead', name:'DIAMONDHEAD', flies:true, flySpeed:9, actions:[ACT.spray,ACT.shard,ACT.shield,ACT.wall,ACT.lev], maxHealth:130, maxEnergy:100, speed:2.9, jump:5.4,
    atkDamage:18, atkRange:2.0, atkCooldown:0.6, modelScale:1.08,
    special:{ name:'CRYSTAL SHARD', cost:22, cooldown:1.4,
      run(ctx){ spawnProjectile(ctx.player, 0x35e0d6, 30, 24, true); } } },
  { id:'echo_echo', name:'ECHO ECHO', actions:[ACT.scream,ACT.split,ACT.reps,ACT.doom], maxHealth:90, maxEnergy:100, speed:5.4, jump:6.4,
    atkDamage:9, atkRange:1.8, atkCooldown:0.3, modelScale:0.98, special:null },
  { id:'cannonbolt', name:'CANNONBOLT', actions:[ACT.roll], maxHealth:140, maxEnergy:110, speed:3.6, jump:5.4,
    atkDamage:24, atkRange:1.6, atkCooldown:0.5, modelScale:1.08,
    special:null },
];
const BEN = { id:'ben', name:'BEN', maxHealth:100, maxEnergy:100, speed:4.0, jump:6.0, modelScale:1.0,
  atkDamage:8, atkRange:1.6, atkCooldown:0.45, special:null };

/* =========================================================================
   PLAYER
========================================================================= */
updateChunkStreaming(0.5, 0.5, 0); // queue starting chunks
drainChunkQueueFully();          // ...and load them all now, before we ask groundTopAt for spawn height
const player = {
  pos: new THREE.Vector3(0.5, groundTopAt(0.5,0.5)+1, 0.5),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: -0.12,
  onGround: true,
  form: BEN,
  alienIndex: 0, // index into ALIENS for the swipe cycle
  health: BEN.maxHealth, energy: BEN.maxEnergy,
  atkTimer: 0, specialTimer: 0, speedBurstT: 0, invuln: 0,
  walkT: 0, attacking: 0, alive: true, flying: false,
  comboStep: 0,        // 0 = next hit is punch 1 (left), 1 = next hit is punch 2 (right), 2 = next hit is the heavy finisher
  comboResetTimer: 0,  // counts down after each hit; if it reaches 0 before the next hit, the combo resets to step 0
  punchAnimT: 0, punchAnimDur: 0.25, punchKind: 'left', landingT:0, landingStrength:0, lastGrounded:true,
  impactKick:0, impactLean:0, hurtT:0, hurtDir:new THREE.Vector3(), combatStepT:0

};
player.model = buildCharacter('ben');
scene.add(player.model);

const portraitCache = {};
function getPortraitCanvas(kind){
  if(!portraitCache[kind]) portraitCache[kind] = renderPortrait(kind);
  return portraitCache[kind];
}

function setForm(formDef, kind){
  player.form = formDef;
  player.flying = false;
  scene.remove(player.model);
  player.model = buildCharacter(kind);
  scene.add(player.model);
  player.health = formDef.maxHealth;
  player.energy = formDef.maxEnergy;
  clearSquad(); player.superHeld=false; player.flameHeld=false; player.sprayHeld=false; doomHeld=false; if(carried) dropProp(); player.shieldT=0; if(shield){ scene.remove(shield); shield=null; } player.slowT=0; player.boostT=0; player.dashT=0; player.swimming=false; player.rollHeld=false; player.rolling=false; player.rollT=0; player.rollSpin=0; player.model.rotation.x=0; for(const k in actCd) delete actCd[k]; buildActions();
  player.specialTimer = 0;
  document.getElementById('alien-name').textContent = formDef.name;
  const portWrap = document.getElementById('alien-portrait');
  portWrap.innerHTML = '';
  portWrap.appendChild(getPortraitCanvas(kind));
  flashTransform();
  bannerText(formDef.name);
  Audio_.transform();
}

function flashTransform(){
  const el = document.getElementById('flash-overlay');
  el.style.transition = 'none'; el.style.opacity = '0.85';
  requestAnimationFrame(()=>{ el.style.transition = 'opacity 0.4s'; el.style.opacity = '0'; });
}
let bannerTimer=null;
function bannerText(t){
  const el = document.getElementById('alien-banner');
  el.textContent = t; el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(()=> el.classList.remove('show'), 1100);
}
let statusTimer=null;
function statusText(t){
  const el = document.getElementById('status-text');
  el.textContent = t; el.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(()=> el.classList.remove('show'), 1400);
}

function cycleAlien(dir){
  player.alienIndex = (player.alienIndex + dir + ALIENS.length) % ALIENS.length;
  const a = ALIENS[player.alienIndex];
  setForm(a, a.id);
}
function revertToBen(){
  if(player.form.id === 'ben') return;
  setForm(BEN, 'ben');
}

/* =========================================================================
   CAMERA CONTROLLER (third person)
========================================================================= */
const PS = 0.55 * PRESENTATION.characterScale;
const camState = { dist:PRESENTATION.cameraDist, height:PRESENTATION.cameraHeight };
function updateCamera(){
  // A proper look direction that incorporates pitch (up/down) as well as yaw,
  // so tilting down actually tilts the view down instead of just changing
  // camera height while still staring at a fixed point.
  const lookDir = new THREE.Vector3(
    Math.cos(player.pitch) * -Math.sin(player.yaw),
    Math.sin(player.pitch),
    Math.cos(player.pitch) * -Math.cos(player.yaw)
  );
  const heroHeight=Math.max(1,(player.form.modelScale||1)*PRESENTATION.characterScale);
  const pivot=player.pos.clone().add(new THREE.Vector3(0,camState.height+(heroHeight-1)*0.22,0));
  const desired=pivot.clone().addScaledVector(lookDir,-camState.dist*(1+(heroHeight-1)*0.10));
  camera.position.lerp(desired,PRESENTATION.cameraFollow);
  const lookAt=pivot.clone().addScaledVector(lookDir,PRESENTATION.cameraLookAhead);
  camera.lookAt(lookAt);
  const hitCam=Math.max(player.impactKick||0, player.landingStrength||0)*0.035;
  if(hitCam>0){ camera.position.x += (Math.random()-.5)*hitCam; camera.position.y += (Math.random()-.5)*hitCam; }
}

/* =========================================================================
   PROJECTILES
========================================================================= */
const projectiles = [];
function spawnProjectile(pl, color, damage, speed, pierce, style, opts){
  const geo=style==='crystal'?new THREE.OctahedronGeometry(0.3):new THREE.SphereGeometry(style==='fire'?0.5:0.22,8,8);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color}));
  if(style==='crystal') mesh.scale.set(.7,1.7,.7);
  if(style==='fire') mesh.add(new THREE.Mesh(new THREE.SphereGeometry(.28,8,8),new THREE.MeshBasicMaterial({color:0xffe27a})));
  let dir, startPos;
  if(opts && opts.explicitDir){
    // Enemy-fired: aim directly at a world-space target point rather than deriving direction from
    // a yaw/pitch pair, since enemies don't have a look-pitch the way the player does.
    dir = opts.explicitDir.clone().normalize();
    startPos = opts.explicitFrom ? opts.explicitFrom.clone() : pl.pos.clone().add(new THREE.Vector3(0,1.2,0));
  } else {
    const cp=Math.cos(pl.pitch||0);
    dir = new THREE.Vector3(-Math.sin(pl.yaw)*cp, Math.sin(pl.pitch||0), -Math.cos(pl.yaw)*cp);
    startPos = pl.pos.clone().add(new THREE.Vector3(0,1.2,0)).add(dir.clone().multiplyScalar(1.2));
  }
  mesh.position.copy(startPos);
  scene.add(mesh);
  projectiles.push({mesh, dir, speed, damage, pierce, style, life:2.2, hitSet:new Set(), hostile: !!(opts && opts.hostile)});
  Audio_.special();
}
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p = projectiles[i];
    p.mesh.position.addScaledVector(p.dir, p.speed*dt);
    p.life -= dt;
    let dead = p.life<=0;
    const pp=p.mesh.position;
    if(pp.y<groundTopAt(pp.x,pp.z)||blockedAt(pp.x,pp.z,pp.y-0.5)) dead=true;
    if(p.style==='fire'){ for(let k=0;k<2;k++) debris(pp.clone().add(new THREE.Vector3((Math.random()-.5)*.3,(Math.random()-.5)*.3,(Math.random()-.5)*.3)),Math.random()<.5?0xff5a1e:0xffd84a,.4+Math.random()*.3,new THREE.Vector3(0,1.2,0),.45,false); p.mesh.scale.setScalar(1+Math.sin(p.life*30)*.12); }
    else if(p.style==='crystal') p.mesh.rotation.y+=dt*10;
    if(p.hostile){
      // Enemy-fired projectile: can hit the player or whichever squad unit (Echo Echo replica) is nearest its current position.
      const tu = nearestTarget(pp);
      if(pp.distanceTo(tu.pos) < 1.0){
        hurtTarget(tu, p.damage);
        dead = true;
      }
    } else {
      for(const en of enemies){
        if(!en.alive || p.hitSet.has(en)) continue;
        if(p.mesh.position.distanceTo(en.mesh.position) < 1.0){
          damageEnemy(en, p.damage, p.dir);
          p.hitSet.add(en);
          if(!p.pierce) dead = true;
        }
      }
    }
    if(dead){ if(p.style==='fire') for(let k=0;k<8;k++) debris(p.mesh.position.clone(),Math.random()<.5?0xff5a1e:0xffd84a,.5,new THREE.Vector3((Math.random()-.5)*6,Math.random()*5,(Math.random()-.5)*6),.6,false); scene.remove(p.mesh); projectiles.splice(i,1); }
  }
}

/* =========================================================================
   SPECIAL EFFECTS
========================================================================= */
let camShake = 0;
function shakeCamera(amt){ camShake = amt; }
function shockwaveAt(center, radius, damage, knock){
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2,0.4,24), new THREE.MeshBasicMaterial({color:0xffffff, side:THREE.DoubleSide, transparent:true, opacity:0.8}));
  ring.rotation.x = -Math.PI/2; ring.position.copy(center); ring.position.y += 0.05;
  scene.add(ring);
  let t=0;
  (function grow(){
    t += 0.03; ring.scale.setScalar(1 + t*radius*3); ring.material.opacity = Math.max(0,0.8-t*2);
    if(t<0.5) requestAnimationFrame(grow); else scene.remove(ring);
  })();
  enemies.forEach(en=>{
    if(!en.alive) return;
    const d = en.mesh.position.distanceTo(center);
    if(d < radius){
      damageEnemy(en, damage, en.mesh.position.clone().sub(center).normalize());
    }
  });
}
function trackingPulse(){
  enemies.forEach(en=>{
    if(!en.alive) return;
    const d = en.mesh.position.distanceTo(player.pos);
    if(d < 14){
      const glow = new THREE.PointLight(0xffaa00, 1.2, 4);
      glow.position.set(0,1.4,0); en.mesh.add(glow);
      setTimeout(()=>en.mesh.remove(glow), 3000);
    }
  });
  statusText('TRACKING SENSE ACTIVE');
}

/* =========================================================================
   ENEMIES
========================================================================= */
const enemies = [];
// Stats table for the 5 enemy archetypes. Each gets a distinct size/color so they read as different
// threats at a glance, not just different numbers under the hood.
const ENEMY_STATS = {
  normal:  { hp:40,  speed:2.6, damage:7,  color:0x4a2a8a, size:[0.8,1.1,0.8],  yOff:0.55, retreatHpFrac:0.25, ranged:false, chaseRange:8,  loseRange:12 },
  ranged:  { hp:32,  speed:2.2, damage:6,  color:0x2a6a8a, size:[0.75,1.05,0.75], yOff:0.53, retreatHpFrac:0,    ranged:true,  chaseRange:14, loseRange:18, preferredDist:8, projSpeed:16 },
  brute:   { hp:70,  speed:1.8, damage:12, color:0x8a2a2a, size:[1.1,1.6,1.1],  yOff:0.8,  retreatHpFrac:0,    ranged:false, chaseRange:8,  loseRange:12, knockOnHit:5 },
  speed:   { hp:30,  speed:9.0, damage:6,  color:0xd8a020, size:[0.65,0.95,0.65], yOff:0.48, retreatHpFrac:0.2,  ranged:false, chaseRange:16, loseRange:22 },
  elite:   { hp:110, speed:2.4, damage:11, color:0x1a1a2e, size:[0.95,1.35,0.95], yOff:0.68, retreatHpFrac:0.15, ranged:true,  chaseRange:16, loseRange:20, preferredDist:6, projSpeed:20 },
};
function makeEnemy(type, x, z){
  const stats = ENEMY_STATS[type] || ENEMY_STATS.normal;
  const root=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(...stats.size),new THREE.MeshLambertMaterial({color:stats.color})); body.castShadow=true; body.position.y=stats.yOff; root.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.22,stats.size[0]*.34),8,6),new THREE.MeshLambertMaterial({color:stats.color})); head.position.y=stats.yOff+stats.size[1]*.58; head.castShadow=true; root.add(head);
  const shoulderL=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),new THREE.MeshLambertMaterial({color:stats.color})); shoulderL.position.set(-stats.size[0]*.58,stats.yOff+stats.size[1]*.32,0); root.add(shoulderL);
  const shoulderR=shoulderL.clone(); shoulderR.position.x=-shoulderL.position.x; root.add(shoulderR);
  const limb=(x)=>{ const g=new THREE.Group(); const up=new THREE.Mesh(new THREE.BoxGeometry(.16,stats.size[1]*.32,.16),new THREE.MeshLambertMaterial({color:stats.color})); up.geometry.translate(0,-stats.size[1]*.16,0); g.add(up); const e=new THREE.Mesh(new THREE.SphereGeometry(.09,7,5),new THREE.MeshLambertMaterial({color:stats.size[0]>1?.1:stats.color})); e.position.y=-stats.size[1]*.32; g.add(e); const lo=new THREE.Mesh(new THREE.BoxGeometry(.15,stats.size[1]*.28,.15),new THREE.MeshLambertMaterial({color:stats.color})); lo.geometry.translate(0,-stats.size[1]*.14,0); lo.position.y=-stats.size[1]*.32; g.add(lo); g.position.set(x,stats.yOff+stats.size[1]*.32,0); root.add(g); return g; };
  const parts={torso:body,head,leftArm:limb(-stats.size[0]*.62),rightArm:limb(stats.size[0]*.62),leftLeg:limb(-stats.size[0]*.28),rightLeg:limb(stats.size[0]*.28)};
  root.userData.life={t:Math.random()*6.28,phase:Math.random()*6.28};
  const y=groundTopAt(x,z); root.position.set(x,y,z); root.scale.setScalar(PRESENTATION.enemyScale); scene.add(root);
  const en={
    mesh: root, parts, type, hp: stats.hp, maxHp: stats.hp,
    speed: stats.speed, damage: stats.damage, atkCd:0, alive:true,
    state:'wander', target:new THREE.Vector3(x,0,z), wanderT:0, home:new THREE.Vector3(x,0,z),
    staggerT:0, knockVel:new THREE.Vector3(), hurtT:0, hurtDir:new THREE.Vector3(), hitFlashT:0, attackWindup:0,
    repositionT:0, repositionDir:1, // used by ranged/elite to strafe while shooting
    alertedT:0, // set when alerted by a scream or nearby hit even if not yet in normal chase range
  };
  enemies.push(en);
  return en;
}
// Maintains a small population of enemies near the player, mixing all 5 archetypes. Capped low and
// distance-gated (like the NPC spawner already does for civilians/gangs) so this stays cheap on mobile -
// we are not spawning hundreds of enemies at once, just enough to keep encounters happening nearby.
const ENEMY_TYPE_WEIGHTS = [['normal',5],['ranged',2],['brute',2],['speed',2],['elite',1]];
function pickEnemyType(){
  const total = ENEMY_TYPE_WEIGHTS.reduce((s,[,w])=>s+w,0);
  let r = Math.random()*total;
  for(const [type,w] of ENEMY_TYPE_WEIGHTS){ if(r<w) return type; r-=w; }
  return 'normal';
}
const MAX_ENEMIES = 10;
let enemySpawnT = 0;
function updateEnemySpawning(dt){
  enemySpawnT -= dt;
  if(enemySpawnT > 0) return;
  enemySpawnT = 3.5;
  const active = enemies.filter(e=>!e.npc && e.alive).length;
  if(active >= MAX_ENEMIES) return;
  // Spawn somewhere in a ring around the player - far enough not to appear on top of them, close enough
  // to matter, and never inside a solid block.
  for(let tries=0; tries<6; tries++){
    const ang = Math.random()*Math.PI*2, dist = 18 + Math.random()*22;
    const x = Math.round(player.pos.x + Math.cos(ang)*dist), z = Math.round(player.pos.z + Math.sin(ang)*dist);
    if(blockedAt(x,z,groundTopAt(x,z))) continue;
    makeEnemy(pickEnemyType(), x, z);
    break;
  }
}

function damageEnemy(en, dmg, dirAway, opts){
  if(!en.alive) return;
  if(en.npc){ npcHurt(en,dmg,dirAway,opts); return; }
  en.hp -= dmg;
  const heavy = opts && opts.heavy;
  // Group roots do not own a material; flash their visible meshes instead.
  en.hitFlashT = heavy ? 0.18 : 0.10;
  en.mesh.traverse(o=>{ if(o.isMesh && o.material){ o.userData._hitBase = o.material.emissive ? o.material.emissive.getHex() : 0; if(o.material.emissive) o.material.emissive.setHex(0x550000); } });
  setTimeout(()=>{ en.mesh.traverse(o=>{ if(o.isMesh && o.material && o.material.emissive && o.userData._hitBase!=null) o.material.emissive.setHex(o.userData._hitBase); }); }, heavy?200:120);
  if(dirAway){
    const knock = (opts && opts.knock!=null) ? opts.knock : 3;
    en.knockVel = en.knockVel || new THREE.Vector3();
    en.knockVel.set(dirAway.x*knock, 0, dirAway.z*knock);
    en.hurtDir.copy(dirAway);
    en.hurtT = Math.max(en.hurtT||0, heavy ? 0.34 : 0.18);
    en.staggerT = Math.max(en.staggerT||0, heavy ? 0.5 : 0.22);
    en.mesh.userData.impact = heavy ? 1 : 0.65;
  }
  if(heavy) Audio_.heavyHit(); else Audio_.hit();
  if(en.hp <= 0){
    en.alive = false;
    if(lock.en===en) setLock(null); // never let a lock survive onto a recycled enemy object
    scene.remove(en.mesh);
    setTimeout(()=>{
      const x = Math.round(player.pos.x + (Math.random()-0.5)*40);
      const z = Math.round(player.pos.z + (Math.random()-0.5)*40);
      Object.assign(en, makeEnemy(pickEnemyType(),x,z));
    }, 8000);
  }
}

function updateEnemies(dt){
  enemies.forEach(en=>{
    if(!en.alive||en.npc) return;
    if(en.ice) return;
    const p = en.mesh.position;

    // Distance-based sleep: enemies far from the player skip almost all logic (no target search, no
    // movement, no attack timers), so a large world with many enemies stays cheap. They still tick
    // down staggerT/atkCd minimally so nothing feels frozen the instant they wake up.
    const distFromPlayer = p.distanceTo(player.pos);
    if(distFromPlayer > 45){
      en.staggerT = Math.max(0, (en.staggerT||0) - dt);
      return;
    }

    // Knockback: real velocity that decays over time, checked against collision so a hit can't shove an enemy through a wall.
    en.hurtT=Math.max(0,(en.hurtT||0)-dt);
    en.hitFlashT=Math.max(0,(en.hitFlashT||0)-dt);
    if(en.hurtT>0){ en.mesh.userData.impact=Math.max(en.mesh.userData.impact||0,0.15); }
    if(en.knockVel && en.knockVel.lengthSq() > 0.0001){
      const nx = p.x + en.knockVel.x*dt, nz = p.z + en.knockVel.z*dt;
      if(!blockedAt(nx, p.z, p.y-0.5)) p.x = nx;
      if(!blockedAt(p.x, nz, p.y-0.5)) p.z = nz;
      en.knockVel.multiplyScalar(Math.max(0, 1 - dt*6)); // decays to ~0 over a few hundred ms
    }
    const stats = ENEMY_STATS[en.type] || ENEMY_STATS.normal;
    en.staggerT = Math.max(0, (en.staggerT||0) - dt);
    if(en.staggerT > 0){ p.y = groundTopAt(p.x,p.z) + stats.yOff; return; } // hit-reaction pause: skip normal AI this frame

    en.alertedT = Math.max(0, (en.alertedT||0) - dt);

    // nearestTarget already picks between the player and any living, non-controlled Echo Echo replica,
    // and re-evaluates every frame - so if the current target dies or a replica is removed, the very
    // next frame naturally retargets without any extra bookkeeping needed here.
    const tu=nearestTarget(p), tpos=tu.pos, distToTarget=p.distanceTo(tpos);
    en.atkCd = Math.max(0, en.atkCd - dt);

    const inChaseRange = distToTarget < stats.chaseRange || en.alertedT > 0;
    const lostRange = distToTarget > stats.loseRange;
    const hpFrac = en.hp / en.maxHp;
    const shouldRetreat = stats.retreatHpFrac > 0 && hpFrac <= stats.retreatHpFrac;

    if(shouldRetreat){ en.state = 'retreat'; }
    else if(inChaseRange){ en.state = 'chase'; }
    else if(lostRange){ en.state = 'wander'; }

    if(en.state === 'retreat'){
      // Badly damaged: run directly away from the target instead of standing and fighting.
      const away = p.clone().sub(tpos); away.y=0;
      if(away.lengthSq() > 0.01){ away.normalize(); const nx=p.x+away.x*en.speed*1.3*dt, nz=p.z+away.z*en.speed*1.3*dt;
        if(!blockedAt(nx,p.z,p.y-0.5)) p.x=nx; if(!blockedAt(p.x,nz,p.y-0.5)) p.z=nz; }
      p.y = groundTopAt(p.x,p.z) + stats.yOff;
      en.mesh.lookAt(tpos.x, p.y, tpos.z);
      // Recover enough to stop fleeing after a little distance/time, so retreat doesn't become permanent.
      if(distToTarget > stats.loseRange*0.9) en.state = 'wander';
    } else if(en.state === 'chase'){
      if(stats.ranged){
        // Ranged/elite: keep near a preferred distance rather than closing to melee - back off if too
        // close, approach if too far, strafe side to side while at range, and fire on cooldown.
        const dir = tpos.clone().sub(p); dir.y = 0; const dist = dir.length(); dir.normalize();
        const pref = stats.preferredDist || 8;
        if(dist > pref + 1.5){
          p.addScaledVector(dir, en.speed*dt);
        } else if(dist < pref - 1.5){
          p.addScaledVector(dir, -en.speed*0.8*dt);
        } else {
          // strafe: perpendicular to the target direction, flipping occasionally so it doesn't look robotic
          en.repositionT -= dt;
          if(en.repositionT <= 0){ en.repositionT = 1 + Math.random()*1.5; en.repositionDir *= -1; }
          const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(en.repositionDir);
          const nx = p.x + perp.x*en.speed*0.6*dt, nz = p.z + perp.z*en.speed*0.6*dt;
          if(!blockedAt(nx,p.z,p.y-0.5)) p.x = nx; if(!blockedAt(p.x,nz,p.y-0.5)) p.z = nz;
        }
        if(en.atkCd<=0 && dist < (stats.chaseRange)){
          en.atkCd = en.type==='elite' ? 1.1 : 1.6;
          const shotDir = tpos.clone().sub(p); shotDir.y = 0.15; shotDir.normalize();
          spawnProjectile(null, en.type==='elite'?0xff5a5a:0x5ac8ff, en.damage, stats.projSpeed||16, false, en.type==='elite'?'fire':null,
            { explicitDir: shotDir, explicitFrom: p.clone().add(new THREE.Vector3(0,0.6,0)), hostile:true });
        }
        // Elite occasionally also closes in for a melee hit if the target strays very close.
        if(en.type==='elite' && dist < 1.8 && en.atkCd<=0.4){
          en.atkCd = 0.9;
          if(player.alive && (tu.unit || player.invuln<=0)) hurtTarget(tu, en.damage*1.4);
        }
        p.y = groundTopAt(p.x,p.z) + stats.yOff;
        en.mesh.lookAt(tpos.x, p.y, tpos.z);
      } else {
        // Melee archetypes (normal, brute, speed): straightforward close-and-hit, same shared pattern,
        // differentiated purely by their stats (speed/damage/hp/retreat threshold from ENEMY_STATS).
        const dir = tpos.clone().sub(p); dir.y = 0; dir.normalize();
        if(distToTarget > 1.4){
          const nx=p.x+dir.x*en.speed*dt, nz=p.z+dir.z*en.speed*dt;
          if(!blockedAt(nx,p.z,p.y-0.5)) p.x=nx; if(!blockedAt(p.x,nz,p.y-0.5)) p.z=nz;
        } else if(en.atkCd<=0 && player.alive && (tu.unit || player.invuln<=0)){
          hurtTarget(tu, en.damage);
          en.atkCd = en.type==='brute' ? 1.6 : en.type==='speed' ? 0.9 : 1.2;
        }
        p.y = groundTopAt(p.x,p.z) + stats.yOff;
        en.mesh.lookAt(tpos.x, p.y, tpos.z);
      }
    } else {
      en.wanderT -= dt;
      if(en.wanderT<=0){
        en.target.set(en.home.x + (Math.random()-0.5)*6, 0, en.home.z + (Math.random()-0.5)*6);
        en.wanderT = 2 + Math.random()*3;
      }
      const dir = en.target.clone().sub(p); dir.y=0;
      if(dir.length()>0.3){ dir.normalize(); const nx=p.x+dir.x*en.speed*0.4*dt, nz=p.z+dir.z*en.speed*0.4*dt;
        if(!blockedAt(nx,p.z,p.y-0.5)) p.x=nx; if(!blockedAt(p.x,nz,p.y-0.5)) p.z=nz; }
      p.y = groundTopAt(p.x,p.z) + stats.yOff;
    }
  });
}

function flashDamage(){
  const el = document.getElementById('damage-overlay');
  el.style.boxShadow = 'inset 0 0 140px 30px rgba(255,0,0,0.55)';
  setTimeout(()=> el.style.boxShadow = 'inset 0 0 120px 20px rgba(255,0,0,0)', 200);
}

/* =========================================================================
   ATTACK (melee) + BLOCK BREAK/PLACE (shared crosshair raycast)
========================================================================= */
/* PROPS / ACTIONS / FX */

/* =========================================================================
   STAGE 6 — LOCK-ON (optional target lock; never mandatory)
   One shared target reference. Everything that needs "where should I aim?" asks lockAim()/lockedTarget()
   so melee, abilities, Sonic Doom and the XLR8 tackle all agree. Free camera swipes always win.
========================================================================= */
const LOCK_PICK_PX = 70;      // tap must land within this many screen px of a target's projected point
const LOCK_MAX_DIST = 34;     // can only acquire targets this close
const LOCK_BREAK_DIST = 44;   // auto-unlock beyond this (hysteresis > acquire distance)
const lock = { en:null, assistHold:0, popT:0 };
const _lv = new THREE.Vector3();
function lockValid(en){
  if(!en || !en.alive || en.state==='dead' || !en.mesh || !en.mesh.parent) return false;
  if(enemies.indexOf(en)<0) return false;
  return en.mesh.position.distanceTo(player.pos) <= LOCK_BREAK_DIST;
}
function lockedTarget(){ return lockValid(lock.en) ? lock.en : null; }
function lockCenter(en, out){ // chest-height aim point of a target
  out = out || new THREE.Vector3(); out.copy(en.mesh.position);
  out.y += en.npc ? 0.2 : 0.1; return out;
}
function setLock(en){
  if(lock.en===en) return;
  lock.en = en||null; lock.assistHold = 0;
  const mk=document.getElementById('lock-marker');
  if(en){
    lock.popT = 0.28; mk.classList.remove('pop'); void mk.offsetWidth; mk.classList.add('pop');
    const nm = en.npc ? (en.gang ? en.gang.name+' GANG' : 'CIVILIAN') : (en.type||'enemy').toUpperCase();
    document.getElementById('lock-name').textContent = nm;
    statusText('TARGET LOCKED'); Audio_.hit();
  } else { mk.style.display='none'; }
  const b=document.getElementById('lock-btn'); if(b) b.classList.toggle('on', !!en);
}
function unlockTarget(msg){ if(lock.en){ setLock(null); if(msg) statusText(msg); } }
// Screen-space pick: nearest projected target to the tap point. Forgiving on phones (fingers are big) and
// independent of mesh type (NPCs are Groups, enemies are Boxes).
function pickEnemyAtScreen(px, py){
  const w=innerWidth, h=innerHeight; let best=null, bd=1e9;
  for(let i=0;i<enemies.length;i++){
    const en=enemies[i]; if(!en.alive||en.state==='dead'||!en.mesh.parent) continue;
    const dist=en.mesh.position.distanceTo(player.pos); if(dist>LOCK_MAX_DIST) continue;
    lockCenter(en,_lv).project(camera);
    if(_lv.z>1||_lv.z<-1) continue; // behind camera / clipped
    const sx=(_lv.x*0.5+0.5)*w, sy=(-_lv.y*0.5+0.5)*h;
    const d=Math.hypot(sx-px, sy-py);
    const reach = LOCK_PICK_PX * (1 + Math.max(0,(12-dist))*0.012); // slightly more forgiving up close
    if(d<reach && d<bd){ bd=d; best=en; }
  }
  return best;
}
function tapLock(px,py){
  const hit=pickEnemyAtScreen(px,py);
  if(!hit) return false;
  if(lock.en===hit) unlockTarget('TARGET RELEASED'); else setLock(hit);
  return true;
}
// Button: lock nearest in front, or release if already locked.
function lockButton(){
  if(!player.alive) return;
  if(lockedTarget()){ unlockTarget('TARGET RELEASED'); return; }
  const f=flatFwd(player.yaw); let best=null, bs=1e9;
  enemies.forEach(en=>{
    if(!en.alive||en.state==='dead') return;
    const v=en.mesh.position.clone().sub(player.pos); v.y=0; const d=v.length(); if(d>LOCK_MAX_DIST||d<0.01) return;
    const ang=f.angleTo(v.normalize()); const score=d*(1+ang*1.2); // prefer close AND centred
    if(ang<1.9 && score<bs){ bs=score; best=en; }
  });
  if(best) setLock(best); else statusText('NO TARGET');
}
// Direction helpers other systems use. Return null when nothing is locked so callers keep their old behaviour.
function lockDirFrom(from){
  const t=lockedTarget(); if(!t) return null;
  const d=t.mesh.position.clone().sub(from); d.y=0; if(d.lengthSq()<0.0001) return null; return d.normalize();
}
// Face the locked target instantly (used at attack start). Only when it is roughly in front / close, so a
// stray lock on something behind you doesn't spin you around mid-run.
function faceLockedTarget(maxDist, maxAng){
  const t=lockedTarget(); if(!t) return false;
  const d=lockDirFrom(player.pos); if(!d) return false;
  const dist=t.mesh.position.distanceTo(player.pos); if(dist>maxDist) return false;
  const f=flatFwd(player.yaw); if(f.angleTo(d)>(maxAng||2.2)) return false;
  player.yaw=Math.atan2(-d.x,-d.z); return true;
}
// Snap yaw AND pitch at the locked target (used when firing an ability so shots go where the lock is).
function aimAtLock(){
  const t=lockedTarget(); if(!t) return false;
  const to=lockCenter(t,_lv).clone().sub(player.pos.clone().add(new THREE.Vector3(0,1.0,0)));
  const flat=Math.hypot(to.x,to.z); if(flat<0.05) return false;
  player.yaw=Math.atan2(-to.x,-to.z);
  player.pitch=THREE.MathUtils.clamp(Math.atan2(to.y,flat),-0.9,0.9);
  return true;
}
let lastUserLookT=0; // set by touch/mouse look so camera assist backs off while the player is steering
function noteUserLook(){ lastUserLookT=performance.now(); }
function updateLockOn(dt){
  const t=lockedTarget();
  if(lock.en && !t){ // died / too far / removed -> auto-unlock with feedback
    const dead = !lock.en.alive || lock.en.state==='dead';
    setLock(null); if(player.alive) statusText(dead?'TARGET DOWN':'TARGET LOST');
  }
  const btn=document.getElementById('lock-btn');
  const mk=document.getElementById('lock-marker');
  if(!t){ if(mk.style.display!=='none') mk.style.display='none'; return; }
  // ---- camera assist: ease yaw/pitch toward the target; yields to the player's own swipe ----
  const since=(performance.now()-lastUserLookT)/1000;
  const yielding = camTouchId!==null || since<0.35;      // finger on the look area / just stopped swiping
  if(player.alive && !yielding){
    const to=lockCenter(t,_lv).clone().sub(player.pos.clone().add(new THREE.Vector3(0,1.1,0)));
    const flat=Math.hypot(to.x,to.z);
    const wantYaw=Math.atan2(-to.x,-to.z);
    const wantPitch=THREE.MathUtils.clamp(Math.atan2(to.y,Math.max(flat,0.5)) - 0.08, -0.6, 0.7);
    let dy=wantYaw-player.yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy));
    const k=1-Math.exp(-dt*5.5);                          // frame-rate independent ease
    // Don't whip around 180 degrees when a target is directly behind: slow the turn when the error is huge.
    const cap = Math.abs(dy)>2.2 ? 0.5 : 1;
    player.yaw += dy*k*cap;
    player.pitch += (wantPitch-player.pitch)*k*0.6;
  }
  // ---- marker ----
  lockCenter(t,_lv); _lv.y += (t.npc?0.35:0.45);
  _lv.project(camera);
  const w=innerWidth,h=innerHeight;
  let sx=(_lv.x*0.5+0.5)*w, sy=(-_lv.y*0.5+0.5)*h;
  const behind=_lv.z>1;
  if(behind){ sx=w-sx; sy=h-sy; }
  const m=48, edge = behind || sx<m||sx>w-m||sy<m||sy>h-m;
  sx=Math.max(m,Math.min(w-m,sx)); sy=Math.max(m,Math.min(h-m,sy));
  if(mk.style.display!=='block') mk.style.display='block';
  mk.style.transform='translate('+sx.toFixed(1)+'px,'+sy.toFixed(1)+'px)';
  mk.classList.toggle('edge',edge);
  const hpEl=mk.querySelector('#lock-hp i'); const frac=Math.max(0,t.hp/(t.maxHp||t.hp||1));
  const wv=(frac*100).toFixed(0)+'%'; if(hpEl.dataset.w!==wv){ hpEl.dataset.w=wv; hpEl.style.width=wv; }
  if(btn) btn.classList.add('on');
}
function lookDir(){ return new THREE.Vector3(Math.cos(player.pitch)*-Math.sin(player.yaw),Math.sin(player.pitch),Math.cos(player.pitch)*-Math.cos(player.yaw)); }
function debris(pos,color,size,vel,life,grav){
  const mesh=new THREE.Mesh(DEB,new THREE.MeshBasicMaterial({color,transparent:true}));
  mesh.scale.setScalar(size); mesh.position.copy(pos); scene.add(mesh); const f={mesh,vel,life,max:life,grav}; fx.push(f); return f;
}
function updateFx(dt){
  for(let i=fx.length-1;i>=0;i--){
    const f=fx[i]; f.life-=dt; const m=f.mesh.position;
    if(f.grav){ f.vel.y+=GRAVITY*dt; }
    m.addScaledVector(f.vel,dt); if(f.grow) f.mesh.scale.multiplyScalar(1+f.grow*dt);
    if(f.grav){ const g=groundTopAt(m.x,m.z); if(m.y<g){ m.y=g; f.vel.set(0,0,0); } }
    f.mesh.material.opacity=Math.max(0,f.life/f.max);
    if(f.life<=0){ scene.remove(f.mesh); f.mesh.material.dispose(); fx.splice(i,1); }
  }
}
/* =========================================================================
   XLR8 SPEED EFFECTS  (pooled - a fixed number of meshes reused every frame,
   never allocated per frame, so this stays cheap on phones)
========================================================================= */
const BASE_FOV = 70, MAX_FOV_BOOST = 30;
const STREAK_COUNT = 14, DUST_COUNT = 12;
const streakGeo = new THREE.BoxGeometry(0.04, 0.04, 1);
const streakMat = new THREE.MeshBasicMaterial({color:0xbfe8ff, transparent:true, opacity:0, depthWrite:false});
const streaks = [];
for(let i=0;i<STREAK_COUNT;i++){
  const m = new THREE.Mesh(streakGeo, streakMat.clone());
  m.visible = false; m.frustumCulled = false; scene.add(m);
  streaks.push({mesh:m, seed:Math.random(), idx:i});
}
const dustGeo = new THREE.BoxGeometry(1,1,1);
const dustPuffs = [];
for(let i=0;i<DUST_COUNT;i++){
  const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({color:0xd8cdb0, transparent:true, opacity:0, depthWrite:false}));
  m.visible = false; m.frustumCulled = false; scene.add(m);
  dustPuffs.push({mesh:m, life:0, max:0.5});
}
let dustIdx = 0, dustEmitAcc = 0, lastFov = BASE_FOV, speedShakeT = 0;

function updateSpeedEffects(dt){
  const s = player.form.id==='xlr8' ? (player.superSpeed||0) : 0;

  // FOV widens with speed; only touch the projection matrix when the value actually changed.
  const targetFov = BASE_FOV + MAX_FOV_BOOST*s;
  const newFov = lastFov + (targetFov-lastFov)*Math.min(1, dt*6);
  if(Math.abs(newFov-lastFov) > 0.02){ lastFov = newFov; camera.fov = newFov; camera.updateProjectionMatrix(); }

  // Speed streaks: thin lines around the camera, stretched along the travel direction and sliding past.
  const showStreaks = s > 0.25;
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  for(const st of streaks){
    if(!showStreaks){ if(st.mesh.visible){ st.mesh.visible=false; st.mesh.material.opacity=0; } continue; }
    st.mesh.visible = true;
    // Each streak drifts backward past the player and wraps to the front when it passes behind.
    st.seed = (st.seed + dt*(1.2 + s*3.5)) % 1;
    const ang = (st.seed*7.3 + st.idx*0.9) % (Math.PI*2);
    const radius = 1.6 + ((st.idx*0.37)%1)*2.2;
    const along = 10 - st.seed*20; // +10 ahead ... -10 behind
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    st.mesh.position.copy(player.pos)
      .addScaledVector(fwd, along)
      .addScaledVector(side, Math.cos(ang)*radius)
      .add(new THREE.Vector3(0, 1 + Math.sin(ang)*radius*0.7, 0));
    st.mesh.rotation.y = player.yaw;
    st.mesh.scale.z = 1.5 + s*6; // longer streaks at higher speed
    st.mesh.material.opacity = Math.min(0.55, (s-0.25)*0.9);
  }

  // Ground dust trail: emit puffs at the feet at a rate scaled by speed, only while grounded.
  if(s > 0.15 && player.onGround && !player.flying && !player.swimming){
    dustEmitAcc += dt*(6 + s*22);
    while(dustEmitAcc >= 1){
      dustEmitAcc -= 1;
      const d = dustPuffs[dustIdx]; dustIdx = (dustIdx+1)%DUST_COUNT;
      d.life = d.max = 0.35 + Math.random()*0.25;
      d.mesh.visible = true;
      d.mesh.position.set(player.pos.x + (Math.random()-0.5)*0.6, groundTopAt(player.pos.x,player.pos.z)+0.15, player.pos.z + (Math.random()-0.5)*0.6);
      d.mesh.scale.setScalar(0.25 + s*0.35);
    }
  }
  for(const d of dustPuffs){
    if(d.life <= 0){ if(d.mesh.visible) d.mesh.visible=false; continue; }
    d.life -= dt;
    const k = Math.max(0, d.life/d.max);
    d.mesh.material.opacity = k*0.55;
    d.mesh.scale.multiplyScalar(1 + dt*2.2);
    d.mesh.position.y += dt*0.4;
  }

  // Continuous camera shake at extreme speed (separate from the one-shot shakeCamera used by impacts).
  if(s > 0.75){
    speedShakeT = (s-0.75)*0.16;
    camera.position.x += (Math.random()-0.5)*speedShakeT;
    camera.position.y += (Math.random()-0.5)*speedShakeT;
  }
}

function makeBoulder(x,y,z,s,color,car){
  const g=new THREE.Group(), m=new THREE.MeshLambertMaterial({color});
  if(car){
    const a=new THREE.Mesh(DEB,m), b=new THREE.Mesh(DEB,flat(0x9fd8ee)), w=new THREE.Mesh(DEB,flat(0x111111));
    a.scale.set(1,.42,2.1); a.position.y=-.25; b.scale.set(.85,.36,1); b.position.set(0,.13,-.1); w.scale.set(1.02,.14,1.7); w.position.y=-.45;
    a.castShadow=b.castShadow=true; g.add(a,b,w);
  } else {
    const a=new THREE.Mesh(DEB,m), b=new THREE.Mesh(DEB,m);
    b.scale.set(.7,.6,.7); b.position.set(.15,.55,.1); a.castShadow=b.castShadow=true; g.add(a,b);
  }
  g.scale.setScalar(s); g.rotation.y=Math.random()*3; g.position.set(x,y,z); scene.add(g);
  const p={mesh:g,s,vel:new THREE.Vector3(),state:'rest',color,car}; props.push(p); return p;
}
// (parked cars are now generated per-chunk in generateChunk(), see chunk.props.carRef)
function shatter(p,blast){
  const m=p.mesh.position.clone(); scene.remove(p.mesh); Audio_.breakBlock();
  for(let i=0;i<8;i++) debris(m,p.color,.35*p.s*(.5+Math.random()*.6),new THREE.Vector3((Math.random()-.5)*8,Math.random()*7,(Math.random()-.5)*8),2.5,true);
  if(blast){
    shockwaveAt(m,3.5,30,false); shakeCamera(.25);
    const gx=Math.round(m.x), gz=Math.round(m.z);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){ const h=columnHeight[colKey(gx+dx,gz+dz)]; if(h!==undefined&&h>-90) removeBlockAt(gx+dx,h,gz+dz); }
  }
}
function shatterNear(c,r){ for(let i=props.length-1;i>=0;i--){ const p=props[i]; if(p!==carried&&p.mesh.position.distanceTo(c)<r+p.s*.5){ shatter(p,false); props.splice(i,1); } } }
function smash(){
  player.attacking=.3; Audio_.attack(); shakeCamera(.25);
  const c=player.pos.clone().add(new THREE.Vector3(-Math.sin(player.yaw)*2.6,0,-Math.cos(player.yaw)*2.6));
  shatterNear(c,3.2); shockwaveAt(c,2.8,30,true);
  const r=raycastBlocks();
  if(r){ const [x,y,z]=r.blockPos; for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++) removeBlockAt(x+dx,y+dy,z+dz); }
}
function grabProp(){
  let best=null,bd=5.5;
  props.forEach(p=>{ const d=p.mesh.position.distanceTo(player.pos); if(p.state==='rest'&&d<bd){ best=p; bd=d; } });
  if(!best){
    const r=raycastBlocks(); if(!r){ statusText('NOTHING TO GRAB'); return; }
    const [x,y,z]=r.blockPos, b=blocks.get(keyOf(x,y,z)), type=b&&b.active?b.type:'stone';
    for(let dx=0;dx<=1;dx++)for(let dy=-1;dy<=0;dy++)for(let dz=0;dz<=1;dz++) removeBlockAt(x+dx,y+dy,z+dz);
    best=makeBoulder(x+.5,y+.5,z+.5,1.8,BLOCK_COLOR[type]||0x8a8a8a); Audio_.breakBlock(); statusText('RIPPED FROM GROUND');
  }
  carried=best; best.state='held'; best.vel.set(0,0,0);
}
function releaseProp(vel,state){ const p=carried; carried=null; p.state=state; p.vel.copy(vel); }
function throwProp(){ if(!carried) return; releaseProp(lookDir().multiplyScalar(24).add(new THREE.Vector3(0,3,0)),'thrown'); player.attacking=.3; Audio_.attack(); }
function dropProp(){ if(carried) releaseProp(new THREE.Vector3(),'fall'); }
function updateProps(dt){
  for(let i=props.length-1;i>=0;i--){
    const p=props[i], m=p.mesh.position;
    if(p===carried){ m.set(player.pos.x,player.pos.y+1.4+p.s*.5,player.pos.z); p.mesh.rotation.y+=dt*.6; continue; }
    if(p.state==='rest') continue;
    p.vel.y+=GRAVITY*dt; m.addScaledVector(p.vel,dt);
    const top=groundTopAt(m.x,m.z), gy=top+p.s*.5-.05; let hit=false;
    if(m.y<=gy){ hit=true; m.y=gy; } else if(top>m.y-p.s*.5+.7 && p.vel.length()>6) hit=true;
    if(p.state==='thrown') enemies.forEach(en=>{ if(en.alive&&m.distanceTo(en.mesh.position)<p.s+.6){ damageEnemy(en,35,p.vel.clone().normalize()); hit=true; } });
    if(hit){ if(p.state==='thrown'||p.vel.length()>14){ shatter(p,true); props.splice(i,1); } else { p.vel.set(0,0,0); p.state='rest'; } }
  }
}
function startDash(){
  const f={x:-Math.sin(player.yaw),z:-Math.cos(player.yaw)}, r={x:Math.cos(player.yaw),z:-Math.sin(player.yaw)};
  let mx=moveInput.x,my=moveInput.y; if(Math.hypot(mx,my)<.1){ mx=0; my=1; }
  const dx=f.x*my+r.x*mx, dz=f.z*my+r.z*mx, l=Math.hypot(dx,dz)||1;
  player.dashDir={x:dx/l,z:dz/l}; player.dashT=.28; Audio_.special();
}
function spawnTornado(){
  if(tornado) scene.remove(tornado.mesh);
  const g=new THREE.Group(), mat=new THREE.MeshBasicMaterial({color:0xbfe8ff,transparent:true,opacity:.35,side:THREE.DoubleSide});
  for(let i=0;i<7;i++){ const c=new THREE.Mesh(new THREE.CylinderGeometry(.6+i*.45,.5+i*.4,1.2,10,1,true),mat); c.position.y=.6+i*1.1; g.add(c); }
  g.position.set(player.pos.x,player.pos.y-1,player.pos.z); scene.add(g);
  tornado={mesh:g,dir:new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)),life:5,tick:0}; Audio_.special();
}
function updateTornado(dt){
  const T=tornado; if(!T) return; T.life-=dt;
  if(T.life<=0){ scene.remove(T.mesh); tornado=null; return; }
  const m=T.mesh.position; m.addScaledVector(T.dir,7*dt); m.y=groundTopAt(m.x,m.z);
  T.mesh.children.forEach((c,i)=>c.rotation.y+=dt*(8+i));
  T.tick-=dt; const tick=T.tick<=0; if(tick) T.tick=.3;
  enemies.forEach(en=>{ if(!en.alive) return; const d=en.mesh.position.clone().sub(m); d.y=0;
    if(d.length()<5){ en.mesh.position.x-=d.x*dt*2; en.mesh.position.z-=d.z*dt*2; en.mesh.position.y+=dt*3; if(tick) damageEnemy(en,12,new THREE.Vector3()); } });
  props.forEach(p=>{ if(p.state==='rest'&&p.mesh.position.distanceTo(m)<4.5){ p.state='thrown'; p.vel.set((Math.random()-.5)*14,14,(Math.random()-.5)*14); } });
}
let shield=null; const crystals=[];
function crystalShield(){
  player.shieldT=6; if(shield) scene.remove(shield); shield=new THREE.Group();
  const mt=new THREE.MeshBasicMaterial({color:0x9ffcff,transparent:true,opacity:.7});
  for(let i=0;i<8;i++){ const c=new THREE.Mesh(new THREE.OctahedronGeometry(.45),mt), a=i*Math.PI/4; c.scale.y=1.8; c.position.set(Math.cos(a)*1.7,1+(i%2)*.8,Math.sin(a)*1.7); shield.add(c); }
  scene.add(shield); Audio_.special();
}
function crystalWall(){
  const f={x:-Math.sin(player.yaw),z:-Math.cos(player.yaw)}, r={x:Math.cos(player.yaw),z:-Math.sin(player.yaw)};
  const mt=new THREE.MeshLambertMaterial({color:0x7ff5ee,transparent:true,opacity:.75,emissive:0x1a6b6b});
  for(let i=-3;i<=3;i++){
    const x=player.pos.x+f.x*3.5+r.x*i*1.1, z=player.pos.z+f.z*3.5+r.z*i*1.1, gy=groundTopAt(x,z);
    const m=new THREE.Mesh(UB,mt); m.scale.set(1.2,.01,1.2); m.position.set(x,gy,z); m.castShadow=true; scene.add(m);
    const col={x0:x-.6,x1:x+.6,z0:z-.6,z1:z+.6,top:gy+3.6}; colliders.push(col); crystals.push({m,col,gy,life:12,age:0});
  }
  shakeCamera(.15); Audio_.special();
}
function updateCrystals(dt){
  if(player.shieldT>0){
    player.shieldT-=dt; player.invuln=Math.max(player.invuln,.1);
    if(shield){ shield.position.set(player.pos.x,player.pos.y-1,player.pos.z); shield.rotation.y+=dt*3; if(player.shieldT<=0){ scene.remove(shield); shield=null; } }
  }
  for(let i=crystals.length-1;i>=0;i--){
    const c=crystals[i]; c.age+=dt; c.life-=dt;
    c.m.scale.y=Math.max(.01,Math.min(1,c.age*4)*Math.min(1,Math.max(0,c.life)*2)*3.6); c.m.position.y=c.gy+c.m.scale.y/2;
    if(c.life<=0){ scene.remove(c.m); const k=colliders.indexOf(c.col); if(k>=0) colliders.splice(k,1); crystals.splice(i,1); }
  }
}
/* ECHO ECHO SQUAD */
const squad=[]; let squadMode='bot', panelOpen=false, panelEls={};
const RING=new THREE.TorusGeometry(.5,.07,6,20);
function flatFwd(yaw){ return new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)); }
function ringFx(pos,dir,delay){
  const m=new THREE.Mesh(RING,new THREE.MeshBasicMaterial({color:0xcfefff,transparent:true,opacity:.9}));
  m.position.copy(pos).add(new THREE.Vector3(0,1,0)).addScaledVector(dir,.8+delay*10); m.lookAt(m.position.clone().add(dir)); scene.add(m);
  fx.push({mesh:m,vel:dir.clone().multiplyScalar(16),life:.55,max:.55,grow:3.2});
}
function sonicBlast(from,dir,dmg,range,rings){
  dir=dir.clone(); dir.y=0; if(dir.lengthSq()<.001) return; dir.normalize();
  for(let i=0;i<(rings||3);i++) ringFx(from,dir,i*.03);
  enemies.forEach(en=>{ if(!en.alive) return; const v=en.mesh.position.clone().sub(from); v.y=0; if(v.length()<range&&dir.angleTo(v.normalize())<.75) damageEnemy(en,dmg,dir); });
  // Alert nearby enemies to the scream even if they weren't directly hit by it - a Sonic Scream is loud,
  // so enemies in a wider radius around the source notice and start heading that way.
  enemies.forEach(en=>{ if(!en.alive||en.npc) return; if(en.mesh.position.distanceTo(from) < range*2) en.alertedT = Math.max(en.alertedT||0, 4); });
  props.forEach(p=>{ if(p.state!=='rest') return; const v=p.mesh.position.clone().sub(from); v.y=0; if(v.length()<range&&dir.angleTo(v.normalize())<.7){ p.state='fall'; p.vel.set(dir.x*11,5,dir.z*11); } });
  Audio_.special();
}
function splitEcho(){
  if(!squad.length) squad.push({model:player.model,pos:player.pos,vel:player.vel,yaw:player.yaw,health:player.health,energy:player.energy,active:true,n:0,walkT:0,cd:0,atkT:0});
  if(squad.length>=4){ statusText('MAX 4 ECHOS'); player.energy+=25; return; }
  let n=1; while(squad.some(u=>u.n===n)) n++;
  const r=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const model=buildCharacter('echo_echo'); model.scale.setScalar(PS); scene.add(model);
  const u={model,pos:player.pos.clone().addScaledVector(r,(squad.length%2?1:-1)*1.6),vel:new THREE.Vector3(),yaw:player.yaw,health:player.form.maxHealth,energy:player.form.maxEnergy,active:false,n,walkT:0,cd:0,atkT:0};
  model.rotation.y=u.yaw; squad.push(u);
  for(let i=0;i<6;i++) debris(u.pos.clone().add(new THREE.Vector3(0,1,0)),0xcfefff,.25,new THREE.Vector3((Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4),.5,false);
  panelOpen=true; renderSquad(); statusText('ECHO R'+n+' SPLIT'); Audio_.transform();
}
function loadUnit(u){
  u.active=true; player.model=u.model; player.pos.copy(u.pos); u.pos=player.pos; player.health=u.health; player.energy=u.energy; player.yaw=u.yaw;
  player.vel.set(0,0,0); player.flying=false; renderSquad(); statusText('CONTROLLING '+(u.n?'R'+u.n:'MAIN'));
}
function controlUnit(u){
  const a=squad.find(x=>x.active); if(!u||a===u) return;
  if(a){ a.active=false; a.pos=player.pos.clone(); a.health=player.health; a.energy=player.energy; a.yaw=player.yaw; }
  loadUnit(u);
}
function activeDied(){
  const a=squad.find(x=>x.active), others=squad.filter(x=>x!==a&&x.health>0); if(!a||!others.length) return false;
  scene.remove(player.model); squad.splice(squad.indexOf(a),1); a.active=false; loadUnit(others[0]); return true;
}
function clearSquad(){ squad.forEach(u=>{ if(!u.active) scene.remove(u.model); }); squad.length=0; panelOpen=false; renderSquad(); }
// Sonic Doom target: the locked enemy if there is one (any locked target, hostile or not: the player chose it),
// otherwise the old behaviour of the nearest hostile within 30.
function doomTargetPos(){
  const lt=lockedTarget(); if(lt) return lt.mesh.position.clone();
  let tp=null, bd=30; enemies.forEach(en=>{ if(!en.alive||(en.npc&&!en.aggro)) return; const d=en.mesh.position.distanceTo(player.pos); if(d<bd){ bd=d; tp=en.mesh.position.clone(); } });
  return tp;
}
function sonicDoom(){
  let tp=doomTargetPos();
  if(!tp) tp=player.pos.clone().addScaledVector(flatFwd(player.yaw),16);
  let fired=0;
  squad.forEach((u,i)=>{
    if(u.energy<30) return; fired++; if(u.active) player.energy-=30; else u.energy-=30;
    setTimeout(()=>{ const d=tp.clone().sub(u.pos); d.y=0; if(d.lengthSq()<.01) d.copy(flatFwd(u.yaw)); if(!u.active) u.yaw=Math.atan2(-d.x,-d.z); u.atkT=.25; sonicBlast(u.pos,d,45,22); shakeCamera(.2); },i*140);
  });
  if(!fired) statusText('NO ENERGY');
}
function renderSquad(){
  const box=document.getElementById('squad-panel'); box.innerHTML=''; panelEls={};
  if(squad.length<2||!panelOpen||player.form.id!=='echo_echo'){ box.style.display='none'; return; }
  box.style.display='flex';
  const add=(cls,html,fn)=>{ const d=document.createElement('div'); d.className=cls; d.innerHTML=html; const go=e=>{ fn(); e.preventDefault(); e.stopPropagation(); }; d.addEventListener('touchstart',go,{passive:false}); d.addEventListener('mousedown',go); box.appendChild(d); return d; };
  squad.slice().sort((a,b)=>a.n-b.n).forEach(u=>{ const el=add('chip',u.n?'R'+u.n:'M',()=>controlUnit(u)); panelEls[u.n]={el,u}; });
  add('chip mode'+(squadMode==='follow'?' on':''),'👣',()=>{ squadMode='follow'; renderSquad(); });
  add('chip mode'+(squadMode==='bot'?' on':''),'🤖',()=>{ squadMode='bot'; renderSquad(); });
}
function updateSquad(dt){
  if(!squad.length) return;
  const act=squad.find(u=>u.active); if(act){ act.health=player.health; act.energy=player.energy; act.yaw=player.yaw; }
  squad.forEach(tagUnit);
  squad.filter(u=>!u.active).forEach((u,idx)=>{
    if(u.health<=0){
      for(let i=0;i<8;i++) debris(u.pos.clone().add(new THREE.Vector3(0,1,0)),0xcfefff,.3,new THREE.Vector3((Math.random()-.5)*6,Math.random()*5,(Math.random()-.5)*6),.7,true);
      scene.remove(u.model); squad.splice(squad.indexOf(u),1); renderSquad(); statusText('R'+u.n+' DOWN'); return;
    }
    u.cd=Math.max(0,u.cd-dt); u.atkT=Math.max(0,u.atkT-dt); u.energy=Math.min(player.form.maxEnergy,u.energy+dt*8);
    let tgt=null, td=1e9;
    if(squadMode==='bot') enemies.forEach(en=>{ if(!en.alive||(en.npc&&!en.aggro)) return; const d=en.mesh.position.distanceTo(u.pos), dm=en.mesh.position.distanceTo(player.pos); const dd=Math.min(d,dm+3); if(dd<td&&(d<14||dm<12)){ td=dd; tgt=en; } });
    let goal, stop;
    if(tgt){ goal=tgt.mesh.position; stop=1.6; } else { const a=idx*2.1+Math.PI; goal=player.pos.clone().add(new THREE.Vector3(Math.cos(a)*2.6,0,Math.sin(a)*2.6)); stop=squadMode==='follow'?.6:2.5; }
    const dx=goal.x-u.pos.x, dz=goal.z-u.pos.z, d=Math.hypot(dx,dz); let moving=false;
    if(d>stop){ const sp=(d>10?9:5.4)*dt, nx=u.pos.x+dx/d*sp, nz=u.pos.z+dz/d*sp, fy=u.pos.y-1;
      if(!blockedAt(nx,u.pos.z,fy)) u.pos.x=nx; if(!blockedAt(u.pos.x,nz,fy)) u.pos.z=nz; moving=true; u.yaw=Math.atan2(-dx,-dz); }
    if(d>28) u.pos.set(player.pos.x+2,player.pos.y,player.pos.z);
    u.pos.y=groundTopAt(u.pos.x,u.pos.z)+1;
    if(tgt){ const ed=tgt.mesh.position.distanceTo(u.pos);
      if(ed<2.1&&u.cd<=0){ damageEnemy(tgt,9,new THREE.Vector3(dx,0,dz).normalize()); u.cd=.5; u.atkT=.25; u.punch=!u.punch; }
      else if(ed>=3&&ed<11&&u.energy>=20&&u.cd<=0){ u.energy-=20; u.cd=1.6; u.yaw=Math.atan2(-dx,-dz); sonicBlast(u.pos,flatFwd(u.yaw),22,11); } }
    const P=u.model.userData.parts; u.walkT+=moving?dt*9:0; const sw=moving?Math.sin(u.walkT)*.5:0;
    P.leftLeg.rotation.x=sw; P.rightLeg.rotation.x=-sw; P.leftArm.rotation.x=-sw*.8; P.rightArm.rotation.x=sw*.8;
    if(u.atkT>0) (u.punch?P.rightArm:P.leftArm).rotation.x=1.7*Math.sin(Math.min(1,u.atkT/.25)*Math.PI);
    u.model.position.set(u.pos.x,u.pos.y-1+.9*PS,u.pos.z); u.model.scale.setScalar(PS);
    let dy=u.yaw-u.model.rotation.y; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); u.model.rotation.y+=dy*Math.min(1,dt*12);
  });
  for(const k in panelEls){ const e=panelEls[k]; if(!e.u) continue; e.el.classList.toggle('sel',e.u.active); e.el.style.setProperty('--hp',Math.max(0,e.u.health/player.form.maxHealth*100)); }
}
function nearestTarget(p){
  let best={pos:player.pos,unit:null}, bd=p.distanceTo(player.pos);
  squad.forEach(u=>{ if(u.active) return; const d=p.distanceTo(u.pos); if(d<bd){ bd=d; best={pos:u.pos,unit:u}; } });
  return best;
}
/* STREAMS (flame / ice / doom) + ICE + UNIT TAGS */
const ices=[], iceMat=new THREE.MeshLambertMaterial({color:0xaee9ff,transparent:true,opacity:.7,emissive:0x1a5a7a});
let doomHeld=false, doomT=0, streamT=0, flameTime=0;
const isNight=()=>Math.sin(dayT*Math.PI*2)<0.15;
function addIce(pos,sx,sy,sz,ref,rot){
  if(ref&&ref.ice){ ref.ice.life=ref.ice.max; return; }
  const m=new THREE.Mesh(UB,iceMat.clone()); m.scale.set(sx,sy,sz); m.position.copy(pos); m.rotation.y=rot||0; scene.add(m);
  const ic={m,life:14,max:14,ref,sy}; if(ref) ref.ice=ic; ices.push(ic);
  if(!ref){ const crust=ices.filter(i=>!i.ref); if(crust.length>40) crust[0].life=0; }
}
function updateIces(dt){
  const rate=isNight()?2.5:1;
  for(let i=ices.length-1;i>=0;i--){
    const ic=ices[i]; ic.life-=dt*rate; const k=Math.max(0,Math.min(1,ic.life/(ic.max*.3)));
    ic.m.material.opacity=.15+.55*k; ic.m.scale.y=ic.sy*(.4+.6*k);
    if(ic.life<=0){ scene.remove(ic.m); ic.m.material.dispose(); if(ic.ref) ic.ref.ice=null; ices.splice(i,1); }
  }
}
function streamTick(kind,dt){
  const dir=lookDir(), from=player.pos.clone().add(new THREE.Vector3(0,.8,0)).addScaledVector(flatFwd(player.yaw),.7);
  const fire=kind==='fire', cols=fire?[0xff4a1a,0xff8a1e,0xffd84a]:[0xd8f8ff,0x8fe0ff,0xffffff];
  for(let i=0;i<2;i++){
    const v=dir.clone().multiplyScalar(fire?15:17).add(new THREE.Vector3((Math.random()-.5)*2.4,(Math.random()-.5)*2.4,(Math.random()-.5)*2.4));
    const f=debris(from.clone(),cols[rnd(3)],fire?.35+Math.random()*.25:.22+Math.random()*.2,v,fire?.5:.55,false);
    if(fire) f.grow=1.8;
  }
  streamT-=dt; if(streamT>0) return; streamT=.1;
  enemies.forEach(en=>{ if(!en.alive) return; const v=en.mesh.position.clone().sub(from);
    if(v.length()<9&&dir.angleTo(v.normalize())<.32){ damageEnemy(en,fire?5:2,null); if(!fire) addIce(en.mesh.position.clone(),1.3,1.9,1.3,en,0); } });
  let hit=null;
  for(let d=.8;d<9;d+=.5){
    const q=from.clone().addScaledVector(dir,d);
    if(q.y<groundTopAt(q.x,q.z)||blockedAt(q.x,q.z,q.y)){ hit={pos:q,type:'world'}; break; }
    const pr=props.find(p=>p!==carried&&p.mesh.position.distanceTo(q)<p.s*.9); if(pr){ hit={pos:pr.mesh.position.clone(),type:'prop',pr}; break; }
  }
  if(!hit) return;
  if(fire){ ices.forEach(ic=>{ if(ic.m.position.distanceTo(hit.pos)<3.5) ic.life-=4; }); }
  else if(hit.type==='prop'){ const p=hit.pr, s=p.s; p.car?addIce(hit.pos,s*1.15,s*.95,s*2.4,p,p.mesh.rotation.y):addIce(hit.pos,s*1.2,s*1.2,s*1.2,p,0); }
  else if(!ices.some(i=>!i.ref&&i.m.position.distanceTo(hit.pos)<1)) addIce(hit.pos,1.4,1.4,1.4,null,0);
}
function updateStreams(dt){
  const dn=player.form.id, fireOn=player.flameHeld&&dn==='heatblast', iceOn=player.sprayHeld&&dn==='diamondhead';
  if(fireOn) flameTime+=dt;
  if(fireOn||iceOn){
    if(player.energy<=0){ player.flameHeld=false; player.sprayHeld=false; }
    else if(iceOn||flameTime>.18){ player.energy=Math.max(0,player.energy-(fireOn?14:12)*dt); streamTick(fireOn?'fire':'ice',dt); }
  }
  if(doomHeld){
    if(dn!=='echo_echo'||!squad.some(u=>u.energy>=6)){ doomHeld=false; return; }
    doomT-=dt; if(doomT>0) return; doomT=.3;
    let tp=doomTargetPos();
    if(!tp) tp=player.pos.clone().addScaledVector(flatFwd(player.yaw),16);
    squad.forEach(u=>{
      if(u.energy<6) return; if(u.active) player.energy-=5.4; else u.energy-=5.4;
      const d=tp.clone().sub(u.pos); d.y=0; if(d.lengthSq()<.01) d.copy(flatFwd(u.yaw));
      if(!u.active){ u.yaw=Math.atan2(-d.x,-d.z); u.atkT=.25; }
      sonicBlast(u.pos,d,14,20,2);
    });
    shakeCamera(.1);
  }
}
const labTex={};
function labelTex(txt,on){
  const key=txt+on; if(labTex[key]) return labTex[key];
  const cv=document.createElement('canvas'); cv.width=128; cv.height=64; const g=cv.getContext('2d');
  g.fillStyle=on?'#39ff8a':'rgba(10,20,15,.85)'; g.strokeStyle=on?'#eafff2':'#39ff8a'; g.lineWidth=5;
  g.beginPath(); if(g.roundRect) g.roundRect(6,6,116,52,16); else g.rect(6,6,116,52); g.fill(); g.stroke();
  g.fillStyle=on?'#04140a':'#eafff2'; g.font='bold '+(txt.length>2?30:40)+'px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,64,35);
  return labTex[key]=new THREE.CanvasTexture(cv);
}
function tagUnit(u){
  const txt=u.n?'R'+u.n:'MAIN';
  if(!u.tag){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex(txt,false),depthTest:false,transparent:true})); s.scale.set(1.5,.75,1); s.position.y=1.9; s.renderOrder=10; u.model.add(s); u.tag=s; u._on=false; }
  if(u._on!==u.active){ u._on=u.active; u.tag.material.map=labelTex(txt,u.active); u.tag.material.needsUpdate=true; }
}
/* NPCs: civilians + gangs (share the `enemies` list so every power already hits them) */
const NG={ head:new THREE.BoxGeometry(.4,.4,.4), torso:new THREE.BoxGeometry(.55,.6,.3), arm:new THREE.BoxGeometry(.16,.55,.16).translate(0,-.275,0), leg:new THREE.BoxGeometry(.2,.65,.2).translate(0,-.325,0), cap:new THREE.BoxGeometry(.44,.14,.44) };
const nmats={}, nm=c=>nmats[c]||(nmats[c]=new THREE.MeshLambertMaterial({color:c}));
const flashMat=new THREE.MeshLambertMaterial({color:0xffffff,emissive:0xff3030});
const SKINS=[0xf1c8a0,0xd9a577,0xa8744a,0x6e4a2e], SHIRTS=[0x3a6ea8,0xc25a8a,0x8a9a3a,0xe0e0e0,0x8a5a2a,0x3a3a3a], PANTS=[0x2a2a3a,0x4a3a2a,0x1a3a5a];
const GANGS=[{name:'RED',col:0xb32222,home:[-30.5,17.5]},{name:'PURPLE',col:0x7a2fb3,home:[33.5,-14.5]},{name:'YELLOW',col:0xd8b81a,home:[1.5,-46.5]}].map(g=>({...g,size:4,members:[],respT:0}));
function makeNpcModel(skin,shirt,pants,cap){
  const g=new THREE.Group(), parts={};
  const mk=(geo,c,x,y,z)=>{ const m=new THREE.Mesh(geo,nm(c)); m.position.set(x,y,z); m.castShadow=true; g.add(m); return m; };
  const j=(c,x,y,z)=>mk(new THREE.SphereGeometry(.09,7,5),c,x,y,z);
  const limb=(x,y,color)=>{ const r=new THREE.Group(); const up=mk(new THREE.BoxGeometry(.16,.28,.16),color,0,0,0); up.geometry.translate(0,-.14,0); r.add(up); const e=new THREE.Mesh(new THREE.SphereGeometry(.08,7,5),nm(skin)); e.position.y=-.28; r.add(e); const lo=new THREE.Mesh(NG.arm,color===shirt?nm(shirt):nm(color)); lo.position.y=-.55; lo.geometry.translate(0,-.135,0); r.add(lo); r.userData.life={upper:up,lower:lo}; r.position.set(x,y,0); g.add(r); return r; };
  parts.torso=mk(NG.torso,shirt,0,.95,0); parts.head=mk(NG.head,skin,0,1.45,0); parts.neck=j(skin,0,1.22,0);
  parts.leftLeg=limb(-.13,.65,pants); parts.rightLeg=limb(.13,.65,pants);
  parts.leftArm=limb(-.37,1.22,shirt); parts.rightArm=limb(.37,1.22,shirt);
  if(cap) mk(NG.cap,cap,0,1.68,0);
  g.position.y=-.95; g.userData.life={t:Math.random()*6.28,phase:Math.random()*6.28}; return {g,parts,shirt};
}
function spawnNpc(gang,x,z){
  const gy=groundTopAt(x,z), gg=!!gang;
  const m=makeNpcModel(SKINS[rnd(4)],gg?gang.col:SHIRTS[rnd(6)],gg?0x1a1a1a:PANTS[rnd(3)],gg?gang.col:0);
  const root=new THREE.Group(); root.add(m.g); root.position.set(x,gy+.95*PRESENTATION.npcScale,z); root.scale.setScalar(PRESENTATION.npcScale); scene.add(root);
  const en={npc:true,gang:gang||null,mesh:root,parts:m.parts,shirt:m.shirt,hp:gg?60:40,maxHp:gg?60:40,speed:gg?2.6:2.2,damage:gg?8:5,armed:gg&&Math.random()<.5,
    atkCd:0,atk:0,punch:false,alive:true,state:'wander',hurtT:0,hurtDir:new THREE.Vector3(),impact:0,aggro:false,fear:0,fightT:0,wanderT:0,walkT:0,yaw:Math.random()*6.28,flash:0,
    home:new THREE.Vector3(x,0,z),target:new THREE.Vector3(x,0,z),threat:null};
  root.rotation.y=en.yaw; enemies.push(en); if(gang) gang.members.push(en); return en;
}
function sidewalkPoint(){
  const k=rnd(8), s=Math.random()<.5?4:15, along=(Math.random()-.5)*118;
  return Math.random()<.5?[-64+16*k+s,along]:[along,-64+16*k+s];
}
function pickTarget(en){
  for(let i=0;i<8;i++){
    const a=Math.random()*6.28, r=en.gang?2+Math.random()*4:4+Math.random()*10, x=en.home.x+Math.cos(a)*r, z=en.home.z+Math.sin(a)*r;
    if(Math.abs(x)>60||Math.abs(z)>60||blockedAt(x,z,GY)) continue;
    if(!en.gang&&zoneType(Math.round(x),Math.round(z))==='grass'&&Math.random()<.85) continue;
    en.target.set(x,0,z); return;
  }
  en.target.copy(en.mesh.position);
}
function hostile(m,secs){ if(m.alive&&m.state!=='dead'){ m.aggro=true; m.state='fight'; m.fightT=secs; } }
function provoke(en){
  if(en.state==='dead') return;
  en.threat=player.pos;
  if(en.gang){ if(!en.gang.members.some(m=>m.aggro)) statusText('⚠ '+en.gang.name+' GANG HOSTILE'); en.gang.members.forEach(m=>hostile(m,20)); }
  else if(!en.aggro){
    if(en.decided===undefined) en.decided=Math.random()<.35;
    if(en.decided) hostile(en,15); else { en.state='flee'; en.fear=7; }
  }
  enemies.forEach(o=>{
    if(!o.npc||!o.alive||o===en||o.mesh.position.distanceTo(en.mesh.position)>16) return;
    if(o.gang){ if(!o.aggro) o.gang.members.forEach(m=>hostile(m,20)); }
    else if(o.state!=='fight'&&o.state!=='flee'){ o.state='flee'; o.fear=5; o.threat=player.pos; }
  });
}
function npcHurt(en,dmg,dir,opts){
  const heavy = opts && opts.heavy;
  en.hp-=dmg; heavy?Audio_.heavyHit():Audio_.hit(); en.flash=heavy?0.2:0.12; en.parts.torso.material=flashMat;
  if(dir&&dir.lengthSq()>0){
    // Default shove is small; an explicit opts.knock (e.g. an XLR8 tackle) scales it up, clamped so a
    // single hit can never launch an NPC absurdly far. Still checked against walls.
    const shove = (opts && opts.knock!=null) ? Math.min(5, Math.max(heavy?1.1:.7, opts.knock*0.25)) : (heavy?1.1:.7);
    const q=en.mesh.position.clone().addScaledVector(dir,shove); if(!blockedAt(q.x,q.z,GY)){ en.mesh.position.x=q.x; en.mesh.position.z=q.z; }
  }
  provoke(en);
  if(en.hp<=0){ en.alive=false; en.state='dead'; en.deadT=4; if(lock.en===en) setLock(null); }
}
function hurtTarget(tu,dmg){
  if(tu.unit) tu.unit.health-=dmg;
  else if(player.alive&&player.invuln<=0){ player.health-=dmg; player.invuln=.4; flashDamage(); }
}
GANGS.forEach(g=>{ for(let i=0;i<g.size;i++) spawnNpc(g,g.home[0]+(Math.random()-.5)*5,g.home[1]+(Math.random()-.5)*5); });
for(let i=0;i<22;i++){ const s=sidewalkPoint(); spawnNpc(null,s[0],s[1]); }
let npcMgrT=0;
function updateNpcs(dt){
  npcMgrT-=dt;
  if(npcMgrT<=0){
    npcMgrT=4;
    if(enemies.filter(e=>e.npc&&!e.gang).length<22){ const s=sidewalkPoint(); if(Math.hypot(s[0]-player.pos.x,s[1]-player.pos.z)>30) spawnNpc(null,s[0],s[1]); }
    GANGS.forEach(g=>{ if(g.members.length<g.size&&g.respT<=0) spawnNpc(g,g.home[0]+(Math.random()-.5)*5,g.home[1]+(Math.random()-.5)*5); });
  }
  GANGS.forEach(g=>g.respT=Math.max(0,g.respT-dt));
  for(let i=enemies.length-1;i>=0;i--){
    const en=enemies[i]; if(!en.npc) continue;
    if(en.state==='dead'){
      en.deadT-=dt; en.mesh.rotation.x+=(-1.5-en.mesh.rotation.x)*Math.min(1,dt*8);
      if(en.deadT<=0){ scene.remove(en.mesh); enemies.splice(i,1); if(en.gang){ const k=en.gang.members.indexOf(en); if(k>=0) en.gang.members.splice(k,1); en.gang.respT=25; } }
      continue;
    }
    if(en.ice) continue;
    en.atkCd=Math.max(0,en.atkCd-dt); en.atk=Math.max(0,en.atk-dt);
    if(en.flash>0){ en.flash-=dt; if(en.flash<=0) en.parts.torso.material=nm(en.shirt); }
    const p=en.mesh.position; let goal=null, stop=.5, speed=en.speed*.6, aim=false;
    if(en.state==='fight'){
      const tu=nearestTarget(p), dx=tu.pos.x-p.x, dz=tu.pos.z-p.z, d=Math.hypot(dx,dz);
      en.fightT-=dt; if(d<12) en.fightT=Math.max(en.fightT,5);
      if(en.fightT<=0||d>45){ en.aggro=false; en.state='wander'; }
      else {
        speed=en.speed*1.6; goal=tu.pos; stop=1.3; en.yaw=Math.atan2(-dx,-dz);
        if(en.armed&&d>2.5&&d<14){
          stop=999; aim=true;
          if(en.atkCd<=0){ en.atkCd=1.4; const dir=new THREE.Vector3(dx,0,dz).normalize(); debris(p.clone().add(new THREE.Vector3(0,.2,0)),0xffe066,.14,dir.multiplyScalar(45),.15,false); if(Math.random()<.5) hurtTarget(tu,4); }
        } else if(d<1.5&&en.atkCd<=0){ en.atkCd=.9; en.atk=.25; en.punch=!en.punch; hurtTarget(tu,en.damage); }
      }
    } else if(en.state==='flee'){
      en.fear-=dt; const th=en.threat||player.pos, dx=p.x-th.x, dz=p.z-th.z, d=Math.hypot(dx,dz)||1;
      goal={x:p.x+dx/d*5,z:p.z+dz/d*5}; speed=en.speed*1.6; stop=.1; if(en.fear<=0) en.state='wander';
    } else {
      en.wanderT-=dt;
      if(en.wanderT<=0){ en.wanderT=2+Math.random()*4; if(Math.random()<(en.gang?.5:.2)) en.target.copy(p); else pickTarget(en); }
      goal=en.target;
    }
    let moving=false;
    if(goal){
      const dx=goal.x-p.x, dz=goal.z-p.z, d=Math.hypot(dx,dz);
      if(d>stop){ const nx=p.x+dx/d*speed*dt, nz=p.z+dz/d*speed*dt;
        if(!blockedAt(nx,p.z,GY)) p.x=nx; if(!blockedAt(p.x,nz,GY)) p.z=nz; moving=true; if(en.state!=='fight') en.yaw=Math.atan2(-dx,-dz); }
    }
    p.y=groundTopAt(p.x,p.z)+.95;
    let dy=en.yaw-en.mesh.rotation.y; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); en.mesh.rotation.y+=dy*Math.min(1,dt*10);
    animateCharacterLife(en.mesh,en.parts,moving,dt,en.type==='speed'?'speed':'enemy',Math.max(.8,en.speed/2.5));
    applyCombatBodyLanguage(en.mesh,en.parts,dt,en);
    en.walkT+=moving?dt*(speed>3?11:7):0; const sw=moving?Math.sin(en.walkT)*.6:0, P=en.parts;
    P.leftLeg.rotation.x=sw; P.rightLeg.rotation.x=-sw; P.leftArm.rotation.x=-sw*.8; P.rightArm.rotation.x=sw*.8;
    if(en.state==='flee'){ P.leftArm.rotation.x=P.rightArm.rotation.x=2.6; }
    if(aim) P.rightArm.rotation.x=1.55;
    if(en.atk>0) (en.punch?P.rightArm:P.leftArm).rotation.x=1.7*Math.sin(Math.min(1,en.atk/.25)*Math.PI);
    animateCharacterLife(en.mesh, P, moving, dt, 'npc', Math.max(.8,speed/2.5));
    applyCombatBodyLanguage(en.mesh,P,dt,en);
    if(en.flash>0){const hitBlend=Math.min(1,en.flash*7);P.torso.rotation.x+=.18*hitBlend;P.head.rotation.x-=.12*hitBlend;P.leftArm.rotation.x+=.28*hitBlend;P.rightArm.rotation.x+=.28*hitBlend;}
  }
}
function useAction(a,k){
  if(a.hold){ if(player.alive&&player.energy>4){ if(lockedTarget()) aimAtLock(); a.hold(true); } return; }
  if(!player.alive||(actCd[k]||0)>0||player.energy<a.cost) return;
  if(lockedTarget()) aimAtLock(); // abilities fire toward the locked target
  player.energy-=a.cost; actCd[k]=a.cd; a.run();
}
function buildActions(){
  const box=document.getElementById('actions'); box.innerHTML=''; actEls=[];
  (player.form.actions||[]).forEach((a,i)=>{
    const b=document.createElement('div'); b.className='abtn act'; box.appendChild(b); actEls.push(b);
    const go=e=>{ Audio_.resume(); useAction(a,i); e.preventDefault(); };
    b.addEventListener('touchstart',go,{passive:false}); b.addEventListener('mousedown',go);
    if(a.hold){ const up=e=>{ a.hold(false); e.preventDefault(); }; ['touchend','touchcancel'].forEach(n=>b.addEventListener(n,up,{passive:false})); ['mouseup','mouseleave'].forEach(n=>b.addEventListener(n,up)); }
  });
}
function applyCombatBodyLanguage(model, parts, dt, state){
  if(!model || !parts || !state) return;
  const spring=(o,k,t,r)=>{ if(o) o.rotation[k] += (t-o.rotation[k])*Math.min(1,dt*r); };
  const hurt=Math.max(0,state.hurtT||0);
  if(hurt>0){
    state.hurtT=Math.max(0,hurt-dt);
    const q=Math.sin(Math.min(1,hurt/0.34)*Math.PI);
    const dx=state.hurtDir?.x||0, dz=state.hurtDir?.z||0;
    const side=(dx*Math.cos(model.rotation.y)-dz*Math.sin(model.rotation.y));
    const back=(dx*Math.sin(model.rotation.y)+dz*Math.cos(model.rotation.y));
    if(parts.torso){ spring(parts.torso,'z',side*0.20*q,10); spring(parts.torso,'x',-back*0.16*q,10); }
    if(parts.head) spring(parts.head,'z',-side*0.10*q,10);
    if(parts.leftArm) spring(parts.leftArm,'x',-0.35*q,11);
    if(parts.rightArm) spring(parts.rightArm,'x',-0.35*q,11);
    if(parts.leftLeg) spring(parts.leftLeg,'x',0.18*q,9);
    if(parts.rightLeg) spring(parts.rightLeg,'x',0.18*q,9);
  }
  const impact=model.userData.impact||0;
  if(impact>0){
    model.userData.impact=Math.max(0,impact-dt*4.5);
    const q=impact;
    if(parts.torso) spring(parts.torso,'x',-0.24*q,12);
    if(parts.pelvis) spring(parts.pelvis,'x',0.08*q,10);
  }
}

function animateCharacterLife(model,parts,moving,dt,style='humanoid',speedFactor=1){
  if(!model||!parts) return;
  const L=model.userData.life||(model.userData.life={t:0,phase:0,breath:0,motion:0});
  L.motion=(L.motion||0)+((moving?1:0)-(L.motion||0))*Math.min(1,dt*(moving?10:7));
  L.t+=dt*(1.8+7.2*L.motion*speedFactor); L.breath+=dt*(moving?2.5:1.15);
  const gait=Math.sin(L.t), idle=Math.sin(L.breath+L.phase), gaitOpp=-gait;
  const bob=(moving?Math.abs(gait)*.055:Math.sin(L.breath*.7+L.phase)*.012)*L.motion;
  const spring=(o,k,t,r)=>{if(o)o.rotation[k]+=(t-o.rotation[k])*Math.min(1,dt*r)};
  const arms=['leftArm','rightArm','leftArm2','rightArm2'];
  if(style==='cannonbolt') return;
  if(parts.pelvis){spring(parts.pelvis,'z',-gait*.045*L.motion+idle*.01,7);spring(parts.pelvis,'x',-.035*L.motion+Math.abs(gait)*.018*L.motion,6);parts.pelvis.position.y+=bob-(parts.pelvis.userData._bob||0);parts.pelvis.userData._bob=bob;}
  if(parts.torso){spring(parts.torso,'z',gait*.065*L.motion+idle*.018*(1-L.motion),7);spring(parts.torso,'y',-gait*.025*L.motion,5);spring(parts.torso,'x',-.045*L.motion,5);}
  if(parts.neck)spring(parts.neck,'x',-gait*.018*L.motion,8);
  if(parts.head){spring(parts.head,'y',(moving?gaitOpp*.035:idle*.055),5);spring(parts.head,'z',-gait*.018*L.motion,5);spring(parts.head,'x',-.025*L.motion+idle*.008*(1-L.motion),4);}
  if(L.motion>.01){
    if(parts.leftLeg){spring(parts.leftLeg,'x',gait*.52,10);if(parts.leftLeg.userData.life?.lower)spring(parts.leftLeg.userData.life.lower,'x',Math.max(0,-gait)*.30+Math.max(0,gait)*-.08,11);}
    if(parts.rightLeg){spring(parts.rightLeg,'x',-gait*.52,10);if(parts.rightLeg.userData.life?.lower)spring(parts.rightLeg.userData.life.lower,'x',Math.max(0,gait)*.30+Math.max(0,-gait)*-.08,11);}
    arms.forEach((n,i)=>{const a=parts[n];if(!a?.userData?.life)return;const side=i%2?1:-1;spring(a,'x',side*gait*.30,8);if(a.userData.life.lower)spring(a.userData.life.lower,'x',side*Math.max(0,-gait)*.18,9);if(a.userData.life.wrist)spring(a.userData.life.wrist,'z',side*gait*.015,7);});
    ['shoulderL','shoulderR','shoulderL2','shoulderR2'].forEach((n,i)=>{const j=parts[n];if(j)spring(j,'z',(i%2?-.035:.035)*L.motion,6);});
  }else{
    arms.forEach(n=>{const a=parts[n];if(a?.userData?.life){spring(a,'x',0,5);if(a.userData.life.lower)spring(a.userData.life.lower,'x',0,5);}});
    ['leftLeg','rightLeg'].forEach(n=>{const a=parts[n];if(a){spring(a,'x',0,5);if(a.userData.life?.lower)spring(a.userData.life.lower,'x',0,5);}});
    ['shoulderL','shoulderR','shoulderL2','shoulderR2'].forEach(n=>{const j=parts[n];if(j)spring(j,'z',idle*.012,4);});
  }
  if(model.userData.kind==='four_arms'){if(parts.torso)spring(parts.torso,'x',-.065*L.motion,5);if(parts.head)spring(parts.head,'y',gaitOpp*.022,5);}
  else if(model.userData.kind==='xlr8'||style==='speed'){if(parts.torso)spring(parts.torso,'x',-.11*L.motion,7);if(parts.head)spring(parts.head,'x',-.045*L.motion,7);}
  else if(model.userData.kind==='echo_echo'){if(parts.torso)spring(parts.torso,'z',gait*.085*L.motion,8);}
}
function applyAlienBiomechanics(model,parts,moving,dt,speedMult=1){
  if(!model||!parts) return;
  const id=model.userData.kind||player.form?.id||'ben';
  const B=model.userData.bio||(model.userData.bio={t:Math.random()*6.28,phase:Math.random()*6.28,lastSpeed:0,rollPhase:0});
  const speedNow=player.form?.speed||4;
  const speedRatio=Math.min(3,Math.max(0,speedMult||1));
  B.t += dt*(moving ? 3.5+speedNow*0.9*speedRatio : 1.2);
  const s=Math.sin(B.t+B.phase), c=Math.cos(B.t+B.phase);
  const superS=player.form?.id==='xlr8'?Math.max(0,player.superSpeed||0):0;
  const roll=player.form?.id==='cannonbolt'?Math.max(0,player.rollT||0):0;
  const spring=(o,k,target,rate)=>{if(o)o.rotation[k]+=(target-o.rotation[k])*Math.min(1,dt*rate);};
  const posSpring=(o,k,target,rate)=>{if(o)o.position[k]+=(target-o.position[k])*Math.min(1,dt*rate);};
  const movingQ=moving?1:0;

  if(id==='four_arms'){
    // Four Arms carries his mass through the hips and shoulders. The upper pair leads,
    // the lower pair lags slightly, and each foot plants with a visible weight transfer.
    const heavy=0.55+0.45*Math.min(1,speedRatio);
    if(parts.pelvis) spring(parts.pelvis,'z',-s*.10*movingQ,5.5);
    if(parts.torso){spring(parts.torso,'x',-.10*movingQ-heavy*.035,4.8);spring(parts.torso,'z',s*.075*movingQ,4.8);}
    if(parts.head) spring(parts.head,'z',-s*.035*movingQ,5.5);
    if(parts.leftLeg) spring(parts.leftLeg,'x',s*.42*movingQ,6.5);
    if(parts.rightLeg) spring(parts.rightLeg,'x',-s*.42*movingQ,6.5);
    if(parts.leftArm) spring(parts.leftArm,'x',-s*.24*movingQ,5.2);
    if(parts.rightArm) spring(parts.rightArm,'x',s*.24*movingQ,5.2);
    if(parts.leftArm2) spring(parts.leftArm2,'x',-s*.34*movingQ+c*.07*movingQ,4.5);
    if(parts.rightArm2) spring(parts.rightArm2,'x',s*.34*movingQ-c*.07*movingQ,4.5);
    if(player.onGround && player.landingT>0){
      const lk=(player.landingT/.18)*player.landingStrength;
      if(parts.pelvis) posSpring(parts.pelvis,'y',parts.pelvis.userData.bioBaseY??parts.pelvis.position.y,10);
      model.scale.y=Math.max(.001,(1-(lk*.045)));
    }
  } else if(id==='xlr8'){
    // XLR8 is aerodynamic: the pelvis turns first, the chest and head stabilize behind it,
    // and the limbs cycle faster as the speed charge rises. Deceleration leaves a brief recovery sway.
    const fast=superS>0.03 ? (0.7+superS*1.8) : 0;
    const stride=movingQ*(0.45+fast*.55);
    const lean=-(0.10+superS*.52)*movingQ;
    if(parts.pelvis) spring(parts.pelvis,'y',-s*.025*stride,9);
    if(parts.torso){spring(parts.torso,'x',lean,9);spring(parts.torso,'z',s*.055*stride,10);}
    if(parts.head){spring(parts.head,'x',-lean*.42,11);spring(parts.head,'z',-s*.045*stride,11);}
    if(parts.neck) spring(parts.neck,'x',lean*.22,10);
    if(parts.leftLeg) spring(parts.leftLeg,'x',s*(.65+fast*.48),13);
    if(parts.rightLeg) spring(parts.rightLeg,'x',-s*(.65+fast*.48),13);
    if(parts.leftArm) spring(parts.leftArm,'x',-s*(.32+fast*.22),12);
    if(parts.rightArm) spring(parts.rightArm,'x',s*(.32+fast*.22),12);
    // At high speed the shoulders bank into turns rather than staying square to the camera.
    const turn=player.moveInput?.x||0;
    if(parts.shoulderL) spring(parts.shoulderL,'z',-turn*(.12+superS*.18),8);
    if(parts.shoulderR) spring(parts.shoulderR,'z',-turn*(.12+superS*.18),8);
  } else if(id==='heatblast'){
    // Heatblast's body follows the flame: loose shoulders, fluid arms, and a buoyant torso.
    const airborne=player.flying?1:0;
    const heat=0.75+airborne*.35+(player.boostT>0?.35:0);
    if(parts.pelvis) spring(parts.pelvis,'z',s*.045*heat,5);
    if(parts.torso){spring(parts.torso,'x',(player.flying&&moving)?-.22:0,6);spring(parts.torso,'z',s*.10*heat,5);}
    if(parts.head) spring(parts.head,'z',-s*.06*heat,5);
    if(parts.leftArm) spring(parts.leftArm,'x',-1.05+s*.16*heat,5.5);
    if(parts.rightArm) spring(parts.rightArm,'x',-1.05-s*.16*heat,5.5);
    if(parts.leftLeg) spring(parts.leftLeg,'x',.12+s*.12*airborne,5);
    if(parts.rightLeg) spring(parts.rightLeg,'x',.12-s*.12*airborne,5);
    if(airborne){
      const buoy=Math.sin(B.t*.72+B.phase)*.045;
      posSpring(parts.torso,'y',(parts.torso.userData.bioBaseY??parts.torso.position.y)+buoy,4);
    }
  } else if(id==='diamondhead'){
    // Diamondhead is rigid and crystalline: less flex, delayed limb motion, and a deliberate
    // shoulder-to-hip counter-rotation instead of rubbery humanoid sway.
    if(parts.pelvis) spring(parts.pelvis,'z',-s*.035*movingQ,3.8);
    if(parts.torso){spring(parts.torso,'x',-.045*movingQ,3.6);spring(parts.torso,'z',s*.035*movingQ,3.8);}
    if(parts.head) spring(parts.head,'z',-s*.018*movingQ,3.4);
    if(parts.leftLeg) spring(parts.leftLeg,'x',s*.34*movingQ,5.0);
    if(parts.rightLeg) spring(parts.rightLeg,'x',-s*.34*movingQ,5.0);
    if(parts.leftArm) spring(parts.leftArm,'x',-s*.16*movingQ,4.2);
    if(parts.rightArm) spring(parts.rightArm,'x',s*.16*movingQ,4.2);
    if(player.flying){
      if(parts.leftArm) spring(parts.leftArm,'z',-.12,3.5);
      if(parts.rightArm) spring(parts.rightArm,'z',.12,3.5);
    }
  } else if(id==='echo_echo'){
    // Echo Echo is small and springy: short steps, quick head correction, and a tiny rebound
    // after impacts/landings to make the body feel lighter than the heavy aliens.
    const bounce=movingQ?Math.abs(s):Math.max(0,Math.sin(B.t*1.7+B.phase));
    if(parts.pelvis) spring(parts.pelvis,'z',s*.065*movingQ,8.5);
    if(parts.torso){spring(parts.torso,'x',-bounce*.055*movingQ,8);spring(parts.torso,'z',s*.10*movingQ,8.5);}
    if(parts.head){spring(parts.head,'z',-s*.075*movingQ,10);spring(parts.head,'y',c*.045*movingQ,9);}
    if(parts.leftLeg) spring(parts.leftLeg,'x',s*.58*movingQ,12);
    if(parts.rightLeg) spring(parts.rightLeg,'x',-s*.58*movingQ,12);
    if(parts.leftArm) spring(parts.leftArm,'x',-s*.38*movingQ,10);
    if(parts.rightArm) spring(parts.rightArm,'x',s*.38*movingQ,10);
  } else if(id==='cannonbolt'){
    // Rolling inertia: the shell builds rotation with speed, compresses into the ground on contact,
    // then slowly releases instead of instantly snapping upright.
    B.rollPhase += dt*(3+roll*18);
    if(roll>0.02){
      const squash=1+Math.sin(B.rollPhase)*.025*roll;
      model.scale.y*=Math.max(.001,1-roll*.06);
      model.scale.x*=squash;
      model.scale.z*=squash;
      if(parts.shell) parts.shell.rotation.z += dt*(8+roll*20);
    } else if(player.onGround){
      const lk=player.landingT>0?(player.landingT/.18)*player.landingStrength:0;
      if(parts.shell) parts.shell.scale.y += ((1-lk*.07)-parts.shell.scale.y)*Math.min(1,dt*7);
    }
  } else {
    // Ben stays closest to a natural human baseline: quiet torso counter-sway and head stabilization.
    if(parts.pelvis) spring(parts.pelvis,'z',-s*.035*movingQ,6);
    if(parts.torso) spring(parts.torso,'z',s*.045*movingQ,6);
    if(parts.head) spring(parts.head,'z',-s*.025*movingQ,6);
  }
  B.lastSpeed += ((moving?speedRatio:0)-B.lastSpeed)*Math.min(1,dt*5);
}

function poseExtras(parts,moving,dt){
  const m=player.model; let lean=0;
  player.animT=(player.animT||0)+dt*(player.swimming?5:10);
  const A=player.animT, S=Math.sin(A);
  if(player.flying){
    const lv=player.form.id==='diamondhead';
    lean=lv?(moving?-.35:0):(moving?-(Math.PI/2-player.pitch):-.12);
    const up=lv?1.0:(moving?2.9+S*.08:.5);
    if(lv&&(player._cl=(player._cl||0)+dt)>.09){ player._cl=0; debris(player.pos.clone().add(new THREE.Vector3(0,-.95,0)),0x9ffcff,.8,new THREE.Vector3(),1.4,false); }
    ['leftArm','rightArm'].forEach(k=>{ if(parts[k]) parts[k].rotation.x=up; });
    if(parts.leftLeg){ parts.leftLeg.rotation.x=.15+S*.1; parts.rightLeg.rotation.x=.15-S*.1; }
    if(player.form.id==='heatblast'&&moving&&(player._fl=(player._fl||0)+dt)>.03){
      player._fl=0; debris(player.pos.clone().add(new THREE.Vector3((Math.random()-.5)*.4,-.4,(Math.random()-.5)*.4)),Math.random()<.5?0xff7a1a:0xffd84a,.45,new THREE.Vector3(),.45,false);
    }
  } else if(player.swimming){
    lean=moving?-(Math.PI/2-player.pitch*.7):-.1;
    const a=moving?1.5+S*1.5:.6+S*.4, b=moving?1.5-S*1.5:.6-S*.4;
    if(parts.leftArm) parts.leftArm.rotation.x=a; if(parts.rightArm) parts.rightArm.rotation.x=b;
    if(parts.leftLeg){ parts.leftLeg.rotation.x=Math.sin(A*2)*.4; parts.rightLeg.rotation.x=-Math.sin(A*2)*.4; }
  }
  if(carried) ['leftArm','rightArm','leftArm2','rightArm2'].forEach(k=>{ if(parts[k]) parts[k].rotation.x=3; });
  // (the old per-frame debris() blue trail was removed: it allocated a new material every frame; speed trails are now pooled in updateSpeedEffects)
  if((player.superT||0)>0.2&&!player.flying&&!player.swimming){ lean=-.6*player.superT; ['leftArm','rightArm'].forEach(k=>{ if(parts[k]) parts[k].rotation.x=-1.3; }); }
  m.rotation.x+=(lean-m.rotation.x)*.18;
}
const raycaster = new THREE.Raycaster();
const centerNDC = new THREE.Vector2(0,0);
let selectedBlockType = 'grass';

// Per-alien melee flavor: called from meleeAttack at the moment a hit actually lands, so each
// alien's punch can carry a distinct extra effect on top of the shared combo/damage/knockback system.
// Nothing here replaces the combo logic itself — these are additive flourishes per form.
function alienMeleeFx(formId, hitPos, heavy){
  switch(formId){
    case 'four_arms':
      // Heavier build already gets more damage/knockback via the combo multipliers below;
      // the finisher also gets a small ground-shock so it reads as genuinely powerful.
      if(heavy) shockwaveAt(hitPos, 2.2, 0, false);
      break;
    case 'heatblast':
      debris(hitPos.clone().add(new THREE.Vector3(0,0.3,0)), Math.random()<0.5?0xff7a1a:0xffd84a, 0.35, new THREE.Vector3((Math.random()-0.5)*2,1.5,(Math.random()-0.5)*2), 0.4, true);
      break;
    case 'diamondhead':
      debris(hitPos.clone().add(new THREE.Vector3(0,0.2,0)), 0x9ffcff, 0.3, new THREE.Vector3((Math.random()-0.5)*3,2,(Math.random()-0.5)*3), 0.5, true);
      break;
    case 'cannonbolt':
      if(heavy) shakeCamera(0.15);
      break;
    // xlr8, echo_echo: no extra VFX — their distinctiveness is speed/timing (see combo tuning below), not particles.
  }
}

// Per-alien combo tuning layered on top of the base form stats already in ALIENS/BEN. Every alien still
// uses the same shared 3-hit combo (left/right/heavy) and the same hit-detection/animation-timing system;
// only the numbers and the punch-animation shape change per alien, so nothing about the underlying
// combat system is duplicated per alien.
const MELEE_TUNING = {
  four_arms:   { comboMul:[1, 1, 2.0], knock:[0.6, 0.6, 7],   speed:0.85 }, // heavier, slower, big finisher
  heatblast:   { comboMul:[1, 1, 1.6], knock:[0.6, 0.6, 4],   speed:1.0 },
  xlr8:        { comboMul:[0.85, 0.85, 1.3], knock:[0.4, 0.4, 3], speed:1.7 }, // rapid strikes: faster combo, lighter finisher
  diamondhead: { comboMul:[1, 1, 1.8], knock:[0.7, 0.7, 5], speed:0.95 }, // crystal-enhanced: extra knockback
  echo_echo:   { comboMul:[0.8, 0.8, 1.2], knock:[0.4, 0.4, 3], speed:1.3 }, // small physical attack, sonic is the main kit
  cannonbolt:  { comboMul:[1, 1, 1.7], knock:[0.6, 0.6, 6],   speed:1.0 },
  ben:         { comboMul:[1, 1, 1.6], knock:[0.5, 0.5, 5], speed:1.0 },
};

function meleeAttack(){
  if(player.atkTimer > 0 || !player.alive) return;
  const tuning = MELEE_TUNING[player.form.id] || MELEE_TUNING.ben;

  // Combo state: step 0 = left punch, 1 = right punch, 2 = heavy finisher, then wraps back to 0.
  // If the player waited too long since the last hit, comboResetTimer will have already hit 0 (see
  // updatePlayer), so comboStep resets to 0 there rather than here.
  // Lock-on: snap to face the locked target (if it's close enough to be a melee target), so the swing and
  // its hit cone both point at it even if the camera assist hasn't finished turning yet.
  faceLockedTarget(player.form.atkRange + 4.5, 2.4);
  const step = player.comboStep;
  const isHeavy = step === 2;
  const punchKind = step===0 ? 'left' : step===1 ? 'right' : 'heavy';
  const animDur = (isHeavy ? 0.34 : 0.22) / tuning.speed;

  player.atkTimer = player.form.atkCooldown * (isHeavy ? 1.4 : 1) / tuning.speed;
  player.attacking = animDur;
  player.impactKick = 0.18 + (isHeavy ? 0.10 : 0);
  player.impactLean = isHeavy ? 0.18 : 0.10;
  player.punchKind = punchKind;
  player.punchAnimDur = animDur;
  player.punchAnimT = animDur;
  player.punchSide = step===1; // right arm on punch 2, left on punch 1 and the heavy (two-handed) finisher
  player.comboResetTimer = 0.9; // waiting longer than this after a hit drops the combo back to punch 1
  player.comboStep = (step + 1) % 3;

  Audio_.attack();

  // Hit detection fires at roughly the midpoint of the swing, not on button press, so the punch
  // animation and the actual impact line up instead of enemies taking damage before the fist arrives.
  const hitDelay = animDur * (isHeavy ? 0.45 : 0.4);
  const originPos = player.pos.clone();
  const yawAtSwing = player.yaw;
  const swingLockEn = lockedTarget(); // the target this swing was aimed at (may move before impact)
  setTimeout(()=>{
    if(!player.alive) return;
    let forward = new THREE.Vector3(-Math.sin(yawAtSwing),0,-Math.cos(yawAtSwing));
    // If the swing was aimed at a locked target that is still valid and in reach, re-aim the cone at where
    // it is NOW: the target may have been knocked/strafed during the wind-up. Still only hits what is in
    // front of that line, so enemies behind the player remain safe.
    if(swingLockEn && lockValid(swingLockEn)){
      const lv=swingLockEn.mesh.position.clone().sub(originPos); lv.y=0;
      if(lv.length()<player.form.atkRange+1.2 && lv.lengthSq()>0.0001) forward = lv.normalize();
    }
    const dmg = player.form.atkDamage * tuning.comboMul[step];
    const knock = tuning.knock[step];
    // Combo hits 2 and 3 get a small range buffer: a real combo flurry involves stepping into the
    // target, and without this, a hit's own knockback can push the enemy just outside the range of
    // the very next hit in the same combo, silently breaking combos on a stationary target.
    const effectiveRange = player.form.atkRange + (step>0 ? 0.35 : 0);
    let hitSomething = false;
    enemies.forEach(en=>{
      if(!en.alive) return;
      const toEnemy = en.mesh.position.clone().sub(originPos); toEnemy.y=0;
      const dist = toEnemy.length();
      if(dist < effectiveRange){
        const angle = forward.angleTo(toEnemy.normalize());
        if(angle < 0.6){ // narrow frontal cone (~34 degrees each side) - enemies behind or well to the side are not hit
          const hitDir = toEnemy.normalize();
          damageEnemy(en, dmg, hitDir, { heavy:isHeavy, knock });
          player.impactKick = isHeavy ? 1 : 0.7;
          // A tiny forward body commitment makes melee feel physical without changing collision.
          if(player.onGround){ player.pos.x += hitDir.x * (isHeavy?0.055:0.025); player.pos.z += hitDir.z * (isHeavy?0.055:0.025); }
          alienMeleeFx(player.form.id, en.mesh.position.clone(), isHeavy);
          hitSomething = true;
        }
      }
    });
    if(!hitSomething && player.form.id==='four_arms') tryBreakBlock();
  }, hitDelay*1000);
}

function raycastBlocks(){
  const o=camera.position, d=new THREE.Vector3(); camera.getWorldDirection(d);
  let prev=null;
  for(let s=0.5;s<10;s+=0.08){
    const x=Math.round(o.x+d.x*s), y=Math.round(o.y+d.y*s), z=Math.round(o.z+d.z*s);
    if(isSolid(x,y,z)) return {blockPos:[x,y,z], placePos:prev||[x,y,z]};
    prev=[x,y,z];
  }
  return null;
}

function tryBreakBlock(){
  const r = raycastBlocks();
  if(!r) return;
  const [x,y,z] = r.blockPos;
  const t = removeBlockAt(x,y,z);
  if(t){ Audio_.breakBlock(); }
}
function tryPlaceBlock(){
  const r = raycastBlocks();
  if(!r) return;
  const [x,y,z] = r.placePos;
  const dx = Math.abs(x-player.pos.x), dz = Math.abs(z-player.pos.z), dy = Math.abs(y-player.pos.y);
  if(dx<0.6 && dz<0.6 && dy<1.6) return; // don't place inside player
  if(addBlockAt(selectedBlockType, x, y, z)) Audio_.place();
}

function useSpecial(){
  const f = player.form;
  if(f.actions || !f.special || player.specialTimer>0 || player.energy < f.special.cost) return;
  if(lockedTarget()) aimAtLock();
  player.energy -= f.special.cost;
  player.specialTimer = f.special.cooldown;
  f.special.run({player});
}

/* =========================================================================
   INPUT — keyboard (desktop) + touch (mobile)
========================================================================= */
const moveInput = {x:0,y:0};
const keys = {};
addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='KeyF') meleeAttack(); if(e.code==='KeyE') useSpecial(); {const ai={KeyE:0,KeyR:1,KeyT:2,KeyY:3,KeyU:4}[e.code], A=player.form.actions; if(ai!==undefined&&A&&A[ai]) useAction(A[ai],ai);} if(e.code==='KeyQ') revertToBen(); if(e.code==='KeyL'||e.code==='Tab'){ if(e.code==='Tab') e.preventDefault(); lockButton(); } if(e.code==='KeyG') tryPlaceBlock(); });
addEventListener('keyup', e=>{ keys[e.code]=false; const ai={KeyE:0,KeyR:1,KeyT:2,KeyY:3,KeyU:4}[e.code], A=player.form.actions; if(ai!==undefined&&A&&A[ai]&&A[ai].hold) A[ai].hold(false); });
addEventListener('mousedown', e=>{ Audio_.resume(); if(!isTouch){ if(e.button===0) meleeAttack(); if(e.button===2) tryPlaceBlock(); } });
addEventListener('contextmenu', e=> e.preventDefault());
// Desktop lock-on: middle-click locks the enemy nearest the crosshair (or releases); R-click stays block placement.
addEventListener('mousedown', e=>{ if(!isTouch && e.button===1){ e.preventDefault(); if(!lockedTarget()){ const t=pickEnemyAtScreen(innerWidth/2,innerHeight/2)||null; if(t) setLock(t); else lockButton(); } else unlockTarget('TARGET RELEASED'); } });
addEventListener('mousemove', e=>{ if(!isTouch && (Math.abs(e.movementX||0)+Math.abs(e.movementY||0))>2) noteUserLook(); });

function updateKeyboardMove(){
  if(isTouch) return;
  let mx=0,my=0;
  if(keys['KeyW']||keys['ArrowUp']) my+=1;
  if(keys['KeyS']||keys['ArrowDown']) my-=1;
  if(keys['KeyD']||keys['ArrowRight']) mx+=1;
  if(keys['KeyA']||keys['ArrowLeft']) mx-=1;
  moveInput.x=mx; moveInput.y=my;
  if(keys['Space']) doJump();
}
addEventListener('mousemove', e=>{
  if(isTouch || document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX*0.0025;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY*0.002, -1.3, 1.25);
});
renderer.domElement.addEventListener('click', ()=>{
  if(!isTouch && document.getElementById('start-screen').style.display==='none'){
    renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock();
  }
});

// touch joystick (movement)
const joyZone = document.getElementById('joystick-zone');
const joyStick = document.getElementById('joystick-stick');
let joyId=null, joyCenter={x:0,y:0}; const JOY_R=44;
joyZone.addEventListener('touchstart', e=>{
  const t=e.changedTouches[0]; joyId=t.identifier;
  const r=joyZone.getBoundingClientRect(); joyCenter={x:r.left+r.width/2,y:r.top+r.height/2};
  e.preventDefault();
},{passive:false});
joyZone.addEventListener('touchmove', e=>{
  for(const t of e.changedTouches){
    if(t.identifier!==joyId) continue;
    let dx=t.clientX-joyCenter.x, dy=t.clientY-joyCenter.y;
    const d=Math.hypot(dx,dy);
    if(d>JOY_R){ dx=dx/d*JOY_R; dy=dy/d*JOY_R; }
    joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    moveInput.x = dx/JOY_R; moveInput.y = -dy/JOY_R;
    e.preventDefault();
  }
},{passive:false});
function joyEnd(e){
  for(const t of e.changedTouches){ if(t.identifier===joyId){ joyId=null; moveInput.x=0; moveInput.y=0; joyStick.style.transform='translate(-50%,-50%)'; } }
}
joyZone.addEventListener('touchend', joyEnd,{passive:false});
joyZone.addEventListener('touchcancel', joyEnd,{passive:false});

// Full-screen camera look: any touch that starts on open game area (not the joystick, not an
// action/menu button) rotates the camera by dragging, from anywhere on screen. The joystick keeps
// its own dedicated small zone for movement; everything else is look.
function isUiElement(el){
  while(el && el !== document.body){
    if(el.id==='joystick-zone' || el.id==='lock-btn' || el.tagName==='BUTTON') return true;
    if(el.classList && (el.classList.contains('menu-btn') || el.classList.contains('act-btn'))) return true;
    el = el.parentElement;
  }
  return false;
}
let camTouchId=null, lastCam={x:0,y:0}, camTap=null;
renderer.domElement.addEventListener('touchstart', e=>{
  for(const t of e.changedTouches){
    if(camTouchId!==null) continue; // one look touch at a time
    if(isUiElement(t.target)) continue;
    camTouchId = t.identifier; lastCam = {x:t.clientX, y:t.clientY};
    camTap = { x:t.clientX, y:t.clientY, t:performance.now(), moved:0 }; // for tap-to-lock
  }
},{passive:true});
renderer.domElement.addEventListener('touchmove', e=>{
  for(const t of e.changedTouches){
    if(t.identifier!==camTouchId) continue;
    const dx=t.clientX-lastCam.x, dy=t.clientY-lastCam.y; lastCam={x:t.clientX,y:t.clientY};
    if(camTap){ camTap.moved += Math.abs(dx)+Math.abs(dy); if(camTap.moved>14) noteUserLook(); } // real swipe -> camera assist yields
    player.yaw -= dx*0.0045;
    player.pitch = THREE.MathUtils.clamp(player.pitch - dy*0.0035, -1.3, 1.25);
  }
},{passive:true});
function camEnd(e){
  for(const t of e.changedTouches) if(t.identifier===camTouchId){
    camTouchId=null;
    // A short, nearly-stationary touch is a TAP: try to lock/unlock an enemy under the finger.
    // Anything longer or that moved is a camera drag and never locks (so free look is unaffected).
    if(e.type==='touchend' && camTap && camTap.moved<=14 && performance.now()-camTap.t<320 && player.alive){
      tapLock(t.clientX,t.clientY); // tapping empty ground does nothing: a lock is kept until you tap the target again, use the button, or it breaks
    }
    camTap=null;
  }
}
renderer.domElement.addEventListener('touchend', camEnd,{passive:true});
renderer.domElement.addEventListener('touchcancel', camEnd,{passive:true});

// alien portrait swipe (separate small zone, overrides card's own touch)
const portraitCard = document.getElementById('alien-card');
let portraitTouchId=null, portraitStartX=0;
portraitCard.addEventListener('touchstart', e=>{
  const t=e.changedTouches[0]; portraitTouchId=t.identifier; portraitStartX=t.clientX; e.stopPropagation();
},{passive:true});
portraitCard.addEventListener('touchend', e=>{
  for(const t of e.changedTouches){
    if(t.identifier!==portraitTouchId) continue;
    const dx = t.clientX - portraitStartX;
    if(Math.abs(dx) > 30){ cycleAlien(dx>0 ? -1 : 1); }
    else { revertToBen(); }
  }
  portraitTouchId=null;
},{passive:true});

// action buttons
function bindBtn(id, downFn, upFn){
  const el = document.getElementById(id);
  const start = e=>{ el.classList.add('active'); Audio_.resume(); downFn(); e.preventDefault(); };
  const end = e=>{ el.classList.remove('active'); if(upFn) upFn(); e.preventDefault(); };
  el.addEventListener('touchstart', start,{passive:false});
  el.addEventListener('touchend', end,{passive:false});
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end); el.addEventListener('touchcancel', end,{passive:false}); el.addEventListener('mouseleave', end);
}
bindBtn('btn-attack', ()=>{ player.atkHeld=true; }, ()=>{ player.atkHeld=false; });
bindBtn('btn-jump', doJump);
bindBtn('btn-special', useSpecial);
bindBtn('lock-btn', lockButton);

// hotbar
const hotbar = document.getElementById('hotbar');
const HOTBAR_TYPES = ['grass','dirt','stone','sand','wood'];
HOTBAR_TYPES.forEach((t,i)=>{
  const el = document.createElement('div');
  el.className = 'hotslot' + (i===0?' sel':'');
  el.style.background = '#'+BLOCK_COLOR[t].toString(16).padStart(6,'0');
  el.addEventListener('touchstart', e=>{ selectSlot(t, el); e.preventDefault(); },{passive:false});
  el.addEventListener('mousedown', ()=> selectSlot(t, el));
  hotbar.appendChild(el);
});
function selectSlot(t, el){
  selectedBlockType = t;
  [...hotbar.children].forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
}
// long-press attack button also places blocks (secondary use, desktop uses right-click)
let attackHoldTimer=null;
document.getElementById('btn-attack').addEventListener('touchstart', ()=>{
  attackHoldTimer = setTimeout(()=> tryPlaceBlock(), 420);
},{passive:true});
document.getElementById('btn-attack').addEventListener('touchend', ()=> clearTimeout(attackHoldTimer));

/* =========================================================================
   MOVEMENT / PHYSICS
========================================================================= */
function doJump(){
  if(!player.alive) return;
  if(player.swimming){ player.vel.y=7; return; }
  if(player.form.flies){
    if(!player.flying){
      player.flying = true;
      player.vel.y = player.form.jump;
      statusText('TAKING OFF — look up/down + move to steer, JUMP again to land');
    } else {
      player.flying = false; // gravity resumes and brings you back down
    }
  } else if(player.onGround){
    player.vel.y = player.form.jump; player.onGround=false; Audio_.jump();
  }
}
const GRAVITY = -18;
const WORLD_LIMIT = HALF - 1;
function flySpeedOf(p){ return (p.form.flySpeed||8) * 0.6; }

function updatePlayer(dt){
  updateKeyboardMove();
  player.atkTimer = Math.max(0, player.atkTimer - dt);
  player.comboResetTimer = Math.max(0, (player.comboResetTimer||0) - dt);
  if(player.comboResetTimer <= 0) player.comboStep = 0; // waited too long since the last hit - combo drops back to punch 1
  player.punchAnimT = Math.max(0, (player.punchAnimT||0) - dt);
  player.boostT = Math.max(0,(player.boostT||0)-dt); for(const k in actCd) actCd[k]=Math.max(0,actCd[k]-dt);
  player.specialTimer = Math.max(0, player.specialTimer - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.attacking = Math.max(0, player.attacking - dt);
  if(player.atkHeld && !(player.rolling && player.form.id==='cannonbolt')) meleeAttack();
  // XLR8 true super speed: holding the button builds momentum through tiers instead of snapping to a
  // flat multiplier. superT is the raw 0..1 "charge"; superSpeed is the eased curve actually applied to
  // movement. Acceleration slows as you approach max (so the last tier takes real sustained holding),
  // and release decelerates gradually rather than stopping instantly.
  if(player.superHeld && player.form.id==='xlr8' && player.energy>0){
    const tier = player.superT||0;
    // Drain scales with the SQUARE of how fast you're going: low/mid tiers are cheap so speed can be
    // sustained for a long time, and only the top tier costs real energy. Roughly 10s total from full.
    player.energy = Math.max(0, player.energy - (2 + tier*tier*10)*dt);
    // Accelerate quickly at first, more slowly near the top: rate falls from ~0.55/s down to ~0.18/s.
    player.superT = Math.min(1, tier + dt*(0.55 - tier*0.37));
    if(player.energy<=0) player.superHeld=false;
  } else {
    player.superHeld=false;
    // Release: coast down gradually (~2s from full) rather than the old near-instant stop.
    player.superT = Math.max(0, (player.superT||0) - dt*0.5);
  }
  // Eased speed curve: ease-in so low tiers feel like a fast run and only the top tier reaches extreme speed.
  player.superSpeed = Math.pow(player.superT||0, 1.6);

  // Cannonbolt: hold ROLL to curl into a ball and build up speed; release to unroll back to normal.
  if(player.rollHeld && player.form.id==='cannonbolt'){ player.rolling=true; player.rollT=Math.min(1,(player.rollT||0)+dt*1.4); }
  else { player.rolling=false; player.rollT=Math.max(0,(player.rollT||0)-dt*2.2); }

  // energy regen (paused briefly right after casting)
  if(!player.superHeld && (player.specialTimer <= player.form.special?.cooldown - 0.15 || !player.form.special)){
    player.energy = Math.min(player.form.maxEnergy, player.energy + dt*8);
  }
  if(player.speedBurstT > 0){
    player.speedBurstT -= dt;
    player.energy -= (player.form.special?.drainPerSec||0) * dt;
    if(player.energy <= 0){ player.energy = 0; player.speedBurstT = 0; }
  }

  const forward = { x:-Math.sin(player.yaw), z:-Math.cos(player.yaw) };
  const right = { x:Math.cos(player.yaw), z:-Math.sin(player.yaw) };
  let mx = moveInput.x, my = moveInput.y;
  const mag = Math.hypot(mx,my); if(mag>1){ mx/=mag; my/=mag; }
  const speedMult = player.speedBurstT>0 ? (player.form.special.speedMult||1) : 1;
  const speed = player.form.speed * speedMult * (player.dashT>0?4.5:1) * (carried?0.75:1) * (player.swimming?0.6:1) * (1+(player.superSpeed||0)*8) * (1+(player.rollT||0)*5);
  let moveX = forward.x*my + right.x*mx;
  let moveZ = forward.z*my + right.z*mx;
  if(player.dashT>0){ moveX=player.dashDir.x; moveZ=player.dashDir.z; player.dashT-=dt; }
  else if(player.superHeld && Math.hypot(moveX,moveZ)<0.05){ moveX=forward.x; moveZ=forward.z; }
  // XLR8 + lock-on: while sprinting, bend the run gently toward the locked target so a tackle can be aimed.
  // It only nudges (never overrides) and only when you are already heading roughly toward it - so it cannot
  // hijack steering or drag you off a route you chose.
  if(player.form.id==='xlr8' && (player.superSpeed||0)>0.15 && player.dashT<=0){
    const ld=lockDirFrom(player.pos), ml=Math.hypot(moveX,moveZ);
    if(ld && ml>0.05){
      const mdir=new THREE.Vector3(moveX/ml,0,moveZ/ml), ang=mdir.angleTo(ld);
      if(ang<1.05){ // within ~60 degrees of the target
        const k=Math.min(1,dt*(2.2+player.superSpeed*3.5)); // stronger the faster you go, still gentle
        mdir.lerp(ld,k).normalize(); moveX=mdir.x*ml; moveZ=mdir.z*ml;
      }
    }
  }
  else if(player.rolling && Math.hypot(moveX,moveZ)<0.05){ moveX=forward.x; moveZ=forward.z; }
  const moving = Math.hypot(moveX,moveZ) > 0.05;

  if(player.alive){
    const flySpeed = player.flying ? (player.form.flySpeed||speed)*(player.boostT>0?1.7:1) : speed;
    const nx = player.pos.x + moveX*flySpeed*dt;
    const nz = player.pos.z + moveZ*flySpeed*dt;
    if(player.flying){
      // Flying: no wall-height restriction, freely traverse.
      const fy=player.pos.y-1;
      if(!blockedAt(nx,player.pos.z,fy)) player.pos.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, nx));
      if(!blockedAt(player.pos.x,nz,fy)) player.pos.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, nz));
    } else {
      // simple wall collision: block axis if destination column is much higher than current
      const curTop = groundTopAt(player.pos.x, player.pos.z);
      const topX = groundTopAt(nx, player.pos.z);
      const topZ = groundTopAt(player.pos.x, nz);
      if(topX - curTop <= 1.05 && !blockedAt(nx,player.pos.z,player.pos.y-1)) player.pos.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, nx));
      if(topZ - curTop <= 1.05 && !blockedAt(player.pos.x,nz,player.pos.y-1)) player.pos.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, nz));
    }
  }

  if(!player.flying) props.forEach(p=>{
    if(p===carried||p.state!=='rest') return;
    const dx=player.pos.x-p.mesh.position.x, dz=player.pos.z-p.mesh.position.z, d=Math.hypot(dx,dz), r=p.s*.6+.4;
    if(d<r&&d>.001&&player.pos.y-1<p.mesh.position.y+p.s*.5-.1){ player.pos.x+=dx/d*(r-d); player.pos.z+=dz/d*(r-d); }
  });

  // Cannonbolt ram: while curled and moving fast, colliding with an enemy deals damage scaled by roll speed.
  if(player.rolling && (player.rollT||0) > 0.25 && player.alive){
    player.ramCd = Math.max(0, (player.ramCd||0) - dt);
    if(player.ramCd <= 0) enemies.forEach(en=>{
      if(!en.alive) return;
      const dx=en.mesh.position.x-player.pos.x, dz=en.mesh.position.z-player.pos.z, d=Math.hypot(dx,dz);
      if(d < 1.6){
        const dmg = player.form.atkDamage * (1 + player.rollT*1.5);
        damageEnemy(en, dmg, new THREE.Vector3(dx,0,dz).normalize());
        player.ramCd = 0.35;
      }
    });
  }
  // XLR8 tackle: running into enemies at real speed hurts them and throws them aside. Uses a per-enemy
  // cooldown (not one shared timer) so a sprint through a group can clip several enemies, but the same
  // enemy can't be hit every single frame while you overlap it.
  if(player.form.id==='xlr8' && (player.superSpeed||0) > 0.3 && player.alive){
    const s = player.superSpeed;
    const now = performance.now();
    enemies.forEach(en=>{
      if(!en.alive) return;
      if(en.tackleUntil && now < en.tackleUntil) return;
      const dx=en.mesh.position.x-player.pos.x, dz=en.mesh.position.z-player.pos.z, d=Math.hypot(dx,dz);
      if(d < (en===lockedTarget() ? 1.9 : 1.5)){ // slightly wider contact on the locked target so an aimed tackle lands
        const dir = d>0.001 ? new THREE.Vector3(dx/d,0,dz/d) : new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
        damageEnemy(en, 8 + s*24, dir, { heavy: s>0.6, knock: 6 + s*14 }); // max ~32: hurts badly and throws enemies, but doesn't one-shot most archetypes
        en.tackleUntil = now + 500;
        if(s > 0.6) shakeCamera(0.25);
      }
    });
  }
  const groundY = groundTopAt(player.pos.x, player.pos.z);

  if(player.flying){
    // Vertical steering: look up/down + move forward to climb/descend; hover when still.
    let cl = moving ? Math.sin(player.pitch) : 0; if(Math.abs(cl)<0.1) cl=0; else cl-=Math.sign(cl)*0.1;
    player.vel.y = cl*1.25*(player.form.flySpeed||8)*(player.boostT>0?1.7:1);
    player.pos.y += player.vel.y*dt;
    const ceiling = 70; player.swimming=false;
    player.pos.y = Math.max(groundY + 1.2, Math.min(ceiling, player.pos.y));
    player.onGround = false;
  } else {
    const WS=WATER_LEVEL+0.4;
    player.swimming = (WS-groundY>1.3) && (player.pos.y-1 < WS-0.5);
    if(player.swimming){
      const want = moving ? Math.sin(player.pitch)*player.form.speed*0.9 : (WS+0.1-player.pos.y)*2.5;
      player.vel.y += (want-player.vel.y)*Math.min(1,dt*4);
    } else player.vel.y += GRAVITY*dt;
    player.pos.y += player.vel.y*dt;
    if(player.pos.y <= groundY + 1){
      if(!player.onGround && player.vel.y < -6) Audio_.land();
      player.pos.y = groundY + 1;
      player.vel.y = 0;
      player.onGround = true;
    } else player.onGround = false;
  }

  if(player.onGround&&!player.lastGrounded){player.landingT=.18;player.landingStrength=Math.min(1,Math.max(0,-(player.vel.y||0)/9));shakeCamera(Math.min(.12,player.landingStrength*.08));}
  player.lastGrounded=player.onGround; player.landingT=Math.max(0,(player.landingT||0)-dt);
  // Smooth facing gives the hips time to lead the torso instead of snapping the whole body.
  const facing=moving?Math.atan2(-moveX,-moveZ):player.yaw; let faceDelta=facing-player.model.rotation.y; faceDelta=Math.atan2(Math.sin(faceDelta),Math.cos(faceDelta)); player.model.rotation.y+=faceDelta*Math.min(1,dt*(moving?10:5));
  const formScale = PS * (player.form.modelScale||1);
  player.model.position.set(player.pos.x, player.pos.y-1+0.9*formScale, player.pos.z); player.model.scale.setScalar(formScale);

  // procedural walk animation
  const parts = player.model.userData.parts;
  if(player.form.id==='cannonbolt'){
    // Curled: shrink the visible body (head/arms/legs/torso) to nothing and grow the shell sphere to
    // fully cover it, so the silhouette actually reads as a ball rather than a person with tucked limbs.
    const curl = player.rollT||0;
    const bodyScale = 1 - curl; // legs/arms/head/torso shrink away entirely as curl approaches 1
    [parts.leftLeg,parts.rightLeg,parts.leftArm,parts.rightArm,parts.head,parts.torso].forEach(p=>{ if(p) p.scale.setScalar(Math.max(0.001,bodyScale)); });
    if(parts.shell){ parts.shell.scale.setScalar(Math.max(0.001, curl)); parts.shell.position.y = parts.shellBaseY; }
    if(curl>0.05){ player.rollSpin=(player.rollSpin||0) + dt*(6+curl*14); player.model.rotation.x = player.rollSpin; }
    else { player.model.rotation.x = THREE.MathUtils.lerp(player.model.rotation.x||0, 0, 0.2); player.rollSpin=0; }
  } else {
  if(moving && player.onGround){
    player.walkT += dt*8*speedMult;
    Math.floor(player.walkT*2)%20===0 && null; // (keep hook point, footsteps handled below by timer)
  }
  const swing = moving ? Math.sin(player.walkT)*0.5 : 0;
  if(parts.leftLeg) parts.leftLeg.rotation.x = swing;
  if(parts.rightLeg) parts.rightLeg.rotation.x = -swing;
  if(parts.leftArm) parts.leftArm.rotation.x = -swing*0.8;
  if(parts.rightArm) parts.rightArm.rotation.x = swing*0.8;
  if(parts.leftArm2) parts.leftArm2.rotation.x = -swing*0.6;
  if(parts.rightArm2) parts.rightArm2.rotation.x = swing*0.6;
  if(!player.onGround){ if(parts.leftLeg) parts.leftLeg.rotation.x = -0.3; if(parts.rightLeg) parts.rightLeg.rotation.x = 0.3; }
  if(player.attacking > 0){
    // progress goes 0 -> 1 -> 0 across the punch's own duration (not a fixed 0.25s), so faster
    // alien combos (XLR8) and slower heavy hits (the finisher) each animate at their own correct speed.
    const dur = player.punchAnimDur || 0.25;
    const t = 1 - Math.max(0, Math.min(1, player.punchAnimT / dur));
    const k = Math.sin(Math.min(1,t)*Math.PI);
    const wind = Math.max(0, Math.min(1, t/0.28));
    const strike = Math.max(0, Math.min(1, (t-0.20)/0.80));
    if(player.punchKind === 'heavy'){
      // Two-handed heavy finisher: both arms drive forward together, torso dips into the hit.
      ['leftArm','rightArm','leftArm2','rightArm2'].forEach(n=>{ if(parts[n]) parts[n].rotation.x = 2.1*k - 0.55*(1-wind); });
      player.model.userData.twist = 0;
      if(parts.torso) parts.torso.rotation.x = 0.25*k - 0.16*(1-wind);
    } else {
      // Single alternating punch: one arm drives forward, torso twists into the punch.
      const side = player.punchSide ? ['rightArm','rightArm2'] : ['leftArm','leftArm2'];
      side.forEach(n=>{ if(parts[n]) parts[n].rotation.x = 1.7*k - 0.45*(1-wind); });
      player.model.userData.twist = (player.punchSide?-1:1)*(0.35*k + 0.12*(1-wind));
      if(parts.torso) parts.torso.rotation.x = 0;
    }
  } else if(parts.torso){ parts.torso.rotation.x = 0; }
  poseExtras(parts, moving, dt);
  applyCombatBodyLanguage(player.model, parts, dt, player);
  animateCharacterLife(player.model, parts, moving, dt, player.form.id, Math.max(.7, speedMult));
  applyAlienBiomechanics(player.model, parts, moving, dt, Math.max(.7, speedMult));
  player.impactKick = Math.max(0,(player.impactKick||0)-dt*3.8);
  if(player.landingT>0){const lk=(player.landingT/.18)*player.landingStrength;player.model.scale.set(formScale*(1+lk*.035),formScale*(1-lk*.055),formScale*(1+lk*.035));} else player.model.scale.setScalar(formScale);

  // footstep sound throttling
  player._stepT = (player._stepT||0) + dt;
  if(moving && player.onGround && player._stepT > 0.32){ Audio_.footstep(); player._stepT=0; }
  }

  // fell into water / void safety
  if(player.pos.y < -40){ player.health = 0; }

  // death
  if(player.health <= 0 && player.alive && !(squad.length>1 && activeDied())){
    player.alive = false;
    unlockTarget();
    Audio_.death();
    document.getElementById('death-screen').style.display='flex';
    setTimeout(()=>{
      player.pos.set(0.5, groundTopAt(0.5,0.5)+1, 0.5);
      player.vel.set(0,0,0);
      revertToBen();
      player.alive = true;
      document.getElementById('death-screen').style.display='none';
    }, 1400);
  }
}

/* =========================================================================
   UI SYNC
========================================================================= */
function syncHud(){
  const hp = Math.max(0, player.health/player.form.maxHealth*100);
  const en = Math.max(0, player.energy/player.form.maxEnergy*100);
  document.getElementById('health-fill').style.width = hp+'%';
  document.getElementById('energy-fill').style.width = en+'%';
  (player.form.actions||[]).forEach((a,i)=>{ const el=actEls[i]; if(!el) return;
    const l=typeof a.label==='function'?a.label():a.label; if(el.dataset.l!==l){ el.dataset.l=l; el.innerHTML='<i>'+(ICON[l]||'✦')+'</i><b>'+l+'</b>'; }
    el.style.display=(a.show&&!a.show())?'none':'flex';
    el.classList.toggle('cooldown',(actCd[i]||0)>0||player.energy<a.cost); });
  const specBtn = document.getElementById('btn-special');
  if(player.form.special && !player.form.actions){
    specBtn.style.display='flex';
    specBtn.classList.toggle('cooldown', player.specialTimer>0 || player.energy < player.form.special.cost);
  } else {
    specBtn.style.display='none';
  }
}

/* =========================================================================
   MAIN LOOP
========================================================================= */
const clock = new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if(player.slowT>0) player.slowT-=dt;
  timeScale += ((player.slowT>0?0.3:1)-timeScale)*Math.min(1,dt*6);
  document.getElementById('slow-overlay').style.opacity = timeScale<0.9?1:0;
  const wdt = dt*timeScale;
  updateChunkStreaming(player.pos.x, player.pos.z, dt);
  water.position.x = player.pos.x; water.position.z = player.pos.z;
  updateDayNight(wdt);
  updatePlayer(dt);
  updateEnemySpawning(wdt); updateEnemies(wdt); updateProjectiles(wdt); updateProps(wdt); updateFx(wdt); updateTornado(wdt); updateCrystals(dt); updateSquad(wdt); updateStreams(dt); updateIces(wdt); updateNpcs(wdt);
  updateLockOn(dt);
  updateCamera();
  updateSpeedEffects(dt);
  const under = camera.position.y < WATER_LEVEL+0.4;
  if(under){ scene.fog.color.set(0x1d5c8c); scene.background = scene.fog.color.clone(); }
  scene.fog.near = under?1:14; scene.fog.far = under?26:QUALITY.presets[QUALITY.level].fogFar;
  if(camShake>0){ camShake=Math.max(0,camShake-dt*2); camera.position.x += (Math.random()-0.5)*camShake; camera.position.y += (Math.random()-0.5)*camShake; }
  syncHud();
  renderer.render(scene, camera);
}

/* =========================================================================
   START MENU WIRING
========================================================================= */
const menuPanel = document.getElementById('menu-panel');
function showPanel(html){ menuPanel.innerHTML = html; menuPanel.classList.add('show'); }
document.getElementById('btn-controls').addEventListener('click', ()=> showPanel(
  isTouch
  ? 'LEFT: joystick to move.<br>RIGHT SIDE: swipe to look around.<br>Swipe the alien portrait (top-left) to switch aliens, tap it to revert to Ben.<br>Big button = Attack (hold = place block). Arrow button = Jump. Bolt button = Special.<br>LOCK-ON: tap an enemy to lock it (tap again to release), or use the reticle button above the joystick. The camera assists toward it and attacks/abilities face it; you can still swipe to look freely.'
  : 'WASD to move, mouse to look (click to lock).<br>Left click = Attack, Right click = Place block.<br>F = Attack, G = Place, Space = Jump, E/R/T/Y = alien actions, Q = Revert to Ben. L / Tab / middle-click = Lock-on. Fly/swim: look up or down while moving.'
));
document.getElementById('btn-about').addEventListener('click', ()=> showPanel(
  'OMNITRIX: VOXEL PROTOCOL — an original fan-made prototype blending a Minecraft-style voxel world with Ben 10 Alien Force-inspired transformation and combat mechanics. All characters, names and visuals here are original interpretations.'
));
document.getElementById('btn-settings').addEventListener('click', ()=>{
  showPanel('<div>GRAPHICS QUALITY</div><div id="quality-row"></div>');
  const row = document.getElementById('quality-row');
  ['LOW','MEDIUM','HIGH'].forEach(q=>{
    const b = document.createElement('div');
    b.className = 'qbtn' + (QUALITY.level===q?' active':'');
    b.textContent = q;
    b.addEventListener('click', ()=>{ QUALITY.level=q; applyQuality(); [...row.children].forEach(c=>c.classList.remove('active')); b.classList.add('active'); });
    row.appendChild(b);
  });
});

function beginGame(){
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  Audio_.resume();
  setForm(BEN, 'ben');
  if(!isTouch){ renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock(); }
  if(screen.orientation && screen.orientation.lock){ try{ screen.orientation.lock('landscape').catch(()=>{}); }catch(e){} }
  loop();
}
let starting=false;
function startOnce(e){ if(starting) return; starting=true; if(e) e.preventDefault(); beginGame(); }
document.getElementById('btn-start').addEventListener('click', startOnce);
document.getElementById('btn-start').addEventListener('touchend', startOnce, {passive:false});

// initial portrait render for Ben so card isn't empty before start
document.getElementById('alien-portrait').appendChild(getPortraitCanvas('ben'));
})();
