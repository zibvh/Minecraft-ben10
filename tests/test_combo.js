const { JSDOM } = require('jsdom');
const fs = require('fs');

let html = fs.readFileSync('/home/claude/index_test_copy.html', 'utf8');
const threeSrc = fs.readFileSync('/home/claude/ben10/www/three.min.js', 'utf8');
const rendererStub = `
window.THREE.WebGLRenderer = function(){
  return {
    domElement: document.createElement('canvas'),
    setSize(){}, setPixelRatio(){}, setClearColor(){}, render(){}, dispose(){},
    shadowMap: {enabled:false, type:0},
    setAnimationLoop(){}, getContext(){ return null; }, capabilities:{}, info:{render:{calls:0}},
  };
};`;
html = html.replace('<script src="three.min.js"></script>', `<script>${threeSrc}\n${rendererStub}</script>`);

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  url: 'https://example.test/',
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function(type) {
      if (type === '2d') {
        return { fillRect(){}, fillText(){}, drawImage(){}, getImageData(){ return {data:[]}; },
          fillStyle:'', font:'', textAlign:'', strokeStyle:'', lineWidth:1, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, arc(){}, fill(){}, clearRect(){}, createLinearGradient(){ return {addColorStop(){}}; }, rect(){}, roundRect(){}, closePath(){}, save(){}, restore(){}, translate(){}, scale(){}, rotate(){}, measureText(){ return {width:10}; } };
      }
      return { getExtension:()=>null, getParameter:()=>4, getContextAttributes:()=>({}), getSupportedExtensions:()=>[] };
    };
    window.AudioContext = window.webkitAudioContext = function(){
      return {
        state:'running', resume(){}, sampleRate:44100,
        createOscillator(){ return {connect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}; },
        createGain(){ return {connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}}; },
        createBuffer(channels,length,sampleRate){ return { getChannelData(){ return new Float32Array(length); } }; },
        createBufferSource(){ return { connect(){}, start(){}, stop(){}, buffer:null }; },
        destination:{}
      };
    };
    window.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
    window.HTMLMediaElement.prototype.pause = function(){};
    window.__rafCallbacks = [];
    window.requestAnimationFrame = (cb) => { window.__rafCallbacks.push(cb); return window.__rafCallbacks.length; };
  }
});

const window = dom.window;
let caughtErrors = [];
window.addEventListener('error', (e) => { caughtErrors.push(e.error ? (e.error.stack||e.error.message) : e.message); });

function pump(n=1){
  for(let i=0;i<n;i++){
    const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
    cbs.forEach(cb => cb(i*16.6));
  }
}
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
// Pumps the queued rAF callback repeatedly while real time passes, so dt (which comes from a real
// THREE.Clock measuring wall-clock time) actually advances the way it would across real device frames.
async function pumpFor(ms, intervalMs=16){
  const steps = Math.ceil(ms/intervalMs);
  for(let i=0;i<steps;i++){
    await wait(intervalMs);
    const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
    cbs.forEach(cb => cb(performance.now ? performance.now() : Date.now()));
  }
}

