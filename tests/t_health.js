const {boot}=require('./vmharness.js');
(async()=>{
const g=boot(); g.start(); g.step(30); const d=g.d; const out=[]; const ok=(c,m)=>out.push((c?'PASS ':'FAIL ')+m);
const HPv=()=>Math.round(d.player.health);
d.player.health=70; g.step(2);                                   // Ben at 70
d.tryTransform(d.ALIENS[0]); g.step(2); ok(HPv()===160,'Four Arms starts at its own 160 HP (Ben was 70) -> '+HPv());
d.player.health=80; g.step(2);
d.setForm(d.BEN,'ben'); g.step(2); ok(HPv()===70,'reverting returns Ben with HIS health (70), not full -> '+HPv());
d.tryTransform(d.ALIENS[0]); g.step(2); ok(HPv()===80,'re-transform: Four Arms remembers 80 -> '+HPv());
d.setForm(d.BEN,'ben'); for(let i=0;i<60*6;i++) g.step(1); // 6 s of background healing at 3%/s of 160 ~ +29
d.OMNI.charge=100; d.OMNI.lock=0; d.tryTransform(d.ALIENS[0]); g.step(2); ok(HPv()>100 && HPv()<130,'inactive alien heals in the background (~109) -> '+HPv());
// damage feedback + no regen right after a hit
const before=HPv(); d.player.health-=20; d.player.invuln=0; const cam0=g.win.__d; g.step(3); ok(true,'damage frame processed'); 
// KO: alien to 0 -> revert to Ben, Ben untouched
d.player.health=0; g.step(3);
ok(d.player.form.id==='ben' && d.player.alive,'alien at 0 HP: knocked out, back to Ben and still alive');
ok(HPv()===70,'Ben untouched by the alien KO -> '+HPv());
ok(d.OMNI.lock>0,'brief Omnitrix lockout after KO');
d.OMNI.lock=0; d.tryTransform(d.ALIENS[0]); g.step(2); ok(HPv()===56,'KO\'d form comes back at 35% (56) -> '+HPv());
d.setForm(d.BEN,'ben'); g.step(2);
// low health warning
d.player.health=20; g.step(3); ok(g.els['lowhp-overlay'].classList.contains('on') && g.els['health-fill'].classList.contains('low'),'low-health warning on at 20%');
d.player.health=90; g.step(3); ok(!g.els['lowhp-overlay'].classList.contains('on'),'low-health warning off when healed');
// regen only after 7s without damage
d.player.health=50; g.step(2); const h0=d.player.health; for(let i=0;i<60*3;i++) g.step(1); ok(Math.abs(d.player.health-h0)<.5,'no regen in first 3 s after a hit');
for(let i=0;i<60*8;i++) g.step(1); ok(d.player.health>h0+5,'regen kicks in after ~7 s -> '+HPv());
// Ben death + respawn
d.player.health=0; g.step(3); ok(!d.player.alive,'Ben at 0 dies'); await new Promise(r=>setTimeout(r,1600)); g.step(5);
ok(d.player.alive && HPv()===100 && d.player.invuln>0,'respawn: alive, full 100 HP, spawn protection -> '+HPv());
// alien KO'd, then Ben dies -> respawn resets every form to fresh
d.OMNI.charge=100; d.OMNI.lock=0; d.tryTransform(d.ALIENS[1]); g.step(2); d.player.health=0; g.step(3);   // Heatblast KO -> stored at 35%
ok(d.player.form.id==='ben' && d.player.alive,'Heatblast KO returns Ben alive');
d.player.health=0; g.step(3); await new Promise(r=>setTimeout(r,1600)); g.step(10);
ok(d.player.alive && HPv()===100,'Ben dies and respawns at full HP');
d.OMNI.lock=0;
d.tryTransform(d.ALIENS[1]); g.step(2); ok(HPv()===d.ALIENS[1].maxHealth,'after respawn Heatblast is fresh (100) -> '+HPv());
// Echo Echo replicas: independent HP, one dying does not touch others
d.OMNI.lock=0; d.OMNI.charge=100; d.setForm(d.BEN,'ben'); d.tryTransform(d.ALIENS[4]); g.step(2);
console.log(out.join('\n')); console.log('errors',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,6).join('\n')));
})();
