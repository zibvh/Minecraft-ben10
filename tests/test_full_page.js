const { JSDOM } = require('jsdom');
const fs = require('fs');

let html = fs.readFileSync('/home/claude/ben10/www/index.html', 'utf8');
const threeSrc = fs.readFileSync('/home/claude/ben10/www/three.min.js', 'utf8');
// Patch WebGLRenderer to a no-op stub right after three.js defines it, before any game code runs.
// We're hunting variable-ordering/reference bugs in the game script, not testing three.js's own renderer.
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

// Stub WebGL context (jsdom has no real GPU) so three.js's renderer construction doesn't throw.
const stubGLContext = {
  getExtension: () => null, getParameter: () => 4, getContextAttributes: () => ({alpha:true,antialias:true,depth:true,stencil:true,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'default',failIfMajorPerformanceCaveat:false}),
  getSupportedExtensions: () => [],
  createShader: () => ({}), shaderSource: () => {}, compileShader: () => {}, getShaderParameter: () => true,
  createProgram: () => ({}), attachShader: () => {}, linkProgram: () => {}, getProgramParameter: () => true,
  useProgram: () => {}, createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {},
  enable: () => {}, disable: () => {}, viewport: () => {}, clearColor: () => {}, clear: () => {},
  getAttribLocation: () => 0, getUniformLocation: () => ({}), enableVertexAttribArray: () => {},
  vertexAttribPointer: () => {}, drawArrays: () => {}, drawElements: () => {}, depthFunc: () => {},
  createTexture: () => ({}), bindTexture: () => {}, texImage2D: () => {}, texParameteri: () => {},
  activeTexture: () => {}, pixelStorei: () => {}, blendFunc: () => {}, blendFuncSeparate: () => {},
  cullFace: () => {}, frontFace: () => {}, getShaderInfoLog: () => '', getProgramInfoLog: () => '',
  createFramebuffer: () => ({}), bindFramebuffer: () => {}, framebufferTexture2D: () => {},
  checkFramebufferStatus: () => 36053, deleteShader: () => {}, deleteProgram: () => {}, deleteBuffer: () => {},
  deleteTexture: () => {}, isContextLost: () => false, scissor: () => {}, colorMask: () => {}, depthMask: () => {},
  stencilMask: () => {}, clearDepth: () => {}, clearStencil: () => {}, getShaderPrecisionFormat: () => ({precision:1,rangeMin:1,rangeMax:1}),
  canvas: {}, drawingBufferWidth: 800, drawingBufferHeight: 600,
};

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
      return stubGLContext;
    };
    window.AudioContext = window.webkitAudioContext = function(){ return { state:'running', resume(){}, createOscillator(){ return {connect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}; }, createGain(){ return {connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}}; }, destination:{} }; };
    window.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
    window.HTMLMediaElement.prototype.pause = function(){};
    window.__rafCallbacks = [];
    window.requestAnimationFrame = (cb) => { window.__rafCallbacks.push(cb); return window.__rafCallbacks.length; };
  }
});

const window = dom.window;
let caughtErrors = [];
window.addEventListener('error', (e) => {
  caughtErrors.push(e.error ? (e.error.stack || e.error.message) : e.message);
});
window.onerror = (msg, src, line, col, err) => {
  caughtErrors.push(`${msg} (line ${line})`);
};

