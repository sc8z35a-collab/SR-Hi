import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,kiosk,sign} from './kit.js';
import {CANTEEN,CANTEEN_ROOM,ONSEN} from './cavern-layout.js';
import {wall} from './quarters.js';

// 25 社員食堂: a staff canteen east of the bathhouse (24), entered from its rest area. The dining
// room has four long tables, a tea dispenser and a menu board; behind the serving counter is the
// kitchen with a gas range under a hood, worktops, a prep island, a sink, a fridge and a cold
// room. Built from the canteen-* sheets.
const P=type=>CANTEEN_ROOM.props.filter(p=>p.type===type);
const {x1,x2,z1,z2,height:H,partition:PZ,entry:EZ,kitchenDoor:KX}=CANTEEN;
const flat=(w,d)=>new THREE.PlaneGeometry(w,d).rotateX(-Math.PI/2);
/** A band of texture that spans its height exactly once (wainscot): v runs 0..1 from y1 to y2. */
function band(kit,material,{axis,at,from,to,y1=0,y2,gaps=[],meters=1}){
  const piece=(a,b)=>{
    if(b-a<.01)return;
    const len=b-a,h=y2-y1,g=axis==='x'?new THREE.BoxGeometry(.02,h,len):new THREE.BoxGeometry(len,h,.02);
    g.translate(0,h/2,0);
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){
      const along=axis==='x'?p.getZ(i):p.getX(i),side=Math.abs(axis==='x'?n.getX(i):n.getZ(i))>.5;
      uv.setXY(i,(along+(a+b)/2)/meters,side?p.getY(i)/h:0);
    }
    kit.add(g,material,{pos:axis==='x'?[at,y1,(a+b)/2]:[(a+b)/2,y1,at]});
  };
  let a=from;
  for(const gap of [...gaps].sort((p,q)=>p.center-q.center)){piece(a,gap.center-gap.width/2);a=gap.center+gap.width/2;}
  piece(a,to);
}
/** A bowl turned on a lathe: outer wall from the foot to the rim, then the inside back down. */
function bowlGeometry(r,h,foot=.35){
  const outer=[],inner=[];
  for(let k=0;k<=8;k++){const t=k/8;outer.push(new THREE.Vector2(r*(foot+(1-foot)*Math.sin(t*Math.PI/2)),h*t));}
  for(let k=8;k>=0;k--){const t=k/8;inner.push(new THREE.Vector2(r*.92*(foot*.6+(1-foot*.6)*Math.sin(t*Math.PI/2)),h*.12+h*.86*t));}
  const g=new THREE.LatheGeometry([...outer,...inner],12);
  g.userData.split=outer.length;
  g.userData.rows=outer.length+inner.length;
  return g;
}

export function buildCanteen(kit,group){
  shell(kit,group);
  dining(kit);
  kitchen(kit);
  kiosk(kit,group,CANTEEN_ROOM,[CANTEEN_ROOM.terminal[0],0,CANTEEN_ROOM.terminal[1]],Math.PI/2);
}

