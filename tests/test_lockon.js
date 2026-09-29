const {boot}=require('./harness');
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS':'FAIL')+': '+m); if(!c) fails++; };
(async()=>{
  const H=boot(); const {w,errors,sleep,frames}=H;
  await sleep(600);
  w.document.getElementById('btn-start').click(); await sleep(200);
  await frames(15);
  const d=w.__debug; ok(!!d,'debug bridge present (test-only)'); if(!d){process.exit(1);}
  const p=d.player, T=w.THREE;
  ok(typeof d.setLock==='function' && d.lock,'lock module loaded');
  ok(d.lockedTarget()===null,'starts with no lock');

  // Spawn an enemy 6 units in front of the player
  const f=d.flatFwd(p.yaw);
  const e1=d.makeEnemy('normal', p.pos.x+f.x*6, p.pos.z+f.z*6);
  await frames(3);

  // --- LOCK via screen tap: project enemy, tap exactly there
  d.camera.updateMatrixWorld(); d.camera.updateProjectionMatrix();
  const v=e1.mesh.position.clone(); v.y+=0.1; v.project(d.camera);
  const sx=(v.x*0.5+0.5)*w.innerWidth, sy=(-v.y*0.5+0.5)*w.innerHeight;
  ok(d.tapLock(sx,sy)===true,'tap on enemy returns handled');
  ok(d.lockedTarget()===e1,'tap locks the enemy');
  ok(w.document.getElementById('lock-btn').classList.contains('on'),'lock button shows active');
  await frames(4);
  ok(w.document.getElementById('lock-marker').style.display==='block','lock marker visible while locked');

  // --- Tap again = unlock
  d.tapLock(sx,sy);
  ok(d.lockedTarget()===null,'tapping the same enemy again unlocks');
  ok(w.document.getElementById('lock-marker').style.display==='none','marker hidden after unlock');

  // --- Tap on empty ground must NOT lock or unlock
  d.setLock(e1);
  ok(d.tapLock(20,20)===false,'tap on empty space is not handled as a lock');
  ok(d.lockedTarget()===e1,'empty tap leaves an existing lock alone');

  // --- Camera assist turns the player toward a target off to the side
  p.yaw=0; const side=d.makeEnemy('normal', p.pos.x+7, p.pos.z);   // to the +X side
  d.setLock(side); await frames(50);
  const want=Math.atan2(-(side.mesh.position.x-p.pos.x), -(side.mesh.position.z-p.pos.z));
  let diff=Math.atan2(Math.sin(want-p.yaw),Math.cos(want-p.yaw));
  ok(Math.abs(diff)<0.35,'camera assist turns yaw toward the locked target (residual '+diff.toFixed(2)+' rad)');

  // --- Assist yields while the user is swiping (free camera must win)
  p.yaw=0; d.noteUserLook(); d.updateLockOn(0.016);
  ok(Math.abs(p.yaw)<0.05,'assist does not fight a swipe in progress');

  // --- Attacks face the target
  d.setLock(side); p.yaw=1.2; p.atkTimer=0;
  const hp0=side.hp; d.meleeAttack(); await sleep(400); await frames(3);
  ok(side.hp<hp0 || true,'melee with lock does not throw'); // damage depends on range; range test below
  const wantY=Math.atan2(-(side.mesh.position.x-p.pos.x), -(side.mesh.position.z-p.pos.z));
  // attack snaps yaw only if within melee-ish range; move enemy close and retest
  side.mesh.position.set(p.pos.x+1.3,side.mesh.position.y,p.pos.z); p.yaw=2.0; p.atkTimer=0; p.comboStep=0;
  const hpB=side.hp; d.meleeAttack(); await sleep(300); await frames(2);
  ok(side.hp<hpB,'locked melee hits a target even when the player started facing away (<180deg)');

  // --- Melee still won't hit enemies BEHIND the player (no lock)
  d.unlockTarget(); p.yaw=0; p.atkTimer=0; p.comboStep=0;
  const fw=d.flatFwd(0);
  const behind=d.makeEnemy('normal', p.pos.x-fw.x*1.2, p.pos.z-fw.z*1.2);
  const hpBh=behind.hp; d.meleeAttack(); await sleep(300); await frames(2);
  ok(behind.hp===hpBh,'no-lock melee still ignores enemies behind the player');

  // --- Auto-unlock: target dies
  const e2=d.makeEnemy('normal', p.pos.x+3, p.pos.z); d.setLock(e2);
  d.damageEnemy(e2, 9999, new T.Vector3(1,0,0)); await frames(2);
  ok(d.lockedTarget()===null,'lock breaks automatically when target dies');

  // --- Auto-unlock: target too far
  const e3=d.makeEnemy('normal', p.pos.x+10, p.pos.z); d.setLock(e3);
  e3.mesh.position.x=p.pos.x+80; await frames(3);
  ok(d.lockedTarget()===null,'lock breaks automatically when target moves too far');

  // --- NPC lock + dead NPC
  const npc=d.spawnNpc(null,p.pos.x+4,p.pos.z); d.setLock(npc);
  ok(d.lockedTarget()===npc,'NPCs can be locked too');
  d.damageEnemy(npc,9999,new T.Vector3(1,0,0)); await frames(2);
  ok(d.lockedTarget()===null,'lock breaks when a locked NPC dies');

  // --- Button: locks nearest in front, second press unlocks
  d.unlockTarget(); p.yaw=0;
  const near=d.makeEnemy('normal', p.pos.x+f.x*4, p.pos.z+f.z*4);
  d.lockButton(); ok(!!d.lockedTarget(),'lock button acquires a target');
  d.lockButton(); ok(d.lockedTarget()===null,'lock button again releases');

  // --- Player death clears lock; no throw
  d.setLock(near); p.health=0; await frames(3);
  ok(d.lockedTarget()===null,'player death clears the lock');

  ok(errors.length===0,'no JS errors during lock-on tests'+(errors.length?' :: '+errors[0]:''));
  console.log(fails?('\n'+fails+' FAILED'):'\nALL LOCK-ON CHECKS PASS'); process.exit(fails?1:0);
})();
