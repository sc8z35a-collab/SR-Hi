import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,scaleUV,lumpy,rng,kiosk,blobGeometry} from './kit.js';
import {Y,PARK,PARK_FLAT,POND,PARK_ZONE,PARK_TREES,groundHeight as G} from './outdoor-layout.js';

// 26 中央公園: a large park at the west end of the avenue, built from the park-* sheets.
// North: lily pond with an arched bridge, wetland boardwalk, gazebo, flower beds, playground,
// wisteria trellis, office and toilets. Middle: entrance plaza with a fountain. South: running
// track around a turf field, bleacher, basketball and gateball courts and a batting cage.
// West slope: forest walk with keyaki and kunugi, a bamboo grove, silver grass and a jogging path.
const P=type=>PARK_ZONE.props.filter(p=>p.type===type);
const DS={side:THREE.DoubleSide};
/** A flat patch lying on the levelled ground. */
function patch(kit,id,x1,x2,z1,z2,{lift=.02,meters,opts}={}){
  const g=new THREE.PlaneGeometry(x2-x1,z2-z1).rotateX(-Math.PI/2);
  kit.add(g,kit.tex(id,opts),{pos:[(x1+x2)/2,Y+lift,(z1+z2)/2],world:meters??1});
}
/** A patch that follows the ground (the slope of the forest walk). */
function groundPatch(kit,id,x1,x2,z1,z2,{lift=.04,meters=1,step=1,opts}={}){
  const nx=Math.max(1,Math.ceil((x2-x1)/step)),nz=Math.max(1,Math.ceil((z2-z1)/step));
  const g=new THREE.PlaneGeometry(x2-x1,z2-z1,nx,nz).rotateX(-Math.PI/2);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i)+(x1+x2)/2,z=p.getZ(i)+(z1+z2)/2;p.setXYZ(i,x,G(x,z)+lift,z);}
  g.computeVertexNormals();
  kit.add(planarUV(g,meters),kit.tex(id,opts));
}
const disc=(kit,id,x,z,r,{lift=.025,meters=1,y=null}={})=>
  kit.add(new THREE.CircleGeometry(r,20).rotateX(-Math.PI/2),kit.tex(id),{pos:[x,(y??G(x,z))+lift,z],world:meters});
const blob=(kit,id,pos,scale,seed,{variant='blob',meters=1}={})=>
  kit.add(planarUV(lumpy(blobGeometry(),.28,2.2,seed),meters),kit.tex(id,{variant,...DS}),{pos,scale});

export function buildPark(kit,group){
  const R=rng(26);
  paths(kit);
  pond(kit,R);
  plaza(kit,group);
  playground(kit);
  garden(kit,R);
  buildings(kit);
  sports(kit);
  forest(kit,R);
  trees(kit,R);
  kiosk(kit,group,PARK_ZONE,[PARK_ZONE.terminal[0],Y,PARK_ZONE.terminal[1]],Math.PI);
}

function paths(kit){
  const wa='park-washed-aggregate',masa='park-masa-soil';
  patch(kit,wa,PARK_FLAT.x1,PARK_FLAT.x2,164.5,166.5,{meters:1});        // north path
  patch(kit,wa,-15.2,-12.8,166.5,202,{meters:1});                         // main north-south path
  patch(kit,wa,-34,-22,207.5,209.5,{meters:1});                           // west path to the forest
  patch(kit,'park-interlocking',-22,-14,202,214,{meters:1.2,lift:.025});  // entrance plaza
  patch(kit,masa,-17,1.5,214,215.6,{meters:1.5});                         // walkway along the courts
  patch(kit,masa,-21.8,-15.2,188.4,190,{meters:1.5});                     // pond garden path
  patch(kit,masa,-30.8,-21.8,188.4,190,{meters:1.5});
  patch(kit,masa,-30.8,-29.2,190,194.5,{meters:1.5});
  patch(kit,'park-crazy-paving',-22.5,-19.5,185.8,188.4,{meters:1.5,lift:.03});
  // granite stepping stones from the north path to the bridge
  for(const [z,dx] of [[167.6,.2],[168.9,-.25],[170.2,.15],[171.5,-.2],[172.8,.2]])
    kit.add(new THREE.CylinderGeometry(.34,.38,.08,10),kit.tex('park-granite'),{pos:[-21+dx,Y+.04,z],world:1});
  // sleeper steps up the slope to the forest walk
  groundPatch(kit,'park-sleeper-steps',-40,-34,207.5,209.5,{meters:2,lift:.05,opts:{variant:'steps'}});
}

