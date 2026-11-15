import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,scaleUV,lumpy,fbm,smoothstep,rng,kiosk,sign,tube,bulkhead,profile} from './kit.js';
import {INCLINE,YARD,SURFACE,inclineFloor} from './cavern-layout.js';

// Zone 19: the inclined shaft from the living quarters up to a mountain mine yard under an open sky.
const props=type=>SURFACE.props.filter(p=>p.type===type);
const Y=YARD.y;
const HAZE=new THREE.Color(0xc4d1da),SKY=new THREE.Color(0x9fc3e6);

/** Ground height of the surface terrain (the yard itself is flat at YARD.y). */
export function groundHeight(x,z){
  const n=fbm(x*.07,3,z*.07)-.5;
  if(z<YARD.z1)return Y+Math.min(8,(YARD.z1-z)*1.6)+n*1.6*smoothstep(0,3,YARD.z1-z);
  const dx=Math.max(YARD.x1-.6-x,x-(YARD.x2+.6),0),dz=Math.max(z-(YARD.z2+.6),0),d=Math.hypot(dx,dz);
  let h=Y+Math.min(9,d*.35)+n*2.2*smoothstep(0,4,d);
  const s=Math.abs(x-STREAM.x);
  if(s<2.6&&z>YARD.z1+.7)h=Math.min(h,STREAM.y-.15+(s/2.6)**2*1.1);
  return h;
}
const STREAM={x:4.2,y:Y-.3};

export function buildSurface(kit,group){
  const R=rng(19);
  incline(kit,group);
  terrain(kit);
  portal(kit,group);
  yard(kit,group,R);
  buildings(kit,group);
  machines(kit,R);
  shrine(kit);
  nature(kit,R);
  kiosk(kit,group,SURFACE,[SURFACE.terminal[0],Y,SURFACE.terminal[1]],Math.PI);
  return sky(kit,group);
}

// ---------- inclined shaft ----------
function incline(kit,group){
  const t=INCLINE,lining=kit.tex('limestone-wall',{variant:'lining',side:THREE.DoubleSide});
  const g=tube(t,t.z1+.15,t.z2+.2,2);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+inclineFloor(p.getZ(i)));
  g.computeVertexNormals();
  kit.add(g,lining,{pos:[t.x,0,0]});
  const ramp=new THREE.PlaneGeometry(t.half*2,t.z2-t.z1+.4,1,40);
  ramp.rotateX(-Math.PI/2);ramp.translate(t.x,0,(t.z1+t.z2)/2+.2);
  const rp=ramp.attributes.position;
  for(let i=0;i<rp.count;i++)rp.setY(i,inclineFloor(rp.getZ(i))+.01);
  ramp.computeVertexNormals();
  kit.add(ramp,kit.tex('cave-mud'),{world:1.5});
  kit.add(bulkhead(t,{half:1.2,h:2.5},2),kit.tex('form-concrete'),{pos:[t.x,0,t.z1+.12]});
  const wood=kit.tex('timber-beam'),lamp=kit.plain('lamp-warm');
  for(let z=t.z1+2;z<t.z2-1;z+=4){
    const y=inclineFloor(z);
    for(const s of [-1,1])kit.add(box(.22,t.wall,.22,1,{swap:true}),wood,{pos:[t.x+s*(t.half-.12),y+t.wall/2,z]});
    kit.add(box(t.half*2,.24,.24,1),wood,{pos:[t.x,y+t.wall+.1,z]});
  }
  for(const z of [112,121,134,147])kit.add(box(.5,.08,.22,1),lamp,{pos:[t.x,inclineFloor(z)+t.crown-.07,z]});
  const rail=kit.tex('safety-yellow-steel'),cable=kit.tex('cable-bundle');
  kit.beam([t.x+t.half-.15,.95,t.z1+.4],[t.x+t.half-.15,t.rise+.95,t.z2],.03,rail);
  kit.beam([t.x-t.half+.08,2.1,t.z1+.4],[t.x-t.half+.08,t.rise+2.1,t.z2],.05,cable,.6);
  for(let z=t.z1+1;z<t.z2;z+=.6)kit.add(box(1.6,.04,.08,1),wood,{pos:[t.x-.4,inclineFloor(z)+.03,z],rot:[-Math.atan(t.rise/(t.z2-t.z1)),0,0]});
  sign(group,[['↑ 地上 坑口ヤード',58],['第一斜坑  INCLINE TO SURFACE',30]],[t.x,2.85,107.88],Math.PI,[1.9,.42],{width:620,height:140,border:false,bg:'#20282a'});
}