// Give scripts a moment to run (jsdom executes synchronously for inline scripts, but just in case of any deferred bits)
setTimeout(() => {
  console.log('=== Full page load test (menu screen) ===');
  if (caughtErrors.length === 0) {
    console.log('PASS: no uncaught errors during initial script execution');
  } else {
    console.log('FAIL: uncaught errors found during load:');
    caughtErrors.forEach(e => console.log('  -', e));
  }
  const menuBanner = window.document.getElementById('menu-panel');
  const menuBannerText = menuBanner ? menuBanner.textContent : '';
  if (menuBannerText.includes('ERROR:')) {
    console.log('FAIL: menu error banner shows an error message:', menuBannerText.match(/ERROR:.*/)?.[0]);
  } else {
    console.log('PASS: no error banner text present on menu');
  }

  console.log('\n=== Clicking START GAME (real user action) ===');
  const startBtn = window.document.getElementById('btn-start');
  try {
    startBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    console.log('PASS: start button click handled without throwing');
  } catch(e) {
    console.log('FAIL: start button click threw:', e.message);
  }

  console.log('\n=== Simulating sustained forward movement (crosses chunk boundaries) ===');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyW' }));
  let frameErrors = 0;
  for (let i = 0; i < 300; i++) {
    const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
    cbs.forEach(cb => {
      try { cb(i * 16.6); } catch(e) { frameErrors++; if(frameErrors<=5) console.log('FRAME ERROR at frame',i,':', e.message); }
    });
  }
  window.dispatchEvent(new window.KeyboardEvent('keyup', { code: 'KeyW' }));
  console.log(frameErrors === 0 ? 'PASS: 300 frames of sustained movement, no errors' : `FAIL: ${frameErrors} frame errors during movement`);

  console.log('\n=== Testing alien form switches (Q/E/R/T/Y/U keys) ===');
  let formErrors = 0;
  ['KeyE','KeyR','KeyT','KeyY','KeyU','KeyQ'].forEach(code => {
    try {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { code }));
      window.dispatchEvent(new window.KeyboardEvent('keyup', { code }));
      const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
      cbs.forEach(cb => cb(performance.now ? performance.now() : Date.now()));
    } catch(e) { formErrors++; console.log('FORM SWITCH ERROR on', code, ':', e.message); }
  });
  console.log(formErrors === 0 ? 'PASS: all form-switch keys handled without error' : `FAIL: ${formErrors} form switch errors`);

  console.log('\n=== Testing block break/place (F to attack near ground, G to place) ===');
  let blockErrors = 0;
  try {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyG' }));
    const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
    cbs.forEach(cb => cb(performance.now ? performance.now() : Date.now()));
    console.log('PASS: block place key handled without error');
  } catch(e) { blockErrors++; console.log('FAIL: block place error:', e.message); }

  console.log('\n=== Testing Cannonbolt roll (switch to him, hold roll button across many frames) ===');
  let rollErrors = 0;
  try {
    // Cycle forms with Q (revert) then E/R/T/Y/U until we land on cannonbolt - simplest robust approach
    // is to swipe the alien portrait, but the actions panel is form-specific so just check it doesn't throw
    // across an extended hold of the first action button (roll is the only action cannonbolt has).
    for(let cycle=0; cycle<7; cycle++){
      window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyE' }));
      const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
      cbs.forEach(cb => cb(performance.now ? performance.now() : Date.now()));
    }
    const actionBtns = window.document.querySelectorAll('.abtn.act');
    if(actionBtns.length){
      const btn = actionBtns[0];
      btn.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
      for(let i=0;i<90;i++){
        const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
        cbs.forEach(cb => cb(i*16.6));
      }
      btn.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
      for(let i=0;i<30;i++){
        const cbs = window.__rafCallbacks ? window.__rafCallbacks.splice(0) : [];
        cbs.forEach(cb => cb(i*16.6));
      }
      console.log('PASS: held an action button for 90 frames + released for 30, no errors');
    } else {
      console.log('SKIP: no action buttons found (form may not have cycled to one with actions)');
    }
  } catch(e) { rollErrors++; console.log('FAIL: roll test error:', e.message); }

  const finalErrors = caughtErrors.length;
  const allPass = finalErrors === 0 && frameErrors === 0 && formErrors === 0 && blockErrors === 0 && rollErrors === 0 && !menuBannerText.includes('ERROR:');
  console.log(allPass ? '\nALL CHECKS PASS' : '\nFAILURES DETECTED');
  process.exit(allPass ? 0 : 1);
}, 500);
