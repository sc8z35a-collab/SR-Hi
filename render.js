import * as THREE from './vendor/three.module.js';
import {Reflector} from './vendor/Reflector.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {doorProgress} from './layout.js';
import {THROAT,WING_SPINE,distanceToBounds} from './expansion.js';
import {applyIndoorLighting,createFixtureController,createLightingDataInWorker} from './lighting.js';
import {applyRetexture,loadRetexture} from './textures.js';
import {buildExtension} from './cavern.js';
import {createSlicer} from './kit.js';
import {CAVERN_FIXTURES,floorHeight} from './cavern-layout.js';

export const QUALITY = {
  high: {height:920,width:2100, lights:8, reflection:1, refresh:1, shadows:true, far:63},
  balanced:{height:620,width:1620, lights:6, reflection:.67, refresh:3, shadows:true, far:51},
  light:{height:400,width:1160, lights:4, reflection:0, refresh:0, shadows:false, far:39}
};
const corridorFloors = [[-2.85,-34.52,2.85,3.93],[2.85,-14.70,13.28,-3.10],
  [-9.95,-14.70,-2.85,-3.80],[2.85,-30.70,12.55,-17.10],[-4.73,-41.51,4.73,-34.52],
  ...[THROAT,WING_SPINE].map(({x1,z1,x2,z2})=>[x1,z1,x2,z2])];

