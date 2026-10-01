const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(30); const d=g.d;
let car=d.props.find(p=>p.veh&&!p.wreck); const m=car.mesh.position;
const reset=()=>{ m.x=40; m.z=500; car.yaw=0; car.v=0; car.push.set(0,0,0); car.by=d.groundTopAt(2,500); d.player.pos.set(40,car.by+1.6,500); };
d.player.pos.set(m.x+2.5,m.y+1,m.z); g.step(2); car.traffic=false; d.enterCar(car); reset(); g.step(2);
d.moveInput.y=1; for(let i=0;i<60*3.2;i++) g.step(1); const v0=Math.abs(car.v)*3.6;
d.moveInput.y=0; d.player.jumpHeld=true; const rec=[]; for(let i=0;i<60*2;i++){ g.step(1); if(i%15===14) rec.push((Math.abs(car.v)*3.6).toFixed(0)); }
console.log('handbrake from',v0.toFixed(0),'km/h, every .25s:',rec.join(' '));
d.player.jumpHeld=false; reset(); g.step(2); d.moveInput.y=1; for(let i=0;i<60*3.2;i++) g.step(1); d.moveInput.y=-1; const r2=[]; for(let i=0;i<60*2.5;i++){ g.step(1); if(i%15===14) r2.push((car.v*3.6).toFixed(0)); }
console.log('pull back (brake->reverse) every .25s:',r2.join(' '));
console.log('errors',g.errors.length);
