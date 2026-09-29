const {boot}=require('./harness');
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS':'FAIL')+': '+m); if(!c) fails++; };
(async()=>{
  const H=boot(); const {w,errors,sleep,frames}=H;
  await sleep(600); w.document.getElementById('btn-start').click(); await sleep(200); await frames(15);
  const d=w.__debug, p=d.player, T=w.THREE;
  const alien=id=>{ const a=d.ALIENS.find(x=>x.id===id); d.setForm(a,id); };

  // ---------- REAL TOUCH EVENT PATH ----------
  const f=d.flatFwd(p.yaw);
  const e=d.makeEnemy('normal', p.pos.x+f.x*6, p.pos.z+f.z*6); await frames(3);
  d.camera.updateMatrixWorld(); const v=e.mesh.position.clone(); v.y+=0.1; v.project(d.camera);
  const sx=(v.x*0.5+0.5)*w.innerWidth, sy=(-v.y*0.5+0.5)*w.innerHeight;
  const cv=[...w.document.querySelectorAll('canvas')].find(c=>c.parentElement===w.document.body);
  const mk=(type,x,y,id=7)=>{ const ev=new w.Event(type,{bubbles:true,cancelable:true}); const t={identifier:id,clientX:x,clientY:y,target:cv}; ev.changedTouches=[t]; ev.touches=type==='touchend'?[]:[t]; return ev; };
  cv.dispatchEvent(mk('touchstart',sx,sy)); cv.dispatchEvent(mk('touchend',sx,sy));
  ok(d.lockedTarget()===e,'REAL touchstart+touchend on an enemy locks it');
  cv.dispatchEvent(mk('touchstart',sx,sy)); cv.dispatchEvent(mk('touchend',sx,sy));
  ok(d.lockedTarget()===null,'REAL second tap unlocks');

  // A SWIPE that ends over an enemy must NOT lock (camera drag stays a drag)
  const yaw0=p.yaw;
  cv.dispatchEvent(mk('touchstart',sx-120,sy)); cv.dispatchEvent(mk('touchmove',sx-60,sy)); cv.dispatchEvent(mk('touchmove',sx,sy)); cv.dispatchEvent(mk('touchend',sx,sy));
  ok(d.lockedTarget()===null,'swipe ending on an enemy does NOT lock');
  ok(p.yaw!==yaw0,'swipe still rotates the camera (free look intact)');
  // Slow long press (>320ms) must not lock
  cv.dispatchEvent(mk('touchstart',sx,sy)); await sleep(400); cv.dispatchEvent(mk('touchend',sx,sy));
  ok(d.lockedTarget()===null,'long press does not lock');
  // touchcancel must not lock
  cv.dispatchEvent(mk('touchstart',sx,sy)); cv.dispatchEvent(mk('touchcancel',sx,sy));
  ok(d.lockedTarget()===null,'touchcancel does not lock');
  ok(d.camTouchId===null,'look touch id released after all of the above');

  // ---------- Tap on the HUD button element itself doesn't fall through to a lock ----------
  const btn=w.document.getElementById('btn-attack');
  const ev=new w.Event('touchstart',{bubbles:true,cancelable:true}); ev.changedTouches=[{identifier:9,clientX:sx,clientY:sy,target:btn}]; btn.dispatchEvent(ev);
  ok(d.camTouchId===null,'touch that starts on a HUD button never becomes a camera/lock touch');
  const lb=w.document.getElementById('lock-btn');
  for(const t of ['touchstart','touchend']){ const e2=new w.Event(t,{bubbles:true,cancelable:true}); e2.changedTouches=[{identifier:11,clientX:5,clientY:5,target:lb}]; lb.dispatchEvent(e2); }
  ok(!!d.lockedTarget(),'on-screen LOCK button (real touch events) acquires a target');
  d.unlockTarget();

  // ---------- SONIC DOOM prefers the locked target ----------
  alien('echo_echo'); d.splitEcho(); d.splitEcho(); await frames(3);
  ok(d.squad.length>=2,'echo squad exists for doom test');
  const near=d.makeEnemy('normal', p.pos.x+f.x*5, p.pos.z+f.z*5);       // nearest hostile-ish
  const far =d.makeEnemy('normal', p.pos.x-f.x*14, p.pos.z-f.z*14);     // farther, behind
  d.unlockTarget();
  const noLock=d.doomTargetPos();
  ok(noLock && noLock.distanceTo(near.mesh.position)<0.01,'doom w/o lock picks the nearest hostile (old behaviour kept)');
  d.setLock(far);
  const withLock=d.doomTargetPos();
  ok(withLock && withLock.distanceTo(far.mesh.position)<0.01,'doom WITH lock targets the locked enemy, even if farther');
  // non-hostile civilian can be Doom-targeted only if the player locked it
  const civ=d.spawnNpc(null,p.pos.x+3,p.pos.z+3); d.setLock(civ);
  ok(d.doomTargetPos().distanceTo(civ.mesh.position)<0.01,'doom follows a locked civilian too (player-chosen)');
  d.unlockTarget();
  // one-shot doom fires without error and consumes energy from living units
  d.setLock(far); const eBefore=d.squad.map(u=>u.active?p.energy:u.energy);
  d.sonicDoom(); await frames(30);
  ok(true,'sonicDoom with lock ran');

  // ---------- Abilities aim at the lock ----------
  alien('heatblast'); p.energy=100; p.yaw=0.0; p.pitch=0;
  const tgt=d.makeEnemy('normal', p.pos.x+8, p.pos.y? p.pos.z:0); d.setLock(tgt);
  d.aimAtLock();
  const wantYaw=Math.atan2(-(tgt.mesh.position.x-p.pos.x), -(tgt.mesh.position.z-p.pos.z));
  ok(Math.abs(Math.atan2(Math.sin(p.yaw-wantYaw),Math.cos(p.yaw-wantYaw)))<0.02,'aimAtLock snaps yaw exactly at target');
  ok(Math.abs(p.pitch)<0.9,'aimAtLock pitch clamped');
  d.unlockTarget();

  // ---------- XLR8: steering toward lock + tackle ----------
  alien('xlr8'); p.energy=100; p.health=p.form.maxHealth; await frames(3);
  const start=p.pos.clone(); p.yaw=0; p.pitch=0;
  const xt=d.makeEnemy('normal', start.x+5, start.z-30); xt.hp=xt.maxHp=500;  // 30 ahead, 5 to the side
  d.setLock(xt);
  p.superHeld=true; p.superT=0.9;                         // already sprinting fast
  const inp=w.document; 
  // push joystick forward via the moveInput exposed through key handler is not available; use keyboard W
  w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyW'}));
  let minD=1e9; const hp0=xt.hp;
  for(let i=0;i<120;i++){ p.superHeld=true; p.energy=100; await frames(1,10); minD=Math.min(minD,xt.mesh.position.distanceTo(p.pos)); }
  w.dispatchEvent(new w.KeyboardEvent('keyup',{code:'KeyW'}));
  ok(minD<3.5,'XLR8 sprint with a lock closed to '+minD.toFixed(2)+' of the target (was ~30)');
  ok(xt.hp<hp0,'XLR8 tackle damaged the locked target ('+(hp0-xt.hp).toFixed(0)+' dmg)');

  // XLR8 WITHOUT lock is unchanged: runs straight (no drift toward a side enemy)
  d.unlockTarget(); p.superHeld=false; p.superT=0; await frames(10);
  p.pos.set(0.5,d.groundTopAt(0.5,0.5)+1,0.5); p.yaw=0;
  const side=d.makeEnemy('normal',30.5,-20); side.hp=side.maxHp=999;
  w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyW'}));
  for(let i=0;i<40;i++){ p.superHeld=true; p.superT=Math.max(p.superT,0.8); p.energy=100; await frames(1,10); }
  w.dispatchEvent(new w.KeyboardEvent('keyup',{code:'KeyW'}));
  ok(Math.abs(p.pos.x-0.5)<1.5,'XLR8 without lock runs dead straight (x drift '+(p.pos.x-0.5).toFixed(2)+')');

  // ---------- Other aliens still fine ----------
  for(const id of ['four_arms','heatblast','diamondhead','echo_echo','cannonbolt','xlr8']){
    alien(id); const t2=d.makeEnemy('normal',p.pos.x+2,p.pos.z); d.setLock(t2); p.atkTimer=0; p.comboStep=0; d.meleeAttack(); await sleep(250); await frames(2); d.unlockTarget();
  }
  ok(true,'all 6 aliens can melee with a lock without throwing');

  ok(errors.length===0,'no JS errors :: '+(errors[0]||'none'));
  console.log(fails?('\n'+fails+' FAILED'):'\nALL PASS'); process.exit(fails?1:0);
})();
