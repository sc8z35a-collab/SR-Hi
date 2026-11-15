import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,scaleUV,lumpy,fbm,rng} from './kit.js';
import {CAVERN,WASHITSU,YOSHITSU,SURFACE,HALL15,SUITES,SUITE_X,SHORE,LAKE} from './cavern-layout.js';
import {Y,RIVER,HQ_ZONE,VILLAGE,PLATEAU,groundHeight as G} from './outdoor-layout.js';

// Extra detail built from the detail-* texture sheets (textures/specs/detail-*.json): mine
// ventilation, gas cylinders, scaffolding and tool boards in the cavern, a pebble shore at the
// lake, furnishings in the living quarters, containers and a food truck on the surface, and
// farm life in the village. Positions come from the layout props (which also give collisions).
// Each texture has a plain colour to fall back on, so the scene still builds without the files.
const FALLBACK={
  'vent-duct':0xd8b23a,'gas-cylinder':0x4f7a72,'scaffold-board':0x9a8462,'tool-pegboard':0x9a9c98,
  'hardhat-shelf':0x8e9294,'lampenflora':0x56664a,'shore-pebbles':0x6d6860,
  'byobu-gold':0xc8a860,'futon-stack':0x8c96a8,'wine-rack':0x4a3428,'kilim-runner':0x9a5a44,
  'notice-board':0xa98a62,'server-front':0x1c1f22,'coat-hooks':0x7d7a72,'woodblock-landscape':0xb9c2b0,
  'container-blue':0x3d5f80,'container-rust':0x7a3a2a,'cement-bags':0xa9a69e,'portable-toilet':0x7fa6c2,
  'ore-heap':0x3a3836,'barrier-plastic':0xd8d4cc,'food-truck':0xcfd3b8,'cedar-planter':0x8a7a68,
  'wrapped-pallet':0xb59a74,'blue-tarp':0x2f63a8,'bamboo-fence':0xa69a62,'well-stone':0x86857c,
  'veg-stall':0x8a6a48,'tetrapod-concrete':0x9a9a94,'silage-wrap':0xe6e6e0,'daikon-drying':0xe8e4d6,
  'airing-futon':0xe8c8c8,'beehive-wood':0x8a8070,
};
const T=(kit,id,opts={})=>kit.tex(id,{fallback:FALLBACK[id],...opts});
const P=(room,type)=>room.props.filter(p=>p.type===type);
const turn=(x,y,z,angle)=>{
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,angle,0));
  return {q,at:(dx,dy,dz)=>new THREE.Vector3(dx,dy,dz).applyQuaternion(q).add(new THREE.Vector3(x,y,z)).toArray()};
};
/** Plane whose UVs show only part of the image: u in [u0,u1], v in [v0,v1]. */
function cropped(w,h,u0,u1,v0,v1){
  const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,u0+(u1-u0)*uv.getX(i),v0+(v1-v0)*uv.getY(i));
  return g;
}
const blob=(kit,material,pos,scale,seed,meters=.8)=>kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.3,2.2,seed),meters),material,{pos,scale});

// ================= underground =================
export function buildUndergroundDetails(kit){
  const R=rng(57);
  ventilation(kit);
  gasRack(kit);
  scaffold(kit,R);
  toolBoard(kit);
  safetyShelf(kit);
  lampenflora(kit,R);
  pebbleShore(kit);
  quarters(kit);
}

