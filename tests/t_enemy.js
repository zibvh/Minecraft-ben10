const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(30); const d=g.d;
// clear existing hostile enemies, then surround the player with 6 melee grunts at 5 units
d.enemies.filter(e=>!e.npc).forEach(e=>{ e.alive=false; e.mesh.position.set(9999,0,9999); });
d.player.pos.set(40,d.groundTopAt(40,500)+1,500); d.player.health=9999; g.step(3);
const es=[]; for(let i=0;i<6;i++){ const a=i/6*6.283; es.push(d.makeEnemy('normal',40+Math.cos(a)*5,500+Math.sin(a)*5)); }
es.forEach(e=>{ e.state='chase'; e.alertedT=99; });
let maxAtk=0, hits=0, lastHp=d.player.health, closeMax=0, frames=0; const hitTimes=[];
for(let i=0;i<60*12;i++){ g.step(1); d.player.invuln=0;
  const holders=es.filter(e=>e.slotT>0&&!e.slotRanged).length; maxAtk=Math.max(maxAtk,holders);
  const close=es.filter(e=>e.mesh.position.distanceTo(d.player.pos)<2.4).length; closeMax=Math.max(closeMax,close);
  if(d.player.health<lastHp-0.001){ hits++; hitTimes.push((i/60).toFixed(1)); lastHp=d.player.health; } }
console.log('6 melee enemies around player, 12 s: max simultaneous attack-slot holders =',maxAtk,'(limit',d.ATK_SLOTS_MELEE+')');
console.log('max enemies within 2.4u at once =',closeMax,'| hits landed on player =',hits,'at t=',hitTimes.join(','));
// gang: provoke one member, see how the others join
const gang=d.GANGS[0]; d.player.pos.set(gang.home[0]+3,d.groundTopAt(gang.home[0],gang.home[1])+1,gang.home[1]); g.step(5);
const m0=gang.members[0]; d.provoke(m0); const delays=gang.members.map(m=>+(m.joinDelay||0).toFixed(1));
console.log('gang provoke: members',gang.members.length,'join delays (s):',delays.join(' '));
console.log('errors',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,5).join('\n')));
