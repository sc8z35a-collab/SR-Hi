import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,lumpy,rng,kiosk,sign} from './kit.js';
import {ONSEN,ONSEN_ROOM} from './cavern-layout.js';
import {wall} from './quarters.js';
import {lantern} from './surface.js';

// 24 大浴場: a geothermal hot-spring bathhouse south of the living corridor (15). The dressing room
// and rest area face the corridor; behind the partition are the wash stations, a hinoki bath,
// a cold bath and a rock bath in a grotto with a gravel garden. Built from the onsen-* sheets.
const P=type=>ONSEN_ROOM.props.filter(p=>p.type===type);
const {x1,x2,z1,z2,height:H,partition:PZ,door:DX,entry:EX}=ONSEN;
const rock=(kit,material,pos,scale,seed,rot=0)=>kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.28,1.8,seed),1.2),material,{pos,scale,rot:[0,rot,0]});
/** A horizontal plane facing up. */
const flat=(w,d)=>new THREE.PlaneGeometry(w,d).rotateX(-Math.PI/2);

export function buildOnsen(kit,group){
  const R=rng(24);
  shell(kit,group);
  dressing(kit,group);
  lounge(kit);
  washArea(kit);
  baths(kit,R);
  grotto(kit,R);
  kiosk(kit,group,ONSEN_ROOM,[ONSEN_ROOM.terminal[0],0,ONSEN_ROOM.terminal[1]],0);
}