function ventilation(kit){
  const steel=kit.tex('dark-steel'),f=P(CAVERN,'vent-fan')[0];
  // axial fan on a low stand, blowing towards the drill rig through a flexible duct
  kit.add(cyl(.34,.9,.6,{seg:20}),kit.tex('vented-aluminum'),{pos:[f.x,.78,f.z],rot:[0,0,Math.PI/2]});
  kit.add(new THREE.CircleGeometry(.3,20),kit.tex('perforated-black'),{pos:[f.x+.455,.78,f.z],rot:[0,Math.PI/2,0]});
  kit.add(box(.84,.04,.6,.5),steel,{pos:[f.x,.42,f.z]});
  for(const dx of [-.36,.36])for(const dz of [-.26,.26])kit.add(box(.05,.42,.05,.5),steel,{pos:[f.x+dx,.21,f.z+dz]});
  kit.add(box(.3,.25,.2,.5),kit.tex('cabinet-enamel'),{pos:[f.x+.1,.3,f.z+.5]});
  const curve=new THREE.CatmullRomCurve3([
    [f.x-.44,.78,f.z],[f.x-.9,.82,f.z+.05],[-4.0,1.9,92.9],[-4.6,3.3,93.8],[-5.3,3.6,95.2],[-5.9,3.6,96.7],[-6.5,3.6,97.4],[-7.0,3.6,97.5],
  ].map(v=>new THREE.Vector3(...v)));
  const length=curve.getLength();
  // flange where the duct enters the drill head's housing
  kit.add(cyl(.27,.1,.5,{seg:16}),steel,{pos:[-6.98,3.6,97.5],rot:[0,0,Math.PI/2]});
  kit.add(scaleUV(new THREE.TubeGeometry(curve,72,.22,14,false),length,1),T(kit,'vent-duct',{side:THREE.DoubleSide}));
  // a steel post carries the duct where it crosses the open floor
  const post=P(CAVERN,'duct-post')[0];
  let best=null;
  for(let i=0;i<=200;i++){
    const p=curve.getPoint(i/200),d=Math.hypot(p.x-post.x,p.z-post.z);
    if(!best||d<best.d)best={d,y:p.y};
  }
  const top=best.y-.22;
  kit.beam([post.x,0,post.z],[post.x,top,post.z],.05,steel);
  kit.add(box(.5,.04,.12,.5),steel,{pos:[post.x,top,post.z]});
  kit.add(box(.35,.05,.35,.5),kit.tex('hazard-stripe'),{pos:[post.x,.025,post.z]});
}

function gasRack(kit){
  const p=P(CAVERN,'gas-rack')[0],steel=kit.tex('dark-steel'),gas=T(kit,'gas-cylinder');
  kit.add(box(p.w,.05,p.d,1),steel,{pos:[p.x,.025,p.z]});
  for(const dx of [-p.w/2+.04,p.w/2-.04])for(const dz of [-.24,.24])kit.add(box(.05,1.25,.05,.5),steel,{pos:[p.x+dx,.65,p.z+dz]});
  for(const y of [.75,1.15])kit.add(box(p.w,.04,.04,.5),steel,{pos:[p.x,y,p.z-.25]});
  for(let i=0;i<5;i++){
    const x=p.x-.5+i*.25,z=p.z+(i%2?.04:-.02);
    kit.add(cyl(.115,1.3,.6,{seg:18}),gas,{pos:[x,.7,z]});
    kit.add(new THREE.SphereGeometry(.115,18,8,0,Math.PI*2,0,Math.PI/2),gas,{pos:[x,1.35,z]});
    kit.add(cyl(.035,.14,.3,{seg:8}),kit.tex('brass-antique'),{pos:[x,1.52,z]});
  }
}

function scaffold(kit,R){
  const p=P(CAVERN,'scaffold')[0],tube=kit.tex('galvanized-spangle'),board=T(kit,'scaffold-board');
  const x1=p.x-p.w/2+.05,x2=p.x+p.w/2-.05,z1=p.z-p.d/2+.05,z2=p.z+p.d/2-.05,H=3.9;
  for(const x of [x1,x2])for(const z of [z1,z2])kit.beam([x,0,z],[x,H,z],.024,tube,.6,6);
  for(const y of [.15,1.3,2.5,3.7]){
    for(const z of [z1,z2])kit.beam([x1,y,z],[x2,y,z],.022,tube,.6,6);
    for(const x of [x1,x2])kit.beam([x,y,z1],[x,y,z2],.022,tube,.6,6);
  }
  for(const z of [z1,z2])kit.beam([x1,.15,z],[x2,2.5,z],.02,tube,.6,6);
  for(const x of [x1,x2])for(const z of [z1,z2])kit.add(box(.16,.02,.16,.3),kit.tex('dark-steel'),{pos:[x,.01,z]});
  for(const y of [1.3,2.5,3.7]){
    kit.add(box(p.w-.05,.05,p.d-.1,1),board,{pos:[p.x,y+.05,p.z],world:1});
    for(const z of [z1,z2])kit.add(box(p.w-.05,.15,.03,1),board,{pos:[p.x,y+.15,z],world:1});
  }
  // ladder on the open side, a bucket and a coil of cable on the top deck
  for(const dz of [-.2,.2])kit.beam([x1-.12,0,p.z+dz],[x1-.12,3.75,p.z+dz],.022,kit.tex('fiberglass-yellow'),.5,6);
  for(let y=.3;y<3.7;y+=.3)kit.beam([x1-.12,y,p.z-.2],[x1-.12,y,p.z+.2],.016,kit.tex('fiberglass-yellow'),.5,5);
  kit.add(cyl(.14,.28,.5,{top:.17,seg:14}),kit.tex('orange-plastic'),{pos:[p.x+.5,3.89,p.z+.1]});
  kit.add(roundUV(new THREE.TorusGeometry(.2,.05,8,18),.4,.05),kit.tex('cable-bundle'),{pos:[p.x-.3,3.81,p.z],rot:[Math.PI/2,0,R()]});
}