// ---------- terrain ----------
function terrain(kit){
  const x1=-14,x2=62,z1=136,z2=216,step=1;
  const nx=(x2-x1)/step,nz=(z2-z1)/step;
  const buckets={'grass-field':[],'forest-floor':[],'hillside-soil':[],'moss-ground':[],'river-pebbles':[]};
  const H=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=x1+i*step,z=z1+j*step;H.push([x,groundHeight(x,z),z]);}
  const at=(i,j)=>H[j*(nx+1)+i];
  const crownAt=z=>inclineFloor(z)+INCLINE.crown+.4;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const quad=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];
    const cx=(quad[0][0]+quad[1][0])/2,cz=(quad[0][2]+quad[3][2])/2;
    if(cz<YARD.z1+.6&&Math.abs(cx-INCLINE.x)<2.6&&Math.min(...quad.map(q=>q[1]-crownAt(q[2])))<0)continue;
    const dx=Math.max(YARD.x1-cx,cx-YARD.x2,0),dz=Math.max(cz-YARD.z2,0),d=Math.hypot(dx,dz);
    const s=Math.abs(cx-STREAM.x);
    let key='grass-field';
    if(cz<YARD.z1)key=cz>YARD.z1-6?'hillside-soil':'grass-field';
    else if(s<.9&&cz>YARD.z1+.7)key='river-pebbles';
    else if(s<2.4&&cz>YARD.z1+.7)key='moss-ground';
    else if(d>4)key='forest-floor';
    buckets[key].push(quad[0],quad[3],quad[1],quad[1],quad[3],quad[2]);
  }
  for(const [id,tris] of Object.entries(buckets)){
    if(!tris.length)continue;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(tris.flat(),3));
    g.computeVertexNormals();
    kit.add(g,kit.tex(id),{world:id==='river-pebbles'||id==='moss-ground'?1:2});
  }
  // stream
  const water=new THREE.PlaneGeometry(1.9,z2-YARD.z1-1);
  water.rotateX(-Math.PI/2);
  kit.add(water,kit.tex('stream-water'),{pos:[STREAM.x,STREAM.y,(YARD.z1+1+z2)/2],world:1.5});
}

// ---------- portal facade ----------
function portal(kit,group){
  const t=INCLINE,inner=profile(t).map(([x,y])=>[x+t.x,y]);
  const pts=[[YARD.x1,0],[t.x-t.half,0],...inner.slice().reverse(),[t.x+t.half,0],[YARD.x2,0],[YARD.x2,6.6],[YARD.x1,6.6]];
  const face=planarUV(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x,y)))),2);
  const concrete=kit.tex('retaining-concrete');
  kit.add(face,concrete,{pos:[0,Y,YARD.z1-.25]});
  kit.add(box(YARD.x2-YARD.x1+.4,.3,.6),concrete,{pos:[(YARD.x1+YARD.x2)/2,Y+6.75,YARD.z1-.5],world:2});
  kit.add(box(t.half*2+.8,.5,.5),concrete,{pos:[t.x,Y+t.crown+.45,YARD.z1-.05],world:2});
  sign(group,[['STRATA B4  第一斜坑',62],['地下研究所 坑口',36]],[t.x,Y+4.25,YARD.z1-.2],0,[2.6,.62],{width:620,height:150,border:true,bg:'#1d2a2c'});
  const gab=kit.tex('gabion');
  for(const p of props('gabions'))for(let x=p.x-p.w/2+.5;x<p.x+p.w/2;x+=1.0){
    kit.add(box(.98,.9,.9,1),gab,{pos:[x,Y+.45,p.z]});
    if(Math.abs(x-p.x)<p.w/2-1.5)kit.add(box(.98,.9,.9,1),gab,{pos:[x,Y+1.35,p.z-.05]});
  }
}

