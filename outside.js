import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,scaleUV,lumpy,smoothstep,rng,kiosk,sign,blobGeometry} from './kit.js';
import {
  Y,INCLINE,YARD,STREAM,RIVER,BRIDGE,FOOTBRIDGE,ROADS,HQ,PLAZA,PARKING,HELIPAD,PADDIES,TEMPLE,TREES,
  HQ_ZONE,RIVER_ZONE,VILLAGE,PLATEAU,groundHeight as G,inclineFloor,fbm2,inRect,
} from './outdoor-layout.js';
import {lantern} from './surface.js';

// The wider outdoor world above the facility (zones 20-23) plus the shared terrain, water, trees and sky.
const P=(room,type)=>room.props.filter(p=>p.type===type);
const HAZE=new THREE.Color(0xc4d1da),SKY=new THREE.Color(0x9fc3e6);

/** Builds the open-air world; `slice` (kit.js createSlicer) is awaited between the parts. */
export async function buildOutside(kit,group,slice=async()=>{},onStep=null){
  const R=rng(20);
  const parts=[
    ['terrain',()=>terrain(kit,slice)],
    ['water',()=>water(kit)],
    ['roads',()=>roads(kit)],
    ['headquarters',()=>headquarters(kit,group)],
    ['plaza',()=>plaza(kit,group,R)],
    ['parking',()=>parking(kit)],
    ['plateau',()=>plateau(kit,group,R)],
    ['river',()=>river(kit,R)],
    ['village',()=>village(kit,group,R)],
    ['trees',()=>trees(kit,R,slice)],
    ['kiosks',()=>{
      kiosk(kit,group,HQ_ZONE,[HQ_ZONE.terminal[0],HQ_ZONE.terminalY,HQ_ZONE.terminal[1]],Math.PI);
      kiosk(kit,group,RIVER_ZONE,[RIVER_ZONE.terminal[0],RIVER_ZONE.terminalY,RIVER_ZONE.terminal[1]],-Math.PI/2);
      kiosk(kit,group,VILLAGE,[VILLAGE.terminal[0],VILLAGE.terminalY,VILLAGE.terminal[1]],-Math.PI/2);
      kiosk(kit,group,PLATEAU,[PLATEAU.terminal[0],PLATEAU.terminalY,PLATEAU.terminal[1]],Math.PI);
    }],
  ];
  for(const [name,part] of parts){
    const t=performance.now();
    await part();
    onStep?.('outside/'+name,performance.now()-t);
    await slice();
  }
  return sky(group);
}

// ---------- helpers ----------
/** A strip that follows the ground along a polyline: u across (0..1 * across), v along (metres / meters). */
function ribbon(kit,material,points,width,{lift=.03,meters=2,across=1,height=null,step=1.5}={}){
  const pts=[];
  for(let i=0;i<points.length-1;i++){
    const [ax,az]=points[i],[bx,bz]=points[i+1],n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/step));
    for(let k=0;k<n;k++)pts.push([ax+(bx-ax)*k/n,az+(bz-az)*k/n]);
  }
  pts.push(points.at(-1));
  const pos=[],uv=[],index=[];let along=0;
  pts.forEach(([x,z],i)=>{
    const [px,pz]=pts[Math.max(0,i-1)],[nx,nz]=pts[Math.min(pts.length-1,i+1)];
    let dx=nx-px,dz=nz-pz;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
    if(i>0)along+=Math.hypot(x-pts[i-1][0],z-pts[i-1][1]);
    for(const s of [-1,1]){
      const vx=x-dz*s*width/2,vz=z+dx*s*width/2;
      pos.push(vx,(height?height(vx,vz):G(vx,vz))+lift,vz);uv.push((s+1)/2*across,along/meters);
    }
    if(i>0){const a=(i-1)*2;index.push(a,a+2,a+1,a+1,a+2,a+3);}
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(index);g.computeVertexNormals();
  const n=g.attributes.normal;for(let i=0;i<n.count;i++)if(n.getY(i)<0)n.setXYZ(i,-n.getX(i),-n.getY(i),-n.getZ(i));
  return kit.add(g,material);
}
function hipRoof(kit,material,{x1,x2,z1,z2,eave,ridge,over=.6,meters=2}){
  const a=[x1-over,z1-over],b=[x2+over,z1-over],c=[x2+over,z2+over],d=[x1-over,z2+over];
  const inset=Math.min((z2-z1)/2+over,(x2-x1)/2+over)*.9,cz=(z1+z2)/2;
  const r1=[x1-over+inset,cz],r2=[x2+over-inset,cz];
  const v=([x,z],y)=>[x,y,z],E=p=>v(p,eave),T=p=>v(p,ridge);
  const tris=[[E(a),T(r1),E(b)],[E(b),T(r1),T(r2)],[E(b),T(r2),E(c)],[E(c),T(r2),E(d)],[E(d),T(r2),T(r1)],[E(d),T(r1),E(a)]];
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(tris.flat(2),3));
  g.computeVertexNormals();
  kit.add(g,material,{world:meters});
  kit.add(box(x2-x1+over*2-inset*2+.4,.3,.5),kit.tex('kokera-shingle'),{pos:[(x1+x2)/2,ridge+.12,cz],world:1.2});
}
function walls(kit,material,{x1,x2,z1,z2,y1,y2,t=.2,world=1.2}){
  const cx=(x1+x2)/2,cz=(z1+z2)/2,h=y2-y1,y=(y1+y2)/2;
  kit.add(box(x2-x1,h,t),material,{pos:[cx,y,z1+t/2],world});
  kit.add(box(x2-x1,h,t),material,{pos:[cx,y,z2-t/2],world});
  kit.add(box(t,h,z2-z1-2*t),material,{pos:[x1+t/2,y,cz],world});
  kit.add(box(t,h,z2-z1-2*t),material,{pos:[x2-t/2,y,cz],world});
}
const leafy=(kit,id,[x,y,z],[sx,sy,sz],seed)=>kit.add(planarUV(lumpy(blobGeometry(),.3,2.2,seed),1),kit.tex(id,{variant:'leaf',side:THREE.DoubleSide}),{pos:[x,y,z],scale:[sx,sy,sz]});

