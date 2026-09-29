const {boot}=require('./harness');
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS':'FAIL')+': '+m); if(!c) fails++; };
(async()=>{
  const H=boot(); const {w,errors,sleep,frames}=H; await sleep(600); w.document.getElementById('btn-start').click(); await sleep(200); await frames(15);
  const d=w.__debug,p=d.player; const cv=[...w.document.querySelectorAll('canvas')].find(c=>c.parentElement===w.document.body);
  const mk=(el,type,x,y,id)=>{ const ev=new w.Event(type,{bubbles:true,cancelable:true}); const t={identifier:id,clientX:x,clientY:y,target:el}; ev.changedTouches=[t]; return ev; };
  const jz=w.document.getElementById('joystick-zone');
  // thumb 1 holds joystick forward
  jz.getBoundingClientRect=()=>({left:20,top:600,width:120,height:120});
  jz.dispatchEvent(mk(jz,'touchstart',80,660,1)); jz.dispatchEvent(mk(jz,'touchmove',80,620,1));
  // put enemy in view, tap it with thumb 2
  const f=d.flatFwd(p.yaw); const e=d.makeEnemy('normal',p.pos.x+f.x*6,p.pos.z+f.z*6); e.hp=e.maxHp=999; await frames(2);
  d.camera.updateMatrixWorld(); const v=e.mesh.position.clone(); v.y+=.1; v.project(d.camera);
  const sx=(v.x*.5+.5)*w.innerWidth, sy=(-v.y*.5+.5)*w.innerHeight;
  const z0=p.pos.z;
  cv.dispatchEvent(mk(cv,'touchstart',sx,sy,2)); cv.dispatchEvent(mk(cv,'touchend',sx,sy,2));
  ok(d.lockedTarget()===e,'tap with 2nd thumb locks while joystick is held');
  await frames(30);
  ok(Math.abs(p.pos.z-z0)>0.5 || Math.abs(p.pos.x)>0.5,'joystick movement continued during/after lock (moved '+Math.hypot(p.pos.x-0.5,p.pos.z-z0).toFixed(2)+')');
  jz.dispatchEvent(mk(jz,'touchend',80,620,1));
  // Free camera: swipe with a lock active must still move the yaw (assist yields), and must not unlock
  const yaw0=p.yaw; cv.dispatchEvent(mk(cv,'touchstart',300,300,3));
  for(let i=1;i<=10;i++) cv.dispatchEvent(mk(cv,'touchmove',300+i*15,300,3));
  cv.dispatchEvent(mk(cv,'touchend',450,300,3));
  ok(Math.abs(p.yaw-yaw0)>0.3,'free camera swipe works while locked (yaw moved '+(p.yaw-yaw0).toFixed(2)+')');
  ok(d.lockedTarget()===e,'a swipe does not drop the lock');
  // right after a swipe the assist must NOT immediately yank the camera back
  const yawAfter=p.yaw; await frames(8,17);
  ok(Math.abs(p.yaw-yawAfter)<0.08,'no instant snap-back right after swiping (drift '+Math.abs(p.yaw-yawAfter).toFixed(3)+')');
  // ...but eventually assist resumes
  await frames(60,17);
  const want=Math.atan2(-(e.mesh.position.x-p.pos.x),-(e.mesh.position.z-p.pos.z));
  ok(Math.abs(Math.atan2(Math.sin(want-p.yaw),Math.cos(want-p.yaw)))<0.4,'assist resumes turning toward target after the swipe settles');
  // target directly behind: no violent 180 snap in one frame
  d.unlockTarget(); p.yaw=0; const bh=d.makeEnemy('normal',p.pos.x,p.pos.z+8); d.setLock(bh);
  const y1=p.yaw; d.updateLockOn(0.017); const step=Math.abs(p.yaw-y1);
  ok(step<0.25,'target behind: single-frame turn is small ('+step.toFixed(3)+' rad), no violent snap');
  ok(errors.length===0,'no JS errors :: '+(errors[0]||'none'));
  console.log(fails?('\n'+fails+' FAILED'):'\nALL PASS'); process.exit(fails?1:0);
})();
