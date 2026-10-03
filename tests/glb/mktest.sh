#!/bin/bash
# builds game/www/_t.html : index.html + test-only debug bridge
cd /tmp/claude-0/-home-claude/182ab0ef-740a-513e-ba3c-19d5af1b8a84/scratchpad/game/www
python3 - <<'PY'
s=open('index.html').read()
i=s.rindex('})();\n</script>')
s=s[:i]+"window.__g={renderPortrait,portraitThumb,portraitFraming,PS,ALIENS,setForm,player,animateRig,renderer,scene,camera:(typeof camera!=='undefined'?camera:null),THREE,buildCharacter,get enemies(){return enemies}};\n"+s[i:]
open('_t.html','w').write(s)
PY