function shell(kit,group){
  const paint=kit.tex('bath-wall-paint'),chestnut=kit.tex('chestnut-board'),mosaic=kit.tex('white-mosaic-tile');
  const hinoki=kit.tex('hinoki-paneling'),rockWall=kit.tex('bath-rock-wet',{variant:'wall'});
  // structural walls (the corridor's south wall closes x < 31.8 at z2)
  wall(kit,paint,{axis:'x',at:x1-.1,from:z1-.2,to:z2,y2:H+.2,world:1.5});
  wall(kit,paint,{axis:'x',at:x2+.1,from:z1-.2,to:z2+.1,y2:H+.2,world:1.5});
  wall(kit,paint,{axis:'z',at:z1-.1,from:x1-.2,to:x2+.2,y2:H+.2,world:1.5});
  wall(kit,paint,{axis:'z',at:z2,from:31.8,to:x2+.2,y2:H+.2,world:1.5});
  // partition between the bath and the dressing room: doorway and a fogged window
  wall(kit,paint,{axis:'z',at:PZ,from:x1,to:x2,y2:H,thick:.15,gaps:[{center:DX,width:1.2,top:2.1},{center:29.5,width:2.6,top:2.3,sill:1.0}],world:1.5});
  kit.add(box(2.6,1.3,.03,1),kit.tex('fogged-glass'),{pos:[29.5,1.65,PZ]});
  for(const x of [28.2,29.5,30.8])kit.add(box(.05,1.3,.06,.6),kit.tex('hinoki'),{pos:[x,1.65,PZ]});
  // floors and ceilings
  kit.add(box(33.3-x1,.1,PZ-z1),kit.tex('bath-floor-stone'),{pos:[(x1+33.3)/2,-.05,(z1+PZ)/2],world:.9});
  kit.add(box(x2-33.3,.1,PZ-z1),kit.tex('basalt-flagstone'),{pos:[(33.3+x2)/2,-.05,(z1+PZ)/2],world:1.5});
  kit.add(box(31-x1,.1,z2-PZ),kit.tex('rattan-mat'),{pos:[(x1+31)/2,-.05,(PZ+z2)/2],world:.6});
  kit.add(box(x2-31,.1,z2-PZ),chestnut,{pos:[(31+x2)/2,-.05,(PZ+z2)/2],world:1});
  kit.add(box(x2-x1,.05,PZ-z1),kit.tex('cedar-lattice-ceiling'),{pos:[(x1+x2)/2,H+.025,(z1+PZ)/2],world:1.8});
  kit.add(box(x2-x1,.05,z2-PZ),kit.tex('steam-plaster'),{pos:[(x1+x2)/2,H+.025,(PZ+z2)/2],world:1.5});
  // bath walls: white mosaic below hinoki boards on the west, green tuff on the south, rock in the grotto
  wall(kit,mosaic,{axis:'x',at:x1+.01,from:z1,to:PZ,y2:1.3,thick:.02,world:.3});
  wall(kit,hinoki,{axis:'x',at:x1+.01,from:z1,to:PZ,y1:1.3,y2:H,thick:.02,world:1});
  wall(kit,kit.tex('green-tuff-wall'),{axis:'z',at:z1+.01,from:x1,to:33.3,y2:H,thick:.02,world:1.2});
  wall(kit,rockWall,{axis:'z',at:z1+.01,from:33.3,to:x2,y2:H,thick:.02,world:1.5});
  wall(kit,rockWall,{axis:'x',at:x2-.01,from:z1,to:PZ,y2:H,thick:.02,world:1.5});
  wall(kit,mosaic,{axis:'z',at:PZ-.085,from:x1,to:x2,y2:1.0,thick:.02,gaps:[{center:DX,width:1.2,top:1.0}],world:.3});
  // dressing-room side: chestnut wainscot below painted walls
  wall(kit,chestnut,{axis:'z',at:PZ+.085,from:x1,to:x2,y2:.9,thick:.02,gaps:[{center:DX,width:1.2,top:.9}],world:1});
  wall(kit,chestnut,{axis:'z',at:z2-.11,from:x1,to:x2,y2:.9,thick:.02,gaps:[{center:EX,width:1.2,top:.9}],world:1});
  wall(kit,paint,{axis:'z',at:z2-.11,from:x1,to:x2,y1:.9,y2:H,thick:.02,gaps:[{center:EX,width:1.2,top:2.1}],world:1.5});
  wall(kit,chestnut,{axis:'x',at:x2-.01,from:PZ,to:z2,y2:.9,thick:.02,world:1});
  wall(kit,chestnut,{axis:'x',at:x1+.01,from:PZ,to:z2,y2:.9,thick:.02,world:1});
  // vermilion noren and a sign on the corridor side, indigo noren at the bath doorway
  const vermilion=kit.tex('noren-vermilion',{side:THREE.DoubleSide});
  kit.beam([EX-.65,2.08,z2+.16],[EX+.65,2.08,z2+.16],.018,kit.tex('urushi-lacquer'),.5,6);
  for(const dx of [-.3,.3])kit.add(new THREE.BoxGeometry(.58,.72,.01),vermilion,{pos:[EX+dx,1.71,z2+.16]});
  sign(group,[['24  大浴場',60],['BATHHOUSE',30]],[EX,2.45,z2+.12],0,[1.1,.3],{width:440,height:120,border:false,bg:'#20282a'});
  kit.beam([DX-.65,2.08,PZ+.13],[DX+.65,2.08,PZ+.13],.018,kit.tex('urushi-lacquer'),.5,6);
  for(const dx of [-.3,.3])kit.add(new THREE.BoxGeometry(.58,.72,.01),kit.tex('noren-indigo',{side:THREE.DoubleSide}),{pos:[DX+dx,1.71,PZ+.13]});
  // mats at the doorways
  kit.add(box(1.1,.015,.7,.6),kit.tex('rubber-coin-mat'),{pos:[EX,.008,z2-.55]});
  kit.add(box(1.1,.015,.6,.6),kit.tex('rubber-coin-mat'),{pos:[DX,.008,PZ+.5]});
  kit.add(box(1.1,.03,.7,.8),kit.tex('hinoki-slatted'),{pos:[DX,.015,PZ-.55]});
  // ceiling lamps
  const lamp=kit.plain('lamp-warm');
  for(const [x,z] of [[28.5,73.5],[31.5,76.8],[27.6,81.2],[35.0,81.2]])kit.add(box(.6,.04,.6),lamp,{pos:[x,H-.02,z]});
  kit.add(cyl(.18,.25,.5,{seg:12}),kit.tex('washi-paper'),{pos:[36,H-.35,73]});
  kit.beam([36,H,73],[36,H-.22,73],.01,kit.tex('dark-steel'),.3,4);
}

