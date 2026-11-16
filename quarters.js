import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,scaleUV,lumpy,kiosk,sign,slidingDoor,rng} from './kit.js';
import {HALL15,SUITE_X,SUITES,LIVING,WASHITSU,YOSHITSU,MEETING,INCLINE,ONSEN} from './cavern-layout.js';
import {extinguisher} from './surface.js';

// Living quarters east of the cavern: 15 hall, 16 和室 (Japanese room), 17 洋室 (Western room), 18 会議室.
const props=(room,type)=>room.props.filter(p=>p.type===type);

/**
 * A straight wall (or lining) with rectangular openings.
 * axis 'x': the wall lies in the plane x=at and runs along z; axis 'z': plane z=at, runs along x.
 */
export function wall(kit,material,{axis,at,from,to,y1=0,y2,thick=.2,gaps=[],world=1}){
  const piece=(a,b,lo,hi)=>{
    if(b-a<.005||hi-lo<.005)return;
    const mid=(a+b)/2,y=(lo+hi)/2,len=b-a,h=hi-lo;
    if(axis==='x')kit.add(box(thick,h,len),material,{pos:[at,y,mid],world});
    else kit.add(box(len,h,thick),material,{pos:[mid,y,at],world});
  };
  let a=from;
  for(const g of [...gaps].sort((p,q)=>p.center-q.center)){
    piece(a,g.center-g.width/2,y1,y2);
    piece(g.center-g.width/2,g.center+g.width/2,g.top,y2);
    if(g.sill)piece(g.center-g.width/2,g.center+g.width/2,y1,g.sill);
    a=g.center+g.width/2;
  }
  piece(a,to,y1,y2);
}

export function buildQuarters(kit,group){
  shellAndHall(kit,group);
  washitsu(kit,group);
  yoshitsu(kit,group);
  meeting(kit,group);
}

const DOOR_W=1.2,DOOR_H=2.1;
const doorGap=code=>({center:SUITES[code].door,width:DOOR_W,top:DOOR_H});

function frame(kit,material,z,depth=.3){
  for(const s of [-1,1])kit.add(box(depth,DOOR_H+.06,.07),material,{pos:[26,(DOOR_H+.06)/2,z+s*(DOOR_W/2+.035)]});
  kit.add(box(depth,.08,DOOR_W+.14),material,{pos:[26,DOOR_H+.04,z]});
}

