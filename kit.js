import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Small toolkit for building procedural scenery out of the generated textures.
// Static parts are collected per material and merged, so each material costs one draw call.

/**
 * Cooperative scheduling for long loads: call `await slice()` often; it only yields (to the next
 * frame, after it has been drawn) once `budget.ms` of work has run since the last yield, so the
 * game keeps drawing smoothly while scenery is built in the background.
 */
export function createSlicer(budget={ms:6}){
  let started=performance.now();
  const yieldFrame=()=>new Promise(resolve=>{
    if(typeof requestAnimationFrame==='function'&&document.visibilityState!=='hidden')requestAnimationFrame(()=>setTimeout(resolve,0));
    else setTimeout(resolve,0);
  });
  return async function slice(force=false){
    if(!force&&performance.now()-started<budget.ms)return;
    await yieldFrame();
    started=performance.now();
  };
}

export const rng=(seed)=>()=>{
  seed|=0;seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296;
};
function hash(x,y,z){
  let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,1440662683);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967296;
}
function noise3(x,y,z){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);
  const fx=x-xi,fy=y-yi,fz=z-zi;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const c=(dx,dy,dz)=>hash(xi+dx,yi+dy,zi+dz);
  return lerp(
    lerp(lerp(c(0,0,0),c(1,0,0),u),lerp(c(0,1,0),c(1,1,0),u),v),
    lerp(lerp(c(0,0,1),c(1,0,1),u),lerp(c(0,1,1),c(1,1,1),u),v),w);
}
/** Fractal noise in [0,1]. */
export const fbm=(x,y,z)=>noise3(x,y,z)*.55+noise3(x*2.07+11,y*2.07,z*2.07)*.3+noise3(x*4.3,y*4.3+7,z*4.3)*.15;
export const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Box-projected UVs from object-space positions: each face takes the two axes it spans. */
export function planarUV(geo,meters,{swap=false}={}){
  const p=geo.attributes.position,n=geo.attributes.normal;
  const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
    let u,v;
    if(ax>=ay&&ax>=az){u=p.getZ(i);v=p.getY(i);}
    else if(ay>=az){u=p.getX(i);v=p.getZ(i);}
    else{u=p.getX(i);v=p.getY(i);}
    if(swap)[u,v]=[v,u];
    uv[i*2]=u/meters;uv[i*2+1]=v/meters;
  }
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return geo;
}
/** Wraps a whole number of tiles around a cylinder/lathe; caps are projected flat. */
export function roundUV(geo,meters,radius){
  const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
  const tiles=Math.max(1,Math.round(2*Math.PI*radius/meters));
  for(let i=0;i<p.count;i++){
    if(Math.abs(n.getY(i))>.92)uv.setXY(i,p.getX(i)/meters,p.getZ(i)/meters);
    else uv.setXY(i,uv.getX(i)*tiles,p.getY(i)/meters);
  }
  return geo;
}
/** Scale existing 0..1 UVs (planes that show one whole image keep 1,1). */
export function scaleUV(geo,su,sv){
  const uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);
  return geo;
}

export const box=(w,h,d,meters=1,opts)=>planarUV(new THREE.BoxGeometry(w,h,d),meters,opts);
export const cyl=(r,h,meters,{top=r,seg=16}={})=>roundUV(new THREE.CylinderGeometry(top,r,h,seg),meters,r);
export const plane=(w,h)=>new THREE.PlaneGeometry(w,h);

const up=new THREE.Vector3(0,1,0);
/** Transform that stretches a Y-aligned unit-height part from p1 to p2. */
export function between(p1,p2){
  const a=new THREE.Vector3(...p1),b=new THREE.Vector3(...p2);
  const dir=b.clone().sub(a);
  const length=dir.length();
  return {pos:a.add(b).multiplyScalar(.5).toArray(),quat:new THREE.Quaternion().setFromUnitVectors(up,dir.normalize()),length};
}

