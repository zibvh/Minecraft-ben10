const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(30); const d=g.d;
let car=d.props.find(p=>p.veh&&!p.wreck);
if(!car){ for(let i=0;i<10&&!car;i++){ d.spawnTraffic(); car=d.props.find(p=>p.veh); } }
console.log('car found',!!car, 'parked cars:',d.props.filter(p=>p.veh).length);
const m=car.mesh.position; d.player.pos.set(m.x+2.5,m.y+1,m.z); g.step(2);
car.traffic=false; car.v=0; d.enterCar(car); console.log('driving?',!!d.player.driving);
const kmh=()=>Math.abs(car.v)*3.6;
// wide-open test: put the car in the sky-free flat spot: ignore walls by teleporting each frame far from buildings? just measure until blocked
function run(label,secs,inp,brake){ d.moveInput.x=inp.x||0; d.moveInput.y=inp.y||0; d.player.jumpHeld=!!brake; const rec=[]; for(let i=0;i<secs*60;i++){ g.step(1); if(i%30===29) rec.push(kmh().toFixed(0)); } console.log(label,'km/h every .5s:',rec.join(' ')); }
// clear obstacles by giving car space: move to an open road tile far from colliders if blocked; simplest: teleport periodically
const reset=()=>{ car.mesh.position.x=2; car.mesh.position.z=55; car.yaw=0; car.v=0; car.push.set(0,0,0); car.by=d.groundTopAt(2,55); d.player.pos.set(2,car.by+1.6,55); };reset();g.step(3);
const keepClear=()=>{}; 
run('full throttle 6s',6,{y:1}); console.log('   distance',(55-m.z).toFixed(0),'units');
const topSpeed=kmh(); 
reset();g.step(2);run('accel 4s',4,{y:1});run('release throttle (coast) 6s',6,{y:0});
reset();g.step(2);run('throttle 4s then brake',4,{y:1}); run('  ...brake 2.5s',2.5,{y:0},true); d.player.jumpHeld=false;
// steering: at speed, hard turn; measure yaw change and push (drift)
reset();g.step(2);run('accel 3s',3,{y:1});
const yaw0=car.yaw; let maxPush=0, maxPitch=0, maxLean=0; d.moveInput.x=1; for(let i=0;i<60;i++){ g.step(1); maxPush=Math.max(maxPush,Math.hypot(car.push.x,car.push.z)); maxPitch=Math.max(maxPitch,Math.abs(car.pitch)); maxLean=Math.max(maxLean,Math.abs(car.lean)); }
console.log('1s hard right at',kmh().toFixed(0),'km/h: yaw turned',(Math.abs(car.yaw-yaw0)*57.3).toFixed(0),'deg, max lateral slide',maxPush.toFixed(1),'u/s, max body lean',(maxLean*57.3).toFixed(1),'deg, pitch',(maxPitch*57.3).toFixed(1),'deg');
console.log('HP',car.hp);
console.log('errors',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,5).join('\n')));