function toolBoard(kit){
  const p=P(CAVERN,'pegboard')[0],steel=kit.tex('dark-steel');
  for(const dx of [-.76,.76]){
    kit.add(box(.05,1.95,.05,.5),steel,{pos:[p.x+dx,.975,p.z]});
    kit.add(box(.06,.05,.6,.5),steel,{pos:[p.x+dx,.025,p.z]});
  }
  kit.add(box(1.5,1.05,.03,1),kit.tex('rack-powder'),{pos:[p.x,1.35,p.z+.01]});
  kit.add(new THREE.PlaneGeometry(1.46,1.0),T(kit,'tool-pegboard'),{pos:[p.x,1.35,p.z-.008],rot:[0,Math.PI,0]});
  kit.add(box(1.5,.04,.3,1),steel,{pos:[p.x,.75,p.z-.13]});
}

function safetyShelf(kit){
  const p=P(CAVERN,'hardhats')[0];
  kit.add(box(p.w,1.8,p.d,1),kit.tex('rack-powder'),{pos:[p.x,.9,p.z]});
  kit.add(new THREE.PlaneGeometry(p.w-.06,1.74),T(kit,'hardhat-shelf'),{pos:[p.x,.9,p.z-p.d/2-.004],rot:[0,Math.PI,0]});
  const shell=new THREE.SphereGeometry(.13,14,8,0,Math.PI*2,0,Math.PI/2);
  kit.add(shell,kit.tex('fiberglass-yellow'),{pos:[p.x-.3,1.8,p.z]});
  kit.add(shell,kit.tex('white-composite'),{pos:[p.x+.1,1.8,p.z+.05]});
}

function lampenflora(kit,R){
  // green algae and moss grow only where the lamps shine: around the mast feet and stalagmites
  const moss=T(kit,'lampenflora',{variant:'patch'});
  for(const p of P(CAVERN,'mast'))for(let i=0;i<3;i++){
    const a=i*2.1+R(),r=.55+R()*.35;
    blob(kit,moss,[p.x+Math.cos(a)*r,.01,p.z+Math.sin(a)*r],[.35+R()*.3,.03,.3+R()*.25],i+p.x*3);
  }
  for(const p of P(CAVERN,'stalagmite'))blob(kit,moss,[p.x,.03,p.z],[p.w*.75,.07,p.d*.75],p.z);
}

function pebbleShore(kit){
  // a band of wet pebbles along the waterline, following the shore's slope into the lake
  const pebbles=T(kit,'shore-pebbles');
  for(const [xa,xb] of [[-12,-1.15],[1.15,12]]){
    const w=xb-xa,g=new THREE.PlaneGeometry(w,1.9,Math.ceil(w*2),8);
    g.rotateX(-Math.PI/2);g.translate((xa+xb)/2,0,SHORE+.15);
    const pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i);let z=pos.getZ(i);
      if(Math.abs(z-(SHORE+.15))>.9)z+=(fbm(x*.7,3,z)-.5)*.8;
      const inside=((x-LAKE.cx)/(LAKE.rx-1.6))**2+((z-LAKE.cz)/(LAKE.rz-1.6))**2;
      const y=(z>SHORE?-Math.min(1,(z-SHORE)/2.6)*.95:0)+.035-(inside>1?.06:0);
      pos.setXYZ(i,x,y,z);
    }
    g.computeVertexNormals();
    kit.add(g,pebbles,{world:1});
  }
}

