// Rebuilds www/models.js (the GLB bodies embedded as base64 so the game also works from file:// and inside the APK)
// from models/*.glb.   Usage:  node tools/build-models.js
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..'), kinds=['four_arms','heatblast','xlr8','echo_echo','cannonbolt'];
let out='window.__GLB_DATA={\n';
for(const k of kinds){ const f=path.join(root,'models',k+'.glb'); const b=fs.readFileSync(f); out+='"'+k+'":"'+b.toString('base64')+'",\n'; console.log(k,(b.length/1024).toFixed(0)+' KB'); }
out+='};\n'; fs.writeFileSync(path.join(root,'www','models.js'),out); console.log('wrote www/models.js');
