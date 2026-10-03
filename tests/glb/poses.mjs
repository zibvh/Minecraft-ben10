import {open} from './game.mjs';
import fs from 'fs';
const kinds=(process.argv[2]||'four_arms,heatblast,xlr8,echo_echo,cannonbolt').split(',');
const poseSel=process.argv[3]; 
const {b,p}=await open();
await p.click('#btn-start'); await p.waitForTimeout(2500);
for(const kind of kinds){
  const res=await p.evaluate(async (kind)=>{ const {PS,ALIENS,setForm,player,animateRig,renderer,scene,THREE}=window.__g;
    const out={};
    const def=ALIENS.find(a=>a.id===kind); setForm(def,kind);
    const model=player.model, parts=model.userData.parts;
    if(!parts.glb) return {err:'no glb attached'};
    // freeze the game loop's influence on this model: park it far from the player updates by overriding pos each shot
    const cam=new THREE.PerspectiveCamera(30,900/520,.1,200);
    const sc=PS*(def.modelScale||1); const H=parts.dims.total*sc;
    const shot=()=>{ model.scale.setScalar(sc); model.position.set(player.pos.x,player.pos.y-1+0.9*sc,player.pos.z); model.updateMatrixWorld(true); const c=model.position; model.rotation.y=Math.PI-.55;
      cam.position.set(c.x+0, c.y-0.9*sc+H*.55, c.z+H*2.3); cam.lookAt(c.x,c.y-0.9*sc+H*.5,c.z); cam.updateMatrixWorld(true);
      renderer.render(scene,cam); return renderer.domElement.toDataURL('image/jpeg',.85); };
    const run=(n,inp,mv)=>{ for(let i=0;i<n;i++){ const pos=inp.pos||{x:0,z:0}; if(mv){ inp.pos={x:(inp.pos?inp.pos.x:0)+0,z:(inp.pos?inp.pos.z:0)-mv/60}; } animateRig(parts,1/60,inp); } };
    const fwd={x:0,z:-1};
    const poses={
      idle:()=>{ const i={pos:{x:0,z:0},fwd,grounded:true}; run(60,i,0); },
      walk:()=>{ const i={pos:{x:0,z:0},fwd,grounded:true,moving:true}; run(46,i,3.6*.55*2); },
      run:()=>{ const i={pos:{x:0,z:0},fwd,grounded:true,moving:true}; run(52,i,9); },
      punchL:()=>{ const i={pos:{x:0,z:0},fwd,grounded:true}; run(20,i,0); i.atk={kind:'left',t:.42,id:kind,amp:1,tc:.4}; run(8,i,0); },
      heavy:()=>{ const i={pos:{x:0,z:0},fwd,grounded:true}; run(20,i,0); i.atk={kind:'heavy',t:.5,id:kind,amp:1,tc:.45}; run(8,i,0); },
      jump:()=>{ const i={pos:{x:0,z:0},fwd,grounded:false,vy:6}; run(30,i,0); },
      fly:()=>{ const i={pos:{x:0,z:0},fwd,grounded:false,flying:true,moving:true}; run(30,i,6); },
      hurt:()=>{ const i={pos:{x:0,z:0},fwd,grounded:true,hurt:1}; run(20,i,0); },
      dead:()=>{ const i={pos:{x:0,z:0},fwd,grounded:true,dead:1}; run(30,i,0); },
    };
    for(const k in poses){ // fresh animation state each pose
      parts.anim.px=null; parts.anim.spd=0; parts.anim.land=0;
      poses[k](); out[k]=shot(); }
    return out;
  }, kind);
  if(res.err){ console.log(kind,res.err); continue; }
  for(const k in res) fs.writeFileSync(`../poses/${kind}_${k}.jpg`,Buffer.from(res[k].split(',')[1],'base64'));
  console.log(kind,'ok',Object.keys(res).length);
}
await b.close();