// ---------- yard surfaces, fences and gate ----------
function yard(kit,group,R){
  kit.add(box(24,.02,15.5),kit.tex('gravel-yard'),{pos:[24,Y+.01,168.2],world:1.5});
  kit.add(box(5,.02,18),kit.tex('asphalt-road'),{pos:[24,Y+.012,185],world:2});
  kit.add(scaleUV(new THREE.PlaneGeometry(2,18),1,9),kit.tex('road-marking'),{pos:[24,Y+.024,185],rot:[-Math.PI/2,0,0]});
  for(const [x,z] of [[25.3,184],[22.7,179.5]])kit.add(new THREE.PlaneGeometry(.9,.9),kit.tex('manhole'),{pos:[x,Y+.03,z],rot:[-Math.PI/2,0,0]});
  kit.add(box(3.2,.02,7.6),kit.tex('dirt-track'),{pos:[29.6,Y+.008,180.2],world:2});
  kit.add(box(2.2,.02,9.6),kit.tex('dirt-track'),{pos:[36.4,Y+.009,183.4],world:2});
  // west timber fence, north brick wall with gate, east chain-link fence
  const fence=kit.tex('wooden-fence'),steel=kit.plain('steel-dark');
  kit.add(box(.06,1.8,YARD.z2-YARD.z1),fence,{pos:[YARD.x1-.1,Y+.9,(YARD.z1+YARD.z2)/2],world:1.5});
  for(let z=YARD.z1+.5;z<YARD.z2;z+=2.4)kit.add(box(.12,1.95,.12,.6,{swap:true}),kit.tex('timber-beam'),{pos:[YARD.x1-.17,Y+.97,z]});
  const brick=kit.tex('red-brick');
  for(const [a,b] of [[YARD.x1-.1,21.2],[26.8,YARD.x2+.1]]){
    kit.add(box(b-a,1.1,.3),brick,{pos:[(a+b)/2,Y+.55,YARD.z2+.2],world:1.2});
    kit.add(box(b-a+.06,.08,.38),kit.tex('retaining-concrete'),{pos:[(a+b)/2,Y+1.14,YARD.z2+.2]});
  }
  for(const x of [21.0,27.0]){
    kit.add(box(.5,1.9,.5),brick,{pos:[x,Y+.95,YARD.z2+.2],world:1.2});
    kit.add(box(.62,.12,.62),kit.tex('retaining-concrete'),{pos:[x,Y+1.96,YARD.z2+.2]});
  }
  const iron=kit.tex('cast-iron');
  for(const y of [.15,1.55])kit.add(box(5.5,.08,.08,.6),iron,{pos:[24,Y+y,YARD.z2+.25]});
  for(let x=21.4;x<26.7;x+=.22)kit.add(box(.04,1.45,.04,.6),iron,{pos:[x,Y+.85,YARD.z2+.25]});
  const link=kit.tex('chainlink-fence',{variant:'mesh',alpha:.4,side:THREE.DoubleSide});
  kit.add(new THREE.PlaneGeometry(YARD.z2-YARD.z1,1.9),link,{pos:[YARD.x2+.1,Y+.95,(YARD.z1+YARD.z2)/2],rot:[0,Math.PI/2,0],world:1});
  for(let z=YARD.z1+.3;z<=YARD.z2;z+=2.8)kit.beam([YARD.x2+.1,Y,z],[YARD.x2+.1,Y+2,z],.04,steel);
  for(const p of props('cones')){
    for(let i=0;i<5;i++){
      const x=p.x-p.w/2+.4+i*(p.w-.8)/4;
      kit.add(roundUV(new THREE.ConeGeometry(.17,.68,14),.5,.17),kit.tex('orange-plastic'),{pos:[x,Y+.38,p.z]});
      kit.add(box(.4,.04,.4,.5),kit.tex('molded-plastic'),{pos:[x,Y+.02,p.z]});
    }
  }
  // utility poles with wires
  const poles=props('pole'),tops=[];
  for(const p of poles){
    kit.add(cyl(.16,9,.8,{top:.12,seg:14}),kit.tex('concrete-pole'),{pos:[p.x,Y+4.5,p.z]});
    kit.add(box(1.6,.1,.1,1),kit.tex('timber-beam'),{pos:[p.x,Y+8.4,p.z]});
    for(const dx of [-.65,0,.65])kit.add(cyl(.05,.14,.3),kit.plain('porcelain',{color:0xe8eae6,roughness:.3,metalness:0}),{pos:[p.x+dx,Y+8.53,p.z]});
    tops.push([p.x,Y+8.55,p.z]);
  }
  const wire=kit.plain('wire',{color:0x111315,roughness:.5,metalness:.3});
  for(const dx of [-.65,0,.65]){
    const [a,b]=tops,mid=[(a[0]+b[0])/2+dx,a[1]-.6,(a[2]+b[2])/2];
    kit.beam([a[0]+dx,a[1],a[2]],mid,.012,wire);kit.beam(mid,[b[0]+dx,b[1],b[2]],.012,wire);
  }
  kit.beam([tops[0][0],tops[0][1],tops[0][2]],[18.1,Y+3.6,183.5],.012,wire);
}

// ---------- buildings ----------
function gableRoof(kit,material,{x1,x2,z1,z2,eave,ridge,over=.5}){
  const cx=(x1+x2)/2,cz=(z1+z2)/2,run=(z2-z1)/2+over,drop=(ridge-eave)*(run/((z2-z1)/2));
  const slope=Math.atan2(drop,run),len=Math.hypot(run,drop),midY=ridge-drop/2;
  kit.add(box(x2-x1+over*2,.1,len,2),material,{pos:[cx,midY,cz-run/2],rot:[-slope,0,0]});
  kit.add(box(x2-x1+over*2,.1,len,2),material,{pos:[cx,midY,cz+run/2],rot:[slope,0,0]});
}
function gables(kit,material,{x1,x2,z1,z2,eave,ridge}){
  const cz=(z1+z2)/2,tri=new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-(z2-z1)/2,eave),new THREE.Vector2((z2-z1)/2,eave),new THREE.Vector2(0,ridge)]));
  kit.add(planarUV(tri.clone(),1.2),material,{pos:[x1,0,cz],rot:[0,-Math.PI/2,0]});
  kit.add(planarUV(tri,1.2),material,{pos:[x2,0,cz],rot:[0,Math.PI/2,0]});
}
function walls(kit,material,{x1,x2,z1,z2,y1,y2,t=.2,world=1.2}){
  const cx=(x1+x2)/2,cz=(z1+z2)/2,h=y2-y1,y=(y1+y2)/2;
  kit.add(box(x2-x1,h,t),material,{pos:[cx,y,z1+t/2],world});
  kit.add(box(x2-x1,h,t),material,{pos:[cx,y,z2-t/2],world});
  kit.add(box(t,h,z2-z1-2*t),material,{pos:[x1+t/2,y,cz],world});
  kit.add(box(t,h,z2-z1-2*t),material,{pos:[x2-t/2,y,cz],world});
}