// ---------- terrain ----------
async function terrain(kit,slice=async()=>{}){
  const x1=-72,x2=142,z1=136,z2=348,step=2,nx=(x2-x1)/step,nz=(z2-z1)/step;
  const H=new Float32Array((nx+1)*(nz+1));
  for(let j=0;j<=nz;j++){
    for(let i=0;i<=nx;i++)H[j*(nx+1)+i]=G(x1+i*step,z1+j*step);
    await slice();
  }
  const h=(i,j)=>H[Math.min(nz,Math.max(0,j))*(nx+1)+Math.min(nx,Math.max(0,i))];
  const normal=(i,j)=>{const v=new THREE.Vector3(h(i-1,j)-h(i+1,j),2*step,h(i,j-1)-h(i,j+1));return v.normalize();};
  const buckets={};
  const push=(key,verts)=>(buckets[key]??=[]).push(...verts);
  const crown=z=>inclineFloor(z)+INCLINE.crown+.4;
  const trail=[[92,200],[96,192],[100,186],[104,181],[108,178.5]],temple=[[-41,300],[-41,312],[-41,319.5]];
  const nearPath=(x,z,path,w)=>path.some(([ax,az],k)=>{if(!k)return false;const [bx,bz]=path[k-1],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-dx*t,z-az-dz*t)<w;});
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    if(i===0)await slice();
    const xa=x1+i*step,za=z1+j*step,cx=xa+step/2,cz=za+step/2;
    const q=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]];
    if(cz<YARD.z1+.6&&Math.abs(cx-INCLINE.x)<3.2&&q.some(([a,b])=>h(a,b)<crown(z1+b*step)))continue;
    const hs=q.map(([a,b])=>h(a,b)),slope=(Math.max(...hs)-Math.min(...hs))/step;
    const dzr=cx>RIVER.x1-3?Math.abs(cz-RIVER.z(cx)):99,s=Math.abs(cx-STREAM.x);
    let key;
    if(cz<YARD.z1)key=cz>YARD.z1-6?'hillside-soil':'meadow-grass';
    else if(slope>1.0)key='rocky-cliff';
    else if(dzr<RIVER.bank+.5)key='river-sand';
    else if(s<.9&&cz<STREAM.z2)key='river-pebbles';
    else if(s<2.4&&cz<STREAM.z2)key='moss-ground';
    else if(slope>.55)key='scree-slope';
    else if(nearPath(cx,cz,trail,1.1)||nearPath(cx,cz,[[-30,313.8],[1,313.8]],.9)||nearPath(cx,cz,[[2.6,298],[2.6,329]],.9))key='mountain-trail';
    else if(nearPath(cx,cz,temple,1.4))key='stone-steps';
    else if(PADDIES.some(p=>inRect(p,cx,cz)))key='field-soil';
    else if(inRect({x1:80,x2:112,z1:296,z2:326},cx,cz))key='tea-rows';
    else if(inRect({x1:64,x2:76,z1:302,z2:312},cx,cz))key='field-soil';
    else if(inRect(YARD,cx,cz,1)||inRect({x1:-22,x2:66,z1:194,z2:262},cx,cz))key='grass-field';
    else if(cz>318&&cx<-30)key='forest-floor';
    else key=fbm2(cx*.06,cz*.06)>.52?'forest-floor':'meadow-grass';
    const vert=([a,b])=>[x1+a*step,h(a,b),z1+b*step];
    // one bucket per surface and 24 m chunk, so far terrain is culled with the rest of its chunk
    key+='|'+Math.floor(cx/24)+','+Math.floor(cz/24);
    push(key,[q[0],q[3],q[1],q[1],q[3],q[2]].map(([a,b])=>({p:vert([a,b]),n:normal(a,b)})));
  }
  for(const [bucket,vs] of Object.entries(buckets)){
    const id=bucket.split('|')[0];
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vs.flatMap(v=>v.p),3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(vs.flatMap(v=>[v.n.x,v.n.y,v.n.z]),3));
    const meters={'rocky-cliff':4,'tea-rows':2,'stone-steps':1.5,'river-pebbles':1,'moss-ground':1,'mountain-trail':1.5}[id]??2;
    const uv=new Float32Array(vs.length*2);
    vs.forEach((v,k)=>{
      if(id==='rocky-cliff'){uv[k*2]=(v.p[0]+v.p[2])/meters;uv[k*2+1]=v.p[1]/meters;}
      else{uv[k*2]=v.p[0]/meters;uv[k*2+1]=v.p[2]/meters;}
    });
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    kit.add(g,kit.tex(id));
    await slice();
  }
}

