Automated headless tests (Node + jsdom). NOT part of the Android build.
Run from a folder with `npm install jsdom`. They load www/index.html with a stubbed WebGL/Audio layer.
Each test file targets one stage: combat combo, enemy AI, XLR8 speed, Cannonbolt roll, plus a general page-load/regression check.

STAGE 6 (lock-on): harness.js + test_lockon.js / test_lockon2.js / test_lockon3.js.
These inject a TEST-ONLY window.__debug bridge into a copy of www/index.html at load time (the shipped game has no debug hooks).
Run from a folder with `npm install jsdom`:  node test_lockon.js   (set GAME=/path/to/index.html to override the source).
legacy_run.sh runs the older stage tests against any index.html by injecting a compatible bridge.
layout.py is an analytic (not pixel) overlap check of the HUD button geometry.

FEEL PASS + STAGE 11: dependency-free tests (no jsdom needed): `node t_boot.js`, `t_omni.js`, `t_veh.js`, `t_brake.js`, `t_enemy.js`.
They run the real game script + three.min.js in a Node vm with a mock DOM (vmharness.js). Set GAME=/path/to/index.html to override.
