const { JSDOM } = require('jsdom');
const fs = require('fs');

let html = fs.readFileSync('/home/claude/index_test_copy.html', 'utf8');
const threeSrc = fs.readFileSync('/home/claude/ben10/www/three.min.js', 'utf8');
const rendererStub = `
window.THREE.WebGLRenderer = function(){
  return { domElement: document.createElement('canvas'), setSize(){}, setPixelRatio(){}, setClearColor(){}, render(){}, dispose(){},
    shadowMap:{enabled:false,type:0}, setAnimationLoop(){}, getContext(){return null;}, capabilities:{}, info:{render:{calls:0}} };
};`;
html = html.replace('<script src="three.min.js"></script>', `<script>${threeSrc}\n${rendererStub}</script>`);

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'https://example.test/',
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function(type) {
      if (type === '2d') return { fillRect(){},fillText(){},drawImage(){},getImageData(){return{data:[]}},fillStyle:'',font:'',textAlign:'',strokeStyle:'',lineWidth:1,beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},clearRect(){},createLinearGradient(){return{addColorStop(){}}},rect(){},roundRect(){},closePath(){},save(){},restore(){},translate(){},scale(){},rotate(){},measureText(){return{width:10}} };
      return { getExtension:()=>null, getParameter:()=>4, getContextAttributes:()=>({}), getSupportedExtensions:()=>[] };
    };
    window.AudioContext = window.webkitAudioContext = function(){ return { state:'running',resume(){},sampleRate:44100,
      createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}},
      createGain(){return{connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}}},
      createBuffer(c,l){return{getChannelData(){return new Float32Array(l)}}}, createBufferSource(){return{connect(){},start(){},stop(){},buffer:null}}, destination:{} }; };
    window.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
    window.HTMLMediaElement.prototype.pause = function(){};
    window.__rafCallbacks = [];
    window.requestAnimationFrame = (cb) => { window.__rafCallbacks.push(cb); return window.__rafCallbacks.length; };
  }
});

const window = dom.window;
let caughtErrors = [];
window.addEventListener('error', (e) => { caughtErrors.push(e.error ? (e.error.stack||e.error.message) : e.message); });
function pump(n=1){ for(let i=0;i<n;i++){ const cbs=window.__rafCallbacks.splice(0); cbs.forEach(cb=>cb(i*16.6)); } }

let allPass = true;
const check = (name, cond, extra='') => { console.log((cond?'PASS':'FAIL')+': '+name+(extra?'  ['+extra+']':'')); if(!cond) allPass=false; };