function quarters(kit){
  const h=HALL15,lacquer=kit.tex('urushi-lacquer'),walnut=kit.tex('walnut-veneer');
  // 和室: a six-fold gold screen in front of the closet, folded futons in the corner
  const b=P(WASHITSU,'byobu')[0],gold=T(kit,'byobu-gold'),pw=.46,a=.35,step=pw*Math.cos(a),dz=pw*Math.sin(a);
  const hinge=k=>[b.x-3*step+k*step,b.z+(k%2?-dz/2:dz/2)];
  for(let i=0;i<6;i++){
    const [xa,za]=hinge(i),[xb,zb]=hinge(i+1),cx=(xa+xb)/2,cz=(za+zb)/2,ang=Math.atan2(-(zb-za),xb-xa);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ang,0));
    kit.add(cropped(pw,1.3,i/6,(i+1)/6,.18,.82),gold,{pos:[cx,.67,cz],quat:q});
    kit.add(box(pw,1.36,.018,.5),lacquer,{pos:[cx-Math.sin(ang)*.012,.67,cz-Math.cos(ang)*.012],quat:q});
    for(const y of [.02,1.33])kit.add(box(pw,.03,.03,.5),lacquer,{pos:[cx,y,cz],quat:q});
  }
  const f=P(WASHITSU,'futon')[0];
  kit.add(new THREE.BoxGeometry(f.w,.62,f.d),T(kit,'futon-stack'),{pos:[f.x,.31,f.z]});
  kit.add(box(f.w+.02,.07,f.d+.02,.8),T(kit,'airing-futon'),{pos:[f.x,.655,f.z]});
  kit.add(box(.4,.1,.25,.4),kit.tex('washi-paper'),{pos:[f.x,.74,f.z-.2]});
  // 洋室: wine rack beside the door
  const w=P(YOSHITSU,'wine-rack')[0],wx=SUITE_X.x1+.17;
  kit.add(box(.3,1.2,w.d,.6),walnut,{pos:[wx,.6,w.z]});
  kit.add(new THREE.PlaneGeometry(w.d-.06,1.1),T(kit,'wine-rack'),{pos:[wx+.152,.6,w.z],rot:[0,Math.PI/2,0]});
  const bottle=kit.plain('bottle-glass',{color:0x23392b,roughness:.15,metalness:.1});
  for(const dz of [-.3,-.18,.25])kit.add(cyl(.036,.3,.3,{seg:10}),bottle,{pos:[wx,1.35,w.z+dz]});
  // living corridor: kilim runner, notice board, coat hooks
  const runner=scaleUV(new THREE.PlaneGeometry(1.0,(h.z2-h.z1)-2.4),1,(h.z2-h.z1)-2.4);
  kit.add(runner,T(kit,'kilim-runner'),{pos:[(h.x1+h.x2)/2,.008,(h.z1+h.z2)/2],rot:[-Math.PI/2,0,0]});
  kit.add(box(.03,.98,1.28,1),walnut,{pos:[h.x1+.025,1.55,92.3]});
  kit.add(new THREE.PlaneGeometry(1.2,.9),T(kit,'notice-board'),{pos:[h.x1+.042,1.55,92.3],rot:[0,Math.PI/2,0]});
  kit.add(new THREE.PlaneGeometry(1.2,1.2),T(kit,'coat-hooks'),{pos:[h.x2-.035,1.4,92.8],rot:[0,-Math.PI/2,0]});
  kit.add(box(.04,.08,1.26,.6),kit.tex('hinoki'),{pos:[h.x2-.04,2.04,92.8]});
  kit.add(box(.36,.05,1.1,.6),kit.tex('rubber-tread'),{pos:[h.x2-.2,.025,92.8]});
  // 会議室: a framed woodblock print on the felt wall
  const m=SUITES['18'];
  kit.add(box(1.0,1.0,.03,1),walnut,{pos:[28.6,1.6,m.z2-.035]});
  kit.add(new THREE.PlaneGeometry(.9,.9),T(kit,'woodblock-landscape'),{pos:[28.6,1.6,m.z2-.052],rot:[0,Math.PI,0]});
}

