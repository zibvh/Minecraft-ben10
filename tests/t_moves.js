const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(30); const d=g.d; const out=[]; const ok=(c,m)=>out.push((c?'PASS ':'FAIL ')+m);
const place=()=>{ d.player.pos.set(2,d.groundTopAt(2,55)+1,55); d.player.vel.set(0,0,0); d.player.onGround=true; d.moveInput.x=0; d.moveInput.y=0; g.step(6); };
// ---------- Four Arms ----------
d.OMNI.charge=100; d.tryTransform(d.ALIENS[0]); g.step(20); place();
const y0=d.player.pos.y; let apex=0;
d.jumpPress(); for(let i=0;i<4;i++) g.step(1); d.jumpRelease(); for(let i=0;i<90;i++){ g.step(1); apex=Math.max(apex,d.player.pos.y-y0); }
ok(apex>3.5&&apex<6,'tap = strong hop, apex '+apex.toFixed(1)+' units (was ~3)');
place(); const yA=d.player.pos.y; let apex2=0, minC=1; d.jumpPress(); for(let i=0;i<20;i++) g.step(1); const c1=d.player.leapC; ok(c1>0&&c1<.7&&d.player.leapCharging,'holding builds charge (0.33s -> '+c1.toFixed(2)+')');
for(let i=0;i<60;i++) g.step(1); ok(d.player.leapC>=.99,'full charge after ~1.4s');
const px=d.player.pos.x, pz=d.player.pos.z; d.moveInput.y=1; d.jumpRelease(); let dist=0; for(let i=0;i<60*6;i++){ g.step(1); apex2=Math.max(apex2,d.player.pos.y-yA); if(d.player.onGround&&i>10) break; dist=Math.hypot(d.player.pos.x-px,d.player.pos.z-pz); }
ok(apex2>28,'FULL LEAP apex '+apex2.toFixed(1)+' units - towers are ~25 (clears them)');
ok(dist>45,'FULL LEAP carries forward '+dist.toFixed(0)+' units');
g.step(3); ok(!d.player.leapActive,'leap state cleared after landing');
// landing slam damages nearby enemy
d.enemies.filter(e=>!e.npc).forEach(e=>{ e.alive=false; e.mesh.position.set(9999,0,9999); });
place(); const foe=d.makeEnemy('normal',d.player.pos.x+2.5,d.player.pos.z); const hp0=foe.hp; d.jumpPress(); for(let i=0;i<80;i++) g.step(1); d.jumpRelease(); for(let i=0;i<60*5;i++){ g.step(1); d.player.pos.x+=(2-d.player.pos.x)*0.05; d.player.pos.z+=(55-d.player.pos.z)*0.05; if(d.player.onGround&&i>20) break; }
g.step(5); ok(!foe.alive||foe.hp<hp0,'landing shockwave hurts nearby enemies (hp '+hp0+' -> '+(foe.alive?Math.round(foe.hp):'dead')+')');
// ---------- XLR8 run vs dash ----------
d.setForm(d.BEN,'ben'); d.OMNI.charge=100; d.OMNI.lock=0; d.tryTransform(d.ALIENS[2]); g.step(20); place();
const sp=(n)=>{ const a=d.player.pos.clone(); for(let i=0;i<n;i++) g.step(1); return d.player.pos.distanceTo(a)/(n/60); };
d.moveInput.y=1; const walk=sp(30); ok(walk>6&&walk<9,'XLR8 base speed '+walk.toFixed(1));
// DASH = burst
place(); d.moveInput.y=1; g.step(5); const peak=[]; d.startDash(); for(let i=0;i<30;i++){ const a=d.player.pos.clone(); g.step(1); peak.push(d.player.pos.distanceTo(a)*60); }
const pk=Math.max(...peak), after=peak[peak.length-1];
ok(pk>walk*3 && after<walk*1.3,'dash is a burst: peak '+pk.toFixed(0)+' u/s then back to '+after.toFixed(1));
ok(d.player.superSpeed<.05,'dash alone does not build sustained super speed');
// RUN (joystick drag) = sustained, progressive
place(); const jz=g.els['joystick-zone'], rb=g.els['btn-run']; jz.rect={left:20,top:240,width:120,height:120}; rb.rect={left:58,top:150,width:54,height:54};
jz.fire('touchstart',{changedTouches:[{identifier:1,clientX:80,clientY:300}]});
jz.fire('touchmove',{changedTouches:[{identifier:1,clientX:80,clientY:262}]}); ok(!d.player.runLatch,'pushing the stick normally does not lock run');
jz.fire('touchmove',{changedTouches:[{identifier:1,clientX:84,clientY:178}]}); ok(d.player.runLatch && jz.classList.contains('run'),'dragging the stick up onto the RUN marker locks run');
const ramp=[]; for(let s_=0;s_<6;s_++){ for(let i=0;i<40;i++){ g.step(1); d.player.pos.x=2; d.player.pos.z=Math.max(-900,d.player.pos.z); if(d.player.pos.z<-200) d.player.pos.z=55; } ramp.push(+d.player.superSpeed.toFixed(2)); }
ok(ramp[5]>.25 && ramp.every((v,i)=>i===0||v>=ramp[i-1]),'run builds super speed progressively (superSpeed '+ramp.join(' -> ')+')');
jz.fire('touchmove',{changedTouches:[{identifier:1,clientX:80,clientY:296}]}); ok(!d.player.runLatch,'easing the stick back below 35% releases run');
const ss=d.player.superSpeed; g.step(90); ok(d.player.superSpeed<ss*.7,'releasing decelerates gradually');
jz.fire('touchend',{changedTouches:[{identifier:1,clientX:80,clientY:300}]}); 
// Ben run
d.setForm(d.BEN,'ben'); place(); d.moveInput.y=1; d.player.runLatch=false; const walkSp=()=>{ d.player.pos.set(2,d.groundTopAt(2,55)+1,55); g.step(15); return sp(20); };
const bw=walkSp(); d.player.runLatch=true; const br=walkSp(); d.player.runLatch=false; ok(br/bw>1.35,'Ben: run ~1.5x walk ('+bw.toFixed(1)+' -> '+br.toFixed(1)+' u/s)');
console.log(out.join('\n')); console.log('errors',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,6).join('\n')));
