import * as THREE from './vendor/three.module.js';
import {Kit,box,cyl,planarUV,roundUV,scaleUV,lumpy,fbm,smoothstep,rng,kiosk,sign,slidingDoor,tube,collar,bulkhead} from './kit.js';
import {loadManifest,loadTextures} from './textures.js';
import {
  CAVE,LAKE,TUNNEL,PASSAGE,DOOR12,HUT,STAIR,DOOR13,SHORE,PIER,EAST_TUNNEL,
  CAVERN,CONTROL_ROOM,LAKE_ROOM,
} from './cavern-layout.js';
import {buildQuarters} from './quarters.js';
import {buildSurface,buildIncline,extinguisher} from './surface.js';
import {buildOutside} from './outside.js';
import {buildOutdoorProps,buildUndergroundProps} from './props.js';
import {floorHeight} from './cavern-layout.js';

/**
 * Builds everything beyond room 11: the doorway, the cavern (12) with its two-storey hut (13),
 * the lake chamber (14) and the living quarters (15-18). Resolves to one Group named "Wing 12".
 */
export async function buildExtension(){
  const {textures={}}=await loadManifest();
  const loaded=await loadTextures(Object.keys(textures));
  // three kits share one material cache: underground, the shaft (seen from both sides) and the open air
  const under=new Kit(loaded),shaft=new Kit(loaded),open=new Kit(loaded);
  shaft.materials=open.materials=under.materials;
  const group=new THREE.Group(),underground=new THREE.Group(),outdoor=new THREE.Group();
  group.name='Wing 12';underground.name='Underground';outdoor.name='Outdoor';
  group.add(underground,outdoor);
  doorway(under,underground);
  tunnels(under);
  cave(under,underground);
  hut(under,underground);
  lake(under,underground);
  buildQuarters(under,underground);
  buildUndergroundProps(under,underground);
  buildIncline(shaft,group);
  buildSurface(open,outdoor);
  const updateSky=buildOutside(open,outdoor);
  buildOutdoorProps(open,outdoor);
  group.userData.frame=(player,camera,scene)=>{
    updateSky(player,camera,scene,loaded);
    const level=floorHeight(player.x,player.z);
    outdoor.visible=level>1||player.z>158;
    underground.visible=player.z<168;
  };
  const drift={'lake-water':[.006,.004],'stream-water':[0,-.05],'koi-pond':[.004,.002],'river-water':[-.035,.004],'waterfall':[0,.3],'fountain-water':[.01,.008]};
  const animate=mesh=>{
    const id=Object.keys(drift).find(key=>mesh.material.name.endsWith(key));
    if(!id)return;
    const {map,normalMap}=mesh.material,[u,v]=drift[id];
    mesh.onBeforeRender=()=>{
      const t=performance.now()/1000;
      map?.offset.set(t*u,t*v);
      normalMap?.offset.set(-t*u*1.4,t*v*1.2);
    };
  };
  for(const k of [under,shaft,open])k.after.push(animate);
  under.build(underground,'Cavern');
  shaft.build(group,'Shaft');
  open.build(outdoor,'Outdoor');
  return group;
}

const props=(room,type)=>room.props.filter(p=>p.type===type);

// ---------- rock shells and tunnels ----------