/** Deform a geometry's vertices with noise along their normal-ish direction from `center`. */
export function lumpy(geo,amount,frequency,seed=0){
  const p=geo.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);
    const len=v.length()||1;
    const d=(fbm(v.x*frequency+seed,v.y*frequency,v.z*frequency)-.5)*2*amount;
    v.multiplyScalar((len+d)/len);
    p.setXYZ(i,v.x,v.y,v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const KEEP=['position','normal','uv'];
// Generated textures that replace materials which used to be plain colours. Until the texture
// exists in the manifest, the old plain material is used, so the scene looks the same as before.
const PLAIN={
  'dark-steel':['steel-dark',{}],
  'rail-steel':['rail-steel',{color:0x55595c,roughness:.4,metalness:.85}],
  'vending-red':['vending-body',{color:0xa8222c,roughness:.35,metalness:.3}],
};
export class Kit{
  constructor(textures){
    this.textures=textures;
    this.materials=new Map();
    this.parts=new Map();
    this.after=[];
  }
  /** Material from a generated texture id; `variant` makes a separate instance with overrides. */
  tex(id,opts={}){
    const key=id+(opts.variant?':'+opts.variant:'');
    if(this.materials.has(key))return this.materials.get(key);
    const t=this.textures.get(id);
    if(!t&&PLAIN[id])return this.plain(...PLAIN[id]);
    const m=new THREE.MeshStandardMaterial({
      name:'Generated '+key,
      color:t?0xffffff:(opts.fallback??0x8a8f92),
      map:t?.map??null,
      normalMap:t?.normalMap??null,
      roughness:opts.roughness??t?.roughness??.8,
      metalness:opts.metalness??t?.metalness??0,
      side:opts.side??THREE.FrontSide,
    });
    const glow=opts.emissive??t?.emissive;
    if(glow){
      m.emissive.set(opts.emissiveColor??0xffffff);
      m.emissiveMap=t?.map??null;
      m.emissiveIntensity=glow;
    }
    if(opts.alpha&&t){m.alphaMap=t.map;m.alphaTest=opts.alpha;}
    if(opts.color)m.color.set(opts.color);
    this.materials.set(key,m);
    return m;
  }
  /** Untextured material (lamps, dark steel). */
  plain(name,{color=0x30353a,roughness=.55,metalness=.6,emissive=null,intensity=1}={}){
    if(this.materials.has(name))return this.materials.get(name);
    const m=new THREE.MeshStandardMaterial({name:'Generated '+name,color,roughness,metalness});
    if(emissive!==null){m.emissive.set(emissive);m.emissiveIntensity=intensity;}
    this.materials.set(name,m);
    return m;
  }
  /**
   * Queue a part. t: {pos, rot:[x,y,z,order], quat, scale, world:meters (world-space box UVs)}.
   */
  add(geo,material,t={}){
    let g=geo.index?geo.toNonIndexed():geo.clone();
    for(const name of Object.keys(g.attributes))if(!KEEP.includes(name))g.deleteAttribute(name);
    if(!g.attributes.normal)g.computeVertexNormals();
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    const m=new THREE.Matrix4();
    const q=t.quat??new THREE.Quaternion().setFromEuler(new THREE.Euler(...(t.rot??[0,0,0]),t.rot?.[3]??'XYZ'));
    const s=Array.isArray(t.scale)?t.scale:[t.scale??1,t.scale??1,t.scale??1];
    m.compose(new THREE.Vector3(...(t.pos??[0,0,0])),q,new THREE.Vector3(...s));
    g.applyMatrix4(m);
    if(t.world)planarUV(g,t.world,{swap:t.swap});
    if(!this.parts.has(material))this.parts.set(material,[]);
    this.parts.get(material).push(g);
    return g;
  }
  /** A straight round member (pipe, post, rail) between two points. */
  beam(p1,p2,r,material,meters=1,seg=8){
    const {pos,quat,length}=between(p1,p2);
    return this.add(roundUV(new THREE.CylinderGeometry(r,r,length,seg),meters,r),material,{pos,quat});
  }
  /** Like build(), but yields between materials so a large merge does not stall a frame. */
  async buildAsync(group,prefix='Generated',slice=async()=>{}){
    for(const [material,geos] of [...this.parts]){
      this.parts.delete(material);
      const merged=mergeGeometries(geos,false);
      if(merged){
        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        const mesh=new THREE.Mesh(merged,material);
        mesh.name=prefix+'_'+material.name.replace(/^Generated /,'').replace(/[^\w-]+/g,'_');
        group.add(mesh);
        for(const fn of this.after)fn(mesh);
      }
      await slice();
    }
  }
  /** Merge everything queued into `group`, one mesh per material. */
  build(group,prefix='Generated'){
    for(const [material,geos] of this.parts){
      const merged=mergeGeometries(geos,false);
      if(!merged)continue;
      merged.computeBoundingSphere();
      const mesh=new THREE.Mesh(merged,material);
      mesh.name=prefix+'_'+material.name.replace(/^Generated /,'').replace(/[^\w-]+/g,'_');
      group.add(mesh);
      for(const fn of this.after)fn(mesh);
    }
    this.parts.clear();
  }
}

/** Canvas texture with a few lines of text (signs, terminal screens). */
export function labelTexture(lines,{width=512,height=256,bg='#0c191c',fg='#d8f1ea',accent='#5fe6c4',border=true}={}){
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  if(border){ctx.strokeStyle=accent;ctx.lineWidth=6;ctx.strokeRect(10,10,width-20,height-20);}
  const family='"Barlow","Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif';
  lines.forEach(([text,size,color],i)=>{
    ctx.fillStyle=color??(i===0?accent:fg);
    ctx.font=`700 ${size}px ${family}`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const y=height*(lines.length===1?.5:(.28+i*(.6/(lines.length-1))));
    ctx.fillText(text,width/2,y,width-48);
  });
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

/** Inspection terminal stand; the screen faces local +Z, rotated by `angle` around Y. */
export function kiosk(kit,group,room,[x,y,z],angle){
  const body=kit.tex('vented-aluminum');
  const holder=new THREE.Group();
  holder.position.set(x,y,z);holder.rotation.y=angle;
  const parts=new Kit(kit.textures);
  parts.materials=kit.materials;
  parts.add(box(.5,1.0,.32,1),body,{pos:[0,.5,0]});
  parts.add(box(.64,.46,.12,1),body,{pos:[0,1.12,.06],rot:[-.45,0,0]});
  parts.build(holder,'Kiosk');
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.54,.36),new THREE.MeshBasicMaterial({
    map:labelTexture([[`B4 / ${room.code}`,58],[room.name,52],['点検端末',34,'#9fb9b3']]),toneMapped:false,
  }));
  screen.name='Kiosk screen '+room.code;
  screen.position.set(0,1.12+Math.sin(.45)*.07,.06+Math.cos(.45)*.065);
  screen.rotation.x=-.45;
  holder.add(screen);
  group.add(holder);
}

