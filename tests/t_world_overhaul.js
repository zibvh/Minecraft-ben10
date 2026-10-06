const {boot}=require('./vmharness.js');
const g=boot();
const d=g.d, THREE=g.win.THREE;
const pass=[]; const fail=[];
const ok=(c,m)=>{(c?pass:fail).push(m); console.log((c?'PASS ':'FAIL ')+m);};
if(!d){ console.log('FAIL no debug bridge'); process.exit(1); }
console.log('load errors',g.errors.length); g.errors.forEach(e=>console.log(e));

const W=g.win.OMZ_WORLD.definition;
ok(W.city.id==='novacrest' && W.city.name==='Novacrest','fictional city identity is defined');
ok(W.districts.length>=6,'six or more named metropolitan districts');
ok(Object.keys(W.neighborhoods).length>=12,'hierarchical neighborhood registry exists');
ok(W.landmarks.length>=10,'10+ persistent landmark definitions');

const seenKinds=new Set(), seenDists=new Set(), seenProfiles=new Set();
let generated=0, badRoad=0, buildMs=[];
for(let bx=-14;bx<=14;bx+=1) for(let bz=-14;bz<=14;bz+=1){
  for(let li=0;li<4;li++){
    const sp=d.lotSpec(bx,bz,li); seenKinds.add(sp.kind); seenDists.add(sp.dist); seenProfiles.add(sp.profile.profile);
    if(sp.kind==='void') continue;
    if((bx+bz+li)%17===0){ const a=JSON.stringify(sp), b=JSON.stringify(d.lotSpec(bx,bz,li)); ok(a===b,'deterministic parcel sample '+bx+','+bz+','+li); }
    const t=Date.now(); const lot=d.generateLot(sp); buildMs.push(Date.now()-t); generated++;
    if(!lot) { fail.push('generateLot returned null for '+sp.kind); continue; }
    for(const c of lot.o.colliders){
      if(c.nb) continue;
      const pts=[[c.x0+.02,c.z0+.02],[c.x1-.02,c.z0+.02],[c.x0+.02,c.z1-.02],[c.x1-.02,c.z1-.02]];
      for(const [x,z] of pts) if(d.zoneType(x,z)==='asphalt') { badRoad++; break; }
    }
    if(d.lots.size>90){ for(const l of [...d.lots.values()].slice(0,30)) d.disposeLot(l); }
  }
}
const outer=d.lotSpec(20,20,0); seenDists.add(outer.dist); ok(seenDists.size>=6,'world sample crosses all six metropolitan districts');
ok(seenProfiles.size>=7,'world sample uses multiple neighborhood environment profiles');
ok(seenKinds.size>=10,'world sample uses 10+ building/lot archetypes');
ok(badRoad===0,'solid parcel colliders do not overlap driveable asphalt');

for(const lm of W.landmarks.filter(x=>x.bx!==undefined).slice(0,8)){
  const s=d.lotSpec(lm.bx,lm.bz,0); ok(s.kind==='landmark' && s.landmark.id===lm.id,'landmark anchor persists: '+lm.id);
  ok(d.lotSpec(lm.bx,lm.bz,1).kind==='void','landmark superblock reserves neighboring parcel: '+lm.id);
}

// Exercise streaming/location update directly without relying on the stale btn-start harness assumption.
const seq=[[0.5,0.5],[-160,-320],[160,-320],[-240,80],[240,0],[80,320],[-160,480]];
for(const [x,z] of seq){ d.player.pos.set(x,d.groundTopAt(x,z)+1,z); for(let i=0;i<12;i++) d.updateMetropolis(x,z,1/60); }
ok(g.errors.length===0,'no uncaught JS errors during world streaming/location updates');
ok(d.STAT.lotsBuilt>0 && d.SKY.mesh.count>0,'metropolis lot and skyline pipelines both execute');
ok(fail.length===0,'world overhaul test completed');
const avg=buildMs.reduce((a,b)=>a+b,0)/Math.max(1,buildMs.length);
console.log('summary kinds',JSON.stringify([...seenKinds].sort()));
console.log('summary districts',JSON.stringify([...seenDists].sort()));
console.log('generated',generated,'avg wall-clock lot build',avg.toFixed(2),'ms','errors',g.errors.length);
process.exit(fail.length?1:0);