/** Lat-long dome over an ellipse with noisy rock relief; `holes` cut openings for tunnels. */
function shell(e,{holes,seed,amp=1.3,meters=3}){
  const seg=120,rings=42,thetaMax=Math.PI*.56;
  const tiles=Math.round(2*Math.PI*Math.sqrt((e.rx*e.rx+e.rz*e.rz)/2)/meters);
  const pos=[],uv=[];
  for(let i=0;i<=rings;i++){
    const th=i/rings*thetaMax,st=Math.sin(th),ct=Math.cos(th);
    for(let j=0;j<=seg;j++){
      const ph=j/seg*Math.PI*2,dx=st*Math.sin(ph),dz=st*Math.cos(ph);
      let x=e.cx+e.rx*dx,y=e.ry*ct,z=e.cz+e.rz*dz;
      let fade=1;
      for(const h of holes)fade=Math.min(fade,smoothstep(2.4,6,Math.hypot(x-h.x,(y-1.6)*.8,z-h.z)));
      const d=(fbm(x*.21+seed,y*.21,z*.21)-.5)*2*amp*fade;
      x+=dx*d;y+=ct*d*.7;z+=dz*d;
      pos.push(x,y,z);uv.push(j/seg*tiles,y/meters);
    }
  }
  const index=[];
  const c=(k,o)=>pos[k*3+o];
  for(let i=0;i<rings;i++)for(let j=0;j<seg;j++){
    const a=i*(seg+1)+j,b=a+seg+1,cc=b+1,d=a+1;
    const mx=(c(a,0)+c(b,0)+c(cc,0)+c(d,0))/4,my=(c(a,1)+c(b,1)+c(cc,1)+c(d,1))/4,mz=(c(a,2)+c(b,2)+c(cc,2)+c(d,2))/4;
    if(holes.some(h=>h.cut(mx,my,mz)))continue;
    index.push(a,b,d,b,cc,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const n=geo.attributes.normal;
  for(let i=0;i<=rings;i++){
    const a=i*(seg+1),b=a+seg;
    const v=new THREE.Vector3().fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();
    n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);
  }
  return geo;
}

function timberSet(kit,t,at,alongX=false,center=0){
  const wood=kit.tex('timber-beam');
  for(const s of [-1,1]){
    const lateral=s*(t.half-.12);
    kit.add(box(.22,t.wall,.22,1,{swap:true}),wood,{pos:alongX?[at,t.wall/2,center+lateral]:[center+lateral,t.wall/2,at]});
  }
  kit.add(box(alongX?.24:t.half*2,.24,alongX?t.half*2:.24,1),wood,{pos:alongX?[at,t.wall+.1,center]:[center,t.wall+.1,at]});
}

function doorway(kit,group){
  const corten=kit.tex('corten-plate'),stripe=kit.tex('hazard-stripe');
  const z=DOOR12.z+.05;
  for(const s of [-1,1])kit.add(box(.16,3.2,.9,1),stripe,{pos:[s*1.64,1.6,z]});
  kit.add(box(3.6,.3,.9,1.5),corten,{pos:[0,3.21,z]});
  kit.add(box(2.9,.02,.9,1),kit.tex('tread-plate'),{pos:[0,.01,z]});
  kit.add(bulkhead(TUNNEL,{half:1.56,h:3.06},2),kit.tex('form-concrete'),{pos:[0,0,TUNNEL.z1]});
  sign(group,[['B4-12 → 地底空洞',64],['観測棟・地底湖・居住区画',40]],[0,3.75,80.82],Math.PI,[2.6,.62],{width:640,height:150,border:false,bg:'#141c1f'});
  slidingDoor(group,'12',DOOR12,(leaf,w,h)=>{
    const body=new THREE.Mesh(box(w,h,.07,1.5),corten);body.position.y=h/2;
    const band=new THREE.Mesh(box(w,.35,.08,1),stripe);band.position.y=.5;
    leaf.add(body,band);
  });
}

function tunnels(kit){
  const lining=kit.tex('shotcrete',{variant:'lining',side:THREE.DoubleSide});
  const slab=kit.tex('form-concrete'),corten=kit.tex('corten-plate'),lamp=kit.plain('lamp-warm',{color:0xfff1d6,emissive:0xffe2b0,intensity:2.4,metalness:0});
  const cables=kit.tex('cable-bundle');
  // main tunnel (room 11 -> cavern)
  kit.add(tube(TUNNEL,TUNNEL.z1,TUNNEL.z2),lining);
  kit.add(box(TUNNEL.half*2,.1,TUNNEL.z2-TUNNEL.z1,2),slab,{pos:[0,-.04,(TUNNEL.z1+TUNNEL.z2)/2],world:2});
  kit.add(collar(TUNNEL,1.2,1.5),corten,{pos:[0,0,TUNNEL.z2]});
  for(const z of [82.6,84.3,86.0])timberSet(kit,TUNNEL,z);
  for(const z of [83.6,86.4])kit.add(box(.5,.08,.22,1),lamp,{pos:[0,TUNNEL.crown-.07,z]});
  kit.add(box(.06,.12,TUNNEL.z2-TUNNEL.z1,.6),cables,{pos:[TUNNEL.half-.05,2.25,(TUNNEL.z1+TUNNEL.z2)/2]});
  // passage (cavern -> lake)
  kit.add(tube(PASSAGE,PASSAGE.z1,PASSAGE.z2),lining);
  kit.add(collar(PASSAGE,1.2,1.5),corten,{pos:[0,0,PASSAGE.z1],rot:[0,Math.PI,0]});
  kit.add(collar(PASSAGE,1.2,1.5),corten,{pos:[0,0,PASSAGE.z2]});
  for(const z of [117.8,119.5])timberSet(kit,PASSAGE,z);
  kit.add(box(.5,.08,.22,1),lamp,{pos:[0,PASSAGE.crown-.07,118.6]});
  // east tunnel (cavern -> living quarters), built along local z then turned to run along +x
  const e=EAST_TUNNEL,turn={pos:[0,0,e.z],rot:[0,Math.PI/2,0]};
  kit.add(tube(e,e.x1,e.x2),lining,turn);
  kit.add(box(e.x2-e.x1,.1,e.half*2,2),slab,{pos:[(e.x1+e.x2)/2,-.04,e.z],world:2});
  kit.add(collar(e,1.1,1.5),corten,{pos:[e.x1,0,e.z],rot:[0,-Math.PI/2,0]});
  kit.add(bulkhead(e,{half:1.2,h:2.5},2),slab,{pos:[e.x2-.12,0,e.z],rot:[0,-Math.PI/2,0]});
  for(const x of [16.6,18.6,20.6])timberSet(kit,e,x,true,e.z);
  for(const x of [17.6,20.0])kit.add(box(.22,.08,.5,1),lamp,{pos:[x,e.crown-.07,e.z]});
}

// ---------- cavern (12) ----------

function cave(kit,group){
  const R=rng(12);
  const holes=[
    {x:0,z:CAVE.cz-CAVE.rz,cut:(x,y,z)=>Math.abs(x)<2.15&&y<3.5&&z<CAVE.cz-CAVE.rz*.6},
    {x:0,z:CAVE.cz+CAVE.rz,cut:(x,y,z)=>Math.abs(x)<2.15&&y<3.5&&z>CAVE.cz+CAVE.rz*.6},
    {x:16.7,z:EAST_TUNNEL.z,cut:(x,y,z)=>Math.abs(z-EAST_TUNNEL.z)<1.55&&y<3.1&&x>CAVE.cx+CAVE.rx*.6},
  ];
  kit.add(shell(CAVE,{holes,seed:3}),kit.tex('cave-basalt',{variant:'shell',side:THREE.DoubleSide}));
  kit.add(new THREE.PlaneGeometry(40,33.5),kit.tex('cave-gravel'),{pos:[0,0,101.75],rot:[-Math.PI/2,0,0],world:2});

  const flow=kit.tex('iron-flowstone'),crystal=kit.tex('glow-crystal'),steel=kit.plain('steel-dark');
  const lamp=kit.plain('lamp-warm');
  // stalactites (kept clear of the hut roof)
  for(let i=0,placed=0;placed<16&&i<80;i++){
    const a=R()*Math.PI*2,r=Math.sqrt(R())*.78;
    const x=CAVE.cx+Math.sin(a)*CAVE.rx*r,z=CAVE.cz+Math.cos(a)*CAVE.rz*r;
    if(x>3&&x<13&&z>100&&z<109)continue;
    const top=CAVE.ry*Math.sqrt(Math.max(0,1-r*r))+1.6,len=2.5+R()*2.4,rad=.25+R()*.4;
    kit.add(roundUV(new THREE.ConeGeometry(rad,len,9),1.5,rad),placed%2?flow:kit.tex('calcite-drip'),{pos:[x,top-len/2,z],rot:[Math.PI,0,0]});
    placed++;
  }
  for(const p of props(CAVERN,'stalagmite'))kit.add(spire(R,p.w*.5,1.6+R()*1.6),flow,{pos:[p.x,0,p.z]});
  for(const [x,y,z,sx,sy,sz] of [[15.8,.6,100.6,2.4,2,1.4],[-16.3,.8,104.2,2.2,2.3,1.6],[9.3,.3,89.4,1.6,1.4,1.2]])
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,3),.25,1.6,x),.8),flow,{pos:[x,y,z],scale:[sx,sy,sz],rot:[0,R()*3,0]});
  for(const p of props(CAVERN,'crystal'))cluster(kit,crystal,p.x,p.z,p.w*.55,R);
  caveDetails(kit,R);

  // generator
  for(const p of props(CAVERN,'generator')){
    kit.add(box(2.7,.15,1.6,1),kit.tex('hazard-stripe'),{pos:[p.x,.075,p.z]});
    kit.add(box(2.4,1.3,1.3,1),kit.tex('vented-aluminum'),{pos:[p.x,.8,p.z]});
    kit.beam([p.x+.8,1.45,p.z-.3],[p.x+.8,2.3,p.z-.3],.07,steel);
    kit.add(box(.5,.6,.3,1),kit.tex('cabinet-enamel'),{pos:[p.x-1.0,.9,p.z+.8]});
  }
  // light masts
  for(const p of props(CAVERN,'mast')){
    kit.add(box(.5,.1,.5,1),kit.tex('hazard-stripe'),{pos:[p.x,.05,p.z]});
    kit.beam([p.x,0,p.z],[p.x,5.85,p.z],.08,steel);
    kit.add(box(.7,.28,.45,1),kit.tex('perforated-black'),{pos:[p.x,5.95,p.z]});
    kit.add(box(.6,.04,.36,1),lamp,{pos:[p.x,5.8,p.z]});
  }
  // mine rails, cart and buffer stop
  const rail=kit.plain('rail-steel',{color:0x55595c,roughness:.4,metalness:.85});
  for(const s of [-.3,.3])kit.add(box(.07,.12,16.2,1),rail,{pos:[-1.1+s,.14,90]});
  for(let z=82.1;z<98;z+=.6)kit.add(box(1.0,.08,.18,1),kit.tex('timber-beam'),{pos:[-1.1,.04,z]});
  for(const p of props(CAVERN,'cart')){
    for(const dx of [-.3,.3])for(const dz of [-.5,.5])
      kit.add(cyl(.18,.08,.5),steel,{pos:[p.x+dx*1.1,.3,p.z+dz],rot:[0,0,Math.PI/2]});
    kit.add(box(.95,.65,1.45,1.5),kit.tex('corten-plate'),{pos:[p.x,.78,p.z]});
    for(let i=0;i<7;i++){
      const g=planarUV(lumpy(new THREE.DodecahedronGeometry(1,0),.1,2,i),.6);
      kit.add(g,kit.tex('pyrite-ore'),{pos:[p.x+(R()-.5)*.6,1.12+R()*.08,p.z+(R()-.5)*1.0],scale:.16+R()*.12,rot:[R()*3,R()*3,0]});
    }
  }
  for(const p of props(CAVERN,'buffer')){
    kit.add(box(1.2,.5,.3,1),kit.tex('timber-beam'),{pos:[p.x,.45,p.z]});
    kit.add(box(1.22,.3,.03,1),kit.tex('hazard-stripe'),{pos:[p.x,.5,p.z-.17]});
  }
  drillRig(kit,R);
  tanksAndPipes(kit);
  // crates and tarp
  for(const p of props(CAVERN,'crates')){
    kit.add(box(2.3,.12,1.2,1),kit.tex('timber-beam'),{pos:[p.x,.06,p.z]});
    const crate=kit.tex('plywood-crate');
    kit.add(box(1,1,1,1),crate,{pos:[p.x-.55,.62,p.z]});
    kit.add(box(1,1,1,1),crate,{pos:[p.x+.55,.62,p.z],rot:[0,.08,0]});
    kit.add(box(1,1,1,1),crate,{pos:[p.x,1.62,p.z],rot:[0,-.1,0]});
    kit.add(box(.6,.6,.6,1),crate,{pos:[p.x+1.4,.3,p.z+.4],rot:[0,.4,0]});
  }
  for(const p of props(CAVERN,'tarp')){
    const g=new THREE.BoxGeometry(2.4,1.3,1.5,12,6,8),v=new THREE.Vector3(),pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);
      const n=(fbm(v.x*1.7,v.y*1.7,v.z*1.7)-.5);
      if(v.y>.6)v.y-=.06+n*.12;
      v.x*=1+n*.05+(v.y<-.5?.06:0);v.z*=1+n*.06+(v.y<-.5?.08:0);
      pos.setXYZ(i,v.x,v.y,v.z);
    }
    g.computeVertexNormals();
    kit.add(planarUV(g,1.5),kit.tex('canvas-tarp'),{pos:[p.x,.65,p.z]});
    for(const dx of [-.6,.6])kit.add(box(.05,.02,1.62,.3),kit.tex('nylon-rope'),{pos:[p.x+dx,1.25,p.z]});
  }
  kiosk(kit,group,CAVERN,[CAVERN.terminal[0],0,CAVERN.terminal[1]],Math.PI);
}

