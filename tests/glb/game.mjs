import {chromium} from '/opt/npm-tools/node_modules/playwright/index.mjs';
export async function open(){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
  const p=await b.newPage({viewport:{width:900,height:520}});
  p.on('console',m=>{ const t=m.text(); if(/GLB|error|Error|warn/i.test(t)) console.log('console:',t.slice(0,300)); });
  p.on('pageerror',e=>console.log('pageerror',e.message));
  await p.goto('http://localhost:8766/_t.html'); await p.waitForTimeout(2500);
  return {b,p};
}