/** Server faces for two of the control-room racks (called from the hut builder). */
export function serverFront(kit,x,y,z){
  kit.add(scaleUV(new THREE.PlaneGeometry(.54,1.9),1,3),T(kit,'server-front'),{pos:[x,y,z],rot:[0,-Math.PI/2,0]});
}

// ================= surface and outdoors =================
export function buildOutdoorDetails(kit){
  const R=rng(58);
  yard(kit,R);
  plaza(kit,R);
  village(kit,R);
  riverbank(kit,R);
  plateau(kit,R);
}

function yard(kit,R){
  const steel=kit.tex('dark-steel');
  // two shipping containers, one stacked on the other
  const c=P(SURFACE,'containers')[0],L=6.06,H=2.59,W=2.44;
  for(const [id,y,dx,rot] of [['container-blue',0,0,0],['container-rust',H,.35,.03]]){
    const {at,q}=turn(c.x+dx,Y+y,c.z,rot);
    kit.add(box(L,H,W,2.4),T(kit,id),{pos:at(0,H/2,0),quat:q});
    for(const sx of [-1,1])for(const sy of [0,1])for(const sz of [-1,1])
      kit.add(box(.18,.12,.18,.3),steel,{pos:at(sx*(L/2-.08),sy*(H-.12)+.06,sz*(W/2-.08)),quat:q});
    for(const dz of [-.75,-.3,.3,.75])kit.add(cyl(.025,H-.2,.5,{seg:6}),steel,{pos:at(L/2+.03,H/2,dz),quat:q});
  }
  // cement on a pallet, a stretch-wrapped pallet of boxes
  const ce=P(SURFACE,'cement')[0];
  kit.add(box(ce.w,.14,ce.d,1),kit.tex('pallet-wood'),{pos:[ce.x,Y+.07,ce.z]});
  kit.add(new THREE.BoxGeometry(ce.w-.1,.8,ce.d-.1),T(kit,'cement-bags'),{pos:[ce.x,Y+.54,ce.z]});
  const wp=P(SURFACE,'wrapped-pallet')[0];
  kit.add(box(wp.w,.14,wp.d,1),kit.tex('pallet-wood'),{pos:[wp.x,Y+.07,wp.z]});
  kit.add(new THREE.BoxGeometry(wp.w-.05,1.0,wp.d-.05),T(kit,'wrapped-pallet'),{pos:[wp.x,Y+.64,wp.z]});
  // portable toilet beside the guardhouse
  const tt=P(SURFACE,'toilet')[0],plastic=T(kit,'portable-toilet');
  kit.add(box(1.1,2.2,1.1,1),plastic,{pos:[tt.x,Y+1.1,tt.z]});
  kit.add(box(1.2,.08,1.2,1),kit.tex('white-composite'),{pos:[tt.x,Y+2.24,tt.z]});
  kit.add(box(.02,1.9,.8,1),T(kit,'portable-toilet',{variant:'door',color:0xdfe9ef}),{pos:[tt.x+.56,Y+1.05,tt.z]});
  kit.add(box(.04,.12,.04,.3),steel,{pos:[tt.x+.58,Y+1.1,tt.z+.3]});
  kit.beam([tt.x-.45,Y+2.2,tt.z-.45],[tt.x-.45,Y+2.6,tt.z-.45],.045,kit.tex('molded-plastic'));
  // ore heap by the headframe
  const o=P(SURFACE,'ore-heap')[0],ore=T(kit,'ore-heap');
  const heap=planarUV(lumpy(new THREE.SphereGeometry(1,28,12,0,Math.PI*2,0,Math.PI/2),.16,1.7,7),2);
  kit.add(heap,ore,{pos:[o.x,Y-.04,o.z],scale:[o.w/2,1.0,o.d/2],rot:[0,.4,0]});
  for(let i=0;i<8;i++){
    const a=R()*Math.PI*2,r=1.0+R()*.6;
    kit.add(planarUV(lumpy(new THREE.DodecahedronGeometry(1,0),.1,2,i),.6),ore,{pos:[o.x+Math.cos(a)*r*o.w/2,Y+.08,o.z+Math.sin(a)*r*o.d/2],scale:.12+R()*.1,rot:[R()*3,R()*3,0]});
  }
  // water-filled plastic barriers along the gate road
  const br=P(SURFACE,'barriers')[0],barrier=T(kit,'barrier-plastic');
  for(const dz of [-.6,.6]){
    kit.add(box(.48,.55,1.16,1),barrier,{pos:[br.x,Y+.275,br.z+dz]});
    kit.add(box(.28,.3,1.16,1),barrier,{pos:[br.x,Y+.7,br.z+dz]});
  }
}