setTimeout(async () => {
  console.log('=== Setup: start game, spawn a test enemy directly in front of the player ===');
  window.document.getElementById('btn-start').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  pump(5);

  const dbg = window.__debug;
  if(!dbg){ console.log('FAIL: debug bridge not found'); process.exit(1); }

  // Place an enemy 1.5 units directly in front of the player (yaw=0 means -Z is forward, matching meleeAttack's forward vector).
  const p = dbg.player;
  const testEnemy = dbg.makeEnemy('scout', p.pos.x, p.pos.z - 1.5);
  console.log('enemy spawned, hp:', testEnemy.hp, 'alive:', testEnemy.alive);

  console.log('\n=== Test 1: single punch lands and deals base damage ===');
  const hpBefore = testEnemy.hp;
  dbg.meleeAttack();
  console.log('comboStep after 1st punch (should be 1):', p.comboStep);
  await pumpFor(150); // hit lands partway through the swing animation;
  const hpAfterPunch1 = testEnemy.hp;
  console.log('hp before:', hpBefore, 'after punch 1:', hpAfterPunch1);
  console.log(hpAfterPunch1 < hpBefore ? 'PASS: punch 1 dealt damage' : 'FAIL: punch 1 did not damage enemy');

  console.log('\n=== Test 2: combo advances through punch 2 and heavy finisher ===');
  p.atkTimer = 0; // clear cooldown so we can chain immediately, simulating rapid taps
  dbg.meleeAttack();
  console.log('comboStep after 2nd punch (should be 2):', p.comboStep);
  await pumpFor(150);;
  const hpAfterPunch2 = testEnemy.hp;
  console.log('hp after punch 2:', hpAfterPunch2, hpAfterPunch2 < hpAfterPunch1 ? 'PASS' : 'FAIL');

  p.atkTimer = 0;
  dbg.meleeAttack(); // this should be the heavy finisher (step was 2)
  console.log('comboStep after heavy finisher (should wrap to 0):', p.comboStep);
  await pumpFor(200);;
  const hpAfterHeavy = testEnemy.hp;
  const heavyDmg = hpAfterPunch2 - hpAfterHeavy;
  const punch1Dmg = hpBefore - hpAfterPunch1;
  console.log('punch 1 damage:', punch1Dmg, '| heavy finisher damage:', heavyDmg);
  console.log(heavyDmg > punch1Dmg ? 'PASS: heavy finisher deals more damage than a normal punch' : 'FAIL: heavy finisher not stronger');

  console.log('\n=== Test 3: combo resets after waiting too long ===');
  p.comboStep = 1; // pretend we're mid-combo
  p.comboResetTimer = 0.9;
  await pumpFor(1300); // real elapsed time > the 0.9s reset window (dt comes from a real Clock, so real time must pass);
  console.log('comboStep after long wait (should reset to 0):', p.comboStep);
  console.log(p.comboStep === 0 ? 'PASS: combo reset after timeout' : 'FAIL: combo did not reset');

  console.log('\n=== Test 4: knockback and stagger applied on hit ===');
  const testEnemy2 = dbg.makeEnemy('scout', p.pos.x, p.pos.z - 1.5);
  p.atkTimer = 0; p.comboStep = 0;
  dbg.meleeAttack();
  await pumpFor(150);;
  console.log('enemy staggerT after hit (should be > 0):', testEnemy2.staggerT);
  console.log('enemy knockVel after hit (should be nonzero):', testEnemy2.knockVel ? testEnemy2.knockVel.length().toFixed(2) : 'undefined');
  console.log((testEnemy2.staggerT > 0 && testEnemy2.knockVel && testEnemy2.knockVel.length() > 0) ? 'PASS: stagger + knockback applied' : 'FAIL: missing stagger/knockback');

  console.log('\n=== Test 5: frontal cone - enemy directly behind player is NOT hit ===');
  const behindEnemy = dbg.makeEnemy('scout', p.pos.x, p.pos.z + 1.5); // behind, since forward is -Z
  const behindHpBefore = behindEnemy.hp;
  p.atkTimer = 0; p.comboStep = 0;
  dbg.meleeAttack();
  await pumpFor(150);;
  console.log('behind-enemy hp before:', behindHpBefore, 'after:', behindEnemy.hp);
  console.log(behindEnemy.hp === behindHpBefore ? 'PASS: enemy behind player was not hit' : 'FAIL: rear enemy was incorrectly hit');

  console.log('\n=== Errors during test ===');
  console.log(caughtErrors.length === 0 ? 'PASS: no uncaught errors' : 'FAIL: ' + caughtErrors.join('; '));

  console.log("\n=== Test 6: per-alien melee tuning - Four Arms finisher hits harder than Ben's ===");
  const fourArmsForm = dbg.ALIENS.find(a=>a.id==='four_arms');
  dbg.setForm(fourArmsForm, 'four_arms');
  p.comboStep = 2; p.atkTimer = 0; // force straight to heavy finisher
  const faEnemy = dbg.makeEnemy('scout', p.pos.x, p.pos.z - 1.5);
  const faHpBefore = faEnemy.hp;
  dbg.meleeAttack();
  await pumpFor(250);
  const faDmg = faHpBefore - faEnemy.hp;
  console.log('Ben heavy finisher damage: 12.8 | Four Arms heavy finisher damage:', faDmg);
  console.log(faDmg > 12.8 ? "PASS: Four Arms finisher hits harder than Ben's" : 'FAIL: per-alien tuning not applied');

  process.exit(caughtErrors.length > 0 ? 1 : 0);
}, 500);