function spire(R,base,height){
  const pts=[];
  for(let k=0;k<=8;k++){const t=k/8;pts.push(new THREE.Vector2(Math.max(.03,base*(1-t)**.85*(1+(R()-.5)*.3)),t*height));}
  return roundUV(new THREE.LatheGeometry(pts,10),1.5,base);
}
function cluster(kit,material,x,z,scale,R){
  for(let k=0;k<8;k++){
    const h=(.6+R()*1.2)*scale,r=(.1+R()*.14)*scale,a=R()*Math.PI*2,off=R()*.45*scale;
    kit.add(planarUV(new THREE.OctahedronGeometry(1,0),.5),material,{
      pos:[x+Math.sin(a)*off,h*.35,z+Math.cos(a)*off],rot:[(R()-.5)*.9,R()*3,(R()-.5)*.9],scale:[r,h,r]});
  }
}

function drillRig(kit,R){
  const p=props(CAVERN,'rig')[0],steel=kit.plain('steel-dark');
  kit.add(box(4,.1,4,1),kit.tex('bar-grating'),{pos:[p.x,.5,p.z]});
  for(const [dx,dz,w,d] of [[0,-2,4,.05],[0,2,4,.05],[-2,0,.05,4],[2,0,.05,4]])
    kit.add(box(w,.15,d,1),kit.tex('hazard-stripe'),{pos:[p.x+dx,.63,p.z+dz]});
  for(const dx of [-1.9,1.9])for(const dz of [-1.9,1.9])kit.add(box(.15,.5,.15,1),steel,{pos:[p.x+dx,.25,p.z+dz]});
  const top=7.2,low=1.3,high=.4;
  const corner=(h,s)=>[[p.x-s,h,p.z-s],[p.x+s,h,p.z-s],[p.x+s,h,p.z+s],[p.x-s,h,p.z+s]];
  const base=corner(.55,low),peak=corner(top,high);
  for(let i=0;i<4;i++)kit.beam(base[i],peak[i],.07,steel);
  for(const h of [2.4,4.4,6.2]){
    const s=low+(high-low)*(h-.55)/(top-.55),ring=corner(h,s);
    for(let i=0;i<4;i++)kit.beam(ring[i],ring[(i+1)%4],.04,steel);
  }
  for(let i=0;i<4;i++){
    const lo=corner(.55,low)[i],hi=corner(2.4,low+(high-low)*(1.85/6.65))[(i+1)%4];
    kit.beam(lo,hi,.03,steel);
  }
  kit.add(box(1,1.1,1,1),kit.tex('vented-aluminum'),{pos:[p.x,3.6,p.z]});
  kit.beam([p.x,.55,p.z],[p.x,7.0,p.z],.07,kit.plain('rail-steel'));
  kit.add(cyl(.32,.18,.5),kit.tex('patina-copper'),{pos:[p.x,top+.1,p.z],rot:[Math.PI/2,0,0]});
  kit.beam([p.x+.5,3.4,p.z+.3],[p.x+1.6,.6,p.z+1.4],.05,kit.tex('patina-copper'));
  // conveyor from the rig to the spoil heap
  const a=new THREE.Vector3(p.x-1.8,1.0,p.z-1.8),b=new THREE.Vector3(-12.4,2.5,92.4);
  const dir=b.clone().sub(a),len=dir.length(),mid=a.clone().add(b).multiplyScalar(.5);
  const quat=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),dir.clone().normalize());
  const along=(t,side,h)=>{
    const o=a.clone().addScaledVector(dir,t);
    const lateral=new THREE.Vector3(1,0,0).applyQuaternion(quat).multiplyScalar(side);
    return o.add(lateral).add(new THREE.Vector3(0,h,0));
  };
  kit.add(box(.7,.06,len,1),kit.tex('ribbed-rubber'),{pos:mid.toArray(),quat});
  for(const s of [-.38,.38])kit.add(box(.06,.18,len,1),kit.tex('vented-aluminum'),{pos:along(.5,s,0).toArray(),quat});
  for(const t of [.05,.5,.95]){
    const top2=along(t,0,0);
    for(const s of [-.35,.35]){const q=along(t,s,0);kit.beam([q.x,0,q.z],[q.x,top2.y-.05,q.z],.04,steel);}
  }
  const heap=props(CAVERN,'heap')[0];
  const pts=[];for(let k=0;k<=10;k++){const t=k/10;pts.push(new THREE.Vector2(2.4*(1-t)**1.25+.02,1.9*Math.sin(t*Math.PI/2)));}
  const g=new THREE.LatheGeometry(pts,20);
  const pos=g.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const n=(fbm(v.x*1.3,v.y*1.3,v.z*1.3)-.5)*.35;v.x*=1+n;v.z*=1+n;pos.setXYZ(i,v.x,v.y+n*.3,v.z);}
  g.computeVertexNormals();
  kit.add(planarUV(g,2),kit.tex('cave-gravel'),{pos:[heap.x,0,heap.z]});
}

