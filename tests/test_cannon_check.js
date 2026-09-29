const { JSDOM } = require('jsdom'); const fs = require('fs');
let html = fs.readFileSync('/home/claude/index_test_copy.html','utf8');
const threeSrc = fs.readFileSync('/home/claude/ben10/www/three.min.js','utf8');
const rs = `window.THREE.WebGLRenderer=function(){return{domElement:document.createElement('canvas'),setSize(){},setPixelRatio(){},setClearColor(){},render(){},dispose(){},shadowMap:{enabled:false,type:0},setAnimationLoop(){},getContext(){return null;},capabilities:{},info:{render:{calls:0}}};};`;
html = html.replace('<script src="three.min.js"></script>', `<script>${threeSrc}\n${rs}</script>`);
const dom = new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://example.test/',beforeParse(w){
 w.HTMLCanvasElement.prototype.getContext=function(t){ if(t==='2d') return {fillRect(){},fillText(){},drawImage(){},getImageData(){return{data:[]}},fillStyle:'',font:'',textAlign:'',strokeStyle:'',lineWidth:1,beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},clearRect(){},createLinearGradient(){return{addColorStop(){}}},rect(){},roundRect(){},closePath(){},save(){},restore(){},translate(){},scale(){},rotate(){},measureText(){return{width:10}}}; return{getExtension:()=>null,getParameter:()=>4,getContextAttributes:()=>({}),getSupportedExtensions:()=>[]};};
 w.AudioContext=w.webkitAudioContext=function(){return{state:'running',resume(){},sampleRate:44100,createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}},createGain(){return{connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}}},createBuffer(c,l){return{getChannelData(){return new Float32Array(l)}}},createBufferSource(){return{connect(){},start(){},stop(){},buffer:null}},destination:{}};};
 w.HTMLMediaElement.prototype.play=()=>Promise.resolve(); w.HTMLMediaElement.prototype.pause=()=>{};
 w.__rafCallbacks=[]; w.requestAnimationFrame=cb=>{w.__rafCallbacks.push(cb);return 1;};
}});
const w=dom.window; let errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(()=>{
  w.document.getElementById('btn-start').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  w.__rafCallbacks.splice(0).forEach(cb=>cb(0));
  const d=w.__debug,p=d.player; const cb=d.ALIENS.find(a=>a.id==='cannonbolt');
  d.setForm(cb,'cannonbolt'); p.energy=cb.maxEnergy; p.pos.set(0.5,3,0.5); p.yaw=0; d.moveInput.x=0; d.moveInput.y=1;
  const DT=1/60; let ok=true; const chk=(n,c,x='')=>{console.log((c?'PASS':'FAIL')+': '+n+(x?'  ['+x+']':''));if(!c)ok=false;};
  // walking speed
  for(let i=0;i<30;i++) d.updatePlayer(DT); let a=p.pos.clone(); d.updatePlayer(DT); const walk=a.distanceTo(p.pos)/DT;
  // rolling
  p.rollHeld=true; for(let i=0;i<120;i++) d.updatePlayer(DT); a=p.pos.clone(); d.updatePlayer(DT); const roll=a.distanceTo(p.pos)/DT;
  console.log(`   cannonbolt walk=${walk.toFixed(1)} u/s  rolling=${roll.toFixed(1)} u/s  rollT=${p.rollT.toFixed(2)}`);
  chk('Cannonbolt is XLR8-independent: superSpeed stays 0 for him', (p.superSpeed||0)===0);
  chk('rolling makes Cannonbolt much faster than walking', roll > walk*3);
  chk('a rolling Cannonbolt still rams and damages enemies', (()=>{ const e=d.makeEnemy('normal',p.pos.x,p.pos.z-1.0); const h=e.hp; for(let i=0;i<5;i++){ p.rollHeld=true; d.updatePlayer(DT);} return e.hp<h; })());
  p.rollHeld=false; for(let i=0;i<120;i++) d.updatePlayer(DT);
  chk('releasing roll returns him to normal', p.rollT<0.05, 'rollT='+p.rollT.toFixed(3));
  chk('no uncaught errors', errs.length===0, errs.join(';'));
  console.log(ok?'\nCANNONBOLT OK':'\nCANNONBOLT BROKEN'); process.exit(ok?0:1);
},500);