function shellAndHall(kit,group){
  const R=rng(15),h=HALL15,top=h.height;
  const panel=kit.tex('panel-coat-ivory');
  // structural walls (hall-facing finish; the suites add their own linings)
  wall(kit,panel,{axis:'x',at:22.0,from:83.9,to:108.1,y2:top,gaps:[{center:96,width:2.4,top:2.5}],world:2});
  wall(kit,panel,{axis:'x',at:26.0,from:83.9,to:108.1,y2:top,gaps:['16','17','18'].map(doorGap),world:2});
  // south wall: doorway into the bathhouse (24)
  wall(kit,panel,{axis:'z',at:84.0,from:21.9,to:31.8,y2:top,gaps:[{center:ONSEN.entry,width:1.2,top:2.1}],world:2});
  wall(kit,panel,{axis:'z',at:108.0,from:21.9,to:31.8,y2:top,gaps:[{center:INCLINE.x,width:2.4,top:2.5}],world:2});
  wall(kit,panel,{axis:'x',at:31.7,from:83.9,to:108.1,y2:top,world:2});
  for(const z of [92.0,100.0])wall(kit,panel,{axis:'z',at:z,from:26.1,to:31.6,y2:top,world:2});
  // hall finishes
  const cx=(h.x1+h.x2)/2,cz=(h.z1+h.z2)/2;
  kit.add(box(h.x2-h.x1,.1,h.z2-h.z1),kit.tex('terrazzo'),{pos:[cx,-.05,cz],world:1});
  kit.add(box(h.x2-h.x1,.05,h.z2-h.z1),kit.tex('ceiling-tile'),{pos:[cx,top+.025,cz],world:1.2});
  const walnut=kit.tex('walnut-veneer');
  for(const [x,gaps] of [[h.x1+.01,[{center:96,width:2.4,top:2.5}]],[h.x2-.01,['16','17','18'].map(doorGap)]])
    wall(kit,walnut,{axis:'x',at:x,from:h.z1,to:h.z2,y2:.12,thick:.03,gaps:gaps.map(g=>({...g,top:.12}))});
  const panelLamp=kit.plain('lamp-neutral',{color:0xf4f1ea,emissive:0xfff6e8,intensity:1.9,metalness:0});
  for(const z of [88,96,104])kit.add(box(.5,.03,1.4),panelLamp,{pos:[cx,top-.015,z]});
  frame(kit,kit.tex('hinoki'),SUITES['16'].door);
  frame(kit,walnut,SUITES['17'].door);
  frame(kit,kit.tex('brushed-stainless'),SUITES['18'].door);
  for(const [code,label,en] of [['16','和室','JAPANESE ROOM'],['17','洋室','WESTERN ROOM'],['18','会議室','MEETING ROOM']])
    sign(group,[[`${code}  ${label}`,60],[en,30]],[h.x2-.02,2.5,SUITES[code].door],-Math.PI/2,[1.1,.3],{width:440,height:120,border:false,bg:'#20282a'});
  sign(group,[['居住区画',64],['B4-15 LIVING QUARTERS',30]],[h.x1+.02,2.75,99.0],Math.PI/2,[1.4,.36],{width:520,height:130,border:false,bg:'#20282a'});
  // frosted glass beside the meeting room door, both faces
  const film=kit.tex('frosted-film');
  for(const [z1,z2] of [[100.4,103.25],[104.75,107.6]])for(const x of [25.885,26.115])
    kit.add(box(.02,1.4,z2-z1),film,{pos:[x,1.6,(z1+z2)/2],world:1});
  // furniture
  const shoe=props(LIVING,'shoe-cabinet')[0];
  kit.add(box(.5,1.0,1.6,.6,{swap:true}),kit.tex('hinoki'),{pos:[shoe.x,.5,shoe.z]});
  kit.add(box(.52,.03,1.62,.6),kit.tex('urushi-lacquer'),{pos:[shoe.x,1.015,shoe.z]});
  const bench=props(LIVING,'bench')[0],brass=kit.tex('brass-antique');
  kit.add(box(.42,.05,1.8,.8),walnut,{pos:[bench.x,.45,bench.z]});
  for(const dz of [-.75,.75])for(const dx of [-.15,.15])kit.beam([bench.x+dx,0,bench.z+dz],[bench.x+dx,.43,bench.z+dz],.02,brass,.4);
  plant(kit,props(LIVING,'plant')[0],R);
  // vending machine, extinguishers and a first-aid cabinet
  const vend=props(LIVING,'vending')[0];
  kit.add(box(.75,1.85,1.0,1),kit.tex('vending-red'),{pos:[vend.x,.925,vend.z]});
  kit.add(new THREE.PlaneGeometry(1.0,1.85),kit.tex('vending-front'),{pos:[vend.x+.38,.925,vend.z],rot:[0,Math.PI/2,0]});
  extinguisher(kit,h.x2-.1,0,90.6,-Math.PI/2);
  extinguisher(kit,h.x1+.1,0,106.6,Math.PI/2);
  kit.add(box(.18,.62,.52,1),kit.tex('cabinet-enamel'),{pos:[h.x1+.09,1.5,104.3]});
  kit.add(new THREE.PlaneGeometry(.5,.6),kit.tex('first-aid'),{pos:[h.x1+.185,1.5,104.3],rot:[0,Math.PI/2,0]});
  kiosk(kit,group,LIVING,[LIVING.terminal[0],0,LIVING.terminal[1]],0);
}

function plant(kit,p,R){
  kit.add(cyl(.25,.45,1,{top:.3,seg:18}),kit.tex('terrazzo'),{pos:[p.x,.225,p.z]});
  for(let i=0;i<5;i++){
    const g=planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.35,2.2,i+p.x),.6);
    kit.add(g,kit.tex('foliage',{variant:'leaf',side:THREE.DoubleSide}),{pos:[p.x+(R()-.5)*.3,.75+i*.17,p.z+(R()-.5)*.3],scale:[.32-i*.03,.26,.32-i*.03],rot:[0,R()*3,0]});
  }
}