function tanksAndPipes(kit){
  const green=kit.tex('tank-green'),copper=kit.tex('patina-copper'),steel=kit.plain('steel-dark');
  for(const p of props(CAVERN,'tank')){
    kit.add(cyl(1.35,.3,2),kit.tex('form-concrete'),{pos:[p.x,.15,p.z]});
    kit.add(cyl(1.1,3.4,1.5,{seg:28}),green,{pos:[p.x,2.0,p.z]});
    kit.add(planarUV(new THREE.SphereGeometry(1.1,28,8,0,Math.PI*2,0,Math.PI/2),1.5),green,{pos:[p.x,3.7,p.z],scale:[1,.42,1]});
    kit.add(cyl(1.12,.25,1,{seg:28}),kit.tex('hazard-stripe'),{pos:[p.x,.45,p.z]});
    kit.add(cyl(.25,.18,1),steel,{pos:[p.x,4.18,p.z]});
  }
  const y=2.9,run=[[-13,y,108.6],[4.3,y,108.6],[4.3,y,107.0],[4.55,y,107.0]];
  for(let i=0;i<run.length-1;i++)kit.beam(run[i],run[i+1],.09,copper);
  for(const q of run.slice(1,-1))kit.add(new THREE.SphereGeometry(.12,10,8),copper,{pos:q});
  const [t1,t2,t3]=props(CAVERN,'tank');
  kit.beam([t1.x,y,t1.z+1.05],[t1.x,y,108.6],.07,copper);
  kit.beam([t2.x,y,t2.z-1.05],[t2.x,y,108.6],.07,copper);
  kit.beam([t3.x+1.05,y,t3.z],[-10.2,y,t3.z],.07,copper);
  kit.beam([-10.2,y,t3.z],[-10.2,y,108.6],.07,copper);
  kit.add(new THREE.SphereGeometry(.1,10,8),copper,{pos:[-10.2,y,t3.z]});
  for(const p of props(CAVERN,'pipe-post')){
    kit.add(box(.15,y,.15,1),steel,{pos:[p.x,y/2,p.z]});
    kit.add(box(.5,.08,.12,1),steel,{pos:[p.x,y-.12,p.z]});
  }
}

/** Extra cave textures: rimstone pools, quartz-vein and wet black boulders, a painted rock slab. */
function caveDetails(kit,R){
  for(const [x,z,r] of [[-12.5,112.0,1.6],[12.2,91.0,1.2],[-6.0,116.0,1.0]]){
    const g=new THREE.CircleGeometry(1,24),p=g.attributes.position;
    for(let i=1;i<p.count;i++){const k=.8+fbm(p.getX(i)*2+x,0,p.getY(i)*2)*.5;p.setXY(i,p.getX(i)*k,p.getY(i)*k);}
    kit.add(g,kit.tex('rimstone'),{pos:[x,.015,z],rot:[-Math.PI/2,0,0],scale:r,world:2});
  }
  for(const [x,z,s] of [[-13.0,92.0,1.2],[12.5,114.0,1.4],[-4.5,116.6,.9]])
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.3,1.5,x),1),kit.tex('quartz-vein'),{pos:[x,s*.35,z],scale:[s*1.2,s*.8,s],rot:[0,R()*3,0]});
  kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,3),.25,1.8,8),1),kit.tex('wet-black-rock'),{pos:[8.0,.4,116.4],scale:[1.6,1.1,1.0]});
  const slab=planarUV(lumpy(new THREE.BoxGeometry(1,1,1,4,6,6),.08,2,3),1.5);
  kit.add(slab,kit.tex('cave-basalt'),{pos:[-15.1,1.3,95.6],scale:[.8,2.6,2.6]});
  kit.add(new THREE.PlaneGeometry(2.0,1.5),kit.tex('cave-painting'),{pos:[-14.66,1.7,95.6],rot:[0,Math.PI/2,0]});
}

// ---------- two-storey hut (ground floor exterior + room 13 upstairs) ----------