// ---------- water: river, waterfall, stream, paddies ----------
function water(kit){
  const pos=[],index=[],w=RIVER.half+1.4;
  for(let x=RIVER.x1-2.5,k=0;x<=144;x+=2,k++){
    const z=RIVER.z(x);pos.push(x,RIVER.water,z-w,x,RIVER.water,z+w);
    if(k)index.push((k-1)*2,(k-1)*2+1,k*2,(k-1)*2+1,k*2+1,k*2);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(index);g.computeVertexNormals();
  kit.add(g,kit.tex('river-water'),{world:3});
  const zc=RIVER.z(RIVER.x1),top=G(RIVER.x1-2.2,zc)+.2;
  for(const [dx,w] of [[-1.3,8],[-1.0,5.5]])
    kit.add(scaleUV(new THREE.PlaneGeometry(w,top-RIVER.water+.4),w/3,(top-RIVER.water)/3),kit.tex('waterfall',{side:THREE.DoubleSide}),{pos:[RIVER.x1+dx,(top+RIVER.water)/2-.2,zc],rot:[0,Math.PI/2,0]});
  for(let i=0;i<6;i++)kit.add(planarUV(lumpy(blobGeometry(),.35,2.5,i),1),kit.tex('waterfall',{variant:'foam',emissive:.4}),{pos:[RIVER.x1+.4+i*.5,RIVER.water+.15,zc-2.4+i*.9],scale:[.9,.35,.8]});
  const stream=new THREE.PlaneGeometry(1.9,STREAM.z2-STREAM.z1);stream.rotateX(-Math.PI/2);
  kit.add(stream,kit.tex('stream-water'),{pos:[STREAM.x,STREAM.y,(STREAM.z1+STREAM.z2)/2],world:1.5});
  for(const p of PADDIES){
    kit.add(new THREE.PlaneGeometry(p.x2-p.x1,p.z2-p.z1),kit.tex('rice-paddy'),{pos:[(p.x1+p.x2)/2,p.y,(p.z1+p.z2)/2],rot:[-Math.PI/2,0,0],world:3});
    for(const [cx,cz,ww,dd] of [[(p.x1+p.x2)/2,p.z1,p.x2-p.x1+.6,.4],[(p.x1+p.x2)/2,p.z2,p.x2-p.x1+.6,.4],[p.x1,(p.z1+p.z2)/2,.4,p.z2-p.z1],[p.x2,(p.z1+p.z2)/2,.4,p.z2-p.z1]])
      kit.add(box(ww,.3,dd),kit.tex('field-soil',{variant:'bund'}),{pos:[cx,p.y+.05,cz],world:1.5});
    const low=G((p.x1+p.x2)/2,p.z1-3.2);
    if(p.y-low>.4)kit.add(box(p.x2-p.x1+.6,p.y-low+.3,.5),kit.tex('ishigaki'),{pos:[(p.x1+p.x2)/2,(p.y+low)/2-.05,p.z1-.45],world:2});
  }
}

// ---------- roads, bridge and street furniture ----------
function roads(kit){
  const asphalt=kit.tex('asphalt-road'),curb=kit.tex('curb-granite'),galv=kit.tex('galvanized-spangle');
  kit.add(box(ROADS[0].x2-ROADS[0].x1,.04,ROADS[0].z2-ROADS[0].z1),asphalt,{pos:[24,Y+.02,(ROADS[0].z1+ROADS[0].z2)/2],world:2});
  kit.add(box(ROADS[1].x2-ROADS[1].x1,.04,6),asphalt,{pos:[(ROADS[1].x1+ROADS[1].x2)/2,Y+.025,208],world:2});
  ribbon(kit,asphalt,[[44,211],[44,BRIDGE.z1+.2]],6,{lift:.04,meters:2,across:3,height:(x,z)=>G(44,z)});
  ribbon(kit,asphalt,[[44,BRIDGE.z2-.2],[44,338]],6,{lift:.04,meters:2,across:3,height:(x,z)=>G(44,z)});
  ribbon(kit,kit.tex('road-marking'),[[44,211],[44,BRIDGE.z1+.2]],2,{lift:.05,meters:2,height:(x,z)=>G(44,z)});
  ribbon(kit,kit.tex('road-marking'),[[44,BRIDGE.z2-.2],[44,338]],2,{lift:.05,meters:2,height:(x,z)=>G(44,z)});
  kit.add(scaleUV(new THREE.PlaneGeometry(2,ROADS[1].x2-ROADS[1].x1),1,(ROADS[1].x2-ROADS[1].x1)/2),kit.tex('road-marking'),{pos:[(ROADS[1].x1+ROADS[1].x2)/2,Y+.05,208],rot:[-Math.PI/2,0,Math.PI/2]});
  // curbs, tactile paving and gutters along the avenue
  for(const z of [204.85,211.15])kit.add(box(ROADS[1].x2-ROADS[1].x1,.18,.3),curb,{pos:[(ROADS[1].x1+ROADS[1].x2)/2,Y+.09,z],world:1});
  kit.add(box(ROADS[1].x2-ROADS[1].x1,.03,1.6),kit.tex('granite-paving',{variant:'walk'}),{pos:[(ROADS[1].x1+ROADS[1].x2)/2,Y+.03,212.1],world:2});
  kit.add(box(ROADS[1].x2-ROADS[1].x1,.035,.3),kit.tex('tactile-paving'),{pos:[(ROADS[1].x1+ROADS[1].x2)/2,Y+.035,212.3],world:.6});
  kit.add(box(.3,.035,21),kit.tex('tactile-paving'),{pos:[20,Y+.04,222.5],world:.6});
  for(let x=ROADS[1].x1+3;x<ROADS[1].x2;x+=8)if(x<20||x>28)kit.add(new THREE.PlaneGeometry(.6,.45),kit.tex('gutter-grate'),{pos:[x,Y+.032,205.2],rot:[-Math.PI/2,0,0]});
  // guardrails beside the north road where the ground drops to the river
  for(const side of [40.6,47.4])for(const [a,b] of [[262,BRIDGE.z1],[BRIDGE.z2,300]]){
    const pts=[];for(let z=a;z<=b;z+=2)pts.push(z);
    for(const z of pts)kit.beam([side,G(44,z),z],[side,G(44,z)+.8,z],.05,galv,1,6);
  }
  for(const side of [40.6,47.4])for(const [a,b] of [[262,BRIDGE.z1],[BRIDGE.z2,300]]){
    const g=new THREE.PlaneGeometry(b-a,.32,Math.ceil((b-a)/2),1);
    const p=g.attributes.position;for(let i=0;i<p.count;i++){const z=a+(p.getX(i)+(b-a)/2);p.setXYZ(i,0,G(44,z)+.68+p.getY(i),z);}
    g.computeVertexNormals();
    kit.add(planarUV(g,2,{swap:false}),kit.tex('guardrail',{variant:'beam',side:THREE.DoubleSide}),{pos:[side,0,0]});
  }
  // streetlights
  for(const p of P(HQ_ZONE,'streetlight')){
    const y=G(p.x,p.z),toward=p.z<213?-1:-1,arm=p.z<213?[0,-1.4]:[-1.4,0];
    kit.beam([p.x,y,p.z],[p.x,y+6.5,p.z],.08,galv,1,10);
    kit.beam([p.x,y+6.4,p.z],[p.x+arm[0],y+6.6,p.z+arm[1]],.05,galv,1,8);
    kit.add(box(.5,.12,.3,1),kit.plain('lamp-warm'),{pos:[p.x+arm[0],y+6.55,p.z+arm[1]],rot:[0,arm[0]?0:Math.PI/2,0]});
    void toward;
  }
  bridge(kit);
}

function bridge(kit){
  const b=BRIDGE,green=kit.tex('truss-green'),len=b.z2-b.z1,cz=(b.z1+b.z2)/2;
  kit.add(box(b.x2-b.x1,.35,len),kit.tex('bridge-deck'),{pos:[44,b.y-.175,cz],world:2});
  kit.add(scaleUV(new THREE.PlaneGeometry(2,len),1,len/2),kit.tex('road-marking'),{pos:[44,b.y+.01,cz],rot:[-Math.PI/2,0,0]});
  const top=b.y+5.2,panels=6,step=len/panels;
  for(const x of [b.x1+.15,b.x2-.15]){
    kit.add(box(.35,.45,len),green,{pos:[x,b.y+.2,cz],world:1});
    kit.add(box(.35,.4,len-step*2),green,{pos:[x,top,cz],world:1});
    for(let i=0;i<=panels;i++){
      const z=b.z1+i*step,inner=i>0&&i<panels;
      if(inner)kit.beam([x,b.y,z],[x,top,z],.14,green,1,4);
      if(i<panels/2)kit.beam([x,b.y,z],[x,top,z+step],.12,green,1,4);
      else if(i<panels)kit.beam([x,top,z],[x,b.y,z+step],.12,green,1,4);
    }
  }
  for(let i=1;i<panels;i++){const z=b.z1+i*step;kit.beam([b.x1+.15,top,z],[b.x2-.15,top,z],.1,green,1,4);}
  for(const z of [b.z1+step,b.z2-step])kit.beam([b.x1+.15,top-1.2,z],[b.x2-.15,top-1.2,z],.08,green,1,4);
  const conc=kit.tex('retaining-concrete');
  for(const z of [b.z1,b.z2]){const ground=G(44,z)-.3;kit.add(box(b.x2-b.x1+1.2,b.y-RIVER.bed+.3,1.6),conc,{pos:[44,(b.y+RIVER.bed)/2-.3,z+(z===b.z1?-.3:.3)],world:2});void ground;}
  kit.add(box(2.2,b.y-RIVER.bed-.3,3.4),conc,{pos:[44,(b.y+RIVER.bed)/2-.4,RIVER.z(44)],world:2});
  // wooden footbridge
  const f=FOOTBRIDGE,flen=f.z2-f.z1,fz=(f.z1+f.z2)/2,wood=kit.tex('timber-beam');
  kit.add(box(f.x2-f.x1,.12,flen),kit.tex('pier-planks'),{pos:[(f.x1+f.x2)/2,f.y-.06,fz],world:2});
  for(const x of [f.x1+.08,f.x2-.08]){
    for(let z=f.z1;z<=f.z2+.01;z+=flen/6)kit.add(box(.12,1.0,.12,1,{swap:true}),wood,{pos:[x,f.y+.5,z]});
    const rope=new THREE.CatmullRomCurve3([[x,f.y+.95,f.z1],[x,f.y+.8,fz],[x,f.y+.95,f.z2]].map(v=>new THREE.Vector3(...v)));
    kit.add(scaleUV(new THREE.TubeGeometry(rope,24,.03,6),flen/.3,1),kit.tex('nylon-rope'));
  }
  for(const z of [f.z1+2.5,f.z2-2.5])kit.add(box(1.0,f.y-RIVER.bed,1.0),wood,{pos:[-14,(f.y+RIVER.bed)/2-.1,z]});
}

// ---------- headquarters building ----------
function headquarters(kit,group){
  const {x1,x2,z1,z2,height:H}=HQ,concrete=kit.tex('facade-concrete'),glass=kit.tex('curtain-wall'),white=kit.tex('white-composite');
  const cx=(x1+x2)/2,cz=(z1+z2)/2;
  for(const [a,b] of [[x1,14],[26,x2]]){
    kit.add(box(b-a,H,z2-z1),concrete,{pos:[(a+b)/2,Y+H/2,cz],world:3});
    for(const y of [1.3,5.7,10.1]){
      kit.add(box(b-a-1.2,2.2,.05),glass,{pos:[(a+b)/2,Y+y+1.1,z1-.03],world:3});
      kit.add(box(b-a-1.2,2.2,.05),glass,{pos:[(a+b)/2,Y+y+1.1,z2+.03],world:3});
      kit.add(box(.05,2.2,z2-z1-1.2),glass,{pos:[a===x1?x1-.03:x2+.03,Y+y+1.1,cz],world:3});
    }
  }
  kit.add(box(12,H+1.2,z2-z1-2),glass,{pos:[20,Y+(H+1.2)/2,cz],world:3});
  for(const y of [4.4,8.8,13.2])kit.add(box(12.1,.25,z2-z1-1.9),white,{pos:[20,Y+y,cz],world:2});
  const louver=kit.tex('metal-louver');
  for(const y of [1.3,5.7,10.1])kit.add(box(8.2,2.4,.12),louver,{pos:[31,Y+y+1.1,z1-.12],world:1});
  for(const y of [1.3,5.7,10.1])kit.add(box(.12,2.4,16),louver,{pos:[x2+.12,Y+y+1.1,cz],world:1});
  for(const [px,pz,w,d] of [[cx,z1-.05,x2-x1+.3,.3],[cx,z2+.05,x2-x1+.3,.3],[x1-.05,cz,.3,z2-z1+.3],[x2+.05,cz,.3,z2-z1+.3]])
    kit.add(box(w,1.0,d),white,{pos:[px,Y+H+.5,pz],world:2});
  kit.add(box(x2-x1-.6,.1,z2-z1-.6),kit.tex('sedum-roof'),{pos:[cx,Y+H+.05,cz],world:2});
  for(const [x,z] of [[9,250],[31,252],[28,244]])kit.add(box(2.4,1.4,1.6,1),kit.tex('vent-louvre'),{pos:[x,Y+H+.75,z]});
  kit.beam([10,Y+H,244],[10,Y+H+6,244],.06,kit.tex('galvanized-spangle'));
  // entrance canopy, doors and sign
  kit.add(box(11.4,.28,6.4),white,{pos:[20,Y+4.3,236.8],world:2});
  for(const p of P(HQ_ZONE,'canopy-column'))kit.beam([p.x,Y,p.z],[p.x,Y+4.2,p.z],.14,kit.tex('brushed-stainless'),.6,12);
  kit.add(box(3.6,2.6,.06),kit.tex('frosted-film'),{pos:[20,Y+1.3,z1-.06],world:1});
  sign(group,[['STRATA B4  地下研究所',62],['STRATA B4 UNDERGROUND RESEARCH INSTITUTE',26]],[20,Y+4.3,233.58],Math.PI,[7.2,.6],{width:1200,height:100,border:false,bg:'#f2f4f2',fg:'#25403a',accent:'#1c6b5c'});
  // flags
  for(const p of P(HQ_ZONE,'flagpole')){
    kit.beam([p.x,Y,p.z],[p.x,Y+9,p.z],.06,kit.tex('brushed-stainless'),.6,10);
    kit.add(new THREE.PlaneGeometry(1.8,1.2),kit.tex('flag-fabric',{side:THREE.DoubleSide}),{pos:[p.x-.95,Y+8.3,p.z],rot:[0,.15,0]});
  }
}

// ---------- plaza ----------
function plaza(kit,group,R){
  const p=PLAZA,granite=kit.tex('granite-paving');
  kit.add(box(p.x2-p.x1,.04,p.z2-p.z1),granite,{pos:[(p.x1+p.x2)/2,Y+.02,(p.z1+p.z2)/2],world:2});
  const f=P(HQ_ZONE,'fountain')[0],stone=kit.tex('facade-concrete',{variant:'stone'});
  kit.add(cyl(3.2,.6,2,{seg:40}),stone,{pos:[f.x,Y+.3,f.z]});
  kit.add(cyl(2.85,.04,1.5,{seg:40}),kit.tex('fountain-water'),{pos:[f.x,Y+.52,f.z]});
  kit.add(cyl(.6,1.1,1,{seg:20}),stone,{pos:[f.x,Y+.55,f.z]});
  kit.add(cyl(.12,1.6,.5,{top:.05,seg:12}),kit.tex('fountain-water',{variant:'jet',emissive:.35}),{pos:[f.x,Y+1.9,f.z]});
  kit.add(planarUV(lumpy(blobGeometry(),.3,3,1),.5),kit.tex('fountain-water',{variant:'jet'}),{pos:[f.x,Y+2.75,f.z],scale:[.35,.25,.35]});
  for(const b of P(HQ_ZONE,'bench')){
    kit.add(box(1.8,.06,.45,1),kit.tex('picnic-wood'),{pos:[b.x,Y+.45,b.z]});
    for(const dx of [-.75,.75])kit.add(box(.06,.43,.4,1),kit.tex('brushed-stainless'),{pos:[b.x+dx,Y+.22,b.z]});
  }
  for(const pl of P(HQ_ZONE,'planter')){
    kit.add(box(pl.w,.6,pl.d,1),kit.tex('white-composite'),{pos:[pl.x,Y+.3,pl.z]});
    for(let i=0;i<5;i++)leafy(kit,'hydrangea',[pl.x-pl.w/2+.7+i*(pl.w-1.4)/4,Y+.85,pl.z],[.75,.5,.5],i+pl.x);
  }
  for(const t of TREES.filter(t=>t.kind==='sakura'&&inRect(p,t.x,t.z,1)))kit.add(cyl(1.0,.5,1,{seg:20}),kit.tex('stone-masonry'),{pos:[t.x,Y+.25,t.z]});
  const m=P(HQ_ZONE,'monolith')[0];
  kit.add(box(2.4,1.7,.5,3),kit.tex('facade-concrete'),{pos:[m.x,Y+.85,m.z]});
  sign(group,[['STRATA B4',90],['地下研究所 本館',48]],[m.x,Y+1.0,m.z-.26],Math.PI,[2.2,1.2],{width:600,height:330,border:false,bg:'#2b3533',fg:'#e7efe9',accent:'#7fe0c6'});
  // helipad with edge lights and a wind sock
  const hp=HELIPAD;
  kit.add(new THREE.PlaneGeometry(hp.size,hp.size),kit.tex('helipad'),{pos:[hp.x,Y+.04,hp.z],rot:[-Math.PI/2,0,0]});
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;kit.add(cyl(.08,.12,.3,{seg:8}),kit.plain('lamp-amber'),{pos:[hp.x+Math.cos(a)*7.2,Y+.06,hp.z+Math.sin(a)*7.2]});}
  kit.beam([hp.x-8.6,Y,hp.z+6],[hp.x-8.6,Y+5,hp.z+6],.05,kit.tex('galvanized-spangle'));
  kit.add(roundUV(new THREE.CylinderGeometry(.18,.38,1.6,12,1,true),.5,.3),kit.tex('orange-plastic',{variant:'sock',side:THREE.DoubleSide}),{pos:[hp.x-7.8,Y+4.8,hp.z+6],rot:[0,0,Math.PI/2+.2]});
  void R;
}