function buildings(kit,group){
  const win=kit.tex('office-window'),walnut=kit.tex('walnut-veneer');
  // office: stone base, board siding, kawara tile roof
  const o={x1:10,x2:18,z1:180,z2:186};
  kit.add(box(8.2,.6,6.2),kit.tex('stone-masonry'),{pos:[14,Y+.3,183],world:1.5});
  walls(kit,kit.tex('board-siding'),{...o,y1:Y+.6,y2:Y+3.4});
  gables(kit,kit.tex('board-siding'),{...o,eave:Y+3.4,ridge:Y+5.2});
  gableRoof(kit,kit.tex('kawara-roof'),{...o,eave:Y+3.4,ridge:Y+5.25});
  kit.add(box(9.2,.22,.3,1),kit.tex('cast-iron'),{pos:[14,Y+5.3,183]});
  for(const x of [11.4,13.6,15.6])kit.add(box(1.5,1.2,.04,2),win,{pos:[x,Y+2.0,o.z1-.02]});
  for(const z of [181.6,184.4])for(const x of [o.x1-.02,o.x2+.02])kit.add(box(.04,1.2,1.5,2),win,{pos:[x,Y+2.0,z]});
  kit.add(box(1.0,2.1,.05,.8,{swap:true}),walnut,{pos:[17.1,Y+1.65,o.z1-.03]});
  for(const s of [-1,1])kit.add(box(.5,.08,.5,1),kit.tex('stone-masonry'),{pos:[17.1+s*.3,Y+.6,o.z1-.6]});
  sign(group,[['事務所',58],['OFFICE',30]],[17.1,Y+3.0,o.z1-.05],Math.PI,[1.1,.32],{width:400,height:118,border:false,bg:'#2a2620'});
  // flower bed and koi pond with stone rim
  kit.add(box(5.5,.14,.7,1),kit.tex('wildflowers'),{pos:[13.4,Y+.07,179.55]});
  const pond=props('pond')[0],stone=kit.tex('stone-masonry');
  kit.add(new THREE.PlaneGeometry(pond.w-.5,pond.d-.5),kit.tex('koi-pond'),{pos:[pond.x,Y+.08,pond.z],rot:[-Math.PI/2,0,0],world:2});
  for(const [dx,dz,w,d] of [[0,-pond.d/2+.12,pond.w,.25],[0,pond.d/2-.12,pond.w,.25],[-pond.w/2+.12,0,.25,pond.d],[pond.w/2-.12,0,.25,pond.d]])
    kit.add(box(w,.35,d),stone,{pos:[pond.x+dx,Y+.06,pond.z+dz],world:1.5});
  for(const p of props('lantern'))lantern(kit,p.x,p.z);
  const post=props('postbox')[0],red=kit.tex('post-red');
  kit.add(cyl(.22,1.25,.6,{seg:20}),red,{pos:[post.x,Y+.625,post.z]});
  kit.add(planarUV(new THREE.SphereGeometry(.22,20,8,0,Math.PI*2,0,Math.PI/2),.6),red,{pos:[post.x,Y+1.25,post.z]});
  kit.add(box(.2,.03,.05,1),kit.plain('steel-dark'),{pos:[post.x,Y+1.05,post.z-.21]});
  // warehouse: rusty corrugated walls, green roof, roller shutter
  const w={x1:31,x2:39,z1:166,z2:176},rust=kit.tex('rusty-corrugated');
  kit.add(box(.2,4.5,10),rust,{pos:[w.x2-.1,Y+2.25,171],world:1.5});
  kit.add(box(8,4.5,.2),rust,{pos:[35,Y+2.25,w.z1+.1],world:1.5});
  kit.add(box(8,4.5,.2),rust,{pos:[35,Y+2.25,w.z2-.1],world:1.5});
  kit.add(box(.2,4.5,3.4),rust,{pos:[w.x1+.1,Y+2.25,167.7],world:1.5});
  kit.add(box(.2,4.5,2.6),rust,{pos:[w.x1+.1,Y+2.25,174.7],world:1.5});
  kit.add(box(.2,.9,4.0),rust,{pos:[w.x1+.1,Y+4.05,171.4],world:1.5});
  kit.add(box(.05,3.6,4.0,2,{swap:true}),kit.tex('roller-shutter'),{pos:[w.x1+.05,Y+1.8,171.4]});
  kit.add(box(.3,.4,4.2,1),kit.tex('cast-iron'),{pos:[w.x1-.05,Y+3.75,171.4]});
  kit.add(box(8.9,.08,10.9,2,{swap:true}),kit.tex('green-roof'),{pos:[35,Y+4.62,171],rot:[0,0,.07]});
  extinguisher(kit,w.x1-.12,Y,168.8,-Math.PI/2);
  // hoist house: concrete block, flat green roof
  const hh={x1:31.4,x2:36.6,z1:178.2,z2:181.4};
  walls(kit,kit.tex('cinder-block'),{...hh,y1:Y,y2:Y+3.2});
  kit.add(box(5.6,.1,3.6,2,{swap:true}),kit.tex('green-roof'),{pos:[34,Y+3.25,179.8]});
  kit.add(box(1.4,2.2,.05,2,{swap:true}),kit.tex('roller-shutter'),{pos:[34,Y+1.1,hh.z2+.03]});
  // guard house: white stucco, green roof
  const g={x1:15.9,x2:19.1,z1:189.9,z2:193.1};
  walls(kit,kit.tex('stucco-white'),{...g,y1:Y,y2:Y+2.7,world:1.5});
  kit.add(box(3.8,.1,3.8,2,{swap:true}),kit.tex('green-roof'),{pos:[17.5,Y+2.8,191.5],rot:[.05,0,0]});
  kit.add(box(.04,1.0,1.8,2),win,{pos:[g.x2+.02,Y+1.6,191.5]});
  kit.add(box(.9,2.0,.04,.8,{swap:true}),walnut,{pos:[17.5,Y+1.0,g.z1-.02]});
  sign(group,[['守衛所',52]],[17.5,Y+2.35,g.z1-.05],Math.PI,[.8,.22],{width:300,height:84,border:false,bg:'#2a2620'});
}
function lantern(kit,x,z){
  const st=kit.tex('lantern-stone');
  kit.add(cyl(.3,.25,.6,{seg:8}),st,{pos:[x,Y+.125,z]});
  kit.add(cyl(.12,.8,.6,{seg:10}),st,{pos:[x,Y+.65,z]});
  kit.add(box(.5,.12,.5,.6),st,{pos:[x,Y+1.1,z]});
  kit.add(box(.38,.34,.38,.6),st,{pos:[x,Y+1.33,z]});
  kit.add(box(.4,.2,.2,.6),kit.plain('lamp-amber'),{pos:[x,Y+1.33,z]});
  kit.add(roundUV(new THREE.ConeGeometry(.42,.32,4),.6,.42),st,{pos:[x,Y+1.66,z],rot:[0,Math.PI/4,0]});
  kit.add(new THREE.SphereGeometry(.07,10,8),st,{pos:[x,Y+1.85,z]});
}
export function extinguisher(kit,x,y,z,angle=0){
  const red=kit.tex('extinguisher-red');
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,angle,0));
  const at=(dx,dy,dz)=>new THREE.Vector3(dx,dy,dz).applyQuaternion(q).add(new THREE.Vector3(x,y,z)).toArray();
  kit.add(cyl(.09,.5,.4,{seg:16}),red,{pos:at(0,.55,.0)});
  kit.add(planarUV(new THREE.SphereGeometry(.09,16,8,0,Math.PI*2,0,Math.PI/2),.4),red,{pos:at(0,.8,0)});
  kit.add(box(.05,.08,.12,1),kit.plain('steel-dark'),{pos:at(0,.88,0),quat:q});
  kit.add(box(.2,.04,.04,1),kit.plain('steel-dark'),{pos:at(0,.62,-.1),quat:q});
}