function pond(kit,R){
  const {x,z,rx,rz}=POND;
  // water at the rim's height (the lily pads read as a pond from eye level), a stone revetment and coping
  kit.add(new THREE.CircleGeometry(1,40).rotateX(-Math.PI/2).scale(rx,1,rz),kit.tex('park-lily-pond'),{pos:[x,Y+.06,z],world:4});
  kit.add(roundUV(new THREE.CylinderGeometry(1,1,.42,40,1,true),2,1).scale(rx+.12,1,rz+.12),kit.tex('park-stone-revetment'),{pos:[x,Y+.08,z]});
  kit.add(new THREE.RingGeometry(1,1.1,40,1).rotateX(-Math.PI/2).scale(rx+.1,1,rz+.1),kit.tex('park-granite'),{pos:[x,Y+.3,z],world:1});
  // arched vermilion bridge across the middle
  const red=kit.tex('park-red-bridge'),z1=z-rz-.9,z2=z+rz+.9,n=14,rise=.42;
  const at=t=>[x,Y+.08+Math.sin(t*Math.PI)*rise,z1+(z2-z1)*t];
  for(let k=0;k<n;k++){
    const a=at(k/n),b=at((k+1)/n),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],len=Math.hypot(b[1]-a[1],b[2]-a[2]);
    kit.add(box(1.5,.08,len+.02,1.2),red,{pos:mid,rot:[-Math.atan2(b[1]-a[1],b[2]-a[2]),0,0]});
  }
  for(const side of [-.72,.72]){
    for(let k=0;k<=n;k+=2){const p=at(k/n);kit.beam([x+side,p[1],p[2]],[x+side,p[1]+.75,p[2]],.045,red,.6,8);}
    for(let k=0;k<n;k++){const a=at(k/n),b=at((k+1)/n);kit.beam([x+side,a[1]+.75,a[2]],[x+side,b[1]+.75,b[2]],.04,red,.6,8);}
  }
  // wooden deck at the east tip, bamboo water spout and stone basin on the north bank
  const deck=kit.tex('park-deck');
  kit.add(box(3,.12,4,1.2),deck,{pos:[-13.5,Y+.1,z]});
  for(const [dx,dz] of [[-1.4,-1.9],[1.4,-1.9],[-1.4,1.9],[1.4,1.9]])kit.beam([-13.5+dx,Y+.16,z+dz],[-13.5+dx,Y+.95,z+dz],.04,deck,.6,6);
  const bamboo=kit.tex('park-bamboo');
  kit.beam([-25,Y,173.4],[-25,Y+1.0,173.4],.05,bamboo,.6,8);
  kit.beam([-25,Y+.95,173.4],[-25,Y+.85,174.9],.035,bamboo,.6,8);
  kit.add(cyl(.32,.4,.8,{seg:14,top:.36}),kit.tex('park-granite',{variant:'basin'}),{pos:[-25,Y+.2,175.0]});
  kit.add(new THREE.CircleGeometry(.26,14).rotateX(-Math.PI/2),kit.tex('fountain-water'),{pos:[-25,Y+.39,175.0]});
  // wetland on the west bank: mud, wet moss, irises and a boardwalk
  patch(kit,'park-pond-bed',-33,-28,171,188,{meters:1.5,lift:.025});
  for(let i=0;i<9;i++)disc(kit,'park-wet-moss',-32.6+R()*4,171.5+i*1.9,.7+R()*.4,{lift:.03});
  for(let i=0;i<14;i++)blob(kit,'park-iris',[-32.4+R()*4.2,Y+.3,171.8+R()*15.6],[.35+R()*.15,.45+R()*.15,.35],i,{variant:'iris'});
  for(let i=0;i<6;i++)blob(kit,'park-iris',[x-rx-.3+R()*.4,Y+.32,z-3+i*1.2],[.3,.4,.3],i+20,{variant:'iris'});
  const walk=kit.tex('park-boardwalk');
  kit.add(box(1.4,.08,19,1.2),walk,{pos:[-30.7,Y+.28,180.5]});
  for(let zz=171.5;zz<190;zz+=2.4)for(const dx of [-.6,.6])kit.beam([-30.7+dx,Y,zz],[-30.7+dx,Y+.25,zz],.05,walk,.6,6);
  for(let i=0;i<5;i++)blob(kit,'park-hydrangea',[-26.6+i*1.0,Y+.45,187.4],[.6,.5,.55],i+30,{variant:'shrub'});
  for(let i=0;i<4;i++)blob(kit,'park-hydrangea',[-19.2+i*1.0,Y+.45,187.4],[.55,.5,.55],i+40,{variant:'shrub'});
  patch(kit,'park-mulch',-27.2,-22.4,186.7,188.1,{lift:.022});
  patch(kit,'park-mulch',-19.6,-15.9,186.7,188.1,{lift:.022});
}