// ---------- parking ----------
function parking(kit){
  const p=PARKING;
  kit.add(box(p.x2-p.x1,.04,p.z2-p.z1),kit.tex('parking-lines'),{pos:[(p.x1+p.x2)/2,Y+.025,(p.z1+p.z2)/2],world:15.5,swap:true});
  for(const z of [p.z1-.15,p.z2+.15])kit.add(box(p.x2-p.x1,.18,.3),kit.tex('curb-granite'),{pos:[(p.x1+p.x2)/2,Y+.09,z],world:1});
  P(HQ_ZONE,'car').forEach((c,i)=>car(kit,c.x,c.z,i%3===1?'car-red':'car-white',c.x<57?0:Math.PI));
}
function car(kit,x,z,paint,angle){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,angle,0));
  const at=(dx,dy,dz)=>new THREE.Vector3(dx,dy,dz).applyQuaternion(q).add(new THREE.Vector3(x,Y,z)).toArray();
  const body=kit.tex(paint),glass=kit.tex('car-glass'),tire=kit.tex('tire-rubber');
  kit.add(box(4.3,.7,1.75,1),body,{pos:at(0,.6,0),quat:q});
  kit.add(box(2.3,.62,1.6,1),glass,{pos:at(-.2,1.25,0),quat:q});
  kit.add(box(2.1,.06,1.5,1),body,{pos:at(-.25,1.58,0),quat:q});
  for(const dx of [-1.35,1.35])for(const dz of [-.82,.82])kit.add(roundUV(new THREE.CylinderGeometry(.32,.32,.22,16),.6,.32),tire,{pos:at(dx,.32,dz),quat:q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)))});
  for(const dz of [-.6,.6]){
    kit.add(box(.05,.12,.3,1),kit.plain('headlight',{color:0xfff8e8,emissive:0xfff4d8,intensity:.8,metalness:0}),{pos:at(2.16,.75,dz),quat:q});
    kit.add(box(.05,.12,.3,1),kit.plain('taillight',{color:0x8a1010,emissive:0xc01818,intensity:.6,metalness:0}),{pos:at(-2.16,.75,dz),quat:q});
  }
}