// ---------- 16 和室 ----------
function washitsu(kit,group){
  const R=rng(16),s=SUITES['16'],{x1,x2}=SUITE_X,top=s.height,cz=(s.z1+s.z2)/2,cx=(x1+x2)/2;
  const hinoki=kit.tex('hinoki'),plaster=kit.tex('juraku-wall'),lacquer=kit.tex('urushi-lacquer');
  kit.add(box(x2-x1,.1,s.z2-s.z1),hinoki,{pos:[cx,-.05,cz],world:.6});
  kit.add(box(x2-x1,.04,s.z2-s.z1),kit.tex('sugi-ceiling'),{pos:[cx,top+.02,cz],world:1.2});
  // walls: clay plaster above, posts and the nageshi rail in hinoki
  wall(kit,plaster,{axis:'x',at:x1+.01,from:s.z1,to:s.z2,y2:top,thick:.02,gaps:[doorGap('16')],world:1.2});
  wall(kit,plaster,{axis:'x',at:x2-.01,from:s.z1,to:s.z2,y2:top,thick:.02,world:1.2});
  wall(kit,plaster,{axis:'z',at:s.z1+.01,from:x1,to:x2,y2:top,thick:.02,world:1.2});
  wall(kit,plaster,{axis:'z',at:s.z2-.01,from:x1,to:x2,y2:top,thick:.02,world:1.2});
  for(const [x,z] of [[x1+.07,s.z1+.07],[x2-.07,s.z1+.07],[x1+.07,s.z2-.07],[x2-.07,s.z2-.07],[x1+.07,87.33],[x1+.07,88.67],[x2-.07,88.0]])
    kit.add(box(.12,top,.12,.6,{swap:true}),hinoki,{pos:[x,top/2,z]});
  for(const [ax,at] of [['x',x1+.04],['x',x2-.04],['z',s.z1+.04],['z',s.z2-.04]]){
    const len=ax==='x'?s.z2-s.z1:x2-x1,mid=ax==='x'?cz:cx;
    kit.add(ax==='x'?box(.06,.1,len,.6):box(len,.1,.06,.6),hinoki,{pos:ax==='x'?[at,1.95,mid]:[mid,1.95,at]});
    kit.add(ax==='x'?box(.06,.06,len,.6):box(len,.06,.06,.6),hinoki,{pos:ax==='x'?[at,top-.03,mid]:[mid,top-.03,at]});
  }
  // tatami: 2 x 7 mats with heri borders along their long sides
  const tatami=kit.tex('tatami'),heri=kit.tex('tatami-heri');
  for(let col=0;col<2;col++)for(let row=0;row<7;row++){
    const mx=27.0+.91+col*1.82,mz=84.4+.455+row*.91;
    kit.add(box(1.8,.05,.89,1),tatami,{pos:[mx,.025,mz]});
    for(const dz of [-.43,.43])kit.add(box(1.8,.052,.03,.3),heri,{pos:[mx,.026,mz+dz]});
  }
  // tokonoma alcove with hanging scroll, and chigaidana shelves
  const tok=props(WASHITSU,'tokonoma')[0];
  kit.add(box(tok.w,.18,tok.d,1),kit.tex('tokonoma-board'),{pos:[tok.x,.09,tok.z]});
  kit.add(box(tok.w,.18,.04,.6),lacquer,{pos:[tok.x,.09,tok.z-tok.d/2]});
  kit.add(box(.13,top,.13,.6,{swap:true}),hinoki,{pos:[tok.x-tok.w/2,top/2,tok.z-tok.d/2+.06]});
  kit.add(box(tok.w,.1,.08,.6),hinoki,{pos:[tok.x,2.15,tok.z-tok.d/2+.04]});
  kit.add(new THREE.PlaneGeometry(.62,1.55),kit.tex('kakejiku'),{pos:[tok.x+.2,1.4,s.z2-.025],rot:[0,Math.PI,0]});
  kit.add(cyl(.09,.3,.6,{top:.06,seg:16}),lacquer,{pos:[tok.x+1.0,.33,tok.z+.1]});
  const sh=props(WASHITSU,'shelves')[0],fusuma=kit.tex('fusuma');
  kit.add(box(sh.w-.1,.4,.85,.6,{swap:true}),hinoki,{pos:[sh.x,.2,sh.z]});
  kit.add(box(sh.w-.1,.4,.85,.6,{swap:true}),hinoki,{pos:[sh.x,top-.25,sh.z]});
  for(const [dx,y] of [[-.4,1.0],[.4,1.22]])kit.add(box(1.1,.04,.5,.6),lacquer,{pos:[sh.x+dx,y,sh.z]});
  for(const y of [.2,top-.25])kit.add(new THREE.PlaneGeometry(sh.w-.14,.34),fusuma,{pos:[sh.x,y,sh.z-.43],rot:[0,Math.PI,0]});
  // fusuma closet on the south wall, glowing shoji on the east wall
  for(let i=0;i<4;i++){
    const x=27.15+i*.9+.45;
    kit.add(scaleUV(new THREE.PlaneGeometry(.88,1.8),1,2),fusuma,{pos:[x,.95,s.z1+.03]});
    kit.add(box(.04,1.82,.03,.6,{swap:true}),hinoki,{pos:[x-.45,.95,s.z1+.035]});
  }
  const shoji=kit.tex('shoji');
  for(let i=0;i<6;i++){
    const z=84.6+i*.9+.45;
    kit.add(scaleUV(new THREE.PlaneGeometry(.88,1.8),1,2),shoji,{pos:[x2-.03,.95,z],rot:[0,-Math.PI/2,0]});
    kit.add(box(.03,1.82,.04,.6,{swap:true}),hinoki,{pos:[x2-.035,.95,z-.45]});
  }
  // low table, cushions, paper lantern
  const t=props(WASHITSU,'chabudai')[0];
  kit.add(cyl(.55,.04,.6,{seg:32}),lacquer,{pos:[t.x,.33,t.z]});
  for(const a of [0,1,2,3]){
    const ang=a*Math.PI/2+.785;
    kit.add(box(.05,.26,.05,.6),lacquer,{pos:[t.x+Math.cos(ang)*.4,.18,t.z+Math.sin(ang)*.4]});
    const ca=a*Math.PI/2;
    kit.add(box(.55,.07,.6,.5),kit.tex('zabuton-indigo'),{pos:[t.x+Math.cos(ca)*.95,.085,t.z+Math.sin(ca)*.95],rot:[0,ca+(R()-.5)*.1,0]});
  }
  const andon=props(WASHITSU,'andon')[0];
  kit.add(box(.3,.6,.3,.5),kit.tex('washi-paper'),{pos:[andon.x,.55,andon.z]});
  for(const dx of [-.16,.16])for(const dz of [-.16,.16])kit.add(box(.025,.85,.025,.5),hinoki,{pos:[andon.x+dx,.425,andon.z+dz]});
  slidingDoor(group,'16',{x:26,z:s.door,axis:'x',width:DOOR_W,height:DOOR_H},(leaf,w,h)=>{
    const body=new THREE.Mesh(scaleUV(new THREE.BoxGeometry(w,h,.03),1,2),fusuma);body.position.y=h/2;
    const pull=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.035,16),lacquer);pull.rotation.x=Math.PI/2;pull.position.set(0,1.0,0);
    leaf.add(body,pull);
  });
  kiosk(kit,group,WASHITSU,[WASHITSU.terminal[0],0,WASHITSU.terminal[1]],Math.PI/2);
}

