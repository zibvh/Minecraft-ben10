// Stage 7 static regression checks. Run with: node tests/test_vertical_city.js
const fs=require('fs');
const s=fs.readFileSync(process.env.GAME || 'www/index.html','utf8');
const checks=[
  ['Stage 7 marker', /STAGE 7 — VERTICAL CITY/],
  ['chunk-owned walk surfaces', /platforms:\[\]/],
  ['walk surface registry', /const walkSurfaces=\[\]/],
  ['roof-aware collision', /roofAccessY/],
  ['rooftop deck', /function rooftopProps/],
  ['stairs', /function accessStairs/],
  ['ramp', /function accessRamp/],
  ['fire escape', /function fireEscape/],
  ['ground query includes platforms', /for\(let i=walkSurfaces\.length-1;i>=0;i--\)/],
  ['chunk cleanup removes platforms', /chunk\.props\.platforms\.forEach/],
  ['tower roof gameplay', /rooftopProps\(cx,cz,8,8,top/],
  ['apartment roof gameplay', /rooftopProps\(cx,cz,7,7,top/],
  ['shop roof gameplay', /rooftopProps\(cx,cz,8,7,top/],
  ['school roof gameplay', /rooftopProps\(cx,cz-2\.5,9\.4,4/]
];
let failed=0;
for(const [name,re] of checks){ const ok=re.test(s); console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if(failed) process.exit(1);