// ---------- east plateau: power, radar, ventilation, lookout and campsite ----------
function plateau(kit,group,R){
  const galv=kit.tex('galvanized-spangle'),wire=kit.plain('wire',{color:0x111315,roughness:.5,metalness:.3});
  const s=P(PLATEAU,'substation')[0],sy=G(s.x,s.z);
  kit.add(box(s.w,.05,s.d),kit.tex('gravel-yard'),{pos:[s.x,sy+.03,s.z],world:1.5});
  const fence=kit.tex('palisade-fence',{variant:'mesh',alpha:.35,side:THREE.DoubleSide});
  for(const [cx,cz,len,rot] of [[s.x,s.z-s.d/2,s.w,0],[s.x,s.z+s.d/2,s.w,0],[s.x-s.w/2,s.z,s.d,Math.PI/2],[s.x+s.w/2,s.z,s.d,Math.PI/2]])
    kit.add(scaleUV(new THREE.PlaneGeometry(len,2.4),len/1.5,1.6),fence,{pos:[cx,sy+1.2,cz],rot:[0,rot,0]});
  for(let i=0;i<3;i++){
    const tx=s.x-5+i*5,tz=s.z+1;
    kit.add(box(2.6,2.4,1.8,1),kit.tex('transformer-fins'),{pos:[tx,sy+1.2,tz]});
    kit.add(box(2.8,.2,2.0,1),kit.tex('facade-concrete'),{pos:[tx,sy+.1,tz]});
    for(const dx of [-.8,0,.8])kit.add(roundUV(new THREE.CylinderGeometry(.13,.16,.8,12),.4,.15),kit.tex('insulator-ceramic'),{pos:[tx+dx,sy+2.8,tz]});
  }
  for(const gx of [s.x-7,s.x+7])for(const gz of [s.z-5,s.z+5])kit.beam([gx,sy,gz],[gx,sy+8,gz],.15,galv,1,4);
  for(const gz of [s.z-5,s.z+5])kit.beam([s.x-7,sy+8,gz],[s.x+7,sy+8,gz],.12,galv,1,4);
  for(const dx of [-3,0,3])for(const gz of [s.z-5,s.z+5])kit.add(roundUV(new THREE.CylinderGeometry(.1,.12,.7,10),.4,.12),kit.tex('insulator-ceramic'),{pos:[s.x+dx,sy+7.6,gz]});
  for(const dx of [-3,0,3]){kit.beam([s.x+dx,sy+7.3,s.z-5],[s.x+dx,sy+7.3,s.z+5],.015,wire);kit.beam([s.x+dx,sy+7.3,s.z-5],[s.x+dx,sy+16,s.z-40],.015,wire);}
  // solar rows
  for(const p of P(PLATEAU,'solar')){
    const y=G(p.x,p.z);
    kit.add(box(p.w-.4,.06,1.9,1.6),kit.tex('solar-cells'),{pos:[p.x,y+1.25,p.z],rot:[-.45,0,0]});
    for(let x=p.x-p.w/2+1;x<p.x+p.w/2;x+=4)for(const dz of [-.6,.6])kit.beam([x,y,p.z+dz],[x,y+1.25-dz*.45,p.z+dz],.05,galv,1,6);
  }
  // water tower
  const w=P(PLATEAU,'water-tower')[0],wy=G(w.x,w.z),blue=kit.tex('watertower-blue');
  for(const [dx,dz] of [[-2,-2],[2,-2],[2,2],[-2,2]])kit.beam([w.x+dx*1.2,wy,w.z+dz*1.2],[w.x+dx*.7,wy+12,w.z+dz*.7],.18,blue,1.5,8);
  for(const h of [4,8])kit.add(roundUV(new THREE.TorusGeometry(2.2-h*.05,.07,6,24),1,.1),blue,{pos:[w.x,wy+h,w.z],rot:[Math.PI/2,0,0]});
  kit.add(cyl(2.8,4,1.5,{seg:32}),blue,{pos:[w.x,wy+14,w.z]});
  kit.add(roundUV(new THREE.ConeGeometry(3.0,1.3,32),1.5,3),blue,{pos:[w.x,wy+16.65,w.z]});
  for(let y=0;y<12;y+=.4)kit.add(box(.5,.04,.04,.6),galv,{pos:[w.x+2.1,wy+y,w.z-1.4]});
  // radar tower and radome
  const r=P(PLATEAU,'radar')[0],ry=G(r.x,r.z);
  kit.add(cyl(3.0,9,3,{top:2.6,seg:28}),kit.tex('facade-concrete'),{pos:[r.x,ry+4.5,r.z]});
  kit.add(cyl(3.3,.25,1,{seg:28}),galv,{pos:[r.x,ry+9.1,r.z]});
  kit.add(planarUV(new THREE.SphereGeometry(4.2,32,20,0,Math.PI*2,0,Math.PI*.62),3),kit.tex('radar-dome'),{pos:[r.x,ry+10.6,r.z]});
  // satellite dishes
  for(const d of P(PLATEAU,'dish')){
    const dy=G(d.x,d.z);
    kit.add(cyl(.7,2.2,1,{seg:16}),kit.tex('facade-concrete'),{pos:[d.x,dy+1.1,d.z]});
    kit.add(planarUV(new THREE.SphereGeometry(3,28,8,0,Math.PI*2,0,.62),1),kit.tex('dish-white',{side:THREE.DoubleSide}),{pos:[d.x,dy+5.1,d.z+.6],rot:[-Math.PI+.75,0,0]});
    kit.beam([d.x,dy+2.2,d.z],[d.x,dy+3.4,d.z+.3],.15,galv,1,8);
    for(const a of [0,2.1,4.2])kit.beam([d.x+Math.cos(a)*2.1,dy+3.6+Math.sin(a)*.6,d.z+.2+Math.sin(a)*1.3],[d.x,dy+4.7,d.z-1.4],.03,galv,1,6);
    kit.add(cyl(.18,.5,.5,{seg:12}),kit.tex('dish-white'),{pos:[d.x,dy+4.75,d.z-1.45],rot:[.75,0,0]});
  }
  // exhaust stacks of the underground facility
  for(const st of P(PLATEAU,'stack')){
    const y=G(st.x,st.z);
    kit.add(cyl(1.25,1.2,2,{seg:24}),kit.tex('facade-concrete'),{pos:[st.x,y+.6,st.z]});
    kit.add(cyl(1.1,8,1,{seg:24}),kit.tex('vent-louvre'),{pos:[st.x,y+5.1,st.z]});
    kit.add(roundUV(new THREE.TorusGeometry(1.1,.1,6,24),1,.1),galv,{pos:[st.x,y+9.1,st.z],rot:[Math.PI/2,0,0]});
  }
  // lookout tower on the hill
  const lk=P(PLATEAU,'lookout')[0],ly=G(lk.x,lk.z),timber=kit.tex('lookout-timber');
  for(const [dx,dz] of [[-1.8,-1.8],[1.8,-1.8],[1.8,1.8],[-1.8,1.8]])kit.beam([lk.x+dx,ly-.3,lk.z+dz],[lk.x+dx*.9,ly+8.5,lk.z+dz*.9],.17,timber,1,8);
  for(const h of [2.5,5])for(let i=0;i<4;i++){const c=[[-1,-1],[1,-1],[1,1],[-1,1]],a=c[i],b=c[(i+1)%4],s2=1.8-h*.02;kit.beam([lk.x+a[0]*s2,ly+h,lk.z+a[1]*s2],[lk.x+b[0]*s2,ly+h,lk.z+b[1]*s2],.08,timber,1,6);}
  kit.add(box(4.2,.2,4.2,1),kit.tex('picnic-wood'),{pos:[lk.x,ly+6,lk.z]});
  for(const [dx,dz,w,d] of [[0,-2,4.2,.08],[0,2,4.2,.08],[-2,0,.08,4.2],[2,0,.08,4.2]])kit.add(box(w,.08,d,1),timber,{pos:[lk.x+dx,ly+7,lk.z+dz]});
  hipRoof(kit,kit.tex('kokera-shingle'),{x1:lk.x-1.8,x2:lk.x+1.8,z1:lk.z-1.8,z2:lk.z+1.8,eave:ly+8.5,ridge:ly+9.8,over:.5,meters:1.2});
  for(let i=0;i<14;i++){const t=i/14;kit.add(box(.9,.06,.3,1),timber,{pos:[lk.x+2.6,ly+t*6,lk.z-2.2+t*4.4]});}
  ribbon(kit,kit.tex('mountain-trail'),[[92,200],[96,192],[100,186],[104,181],[107,179]],1.6,{lift:.05,meters:1.5});
  for(const p of P(PLATEAU,'picnic')){
    const y=G(p.x,p.z),wood=kit.tex('picnic-wood');
    kit.add(box(1.8,.06,.8,1),wood,{pos:[p.x,y+.75,p.z]});
    for(const dz of [-.75,.75])kit.add(box(1.8,.05,.3,1),wood,{pos:[p.x,y+.45,p.z+dz]});
    for(const dx of [-.7,.7])kit.add(box(.08,.75,1.6,1),wood,{pos:[p.x+dx,y+.37,p.z],rot:[0,0,0]});
  }
  for(const t of P(PLATEAU,'tent')){
    const y=G(t.x,t.z),run=1.15,rise=1.25,ang=Math.atan2(rise,run),len=Math.hypot(run,rise);
    for(const s2 of [-1,1])kit.add(box(.04,len,2.4,1),kit.tex('tent-canvas',{side:THREE.DoubleSide}),{pos:[t.x+s2*run/2,y+rise/2,t.z],rot:[0,0,s2*(Math.PI/2-ang)]});
    const tri=new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-run,0),new THREE.Vector2(run,0),new THREE.Vector2(0,rise)]));
    for(const dz of [-1.2,1.2])kit.add(planarUV(tri.clone(),1),kit.tex('tent-canvas',{side:THREE.DoubleSide}),{pos:[t.x,y,t.z+dz]});
  }
  const cf=P(PLATEAU,'campfire')[0],cy=G(cf.x,cf.z);
  kit.add(new THREE.CircleGeometry(.55,20),kit.tex('campfire'),{pos:[cf.x,cy+.06,cf.z],rot:[-Math.PI/2,0,0]});
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;kit.add(planarUV(lumpy(blobGeometry(7,5),.2,2,i),1),kit.tex('granite-outcrop'),{pos:[cf.x+Math.cos(a)*.65,cy+.08,cf.z+Math.sin(a)*.65],scale:.16});}
  for(const a of [0,1.1,2.3])kit.add(cyl(.09,.9,.6),kit.tex('timber-beam'),{pos:[cf.x,cy+.16,cf.z],rot:[0,a,Math.PI/2-.25]});
  kit.add(planarUV(lumpy(blobGeometry(),.4,3,3),.5),kit.plain('fire'),{pos:[cf.x,cy+.35,cf.z],scale:[.25,.35,.25]});
  void group;void R;
}