// ---------- machines ----------
function machines(kit,R){
  const iron=kit.tex('cast-iron'),loco=kit.tex('loco-paint'),steel=kit.plain('steel-dark');
  // mine locomotive with a tub on a short track
  const lp=props('locomotive')[0];
  for(const s of [-.3,.3])kit.add(box(.07,.12,17,1),iron,{pos:[lp.x+s,Y+.14,170.5]});
  for(let z=162.2;z<179;z+=.6)kit.add(box(1.0,.08,.18,1),kit.tex('pallet-wood'),{pos:[lp.x,Y+.04,z]});
  kit.add(box(1.2,.9,2.0,1),loco,{pos:[lp.x,Y+.85,170.6]});
  kit.add(box(1.25,1.15,1.0,1),loco,{pos:[lp.x,Y+1.3,169.1]});
  kit.add(box(1.45,.08,1.25,1),loco,{pos:[lp.x,Y+1.92,169.1]});
  for(const s of [-.5,.5])kit.add(box(.06,.6,.06,1),steel,{pos:[lp.x+s*1.1,Y+1.6,169.6]});
  for(const z of [169.4,171.2])for(const s of [-.42,.42])kit.add(cyl(.28,.12,.6,{seg:16}),iron,{pos:[lp.x+s,Y+.32,z],rot:[0,0,Math.PI/2]});
  kit.add(box(1.3,.25,.12,1),kit.tex('hazard-stripe'),{pos:[lp.x,Y+.5,171.66]});
  kit.add(cyl(.12,.1,.5,{seg:14}),kit.plain('lamp-warm'),{pos:[lp.x,Y+1.15,171.62],rot:[Math.PI/2,0,0]});
  kit.add(box(.95,.65,1.4,1.5),kit.tex('corten-plate'),{pos:[lp.x,Y+.75,166.9]});
  for(const z of [166.5,167.3])for(const s of [-.3,.3])kit.add(cyl(.18,.08,.5),iron,{pos:[lp.x+s*1.1,Y+.3,z],rot:[0,0,Math.PI/2]});
  for(let i=0;i<6;i++)kit.add(planarUV(lumpy(new THREE.DodecahedronGeometry(1,0),.1,2,i),.6),kit.tex('quartz-vein'),{pos:[lp.x+(R()-.5)*.5,Y+1.12,166.9+(R()-.5)*.9],scale:.15+R()*.1,rot:[R()*3,R()*3,0]});
  // forklift
  const f=props('forklift')[0],yellow=kit.tex('forklift-yellow'),tire=kit.tex('tire-rubber');
  kit.add(box(1.0,.8,1.6,.8),yellow,{pos:[f.x,Y+.7,f.z+.1]});
  kit.add(box(1.0,.6,.4,.8),yellow,{pos:[f.x,Y+.8,f.z+1.0]});
  for(const s of [-.45,.45]){
    kit.beam([f.x+s,Y+1.1,f.z+.75],[f.x+s,Y+2.3,f.z+.75],.04,yellow);
    kit.beam([f.x+s,Y+1.1,f.z-.45],[f.x+s,Y+2.3,f.z-.55],.04,yellow);
    kit.add(box(.08,2.4,.1,.6),iron,{pos:[f.x+s*.8,Y+1.2,f.z-.78]});
    kit.add(box(.12,.05,1.1,.6),iron,{pos:[f.x+s*.6,Y+.15,f.z-1.35]});
  }
  kit.add(box(1.0,.06,1.4,.8),yellow,{pos:[f.x,Y+2.32,f.z+.1]});
  kit.add(box(.5,.12,.5,.3),kit.tex('molded-plastic'),{pos:[f.x,Y+1.18,f.z+.4]});
  for(const z of [-.45,.75])for(const s of [-.52,.52])kit.add(roundUV(new THREE.CylinderGeometry(.28,.28,.22,18),.6,.28),tire,{pos:[f.x+s,Y+.28,f.z+z],rot:[0,0,Math.PI/2]});
  // pallets with cardboard boxes, barrels, tyre stack
  const pa=props('pallets')[0],card=kit.tex('cardboard');
  kit.add(box(1.25,.14,1.05,1),kit.tex('pallet-wood'),{pos:[pa.x,Y+.07,pa.z]});
  for(const [dx,dy,dz,s] of [[-.3,.14,-.22,.55],[.3,.14,-.22,.55],[-.28,.14,.27,.5],[.3,.14,.27,.45],[0,.69,0,.5]])kit.add(box(s,s,s,.6),card,{pos:[pa.x+dx,Y+dy+s/2,pa.z+dz],rot:[0,(R()-.5)*.3,0]});
  const ba=props('barrels')[0];
  for(const dx of [-.62,0,.62])kit.add(cyl(.3,.9,.8,{seg:20}),kit.tex('barrel-staves'),{pos:[ba.x+dx,Y+.45,ba.z+(R()-.5)*.2]});
  const ti=props('tires')[0];
  for(let i=0;i<4;i++)kit.add(scaleUV(new THREE.TorusGeometry(.36,.16,10,24),6,1),tire,{pos:[ti.x,Y+.16+i*.3,ti.z],rot:[Math.PI/2,0,i*.4]});
  // headframe over the vertical shaft, cables to the hoist house
  const h=props('headframe')[0],red=kit.tex('headframe-steel'),top=Y+13;
  const corner=(y,s)=>[[h.x-s,y,h.z-s],[h.x+s,y,h.z-s],[h.x+s,y,h.z+s],[h.x-s,y,h.z+s]];
  const base=corner(Y,2.1),peak=corner(top,1.0);
  for(let i=0;i<4;i++)kit.beam(base[i],peak[i],.14,red,1,6);
  for(const y of [Y+3,Y+6,Y+9,Y+12]){
    const s=2.1+(1.0-2.1)*(y-Y)/13,ring=corner(y,s);
    for(let i=0;i<4;i++)kit.beam(ring[i],ring[(i+1)%4],.08,red,1,6);
  }
  for(let level=0;level<4;level++){
    const y1=Y+level*3,y2=y1+3,s1=2.1-1.1*(level*3)/13,s2=2.1-1.1*((level+1)*3)/13;
    const a=corner(y1,s1),b=corner(y2,s2);
    for(let i=0;i<4;i++)kit.beam(a[i],b[(i+1)%4],.05,red,1,6);
  }
  kit.add(box(2.6,.15,2.6,1),red,{pos:[h.x,top+.08,h.z]});
  for(const s of [-.5,.5]){
    kit.add(roundUV(new THREE.TorusGeometry(.9,.08,8,32),.6,.08),iron,{pos:[h.x+s,top+1.05,h.z]});
    for(let k=0;k<6;k++){const a=k/6*Math.PI;kit.beam([h.x+s,top+1.05+Math.sin(a)*.85,h.z+Math.cos(a)*.85],[h.x+s,top+1.05-Math.sin(a)*.85,h.z-Math.cos(a)*.85],.025,iron,.6,5);}
  }
  kit.beam([h.x-.7,top+1.05,h.z],[h.x+.7,top+1.05,h.z],.06,iron);
  for(const s of [-1,1])kit.beam([h.x+s*.8,top,h.z-1.0],[h.x+s*1.0,Y,181.9],.12,red,1,6);
  for(const s of [-.5,.5])kit.beam([h.x+s,top+1.9,h.z-.1],[h.x+s*.6,Y+2.6,181.4],.02,kit.plain('wire'));
  kit.add(box(1.2,2.2,1.2,1),iron,{pos:[h.x,Y+2.8,h.z]});
  for(const s of [-.5,.5])kit.beam([h.x+s*.4,Y+3.9,h.z],[h.x+s*.4,top+.9,h.z],.015,kit.plain('wire'));
  kit.add(box(3.4,.4,3.4),kit.tex('retaining-concrete'),{pos:[h.x,Y+.2,h.z],world:2});
}

