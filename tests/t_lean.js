const {boot}=require('./vmharness.js');
const g=boot(); g.start(); g.step(30); const d=g.d;
d.player.pos.set(40,d.groundTopAt(40,500)+1,500); g.step(30);
const m=d.player.model; const rec=[]; 
d.moveInput.y=1; for(let i=0;i<40;i++){ g.step(1); if(i%5===0) rec.push((-m.rotation.x*57.3).toFixed(1)); }
console.log('start running: forward lean deg every 5 frames:',rec.join(' '));
d.moveInput.y=0; const r2=[]; for(let i=0;i<60;i++){ g.step(1); if(i%6===0) r2.push((-m.rotation.x*57.3).toFixed(1)); }
console.log('release stick: lean deg (momentum carries, then settles):',r2.join(' '));
console.log('errors',g.errors.length); g.errors.slice(0,2).forEach(e=>console.log(e.slice(0,300)));