function hut(kit,group){
  const siding=kit.tex('corrugated-siding'),corten=kit.tex('corten-plate'),roof=kit.tex('standing-seam-roof');
  const steel=kit.plain('steel-dark'),yellow=kit.tex('safety-yellow-steel'),grey=kit.tex('rack-powder');
  const {x1,x2,z1,z2,upper,ceiling}=HUT,cx=(x1+x2)/2,cz=(z1+z2)/2,top=6.3;
  kit.add(box(x2-x1+.3,.25,z2-z1+.15,2),kit.tex('form-concrete'),{pos:[cx,.125,cz+.07],world:2});
  const h=top-.25,wy=.25+h/2;
  kit.add(box(.2,h,z2-z1),siding,{pos:[x1+.1,wy,cz],world:2});
  kit.add(box(.2,h,z2-z1),siding,{pos:[x2-.1,wy,cz],world:2});
  kit.add(box(x2-x1-.4,h,.2),siding,{pos:[cx,wy,z2-.1],world:2});
  // south wall: ground storey, upper storey with the door to room 13
  const dl=DOOR13.x-DOOR13.width/2,dr=DOOR13.x+DOOR13.width/2,doorTop=upper+DOOR13.height;
  kit.add(box(x2-x1-.4,upper-.25,.2),siding,{pos:[cx,(upper+.25)/2,z1+.1],world:2});
  kit.add(box(dl-(x1+.2),top-upper,.2),siding,{pos:[(x1+.2+dl)/2,(upper+top)/2,z1+.1],world:2});
  kit.add(box(x2-.2-dr,top-upper,.2),siding,{pos:[(dr+x2-.2)/2,(upper+top)/2,z1+.1],world:2});
  kit.add(box(dr-dl,top-doorTop,.2),siding,{pos:[DOOR13.x,(doorTop+top)/2,z1+.1],world:2});
  // floor band, gables, roof
  for(const [px,pz,w,d] of [[x1-.03,cz,.06,z2-z1+.06],[x2+.03,cz,.06,z2-z1+.06],[cx,z2+.03,x2-x1+.06,.06],[cx,z1-.03,x2-x1+.06,.06]])
    kit.add(box(w,.15,d,1.5),corten,{pos:[px,upper-.05,pz]});
  const gable=new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-(z2-z1)/2,top),new THREE.Vector2((z2-z1)/2,top),new THREE.Vector2(0,HUT.ridge)]));
  kit.add(planarUV(gable.clone(),2),siding,{pos:[x1,0,cz],rot:[0,-Math.PI/2,0]});
  kit.add(planarUV(gable,2),siding,{pos:[x2,0,cz],rot:[0,Math.PI/2,0]});
  const ridge=HUT.ridge+.05,eave=6.2,run=(z2-z1)/2+.3,slope=Math.atan2(ridge-eave,run),len=Math.hypot(run,ridge-eave);
  kit.add(box(x2-x1+.6,.08,len,2),roof,{pos:[cx,(ridge+eave)/2,cz-run/2],rot:[-slope,0,0]});
  kit.add(box(x2-x1+.6,.08,len,2),roof,{pos:[cx,(ridge+eave)/2,cz+run/2],rot:[slope,0,0]});
  kit.add(box(x2-x1+.6,.12,.3,1.5),corten,{pos:[cx,ridge+.04,cz]});
  // windows, front door, lamp and sign on the west facade
  const glassLit=kit.tex('wired-glass',{variant:'lit',emissive:.55,emissiveColor:0xffd9a8});
  const glassDark=kit.tex('wired-glass',{variant:'dark',emissive:.12,emissiveColor:0x9fc4d8});
  const addWindow=(wx,y,z,w,hgt,inside)=>{
    kit.add(box(.04,hgt+.14,w+.14,1.5),corten,{pos:[wx-.01,y,z]});
    kit.add(box(.03,hgt,w,.6),glassLit,{pos:[wx-.035,y,z]});
    if(inside)kit.add(box(.02,hgt,w,.6),glassDark,{pos:[x1+.245,y,z]});
  };
  addWindow(x1,1.7,104.1,1.0,1.0,false);addWindow(x1,1.7,106.5,1.0,1.0,false);
  addWindow(x1,4.8,104.35,1.3,1.2,true);addWindow(x1,4.8,106.25,1.3,1.2,true);
  kit.add(box(.04,1.2,1.2,1.5),corten,{pos:[cx,1.7,z2+.02]});
  kit.add(box(.03,1.0,1.0,.6),glassLit,{pos:[cx,1.7,z2+.035]});
  kit.add(box(.04,2.3,1.2,1.5),corten,{pos:[x1-.01,1.4,105.3]});
  kit.add(box(.04,2.1,1.0,1),kit.tex('vented-aluminum'),{pos:[x1-.03,1.3,105.3]});
  kit.add(box(.2,.12,.3,1),kit.plain('lamp-amber',{color:0xffcf8a,emissive:0xffc070,intensity:2.2,metalness:0}),{pos:[x1-.1,2.75,105.3]});
  extinguisher(kit,x1-.12,0,104.35,Math.PI/2);
  sign(group,[['観測棟',62],['B4-12 OBSERVATION',30]],[x1-.04,3.0,105.3],-Math.PI/2,[1.5,.36],{width:500,height:120,border:false,bg:'#1d2a2c'});
  slidingDoor(group,'13',DOOR13,(leaf,w,hgt)=>{
    const body=new THREE.Mesh(box(w,hgt,.05,1),kit.tex('vented-aluminum'));body.position.y=hgt/2;
    const pane=new THREE.Mesh(box(w*.55,.5,.06,.6),glassLit);pane.position.y=1.6;
    leaf.add(body,pane);
  });

  // outside stair and landing
  const steps=17,runX=(STAIR.top-STAIR.x1)/steps,rise=upper/steps,sz=(STAIR.z1+z1)/2,sw=z1-STAIR.z1-.1;
  for(let k=0;k<steps;k++){
    const sx=STAIR.x1+(k+.5)*runX,topY=(k+1)*rise;
    kit.add(box(runX,topY,sw),grey,{pos:[sx,topY/2,sz],world:1});
    kit.add(box(runX,.02,sw,.8),kit.tex('tread-plate'),{pos:[sx,topY+.01,sz]});
    kit.add(box(.07,.021,sw,.6),kit.tex('rubber-tread'),{pos:[STAIR.x1+k*runX+.035,topY+.012,sz]});
  }
  const lx1=STAIR.top,lx2=STAIR.x2;
  kit.add(box(lx2-lx1,.12,sw,.8),kit.tex('tread-plate'),{pos:[(lx1+lx2)/2,upper-.06,sz]});
  for(const px of [lx1+.1,lx2-.1])for(const pz of [STAIR.z1+.1,z1-.15])kit.add(box(.12,upper-.12,.12,1),steel,{pos:[px,(upper-.12)/2,pz]});
  const rz=STAIR.z1+.02,rail=(a,b)=>kit.beam(a,b,.03,yellow);
  rail([STAIR.x1,.95,rz],[lx1,upper+.95,rz]);rail([STAIR.x1,.5,rz],[lx1,upper+.5,rz]);
  rail([lx1,upper+.95,rz],[lx2,upper+.95,rz]);rail([lx1,upper+.5,rz],[lx2,upper+.5,rz]);
  rail([lx2,upper+.95,rz],[lx2,upper+.95,z1-.05]);rail([lx2,upper+.5,rz],[lx2,upper+.5,z1-.05]);
  for(let x=STAIR.x1+.05;x<lx1;x+=1.1){const y=(x-STAIR.x1)/(lx1-STAIR.x1)*upper;rail([x,y,rz],[x,y+.95,rz]);}
  for(const x of [lx1,lx1+1.2,lx2])rail([x,upper,rz],[x,upper+.95,rz]);
  rail([lx2,upper,z1-.05],[lx2,upper+.95,z1-.05]);

  // ---- room 13 interior ----
  const ix1=x1+.23,ix2=x2-.23,iz1=z1+.23,iz2=z2-.23,icx=(ix1+ix2)/2,icz=(iz1+iz2)/2,ih=ceiling-upper;
  kit.add(box(ix2-ix1,.1,iz2-iz1),kit.tex('vinyl-floor'),{pos:[icx,upper-.05,icz],world:1.2});
  kit.add(box(ix2-ix1,.05,iz2-iz1),kit.tex('ceiling-tile'),{pos:[icx,ceiling+.025,icz],world:1.2});
  const acoustic=kit.tex('acoustic-panel'),wy2=upper+ih/2;
  kit.add(box(.03,ih,iz2-iz1),acoustic,{pos:[ix1-.015,wy2,icz],world:1.2});
  kit.add(box(.03,ih,iz2-iz1),acoustic,{pos:[ix2+.015,wy2,icz],world:1.2});
  kit.add(box(ix2-ix1,ih,.03),acoustic,{pos:[icx,wy2,iz2+.015],world:1.2});
  kit.add(box(dl-ix1,ih,.03),acoustic,{pos:[(ix1+dl)/2,wy2,iz1-.015],world:1.2});
  kit.add(box(ix2-dr,ih,.03),acoustic,{pos:[(dr+ix2)/2,wy2,iz1-.015],world:1.2});
  kit.add(box(dr-dl,ceiling-doorTop,.03),acoustic,{pos:[DOOR13.x,(doorTop+ceiling)/2,iz1-.015],world:1.2});
  const u=upper,desk=props(CONTROL_ROOM,'desk')[0];
  kit.add(box(.9,.05,3.0,1),kit.tex('desk-laminate'),{pos:[desk.x,u+.75,desk.z]});
  kit.add(box(.86,.7,2.96,1),grey,{pos:[desk.x,u+.36,desk.z]});
  kit.add(box(.22,.55,2.7,1),grey,{pos:[desk.x-.33,u+1.0,desk.z]});
  for(const z of [104.25,104.9,105.55,106.2])
    kit.add(new THREE.PlaneGeometry(.6,.5),kit.tex('dial-panel'),{pos:[desk.x-.2,u+1.03,z],rot:[-.42,Math.PI/2,0,'YXZ']});
  kit.add(box(2.0,.008,3.4,1),kit.tex('carpet-tile'),{pos:[5.9,u+.004,105.3]});
  for(const z of [104.6,106.0]){
    const fabric=kit.tex('upholstery'),plastic=kit.tex('molded-plastic');
    kit.add(box(.5,.08,.5,.4),fabric,{pos:[6.1,u+.47,z]});
    kit.add(box(.06,.55,.48,.4),fabric,{pos:[6.36,u+.8,z]});
    kit.beam([6.1,u+.05,z],[6.1,u+.43,z],.03,steel);
    kit.add(cyl(.28,.03,.3,{seg:12}),plastic,{pos:[6.1,u+.04,z]});
  }
  const racks=props(CONTROL_ROOM,'racks')[0];
  for(const z of [104.6,105.25,105.9,106.55]){
    kit.add(box(.64,2.0,.6,1),grey,{pos:[racks.x+.02,u+1.0,z]});
    kit.add(box(.02,1.9,.54,.6),kit.tex('rack-mesh-door'),{pos:[racks.x-.31,u+1.0,z]});
  }
  const lockers=props(CONTROL_ROOM,'lockers')[0];
  kit.add(box(1.2,1.9,.48,1),grey,{pos:[lockers.x,u+.95,lockers.z-.02]});
  kit.add(new THREE.PlaneGeometry(1.2,1.9),kit.tex('steel-locker'),{pos:[lockers.x,u+.95,lockers.z+.225]});
  kit.add(new THREE.PlaneGeometry(2.0,1.4),kit.tex('survey-map'),{pos:[7.0,u+1.35,iz2-.005],rot:[0,Math.PI,0]});
  kit.add(box(1.8,1.2,.03,1.5),kit.tex('chalkboard'),{pos:[9.6,u+1.3,iz2-.02]});
  kit.add(box(1.8,.04,.08,.6),kit.tex('hinoki'),{pos:[9.6,u+.68,iz2-.06]});
  kit.add(box(1.3,.9,.02,1),kit.tex('cork-board'),{pos:[6.2,u+1.45,iz1+.01]});
  const table=props(CONTROL_ROOM,'table')[0];
  kit.add(box(.9,.04,.6,1),kit.tex('desk-laminate'),{pos:[table.x,u+.74,table.z]});
  for(const dx of [-.4,.4])for(const dz of [-.25,.25])kit.add(box(.04,.72,.04,1),steel,{pos:[table.x+dx,u+.36,table.z+dz]});
  kit.add(box(.6,.18,.35,1),grey,{pos:[table.x,u+.85,table.z]});
  kit.add(roundUV(new THREE.CylinderGeometry(.1,.1,.5,20),.6,.1),kit.tex('seismo-paper'),{pos:[table.x,u+1.04,table.z],rot:[0,0,Math.PI/2]});
  kit.add(box(6.0,.1,.3,.6),kit.tex('cable-bundle'),{pos:[icx,ceiling-.12,icz]});
  kit.add(box(1.2,.01,.9,.6),kit.tex('rubber-tread'),{pos:[DOOR13.x,u+.005,iz1+.5]});
  const panel=kit.plain('lamp-cool',{color:0xf2f6ff,emissive:0xeef4ff,intensity:2.0,metalness:0});
  for(const x of [6.3,9.7])kit.add(box(1.2,.04,.3,1),panel,{pos:[x,ceiling-.02,icz]});
  kiosk(kit,group,CONTROL_ROOM,[CONTROL_ROOM.terminal[0],u,CONTROL_ROOM.terminal[1]],Math.PI/2);
}