// ---------- small shrine ----------
function shrine(kit){
  const ver=kit.tex('vermilion-lacquer'),[p1,p2]=props('torii-post');
  for(const p of [p1,p2]){
    kit.add(cyl(.15,2.9,.8,{top:.13,seg:16}),ver,{pos:[p.x,Y+1.45,p.z]});
    kit.add(cyl(.2,.25,.6,{seg:16}),kit.tex('urushi-lacquer'),{pos:[p.x,Y+.12,p.z]});
  }
  const cx=(p1.x+p2.x)/2,z=p1.z;
  kit.add(box(2.4,.16,.2,.8),ver,{pos:[cx,Y+2.4,z]});
  kit.add(box(2.9,.2,.32,.8),ver,{pos:[cx,Y+2.98,z]});
  kit.add(box(3.0,.09,.36,.6),kit.tex('urushi-lacquer'),{pos:[cx,Y+3.12,z]});
  kit.add(box(.14,.5,.12,.8),ver,{pos:[cx,Y+2.66,z]});
  const rope=new THREE.QuadraticBezierCurve3(new THREE.Vector3(p1.x+.12,Y+2.22,z),new THREE.Vector3(cx,Y+1.98,z),new THREE.Vector3(p2.x-.12,Y+2.22,z));
  kit.add(scaleUV(new THREE.TubeGeometry(rope,16,.07,8),4,1),kit.tex('straw-rope'));
  for(const dx of [-.5,0,.5])kit.add(new THREE.PlaneGeometry(.08,.3),kit.tex('washi-paper',{variant:'shide',side:THREE.DoubleSide,emissive:.2}),{pos:[cx+dx,Y+1.88,z]});
  const hk=props('hokora')[0];
  kit.add(box(1.6,.5,1.4,.6),kit.tex('lantern-stone'),{pos:[hk.x,Y+.25,hk.z]});
  kit.add(box(1.0,1.0,.9,.6,{swap:true}),kit.tex('hinoki'),{pos:[hk.x,Y+1.0,hk.z]});
  kit.add(new THREE.PlaneGeometry(.7,.7),kit.tex('vermilion-lacquer'),{pos:[hk.x,Y+1.0,hk.z-.46],rot:[0,Math.PI,0]});
  gableRoof(kit,kit.tex('shrine-copper'),{x1:hk.x-.55,x2:hk.x+.55,z1:hk.z-.5,z2:hk.z+.5,eave:Y+1.5,ridge:Y+1.95,over:.25});
  const ema=props('ema')[0];
  for(const dz of [-.6,.6])kit.add(box(.08,1.7,.08,.6,{swap:true}),kit.tex('hinoki'),{pos:[ema.x,Y+.85,ema.z+dz]});
  kit.add(new THREE.PlaneGeometry(1.2,.8),kit.tex('ema-plaques'),{pos:[ema.x-.03,Y+1.2,ema.z],rot:[0,-Math.PI/2,0]});
  gableRoof(kit,kit.tex('shrine-copper'),{x1:ema.x-.2,x2:ema.x+.2,z1:ema.z-.7,z2:ema.z+.7,eave:Y+1.7,ridge:Y+1.82,over:.1});
  kit.add(box(3.6,1.8,.1,.8),kit.tex('bamboo'),{pos:[37.8,Y+.9,YARD.z2-.15]});
}