const floorShader={
  name:'Epoxy floor reflection',
  uniforms:{
    tDiffuse:{value:null},color:{value:new THREE.Color(0xffffff)},
    textureMatrix:{value:new THREE.Matrix4()},grain:{value:null},
    texel:{value:new THREE.Vector2(1,1)},strength:{value:1}
  },
  vertexShader:`
    uniform mat4 textureMatrix;
    varying vec4 vMirror;
    varying vec3 vWorld;
    void main(){
      vMirror=textureMatrix*vec4(position,1.0);
      vWorld=(modelMatrix*vec4(position,1.0)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }`,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D grain;
    uniform vec2 texel;
    uniform float strength;
    varying vec4 vMirror;
    varying vec3 vWorld;
    void main(){
      if(vMirror.w<=0.0)discard;
      vec2 uv=vMirror.xy/vMirror.w;
      if(any(lessThan(uv,vec2(.005)))||any(greaterThan(uv,vec2(.995))))discard;
      float rough=texture2D(grain,vWorld.xz*.435).g;
      float ripple=texture2D(grain,vWorld.xz*.51+vec2(.02,-.015)).g;
      vec2 radius=texel*(1.1+rough*3.6);
      uv+=vec2(rough-.42,ripple-.42)*.006;
      vec2 margin=min(uv,1.0-uv);
      float edgeFade=smoothstep(.015,.135,min(margin.x,margin.y));
      vec3 result=texture2D(tDiffuse,uv).rgb*.34;
      result+=texture2D(tDiffuse,uv+radius*vec2(-.83,-.34)).rgb*.16;
      result+=texture2D(tDiffuse,uv+radius*vec2(.83,-.34)).rgb*.16;
      result+=texture2D(tDiffuse,uv+radius*vec2(-.34,.96)).rgb*.17;
      result+=texture2D(tDiffuse,uv+radius*vec2(.34,.96)).rgb*.17;
      float angle=clamp(normalize(cameraPosition-vWorld).y,0.0,1.0);
      float fresnel=.095+pow(1.0-angle,3.0)*.35;
      float fade=1.0-smoothstep(15.0,37.0,distance(vWorld,cameraPosition));
      gl_FragColor=vec4(result*vec3(.87,.98,1.0),fresnel*fade*edgeFade*(1.05-.86*rough)*strength);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

function createFloorMirror(texture, hasFloat) {
  const vertices=[];
  for(const [x1,z1,x2,z2] of corridorFloors){
    const a=[x1,-z1,0],b=[x2,-z1,0],c=[x2,-z2,0],d=[x1,-z2,0];
    vertices.push(...a,...c,...b,...a,...d,...c);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const object=new Reflector(geometry,{shader:floorShader,textureWidth:280,textureHeight:135,multisample:0,clipBias:.001});
  if(!hasFloat)object.getRenderTarget().texture.type=THREE.UnsignedByteType;
  object.rotation.x=-Math.PI/2;
  object.position.y=.006;
  object.material.uniforms.grain.value=texture;
  object.material.transparent=true;
  object.material.depthWrite=false;
  object.material.blending=THREE.AdditiveBlending;
  object.renderOrder=1;
  return object;
}

function buildEnvironment(renderer) {
  const room=new THREE.Scene();
  room.background=new THREE.Color(0x828c86);
  function plane(x,y,z,w,h,d,color,brightness) {
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(brightness),toneMapped:false});
    const panel=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    panel.position.set(x,y,z);
    room.add(panel);
  }
  plane(0,3.7,0,1.15,.035,6,0xd8eaff,4.1);
  plane(0,3.7,-5,.82,.038,2.0,0xcde7ff,3.4);
  plane(-4.5,2.0,-1,.06,1.2,4.8,0xbad8ec,1.8);
  plane(4.6,1.97,3.2,.07,1.5,3.6,0xe6dcc0,2.25);
  plane(0,1.68,-8,3.1,2.61,.045,0x596a68,.68);
  plane(0,-2.25,0,9.8,.03,14,0x4a5252,.42);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const target=pmrem.fromScene(room,.04,.12,32,{size:96});
  pmrem.dispose();
  room.children.forEach(o=>{o.geometry.dispose();o.material.dispose();});
  return target;
}

function contactShadows(scene, model) {
  const size=64;
  const photo=document.createElement('canvas');photo.width=photo.height=size;
  const ctx=photo.getContext('2d');
  const glow=ctx.createRadialGradient(32,32,0,32,32,32);
  glow.addColorStop(0,'rgba(0,8,9,0.95)');
  glow.addColorStop(.43,'rgba(0,8,9,0.50)');
  glow.addColorStop(.78,'rgba(0,8,9,0.11)');
  glow.addColorStop(1,'rgba(0,8,9,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,size,size);
  const map=new THREE.CanvasTexture(photo);
  map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({ map,transparent:true,depthWrite:false,opacity:.54,polygonOffset:true,polygonOffsetFactor:-1 });
  const geom=new THREE.PlaneGeometry(1,1);
  const shades=new THREE.Group();
  const installations=[
    [-2.18,-2.94,.9,1.2],[2.25,-14.93,1.0,1.2],
    [6.64,-10.60,3.85,1.84],[10.86,-10.74,3.85,1.84],[9.10,-4.84,3.85,1.84],[11.05,-13.72,4.42,1.72],
    [-7.94,-10.95,2.98,1.54],[-5.44,-10.95,2.98,1.54],[-7.70,-13.53,3.64,1.31],
    [4.81,-7.13,1,1.03],[-4.67,-7.76,1,1.03],[4.89,-21.59,1,1.03],[-4.65,-24.78,1,1.03],[-2.51,-38.97,1,1.03],
    [7.61,-27.14,2.4,2.4],[10.66,-27.14,2.4,2.4],[7.61,-24.50,2.4,2.4],[10.66,-24.50,2.4,2.4],
    [-7.98,-26.56,3.26,2.05],[-7.98,-28.67,3.26,2.05],[2.77,-37.61,3.25,1.8]
  ];
  function put(x,z,w,h){
    const shade=new THREE.Mesh(geom,material);
    shade.rotation.x=-Math.PI/2;
    shade.position.set(x,.018,z);
    shade.scale.set(w,h,1);
    shade.renderOrder=3;
    shades.add(shade);
    return shade;
  }
  installations.forEach(setting=>put(...setting));
  scene.add(shades);
  return model.map(actor=>put(actor.root.position.x,actor.root.position.z,.90,.68));
}

function byName(scene,name) {
  return scene.getObjectByName(name)||scene.getObjectByName(name.replaceAll(' ','_'));
}
function bindDoorMeshes(model,doors){
  return doors.map(door=>{
    const left=byName(model,'Portal '+door.room.code+' left');
    const right=byName(model,'Portal '+door.room.code+' right');
    if(!left||!right)throw new Error('Missing sliding door '+door.room.code);
    return {door,left,right};
  });
}
function readActors(model) {
  const names=['Research specialist','Facility technician','Archive specialist'];
  return names.map((name,index)=>{
    const root=byName(model,name);
    if(!root)throw new Error('Missing 3D character '+name);
    const base=root.children[0];
    const helmet=byName(base,'Helmet')||base.children.find(o=>o.name.startsWith('Helmet')&&!o.isMesh);
    const direct=(prefix)=>base.children.find(node=>node.name.startsWith(prefix)&&!node.isMesh);
    const arms=['Left_shoulder','Right_shoulder'].map(direct);
    const legs=['Left_hip','Right_hip'].map(direct);
    const trim=[];
    root.traverse(node=>{
      const material=node.material?.name??'';
      if(node.isMesh&&/lace|antenna|stitch|zipper|seam|badge|gasket/i.test(node.name))trim.push(node);
      if(node.isMesh && !node.material.transparent)node.castShadow=true;
      if(node.isMesh && !node.material.transparent)node.receiveShadow=true;
      if(node.isMesh&&material.startsWith('Backlit'))node.receiveShadow=false;
    });
    const motion={arms,legs,head:helmet,base,index,phase:.91+1.65*index};
    const vents=legs.map(leg=>leg?.children.find(o=>!o.isMesh&&o.name.startsWith('Knee')));
    return {root,motion,vents,trim,z:root.position.z,x:root.position.x,y:root.rotation.y};
  });
}

function characterFrame(actor,shadow,time,camera,mode) {
  const {root,motion,x,z,y,trim,vents}=actor;
  const {base,head,legs,arms,index,phase}=motion;
  const travel=time*.34, cycle=time*4.9;
  const walking=index===1;
  const fader=walking?Math.min(1,Math.abs(Math.cos(travel))*3):0;
  if(walking){
    root.position.set(x+Math.sin(travel)*.08,0,z+Math.sin(travel)*2.22);
    root.rotation.y=Math.acos(THREE.MathUtils.clamp(Math.cos(travel)*4.1,-1,1));
  }else{
    root.rotation.y=y+Math.sin(time*.62+phase)*.045;
  }
  const distance=Math.hypot(root.position.x-camera.position.x,root.position.z-camera.position.z);
  root.visible=distance<(mode==='light'?15:30);
  shadow.visible=root.visible;
  if(!root.visible)return;
  for(const part of trim)part.visible=distance<(mode==='light'?5.5:11.5);
  shadow.position.x=root.position.x;shadow.position.z=root.position.z;
  base.position.y=Math.sin(time*1.5+phase)*.007+Math.abs(Math.sin(cycle))*fader*.019;
  base.rotation.z=Math.sin(time*.80+phase)*.012+Math.cos(cycle)*fader*.015;
  if(head){
    head.rotation.y=(index===0?-.16:0)+Math.sin(time*.65+phase)*.15;
    head.rotation.x=(index===0?.23:0)+Math.sin(time*1.08+phase)*.035;
  }
  if(walking)for(let i=0;i<2;i++){
    const stride=Math.sin(cycle+i*Math.PI)*fader;
    if(legs[i])legs[i].rotation.x=-stride*.425;
    if(arms[i])arms[i].rotation.x=stride*.305-.035;
    if(vents[i])vents[i].rotation.x=.037+Math.max(stride,0)*.68;
  }
}

/**
 * Replaces GLTFLoader's EXT_texture_webp handler with one that loads a few images at a time.
 * The models embed hundreds of images; starting them all at once (a Blob, an object URL and a
 * decode each) is one long main-thread task that freezes the game for a moment.
 */
function throttledWebp(limit){
  return parser=>{
    let active=0;
    const waiting=[];
    const run=()=>{
      while(active<limit&&waiting.length){
        const [job,resolve,reject]=waiting.shift();
        active++;
        job().then(resolve,reject).finally(()=>{active--;run();});
      }
    };
    return {
      name:'EXT_texture_webp',
      loadTexture(textureIndex){
        const extension=parser.json.textures[textureIndex].extensions?.EXT_texture_webp;
        if(!extension)return null;
        const source=parser.json.images[extension.source];
        const loader=(source.uri&&parser.options.manager.getHandler(source.uri))||parser.textureLoader;
        return new Promise((resolve,reject)=>{
          waiting.push([()=>parser.loadTextureImage(textureIndex,extension.source,loader),resolve,reject]);
          run();
        });
      },
    };
  };
}

export async function loadWalkthrough(canvas, doors, onProgress) {
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'})
    ??canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'default'});
  if(!gl)throw Object.assign(new Error('WebGL 2 unavailable'),{code:'webgl-unavailable'});
  const renderer=new THREE.WebGLRenderer({canvas,context:gl});
  try {
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.065;
    renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate=false;

    // decode the compressed meshes in worker threads instead of on the main thread
    if(typeof Worker==='function'&&MeshoptDecoder.supported)MeshoptDecoder.useWorkers(2);
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.register(throttledWebp(4));
    const importModel=(source,progress)=>loader.loadAsync(source,event=>{
      if(event.lengthComputable&&event.total)progress?.(event.loaded/event.total);
    });
    const retexturing=loadRetexture().catch(()=>new Map());
    const imported=await importModel('./assets/facility-retrofitted.glb',onProgress);
    const model=imported.scene;
    const retexture=await retexturing;
    applyRetexture(model,retexture);
    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x11191b);
    scene.fog=new THREE.FogExp2(0x1d282b,.024);
    scene.add(model);
    const camera=new THREE.PerspectiveCamera(58,1,.055,56);
    camera.rotation.order='YXZ';
    const hasFloat=renderer.extensions.has('EXT_color_buffer_float');
    let environment=hasFloat?buildEnvironment(renderer):null, restored=false;
    scene.environment=environment?.texture??null;
    scene.environmentIntensity=.58;
    scene.add(new THREE.HemisphereLight(0xe1edf2,0xac9c83,hasFloat?1.04:1.30));
    const fixtures=model.userData.fixtures??imported.parser.json.scenes[0].extras.fixtures;
    const lighting=await createLightingDataInWorker(fixtures,createSlicer({ms:40}));
    const fixtureController=createFixtureController(scene,lighting.sources);
    const island=new THREE.SpotLight(0xe3f4ff,18,10,.83,.76,2);
    island.castShadow=true;
    island.visible=false;
    island.shadow.mapSize.set(768,768);
    island.shadow.camera.near=.21;
    island.shadow.camera.far=10;
    island.shadow.normalBias=.025;
    island.shadow.bias=-.00024;
    scene.add(island,island.target);
    const flashlight=new THREE.SpotLight(0xe3f0ff,0,17,.26,.68,1.71);
    flashlight.position.set(.16,-.16,-.10);
    flashlight.target.position.set(.04,-.09,-6.5);
    camera.add(flashlight,flashlight.target);
    scene.add(camera);

    const materials=new Map();
    let floorMaterial=null;
    const anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),6);
    function configureModel(root){root.traverse(o=>{
      if(!o.isMesh)return;
      const source=o.material;
      if(!source||Array.isArray(source))return;
      const name=source.name??'';
      if(source.transparent){
        source.depthWrite=false;
        if(name.includes('glass'))o.renderOrder=5;
      }
      if(o.userData.decal){
        source.polygonOffset=true;source.polygonOffsetFactor=-1;o.renderOrder=2;
      }
      if(source.isMeshStandardMaterial&&!materials.has(source)){
        materials.set(source, {
          normal:source.normalMap, roughnessMap:source.roughnessMap,
          metalnessMap:source.metalnessMap, roughness:source.roughness,
          roughnessMean:source.userData.roughnessMean
        });
        applyIndoorLighting(source,lighting.texture);
        for(const map of [source.map,source.normalMap])if(map)map.anisotropy=anisotropy;
        if(name.includes('corridor-epoxy'))floorMaterial=source;
        if(source.normalMap)source.normalScale.multiplyScalar(.82);
      }
      if(/^[a-zA-Z_]+/.test(o.name)&&source.isMeshStandardMaterial&&!source.transparent){
        o.receiveShadow=true;
        o.castShadow=/equipment|electrical|cabinet|molded|ceramic|panel|ripstop|twill|welded|black-steel|frost-stainless|culture-polymer/i.test(name);
      }
    });}
    configureModel(model);
    const mirror=createFloorMirror(floorMaterial?.roughnessMap??new THREE.DataTexture(new Uint8Array([111,111,111,255]),1,1),hasFloat);
    if(!floorMaterial?.roughnessMap)mirror.material.uniforms.grain.value.needsUpdate=true;
    scene.add(mirror);
    let level=QUALITY.balanced, levelName='balanced', renderScale=1, frame=0, mirrorFrame=-1, shadowAt=0, lamp=null;
    const reflectedPose=new THREE.Vector4(), previousPose=new THREE.Vector4();
    const originalDraw=mirror.onBeforeRender;
    mirror.onBeforeRender=function(...args){
      if(!reflection()||mirrorFrame===frame)return;
      const turned=Math.abs(previousPose.z-reflectedPose.z)+Math.abs(previousPose.w-reflectedPose.w)>.065;
      const moved=Math.hypot(previousPose.x-reflectedPose.x,previousPose.y-reflectedPose.y)>.16;
      if(mirrorFrame>=0&&!turned&&!moved&&frame-mirrorFrame<(level.refresh||3))return;
      mirrorFrame=frame;
      previousPose.copy(reflectedPose);
      originalDraw.apply(this,args);
    };

    const doorMeshes=bindDoorMeshes(model,doors.filter(door=>!door.room.entry));
    const actors=readActors(model);
    const shadows=contactShadows(scene,actors);
    const sectorVisuals=new Map();
    let expansion=null, expansionRequest=null, wingSectors=[], destroyed=false, extensionFrame=null;
    for(const mesh of model.children){
      const key=mesh.name.match(/^room[_\s](\d\d)/i)?.[1];
      if(!key)continue;
      if(!sectorVisuals.has(key))sectorVisuals.set(key,[]);
      sectorVisuals.get(key).push(mesh);
    }

    // ---- loading the wing and everything beyond it (rooms 06-24 and the open air) ----
    // Started in the background as soon as the walk begins (main.js). Every heavy step is
    // time-sliced, shaders are compiled ahead and textures and geometry are sent to the GPU a few
    // at a time before the wing joins the scene, so no single frame has to absorb the load.
    const loadBudget={ms:10}, slice=createSlicer(loadBudget), expansionListeners=new Set();
    let expansionFraction=0;
    function reportExpansion(fraction){
      expansionFraction=Math.max(expansionFraction,Math.min(1,fraction));
      for(const listener of expansionListeners)listener(expansionFraction);
    }
    function meshesOf(root){
      const meshes=[];
      root.traverse(object=>{if(object.isMesh||object.isLine||object.isPoints)meshes.push(object);});
      return meshes;
    }
    /** Compile the shaders of `root`'s materials one at a time, for this scene's lights and fog. */
    async function compileGradually(root){
      const firstUse=new Map();
      for(const object of meshesOf(root))for(const material of [object.material].flat())if(material&&!firstUse.has(material))firstUse.set(material,object);
      const entries=[...firstUse];
      for(let i=0;i<entries.length;i++){
        const batch=new THREE.Group();
        for(const [material,object] of entries.slice(i,i+1)){
          const proxy=new THREE.Mesh(object.geometry,material);
          proxy.castShadow=object.castShadow;proxy.receiveShadow=object.receiveShadow;
          batch.add(proxy);
        }
        await renderer.compileAsync(batch,camera,scene);
        await slice();
      }
    }

    // ---- GPU streaming: textures and vertex buffers go to the GPU before they come into view ----
    // three.js uploads a texture or a buffer the first time it is drawn, all in that frame. Instead,
    // meshes within view distance (+30 m) of the player are uploaded one item at a time with a
    // small budget per frame, nearest first, so nothing new has to be uploaded when it appears.
    const warmScene=new THREE.Scene();
    warmScene.overrideMaterial=new THREE.MeshBasicMaterial();
    const warmTarget=new THREE.WebGLRenderTarget(1,1);
    let warmItems=[], warmOrder=[], warmAt={x:Infinity,z:Infinity,frame:-1};
    function registerWarmup(root){
      for(const mesh of meshesOf(root)){
        if(!mesh.isMesh)continue;
        const textures=new Set();
        for(const material of [mesh.material].flat()){
          if(material)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
        }
        const {min,max}=new THREE.Box3().setFromObject(mesh);
        warmItems.push({mesh,textures:[...textures],geometry:true,bounds:{x1:min.x,x2:max.x,z1:min.z,z2:max.z}});
      }
    }
    /** Upload a mesh's vertex and index buffers by drawing it once into a 1x1 target. */
    function uploadGeometry(mesh){
      const parent=mesh.parent,index=parent?parent.children.indexOf(mesh):-1;
      const {visible,frustumCulled}=mesh;
      mesh.visible=true;mesh.frustumCulled=false;
      warmScene.add(mesh);
      const previous=renderer.getRenderTarget();
      renderer.setRenderTarget(warmTarget);
      renderer.render(warmScene,camera);
      renderer.setRenderTarget(previous);
      warmScene.remove(mesh);
      if(parent){parent.children.splice(index,0,mesh);mesh.parent=parent;}
      mesh.visible=visible;mesh.frustumCulled=frustumCulled;
    }
    /** Do one upload for the nearest mesh within range of (x, z). Returns false when nothing is left in range. */
    function warmStep(x,z){
      if(!warmItems.length)return false;
      const range=farDistance()+30;
      if(frame-warmAt.frame>45||Math.hypot(x-warmAt.x,z-warmAt.z)>4){
        warmAt={x,z,frame};
        warmOrder=warmItems.map(item=>[distanceToBounds(item.bounds,x,z),item]).filter(([d])=>d<range).sort((a,b)=>a[0]-b[0]).map(([,item])=>item);
      }
      while(warmOrder.length){
        const item=warmOrder[0];
        if(item.textures.length){renderer.initTexture(item.textures.pop());return true;}
        if(item.geometry){item.geometry=false;uploadGeometry(item.mesh);return true;}
        warmOrder.shift();
        warmItems.splice(warmItems.indexOf(item),1);
      }
      return false;
    }
    function warmFrame(x,z,ms){
      const until=performance.now()+ms;
      while(performance.now()<until&&warmStep(x,z));
    }

    /**
     * Load the wing. `urgent` (ms of work per frame) speeds the background load up when the
     * player is waiting for it: at the door, or behind the loading screen.
     */
    function loadExpansion(progress,{urgent=0}={}){
      if(urgent)loadBudget.ms=Math.max(loadBudget.ms,urgent);
      if(expansion)return Promise.resolve();
      if(progress){expansionListeners.add(progress);progress(expansionFraction);}
      if(expansionRequest)return expansionRequest;
      let modelPart=0,buildPart=0;
      const loadParts=()=>reportExpansion(modelPart*.15+buildPart*.6);
      const closed=(...roots)=>{
        if(!destroyed)return false;
        for(const root of roots)if(root)disposeMeshes(root);
        throw new Error('3D renderer was closed during load');
      };
      expansionRequest=(async()=>{
        const [extra,extension]=await Promise.all([
          importModel('./assets/expansion-equipped.glb',f=>{modelPart=f;loadParts();}),
          buildExtension({slice,progress:f=>{buildPart=f;loadParts();}}),
        ]);
        const root=extra.scene;
        closed(root,extension);
        // the wing's own materials hide the doorway in room 11's back wall (see lighting.js)
        root.traverse(object=>{if(object.isMesh&&!Array.isArray(object.material))object.material.userData.facilityCut=true;});
        applyRetexture(root,retexture);
        await slice();
        root.add(extension);
        const nextDoors=bindDoorMeshes(root,doors.filter(door=>door.room.entry));
        const nextLight=await createLightingDataInWorker([...fixtures,...root.userData.fixtures,...CAVERN_FIXTURES],slice);
        closed(root);
        reportExpansion(.8);
        configureModel(root);
        applyMaterialQuality();
        root.updateMatrixWorld(true);
        const sectors=root.children.map(object=>{
          const {min,max}=new THREE.Box3().setFromObject(object);
          return {object,x1:min.x,x2:max.x,z1:min.z,z2:max.z};
        });
        await slice();
        await compileGradually(root);
        closed(root);
        reportExpansion(.9);
        registerWarmup(root);
        while(warmStep(camera.position.x,camera.position.z))await slice();
        closed(root);
        // everything is on the GPU: joining the scene now costs one ordinary frame
        extensionFrame=extension.userData.frame??null;
        wingSectors=sectors;
        lighting.texture.image.data.set(nextLight.texture.image.data);
        lighting.texture.needsUpdate=true;
        nextLight.texture.dispose();
        fixtureController.setSources(nextLight.sources);
        lamp=null;
        doorMeshes.push(...nextDoors);
        scene.add(root);
        expansion=root;
        setQuality(levelName);
        reportExpansion(1);
      })().finally(()=>{
        expansionRequest=null;
        expansionListeners.clear();
        loadBudget.ms=10;
      });
      return expansionRequest;
    }

    function resize(){
      const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;
      if(w<1||h<1)return;
      const cap=resolutionCap??level;
      const scale=Math.min(window.devicePixelRatio||1,cap.height/h,cap.width/w)*renderScale;
      const width=Math.max(1,Math.floor(w*scale)),height=Math.max(1,Math.floor(h*scale));
      if(canvas.width!==width||canvas.height!==height)renderer.setSize(width,height,false);
      camera.aspect=w/h;
      camera.fov=w/h>2.4?52:58;
      camera.updateProjectionMatrix();
      if(reflection()){
        const rw=Math.max(120,Math.round(width*reflection()*.47)),rh=Math.max(60,Math.round(height*reflection()*.47));
        mirror.getRenderTarget().setSize(rw,rh);
        mirror.material.uniforms.texel.value.set(1/rw,1/rh);
      }
      mirrorFrame=-1;
    }
    // player settings that override the quality preset (null = follow the preset)
    let drawDistance=null, reflectionOn=null, resolutionCap=null;
    const farDistance=()=>drawDistance??level.far;
    const reflection=()=>reflectionOn===null?level.reflection:reflectionOn?(level.reflection||.6):0;
    /** Draw distance in metres: the camera's far plane, which chunks are drawn and how far ahead the GPU is fed. */
    function setDrawDistance(metres){
      drawDistance=metres?Math.max(15,Math.min(160,metres)):null;
      camera.far=farDistance();
      camera.updateProjectionMatrix();
      scene.userData.fogScale=Math.min(1.6,Math.max(.45,51/farDistance()));
      scene.fog.density=.024*scene.userData.fogScale;
      warmAt.frame=-1000;
    }
    /** Floor reflections on or off (null = as the preset). */
    function setReflection(on){
      reflectionOn=on===null?null:Boolean(on);
      mirror.visible=Boolean(reflection());
      mirrorFrame=-1;
      resize();
    }
    /** Upper limit of the rendering resolution, e.g. {width:1920,height:1080} (null = as the preset). */
    function setResolution(cap){
      resolutionCap=cap;
      resize();
    }
    function setQuality(name){
      levelName=Object.hasOwn(QUALITY,name)?name:'balanced';
      level=QUALITY[levelName];
      mirror.visible=Boolean(reflection());
      mirror.material.uniforms.strength.value=levelName==='high'?1.38:1.13;
      camera.far=farDistance();
      fixtureController.setCount(level.lights);
      island.visible=level.shadows;
      island.castShadow=level.shadows;
      renderer.shadowMap.enabled=level.shadows;
      renderer.shadowMap.needsUpdate=level.shadows;
      scene.environmentIntensity=levelName==='high'?.60:.54;
      applyMaterialQuality();
      resize();
    }
    function applyMaterialQuality(){
      const detailed=levelName!=='light';
      for(const [material,maps] of materials){
        const normal=detailed?maps.normal:null;
        if(material.normalMap!==normal)material.needsUpdate=true;
        material.normalMap=normal;
        material.roughnessMap=detailed?maps.roughnessMap:null;
        material.metalnessMap=detailed?maps.metalnessMap:null;
        material.roughness=detailed?maps.roughness:(maps.roughnessMean??maps.roughness);
      }
    }
    function setRenderScale(scale){
      if(renderScale===scale)return;
      renderScale=scale;
      resize();
    }
    function lightFrame(time) {
      const ranked=fixtureController.update(camera.position.x,camera.position.z,time);
      if(!level.shadows)return;
      const primary=ranked.find(({fixture})=>fixture.y>2.9&&fixture.intensity>14);
      if(primary&&primary.fixture!==lamp?.fixture&&(!lamp||primary.score+3.4<lamp.score)){
        lamp=primary;
        const f=lamp.fixture;
        island.position.set(f.x,f.y+.14,f.z);
        island.target.position.set(f.x,.1,f.z);
        island.color.setHex(f.color);
        island.intensity=f.intensity*.29;
        renderer.shadowMap.needsUpdate=true;
      }
      if(time-shadowAt>.245){
        renderer.shadowMap.needsUpdate=true;
        shadowAt=time;
      }
    }
    function draw(player,time){
      if(restored){
        if(hasFloat){
          environment.dispose();
          environment=buildEnvironment(renderer);
          scene.environment=environment.texture;
        }
        renderer.shadowMap.needsUpdate=level.shadows;
        mirrorFrame=-1;
        restored=false;
      }
      camera.position.set(player.x,1.64+player.bob+floorHeight(player.x,player.z),player.z);
      camera.rotation.set(player.pitch,player.yaw,player.roll,'YXZ');
      reflectedPose.set(player.x,player.z,player.yaw,player.pitch);
      frame++;
      for(const {door,left,right} of doorMeshes){
        const offset=door.leafOffset+door.leafTravel*doorProgress(door);
        left.position.x=-offset;
        right.position.x=offset;
      }
      for(let i=0;i<actors.length;i++)characterFrame(actors[i],shadows[i],time,camera,levelName);
      for(const [code,objects] of sectorVisuals){
        const distance=Math.abs(player.z-({'01':-8,'02':-9,'03':-24,'04':-24,'05':-39}[code]));
        for(const object of objects)object.visible=distance<farDistance()*.82;
      }
      for(const bounds of wingSectors)bounds.object.visible=distanceToBounds(bounds,player.x,player.z)<farDistance()*.85;
      extensionFrame?.(player,camera,scene);
      lightFrame(time);
      if(expansion&&warmItems.length)warmFrame(player.x,player.z,2.5);
      renderer.render(scene,camera);
    }
    function setLight(on){flashlight.intensity=on?57:0;}
    const invalidateGpuContents=()=>{restored=true;};
    canvas.addEventListener('webglcontextrestored',invalidateGpuContents);
    function disposeMeshes(root,extraTextures=[]){
      const geometries=new Set(), usedMaterials=new Set();
      const textures=new Set(extraTextures);
      root.traverse(object=>{
        if(!object.isMesh)return;
        geometries.add(object.geometry);
        if(object!==mirror)for(const material of [object.material].flat())usedMaterials.add(material);
      });
      for(const material of usedMaterials){
        for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
        material.dispose();
      }
      for(const texture of textures)texture.dispose();
      for(const geometry of geometries)geometry.dispose();
    }
    function dispose(){
      destroyed=true;
      canvas.removeEventListener('webglcontextrestored',invalidateGpuContents);
      const texturePool=[lighting.texture,mirror.material.uniforms.grain.value];
      for(const maps of materials.values()){
        for(const value of Object.values(maps))if(value?.isTexture)texturePool.push(value);
      }
      disposeMeshes(scene,texturePool);
      island.shadow.dispose();
      warmTarget.dispose();
      warmScene.overrideMaterial.dispose();
      mirror.dispose();
      environment?.dispose();
      renderer.dispose();
    }
    return {draw,resize,setQuality,setDrawDistance,setReflection,setResolution,farDistance:()=>farDistance(),setLight,setRenderScale,dispose,loadExpansion,hasExpansion:()=>Boolean(expansion),expansionProgress:()=>expansionFraction,available:()=>!gl.isContextLost()};
  } catch(error){
    renderer.dispose();
    throw error;
  }
}