// ---------- river banks ----------
function river(kit,R){
  for(const p of P(RIVER_ZONE,'boulder'))kit.add(planarUV(lumpy(blobGeometry(),.3,1.4,p.x),1.5),kit.tex('granite-outcrop'),{pos:[p.x,G(p.x,p.z)+.2,p.z],scale:[p.w*.55,.9,p.d*.55]});
  for(let i=0;i<26;i++){
    const x=-46+R()*180,side=R()<.5?-1:1,z=RIVER.z(x)+side*(RIVER.half+.4+R()*1.2);
    if(Math.abs(x-44)<6||Math.abs(x+14)<3)continue;
    kit.add(planarUV(lumpy(blobGeometry(7,5),.35,1.8,i),1),kit.tex(R()<.5?'wet-black-rock':'river-pebbles',{variant:'stone'}),{pos:[x,RIVER.water+.05,z],scale:[.5+R()*.6,.3+R()*.3,.5+R()*.5]});
  }
  for(let i=0;i<60;i++){
    const x=-46+R()*180,side=R()<.5?-1:1,z=RIVER.z(x)+side*(RIVER.half+1.8+R()*3);
    if(Math.abs(x-44)<5||Math.abs(x+14)<2.5||x<-36)continue;
    if(Math.abs(G(x+1,z)-G(x-1,z))>.9||Math.abs(G(x,z+1)-G(x,z-1))>.9)continue;
    kit.add(planarUV(lumpy(new THREE.SphereGeometry(1,7,4,0,Math.PI*2,0,Math.PI/2),.2,2,i),1),kit.tex('reeds'),{pos:[x,G(x,z)-.05,z],scale:[.6+R()*.5,1.0+R()*.6,.6+R()*.5]});
  }
  for(let i=0;i<40;i++){
    const t=TREES[Math.floor(R()*TREES.length)];
    if(t.kind==='sakura')continue;
    const a=R()*Math.PI*2,x=t.x+Math.cos(a)*1.6,z=t.z+Math.sin(a)*1.6;
    kit.add(planarUV(lumpy(new THREE.SphereGeometry(1,7,4,0,Math.PI*2,0,Math.PI/2),.25,2,i+9),1),kit.tex('fern'),{pos:[x,G(x,z)-.05,z],scale:[.7,.45,.7]});
  }
  for(let i=0;i<5;i++)kit.add(planarUV(lumpy(blobGeometry(),.35,1.3,i+70),3),kit.tex('rocky-cliff'),{pos:[RIVER.x1-2.5+R()*2,RIVER.water+1+R()*6,RIVER.z(RIVER.x1)+(R()<.5?-1:1)*(4+R()*2)],scale:[2+R()*1.5,1.6+R(),2+R()]});
}