function dressing(kit,group){
  const kiri=kit.tex('kiri-locker'),lacquer=kit.tex('urushi-lacquer'),brass=kit.tex('brass-antique');
  // paulownia lockers on the west wall: 9 x 5 small doors
  const l=P('lockers')[0],lx=x1+.225,front=x1+.452,lz1=l.z-l.d/2+.05,lz2=l.z+l.d/2-.05;
  kit.add(box(.45,1.9,lz2-lz1,1,{swap:true}),kiri,{pos:[lx,.95,l.z]});
  for(let r=1;r<5;r++)kit.add(box(.01,.012,lz2-lz1,.3),lacquer,{pos:[front,r*.38,l.z]});
  for(let c=0;c<=9;c++)kit.add(box(.01,1.9,.012,.3),lacquer,{pos:[front,.95,lz1+c*(lz2-lz1)/9]});
  for(let r=0;r<5;r++)for(let c=0;c<9;c++)kit.add(box(.015,.03,.06,.2),brass,{pos:[front+.01,r*.38+.25,lz1+(c+.8)*(lz2-lz1)/9]});
  // basket shelf against the partition: rattan baskets, towels and folded yukata
  const s=P('basket-shelf')[0],sz=s.z+.02;
  for(const y of [.03,.45,.9])kit.add(box(s.w,.03,.5,1),kiri,{pos:[s.x,y,sz]});
  for(const dx of [-s.w/2,0,s.w/2])kit.add(box(.03,.92,.5,1),kiri,{pos:[s.x+dx,.46,sz]});
  const weave=kit.tex('rattan-weave'),towel=kit.tex('towel-pile'),yukata=kit.tex('yukata-navy');
  for(const y of [.06,.48])for(let i=0;i<5;i++){
    const x=s.x-s.w/2+.3+i*.55;
    kit.add(box(.46,.24,.4,.3),weave,{pos:[x,y+.12,sz]});
    if((i+(y>.1?1:0))%2)kit.add(box(.36,.08,.3,.3),towel,{pos:[x,y+.27,sz]});
  }
  for(let i=0;i<4;i++)kit.add(box(.42,.06,.32,.4),i%2?towel:yukata,{pos:[s.x-.9+i*.6,.95+.03,sz]});
  kit.add(box(.42,.06,.32,.4),yukata,{pos:[s.x-.9,1.01,sz]});
  // washstand with three basins and a wide mirror
  const w=P('washstand')[0],marble=kit.tex('artificial-marble'),steel=kit.tex('brushed-stainless');
  kit.add(box(w.w,.78,.5,1),kiri,{pos:[w.x,.39,w.z+.02]});
  kit.add(box(w.w,.06,.56,.8),marble,{pos:[w.x,.81,w.z]});
  for(const dx of [-1.3,0,1.3]){
    kit.add(new THREE.CylinderGeometry(.19,.19,.01,24),kit.tex('white-composite'),{pos:[w.x+dx,.845,w.z-.03]});
    kit.add(cyl(.02,.2,.3,{seg:8}),steel,{pos:[w.x+dx,.94,w.z+.18]});
    kit.add(box(.03,.03,.14,.3),steel,{pos:[w.x+dx,1.03,w.z+.12]});
  }
  const mirror=kit.plain('mirror',{color:0xd9e1e4,roughness:.06,metalness:1});
  kit.add(box(w.w-.2,1.0,.02,1),mirror,{pos:[w.x,1.45,z2-.13]});
  kit.add(box(w.w-.1,1.08,.015,1),kit.tex('chestnut-board'),{pos:[w.x,1.45,z2-.115]});
  void group;
}