function shell(kit,group){
  const plaster=kit.tex('cream-plaster'),oak=kit.tex('oak-wainscot'),subway=kit.tex('subway-tile-white');
  // structural walls (the bathhouse's east wall closes x1, with the doorway)
  wall(kit,plaster,{axis:'x',at:x2+.1,from:z1-.2,to:z2+.2,y2:H+.2,world:1.5});
  wall(kit,plaster,{axis:'z',at:z1-.1,from:x1-.1,to:x2+.2,y2:H+.2,world:1.5});
  wall(kit,plaster,{axis:'z',at:z2+.1,from:x1-.1,to:x2+.2,y2:H+.2,world:1.5});
  // serving counter wall: a pass-through above the counter and the kitchen doorway
  wall(kit,plaster,{axis:'z',at:PZ,from:x1,to:x2,y2:H,thick:.15,gaps:[{center:43.5,width:7.0,top:2.1,sill:1.0},{center:KX,width:1.2,top:2.1}],world:1.5});
  kit.add(box(7.3,.06,.62,1),kit.tex('worn-counter-wood'),{pos:[43.5,1.03,PZ],world:1});
  kit.add(box(7.3,.05,.5,1),kit.tex('stainless-worktop'),{pos:[43.5,.95,PZ-.5]});
  // floors and ceiling
  kit.add(box(x2-x1,.1,z2-PZ),kit.tex('canteen-sheet-floor'),{pos:[(x1+x2)/2,-.05,(PZ+z2)/2],world:1.2});
  kit.add(box(x2-x1,.1,PZ-z1),kit.tex('quarry-tile-red'),{pos:[(x1+x2)/2,-.05,(z1+PZ)/2],world:.8});
  kit.add(box(x2-x1,.05,z2-z1),kit.tex('acoustic-ceiling-tile'),{pos:[(x1+x2)/2,H+.025,(z1+z2)/2],world:.6});
  // dining room: oak wainscot below cream plaster
  band(kit,oak,{axis:'x',at:x1+.01,from:PZ,to:z2,y2:1.0,gaps:[{center:EZ,width:1.2}]});
  band(kit,oak,{axis:'x',at:x2-.01,from:PZ,to:z2,y2:1.0});
  band(kit,oak,{axis:'z',at:z2-.01,from:x1,to:x2,y2:1.0});
  band(kit,oak,{axis:'z',at:PZ+.085,from:x1,to:x2,y2:1.0,gaps:[{center:KX,width:1.2}]});
  wall(kit,plaster,{axis:'x',at:x1+.01,from:PZ,to:z2,y1:1.0,y2:H,thick:.02,gaps:[{center:EZ,width:1.2,top:2.1}],world:1.5});
  // kitchen: white subway tiles to 1.8 m, stainless behind the range
  for(const [axis,at,from,to] of [['x',x1+.01,z1,PZ],['x',x2-.01,z1,PZ],['z',z1+.01,x1,x2]])
    wall(kit,subway,{axis,at,from,to,y2:1.8,thick:.02,world:.6});
  wall(kit,subway,{axis:'z',at:PZ-.085,from:x1,to:x2,y2:1.0,thick:.02,gaps:[{center:KX,width:1.2,top:1.0}],world:.6});
  kit.add(box(2.9,1.4,.02,1.2),kit.tex('stainless-wall-panel'),{pos:[42.2,1.6,z1+.03]});
  // the entrance from the bathhouse: navy asanoha noren and a sign on the rest-area side
  kit.add(new THREE.PlaneGeometry(1.3,.9).rotateY(-Math.PI/2),kit.tex('asanoha-noren',{side:THREE.DoubleSide}),{pos:[ONSEN.x2-.04,1.68,EZ]});
  sign(group,[['25  社員食堂',60],['CANTEEN',30]],[ONSEN.x2-.03,2.45,EZ],-Math.PI/2,[1.1,.3],{width:440,height:120,border:false,bg:'#20282a'});
  // menu board without writing, framed in oak
  kit.add(box(2.1,1.1,.03,1),kit.tex('oak-wainscot',{variant:'frame'}),{pos:[44.8,1.85,z2-.03]});
  kit.add(new THREE.PlaneGeometry(1.95,.95).rotateY(Math.PI),kit.tex('menu-chalkboard'),{pos:[44.8,1.85,z2-.05]});
  // ceiling lamps
  const lamp=kit.plain('lamp-neutral');
  for(const [x,z] of [[42.5,80.8],[47.0,80.8],[42.5,73.2],[48.0,73.2]])kit.add(box(1.2,.04,.4),lamp,{pos:[x,H-.02,z]});
}