// ---------- village ----------
function village(kit,group,R){
  // drying racks
  for(const h of P(VILLAGE,'hazagake')){
    const y=G(h.x,h.z),wood=kit.tex('timber-beam');
    for(let x=h.x-h.w/2;x<=h.x+h.w/2+.01;x+=h.w/4)kit.beam([x,y,h.z],[x,y+2.2,h.z],.06,wood,1,6);
    kit.beam([h.x-h.w/2,y+1.9,h.z],[h.x+h.w/2,y+1.9,h.z],.05,wood,1,6);
    kit.add(box(h.w,1.2,.25,1),kit.tex('straw-hay'),{pos:[h.x,y+1.3,h.z]});
  }
  // thatched farmhouses
  P(VILLAGE,'house').forEach((hs,i)=>{
    const x1=hs.x-hs.w/2+.2,x2=hs.x+hs.w/2-.2,z1=hs.z-hs.d/2+.2,z2=hs.z+hs.d/2-.2,y=G(hs.x,hs.z);
    kit.add(box(x2-x1+.4,.5,z2-z1+.4),kit.tex('stone-masonry'),{pos:[hs.x,y+.15,hs.z],world:1.5});
    walls(kit,kit.tex('yakisugi'),{x1,x2,z1,z2,y1:y+.4,y2:y+1.4});
    walls(kit,kit.tex('earthen-wall'),{x1,x2,z1,z2,y1:y+1.4,y2:y+3.1,world:1.5});
    for(const px of [x1,x1+(x2-x1)/3,x1+(x2-x1)*2/3,x2])for(const pz of [z1,z2])kit.add(box(.18,2.8,.18,1,{swap:true}),kit.tex('timber-beam'),{pos:[px,y+1.8,pz]});
    kit.add(box(.06,1.6,2.4,1),kit.tex('koshi-lattice'),{pos:[x1-.04,y+1.6,hs.z-1.6]});
    kit.add(box(.04,1.0,1.4,1),kit.tex('noren-indigo',{side:THREE.DoubleSide}),{pos:[x1-.12,y+2.2,hs.z+1.4]});
    kit.add(box(.06,2.0,1.3,1),kit.tex('koshi-lattice'),{pos:[x1-.04,y+1.4,hs.z+1.4]});
    kit.add(box(1.0,.12,z2-z1,1),kit.tex('hinoki'),{pos:[x1-.6,y+.55,hs.z]});
    hipRoof(kit,kit.tex('thatched-roof'),{x1,x2,z1,z2,eave:y+3.0,ridge:y+7.2,over:1.0,meters:2});
    void i;
  });
  // storehouse (kura)
  const k=P(VILLAGE,'kura')[0],ky=G(k.x,k.z),kx1=k.x-k.w/2+.2,kx2=k.x+k.w/2-.2,kz1=k.z-k.d/2+.2,kz2=k.z+k.d/2-.2;
  walls(kit,kit.tex('namako-wall'),{x1:kx1,x2:kx2,z1:kz1,z2:kz2,y1:ky,y2:ky+1.4});
  walls(kit,kit.tex('stucco-white'),{x1:kx1,x2:kx2,z1:kz1,z2:kz2,y1:ky+1.4,y2:ky+4.2,world:1.5});
  kit.add(box(kx2-kx1-.2,.1,kz2-kz1-.2),kit.tex('stucco-white'),{pos:[k.x,ky+4.2,k.z],world:1.5});
  hipRoof(kit,kit.tex('kawara-roof'),{x1:kx1,x2:kx2,z1:kz1,z2:kz2,eave:ky+4.25,ridge:ky+5.8,over:.5,meters:2});
  kit.add(box(.08,2.0,1.4,1),kit.tex('cast-iron'),{pos:[kx1-.05,ky+1.0,k.z]});
  // field crops and tea rows
  for(let z=303;z<312;z+=1.2)ribbon(kit,kit.tex('cabbage-field'),[[64.5,z],[75.5,z]],.8,{lift:.14,meters:1.5});
  for(let z=297;z<326;z+=1.8)for(let x=81;x<111;x+=6){
    const y=G(x+3,z);
    kit.add(planarUV(lumpy(new THREE.BoxGeometry(6,1,1,6,2,2),.08,1.5,x+z),2),kit.tex('tea-rows'),{pos:[x+3,y+.45,z],scale:[1,.9,1]});
  }
  // bus stop
  const bs=P(VILLAGE,'bus-stop')[0],by=G(bs.x,bs.z),galv=kit.tex('galvanized-spangle');
  for(const dz of [-1.5,1.5])for(const dx of [-.7,.7])kit.beam([bs.x+dx,by,bs.z+dz],[bs.x+dx,by+2.4,bs.z+dz],.05,galv,1,8);
  kit.add(box(1.8,.08,3.4,2,{swap:true}),kit.tex('green-roof'),{pos:[bs.x,by+2.45,bs.z],rot:[0,0,-.08]});
  kit.add(box(.03,1.6,3.0,1),kit.tex('frosted-film'),{pos:[bs.x+.72,by+1.4,bs.z]});
  kit.add(box(.45,.06,2.6,1),kit.tex('picnic-wood'),{pos:[bs.x+.35,by+.45,bs.z]});
  kit.beam([bs.x-1.1,by,bs.z-2.2],[bs.x-1.1,by+2.3,bs.z-2.2],.04,galv,1,8);
  sign(group,[['里山前',64],['バス停 BUS STOP',30]],[bs.x-1.12,by+2.2,bs.z-2.2],-Math.PI/2,[.7,.5],{width:280,height:200,border:true,bg:'#1d3c78',fg:'#ffffff',accent:'#ffffff'});
  // jizo statues with a small roof
  for(const j of P(VILLAGE,'jizo')){
    const y=G(j.x,j.z);
    kit.add(box(.5,.35,.5,1),kit.tex('torii-granite'),{pos:[j.x,y+.17,j.z]});
    kit.add(new THREE.PlaneGeometry(.6,.6),kit.tex('jizo'),{pos:[j.x+.26,y+.65,j.z],rot:[0,Math.PI/2,0]});
    kit.add(box(.18,.5,.4,1),kit.tex('torii-granite'),{pos:[j.x,y+.6,j.z]});
  }
  const jy=G(39.2,304.6);
  kit.add(box(.9,.06,3.6,1.2),kit.tex('kokera-shingle'),{pos:[39.1,jy+1.35,304.6],rot:[0,0,.25]});
  for(const z of [302.9,306.3])kit.beam([38.8,jy,z],[38.8,jy+1.3,z],.04,kit.tex('timber-beam'),1,6);
  // temple: stone torii, steps, bell tower, hall, lanterns
  const ty=TEMPLE.y,tg=kit.tex('torii-granite');
  const [t1,t2]=P(VILLAGE,'torii-post');
  for(const t of [t1,t2])kit.add(cyl(.2,3.2,.8,{top:.17,seg:14}),tg,{pos:[t.x,G(t.x,t.z)+1.6,t.z]});
  const tcx=(t1.x+t2.x)/2,tt=G(tcx,t1.z);
  kit.add(box(3.6,.28,.4,1),tg,{pos:[tcx,tt+3.25,t1.z]});
  kit.add(box(3.0,.2,.25,1),tg,{pos:[tcx,tt+2.6,t1.z]});
  ribbon(kit,kit.tex('stepping-path'),[[-41,320],[-41,326],[-38,329.2]],1.6,{lift:.04,meters:1.5});
  const bt=P(VILLAGE,'bell-tower')[0],bty=G(bt.x,bt.z);
  kit.add(box(4.0,.8,4.0,1.5),kit.tex('ishigaki'),{pos:[bt.x,bty+.2,bt.z]});
  for(const [dx,dz] of [[-1.5,-1.5],[1.5,-1.5],[1.5,1.5],[-1.5,1.5]])kit.beam([bt.x+dx,bty+.6,bt.z+dz],[bt.x+dx*.92,bty+4.2,bt.z+dz*.92],.13,kit.tex('lookout-timber'),1,8);
  hipRoof(kit,kit.tex('kokera-shingle'),{x1:bt.x-1.5,x2:bt.x+1.5,z1:bt.z-1.5,z2:bt.z+1.5,eave:bty+4.2,ridge:bty+5.6,over:.8,meters:1.2});
  const bell=[];for(let k2=0;k2<=10;k2++){const t=k2/10;bell.push(new THREE.Vector2(.45+.12*t+.08*Math.sin(t*Math.PI*.5)*(t>.85?2:1),-t*1.3));}
  kit.add(roundUV(new THREE.LatheGeometry(bell,24),1,.5),kit.tex('temple-bronze',{side:THREE.DoubleSide}),{pos:[bt.x,bty+3.9,bt.z]});
  kit.add(cyl(.12,1.6,.6),kit.tex('timber-beam'),{pos:[bt.x+1.0,bty+2.9,bt.z],rot:[0,0,Math.PI/2]});
  const th=P(VILLAGE,'temple')[0],hy=G(th.x,th.z),hx1=th.x-th.w/2+.3,hx2=th.x+th.w/2-.3,hz1=th.z-th.d/2+.3,hz2=th.z+th.d/2-.3;
  kit.add(box(th.w,.7,th.d),kit.tex('ishigaki'),{pos:[th.x,hy+.2,th.z],world:1.5});
  walls(kit,kit.tex('earthen-wall'),{x1:hx1,x2:hx2,z1:hz1,z2:hz2,y1:hy+.55,y2:hy+3.6,world:1.5});
  kit.add(box(hx2-hx1-1,2.6,.06),kit.tex('koshi-lattice'),{pos:[th.x,hy+1.9,hz1-.04],world:1});
  for(const px of [hx1,hx1+(hx2-hx1)/3,hx1+(hx2-hx1)*2/3,hx2])kit.add(box(.22,3.2,.22,1,{swap:true}),kit.tex('timber-beam'),{pos:[px,hy+2.1,hz1-.1]});
  hipRoof(kit,kit.tex('kawara-roof'),{x1:hx1,x2:hx2,z1:hz1,z2:hz2,eave:hy+3.6,ridge:hy+6.4,over:1.2,meters:2});
  for(const dx of [-2.4,-.8,.8,2.4]){
    kit.add(cyl(.22,.45,.6,{seg:16}),kit.tex('chochin-red'),{pos:[th.x+dx,hy+3.0,hz1-1.0]});
    kit.beam([th.x+dx,hy+3.25,hz1-1.0],[th.x+dx,hy+3.65,hz1-1.0],.01,kit.plain('wire'));
  }
  for(const l of P(VILLAGE,'lantern'))lantern(kit,l.x,l.z,G(l.x,l.z));
  for(let i=0;i<10;i++){const x=-48+R()*15,z=320+R()*3;leafy(kit,'hydrangea',[x,G(x,z)+.35,z],[.6,.45,.6],i+90);}
  void ty;
}

