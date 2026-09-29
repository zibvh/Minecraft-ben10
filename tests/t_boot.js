const {boot}=require('./vmharness.js');
const g=boot(); console.log('load errors:',g.errors.length); g.errors.forEach(e=>console.log(e.split('\n').slice(0,4).join('\n')));
if(!g.d){ process.exit(1);} g.start(); g.step(120);
console.log('frames ok; errors:',g.errors.length); g.errors.slice(0,3).forEach(e=>console.log(e.split('\n').slice(0,5).join('\n')));
const d=g.d, THREE=g.win.THREE;
const h=o=>{ const b=new THREE.Box3().setFromObject(o); return +(b.max.y-b.min.y).toFixed(2); };
console.log('PS',d.PS,'Ben model height',h(d.player.model));
console.log('player pos',d.player.pos.toArray().map(v=>+v.toFixed(2)));
const en=d.enemies.filter(e=>!e.npc); console.log('hostile',en.length,'npc',d.enemies.filter(e=>e.npc).length);
for(const t of ['normal','brute','elite']){ const e=d.makeEnemy(t,5,5); console.log(t,'height',h(e.mesh)); d.enemies.pop(); g.win.__d.scene.remove(e.mesh);}
const n=d.enemies.find(e=>e.npc); console.log('npc height',h(n.mesh));