// ---------- 17 洋室 ----------
function yoshitsu(kit,group){
  const R=rng(17),s=SUITES['17'],{x1,x2}=SUITE_X,top=s.height,cz=(s.z1+s.z2)/2,cx=(x1+x2)/2;
  const walnut=kit.tex('walnut-veneer'),brass=kit.tex('brass-antique'),marble=kit.tex('carrara-marble');
  const wains=kit.tex('wainscot-white'),damask=kit.tex('damask-wallpaper');
  kit.add(box(x2-x1,.1,s.z2-s.z1),kit.tex('oak-herringbone'),{pos:[cx,-.05,cz],world:1.2});
  kit.add(box(x2-x1,.04,s.z2-s.z1),kit.tex('satin-laminate'),{pos:[cx,top+.02,cz],world:2});
  const runs=[
    {axis:'x',at:x1+.01,from:s.z1,to:s.z2,gaps:[doorGap('17')]},
    {axis:'x',at:x2-.01,from:s.z1,to:s.z2},
    {axis:'z',at:s.z1+.01,from:x1,to:x2},
    {axis:'z',at:s.z2-.01,from:x1,to:x2},
  ];
  for(const r of runs){
    wall(kit,wains,{...r,y2:1.0,thick:.02,gaps:(r.gaps??[]).map(g=>({...g,top:1.0})),world:1});
    wall(kit,damask,{...r,y1:1.0,y2:top,thick:.02,gaps:(r.gaps??[]).map(g=>({...g,center:g.center,top:g.top})),world:.8});
    const inset=r.axis==='x'?(r.at<cx?.025:-.025):(r.at<cz?.025:-.025);
    for(const [y,hgt,mat] of [[1.0,.05,walnut],[.06,.12,walnut],[top-.06,.12,wains]])
      wall(kit,mat,{...r,at:r.at+inset,y1:y-hgt/2,y2:y+hgt/2,thick:.04,gaps:y<DOOR_H?(r.gaps??[]).map(g=>({...g,top:y+hgt})):[],world:.8});
  }
  // fireplace
  const fp=props(YOSHITSU,'fireplace')[0],fz=s.z2-.2;
  for(const dx of [-.85,.85])kit.add(box(.6,1.25,.35,1),marble,{pos:[fp.x+dx,.625,fz]});
  kit.add(box(1.1,.5,.35,1),marble,{pos:[fp.x,1.0,fz]});
  kit.add(box(2.5,.08,.45,.8),walnut,{pos:[fp.x,1.29,fz-.03]});
  kit.add(box(2.5,.06,.7,1),marble,{pos:[fp.x,.03,fz-.15]});
  kit.add(box(1.1,.75,.02,1),kit.tex('fireplace-brick'),{pos:[fp.x,.375,s.z2-.03]});
  for(const dx of [-.55,.55])kit.add(box(.02,.75,.32,1),kit.tex('fireplace-brick'),{pos:[fp.x+dx,.375,fz]});
  for(const dz of [-.06,.06])kit.add(cyl(.07,.7,.5),kit.tex('timber-beam'),{pos:[fp.x,.12,fz+dz],rot:[0,0,Math.PI/2+(R()-.5)*.2]});
  kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.4,3,1),1),kit.plain('fire',{color:0xff7a2a,emissive:0xff6a1a,intensity:2.6,metalness:0}),{pos:[fp.x,.28,fz],scale:[.32,.18,.1]});
  // seating
  const velvet=kit.tex('velvet-green'),sofa=props(YOSHITSU,'sofa')[0];
  kit.add(box(2.4,.42,.9,.5),velvet,{pos:[sofa.x,.21,sofa.z]});
  kit.add(box(2.2,.12,.72,.5),velvet,{pos:[sofa.x,.48,sofa.z+.05]});
  kit.add(box(2.4,.52,.22,.5),velvet,{pos:[sofa.x,.68,sofa.z-.36]});
  for(const dx of [-1.15,1.15])kit.add(box(.18,.62,.9,.5),velvet,{pos:[sofa.x+dx,.31,sofa.z]});
  const leather=kit.tex('chesterfield-leather');
  for(const p of props(YOSHITSU,'armchair')){
    const rot=p.x<cx?-.7:.7,q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rot,0));
    const at=(dx,y,dz)=>new THREE.Vector3(dx,y,dz).applyQuaternion(q).add(new THREE.Vector3(p.x,0,p.z)).toArray();
    kit.add(box(.85,.42,.85,.5),leather,{pos:at(0,.21,0),quat:q});
    kit.add(box(.85,.5,.18,.5),leather,{pos:at(0,.65,-.34),quat:q});
    for(const dx of [-.38,.38])kit.add(box(.14,.6,.85,.5),leather,{pos:at(dx,.3,0),quat:q});
  }
  const tbl=props(YOSHITSU,'coffee-table')[0];
  kit.add(box(1.0,.05,.55,.8),walnut,{pos:[tbl.x,.42,tbl.z]});
  for(const dx of [-.42,.42])for(const dz of [-.2,.2])kit.beam([tbl.x+dx,0,tbl.z+dz],[tbl.x+dx,.4,tbl.z+dz],.018,brass,.4);
  kit.add(new THREE.PlaneGeometry(3.0,2.0),kit.tex('persian-rug'),{pos:[cx,.006,98.1],rot:[-Math.PI/2,0,0]});
  // bookshelf
  const bs=props(YOSHITSU,'bookshelf')[0];
  kit.add(box(.42,2.3,1.9,.8),walnut,{pos:[bs.x+.02,1.15,bs.z]});
  for(const y of [.3,.75,1.2,1.65,2.1]){
    kit.add(scaleUV(new THREE.PlaneGeometry(1.76,.4),1.76/.4,1),kit.tex('book-spines'),{pos:[bs.x-.2,y,bs.z],rot:[0,-Math.PI/2,0]});
    kit.add(box(.4,.03,1.8,.8),walnut,{pos:[bs.x+.01,y-.215,bs.z]});
  }
  // window with linen curtains on the south wall
  kit.add(box(1.6,1.6,.02),kit.plain('night-window',{color:0x0e1a2a,emissive:0x1d3550,intensity:.8,roughness:.1,metalness:.2}),{pos:[cx,1.6,s.z1+.03]});
  for(const dx of [-1.05,1.05])kit.add(box(.6,2.55,.06,1),kit.tex('linen-curtain'),{pos:[cx+dx,1.5,s.z1+.08]});
  kit.beam([cx-1.5,2.82,s.z1+.1],[cx+1.5,2.82,s.z1+.1],.02,brass,.4);
  // lighting: brass floor lamp and chandelier
  const fl=props(YOSHITSU,'floor-lamp')[0],washi=kit.tex('washi-paper');
  kit.add(cyl(.18,.03,.4),brass,{pos:[fl.x,.015,fl.z]});
  kit.beam([fl.x,0,fl.z],[fl.x,1.5,fl.z],.018,brass,.4);
  kit.add(roundUV(new THREE.CylinderGeometry(.14,.22,.3,18,1,true),.5,.2),kit.tex('washi-paper',{variant:'shade',side:THREE.DoubleSide}),{pos:[fl.x,1.6,fl.z]});
  kit.beam([cx,top,cz],[cx,2.65,cz],.012,brass,.4);
  kit.add(roundUV(new THREE.TorusGeometry(.42,.025,8,32),.4,.03),brass,{pos:[cx,2.55,cz],rot:[Math.PI/2,0,0]});
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;kit.add(new THREE.SphereGeometry(.045,10,8),kit.plain('bulb',{color:0xfff4e0,emissive:0xffe7c0,intensity:3,metalness:0}),{pos:[cx+Math.cos(a)*.42,2.6,cz+Math.sin(a)*.42]});}
  slidingDoor(group,'17',{x:26,z:s.door,axis:'x',width:DOOR_W,height:DOOR_H},(leaf,w,h)=>{
    const body=new THREE.Mesh(box(w,h,.04,.8,{swap:true}),walnut);body.position.y=h/2;
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),brass);knob.position.set(0,1.0,.04);
    leaf.add(body,knob);
  });
  kiosk(kit,group,YOSHITSU,[YOSHITSU.terminal[0],0,YOSHITSU.terminal[1]],Math.PI/2);
}