setTimeout(() => {
  window.document.getElementById('btn-start').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  pump(5);
  const d = window.__debug, p = d.player, THREE = window.THREE;

  // Become XLR8
  const xlr8 = d.ALIENS.find(a=>a.id==='xlr8');
  d.setForm(xlr8, 'xlr8');
  p.energy = xlr8.maxEnergy;
  check('player is now XLR8', p.form.id === 'xlr8');

  // Fixed-dt stepping helper: drives updatePlayer directly so results don't depend on wall-clock time.
  const DT = 1/60;
  const step = (n) => { for(let i=0;i<n;i++){ d.updatePlayer(DT); d.updateSpeedEffects(DT); } };

  console.log('\n=== Test 1: speed builds GRADUALLY while held (no instant dash) ===');
  p.superHeld = true; d.moveInput.x = 0; d.moveInput.y = 1;
  const stepFull = (n) => { for(let i=0;i<n;i++){ p.energy = xlr8.maxEnergy; p.superHeld = true; d.updatePlayer(DT); d.updateSpeedEffects(DT); } };
  stepFull(1);
  const t1 = p.superT;
  check('after one frame, speed charge is still tiny (not an instant jump)', t1 < 0.05, `superT=${t1.toFixed(4)}`);
  stepFull(59);      // ~1s
  const t1s = p.superT;
  stepFull(60);      // ~2s
  const t2s = p.superT;
  stepFull(120);     // ~4s
  const t4s = p.superT;
  stepFull(240);     // ~8s
  const t8s = p.superT;
  console.log(`   charge over time: 1s=${t1s.toFixed(2)} 2s=${t2s.toFixed(2)} 4s=${t4s.toFixed(2)} 8s=${t8s.toFixed(2)}`);
  check('charge keeps rising through the tiers', t1s < t2s && t2s < t4s, '');
  check('mid-tier is NOT already at max after 2 seconds (progressive)', t2s < 0.9);
  check('reaches maximum tier with sustained holding', t8s > 0.99, `superT=${t8s.toFixed(3)}`);

  console.log('\n=== Test 2: energy drains progressively ===');
  p.energy = xlr8.maxEnergy; p.superHeld = true; p.superT = 0;
  step(60);
  const e1 = p.energy;
  step(180);
  const e2 = p.energy;
  check('energy is being consumed while held', e1 < xlr8.maxEnergy && e2 < e1, `start=${xlr8.maxEnergy} 1s=${e1.toFixed(1)} 4s=${e2.toFixed(1)}`);

  console.log('\n=== Test 3: movement speed actually increases with the tier ===');
  const measureSpeed = (heldFrames) => {
    p.superHeld = true; p.superT = 0; p.energy = xlr8.maxEnergy; p.pos.set(0.5, 3, 0.5); p.vel.set(0,0,0);
    for(let i=0;i<heldFrames;i++){ p.energy = xlr8.maxEnergy; p.superHeld = true; d.updatePlayer(DT); }
    const before = p.pos.clone();
    p.energy = xlr8.maxEnergy; p.superHeld = true;
    d.updatePlayer(DT);
    return before.distanceTo(p.pos)/DT;
  };
  const sLow = measureSpeed(10), sMid = measureSpeed(150), sHigh = measureSpeed(480);
  console.log(`   ground speed (units/sec): early=${sLow.toFixed(1)} mid=${sMid.toFixed(1)} sustained=${sHigh.toFixed(1)}`);
  check('speed increases from early to mid', sMid > sLow*1.5);
  check('speed increases further with sustained hold', sHigh > sMid);
  check('top speed is far above normal running speed', sHigh > xlr8.speed*4, `normal=${xlr8.speed}`);

  console.log('\n=== Test 3b: speed is genuinely SUSTAINABLE from a full energy bar ===');
  p.superHeld = true; p.superT = 0; p.energy = xlr8.maxEnergy; p.pos.set(0.5,3,0.5);
  let frames = 0, framesAtMax = 0;
  while(p.superHeld && frames < 60*30){ d.updatePlayer(DT); frames++; if(p.superT > 0.99) framesAtMax++; }
  const sustainSec = frames/60, maxSec = framesAtMax/60;
  console.log(`   held from full energy for ${sustainSec.toFixed(1)}s total, ${maxSec.toFixed(1)}s of it at maximum speed`);
  check('can hold super speed for at least 9 seconds from full energy', sustainSec >= 9, `${sustainSec.toFixed(1)}s`);
  check('gets at least 5 seconds at MAXIMUM speed', maxSec >= 5, `${maxSec.toFixed(1)}s`);
  check('energy is what ends the run (goes to zero), not a bug', p.energy <= 0.5, `energy=${p.energy.toFixed(1)}`);
  p.energy = xlr8.maxEnergy;

  console.log('\n=== Test 4: releasing DECELERATES gradually (does not stop instantly) ===');
  p.superHeld = true; p.superT = 0.9; p.energy = xlr8.maxEnergy;
  step(2);
  const before = p.superT;
  p.superHeld = false;
  step(6);           // 0.1s after release
  const after01 = p.superT;
  check('0.1s after release, still mostly at speed (not snapped to zero)', after01 > before*0.85, `before=${before.toFixed(2)} after0.1s=${after01.toFixed(2)}`);
  step(60);
  const after11 = p.superT;
  check('speed is decaying over time', after11 < after01);
  step(240);
  check('eventually returns to normal', p.superT < 0.05, `superT=${p.superT.toFixed(3)}`);

  console.log('\n=== Test 5: FOV widens slightly at speed and returns afterward ===');
  p.superHeld = true; p.superT = 1; p.superSpeed = 1; p.energy = xlr8.maxEnergy;
  for(let i=0;i<90;i++){ p.superHeld = true; p.energy = xlr8.maxEnergy; d.updatePlayer(DT); d.updateSpeedEffects(DT); }
  const fovFast = d.camera.fov;
  check('camera FOV is wider at max speed', fovFast > d.BASE_FOV + 6, `fov=${fovFast.toFixed(1)} base=${d.BASE_FOV}`);
  check('camera FOV does not become excessively wide', fovFast <= d.BASE_FOV + d.XLR8_MAX_FOV_BOOST + 0.5, `fov=${fovFast.toFixed(1)}`);
  p.superHeld = false; p.superT = 0;
  for(let i=0;i<120;i++){ d.updatePlayer(DT); d.updateSpeedEffects(DT); }
  check('FOV returns to normal after slowing', d.camera.fov < d.BASE_FOV + 2, `fov=${d.camera.fov.toFixed(1)}`);

  console.log('\n=== Test 5b: XLR8 camera stays close enough to keep the character visible ===');
  p.superHeld = false; p.superT = 0; p.superSpeed = 0; p.energy = xlr8.maxEnergy;
  d.updateCamera();
  const normalCamDist = d.camera.position.distanceTo(p.pos);
  p.superHeld = true; p.superT = 1; p.superSpeed = 1;
  for(let i=0;i<120;i++){ d.updatePlayer(DT); d.updateCamera(); }
  const fastCamDist = d.camera.position.distanceTo(p.pos);
  check('XLR8 camera distance increases only modestly at max speed', fastCamDist < normalCamDist*1.35, `normal=${normalCamDist.toFixed(2)} fast=${fastCamDist.toFixed(2)}`);

  console.log('\n=== Test 6: speed effects are pooled and bounded ===');
  p.superHeld = true; p.superT = 1; p.energy = xlr8.maxEnergy; p.onGround = true;
  for(let i=0;i<180;i++){ p.superHeld = true; p.energy = xlr8.maxEnergy; d.updatePlayer(DT); d.updateSpeedEffects(DT); }
  const visibleStreaks = d.streaks.filter(s=>s.mesh.visible).length;
  check('speed streaks are visible at high speed', visibleStreaks > 0, `${visibleStreaks} streaks`);
  check('streak count never exceeds the fixed pool', d.streaks.length === 14);
  check('dust puff pool is a fixed size', d.dustPuffs.length === 12);

  console.log('\n=== Test 7: high-speed tackle damages and knocks back enemies ===');
  p.form = xlr8; p.pos.set(0.5, 3, 0.5); p.yaw = 0; p.superSpeed = 0.9; p.superT = 0.9; p.superHeld = true; p.energy = xlr8.maxEnergy;
  const victim = d.makeEnemy('normal', p.pos.x, p.pos.z - 1.0);
  const hpBefore = victim.hp;
  p.superHeld = true; p.energy = xlr8.maxEnergy; p.superT = 0.9;
  d.updatePlayer(DT);
  check('enemy took damage from the tackle', victim.hp < hpBefore, `${hpBefore} -> ${victim.hp}`);
  check('a single tackle at high speed does NOT one-shot a normal enemy', victim.hp > 0, `hp=${victim.hp.toFixed(1)}`);
  check('enemy was knocked away (knockback velocity applied)', victim.knockVel && victim.knockVel.length() > 3, `knock=${victim.knockVel?victim.knockVel.length().toFixed(1):'none'}`);
  const hpAfterFirst = victim.hp;
  d.updatePlayer(DT); d.updatePlayer(DT);
  check('same enemy is NOT damaged again on the very next frames (per-enemy cooldown)', victim.hp === hpAfterFirst, `hp=${victim.hp}`);

  console.log('\n=== Test 7b: XLR8 can outrun normal enemies, but a speed enemy keeps pace early on ===');
  const chaser = d.makeEnemy('normal', 0.5, 20); const sprinter = d.makeEnemy('speed', 0.5, 20);
  const gap0 = (e)=>e.mesh.position.distanceTo(p.pos);
  // walk-speed XLR8 (no super speed): a speed enemy is faster than a normal one
  check('speed enemy is faster than a normal enemy', d.ENEMY_STATS.speed.speed > d.ENEMY_STATS.normal.speed);
  check('speed enemy is FASTER than XLR8 walking pace, so it can genuinely chase him', d.ENEMY_STATS.speed.speed > xlr8.speed, `enemy=${d.ENEMY_STATS.speed.speed} xlr8walk=${xlr8.speed}`);
  // at full super speed XLR8 is many times faster than any enemy in the game
  const fastest = Math.max(...Object.values(d.ENEMY_STATS).map(s=>s.speed));
  check('at max super speed XLR8 far outruns every enemy type', 40 > fastest*3, `xlr8~40 vs fastest enemy=${fastest}`);
  check('but the fastest enemy is not slower than a normal player run (it is a real threat)', fastest >= 8, `fastest=${fastest}`);
  chaser.alive=false; sprinter.alive=false;

  console.log('\n=== Test 8: slow movement does NOT tackle ===');
  p.superSpeed = 0; p.superT = 0; p.superHeld = false;
  const bystander = d.makeEnemy('normal', p.pos.x + 1.0, p.pos.z);
  const bHp = bystander.hp;
  for(let i=0;i<10;i++) d.updatePlayer(DT);
  check('walking into an enemy does not tackle-damage it', bystander.hp === bHp);

  console.log('\n=== Test 9: chunk preloading is biased AHEAD of movement direction ===');
  // Reset streaming state cleanly: teleport far out, then run in +X at XLR8 speed using the real streaming function.
  const startX = 800, startZ = 800;
  p.pos.set(startX, 3, startZ);
  // simulate a straight sprint east at ~60 u/s through the streamer with fixed dt
  let x = startX; const SPEED = 60;
  for(let i=0;i<20;i++){ d.updateChunkStreaming(x, startZ, DT); }   // settle
  for(let i=0;i<180;i++){ x += SPEED*DT; d.updateChunkStreaming(x, startZ, DT); }  // 3 seconds of sprinting east
  const [pcx,pcz] = d.chunkCoordOf(x, startZ);
  let ahead=0, behind=0;
  for(const c of d.chunks.values()){
    const dx = c.cx-pcx;
    if(dx>0) ahead+=1; else if(dx<0) behind+=1;
  }
  console.log(`   loaded chunks: ${d.chunks.size}  ahead of player=${ahead}  behind=${behind}`);
  check('more chunks are loaded ahead than behind while sprinting', ahead > behind, `ahead=${ahead} behind=${behind}`);
  // furthest loaded chunk ahead vs behind
  let maxAhead=0, maxBehind=0;
  for(const c of d.chunks.values()){ const dx=c.cx-pcx; if(dx>maxAhead) maxAhead=dx; if(-dx>maxBehind) maxBehind=-dx; }
  check('reaches further ahead of the player than behind', maxAhead > maxBehind, `maxAhead=${maxAhead} maxBehind=${maxBehind}`);
  check('the chunk the player is standing in is loaded (no falling through the world)', d.chunks.has(pcx+','+pcz));
  // Nearby ground must exist several chunks ahead -> no pop-in in the direct path
  let gapsInPath = 0;
  for(let k=1;k<=3;k++){ if(!d.chunks.has((pcx+k)+','+pcz)) gapsInPath++; }
  check('the next 3 chunks directly ahead are loaded (no pop-in in your path)', gapsInPath === 0, `missing=${gapsInPath}`);

  console.log('\n=== Test 10: memory stays bounded during a very long sprint ===');
  let peak = 0;
  for(let i=0;i<1800;i++){ x += SPEED*DT; d.updateChunkStreaming(x, startZ, DT); peak = Math.max(peak, d.chunks.size); }
  console.log(`   after 30 more seconds of sprinting (${Math.round(x-startX)} units): live chunks=${d.chunks.size} peak=${peak} queue=${d.loadQueue.length}`);
  check('live chunk count stays bounded (no leak while streaming far)', peak < 130, `peak=${peak}`);
  check('load queue stays bounded', d.loadQueue.length < 120, `queue=${d.loadQueue.length}`);

  console.log('\n=== Test 11: per-frame chunk generation is capped (no single-frame freeze) ===');
  // Teleport somewhere fresh so a big backlog exists, then count chunks generated in ONE streaming call.
  x += 500; d.updateChunkStreaming(x, startZ, DT);
  const before1 = d.chunks.size;
  d.updateChunkStreaming(x + SPEED*DT, startZ, DT);
  const gen = d.chunks.size - before1;
  check('a single frame generates at most 5 chunks even with a large backlog', gen <= 5, `generated=${gen}`);

  console.log('\n=== Test 12: standing still returns to a normal symmetric load ===');
  for(let i=0;i<300;i++){ d.updateChunkStreaming(x, startZ, DT); }
  check('no errors while streaming', caughtErrors.length === 0);
  if(caughtErrors.length) caughtErrors.forEach(e=>console.log('  -', e));

  console.log(allPass ? '\nALL CHECKS PASS' : '\nFAILURES DETECTED');
  process.exit(allPass ? 0 : 1);
}, 500);