function plaza(kit){
  // fountain: granite basin lined with blue tiles; still water (nothing in the park moves)
  const f=P('fountain')[0],granite=kit.tex('park-granite');
  kit.add(roundUV(new THREE.CylinderGeometry(2.3,2.35,.5,28,1,true),1,2.3),granite,{pos:[f.x,Y+.25,f.z]});
  kit.add(roundUV(new THREE.CylinderGeometry(2.05,2.05,.45,28,1,true),.6,2.05),kit.tex('park-fountain-tile',DS),{pos:[f.x,Y+.25,f.z]});
  kit.add(new THREE.RingGeometry(2.05,2.35,28,1).rotateX(-Math.PI/2),granite,{pos:[f.x,Y+.5,f.z],world:1});
  kit.add(new THREE.CircleGeometry(2.05,28).rotateX(-Math.PI/2),kit.tex('park-fountain-tile',{variant:'floor'}),{pos:[f.x,Y+.06,f.z],world:.6});
  kit.add(new THREE.CircleGeometry(2.05,28).rotateX(-Math.PI/2),kit.tex('fountain-water',{variant:'park'}),{pos:[f.x,Y+.36,f.z],world:2});
  kit.add(cyl(.35,1.0,1,{seg:14,top:.25}),granite,{pos:[f.x,Y+.5,f.z]});
  kit.add(cyl(.75,.12,1,{seg:20,top:.85}),granite,{pos:[f.x,Y+1.05,f.z]});
  // rose arch where the west path leaves the plaza
  const steel=kit.tex('park-cast-iron');
  for(const z of [206.7,210.3])kit.beam([-22.6,Y,z],[-22.6,Y+2.2,z],.04,steel,.5,8);
  const arch=new THREE.TorusGeometry(1.8,.04,6,16,Math.PI);
  kit.add(arch,steel,{pos:[-22.6,Y+2.2,208.5],rot:[0,Math.PI/2,0]});
  for(let k=0;k<=8;k++){
    const a=k/8*Math.PI;
    blob(kit,'park-roses',[-22.6,Y+2.2+Math.sin(a)*1.8,208.5-Math.cos(a)*1.8],[.35,.4,.4],k+60,{variant:'shrub'});
  }
  for(const z of [206.7,210.3])blob(kit,'park-roses',[-22.6,Y+1.0,z],[.35,.9,.35],z,{variant:'shrub'});
  // ginkgo trees on the plaza stand in cast-iron tree grates over fallen yellow leaves
  for(const [,x,z] of PARK_TREES.filter(t=>t[0]==='ginkgo')){
    disc(kit,'park-ginkgo-leaves',x,z,2.2,{lift:.03});
    kit.add(new THREE.PlaneGeometry(1.6,1.6).rotateX(-Math.PI/2),kit.tex('park-tree-grate'),{pos:[x,Y+.04,z]});
  }
  // vending machines under a polycarbonate roof, information board at the road end
  const v=P('vending')[0];
  for(const dx of [-.75,.75]){
    kit.add(box(1.0,1.85,.75,1),kit.tex('vending-red'),{pos:[v.x+dx,Y+.925,v.z]});
    kit.add(new THREE.PlaneGeometry(.95,1.75),kit.tex('vending-front'),{pos:[v.x+dx,Y+.93,v.z+.38]});
  }
  const galv=kit.tex('galvanized-spangle');
  for(const dx of [-1.5,1.5])kit.beam([v.x+dx,Y,v.z+.9],[v.x+dx,Y+2.4,v.z+.9],.04,galv,.6,6);
  kit.add(new THREE.PlaneGeometry(3.4,1.9).rotateX(-Math.PI/2+.08),kit.tex('park-polycarbonate',DS),{pos:[v.x,Y+2.45,v.z+.3],world:1});
  const info=P('info')[0];
  for(const dz of [-.6,.6])kit.beam([info.x,Y,info.z+dz],[info.x,Y+1.9,info.z+dz],.05,kit.tex('park-sign-boards',{variant:'post'}),.6,6);
  kit.add(box(.08,1.0,1.5,1),kit.tex('park-sign-boards'),{pos:[info.x,Y+1.35,info.z]});
  kit.add(new THREE.PlaneGeometry(1.35,.85).rotateY(Math.PI/2),kit.tex('info-map'),{pos:[info.x+.045,Y+1.35,info.z]});
  // bicycle shelter beside the west path
  const b=P('bikes')[0];
  for(const dx of [-2.8,0,2.8])kit.beam([b.x+dx,Y,b.z+.5],[b.x+dx,Y+2.2,b.z+.5],.05,galv,.6,6);
  kit.add(box(6.2,.06,1.9,1.2),kit.tex('park-roof-steel'),{pos:[b.x,Y+2.25,b.z],rot:[.08,0,0]});
  for(let i=0;i<6;i++)kit.add(new THREE.TorusGeometry(.32,.025,5,12,Math.PI),galv,{pos:[b.x-2.4+i*.95,Y,b.z]});
}