function plaza(kit,R){
  // food truck parked at the east edge of the plaza, hatch facing the fountain
  const t=P(HQ_ZONE,'food-truck')[0],y=G(t.x,t.z),body=kit.tex('white-composite');
  const bz=t.z-.7,cz=t.z+1.8;
  kit.add(box(2.2,2.3,3.6,1),body,{pos:[t.x,y+1.65,bz]});
  kit.add(cropped(3.5,2.1,0,1,.14,.86),T(kit,'food-truck'),{pos:[t.x-1.106,y+1.62,bz],rot:[0,-Math.PI/2,0]});
  kit.add(box(2.1,1.5,1.4,1),kit.tex('car-white'),{pos:[t.x,y+1.25,cz]});
  kit.add(new THREE.PlaneGeometry(1.9,.7),kit.tex('car-glass'),{pos:[t.x,y+1.6,cz+.705]});
  for(const s of [-1,1])kit.add(new THREE.PlaneGeometry(.9,.55),kit.tex('car-glass'),{pos:[t.x+s*1.056,y+1.62,cz+.2],rot:[0,s*Math.PI/2,0]});
  for(const dz of [-1.6,1.6])for(const s of [-1,1])kit.add(cyl(.36,.26,.6,{seg:16}),kit.tex('tire-rubber'),{pos:[t.x+s*.98,y+.36,t.z+dz],rot:[0,0,Math.PI/2]});
  kit.add(box(2.0,.3,4.9,1),kit.tex('dark-steel'),{pos:[t.x,y+.5,t.z]});
  kit.add(box(.9,.03,2.8,1),kit.tex('parasol-canvas'),{pos:[t.x-1.5,y+2.55,bz],rot:[0,0,-.25]});
  kit.add(box(.4,.04,2.6,.6),kit.tex('cafe-table'),{pos:[t.x-1.3,y+1.1,bz]});
  // cedar planters flanking the walk from the road
  for(const p of P(HQ_ZONE,'planter-box')){
    const py=G(p.x,p.z);
    kit.add(box(p.w,.55,p.d,1),T(kit,'cedar-planter'),{pos:[p.x,py+.275,p.z]});
    kit.add(box(p.w-.1,.04,p.d-.1,1),kit.tex('field-soil'),{pos:[p.x,py+.54,p.z]});
    for(let i=0;i<3;i++)blob(kit,kit.tex('hedge-privet',{variant:'shrub',side:THREE.DoubleSide}),[p.x-.5+i*.5,py+.75,p.z],[.32,.3+R()*.08,.26],i+p.x,1);
  }
}

