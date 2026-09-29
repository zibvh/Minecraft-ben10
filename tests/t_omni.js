const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(30); const d=g.d;
const out=[]; const ok=(c,m)=>{ out.push((c?'PASS ':'FAIL ')+m); };
// 1 transform with full charge
ok(d.tryTransform(d.ALIENS[0]) && d.player.form.id==='four_arms','transform to Four Arms with full charge');
g.step(40); ok(d.player.morphT>=0,'morph timer runs'); 
// 2 drain: Four Arms 85s -> after 40s ~ 53% left
for(let i=0;i<40;i++) d.updateOmnitrix(1);
ok(Math.abs(d.OMNI.charge-(100-40*100/85))<1,'drain rate ('+d.OMNI.charge.toFixed(1)+'% after 40s)');
// 3 warning at 10s left: charge = 10/85*100=11.8
for(let i=0;i<32;i++) d.updateOmnitrix(1); // 72s used, 13s left
ok(d.OMNI.warned===0,'no warning at 13s left');
for(let i=0;i<4;i++) d.updateOmnitrix(1); // 9s left
ok(d.OMNI.warned===1,'warning fires under 10s');
for(let i=0;i<6;i++) d.updateOmnitrix(1); // 3s left
ok(d.player.form.id==='four_arms','still alien with 3s left');
for(let i=0;i<4;i++) d.updateOmnitrix(1);
ok(d.player.form.id==='ben','timeout reverts to Ben');
ok(d.OMNI.lock>0,'lockout active after timeout');
ok(!d.tryTransform(d.ALIENS[1]) && d.player.form.id==='ben','cannot transform during lockout');
d.updateOmnitrix(3); ok(!d.tryTransform(d.ALIENS[1]),'cannot transform at 0% charge (needs '+d.OMNI_MIN+'%)');
// recharge: hold 1.5s then 20s for full
for(let i=0;i<30;i++) d.updateOmnitrix(.1); ok(d.OMNI.charge>0,'recharging as Ben ('+d.OMNI.charge.toFixed(1)+'%)');
for(let i=0;i<10;i++) d.updateOmnitrix(1);
ok(d.OMNI.charge>=25 && d.tryTransform(d.ALIENS[1]),'transform allowed again at >=25% ('+d.OMNI.charge.toFixed(0)+'%)');
// voluntary revert keeps charge
const c0=d.OMNI.charge; d.setForm(d.BEN,'ben'); ok(Math.abs(d.OMNI.charge-c0)<1e-6,'voluntary revert keeps charge');
// timer off
d.OMNI.enabled=false; d.OMNI.charge=30; d.tryTransform(d.ALIENS[2]); for(let i=0;i<200;i++) d.updateOmnitrix(1); ok(d.player.form.id==='xlr8','timer OFF: no drain/timeout');
d.OMNI.enabled=true; d.setForm(d.BEN,'ben');
// swipe cycle respects gate
d.OMNI.charge=10; d.cycleAlien(1); ok(d.player.form.id==='ben','swipe cycle blocked when low');
d.OMNI.charge=100; d.cycleAlien(1); ok(d.player.form.id!=='ben','swipe cycle works with charge');
// dial
d.toggleDial(); g.step(3); const dial=g.els['omni-dial']; ok(dial.children.length===7 && dial.classList.contains('show'),'dial opens with 7 entries (Ben + 6 aliens)');
g.step(300); ok(!dial.classList.contains('show'),'dial auto-closes');
d.toggleDial(); dial.children[0].fire('click'); ok(d.player.form.id==='ben' && !dial.classList.contains('show'),'tapping Ben in dial reverts and closes');
d.toggleDial(); dial.children[4].fire('click'); ok(d.player.form.id==='diamondhead','tapping an alien in dial transforms (Diamondhead)');
// death respawn refills
d.player.health=0; g.step(120); 
g.step(200);
console.log(out.join('\n')); console.log('errors',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,5).join('\n')));
