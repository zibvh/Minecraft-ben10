const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(60); const d=g.d; const out=[]; const ok=(c,m)=>out.push((c?'PASS ':'FAIL ')+m);
// ---- layout: road hierarchy
const L=d.nearestLine; 
ok(L(40).level===3&&L(-40).level===1&&L(360).level===2&&L(1320).level===3,'road levels: boulevard @40, street @-40, avenue @360, boulevard @1320');
ok(d.zoneType(40,500)==='asphalt'&&d.zoneType(0,0)==='grass'&&d.zoneType(-35,0)==='concrete','zones: boulevard asphalt, origin grass, street sidewalk');
// widths
let wB=0,wA=0,wS=0; for(let x=0;x<400;x+=.5){ if(d.zoneType(x,0)!=='grass'){ } } 
const width=(c)=>{ let w=0; for(let x=c-40;x<c+40;x+=.5) if(d.zoneType(x,0.5+80*3)!=='grass') w+=.5; return w; };
console.log('overall width incl sidewalks: boulevard',width(40),'avenue',width(360),'street',width(-40),'(units; Ben is 2.4 tall)');
// ---- build a big sample of lots across districts and audit overlap with roads
let bad=[], kinds={}, ms=[], cols=0, dists={};
for(let bx=-14;bx<=14;bx+=1) for(let bz=-14;bz<=14;bz+=1) for(let li=0;li<4;li++){
  const sp=d.lotSpec(bx,bz,li); kinds[sp.kind]=(kinds[sp.kind]||0)+1; dists[sp.dist]=(dists[sp.dist]||0)+1;
  if((bx+bz+li)%5) continue;          // audit every 5th lot (keeps runtime small)
  const lot=d.generateLot(sp); ms.push(d.STAT.lotMsLast); cols+=lot.o.colliders.length;
  for(const c of lot.o.colliders){ if(c.nb) continue; // solids must not sit on asphalt
    for(const [x,z] of [[c.x0+.01,c.z0+.01],[c.x1-.01,c.z0+.01],[c.x0+.01,c.z1-.01],[c.x1-.01,c.z1-.01]]) if(d.zoneType(x,z)==='asphalt'){ bad.push(sp.kind+' '+sp.bx+','+sp.bz+','+sp.li+' @'+x.toFixed(1)+','+z.toFixed(1)); break; } }
  if(d.lots.size>40){ for(const l of [...d.lots.values()].slice(0,20)) d.disposeLot(l); }
}
ok(bad.length===0,'no building/prop collider sits on asphalt ('+bad.length+' violations'+(bad.length?': '+bad.slice(0,4).join(' | '):'')+')');
console.log('kinds',JSON.stringify(kinds),'districts',JSON.stringify(dists));
ms.sort((a,b)=>a-b); console.log('lot build ms: median',ms[ms.length>>1].toFixed(2),'p95',ms[Math.floor(ms.length*.95)].toFixed(2),'max',ms[ms.length-1].toFixed(2),'| avg colliders/lot',(cols/ms.length).toFixed(0));
// heights
let hmax=0,hk=''; for(let bx=-6;bx<=6;bx++) for(let bz=-6;bz<=6;bz++) for(let li=0;li<4;li++){ const sp=d.lotSpec(bx,bz,li); if(sp.h>hmax){hmax=sp.h;hk=sp.kind+' '+sp.dist;} }
console.log('tallest downtown-area building',hmax.toFixed(0),'units (~'+(hmax*.73).toFixed(0)+' m)',hk);
ok(hmax>90&&hmax<200,'skyscrapers reach believable height');
// determinism
const a=JSON.stringify(d.lotSpec(7,-9,2)), b=JSON.stringify(d.lotSpec(7,-9,2)); ok(a===b,'lot layout is deterministic');
console.log(out.join('\n')); console.log('errors',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,6).join('\n')));
