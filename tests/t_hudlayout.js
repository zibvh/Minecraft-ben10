// Guards the bug that hid every action button: the two button containers must be full-screen (not collapsed to 0x0).
const fs=require('fs'); const html=fs.readFileSync(__dirname+'/../www/index.html','utf8'); let bad=0;
const rule=(sel)=>{ const i=html.lastIndexOf(sel+'{'); return i<0?'':html.slice(i,html.indexOf('}',i)); };
for(const sel of ['#hud #action-buttons','#hud #actions']){ const r=rule(sel); const ok=/left:0/.test(r)&&/top:0/.test(r)&&/width:100%/.test(r)&&/height:100%/.test(r); console.log((ok?'PASS ':'FAIL ')+sel+' is full-screen'); if(!ok) bad++; }
for(const id of ['btn-attack','btn-jump','btn-special','btn-run','lock-btn','minimap','omni-dial']){ const ok=html.includes('id="'+id+'"'); console.log((ok?'PASS ':'FAIL ')+id+' present in DOM'); if(!ok) bad++; }
const card=rule('#hud #alien-card'); const w=+(card.match(/width:(\d+)px/)||[])[1]; console.log((w&&w<=180?'PASS ':'FAIL ')+'profile card width '+w+'px'); if(!(w&&w<=180)) bad++;
process.exit(bad?1:0);