// ---------- 18 会議室 ----------
function meeting(kit,group){
  const R=rng(18),s=SUITES['18'],{x1,x2}=SUITE_X,top=s.height,cz=(s.z1+s.z2)/2,cx=(x1+x2)/2;
  const felt=kit.tex('felt-panel'),steel=kit.tex('brushed-stainless'),mesh=kit.tex('mesh-fabric'),plastic=kit.tex('molded-plastic');
  kit.add(box(x2-x1,.1,s.z2-s.z1),kit.tex('conf-carpet'),{pos:[cx,-.05,cz],world:1});
  kit.add(box(x2-x1,.04,s.z2-s.z1),kit.tex('ceiling-tile'),{pos:[cx,top+.02,cz],world:1.2});
  wall(kit,kit.tex('satin-laminate'),{axis:'x',at:x1+.01,from:s.z1,to:s.z2,y2:top,thick:.02,world:2,
    gaps:[doorGap('18'),{center:101.825,width:2.85,top:2.3,sill:.9},{center:106.175,width:2.85,top:2.3,sill:.9}]});
  wall(kit,kit.tex('oak-slats'),{axis:'x',at:x2-.01,from:s.z1,to:s.z2,y2:top,thick:.02,world:1});
  wall(kit,felt,{axis:'z',at:s.z1+.01,from:x1,to:x2,y2:top,thick:.02,world:1});
  wall(kit,felt,{axis:'z',at:s.z2-.01,from:x1,to:x2,y2:top,thick:.02,world:1});
  for(const z of [100.6,107.4])kit.add(box(.02,1.4,.1,1),steel,{pos:[x1+.02,1.6,z]});
  const lamp=kit.plain('lamp-cool');
  for(const z of [102.6,105.6])kit.add(box(.6,.03,1.2),lamp,{pos:[cx,top-.015,z]});
  // table and chairs
  const t=props(MEETING,'table')[0];
  kit.add(box(1.4,.05,4.2,1),kit.tex('table-oak'),{pos:[t.x,.74,t.z]});
  for(const dz of [-1.4,1.4])kit.add(box(.4,.7,.8,.6),steel,{pos:[t.x,.35,t.z+dz]});
  for(const p of props(MEETING,'chair')){
    const side=p.x<t.x?-1:1;
    kit.add(box(.5,.07,.5,.3),mesh,{pos:[p.x,.46,p.z]});
    kit.add(box(.06,.55,.46,.3),mesh,{pos:[p.x+side*.24,.8,p.z]});
    kit.beam([p.x,.05,p.z],[p.x,.43,p.z],.025,steel,.4);
    kit.add(cyl(.28,.03,.3,{seg:10}),plastic,{pos:[p.x,.03,p.z]});
  }
  // presentation screen and projector, whiteboard, moss wall, blinds, plant
  kit.add(box(2.5,1.45,.04,.5),plastic,{pos:[cx,1.55,s.z1+.04]});
  kit.add(new THREE.PlaneGeometry(2.4,1.35),kit.tex('presentation-screen'),{pos:[cx,1.55,s.z1+.065]});
  kit.add(box(.4,.14,.32,.3),plastic,{pos:[cx,top-.2,103.0]});
  kit.beam([cx,top,103.0],[cx,top-.13,103.0],.02,steel,.4);
  kit.add(box(2.4,1.2,.03,1.2),kit.tex('whiteboard'),{pos:[29.8,1.45,s.z2-.03]});
  kit.add(box(2.4,.04,.08,.4),steel,{pos:[29.8,.83,s.z2-.06]});
  kit.add(box(1.6,1.6,.06,1),kit.tex('moss-wall'),{pos:[27.25,1.45,s.z2-.04]});
  for(const z of [101.8,106.2])kit.add(box(.03,1.3,1.6,.8),kit.tex('venetian-blind'),{pos:[x2-.035,1.65,z]});
  plant(kit,props(MEETING,'plant')[0],R);
  slidingDoor(group,'18',{x:26,z:s.door,axis:'x',width:DOOR_W,height:DOOR_H},(leaf,w,h)=>{
    const pane=new THREE.Mesh(box(w,h,.03,1),kit.tex('frosted-film'));pane.position.y=h/2;
    const edge=new THREE.Mesh(box(.04,h,.04,.4),steel);edge.position.set(0,h/2,0);
    leaf.add(pane,edge);
  });
  kiosk(kit,group,MEETING,[MEETING.terminal[0],0,MEETING.terminal[1]],Math.PI/2);
}