function playground(kit){
  patch(kit,'park-rubber-chip',-12,-3,167,176,{meters:9,lift:.03});
  const red=kit.tex('play-red-paint'),blue=kit.tex('play-jungle-gym'),galv=kit.tex('galvanized-spangle');
  // slide: red steel tower with a ladder and a yellow chute
  const s=P('slide')[0],tz=s.z-1.8;
  for(const dx of [-.55,.55])for(const dz of [-.55,.55])kit.beam([s.x+dx,Y,tz+dz],[s.x+dx,Y+2.3,tz+dz],.045,red,.5,8);
  kit.add(box(1.2,.08,1.2,1),kit.tex('play-recycled-bench'),{pos:[s.x,Y+1.5,tz]});
  for(const dx of [-.55,.55])kit.beam([s.x+dx,Y+2.3,tz-.55],[s.x+dx,Y+2.3,tz+.55],.035,red,.5,8);
  for(let y=.3;y<1.5;y+=.3)kit.beam([s.x-.45,Y+y,tz-.6],[s.x+.45,Y+y,tz-.6],.025,red,.4,6);
  const chute=new THREE.CylinderGeometry(.42,.42,3.6,12,1,true,Math.PI/2,Math.PI).rotateX(Math.PI/2);
  kit.add(chute,kit.tex('play-yellow-slide',DS),{pos:[s.x,Y+.85,tz+2.3],rot:[-.38,0,0]});
  // swings: red A-frame, galvanized chains, recycled-wood seats
  const w=P('swings')[0];
  for(const dx of [-1.6,1.6])for(const dz of [-.6,.6])kit.beam([w.x+dx,Y,w.z+dz],[w.x+dx*.97,Y+2.3,w.z],.05,red,.5,8);
  kit.beam([w.x-1.6,Y+2.3,w.z],[w.x+1.6,Y+2.3,w.z],.055,red,.5,10);
  const chain=kit.tex('play-swing-chain');
  for(const dx of [-.8,.8]){
    for(const sx of [-.2,.2])kit.add(scaleUV(new THREE.PlaneGeometry(.05,1.85),1,6),chain,{pos:[w.x+dx+sx,Y+1.37,w.z]});
    kit.add(box(.5,.04,.2,.5),kit.tex('play-recycled-bench'),{pos:[w.x+dx,Y+.45,w.z]});
  }
  // jungle gym: blue bars on a 3 x 3 x 2 grid
  const j=P('jungle-gym')[0],h=.62,o=[j.x-.93,Y,j.z-.93];
  for(let a=0;a<=3;a++)for(let b=0;b<=3;b++){
    kit.beam([o[0]+a*h,Y,o[2]+b*h],[o[0]+a*h,Y+3*h,o[2]+b*h],.025,blue,.5,6);
    for(let c=1;c<=3;c++){
      if(a<3)kit.beam([o[0]+a*h,Y+c*h,o[2]+b*h],[o[0]+(a+1)*h,Y+c*h,o[2]+b*h],.022,blue,.5,6);
      if(b<3)kit.beam([o[0]+a*h,Y+c*h,o[2]+b*h],[o[0]+a*h,Y+c*h,o[2]+(b+1)*h],.022,blue,.5,6);
    }
  }
  // log climbing frame
  const l=P('logs')[0],logs=kit.tex('play-logs');
  for(let k=0;k<4;k++)kit.add(roundUV(new THREE.CylinderGeometry(.13,.13,2.4,10),1.2,.13),logs,{pos:[l.x,Y+.15+k*.26,l.z+(k%2?.15:-.15)],rot:[0,0,Math.PI/2]});
  for(const dx of [-1.1,1.1])kit.beam([l.x+dx,Y,l.z],[l.x+dx,Y+1.2,l.z],.12,logs,1,8);
  // sandbox with a log border
  patch(kit,'park-sandbox-sand',-12,-9,178.2,181.8,{meters:1.2,lift:.06});
  for(const [x,z,len,rot] of [[-10.5,178.1,3.2,0],[-10.5,181.9,3.2,0],[-12.1,180,3.8,Math.PI/2],[-8.9,180,3.8,Math.PI/2]])
    kit.add(roundUV(new THREE.CylinderGeometry(.1,.1,len,8),1,.1),logs,{pos:[x,Y+.1,z],rot:[0,rot,Math.PI/2],});
  // drinking fountain in granite
  const d=P('drinking')[0];
  kit.add(box(.45,.85,.45,.8),kit.tex('park-granite-fountain'),{pos:[d.x,Y+.425,d.z]});
  kit.add(cyl(.16,.05,.4,{seg:12}),kit.tex('brushed-stainless'),{pos:[d.x,Y+.87,d.z]});
  void galv;
}

