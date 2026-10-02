/* Minimal offline glTF/GLB runtime loader for this game.
 * Purposefully supports the subset used by the supplied alien GLBs:
 * meshes, node TRS/matrices, PBR materials, embedded images and triangle primitives.
 * Skin weights/joints are decoded into THREE.SkinnedMesh + THREE.Skeleton so the game can
 * drive authored bones directly while preserving the existing root animation/physics system.
 */
(function(global){
  'use strict';
  const CT={5120:{c:1,t:Int8Array},5121:{c:1,t:Uint8Array},5122:{c:2,t:Int16Array},5123:{c:2,t:Uint16Array},5125:{c:4,t:Uint32Array},5126:{c:4,t:Float32Array}};
  const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
  const TYPES={SCALAR:'float',VEC2:'vec2',VEC3:'vec3',VEC4:'vec4',MAT2:'mat2',MAT3:'mat3',MAT4:'mat4'};
  function u8b64(u8){let s='';const n=0x8000;for(let i=0;i<u8.length;i+=n)s+=String.fromCharCode.apply(null,u8.subarray(i,Math.min(i+n,u8.length)));return btoa(s);}
  function nodeMatrix(n){
    if(n.matrix) return new THREE.Matrix4().fromArray(n.matrix);
    const p=new THREE.Vector3(...(n.translation||[0,0,0]));
    const q=new THREE.Quaternion(...(n.rotation||[0,0,0,1]));
    const s=new THREE.Vector3(...(n.scale||[1,1,1]));
    return new THREE.Matrix4().compose(p,q,s);
  }
  function makeAccessor(json,bin,idx){
    const a=json.accessors[idx], bv=json.bufferViews[a.bufferView], C=CT[a.componentType], nc=NC[a.type];
    const stride=bv.byteStride||C.c*nc, base=(bv.byteOffset||0)+(a.byteOffset||0), out=new (C.t)(a.count*nc);
    const norm=a.normalized===true;
    for(let i=0;i<a.count;i++){
      const off=base+i*stride, vals=new C.t(bin.buffer,bin.byteOffset+off,nc);
      for(let j=0;j<nc;j++){
        let v=vals[j];
        if(norm){ if(a.componentType===5121)v/=255; else if(a.componentType===5123)v/=65535; else if(a.componentType===5120)v=Math.max(-1,v/127); else if(a.componentType===5122)v=Math.max(-1,v/32767); }
        out[i*nc+j]=v;
      }
    }
    return {data:out,count:a.count,nc};
  }
  async function readGLB(url){
    const ab=await (await fetch(url)).arrayBuffer();
    const dv=new DataView(ab); if(dv.getUint32(0,true)!==0x46546c67) throw new Error('Not a GLB: '+url);
    let off=12,json=null,bin=null;
    while(off<ab.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);off+=8;const part=new Uint8Array(ab,off,len);off+=len;if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(part).replace(/[\u0000\u0020]+$/,''));else if(type===0x004E4942)bin=part;}
    if(!json||!bin)throw new Error('Incomplete GLB: '+url); return {json,bin};
  }
  async function imageTexture(json,bin,imgIndex,cache){
    if(cache[imgIndex]) return cache[imgIndex];
    const im=json.images[imgIndex], bv=json.bufferViews[im.bufferView];
    const bytes=bin.subarray((bv.byteOffset||0),(bv.byteOffset||0)+(bv.byteLength||0));
    const blob=new Blob([bytes],{type:im.mimeType||'image/png'}), u=URL.createObjectURL(blob);
    cache[imgIndex]=new Promise((resolve,reject)=>{new THREE.TextureLoader().load(u,t=>{URL.revokeObjectURL(u);t.colorSpace=THREE.SRGBColorSpace||t.colorSpace;t.flipY=false;t.needsUpdate=true;resolve(t)},undefined,e=>{URL.revokeObjectURL(u);reject(e)})});
    return cache[imgIndex];
  }
  function matDef(json,mi){
    const m=json.materials&&json.materials[mi]||{}, p=m.pbrMetallicRoughness||{}, c=p.baseColorFactor||[1,1,1,1];
    return {m, color:new THREE.Color(c[0],c[1],c[2]), opacity:c[3], rough:p.roughnessFactor==null?.72:p.roughnessFactor, metal:p.metallicFactor||0, tex:p.baseColorTexture&&p.baseColorTexture.index, emissive:m.emissiveFactor||[0,0,0], alpha:m.alphaMode||'OPAQUE'};
  }
  function buildPrimitive(json,bin,pr,mat,tex,skin){
    if((pr.mode==null?4:pr.mode)!==4) return null;
    const g=new THREE.BufferGeometry();
    for(const k of ['POSITION','NORMAL','TEXCOORD_0','COLOR_0','JOINTS_0','WEIGHTS_0']) if(pr.attributes[k]!=null){const a=makeAccessor(json,bin,pr.attributes[k]);let item=a.nc; if(k==='POSITION'||k==='NORMAL')item=3; if(k==='JOINTS_0')item=a.nc;const attr=new THREE.BufferAttribute(a.data,item);g.setAttribute(k==='TEXCOORD_0'?'uv':k.toLowerCase(),attr);}
    if(pr.indices!=null){const a=makeAccessor(json,bin,pr.indices);g.setIndex(new THREE.BufferAttribute(a.data,1));}
    if(!g.getAttribute('position')) return null;
    if(!g.getAttribute('normal')) g.computeVertexNormals();
    const md=matDef(json,pr.material), opts={color:md.color,roughness:md.rough,metalness:md.metal,transparent:md.opacity<.999,opacity:md.opacity,side:md.m.doubleSided?THREE.DoubleSide:THREE.FrontSide};
    let material;
    if(tex) opts.map=tex;
    if(md.alpha==='BLEND') opts.transparent=true;
    if(md.alpha==='MASK'){opts.transparent=true;opts.alphaTest=md.m.alphaCutoff==null?.5:md.m.alphaCutoff;}
    if(json.extensionsUsed&&json.extensionsUsed.indexOf('KHR_materials_unlit')>=0&&md.m.extensions&&md.m.extensions.KHR_materials_unlit) material=new THREE.MeshBasicMaterial(opts); else material=new THREE.MeshStandardMaterial(opts);
    if(md.emissive) material.emissive=new THREE.Color(...md.emissive);
    const mesh=skin?new THREE.SkinnedMesh(g,material):new THREE.Mesh(g,material); mesh.castShadow=true; mesh.receiveShadow=true; if(skin){ mesh.userData._skin=skin; } return mesh;
  }
  async function load(url,opts={}){
    const {json,bin}=await readGLB(url), imageCache=[], root=new THREE.Group(), nodes=[], skins=[];
    const texByIndex={};
    async function textureFor(index){
      if(index==null)return null; if(texByIndex[index])return texByIndex[index];
      const t=json.textures&&json.textures[index]; if(!t||t.source==null)return null; texByIndex[index]=await imageTexture(json,bin,t.source,imageCache); return texByIndex[index];
    }
    for(let i=0;i<(json.nodes||[]).length;i++){nodes[i]=new THREE.Group();nodes[i].name=json.nodes[i].name||('node_'+i);nodes[i].applyMatrix4(nodeMatrix(json.nodes[i]));}
    for(let i=0;i<(json.nodes||[]).length;i++){const ch=json.nodes[i].children||[];for(const c of ch)nodes[i].add(nodes[c]);}
    const sceneNodes=(json.scenes&&json.scenes[json.scene||0]&&json.scenes[json.scene||0].nodes)||[];
    sceneNodes.forEach(i=>root.add(nodes[i]));
    // Build glTF skins from the already-created node hierarchy. The supplied GLBs use
    // ordinary node TRS bones, so keeping those exact nodes lets the game pose the real
    // skeleton without baking animations into the mesh.
    for(let si=0;si<(json.skins||[]).length;si++){
      const sd=json.skins[si], bones=(sd.joints||[]).map(i=>nodes[i]), inverses=[];
      if(sd.inverseBindMatrices!=null){ const a=makeAccessor(json,bin,sd.inverseBindMatrices); for(let i=0;i<a.count;i++) inverses.push(new THREE.Matrix4().fromArray(Array.from(a.data.slice(i*16,i*16+16)))); }
      while(inverses.length<bones.length) inverses.push(new THREE.Matrix4());
      skins[si]={bones,inverses,skeleton:new THREE.Skeleton(bones,inverses),rootJoint:sd.skeleton!=null?nodes[sd.skeleton]:null};
    }
    const tasks=[];
    for(let ni=0;ni<nodes.length;ni++){
      const n=json.nodes[ni]; if(n.mesh==null)continue;
      if(opts.meshFilter&&!opts.meshFilter(n,ni,json))continue;
      const md=json.meshes[n.mesh]; for(const pr of md.primitives||[]){
        const texIdx=pr.material!=null&&json.materials&&json.materials[pr.material]&&json.materials[pr.material].pbrMetallicRoughness&&json.materials[pr.material].pbrMetallicRoughness.baseColorTexture;
        const skin=n.skin!=null?skins[n.skin]:null;
        tasks.push((async()=>{const tex=await textureFor(texIdx&&texIdx.index);const mesh=buildPrimitive(json,bin,pr,pr.material,tex,skin);if(mesh){mesh.name=md.name||n.name||('mesh_'+n.mesh);nodes[ni].add(mesh); if(skin){ nodes[ni].updateMatrixWorld(true); mesh.bind(skin.skeleton,nodes[ni].matrixWorld); mesh.userData.gltfSkin=skin; }}})());
      }
    }
    await Promise.all(tasks);
    root.updateMatrixWorld(true);
    root.traverse(o=>{if(o.isSkinnedMesh&&o.userData.gltfSkin){o.userData.gltfSkin.skeleton.update();}});
    root.traverse(o=>{if(o.isMesh){o.frustumCulled=true;o.userData.sourceGLB=url;o.userData.bindPose=!o.isSkinnedMesh;o.userData.gltfSkinned=!!o.isSkinnedMesh;}});
    return root;
  }
  global.MiniGLTF={load};
})(window);