// ---------- trees, bamboo, bushes, grass and rocks ----------
function tree(kit,x,z,s,R){
  const y=groundHeight(x,z)-.1;
  kit.add(cyl(.22*s,7*s,1,{top:.12*s,seg:10}),kit.tex('tree-bark'),{pos:[x,y+3.5*s,z]});
  const needles=kit.tex('pine-needles');
  for(const [r,h,o] of [[2.1,3.2,2.6],[1.6,2.6,4.3],[1.0,2.0,5.8]])
    kit.add(roundUV(new THREE.ConeGeometry(r*s,h*s,9),1,r*s),needles,{pos:[x,y+o*s,z],rot:[0,R()*3,0]});
}
function nature(kit,R){
  for(const p of props('tree')){
    tree(kit,p.x,p.z,.9,R);
    kit.add(new THREE.PlaneGeometry(2.4,2.4),kit.tex('fallen-leaves'),{pos:[p.x,Y+.015,p.z],rot:[-Math.PI/2,0,R()*3]});
  }
  for(let placed=0,i=0;placed<46&&i<400;i++){
    const x=-12+R()*72,z=161+R()*54;
    const dx=Math.max(YARD.x1-1.5-x,x-(YARD.x2+1.5),0),dz=Math.max(z-(YARD.z2+1.5),0);
    if(Math.hypot(dx,dz)<1||Math.abs(x-STREAM.x)<2.8)continue;
    if(x>37&&x<48&&z>194&&z<203)continue;
    tree(kit,x,z,.8+R()*.5,R);placed++;
  }
  // bamboo grove behind the shrine
  const bamboo=kit.tex('bamboo');
  for(let i=0;i<60;i++){
    const x=37+R()*10,z=194.8+R()*7.5,r=.04+R()*.03,h=6+R()*3,y=groundHeight(x,z)-.1;
    kit.add(roundUV(new THREE.CylinderGeometry(r,r,h,7),.8,r),bamboo,{pos:[x,y+h/2,z],rot:[(R()-.5)*.1,0,(R()-.5)*.1]});
  }
  const leaf=kit.tex('bush-leaves');
  for(const [x,z,s] of [[10.6,180.6,.8],[17.4,186.6,.7],[19.0,180.3,.6],[9.2,186.4,.9],[22.3,193.2,.6],[25.8,193.2,.6],[39.2,165.0,.7]])
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.25,2.5,x),.6),leaf,{pos:[x,Y+s*.5,z],scale:[s,s*.75,s]});
  const grass=kit.tex('dry-grass');
  for(let i=0;i<30;i++){
    const x=STREAM.x+(R()<.5?-1:1)*(2.7+R()*3),z=162+R()*50,y=groundHeight(x,z);
    kit.add(planarUV(lumpy(new THREE.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2),.2,2,i),1),grass,{pos:[x,y-.05,z],scale:[.7+R()*.5,.6+R()*.4,.7+R()*.5]});
  }
  const granite=kit.tex('granite-outcrop');
  for(let i=0;i<12;i++){
    const x=R()<.5?-10+R()*12:43+R()*16,z=164+R()*48,y=groundHeight(x,z);
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.3,1.3,i+40),1.5),granite,{pos:[x,y,z],scale:[1+R()*1.5,.6+R()*.8,1+R()*1.2],rot:[0,R()*3,0]});
  }
}