function garden(kit,R){
  // tulip bed bordered by clipped boxwood, moss phlox mound by the plaza
  const t=P('bed')[0],boxwood=kit.tex('park-boxwood');
  patch(kit,'park-tulips',t.x-t.w/2+.25,t.x+t.w/2-.25,t.z-t.d/2+.25,t.z+t.d/2-.25,{lift:.25,meters:1.2});
  kit.add(box(t.w-.3,.22,t.d-.3,1),kit.tex('park-mulch',{variant:'bed'}),{pos:[t.x,Y+.11,t.z]});
  for(const [x,z,w,d] of [[t.x,t.z-t.d/2+.12,t.w,.24],[t.x,t.z+t.d/2-.12,t.w,.24],[t.x-t.w/2+.12,t.z,.24,t.d],[t.x+t.w/2-.12,t.z,.24,t.d]])
    kit.add(box(w,.32,d,.8),boxwood,{pos:[x,Y+.16,z]});
  const m=P('bed')[1];
  kit.add(planarUV(new THREE.SphereGeometry(1,16,6,0,Math.PI*2,0,Math.PI/2),1),kit.tex('park-moss-phlox'),{pos:[m.x,Y-.05,m.z],scale:[m.w/2,.45,m.d/2]});
  // clipped azalea hedges along the main path
  for(const hd of P('hedge').slice(2)){
    const g=planarUV(lumpy(new THREE.BoxGeometry(hd.w,.8,hd.d,2,2,Math.ceil(hd.d)),.05,2,hd.z),1);
    kit.add(g,kit.tex('park-azalea'),{pos:[hd.x,Y+.4,hd.z]});
    patch(kit,'park-mulch',hd.x-hd.w/2-.2,hd.x+hd.w/2+.2,hd.z-hd.d/2-.2,hd.z+hd.d/2+.2,{lift:.022});
  }
  // white clover patches in the lawn
  for(const [x,z,r] of [[-26,199,1.6],[-19,193,1.3],[-24,193.5,1.1],[-6,203,1.2],[-2.5,182,1.3],[-33,214,1.0],[-9.5,190.5,1.2]])disc(kit,'park-clover',x,z,r+R()*.3);
  // gazebo with a cedar-bark roof and a granite bench, on crazy paving
  const gx=-30,gz=196,post=kit.tex('timber-beam');
  patch(kit,'park-crazy-paving',gx-1.9,gx+1.9,gz-1.9,gz+1.9,{meters:1.5,lift:.035});
  for(const dx of [-1.6,1.6])for(const dz of [-1.6,1.6])kit.add(box(.16,2.4,.16,.6,{swap:true}),post,{pos:[gx+dx,Y+1.2,gz+dz]});
  kit.add(roundUV(new THREE.ConeGeometry(2.6,1.3,4,1,true),1.2,2.6),kit.tex('play-bark-roof',DS),{pos:[gx,Y+3.05,gz],rot:[0,Math.PI/4,0]});
  const bench=P('bench').find(b=>b.x===-30);
  kit.add(box(2,.42,.45,1),kit.tex('park-granite-bench'),{pos:[bench.x,Y+.21,bench.z]});
  // wisteria trellis over two recycled-wood benches
  const tw=kit.tex('play-wisteria-trellis',DS);
  for(const dx of [-2.5,2.5])for(const dz of [-2.3,2.3])kit.add(box(.14,2.5,.14,.6,{swap:true}),post,{pos:[-5.5+dx,Y+1.25,187.5+dz]});
  kit.add(new THREE.PlaneGeometry(5.4,5).rotateX(-Math.PI/2),tw,{pos:[-5.5,Y+2.55,187.5],world:1.5});
  for(const dz of [-2.3,0,2.3])kit.add(box(5.4,.1,.1,.6),post,{pos:[-5.5,Y+2.5,187.5+dz]});
  for(let k=0;k<6;k++)blob(kit,'park-hydrangea',[-7.6+k*.85,Y+2.35,185.4+(k%2)*4.2],[.45,.3,.4],k+80,{variant:'wisteria'});
  const wood=kit.tex('play-recycled-bench');
  for(const b of P('bench').filter(b=>b.z===186||b.z===189)){
    kit.add(box(b.w,.06,.42,1),wood,{pos:[b.x,Y+.44,b.z]});
    kit.add(box(b.w,.36,.05,1),wood,{pos:[b.x,Y+.72,b.z+(b.z<187.5?-.22:.22)]});
    for(const dx of [-1.3,1.3])kit.add(box(.08,.42,.4,.5),kit.tex('park-cast-iron'),{pos:[b.x+dx,Y+.21,b.z]});
  }
  // granite benches facing the pond
  for(const b of P('bench').filter(b=>b.x===-16.7))kit.add(box(.48,.42,1.8,1),kit.tex('park-granite-bench'),{pos:[b.x,Y+.21,b.z]});
  // green steel bins and cast-iron lamp posts
  for(const [x,z] of [[-12.4,200.4],[-23.2,206.9],[-16.6,215.1],[-3.6,171]]){
    kit.add(box(.5,.8,.5,1),kit.tex('park-bin-green'),{pos:[x,Y+.4,z]});
    kit.add(box(.54,.05,.54,.5),kit.tex('park-roof-steel',{variant:'lid'}),{pos:[x,Y+.82,z]});
  }
  for(const p of P('lamp')){
    kit.add(cyl(.09,3.4,.5,{seg:10,top:.06}),kit.tex('park-cast-iron'),{pos:[p.x,Y+1.7,p.z]});
    kit.add(cyl(.18,.12,.4,{seg:10}),kit.tex('park-cast-iron'),{pos:[p.x,Y+.06,p.z]});
    kit.add(box(.32,.36,.32,.4),kit.plain('lamp-warm'),{pos:[p.x,Y+3.55,p.z]});
    kit.add(roundUV(new THREE.ConeGeometry(.3,.22,8),.5,.3),kit.tex('park-cast-iron'),{pos:[p.x,Y+3.84,p.z]});
  }
}

