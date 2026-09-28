Automated headless tests (Node + jsdom). NOT part of the Android build.
Run from a folder with `npm install jsdom`. They load www/index.html with a stubbed WebGL/Audio layer.
Each test file targets one stage: combat combo, enemy AI, XLR8 speed, Cannonbolt roll, plus a general page-load/regression check.