function lounge(kit){
  const chestnut=kit.tex('chestnut-board'),iron=kit.tex('sulfur-iron');
  // raised platform of borderless Ryukyu tatami, laid with alternating grain
  const t=P('tatami-platform')[0],ty=.38;
  kit.add(box(t.w,ty,t.d,1),chestnut,{pos:[t.x,ty/2,t.z]});
  const mat=kit.tex('ryukyu-tatami');
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)
    kit.add(box(.88,.04,.88,.88),mat,{pos:[t.x-1.32+i*.88,ty+.02,t.z-1.32+j*.88],rot:[0,(i+j)%2?Math.PI/2:0,0]});
  kit.add(box(1.0,.04,.7,1),chestnut,{pos:[t.x,ty+.33,t.z]});
  for(const dx of [-.42,.42])for(const dz of [-.27,.27])kit.add(box(.05,.29,.05,.5),chestnut,{pos:[t.x+dx,ty+.165,t.z+dz]});
  for(const [dx,dz] of [[0,-.75],[0,.75],[-.85,0],[.85,0]])kit.add(box(.55,.07,.55,.5),kit.tex('zabuton-indigo'),{pos:[t.x+dx,ty+.075,t.z+dz]});
  // massage chair facing the room
  const m=P('massage-chair')[0],leather=kit.tex('black-leatherette');
  kit.add(box(.66,.42,.8,.5),leather,{pos:[m.x,.21,m.z]});
  kit.add(box(.62,.14,.62,.5),leather,{pos:[m.x,.49,m.z-.04]});
  kit.add(box(.66,.95,.22,.5),leather,{pos:[m.x,.95,m.z+.36],rot:[-.28,0,0]});
  for(const s of [-1,1])kit.add(box(.14,.3,.74,.5),leather,{pos:[m.x+s*.33,.62,m.z]});
  kit.add(box(.5,.28,.34,.5),leather,{pos:[m.x,.22,m.z-.56],rot:[.35,0,0]});
  // bottled-milk vending machine
  const v=P('milk-vending')[0];
  kit.add(box(1.0,1.85,.72,1),kit.tex('vending-red'),{pos:[v.x,.925,v.z]});
  kit.add(new THREE.PlaneGeometry(.95,1.75),kit.tex('vending-front'),{pos:[v.x,.93,v.z-.365],rot:[0,Math.PI,0]});
  // bench along the partition and hot-water pipes overhead
  const b=P('bench')[0];
  kit.add(box(b.w,.05,.42,1),chestnut,{pos:[b.x,.45,b.z]});
  for(const dx of [-b.w/2+.15,0,b.w/2-.15])kit.add(box(.06,.43,.36,.4),iron,{pos:[b.x+dx,.215,b.z]});
  const copper=kit.tex('verdigris-copper');
  for(const y of [2.6,2.75])kit.beam([31.2,y,PZ+.22],[x2-.1,y,PZ+.22],.045,copper,.6,10);
  for(let x=31.8;x<x2;x+=1.3)kit.add(box(.06,.3,.12,.3),iron,{pos:[x,2.7,PZ+.16]});
  // bamboo blind valance between the dressing room and the rest area
  kit.add(new THREE.PlaneGeometry(z2-PZ-.3,.6).rotateY(Math.PI/2),kit.tex('sudare-blind',{side:THREE.DoubleSide}),{pos:[31.0,H-.32,(PZ+z2)/2]});
  kit.beam([31.0,H-.02,PZ+.15],[31.0,H-.02,z2-.15],.02,kit.tex('bamboo'),.5,6);
}

function washArea(kit){
  // five wash stations along the west wall: tiled counter, fogged mirror, faucets, shower, stool, bucket
  const w=P('wash')[0],mosaic=kit.tex('white-mosaic-tile',{variant:'counter'}),copper=kit.tex('verdigris-copper');
  const steel=kit.tex('brushed-stainless'),resin=kit.tex('yellow-resin'),fog=kit.tex('fogged-glass');
  const za=w.z-w.d/2+.1,zb=w.z+w.d/2-.1;
  kit.add(box(.42,.08,zb-za,.3),mosaic,{pos:[x1+.21,.6,w.z]});
  kit.add(box(.02,.56,zb-za,.3),mosaic,{pos:[x1+.42,.3,w.z]});
  kit.add(box(1.0,.03,zb-za,.8),kit.tex('hinoki-slatted'),{pos:[x1+.95,.015,w.z]});
  for(let i=0;i<5;i++){
    const z=za+.6+i*(zb-za-1.2)/4;
    kit.add(new THREE.PlaneGeometry(.5,.62).rotateY(Math.PI/2),fog,{pos:[x1+.025,1.25,z]});
    for(const dz of [-.12,.12]){
      kit.add(cyl(.03,.06,.3,{seg:10}),copper,{pos:[x1+.06,.78,z+dz],rot:[0,0,Math.PI/2]});
      kit.add(cyl(.02,.06,.3,{seg:8}),copper,{pos:[x1+.09,.84,z+dz]});
    }
    kit.add(box(.08,.03,.04,.3),copper,{pos:[x1+.12,.72,z]});
    kit.beam([x1+.04,.85,z+.32],[x1+.04,1.9,z+.32],.012,steel,.3,6);
    kit.add(cyl(.035,.12,.3,{seg:8}),steel,{pos:[x1+.08,1.9,z+.32],rot:[0,0,Math.PI/2]});
    kit.add(box(.34,.22,.28,.4),resin,{pos:[x1+1.0,.14,z]});
    kit.add(new THREE.CylinderGeometry(.14,.11,.13,16),resin,{pos:[x1+.22,.705,z+.18]});
  }
  // a stack of wooden buckets by the doorway
  const sawara=kit.tex('sawara-board'),hoop=kit.tex('verdigris-copper',{variant:'hoop'});
  for(const [x,z,y] of [[26.0,77.7,0],[26.36,77.7,0],[26.18,77.7,.2]]){
    kit.add(roundUV(new THREE.CylinderGeometry(.16,.14,.2,14),.6,.16),sawara,{pos:[x,y+.1,z]});
    kit.add(roundUV(new THREE.TorusGeometry(.155,.008,4,16),.3,.01),hoop,{pos:[x,y+.15,z],rot:[Math.PI/2,0,0]});
  }
}