function buildings(kit){
  // park office: white walls faced with a timber lattice, steel roof, a wooden sign board
  const o=P('office')[0],lattice=kit.tex('park-wood-lattice'),roof=kit.tex('park-roof-steel');
  kit.add(box(o.w,3,o.d,1.5),kit.tex('stucco-white'),{pos:[o.x,Y+1.5,o.z]});
  kit.add(new THREE.PlaneGeometry(o.w-.6,2.4),lattice,{pos:[o.x,Y+1.4,o.z+o.d/2+.02],world:1.2});
  kit.add(new THREE.PlaneGeometry(o.d-.6,2.4).rotateY(-Math.PI/2),lattice,{pos:[o.x-o.w/2-.02,Y+1.4,o.z],world:1.2});
  kit.add(box(o.w+.8,.14,o.d+.8,1.2),roof,{pos:[o.x,Y+3.1,o.z],rot:[.06,0,0]});
  kit.add(box(2.2,.5,.06,1),kit.tex('park-sign-boards'),{pos:[o.x,Y+2.55,o.z+o.d/2+.05]});
  kit.add(box(1.1,2.1,.06,1),kit.tex('timber-beam'),{pos:[o.x+1.8,Y+1.05,o.z+o.d/2+.04]});
  // toilets in white tiles
  const t=P('toilet')[0];
  kit.add(box(t.w,2.7,t.d,1),kit.tex('play-toilet-tile'),{pos:[t.x,Y+1.35,t.z]});
  kit.add(box(t.w+.6,.12,t.d+.6,1.2),roof,{pos:[t.x,Y+2.78,t.z]});
  for(const dz of [-1.1,1.1])kit.add(box(.9,2.0,.05,1),kit.tex('park-sign-boards',{variant:'door'}),{pos:[t.x,Y+1.0,t.z+dz],rot:[0,0,0]});
}

