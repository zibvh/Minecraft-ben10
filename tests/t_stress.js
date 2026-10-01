// node --expose-gc t_stress.js [seconds-of-long-run]
const {boot}=require('./vmharness.js');
const hr=()=>Number(process.hrtime.bigint())/1e6;
const g=boot(); g.start(); g.step(60); const d=g.d, THREE=g.win.THREE;
const gc=global.gc||(()=>{});
d.OMNI.charge=100; d.OMNI.lock=0; d.tryTransform(d.ALIENS[2]); g.step(10);
const place=(x,z)=>{ d.player.pos.set(x,d.groundTopAt(x,z)+1,z); d.player.vel.set(0,0,0); d.player.onGround=true; d.moveInput.x=0; d.moveInput.y=0; g.step(30); };
const pct=(a,p)=>{ const b=[...a].sort((x,y)=>x-y); return b[Math.min(b.length-1,Math.floor(b.length*p))]; };
function run(name,secs,drive){
  const fr=[], spd=[]; const s0={b:d.STAT.lotsBuilt,dr:d.STAT.lotsDropped,ch:d.STAT.chunksBuilt,ur:d.STAT.urgent}; gc(); const m0=process.memoryUsage().heapUsed/1048576;
  const start=d.player.pos.clone(); let path=0, last=d.player.pos.clone(), inside=0, gaps=0, maxLots=0, maxChunks=0, maxQ=0, maxSky=0, nodes0=g.win.__d.scene.children.length, maxNodes=0;
  const N=Math.round(secs*60); let f=0;
  for(let i=0;i<N;i++){
    d.player.energy=100; d.OMNI.charge=100; drive(i/60);
    const t0=hr(); g.step(1); const ms=hr()-t0; fr.push(ms); if(ms>30){ const S=d.STAT; spikesLog.push(name.slice(0,8)+' '+ms.toFixed(0)+'ms chunk '+S.tChunk.toFixed(1)+' plan '+S.tPlan.toFixed(1)+' lot '+S.tLot.toFixed(1)+' sky '+S.tSky.toFixed(1)+' ground '+S.tGround.toFixed(1)); }
    const sp=Math.hypot(d.velVec()[0],d.velVec()[1]); spd.push(sp); { const dd=d.player.pos.distanceTo(last); if(dd<30) path+=dd; last.copy(d.player.pos); }
    maxLots=Math.max(maxLots,d.lots.size); maxChunks=Math.max(maxChunks,d.chunks.size); maxQ=Math.max(maxQ,d.STAT.queue); maxSky=Math.max(maxSky,d.SKY.mesh.count); maxNodes=Math.max(maxNodes,g.win.__d.scene.children.length);
    // coverage: every lot centre within 45u of the player must exist (collision can never be outrun)
    const px=d.player.pos.x, pz=d.player.pos.z, bx=Math.round(px/80), bz=Math.round(pz/80);
    if(i%3===0) for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) for(let li=0;li<4;li++){ const sp2=d.lotSpec(bx+a,bz+b,li); if(Math.hypot(sp2.cx-px,sp2.cz-pz)<45 && !d.lots.has(bx+a+','+(bz+b)+','+li)) gaps++; }
    // tunnelling: player centre inside a solid collider volume?
    if(i%2===0){ const arr=[]; const cl=(x,z)=>{ const k=Math.floor(x/24)+','+Math.floor(z/24); }; 
      for(const l of d.lots.values()){ if(Math.abs(l.spec.cx-px)>40||Math.abs(l.spec.cz-pz)>40) continue; for(const c of l.o.colliders){ if(c.nb) continue; if(px>c.x0+.3&&px<c.x1-.3&&pz>c.z0+.3&&pz<c.z1-.3&&d.player.pos.y-1<c.top-.8&&(c.bot===undefined||d.player.pos.y+1>c.bot)) inside++; } } }
  }
  gc(); const m1=process.memoryUsage().heapUsed/1048576; const dist=path;
  const mean=fr.reduce((a,b)=>a+b,0)/fr.length, spikes=fr.filter(v=>v>33).length;
  console.log(name.padEnd(34),'dist',dist.toFixed(0).padStart(5),'u  vmax',Math.max(...spd).toFixed(0).padStart(3),'u/s | frame ms mean',mean.toFixed(2),'p95',pct(fr,.95).toFixed(1),'p99',pct(fr,.99).toFixed(1),'max',Math.max(...fr).toFixed(1),'| >33ms:',spikes,
    '| lots+',d.STAT.lotsBuilt-s0.b,'-',d.STAT.lotsDropped-s0.dr,' chunks+',d.STAT.chunksBuilt-s0.ch,' urgent',d.STAT.urgent-s0.ur,'| peak lots',maxLots,'chunks',maxChunks,'queue',maxQ,'sky',maxSky,'nodes',maxNodes,'| heap',m0.toFixed(0),'->',m1.toFixed(0),'MB | coverage gaps',gaps,'tunnel',inside);
  return {mean,max:Math.max(...fr),spikes,gaps,inside,m0,m1,dist,vmax:Math.max(...spd),p99:pct(fr,.99)};
}
const R={}; var spikesLog=[];
const heading=(yawDeg)=>{ d.player.yaw=yawDeg*Math.PI/180; };
// 1 walking, 2 normal running (Ben)
d.setForm(d.BEN,'ben'); place(40,-1000); R.walk=run('1 Ben walking 20s',20,t=>{ heading(0); d.moveInput.y=1; d.moveInput.x=0; d.player.runLatch=false; });
R.run=run('2 Ben running 20s',20,t=>{ heading(0); d.moveInput.y=1; d.player.runLatch=true; });
d.player.runLatch=false;
// 3 XLR8 sustained, 4 maximum, 5 crossing many sectors along a boulevard
d.OMNI.charge=100; d.tryTransform(d.ALIENS[2]); g.step(5);
place(40,-200); R.sus=run('3 XLR8 sustained super speed 15s',15,t=>{ heading(0); d.moveInput.y=1; d.moveInput.x=0; d.player.runLatch=true; });
place(40,4800); R.cross=run('4/5 XLR8 max speed across sectors 50s',50,t=>{ heading(0); d.moveInput.y=1; d.moveInput.x=0; d.player.runLatch=true; });
// 6 rapid 90 degree turns (steer through the city grid)
place(-40,-600); R.turn=run('6 XLR8 rapid 90deg turns 30s',30,t=>{ heading((Math.floor(t/1.2)%4)*90); d.moveInput.y=1; d.moveInput.x=0; d.player.runLatch=true; });
// 7 rapid reversal
place(40,-600); R.rev=run('7 XLR8 rapid reversals 30s',30,t=>{ heading(0); d.moveInput.y=(Math.floor(t/1.5)%2)?-1:1; d.moveInput.x=0; d.player.runLatch=true; });
// 8 dense downtown (straight through blocks: collision bites), 9 NPC heavy
d.enemies.length; for(let i=0;i<20;i++){ const sp=d.lotSpec(0,0,0); }
place(0.5,0.5); R.down=run('8 XLR8 through dense downtown 30s',30,t=>{ heading(45+Math.sin(t*.5)*30); d.moveInput.y=1; d.moveInput.x=0; d.player.runLatch=true; });
place(-35,35); R.npc=run('9 XLR8 through NPC/gang area 20s',20,t=>{ heading(90+Math.sin(t)*40); d.moveInput.y=1; d.player.runLatch=true; });
// 10 long continuous traversal (several minutes)
const LONG=+process.argv[2]||180; place(-5080,5200); R.long=run('10 long continuous traversal '+LONG+'s',LONG,t=>{ heading(Math.floor(t/45)%2?180:0); d.moveInput.y=1; d.moveInput.x=0; d.player.runLatch=true; });
console.log('--- frames >30ms (section breakdown) ---'); spikesLog.slice(0,14).forEach(l=>console.log(l)); console.log('total spike frames',spikesLog.length);
console.log('JS errors:',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,6).join('\n')));