function baths(kit,R){
  const tub=kit.tex('hinoki-tub-wet'),rim=kit.tex('sawara-board'),clear=kit.tex('clear-onsen-water');
  // hinoki bath: boarded walls, a sawara rim and clear water fed by a wooden spout
  const b=P('inner-bath')[0],bx1=b.x-b.w/2,bx2=b.x+b.w/2,bz1=b.z-b.d/2,bz2=b.z+b.d/2,bh=.55;
  for(const [x,z,w,d] of [[b.x,bz1,b.w,.12],[b.x,bz2,b.w,.12],[bx1,b.z,.12,b.d],[bx2,b.z,.12,b.d]])
    kit.add(box(w,bh,d,.9),tub,{pos:[x,bh/2,z]});
  for(const [x,z,w,d] of [[b.x,bz1,b.w+.08,.2],[b.x,bz2,b.w+.08,.2],[bx1,b.z,.2,b.d],[bx2,b.z,.2,b.d]])
    kit.add(box(w,.05,d,.6),rim,{pos:[x,bh+.025,z]});
  kit.add(flat(b.w-.12,b.d-.12),clear,{pos:[b.x,bh-.07,b.z],world:1.5});
  kit.add(box(.14,.1,bz1-z1+.1,.6),rim,{pos:[b.x+.8,bh+.32,(z1+bz1)/2+.05]});
  kit.add(new THREE.PlaneGeometry(.08,.35),kit.tex('clear-onsen-water',{variant:'stream',side:THREE.DoubleSide}),{pos:[b.x+.8,bh+.1,bz1+.05]});
  kit.add(box(.5,.18,.32,.6),kit.tex('black-granite-polished'),{pos:[bx1+.35,.09,bz2+.3]});
  // cold plunge bath in blue-green mosaic with a polished granite rim
  const c=P('cold-bath')[0],teal=kit.tex('teal-mosaic-tile'),granite=kit.tex('black-granite-polished');
  const cx1=c.x-c.w/2,cx2=c.x+c.w/2,cz1=c.z-c.d/2,cz2=c.z+c.d/2,ch=.6;
  for(const [x,z,w,d] of [[c.x,cz1,c.w,.1],[c.x,cz2,c.w,.1],[cx1,c.z,.1,c.d],[cx2,c.z,.1,c.d]]){
    kit.add(box(w,ch,d,.3),teal,{pos:[x,ch/2,z]});
    kit.add(box(w+.06,.05,d+.06,.6),granite,{pos:[x,ch+.025,z]});
  }
  kit.add(flat(c.w-.1,c.d-.1),kit.tex('clear-onsen-water',{variant:'cold',color:0xc4e2ec}),{pos:[c.x,ch-.08,c.z],world:1.5});
  // fogged glass screen between the inner bath and the grotto
  const g=P('glass')[0],frame=kit.tex('hinoki');
  kit.add(box(.03,2.4,g.d,1),kit.tex('fogged-glass',{variant:'screen'}),{pos:[g.x,1.2,g.z]});
  for(let z=g.z-g.d/2;z<=g.z+g.d/2+.01;z+=g.d/3)kit.add(box(.07,2.45,.07,.6,{swap:true}),frame,{pos:[g.x,1.22,z]});
  kit.add(box(.08,.08,g.d+.07,.6),frame,{pos:[g.x,2.44,g.z]});
  void R;
}