function sports(kit){
  // 400 m-style red track around a sand-filled turf field
  patch(kit,'park-track-red',-34,-17,215,235,{meters:1.2,lift:.025});
  patch(kit,'park-turf',-32.2,-18.8,216.8,233.2,{meters:1.5,lift:.035});
  for(const [x1,x2,z1,z2] of [[-32.25,-18.75,216.75,216.85],[-32.25,-18.75,233.15,233.25],[-32.25,-32.15,216.8,233.2],[-18.85,-18.75,216.8,233.2]])
    patch(kit,'white-composite',x1,x2,z1,z2,{lift:.04,meters:.5});
  // bleacher: three concrete tiers with rows of blue seats, facing the field
  const b=P('bleacher')[0],step=kit.tex('park-bleacher'),seats=kit.tex('park-seats');
  for(let k=0;k<3;k++){
    const x=b.x+.6-k*.65,h=.45+k*.45;
    kit.add(box(.7,h,b.d,1.2),step,{pos:[x,Y+h/2,b.z]});
    kit.add(scaleUV(new THREE.PlaneGeometry(b.d,.42),b.d/1.2,1).rotateY(-Math.PI/2),seats,{pos:[x-.2,Y+h+.21,b.z]});
  }
  // basketball half court with a hoop
  patch(kit,'park-court-blue',-13,-5,216,224.5,{meters:1.5,lift:.03});
  const hp=P('hoop')[0];
  kit.beam([hp.x,Y,hp.z],[hp.x,Y+3.2,hp.z],.07,kit.tex('play-red-paint'),.6,10);
  kit.add(box(1.8,1.05,.06,1),kit.tex('white-composite'),{pos:[hp.x,Y+3.4,hp.z+.35]});
  kit.add(new THREE.TorusGeometry(.23,.02,6,16).rotateX(Math.PI/2),kit.tex('play-red-paint'),{pos:[hp.x,Y+3.05,hp.z+.62]});
  // gateball court with timber edging
  patch(kit,'park-gateball-sand',-13,-5,226,235,{meters:1.5,lift:.03});
  for(const [x,z,w,d] of [[-9,226,8,.12],[-9,235,8,.12],[-13,230.5,.12,9],[-5,230.5,.12,9]])kit.add(box(w,.12,d,1),kit.tex('park-sign-boards',{variant:'edge'}),{pos:[x,Y+.06,z]});
  // batting cage: dark infield soil inside nets on galvanized posts
  patch(kit,'park-infield',-3.5,1,216,235.2,{meters:1.5,lift:.03});
  const net=kit.tex('park-ball-net',{alpha:.35,...DS}),galv=kit.tex('galvanized-spangle');
  for(const c of P('cage').concat(P('net'))){
    const along=c.w>c.d,len=along?c.w:c.d,H=c.type==='net'?4.5:3.4;
    const g=scaleUV(new THREE.PlaneGeometry(len,H),len,H);
    kit.add(along?g:g.rotateY(Math.PI/2),net,{pos:[c.x,Y+H/2,c.z]});
    for(let k=0;k<=Math.round(len/3);k++){
      const t=-len/2+k*len/Math.round(len/3);
      kit.beam(along?[c.x+t,Y,c.z]:[c.x,Y,c.z+t],along?[c.x+t,Y+H,c.z]:[c.x,Y+H,c.z+t],.04,galv,.6,6);
    }
  }
}

