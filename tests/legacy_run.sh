#!/bin/bash
# usage: legacy_run.sh <game-html> <label>
SRC="$1"; LABEL="$2"
cp "$SRC" /home/claude/index_test_copy.html
python3 - "$SRC" <<'PY'
import sys,re
p='/home/claude/index_test_copy.html'; s=open(p,encoding='utf8').read()
names="player,enemies,squad,camera,scene,ALIENS,BEN,setForm,meleeAttack,damageEnemy,makeEnemy,splitEcho,sonicBlast,nearestTarget,updatePlayer,updateEnemies,updateChunkStreaming,updateSpeedEffects,ENEMY_STATS,chunks,loadQueue,moveInput,BASE_FOV,streaks,dustPuffs,chunkCoordOf,groundTopAt".split(',')
b="window.__debug={"+",".join("get %s(){try{return %s}catch(e){return undefined}}"%(n,n) for n in names)+"};"
s=s.replace("// initial portrait render for Ben", b+"\n// initial portrait render for Ben",1)
open(p,'w',encoding='utf8').write(s)
PY
mkdir -p /home/claude/ben10/www && cp /home/claude/proj/www/three.min.js /home/claude/ben10/www/three.min.js
for f in test_full_page test_combo test_enemies test_xlr8 test_cannon_check; do
  out=$(timeout 150 node $f.js 2>&1)
  p=$(echo "$out" | grep -c "PASS"); fl=$(echo "$out" | grep -c "FAIL"); er=$(echo "$out" | grep -c "TypeError\|ReferenceError\|SyntaxError")
  echo "$LABEL $f: PASS=$p FAIL=$fl crash=$er"
done
