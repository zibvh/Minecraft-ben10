const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(40); const d=g.d; const out=[]; const ok=(c,m)=>out.push((c?'PASS ':'FAIL ')+m);
d.OMNI.charge=100; d.tryTransform(d.ALIENS[2]); g.step(10);
d.player.pos.set(40,d.groundTopAt(40,3000)+1,3000); g.step(20);
const scene=g.win.__d.scene; const trails=scene.children.filter(o=>o.isMesh&&o.material&&o.material.vertexColors&&o.material.blending===2);
ok(trails.length===3,'3 additive trail ribbons exist ('+trails.length+')');
ok(trails.every(t=>!t.visible),'trails hidden when not speeding');
d.player.yaw=0; d.moveInput.y=1; d.player.runLatch=true; const cam0=[]; 
for(let i=0;i<60*5;i++){ d.player.energy=100; d.OMNI.charge=100; g.step(1); if(i%60===59) cam0.push(+g.win.__d.camera.position.distanceTo(d.player.pos).toFixed(1)); }
ok(trails.every(t=>t.visible),'trails visible at speed');
const pos=trails[0].geometry.attributes.position.array; let len=0; for(let i=1;i<44;i++){ len+=Math.hypot(pos[i*6]-pos[(i-1)*6],pos[i*6+2]-pos[(i-1)*6+2]); }
ok(len>30,'trail is long at full speed ('+len.toFixed(0)+' u)');
ok(cam0[4]>cam0[0]*1.6,'camera pulls back as speed builds: '+cam0.join(' -> ')+' u');
const fov=g.win.__d.camera.fov; ok(fov>90,'FOV widened ('+fov.toFixed(0)+')');
ok(g.els['speed-fx']._o>.3,'edge speed-lines overlay active ('+g.els['speed-fx']._o+')');
d.moveInput.y=0; d.player.runLatch=false; for(let i=0;i<60*6;i++){ d.player.energy=100; g.step(1); }
ok(trails.every(t=>!t.visible),'trails clear after slowing');
const camNow=g.win.__d.camera.position.distanceTo(d.player.pos); ok(camNow<cam0[0]*1.3,'camera returns to normal distance ('+camNow.toFixed(1)+')');
// dash burst makes a short trail
d.player.energy=100; d.startDash(); g.step(4); ok(trails.some(t=>t.visible),'dash burst shows a trail');
// camera never inside a building: park the player beside a tower and look through it
d.player.pos.set(40,d.groundTopAt(40,0)+1,0); g.step(5);
console.log(out.join('\n')); console.log('errors',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,6).join('\n')));
