// Dependency-free headless harness: real game script + real three.min.js in a Node vm, mock DOM/audio/WebGL.
const fs=require('fs'), vm=require('vm');
const SRC=process.env.GAME||''+__dirname+'/../www/index.html';
const THREE_SRC=fs.readFileSync(''+__dirname+'/../www/three.min.js','utf8');
function anyProxy(){ const f=function(){}; const p=new Proxy(f,{get(t,k){ if(k===Symbol.toPrimitive) return ()=>0; if(k==='then') return undefined; if(k==='value'||k==='currentTime'||k==='sampleRate') return k==='sampleRate'?44100:0; return p; },set(){return true;},apply(){return p;},construct(){return p;}}); return p; }
class El{
  constructor(id){ this.id=id; this.style={setProperty(k,v){this[k]=v;}}; this.dataset={}; this.children=[]; this._l={}; this._cls=new Set(); this.textContent=''; this._attrs={};
    const self=this; this.classList={add:(...c)=>c.forEach(x=>self._cls.add(x)),remove:(...c)=>c.forEach(x=>self._cls.delete(x)),toggle:(c,f)=>{ if(f===undefined) f=!self._cls.has(c); f?self._cls.add(c):self._cls.delete(c); },contains:c=>self._cls.has(c)}; }
  set innerHTML(v){ this._ih=v; this.children=[]; } get innerHTML(){ return this._ih||''; }
  get firstChild(){ return this.children[0]||null; } 
  appendChild(c){ this.children.push(c); return c; } removeChild(c){ this.children=this.children.filter(x=>x!==c); return c; }
  addEventListener(t,f){ (this._l[t]=this._l[t]||[]).push(f); } removeEventListener(){}
  fire(t,ev){ (this._l[t]||[]).forEach(f=>f(Object.assign({preventDefault(){},stopPropagation(){},changedTouches:[],touches:[]},ev||{}))); }
  setAttribute(k,v){ this._attrs[k]=v; } getAttribute(k){ return k==='src'?(this.src||null):(this._attrs[k]||null); }
  getBoundingClientRect(){ return {left:0,top:0,width:800,height:400}; }
  getContext(){ return anyProxy(); } toDataURL(){ return 'data:image/png;base64,AAA'; }
  querySelector(){ return new El('q'); } querySelectorAll(){ return []; } remove(){} focus(){} cloneNode(){ const e=new El('c'); e.play=()=>Promise.resolve(); return e; }
  play(){ return Promise.resolve(); } pause(){} requestPointerLock(){}
  get clientWidth(){return 800;} get clientHeight(){return 400;} get width(){return this._w||800;} set width(v){this._w=v;} get height(){return this._h||400;} set height(v){this._h=v;}
}
function boot(opts={}){
  let html=fs.readFileSync(SRC,'utf8');
  const scripts=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  let main=scripts[scripts.length-1];
  const bridge=`window.__d={player,enemies,props,ALIENS,BEN,OMNI,tryTransform,setForm,updateOmnitrix,enterCar,exitCar,nearestCar,moveInput,keys,makeEnemy,camera,scene,QUALITY,GRAVITY,damageEnemy,ATK_SLOTS_MELEE,spawnTraffic,groundTopAt,cycleAlien,toggleDial,closeDial,OMNI_MIN,PS,NPC_SCALE,CHAR_SCALE,ENEMY_STATS,GANGS,spawnNpc,provoke,renderer,get CAR_MAX_FWD(){return CAR_MAX_FWD;},camDyn,Audio_,buildCharacter};\n`;
  assert(main.includes('// initial portrait render for Ben'));
  main=main.replace('// initial portrait render for Ben',bridge+'// initial portrait render for Ben');
  const els={}; const errors=[]; let T=0; const raf=[];
  const doc={getElementById:id=>els[id]||(els[id]=new El(id)),createElement:t=>new El(t),body:new El('body'),documentElement:new El('html'),addEventListener(){},querySelector:()=>new El('q'),querySelectorAll:()=>[],hidden:false};
  const win={document:doc,innerWidth:800,innerHeight:400,devicePixelRatio:1,navigator:{maxTouchPoints:1,userAgent:'x'},screen:{orientation:{lock:()=>Promise.resolve()}},
    performance:{now:()=>T},requestAnimationFrame:cb=>{raf.push(cb);return raf.length;},cancelAnimationFrame(){},setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},
    AudioContext:function(){ return anyProxy(); },Audio:function(){ const e=new El('audio'); e.cloneNode=()=>{const c=new El('a');c.play=()=>Promise.resolve();return c;}; return e; },
    ontouchstart:null,console,Math,Date,JSON,Map,Set,WeakMap,Promise,Float32Array,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float64Array,ArrayBuffer,Symbol,Object,Array,Number,String,Error,isNaN,parseFloat,parseInt,Infinity,NaN,Proxy,Reflect,location:{href:'x'},localStorage:{getItem:()=>null,setItem(){}},
    addEventListener(t,f){ (win._l[t]=win._l[t]||[]).push(f); },_l:{}};
  win.window=win; win.self=win; win.globalThis=win; win.addEventListener('error',()=>{});
  const ctx=vm.createContext(win);
  vm.runInContext(THREE_SRC,ctx,{filename:'three.min.js'});
  vm.runInContext(`THREE.WebGLRenderer=function(){return{domElement:document.createElement('canvas'),setSize(){},setPixelRatio(){},setClearColor(){},render(){},dispose(){},shadowMap:{enabled:false,type:0},setAnimationLoop(){},getContext(){return null},capabilities:{},info:{render:{calls:0}}};};`,ctx);
  try{ vm.runInContext(main,ctx,{filename:'game.js'}); }catch(e){ errors.push('LOAD: '+(e.stack||e)); }
  const step=(n=1,ms=16.67)=>{ for(let i=0;i<n;i++){ T+=ms; const cbs=raf.splice(0); for(const cb of cbs){ try{ cb(T); }catch(e){ errors.push('FRAME: '+(e.stack||e)); } } } };
  return {win,ctx,els,errors,step,get d(){return win.__d;},start(){ els['btn-start'].fire('click'); },time:()=>T};
}
function assert(c,m){ if(!c) throw new Error('assert '+(m||'')); }
module.exports={boot,assert};
