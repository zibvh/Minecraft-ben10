Visual check of the GLB bodies on the real animator (needs playwright + chromium):
  tests/glb/mktest.sh      builds www/_t.html = index.html + a TEST-ONLY bridge (window.__g). Never ship _t.html.
  node tests/glb/poses.mjs [kind,kind,...]   renders idle/walk/run/punch/heavy/jump/fly/hurt/dead for each alien to poses/*.jpg
  python3 tests/glb/sheet.py <kind>          stitches them into one contact sheet
Paths inside these scripts point at the author's scratch folders - adjust them first.