// ---------- sky dome and distant mountains (only drawn outdoors) ----------
function sky(kit,group){
  const skyTex=kit.textures.get('sky-clouds'),hills=kit.textures.get('mountain-range');
  const map=skyTex?.map.clone();
  if(map)map.repeat.set(5,2);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(35,32,12,0,Math.PI*2,0,Math.PI*.56),new THREE.MeshBasicMaterial({
    map:map??null,color:map?0xffffff:0x9fc3e6,side:THREE.BackSide,fog:false,depthWrite:false,toneMapped:false}));
  dome.name='Sky dome';dome.renderOrder=-2;dome.frustumCulled=false;dome.visible=false;
  const ridgeMap=hills?.map.clone();
  if(ridgeMap)ridgeMap.repeat.set(3,1);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(33,33,10,64,1,true),new THREE.MeshBasicMaterial({
    map:ridgeMap??null,alphaMap:ridgeMap??null,alphaTest:.08,color:0xdfe7ee,side:THREE.BackSide,fog:false,depthWrite:false,toneMapped:false}));
  band.name='Mountain band';band.renderOrder=-1;band.frustumCulled=false;band.visible=false;
  group.add(dome,band);
  let base=null;
  return (player,camera,scene)=>{
    if(!base)base={fog:scene.fog.color.clone(),density:scene.fog.density,bg:scene.background.clone()};
    const outside=player.x>-20&&player.x<70?smoothstep(INCLINE.z2-2.5,INCLINE.z2+2,player.z):0;
    dome.visible=band.visible=outside>0;
    if(outside>0){
      dome.position.set(camera.position.x,camera.position.y-3,camera.position.z);
      band.position.set(camera.position.x,camera.position.y+.4,camera.position.z);
    }
    scene.fog.color.copy(base.fog).lerp(HAZE,outside);
    scene.fog.density=base.density+(.0095-base.density)*outside;
    scene.background.copy(base.bg).lerp(SKY,outside);
  };
}