function grotto(kit,R){
  const rockMat=kit.tex('bath-rock-wet'),flowers=kit.tex('yunohana');
  // rock bath: milky water ringed by boulders
  const b=P('rock-bath')[0],rx=b.w/2,rz=b.d/2,wy=.32;
  const pool=new THREE.CircleGeometry(1,48).rotateX(-Math.PI/2).scale(rx-.15,1,rz-.15);
  kit.add(pool,kit.tex('nigori-water',{variant:'pool',color:0xd2dcd8}),{pos:[b.x,wy,b.z],world:2});
  for(let i=0;i<34;i++){
    const a=i/34*Math.PI*2,s=.24+R()*.1;
    rock(kit,rockMat,[b.x+Math.cos(a)*(rx-.12),.12,b.z+Math.sin(a)*(rz-.12)],[s*1.35,s*1.05,s],i*3.1,R()*3);
  }
  // boulders against the grotto walls
  for(let i=0;i<5;i++){
    const t=i/4;
    rock(kit,rockMat,[33.8+t*4.2,.35,z1+.18],[.45+R()*.2,.6+R()*.4,.25],i+11,R());
    rock(kit,rockMat,[x2-.18,.35,z1+.6+t*4.4],[.25,.6+R()*.4,.45+R()*.2],i+23,R());
  }
  // hot water from a granite spout on the east wall, mineral crust where it lands
  const sz=b.z;
  kit.add(box(.5,.22,.36,.5),kit.tex('black-granite-polished'),{pos:[x2-.3,.95,sz]});
  kit.add(new THREE.PlaneGeometry(.12,.62).rotateY(Math.PI/2),kit.tex('nigori-water',{variant:'stream',side:THREE.DoubleSide}),{pos:[x2-.56,.62,sz]});
  for(let i=0;i<6;i++){
    const a=-.6+i*.24;
    rock(kit,flowers,[b.x+Math.cos(a)*(rx-.1),.26,sz+Math.sin(a)*(rz-.1)],[.26,.06,.2],i+40,R());
  }
  // iron-rich seep on the south wall staining the rocks below an old pipe
  kit.add(box(.08,.08,.3,.3),kit.tex('sulfur-iron'),{pos:[35.2,1.35,z1+.15]});
  kit.add(new THREE.PlaneGeometry(.9,1.3),kit.tex('iron-spring-deposit'),{pos:[35.2,.75,z1+.03]});
  rock(kit,kit.tex('iron-spring-deposit',{variant:'rock'}),[35.2,.15,z1+.55],[.45,.2,.35],51,0);
  // gravel garden in the corner: white pebbles, mossy stones, a stone lantern and a dwarf pine
  const gd=P('garden')[0],moss=kit.tex('moss-garden-stone');
  kit.add(box(gd.w,.06,gd.d,.6),kit.tex('white-tamajari'),{pos:[gd.x,.03,gd.z],world:.6});
  for(const [dx,dz,s] of [[-1.4,.2,.38],[-.6,-.3,.28],[.4,.3,.32]])rock(kit,moss,[gd.x+dx,.12,gd.z+dz],[s*1.4,s,s*1.1],dx*7,R());
  lantern(kit,gd.x+1.35,gd.z+.2,0);
  kit.beam([gd.x+.1,0,gd.z+.35],[gd.x-.1,.9,gd.z+.25],.05,kit.tex('red-pine-bark'),.4,6);
  for(const [dx,dy,s] of [[-.25,.95,.35],[.05,1.15,.3],[-.1,.8,.25]])
    kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.35,2.2,dy*9),.5),kit.tex('bonsai-foliage',{variant:'pine',side:THREE.DoubleSide}),{pos:[gd.x+dx,dy,gd.z+.25],scale:[s,s*.45,s*.8]});
}
