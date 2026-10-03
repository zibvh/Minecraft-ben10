How the models in /models were produced from the original Sketchfab-style GLBs (needs: npm i @gltf-transform/core @gltf-transform/functions meshoptimizer sharp):
  prep.mjs  <name> <simplifyRatio> <maxTexturePx> [error]   - strips the Echo Echo rig-control shapes/extra bodies/animations,
                                                              welds + simplifies Heatblast (170k -> 77k verts), shrinks textures.
  rigfa.mjs                                                 - Four Arms shipped as a static, un-rigged T-pose mesh: builds a 20-bone skeleton
                                                              (4 arms, legs, spine, neck/head) and computes capsule-distance skin weights.
The original uploads are expected in ../c/ (see the paths at the top of each script).
