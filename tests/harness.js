// Shared jsdom harness. Injects a test-only __debug bridge (NOT present in the shipped file).
const { JSDOM } = require('jsdom');
const fs = require('fs');
const SRC = process.env.GAME || '/home/claude/proj/www/index.html';
const THREE_SRC = fs.readFileSync('/home/claude/proj/www/three.min.js','utf8');

function boot(bridgeExtra=''){
  let html = fs.readFileSync(SRC,'utf8');
  const rendererStub = `window.THREE.WebGLRenderer=function(){return{domElement:document.createElement('canvas'),setSize(){},setPixelRatio(){},setClearColor(){},render(){},dispose(){},shadowMap:{enabled:false,type:0},setAnimationLoop(){},getContext(){return null},capabilities:{},info:{render:{calls:0}}};};`;
  html = html.replace('<script src="three.min.js"></script>', `<script>${THREE_SRC}\n${rendererStub}</script>`);
  // inject debug bridge just before the IIFE closes
  const bridge = `window.__debug={player,enemies,squad:typeof squad!=='undefined'?squad:null,camera,scene,lock,ALIENS,BEN,setForm,setLock,lockedTarget,lockValid,tapLock,lockButton,pickEnemyAtScreen,unlockTarget,updateLockOn,meleeAttack,damageEnemy,makeEnemy,spawnNpc,splitEcho,sonicDoom,doomTargetPos,groundTopAt,flatFwd,lockDirFrom,aimAtLock,useAction,useSpecial,camEndTest:(x,y)=>tapLock(x,y),get camTouchId(){return camTouchId},noteUserLook,cycleAlien,revertToBen};${bridgeExtra}`;
  html = html.replace("// initial portrait render for Ben", bridge+"\n// initial portrait render for Ben");
  const errors=[];
  const dom = new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://example.test/',
    beforeParse(w){
      w.HTMLCanvasElement.prototype.getContext=function(t){ if(t==='2d') return {fillRect(){},fillText(){},drawImage(){},getImageData(){return{data:[]}},fillStyle:'',font:'',textAlign:'',strokeStyle:'',lineWidth:1,beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},clearRect(){},createLinearGradient(){return{addColorStop(){}}},rect(){},roundRect(){},closePath(){},save(){},restore(){},translate(){},scale(){},rotate(){},measureText(){return{width:10}}}; return {getExtension:()=>null,getParameter:()=>4,getContextAttributes:()=>({}),getSupportedExtensions:()=>[]}; };
      w.AudioContext=w.webkitAudioContext=function(){return{state:'running',resume(){},sampleRate:44100,createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}},createGain(){return{connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}}},createBuffer(c,l){return{getChannelData(){return new Float32Array(l)}}},createBufferSource(){return{connect(){},start(){},stop(){},buffer:null}},destination:{}};};
      w.HTMLMediaElement.prototype.play=()=>Promise.resolve(); w.HTMLMediaElement.prototype.pause=()=>{};
      w.__raf=[]; w.requestAnimationFrame=cb=>{w.__raf.push(cb);return w.__raf.length;};
      w.addEventListener('error',e=>errors.push(e.error?(e.error.stack||e.error.message):e.message));
    }});
  const w=dom.window;
  const pump=(n=1)=>{ for(let i=0;i<n;i++){ const cbs=w.__raf.splice(0); cbs.forEach(cb=>cb(i*16.6)); } };
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // deterministic time: jsdom's THREE.Clock uses performance.now; advance real time in small steps
  const frames=async(n,ms=17)=>{ for(let i=0;i<n;i++){ pump(1); await sleep(ms); } };
  return {w,dom,errors,pump,sleep,frames};
}
module.exports={boot};