function dining(kit){
  const chrome=kit.tex('chrome-tube'),vinyl=kit.tex('burgundy-vinyl'),melamine=kit.tex('melamine-woodgrain');
  const tray=kit.tex('brown-tray'),porcelain=kit.tex('white-porcelain'),lacquer=kit.tex('lacquer-bowl');
  // rice bowl and soup bowl: porcelain and lacquer on a lathe; the soup bowl maps the photo's
  // black outside and red inside onto its two walls
  const riceBowl=bowlGeometry(.065,.06);
  const soupBowl=bowlGeometry(.06,.065,.4),uv=soupBowl.attributes.uv,split=soupBowl.userData.split,rows=soupBowl.userData.rows;
  for(let i=0;i<uv.count;i++){
    const row=i%rows,u=.32+uv.getX(i)*.36;
    uv.setXY(i,u,row<split?.08+row/(split-1)*.34:.52+(1-(row-split)/(rows-split-1))*.32);
  }
  const plate=new THREE.CylinderGeometry(.09,.07,.018,18);
  const settings=[[42.5,79.4,-1,-.8],[42.5,79.4,1,.0],[47.0,79.4,-1,.8],[42.5,82.2,1,-.8],[47.0,82.2,-1,0],[47.0,82.2,1,.8]];
  for(const t of P('table')){
    const gingham=t.x===47&&t.z===82.2;
    kit.add(box(2.4,.04,.8,1),melamine,{pos:[t.x,.72,t.z]});
    if(gingham)kit.add(new THREE.BoxGeometry(2.5,.005,.9),kit.tex('gingham-cloth'),{pos:[t.x,.743,t.z]});
    for(const dx of [-1.05,1.05])for(const dz of [-.3,.3])kit.beam([t.x+dx,0,t.z+dz],[t.x+dx,.7,t.z+dz],.022,chrome,.4,8);
    // three chairs a side: vinyl seat and back on a chrome frame
    for(const side of [-1,1])for(const dx of [-.8,0,.8]){
      const cx=t.x+dx,cz=t.z+side*.65;
      kit.add(box(.42,.06,.42,.5),vinyl,{pos:[cx,.46,cz]});
      kit.add(box(.42,.36,.05,.5),vinyl,{pos:[cx,.75,cz+side*.2]});
      for(const ex of [-.18,.18]){
        kit.beam([cx+ex,0,cz-side*.18],[cx+ex,.44,cz-side*.18],.012,chrome,.4,6);
        kit.beam([cx+ex,0,cz+side*.18],[cx+ex,.95,cz+side*.21],.012,chrome,.4,6);
      }
    }
    // bamboo chopstick holder in the middle of the table
    kit.add(new THREE.CylinderGeometry(.045,.045,.14,14),kit.tex('bamboo-chopstick-holder'),{pos:[t.x,.81,t.z]});
    for(let k=0;k<6;k++){const a=k*1.05;kit.beam([t.x+Math.cos(a)*.02,.8,t.z+Math.sin(a)*.02],[t.x+Math.cos(a)*.03,.97,t.z+Math.sin(a)*.03],.004,kit.tex('kiri-locker'),.2,4);}
  }
  // set meals on trays: rice, miso soup, tonkatsu, takuan and nori
  for(const [tx,tz,side,dx] of settings){
    const x=tx+dx,z=tz+side*.22,y=.742;
    kit.add(box(.42,.02,.3,.5),tray,{pos:[x,y+.01,z]});
    kit.add(riceBowl,porcelain,{pos:[x-.12,y+.02,z+side*.06]});
    kit.add(flat(.1,.1),kit.tex('steamed-rice'),{pos:[x-.12,y+.075,z+side*.06]});
    kit.add(soupBowl,lacquer,{pos:[x+.01,y+.02,z+side*.07]});
    kit.add(new THREE.CircleGeometry(.05,16).rotateX(-Math.PI/2),kit.tex('miso-paste'),{pos:[x+.01,y+.075,z+side*.07]});
    kit.add(plate,porcelain,{pos:[x+.12,y+.03,z-side*.03]});
    kit.add(box(.12,.025,.07,.2),kit.tex('panko-crust'),{pos:[x+.12,y+.05,z-side*.03],rot:[0,.3,0]});
    kit.add(flat(.07,.07),kit.tex('takuan-slices'),{pos:[x-.12,y+.022,z-side*.08]});
    kit.add(box(.06,.004,.08,.1),kit.tex('nori-sheet'),{pos:[x+.03,y+.024,z-side*.09]});
  }
  // tea dispenser on a stainless cabinet by the entrance, with stacked cups
  const t=P('tea')[0],steel=kit.tex('stainless-wall-panel');
  kit.add(box(.6,.85,.7,1),steel,{pos:[t.x,.425,t.z]});
  kit.add(box(.45,.7,.5,.5),steel,{pos:[t.x-.05,1.2,t.z]});
  kit.add(new THREE.PlaneGeometry(.48,.68).rotateY(Math.PI/2),kit.tex('tea-dispenser'),{pos:[t.x+.181,1.2,t.z]});
  for(let k=0;k<4;k++)kit.add(new THREE.CylinderGeometry(.035,.028,.07,12),porcelain,{pos:[t.x+.12,.885+k*.045,t.z+.25]});
}