function forest(kit,R){
  // jogging path in wood chips along the foot of the slope
  groundPatch(kit,'park-jog-chips',-35.8,-34.2,166.5,234,{meters:1.2,step:2,lift:.05});
  // forest floor and moss under the keyaki and kunugi
  groundPatch(kit,'park-forest-floor',-42,-36,176,226,{meters:1.2,step:2,lift:.04});
  for(let i=0;i<10;i++){
    const x=-41.2+R()*4.4,z=178+R()*46;
    groundPatch(kit,'park-moss-carpet',x-.8,x+.8,z-.8,z+.8,{lift:.06,step:.8});
  }
  // bamboo grove on fallen bamboo leaves, with kumazasa undergrowth
  groundPatch(kit,'park-bamboo-litter',-42,-36.2,165,175,{meters:1.2,step:2,lift:.04});
  const bamboo=kit.tex('bamboo');
  for(let i=0;i<34;i++){
    const x=-41.6+R()*5.2,z=165.4+R()*9.2,y=G(x,z),h=6+R()*2.5,r=.04+R()*.025,lean=(R()-.5)*.5;
    kit.beam([x,y-.1,z],[x+lean,y+h,z+(R()-.5)*.5],r,bamboo,.6,6,true);
    if(i%3===0)blob(kit,'bush-leaves',[x+lean,y+h-.4,z],[.9,.7,.9],i+100,{variant:'bamboo-top'});
  }
  for(let i=0;i<12;i++){const x=-41.4+R()*5,z=165.6+R()*9;blob(kit,'park-kumazasa',[x,G(x,z)+.15,z],[.6+R()*.3,.35,.6+R()*.3],i+120,{variant:'low'});}
  for(let i=0;i<10;i++){const x=-41.4+R()*5,z=178+R()*46;blob(kit,'park-kumazasa',[x,G(x,z)+.15,z],[.55,.3,.55],i+140,{variant:'low'});}
  // silver grass field at the south end of the slope
  for(let i=0;i<22;i++){const x=-42+R()*5.6,z=226.5+R()*8.5;blob(kit,'park-susuki',[x,G(x,z)+.5,z],[.55+R()*.2,.75+R()*.25,.55],i+160,{variant:'grass'});}
}

function trees(kit,R){
  const kinds={
    sakura:{bark:'tree-bark',leaf:'sakura',h:3.2,r:2.0},
    ginkgo:{bark:'tree-bark',leaf:'park-ginkgo-leaves',h:4.2,r:1.6},
    keyaki:{bark:'park-keyaki-bark',leaf:'bush-leaves',h:5.2,r:2.4},
    kunugi:{bark:'park-kunugi-bark',leaf:'bush-leaves',h:4.6,r:2.1},
  };
  for(const [kind,x,z,s] of PARK_TREES){
    const k=kinds[kind],y=G(x,z),h=k.h*s,r=k.r*s;
    kit.beam([x,y-.2,z],[x,y+h,z],.17*s,kit.tex(k.bark),1,8,true);
    for(let i=0;i<3;i++){
      const a=R()*Math.PI*2,d=r*.35;
      blob(kit,k.leaf,[x+Math.cos(a)*d,y+h+r*.3+i*r*.25,z+Math.sin(a)*d],[r*(.85-i*.15),r*(.6-i*.08),r*(.85-i*.15)],x*7+z+i,{variant:'leaf'});
    }
    if(kind==='sakura')disc(kit,'park-sakura-petals',x,z,2.4,{lift:.03});
    if(kind!=='ginkgo'&&x>PARK_FLAT.x1)disc(kit,'park-mulch',x,z,.9,{lift:.035});
  }
  void PARK;
}