// ---------- lake chamber (14) ----------

function lake(kit,group){
  const R=rng(14);
  kit.add(shell(LAKE,{seed:9,amp:1.1,meters:2,holes:[
    {x:0,z:LAKE.cz-LAKE.rz,cut:(x,y,z)=>Math.abs(x)<2.15&&y<3.5&&z<LAKE.cz-LAKE.rz*.6},
  ]}),kit.tex('mossy-rock',{variant:'shell',side:THREE.DoubleSide}));
  // shore terrain sloping into the water
  const g=new THREE.PlaneGeometry(30,25.5,30,26);g.rotateX(-Math.PI/2);g.translate(0,0,131.25);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i);
    const y=z>SHORE?-Math.min(1,(z-SHORE)/2.6)*.95:0;
    p.setY(i,y+(z>SHORE-1?(fbm(x*.6,0,z*.6)-.5)*.06:0));
  }
  g.computeVertexNormals();
  kit.add(g,kit.tex('wet-sand'),{world:2});
  kit.add(new THREE.PlaneGeometry(32,19),kit.tex('lake-water'),{pos:[0,-.3,134.5],rot:[-Math.PI/2,0,0],world:3});
  const flow=kit.tex('iron-flowstone'),steel=kit.plain('steel-dark'),lamp=kit.plain('lamp-warm');
  for(let i=0;i<7;i++){
    const a=R()*Math.PI*2,r=Math.sqrt(R())*.7;
    const x=Math.sin(a)*LAKE.rx*r,z=LAKE.cz+Math.cos(a)*LAKE.rz*r;
    const top=LAKE.ry*Math.sqrt(Math.max(0,1-r*r))+1.4,len=2.2+R()*2,rad=.22+R()*.3;
    kit.add(roundUV(new THREE.ConeGeometry(rad,len,9),1.5,rad),flow,{pos:[x,top-len/2,z],rot:[Math.PI,0,0]});
  }
  // pier
  const planks=kit.tex('pier-planks'),wood=kit.tex('timber-beam');
  kit.add(box(PIER.x2-PIER.x1,.1,PIER.z2-PIER.z1),planks,{pos:[0,PIER.deck-.05,(PIER.z1+PIER.z2)/2],world:2});
  const hd=PIER.head;
  kit.add(box(hd.x2-hd.x1,.1,hd.z2-hd.z1),planks,{pos:[0,PIER.deck-.05,(hd.z1+hd.z2)/2],world:2});
  for(let z=127.4;z<PIER.z2;z+=1.9)for(const x of [PIER.x1+.05,PIER.x2-.05])kit.add(cyl(.1,1.9,1),wood,{pos:[x,-.85,z]});
  for(const x of [hd.x1+.1,hd.x2-.1])for(const z of [hd.z1+.1,hd.z2-.1])kit.add(cyl(.12,1.9,1),wood,{pos:[x,-.85,z]});
  kit.add(box(1.6,.012,1.0,.6),kit.tex('coin-mat'),{pos:[0,.006,PIER.z1-.55]});
  const teal=kit.tex('teal-enamel');
  for(const [x,z] of [[hd.x2-.2,hd.z2-.25],[hd.x1+.2,hd.z2-.25],[hd.x2-.2,hd.z1+.3]])kit.add(cyl(.12,.35,.5),teal,{pos:[x,PIER.deck+.17,z]});
  for(let i=0;i<4;i++)kit.add(roundUV(new THREE.TorusGeometry(.18,.03,6,18),.3,.2),kit.tex('nylon-rope'),{pos:[-1.4,PIER.deck+.03+i*.05,136.6],rot:[Math.PI/2,0,0]});
  // ladder
  const fg=kit.tex('fiberglass-yellow');
  for(const dz of [-.22,.22])kit.add(box(.05,1.7,.05,.6),fg,{pos:[hd.x2+.05,-.25,135.9+dz]});
  for(let y=-.9;y<.6;y+=.3)kit.add(box(.04,.04,.44,.6),fg,{pos:[hd.x2+.05,y,135.9]});
  // pier lamps
  for(const [x,z] of [[-.95,130.0],[.95,134.0]]){
    kit.beam([x,PIER.deck,z],[x,2.8,z],.06,kit.tex('perforated-black'),.5);
    kit.add(box(.35,.2,.35,.5),kit.tex('perforated-black'),{pos:[x,2.88,z]});
    kit.add(box(.3,.05,.3,1),lamp,{pos:[x,2.76,z]});
  }
  // inflatable boat moored beside the pier
  const pvc=kit.tex('inflatable-pvc'),ply=kit.tex('plywood-crate');
  const bx=2.95,by=-.12,bz1=130.0,bz2=132.6;
  for(const s of [-.45,.45])kit.add(cyl(.24,bz2-bz1,1),pvc,{pos:[bx+s,by,(bz1+bz2)/2],rot:[Math.PI/2,0,0]});
  kit.add(roundUV(new THREE.TorusGeometry(.45,.24,10,18,Math.PI),1,.24),pvc,{pos:[bx,by,bz2],rot:[Math.PI/2,0,0]});
  kit.add(box(1.14,.45,.06,1),ply,{pos:[bx,by,bz1]});
  kit.add(box(.9,.04,2.6,1),ply,{pos:[bx,by-.18,(bz1+bz2)/2]});
  kit.add(box(.9,.04,.3,1),ply,{pos:[bx,by+.15,131.6]});
  kit.add(box(.25,.5,.3,.3),kit.tex('molded-plastic'),{pos:[bx,by+.3,bz1-.2]});
  kit.beam([bx,by+.05,bz1-.2],[bx,by-.45,bz1-.25],.04,steel);
  const rope=new THREE.QuadraticBezierCurve3(new THREE.Vector3(bx,by+.2,bz2+.4),new THREE.Vector3(2.5,-.1,133.7),new THREE.Vector3(hd.x2-.2,PIER.deck+.3,hd.z1+.3));
  kit.add(scaleUV(new THREE.TubeGeometry(rope,20,.025,6),6,1),kit.tex('nylon-rope'));
  for(const [x,z] of [[-4,133],[5.5,137],[-6.6,138.6]]){
    kit.add(planarUV(new THREE.SphereGeometry(.3,16,10),.6),kit.tex('buoy-plastic'),{pos:[x,-.22,z]});
    kit.add(cyl(.05,.4,.6),kit.tex('buoy-plastic'),{pos:[x,.2,z]});
  }
  // pump station, hoses, fence, drums
  const pump=props(LAKE_ROOM,'pump')[0];
  kit.add(box(2.2,.06,1.6,.6),kit.tex('coin-mat'),{pos:[pump.x,.03,pump.z]});
  kit.add(box(1.8,.3,.9,1),teal,{pos:[pump.x,.2,pump.z]});
  kit.add(cyl(.4,1.1,1),teal,{pos:[pump.x-.3,.75,pump.z],rot:[0,0,Math.PI/2]});
  kit.add(box(.6,.7,.6,1),teal,{pos:[pump.x+.6,.7,pump.z]});
  const hose=new THREE.CatmullRomCurve3([[pump.x-.85,.7,pump.z],[pump.x-1.1,.35,pump.z+1.2],[pump.x-1.3,-.1,128.4],[pump.x-1.5,-.5,130]].map(v=>new THREE.Vector3(...v)));
  kit.add(scaleUV(new THREE.TubeGeometry(hose,24,.08,8),8,1),kit.tex('vulcanized-rubber'));
  kit.beam([pump.x-.2,0,pump.z-.7],[pump.x-.2,3.3,pump.z-.7],.06,kit.tex('perforated-black'),.5);
  kit.add(box(.6,.25,.4,.5),kit.tex('perforated-black'),{pos:[pump.x-.1,3.38,pump.z-.5]});
  kit.add(box(.5,.04,.32,1),lamp,{pos:[pump.x-.1,3.24,pump.z-.5]});
  const fence=props(LAKE_ROOM,'fence')[0];
  kit.add(new THREE.PlaneGeometry(fence.w,1.7),kit.tex('chainlink-fence',{variant:'mesh',alpha:.4,side:THREE.DoubleSide}),{pos:[fence.x,.95,fence.z],world:1});
  for(let i=0;i<=3;i++){const x=fence.x-fence.w/2+i*fence.w/3;kit.beam([x,0,fence.z],[x,1.85,fence.z],.04,steel);}
  for(const p of props(LAKE_ROOM,'drum')){
    kit.add(cyl(.29,.88,1,{seg:20}),kit.tex('blue-drum'),{pos:[p.x,.44,p.z]});
    kit.add(cyl(.3,.03,1,{seg:20}),steel,{pos:[p.x,.895,p.z]});
  }
  // sandbag wall
  const bag=kit.tex('burlap-sandbag'),sb=props(LAKE_ROOM,'sandbags')[0];
  for(let row=0;row<3;row++)for(let i=0;i<10;i++)for(const dz of [-.18,.18]){
    const x=sb.x-sb.w/2+.3+i*.58+(row%2)*.29;
    if(x>sb.x+sb.w/2-.2)continue;
    kit.add(planarUV(new THREE.SphereGeometry(1,10,6),.5),bag,{pos:[x,.1+row*.18,sb.z+dz],scale:[.3,.1,.17],rot:[0,(R()-.5)*.2,0]});
  }
  // log with glowing fungi
  const log=props(LAKE_ROOM,'log')[0],fungus=kit.tex('glow-fungus');
  kit.add(cyl(.28,log.w,1),wood,{pos:[log.x,.26,log.z],rot:[0,0,Math.PI/2]});
  for(let i=0;i<34;i++){
    const onLog=i<22,x=log.x+(R()-.5)*(onLog?log.w*.9:log.w*1.4),z=log.z+(R()-.5)*(onLog?.35:1.6);
    const r=.04+R()*.08,y=onLog?.5+R()*.03:.0;
    kit.add(planarUV(new THREE.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI/2),.5),fungus,{pos:[x,y+r*.6,z],scale:[r,r*.5,r]});
    kit.beam([x,y,z],[x,y+r*.6,z],r*.25,fungus,.5,5);
  }
  kit.add(box(log.w*.8,.02,.3,.5),fungus,{pos:[log.x,.54,log.z]});
  for(const p of props(LAKE_ROOM,'boulder'))
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.3,1.4,p.x),1),kit.tex('mossy-rock'),{pos:[p.x,p.d*.22,p.z],scale:[p.w*.5,p.d*.42,p.d*.5],rot:[0,R()*3,0]});
  kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.3,1.4,4.5),1),kit.tex('mossy-rock'),{pos:[4.6,-.1,129.6],scale:[1.4,.8,1.2]});
  for(const [x,z,s] of [[3.6,122.4,1],[-12.2,128.8,1.2],[11.6,127.4,.9]])
    kit.add(planarUV(lumpy(new THREE.SphereGeometry(1,18,8,0,Math.PI*2,0,Math.PI/2),.15,2,x),1),kit.tex('salt-crust'),{pos:[x,0,z],scale:[s,.35*s,s*.85]});
  const ore=props(LAKE_ROOM,'ore')[0];
  for(const [dx,dz,w,d] of [[0,-.5,1,.04],[0,.5,1,.04],[-.5,0,.04,1],[.5,0,.04,1]])kit.add(box(w,.5,d,1),ply,{pos:[ore.x+dx,.25,ore.z+dz]});
  kit.add(box(1,.04,1,1),ply,{pos:[ore.x,.02,ore.z]});
  for(let i=0;i<14;i++)kit.add(planarUV(lumpy(new THREE.DodecahedronGeometry(1,0),.1,2,i),.6),kit.tex('pyrite-ore'),{pos:[ore.x+(R()-.5)*.8,.32+R()*.15,ore.z+(R()-.5)*.8],scale:.1+R()*.08,rot:[R()*3,R()*3,0]});
  const amethyst=kit.tex('amethyst');
  for(const [x,z,s] of [[-12.2,129.6,1.3],[12.4,127.6,1.1],[7.5,140.3,1.5]])cluster(kit,amethyst,x,z,s,R);
  for(const [x,z,sx,sy,sz] of [[-9.5,136.8,1.4,.9,1.1],[10.0,133.5,1.2,.8,1.0]])
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,3),.25,1.8,x),1),kit.tex('wet-black-rock'),{pos:[x,-.2,z],scale:[sx,sy,sz]});
  for(const [x,z,s] of [[-11.8,133.5,1.1],[12.8,131.0,1.3]])
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.2,2,x),.6),kit.tex('cave-popcorn'),{pos:[x,s*.2,z],scale:[s,s*.7,s],rot:[0,R()*3,0]});
  const ice=kit.tex('cave-ice');
  for(let i=0;i<7;i++){const h=.8+R()*1.6,r=.12+R()*.2;kit.add(roundUV(new THREE.ConeGeometry(r,h,8),1,r),ice,{pos:[-8.5+(R()-.5)*2.4,-.3+h/2,139.3+(R()-.5)*1.6],rot:[(R()-.5)*.2,0,(R()-.5)*.2]});}
  for(let i=0;i<9;i++){const h=.8+R()*1.4,r=.06+R()*.12,x=-8.5+(R()-.5)*3,z=139.5+(R()-.5)*2;
    const top=LAKE.ry*Math.sqrt(Math.max(0,1-(x/LAKE.rx)**2-((z-LAKE.cz)/LAKE.rz)**2))+1.8;
    kit.add(roundUV(new THREE.ConeGeometry(r,h+1.8,8),1,r),ice,{pos:[x,top-(h+1.8)/2,z],rot:[Math.PI,0,0]});}
  kiosk(kit,group,LAKE_ROOM,[LAKE_ROOM.terminal[0],0,LAKE_ROOM.terminal[1]],Math.PI);
}