function kitchen(kit){
  const worktop=kit.tex('stainless-worktop'),steel=kit.tex('stainless-wall-panel');
  // gas range with four burner grates under the hood: a wok, a stock pot and a copper pot
  const r=P('range')[0];
  kit.add(box(r.w,.85,.8,1),steel,{pos:[r.x,.425,r.z]});
  kit.add(box(r.w,.04,.8,1),worktop,{pos:[r.x,.87,r.z]});
  const burners=[-.95,-.32,.32,.95].map(dx=>r.x+dx);
  for(const x of burners)kit.add(flat(.5,.5),kit.tex('burner-grate'),{pos:[x,.895,r.z]});
  const wok=new THREE.SphereGeometry(.3,24,8,0,Math.PI*2,Math.PI*.62,Math.PI*.38);
  const wuv=wok.attributes.uv,wp=wok.attributes.position;
  for(let i=0;i<wp.count;i++)wuv.setXY(i,.5+wp.getX(i)/.6,.5-wp.getZ(i)/.6);
  kit.add(wok,kit.tex('wok-iron',{side:THREE.DoubleSide}),{pos:[burners[0],1.2,r.z]});
  kit.add(roundUV(new THREE.CylinderGeometry(.24,.24,.42,24),.9,.24),kit.tex('aluminum-stockpot'),{pos:[burners[1],1.12,r.z]});
  kit.add(roundUV(new THREE.CylinderGeometry(.16,.15,.14,20),.5,.16),kit.tex('copper-pot'),{pos:[burners[2],.98,r.z]});
  kit.beam([burners[2]+.16,1.02,r.z],[burners[2]+.42,1.04,r.z],.012,steel,.3,6);
  // hood: stainless box, perforated front, baffle filters underneath
  kit.add(box(r.w+.2,.5,1.05,1),steel,{pos:[r.x,2.55,z1+.53]});
  kit.add(box(r.w+.2,.48,.01,.4),kit.tex('perforated-stainless'),{pos:[r.x,2.55,z1+1.06]});
  for(const dx of [-.9,-.3,.3,.9])kit.add(new THREE.PlaneGeometry(.55,.55).rotateX(Math.PI/2).rotateX(-.5),kit.tex('grease-filter'),{pos:[r.x+dx,2.28,z1+.6]});
  // worktops along the back wall with cutting boards, a rice tub, miso, nori and breaded cutlets
  const w=P('worktop')[0];
  kit.add(box(w.w,.86,.7,1),steel,{pos:[w.x,.43,w.z]});
  kit.add(box(w.w,.04,.72,1),worktop,{pos:[w.x,.88,w.z]});
  for(const dx of [-1.6,-.4])kit.add(box(.5,.02,.34,.5),kit.tex('white-cutting-board'),{pos:[w.x+dx,.91,w.z]});
  const sawara=kit.tex('sawara-board');
  kit.add(roundUV(new THREE.CylinderGeometry(.24,.22,.2,20),.6,.24),sawara,{pos:[w.x+.7,1.0,w.z]});
  kit.add(new THREE.CircleGeometry(.22,20).rotateX(-Math.PI/2),kit.tex('steamed-rice'),{pos:[w.x+.7,1.09,w.z]});
  kit.add(roundUV(new THREE.CylinderGeometry(.16,.15,.2,18),.5,.16),sawara,{pos:[w.x+1.3,1.0,w.z]});
  kit.add(new THREE.CircleGeometry(.14,18).rotateX(-Math.PI/2),kit.tex('miso-paste'),{pos:[w.x+1.3,1.08,w.z]});
  for(let k=0;k<4;k++)kit.add(box(.2,.004,.2,.2),kit.tex('nori-sheet'),{pos:[w.x+1.85,.904+k*.005,w.z+.1]});
  kit.add(box(.5,.03,.34,.5),kit.tex('stainless-worktop',{variant:'tray'}),{pos:[w.x-1.0,.915,w.z-.05]});
  for(let k=0;k<4;k++)kit.add(box(.16,.03,.1,.2),kit.tex('panko-crust'),{pos:[w.x-1.15+(k%2)*.22,.94,w.z-.12+Math.floor(k/2)*.14]});
  // copper pots hanging over the prep island
  const is=P('island')[0];
  kit.add(box(is.w,.86,is.d,1),steel,{pos:[is.x,.43,is.z]});
  kit.add(box(is.w,.04,is.d+.02,1),worktop,{pos:[is.x,.88,is.z]});
  kit.beam([is.x-1.5,2.1,is.z],[is.x+1.5,2.1,is.z],.02,steel,.4,8);
  for(const dx of [-1.5,1.5])kit.beam([is.x+dx,2.1,is.z],[is.x+dx,H,is.z],.015,steel,.4,6);
  for(const [dx,rad] of [[-1.0,.13],[-.4,.16],[.3,.11],[.9,.14]]){
    kit.add(roundUV(new THREE.CylinderGeometry(rad,rad*.95,rad*.8,18),.5,rad),kit.tex('copper-pot'),{pos:[is.x+dx,1.75,is.z]});
    kit.beam([is.x+dx,1.75+rad*.4,is.z],[is.x+dx,2.1,is.z],.006,steel,.3,4);
  }
  kit.add(box(.5,.02,.34,.5),kit.tex('white-cutting-board'),{pos:[is.x-.6,.91,is.z]});
  // sink on the west wall
  const s=P('sink')[0];
  kit.add(box(s.w,.86,s.d,1),steel,{pos:[s.x,.43,s.z]});
  kit.add(box(s.w,.04,s.d,1),worktop,{pos:[s.x,.88,s.z]});
  kit.add(box(.5,.02,.8,.5),kit.plain('sink-well',{color:0x6d7377,roughness:.25,metalness:.9}),{pos:[s.x,.89,s.z-.5]});
  kit.beam([x1+.08,.9,s.z-.5],[x1+.08,1.25,s.z-.5],.02,steel,.3,6);
  kit.beam([x1+.08,1.25,s.z-.5],[x1+.3,1.2,s.z-.5],.015,steel,.3,6);
  // upright refrigerator and the cold room's strip curtain on the east wall
  const f=P('fridge')[0],white=kit.tex('fridge-white-paint');
  kit.add(box(f.w,1.9,.75,1),white,{pos:[f.x,.95,f.z]});
  for(const dx of [-.3,.3])kit.add(box(.03,.6,.03,.2),steel,{pos:[f.x+dx,1.25,f.z+.39]});
  kit.add(box(.03,1.85,.02,.3),kit.tex('fridge-white-paint',{variant:'seam',color:0xb8bcbe}),{pos:[f.x,.95,f.z+.376]});
  kit.add(box(.06,2.2,1.5,1),steel,{pos:[x2-.03,1.1,72.3]});
  kit.add(new THREE.PlaneGeometry(1.25,2.0).rotateY(-Math.PI/2),kit.tex('vinyl-strip-curtain'),{pos:[x2-.07,1.0,72.3]});
  // rice sacks on a low pallet, and floor drains
  const rs=P('rice-sacks')[0],kraft=kit.tex('kraft-rice-bag');
  kit.add(box(.8,.12,.9,1),kit.tex('pallet-wood'),{pos:[rs.x,.06,rs.z]});
  for(let k=0;k<3;k++)kit.add(box(.7,.2,.42,.6),kraft,{pos:[rs.x,.22+k*.2,rs.z+(k%2?.2:-.2)],rot:[0,(k-1)*.08,0]});
  for(let k=0;k<5;k++)kit.add(flat(.48,.48),kit.tex('cast-drain-grate'),{pos:[40.6+k*.5,.006,75.6]});
}