// ---------- trees ----------
async function trees(kit,R,slice=async()=>{}){
  const bark=kit.tex('tree-bark');
  for(const t of TREES){
    await slice();
    const y=G(t.x,t.z)-.15,s=t.s,spin=R()*Math.PI*2;
    const lean=[(R()-.5)*.12,(R()-.5)*.12];
    if(t.kind==='cedar'){
      kit.add(cyl(.22*s,7.5*s,1,{top:.1*s,seg:8}),bark,{pos:[t.x,y+3.75*s,t.z],rot:[lean[0]*.5,0,lean[1]*.5]});
      for(const [r,h,o] of [[2.2,3.0,2.4],[1.8,2.6,3.8],[1.35,2.2,5.1],[.8,1.8,6.4]])
        kit.add(roundUV(new THREE.ConeGeometry(r*s*(.92+R()*.16),h*s,9),1,r*s),kit.tex('pine-needles'),{pos:[t.x+lean[1]*o*s,y+o*s,t.z+lean[0]*o*s],rot:[0,spin+o,0]});
    }else if(t.kind==='pine'){
      const h=7.5*s,top=[t.x+lean[0]*h*2,y+h,t.z+lean[1]*h*2];
      kit.beam([t.x,y,t.z],[(t.x+top[0])/2+(R()-.5)*.6,y+h*.55,(t.z+top[2])/2+(R()-.5)*.6],.2*s,kit.tex('red-pine-bark'),.8,8,true);
      kit.beam([(t.x+top[0])/2,y+h*.5,(t.z+top[2])/2],top,.15*s,kit.tex('red-pine-bark'),.8,8,true);
      for(let k=0;k<4;k++){
        const a=spin+k*1.7,r=(1.0+R()*1.2)*s,cy=y+h*(.62+k*.12);
        const end=[top[0]+Math.cos(a)*r,cy,top[2]+Math.sin(a)*r];
        kit.beam([top[0]-lean[0]*h*(1-.62-k*.12),cy-.4,top[2]-lean[1]*h*(1-.62-k*.12)],end,.06*s,kit.tex('red-pine-bark'),.8,5,true);
        leafy(kit,'pine-needles',[end[0],end[1]+.2*s,end[2]],[(1.0+R()*.4)*s,(.7+R()*.15)*s,(.95+R()*.4)*s],t.x+k);
      }
    }else if(t.kind==='birch'){
      kit.add(cyl(.12*s,7*s,.6,{top:.06*s,seg:8}),kit.tex('birch-bark'),{pos:[t.x,y+3.5*s,t.z],rot:[lean[0],0,lean[1]]});
      for(let k=0;k<3;k++)leafy(kit,'bush-leaves',[t.x+(R()-.5)*.8*s+lean[1]*4,y+(4.4+k*1.0)*s,t.z+(R()-.5)*.8*s-lean[0]*4],[(1.25-k*.25)*s,(1.0-k*.12)*s,(1.2-k*.25)*s],t.z+k);
    }else{
      const id=t.kind==='sakura'?'sakura':'momiji',trunk=2.0*s,base=[t.x,y,t.z],fork=[t.x,y+trunk,t.z];
      kit.beam(base,fork,.22*s,bark,1,8,true);
      const n=t.kind==='sakura'?3:2+Math.floor(R()*2);
      for(let k=0;k<n;k++){
        const a=spin+k*Math.PI*2/n,end=[t.x+Math.cos(a)*1.4*s,y+trunk+1.4*s+R()*.6*s,t.z+Math.sin(a)*1.4*s];
        kit.beam(fork,end,.11*s,bark,1,6,true);
        leafy(kit,id,[end[0],end[1]+.35*s,end[2]],[(1.5+R()*.4)*s,(1.0+R()*.25)*s,(1.4+R()*.4)*s],t.x+k*3);
      }
      leafy(kit,id,[t.x,y+trunk+2.4*s,t.z],[1.6*s,1.1*s,1.6*s],t.z-t.x);
    }
  }
  // undergrowth: ferns and shrubs under groves, grass tufts in open meadows
  for(const t of TREES){
    if(R()>.35||t.kind==='sakura')continue;
    const a=R()*Math.PI*2,d=1.4+R()*1.6,x=t.x+Math.cos(a)*d,z=t.z+Math.sin(a)*d,y=G(x,z);
    const id=R()<.6?'fern':'bush-leaves';
    kit.add(planarUV(lumpy(new THREE.SphereGeometry(1,7,4,0,Math.PI*2,0,Math.PI/2),.25,2,x),1),kit.tex(id,{variant:'low',side:THREE.DoubleSide}),{pos:[x,y-.05,z],scale:[.55+R()*.4,.35+R()*.25,.55+R()*.4]});
  }
  for(let i=0;i<140;i++){
    const x=-56+R()*178,z=200+R()*134;
    if(ROADS.some(r=>inRect(r,x,z,1.5))||PADDIES.some(p=>inRect(p,x,z,1))||inRect(PLAZA,x,z,1)||inRect(PARKING,x,z,1)||inRect(HQ,x,z,2))continue;
    if(x>RIVER.x1-3&&Math.abs(z-RIVER.z(x))<RIVER.half+2)continue;
    const y=G(x,z);if(Math.abs(G(x+1,z)-G(x-1,z))>.8)continue;
    kit.add(planarUV(lumpy(new THREE.SphereGeometry(1,8,5,0,Math.PI*2,0,Math.PI/2),.3,3,i),1),kit.tex(R()<.7?'meadow-grass':'dry-grass',{variant:'tuft',side:THREE.DoubleSide}),{pos:[x,y-.04,z],scale:[.35+R()*.3,.25+R()*.25,.35+R()*.3]});
  }
}

// ---------- sky, mountains and sun (only while outdoors) ----------
function sky(group){
  const dome=new THREE.Mesh(new THREE.SphereGeometry(35,32,12,0,Math.PI*2,0,Math.PI*.56),new THREE.MeshBasicMaterial({color:0x9fc3e6,side:THREE.BackSide,fog:false,depthWrite:false,toneMapped:false}));
  dome.name='Sky dome';dome.renderOrder=-2;dome.frustumCulled=false;
  const band=new THREE.Mesh(new THREE.CylinderGeometry(33,33,10,64,1,true),new THREE.MeshBasicMaterial({color:0xdfe7ee,alphaTest:.08,side:THREE.BackSide,fog:false,depthWrite:false,toneMapped:false}));
  band.name='Mountain band';band.renderOrder=-1;band.frustumCulled=false;
  const sun=new THREE.DirectionalLight(0xfff0d8,0);
  sun.position.set(30,60,-20);sun.name='Sun';
  group.add(dome,band,sun,sun.target);
  let base=null;
  const update=(player,camera,scene,textures)=>{
    if(!base){
      base={fog:scene.fog.color.clone(),bg:scene.background.clone()};
      const sk=textures.get('sky-clouds')?.map,mt=textures.get('mountain-range')?.map;
      if(sk){const m=sk.clone();m.repeat.set(5,2);dome.material.map=m;dome.material.color.set(0xffffff);dome.material.needsUpdate=true;}
      if(mt){const m=mt.clone();m.repeat.set(3,1);band.material.map=m;band.material.alphaMap=m;band.material.needsUpdate=true;}
    }
    const outside=player.x>-70&&player.x<140?smoothstep(INCLINE.z2-2.5,INCLINE.z2+2,player.z):0;
    dome.visible=band.visible=outside>0;
    if(outside>0){
      dome.position.set(camera.position.x,camera.position.y-3,camera.position.z);
      band.position.set(camera.position.x,camera.position.y+.4,camera.position.z);
      sun.target.position.set(camera.position.x,0,camera.position.z);
      sun.position.set(camera.position.x+30,camera.position.y+60,camera.position.z-20);
    }
    sun.intensity=1.5*outside;
    scene.fog.color.copy(base.fog).lerp(HAZE,outside);
    // the draw-distance setting scales the haze (render.js setDrawDistance)
    const scale=scene.userData.fogScale??1,inside=.024*scale;
    scene.fog.density=inside+(.0082*scale-inside)*outside;
    scene.background.copy(base.bg).lerp(SKY,outside);
    return outside;
  };
  return update;
}
