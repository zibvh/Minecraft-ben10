// Software rasteriser for the game's real model geometry (z-buffer, lambert + emissive), so the aliens can be inspected without a GPU.
const {boot}=require('./vmharness.js'); const zlib=require('zlib'), fs=require('fs'), vm=require('vm');
const g=boot(); g.start(); g.step(5);
const kinds=process.argv[2]?process.argv[2].split(','):['ben','four_arms','heatblast','xlr8','diamondhead','echo_echo','cannonbolt'];
const view=process.argv[3]||'front'; const PORTRAIT=view==='portrait';   // front | side | back
const W=view_is_portrait()?256:340,H=view_is_portrait()?256:440,SS=2; function view_is_portrait(){ return (process.argv[3]||"")==="portrait"; }
const pfr={}; function grab(kind,ph){ return vm.runInContext(`(function(kind,PORTRAIT){ const m=__d.buildCharacter(kind); const p=m.userData.parts; if(PORTRAIT){ m.rotation.y=Math.PI-0.5; m.position.y=-0.1; } ${ph?'':''} m.updateMatrixWorld(true); const out=[]; const V=new THREE.Vector3();
  m.traverse(o=>{ if(!o.isMesh) return; const ge=o.geometry, pos=ge.attributes.position, idx=ge.index; const c=o.material.color, e=o.material.emissive, ei=o.material.emissiveIntensity==null?1:o.material.emissiveIntensity;
    const w=[]; for(let i=0;i<pos.count;i++){ V.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld); w.push(V.x,V.y,V.z); }
    const n=idx?idx.count:pos.count; for(let i=0;i<n;i+=3){ const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,d=idx?idx.getX(i+2):i+2; out.push([w[a*3],w[a*3+1],w[a*3+2],w[b*3],w[b*3+1],w[b*3+2],w[d*3],w[d*3+1],w[d*3+2],c.r,c.g,c.b,e.r*ei,e.g*ei,e.b*ei]); } });
  return {tris:out,total:p.dims.total,pf:PORTRAIT?__d.portraitFraming(m,kind):null}; })(${JSON.stringify(kind)},${PORTRAIT})`,g.ctx);}
function render(kind,x0,img){ const {tris,total,pf}=grab(kind); pfr[kind]=pf; let cy=total*0.5-0.9, dist=total*1.75+1.2;
  const ang=view==='front'?0.6:view==='side'?1.57:3.6; const cam=[Math.sin(ang)*dist,cy+total*.12,-Math.cos(ang)*dist]; // camera looks at (0,cy,0)
  // camera basis
  let fov=Math.tan(0.30), aspect=W/H; const w2=W*SS, h2=H*SS;
  let tgt=[0,cy,0];
  if(PORTRAIT){ const pf=pfr[kind]; cam[0]=pf.px; cam[1]=pf.py; cam[2]=pf.pz; tgt=[pf.tx,pf.ty,pf.tz]; fov=Math.tan(16*Math.PI/180); aspect=1; }
  let f=[tgt[0]-cam[0],tgt[1]-cam[1],tgt[2]-cam[2]]; const fl=Math.hypot(...f); f=f.map(v=>v/fl);
  let r=[f[2],0,-f[0]]; const rl=Math.hypot(...r); r=r.map(v=>v/rl); const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]];
  const proj=(x,y,z)=>{ const dx=x-cam[0],dy=y-cam[1],dz=z-cam[2]; const zc=dx*f[0]+dy*f[1]+dz*f[2]; const xc=dx*r[0]+dy*r[1]+dz*r[2], yc=dx*u[0]+dy*u[1]+dz*u[2];
    return [(xc/(zc*fov*aspect)*.5+.5)*w2,(1-(yc/(zc*fov)*.5+.5))*h2,zc]; };
  const zb=new Float32Array(w2*h2).fill(1e9), col=new Uint8Array(w2*h2*3); for(let i=0;i<w2*h2;i++){ const yy=Math.floor(i/w2)/h2; col[i*3]=8+yy*10; col[i*3+1]=22+yy*24; col[i*3+2]=18+yy*16; }
  const L=[.45,.75,-.5].map((v,i,a)=>v/Math.hypot(...a));
  for(const t of tris){ const A=proj(t[0],t[1],t[2]),B=proj(t[3],t[4],t[5]),C=proj(t[6],t[7],t[8]); if(A[2]<=.1||B[2]<=.1||C[2]<=.1) continue;
    const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]]; let n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]]; const nl=Math.hypot(...n)||1; n=n.map(v=>v/nl);
    const facing=n[0]*f[0]+n[1]*f[1]+n[2]*f[2]; const nn=facing>0?n.map(v=>-v):n; // two-sided
    const lam=Math.max(0,nn[0]*L[0]+nn[1]*L[1]+nn[2]*L[2]); const sh=.42+.7*lam;
    const cr=Math.min(1,t[9]*sh+t[12]),cg=Math.min(1,t[10]*sh+t[13]),cb=Math.min(1,t[11]*sh+t[14]);
    const minx=Math.max(0,Math.floor(Math.min(A[0],B[0],C[0]))),maxx=Math.min(w2-1,Math.ceil(Math.max(A[0],B[0],C[0]))),miny=Math.max(0,Math.floor(Math.min(A[1],B[1],C[1]))),maxy=Math.min(h2-1,Math.ceil(Math.max(A[1],B[1],C[1])));
    const den=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]); if(Math.abs(den)<1e-9) continue;
    for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){ const px=x+.5,py=y+.5; const l1=((B[1]-C[1])*(px-C[0])+(C[0]-B[0])*(py-C[1]))/den,l2=((C[1]-A[1])*(px-C[0])+(A[0]-C[0])*(py-C[1]))/den,l3=1-l1-l2; if(l1<0||l2<0||l3<0) continue;
      const z=l1*A[2]+l2*B[2]+l3*C[2]; const i=y*w2+x; if(z<zb[i]){ zb[i]=z; const gm=1/1.0; col[i*3]=Math.pow(cr,.62)*255; col[i*3+1]=Math.pow(cg,.62)*255; col[i*3+2]=Math.pow(cb,.62)*255; } } }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ let rr=0,gg=0,bb=0; for(let sy=0;sy<SS;sy++)for(let sx=0;sx<SS;sx++){ const i=((y*SS+sy)*w2+x*SS+sx)*3; rr+=col[i];gg+=col[i+1];bb+=col[i+2]; } const o=(y*img.w+x0+x)*3; img.d[o]=rr/(SS*SS);img.d[o+1]=gg/(SS*SS);img.d[o+2]=bb/(SS*SS); } }
const img={w:W*kinds.length,h:H,d:new Uint8Array(W*kinds.length*H*3)};
kinds.forEach((k,i)=>render(k,i*W,img));
function png(w,h,d){ const crcT=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c>>>0;} const crc=b=>{let c=0xffffffff;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  const chunk=(t,b)=>{const l=Buffer.alloc(4);l.writeUInt32BE(b.length);const tb=Buffer.concat([Buffer.from(t),b]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(tb));return Buffer.concat([l,tb,c]);};
  const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;Buffer.from(d.buffer,y*w*3,w*3).copy(raw,y*(w*3+1)+1);}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]); }
const out=process.argv[4]||'/home/claude/work/models.png'; fs.writeFileSync(out,png(img.w,img.h,img.d)); console.log('wrote',out,g.errors.length?g.errors[0].slice(0,200):'');
