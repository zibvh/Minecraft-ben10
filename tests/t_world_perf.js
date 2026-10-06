const {boot}=require('./vmharness.js');
const g=boot(); const d=g.d;
const hr=()=>Number(process.hrtime.bigint())/1e6;
let maxLots=0,maxQueue=0,maxSky=0,maxChunk=null,maxBuild=0,totalBuild=0,buildN=0,maxStep=0;
const path=[];
for(let i=0;i<1800;i++){
  const t=i/60;
  const x=900*Math.sin(t*.11)+250*Math.sin(t*.037);
  const z=900*Math.cos(t*.09)+320*Math.sin(t*.051);
  path.push([x,z]);
}
for(const [x,z] of path){
  const y=d.groundTopAt(x,z)+1; d.player.pos.set(x,y,z);
  const t0=hr(); d.updateMetropolis(x,z,1/60); const ms=hr()-t0;
  maxStep=Math.max(maxStep,ms); maxLots=Math.max(maxLots,d.lots.size); maxQueue=Math.max(maxQueue,d.STAT.queue); maxSky=Math.max(maxSky,d.SKY.mesh.count);
  if(d.STAT.lotMsLast>maxBuild) maxBuild=d.STAT.lotMsLast;
  if(d.STAT.lotMsLast>0){ totalBuild+=d.STAT.lotMsLast; buildN++; }
}
console.log('virtual traversal 30s');
console.log('max updateMetropolis ms',maxStep.toFixed(2),'max lot build ms',maxBuild.toFixed(2),'avg recorded lot build ms',(totalBuild/Math.max(1,buildN)).toFixed(2));
console.log('peak lots',maxLots,'peak queue',maxQueue,'peak skyline instances',maxSky,'current lots',d.lots.size,'current errors',g.errors.length);
console.log('built',d.STAT.lotsBuilt,'dropped',d.STAT.lotsDropped,'skyline builds',d.STAT.skyBuilds);
process.exit(g.errors.length?1:0);