function village(kit,R){
  // blue tarp over a heap of farm odds and ends between the storehouse and the farmhouse
  const tp=P(VILLAGE,'tarp-pile')[0],ty=G(tp.x,tp.z);
  const g=new THREE.BoxGeometry(tp.w,1.0,tp.d,12,6,8),v=new THREE.Vector3(),pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i);
    const n=fbm(v.x*1.5,v.y*1.5,v.z*1.5)-.5;
    if(v.y>.3)v.y-=.08+n*.2;
    v.x*=1+n*.06+(v.y<-.3?.06:0);v.z*=1+n*.08+(v.y<-.3?.1:0);
    pos.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();
  kit.add(planarUV(g,1),T(kit,'blue-tarp'),{pos:[tp.x,ty+.5,tp.z],rot:[0,.2,0]});
  for(const dx of [-.5,.5])kit.add(roundUV(new THREE.TorusGeometry(.3,.1,8,18),.6,.1),kit.tex('tire-rubber'),{pos:[tp.x+dx,ty+.9,tp.z],rot:[Math.PI/2,0,0]});
  // split-bamboo garden fence
  const bf=P(VILLAGE,'bamboo-fence')[0],by=G(bf.x,bf.z),bamboo=kit.tex('bamboo');
  kit.add(box(bf.w,1.4,.06,1),T(kit,'bamboo-fence'),{pos:[bf.x,by+.7,bf.z]});
  for(let x=bf.x-bf.w/2;x<=bf.x+bf.w/2+.01;x+=bf.w/4)kit.beam([x,by,bf.z],[x,by+1.55,bf.z],.045,bamboo,.6,8);
  kit.beam([bf.x-bf.w/2,by+1.45,bf.z+.05],[bf.x+bf.w/2,by+1.45,bf.z+.05],.03,bamboo,.6,8);
  // stone well with a wooden lid and a little roof
  const w=P(VILLAGE,'well')[0],wy=G(w.x,w.z),stone=T(kit,'well-stone'),wood=kit.tex('timber-beam');
  kit.add(cyl(.62,.75,1,{seg:22}),stone,{pos:[w.x,wy+.375,w.z]});
  for(const dz of [-.17,.17])kit.add(box(1.3,.05,.32,.6),kit.tex('pier-planks'),{pos:[w.x,wy+.78,w.z+dz]});
  for(const dx of [-.66,.66])kit.add(box(.1,2.2,.1,.6,{swap:true}),wood,{pos:[w.x+dx,wy+1.1,w.z]});
  kit.add(box(1.5,.08,.1,.6),wood,{pos:[w.x,wy+2.0,w.z]});
  for(const s of [-1,1])kit.add(box(1.7,.05,.6,1),kit.tex('kokera-shingle'),{pos:[w.x,wy+2.32,w.z+s*.26],rot:[s*.55,0,0]});
  kit.add(cyl(.09,.06,.3,{seg:12}),wood,{pos:[w.x,wy+1.9,w.z],rot:[0,0,Math.PI/2]});
  kit.beam([w.x,wy+1.85,w.z],[w.x,wy+1.0,w.z],.008,kit.tex('straw-rope'),.3,4);
  kit.add(cyl(.12,.22,.4,{seg:12}),kit.tex('barrel-staves'),{pos:[w.x+.35,wy+.92,w.z+.18]});
  // unmanned vegetable stall by the road
  const s=P(VILLAGE,'veg-stall')[0],sy=G(s.x,s.z);
  for(const dz of [-.75,.75])for(const dx of [-.35,.35])kit.add(box(.07,1.9,.07,.6),wood,{pos:[s.x+dx,sy+.95,s.z+dz]});
  kit.add(box(.06,1.5,1.5,1),kit.tex('yakisugi'),{pos:[s.x+.34,sy+1.05,s.z]});
  kit.add(new THREE.PlaneGeometry(1.45,1.2),T(kit,'veg-stall'),{pos:[s.x+.3,sy+1.25,s.z],rot:[0,-Math.PI/2,0]});
  kit.add(box(.7,.04,1.5,1),kit.tex('pier-planks'),{pos:[s.x,sy+.62,s.z]});
  kit.add(box(1.0,.04,1.9,1),kit.tex('kokera-shingle'),{pos:[s.x-.05,sy+1.95,s.z],rot:[0,0,.18]});
  kit.add(box(.14,.18,.12,.3),kit.tex('cabinet-enamel'),{pos:[s.x-.2,sy+.73,s.z+.6]});
  // daikon drying on the farmhouse's east wall
  const house=P(VILLAGE,'house')[0],hx=house.x+house.w/2-.2+.13,hy=G(house.x,house.z);
  for(const dz of [-.75,.75])kit.add(new THREE.PlaneGeometry(1.45,1.6),T(kit,'daikon-drying'),{pos:[hx,hy+1.75,house.z+dz],rot:[0,Math.PI/2,0]});
  kit.beam([hx+.12,hy+2.6,house.z-1.6],[hx+.12,hy+2.6,house.z+1.6],.035,bamboo,.6,8);
  for(const dz of [-1.45,1.45])kit.add(box(.14,.05,.05,.3),wood,{pos:[hx+.06,hy+2.6,house.z+dz]});
  // futons airing on a laundry pole in front of the farmhouse
  const fp=P(VILLAGE,'futon-pole')[0],fy=G(fp.x,fp.z),galv=kit.tex('galvanized-spangle');
  for(const dx of [-1.4,1.4]){
    kit.beam([fp.x+dx,fy,fp.z],[fp.x+dx,fy+1.75,fp.z],.03,galv,.6,6);
    kit.beam([fp.x+dx,fy+.02,fp.z-.3],[fp.x+dx,fy+.02,fp.z+.3],.03,galv,.6,6);
  }
  kit.beam([fp.x-1.6,fy+1.7,fp.z],[fp.x+1.6,fy+1.7,fp.z],.025,bamboo,.6,8);
  const futon=T(kit,'airing-futon',{variant:'hung',side:THREE.DoubleSide});
  for(const dx of [-.65,.65])for(const s of [-1,1])kit.add(box(1.0,.95,.04,1),futon,{pos:[fp.x+dx+R()*.1,fy+1.22,fp.z+s*.06],rot:[s*.07,0,0]});
  // Japanese honeybee hives at the edge of the fields
  const hv=P(VILLAGE,'hives')[0];
  for(let i=0;i<3;i++){
    const x=hv.x-1.1+i*1.1,z=hv.z+(R()-.5)*.2,y=G(x,z),hgt=.6+(i%2)*.2;
    kit.add(box(.4,.2,.2,.4),kit.tex('cinder-block'),{pos:[x,y+.1,z]});
    kit.add(new THREE.BoxGeometry(.42,hgt,.42),T(kit,'beehive-wood'),{pos:[x,y+.2+hgt/2,z],rot:[0,(R()-.5)*.3,0]});
    kit.add(box(.6,.04,.6,1),kit.tex('rusty-corrugated'),{pos:[x,y+.22+hgt,z],rot:[.08,0,0]});
    blob(kit,kit.tex('granite-outcrop',{variant:'stone'}),[x,y+.3+hgt,z],[.1,.07,.09],i+3,.5);
  }
}