/** A flat sign facing local +Z. */
export function sign(group,lines,[x,y,z],angle,[w,h],opts){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:labelTexture(lines,opts),toneMapped:false}));
  mesh.name='Sign';
  mesh.position.set(x,y,z);mesh.rotation.y=angle;
  group.add(mesh);
  return mesh;
}

/** Sliding door: an Object3D per leaf named for render.js's door binding (`Portal <code> left/right`). */
export function slidingDoor(group,code,{x,y=0,z,axis,width,height},buildLeaf){
  const frame=new THREE.Group();
  frame.name='Portal '+code;
  frame.position.set(x,y,z);
  if(axis==='x')frame.rotation.y=-Math.PI/2;
  for(const side of ['left','right']){
    const leaf=new THREE.Group();
    leaf.name=`Portal ${code} ${side}`;
    leaf.position.x=(side==='left'?-1:1)*width/4;
    buildLeaf(leaf,width/2,height,side);
    frame.add(leaf);
  }
  group.add(frame);
  return frame;
}

// ---------- arched tunnels ----------

export function profile(t){
  const pts=[[t.half,0],[t.half,t.wall]];
  for(let k=1;k<16;k++){const a=k/16*Math.PI;pts.push([t.half*Math.cos(a),t.wall+(t.crown-t.wall)*Math.sin(a)]);}
  pts.push([-t.half,t.wall],[-t.half,0]);
  return pts;
}
/** Arched tunnel lining from local z1 to z2. */
export function tube(t,z1,z2,meters=3){
  const prof=profile(t),len=[0];
  for(let k=1;k<prof.length;k++)len.push(len[k-1]+Math.hypot(prof[k][0]-prof[k-1][0],prof[k][1]-prof[k-1][1]));
  const steps=Math.max(2,Math.ceil((z2-z1)/.8)),pos=[],uv=[],index=[];
  for(let s=0;s<=steps;s++){
    const z=z1+(z2-z1)*s/steps;
    prof.forEach(([x,y],k)=>{pos.push(x,y,z);uv.push(len[k]/meters,z/meters);});
  }
  const n=prof.length;
  for(let s=0;s<steps;s++)for(let k=0;k<n-1;k++){
    const a=s*n+k,b=a+n;
    index.push(a,a+1,b,a+1,b+1,b);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
/** Flat ring around a tunnel mouth that hides the rough edge of the rock opening. */
export function collar(t,grow,meters){
  const inner=profile(t),outer=profile({half:t.half+grow,wall:t.wall+grow*.6,crown:t.crown+grow});
  const pts=[[-(t.half+grow),0],...inner.slice().reverse(),[t.half+grow,0],...outer.slice(1)];
  return planarUV(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x,y)))),meters);
}
/** Tunnel end wall with a rectangular opening. */
export function bulkhead(t,open,meters){
  const p=profile(t);
  const pts=[[-t.half,0],[-open.half,0],[-open.half,open.h],[open.half,open.h],[open.half,0],...p.slice(0,-1)];
  return planarUV(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x,y)))),meters);
}