function riverbank(kit,R){
  // concrete tetrapods at the outer bend below the iron bridge, half sunk at the waterline
  const concrete=T(kit,'tetrapod-concrete'),up=new THREE.Vector3(0,1,0);
  const legs=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(d=>new THREE.Vector3(...d).normalize());
  const leg=new THREE.CylinderGeometry(.17,.32,1.0,9);
  const place=(x,z)=>{
    const turn=new THREE.Quaternion().setFromEuler(new THREE.Euler(R()*3,R()*3,R()*3));
    const c=new THREE.Vector3(x,G(x,z)-.15,z);
    kit.add(new THREE.SphereGeometry(.34,12,8),concrete,{pos:c.toArray(),world:1.5});
    for(const d of legs){
      const dir=d.clone().applyQuaternion(turn);
      kit.add(leg,concrete,{pos:c.clone().addScaledVector(dir,.55).toArray(),quat:new THREE.Quaternion().setFromUnitVectors(up,dir),world:1.5});
    }
  };
  for(let x=50.5;x<=59.5;x+=1.5)place(x+(R()-.5)*.4,RIVER.z(x)-5.7+(R()-.5)*.5);
  for(let x=51.5;x<=56;x+=1.5)place(x+(R()-.5)*.4,RIVER.z(x)+5.6+(R()-.5)*.5);
}

function plateau(kit,R){
  // wrapped silage bales lying in the meadow
  for(const p of P(PLATEAU,'silage')){
    const y=G(p.x,p.z);
    kit.add(roundUV(new THREE.CylinderGeometry(.7,.7,1.2,26),1.5,.7),T(kit,'silage-wrap'),{pos:[p.x,y+.68,p.z],rot:[0,R()*Math.PI,Math.PI/2,'YXZ']});
  }
}
