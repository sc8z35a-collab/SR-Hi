import * as THREE from './vendor/three.module.js';
import {box,cyl,planarUV,roundUV,scaleUV,lumpy,rng,sign} from './kit.js';
import {Y,RIVER,HQ_ZONE,VILLAGE,PLATEAU,groundHeight as G} from './outdoor-layout.js';
import {CAVERN,CONTROL_ROOM,WASHITSU,YOSHITSU,MEETING,SUITES,SUITE_X,HUT} from './cavern-layout.js';

// Everyday objects that make the existing areas feel used: street furniture, village life,
// campsite gear, field-lab equipment and room details. Positions come from the layout props
// (which also provide the collision boxes).
const P=(room,type)=>room.props.filter(p=>p.type===type);
const turn=(x,y,z,angle)=>{
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,angle,0));
  return {q,at:(dx,dy,dz)=>new THREE.Vector3(dx,dy,dz).applyQuaternion(q).add(new THREE.Vector3(x,y,z)).toArray()};
};
const blob=(kit,id,pos,scale,seed,opts={})=>kit.add(planarUV(lumpy(new THREE.IcosahedronGeometry(1,2),.3,2.4,seed),opts.meters??.6),kit.tex(id,{variant:opts.variant??'blob',side:THREE.DoubleSide}),{pos,scale});

// ================= outdoors =================
export function buildOutdoorProps(kit,group){
  const R=rng(31);
  plaza(kit,group,R);
  village(kit,group,R);
  camp(kit,group,R);
}

function plaza(kit,group,R){
  const steel=kit.tex('brushed-stainless'),tire=kit.tex('tire-rubber'),frame=kit.tex('bike-frame');
  // bicycle rack with four bikes
  const b=P(HQ_ZONE,'bikes')[0];
  for(let i=0;i<4;i++){
    const z=b.z-1.7+i*1.15,{q,at}=turn(b.x,Y,z,0);
    kit.add(roundUV(new THREE.TorusGeometry(.38,.025,6,18,Math.PI),.5,.03),steel,{pos:at(-.15,0,0),quat:q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0)))});
    for(const dx of [-.55,.55])kit.add(roundUV(new THREE.TorusGeometry(.32,.035,6,20),.6,.04),tire,{pos:at(dx,.34,.08),quat:q});
    const p=(dx,dy)=>at(dx,dy,.08);
    for(const [a,c] of [[[-.55,.34],[0,.38]],[[0,.38],[.42,.8]],[[-.55,.34],[-.2,.82]],[[-.2,.82],[.42,.8]],[[0,.38],[-.2,.82]],[[.55,.34],[.42,.8]]])kit.beam(p(...a),p(...c),.022,frame,.5,6);
    kit.add(box(.22,.05,.1,.3),kit.tex('molded-plastic'),{pos:p(-.22,.88),quat:q});
    kit.beam(p(.42,.8),p(.42,1.0),.02,steel,.4,6);
    kit.add(box(.05,.03,.5,.3),kit.tex('molded-plastic'),{pos:p(.42,1.0),quat:q});
  }
  kit.add(box(.1,.06,4.6,.5),steel,{pos:[b.x-.15,Y+.03,b.z]});
  // sorting bins between benches
  for(const bn of P(HQ_ZONE,'bins'))for(const dx of [-.36,.36]){
    kit.add(cyl(.28,.9,.6,{seg:18}),kit.tex('bin-plastic'),{pos:[bn.x+dx,Y+.45,bn.z]});
    kit.add(cyl(.3,.06,.6,{seg:18}),kit.tex(dx<0?'bike-frame':'bin-plastic',{variant:'lid'}),{pos:[bn.x+dx,Y+.92,bn.z]});
  }
  // flower beds with granite kerbs
  for(const f of P(HQ_ZONE,'flowerbed')){
    kit.add(box(f.w,.32,f.d,1),kit.tex('curb-granite'),{pos:[f.x,Y+.16,f.z]});
    kit.add(box(f.w-.2,.04,f.d-.2,1),kit.tex('flower-bed'),{pos:[f.x,Y+.33,f.z]});
    for(let i=0;i<6;i++)blob(kit,'flower-bed',[f.x-f.w/2+.5+i*(f.w-1)/5,Y+.38,f.z+(R()-.5)*.2],[.28,.14,.25],i+f.x,{meters:1});
  }
  // cafe tables under parasols
  for(const c of P(HQ_ZONE,'cafe')){
    kit.add(cyl(.42,.04,.6,{seg:24}),kit.tex('cafe-table'),{pos:[c.x,Y+.74,c.z]});
    kit.beam([c.x,Y,c.z],[c.x,Y+.72,c.z],.04,steel,.4,8);
    kit.beam([c.x,Y,c.z],[c.x,Y+2.4,c.z],.025,steel,.4,6);
    kit.add(roundUV(new THREE.ConeGeometry(1.25,.5,12,1,true),1,1.2),kit.tex('parasol-canvas',{side:THREE.DoubleSide}),{pos:[c.x,Y+2.25,c.z]});
    for(let k=0;k<3;k++){
      const a=k*2.1+.3,x=c.x+Math.cos(a)*.75,z=c.z+Math.sin(a)*.75;
      kit.add(box(.42,.04,.42,.6),kit.tex('cafe-table'),{pos:[x,Y+.45,z],rot:[0,a,0]});
      kit.beam([x,Y,z],[x,Y+.43,z],.025,steel,.4,6);
      const {at,q}=turn(x,Y,z,-a+Math.PI/2);
      kit.add(box(.42,.4,.04,.6),kit.tex('cafe-table'),{pos:at(0,.67,-.2),quat:q});
    }
  }
  // campus map board
  const m=P(HQ_ZONE,'info-map')[0];
  for(const dx of [-.7,.7])kit.beam([m.x+dx,Y,m.z],[m.x+dx,Y+1.9,m.z],.04,steel,.5,8);
  kit.add(box(1.6,1.1,.06,1),kit.tex('white-composite'),{pos:[m.x,Y+1.3,m.z+.02]});
  kit.add(new THREE.PlaneGeometry(1.45,.95),kit.tex('info-map'),{pos:[m.x,Y+1.3,m.z-.015],rot:[0,Math.PI,0]});
  // EV chargers, hedge along the parking, bollards along the entrance walk
  for(const e of P(HQ_ZONE,'ev')){
    kit.add(box(.35,1.4,.3,1),kit.tex('white-composite'),{pos:[e.x,Y+.7,e.z]});
    kit.add(new THREE.PlaneGeometry(.35,1.0),kit.tex('ev-charger'),{pos:[e.x+.18,Y+.85,e.z],rot:[0,Math.PI/2,0]});
  }
  const h=P(HQ_ZONE,'hedge')[0];
  kit.add(planarUV(lumpy(new THREE.BoxGeometry(h.w,1.1,h.d,2,3,26),.06,2,7),1),kit.tex('hedge-privet'),{pos:[h.x,Y+.55,h.z]});
  for(let z=215;z<=232;z+=2.4)for(const x of [18.2,21.8]){
    kit.add(cyl(.09,.6,.4,{seg:10}),kit.tex('facade-concrete'),{pos:[x,Y+.3,z]});
    kit.add(cyl(.085,.16,.4,{seg:10}),kit.tex('led-bollard'),{pos:[x,Y+.68,z]});
  }
}

function village(kit,group,R){
  const wood=kit.tex('timber-beam');
  // water mill beside the river with a turning wheel
  const m=P(VILLAGE,'mill')[0],my=G(m.x,m.z);
  const x1=m.x-m.w/2+.2,x2=m.x+m.w/2-.2,z1=m.z-m.d/2+.2,z2=m.z+m.d/2-.2;
  kit.add(box(m.w,.5,m.d,1.5),kit.tex('ishigaki'),{pos:[m.x,my+.1,m.z]});
  for(const [px,pz,w,d] of [[m.x,z1,x2-x1,.15],[m.x,z2,x2-x1,.15],[x1,m.z,.15,z2-z1],[x2,m.z,.15,z2-z1]])
    kit.add(box(w,2.4,d),kit.tex('yakisugi'),{pos:[px,my+1.5,pz],world:1.2});
  const rz=RIVER.z(m.x)+RIVER.half-.3,ry=RIVER.water+1.4;
  kit.beam([m.x-1.2,ry,z1-.1],[m.x-1.2,ry,rz-.4],.12,wood,1,8);
  const wheel=new THREE.Group();wheel.name='Water wheel';wheel.position.set(m.x-1.2,ry,rz);wheel.rotation.y=Math.PI/2;
  const wmat=kit.tex('waterwheel-wood');
  for(const dz of [-.35,.35]){const rim=new THREE.Mesh(roundUV(new THREE.TorusGeometry(1.9,.08,6,32),1,.1),wmat);rim.position.z=dz;wheel.add(rim);}
  for(let k=0;k<12;k++){
    const a=k/12*Math.PI*2;
    const paddle=new THREE.Mesh(box(.08,.55,.8,1),wmat);paddle.position.set(Math.cos(a)*1.95,Math.sin(a)*1.95,0);paddle.rotation.z=a;wheel.add(paddle);
    if(k%2===0){const spoke=new THREE.Mesh(box(1.9,.07,.07,1),wmat);spoke.position.set(Math.cos(a)*.95,Math.sin(a)*.95,0);spoke.rotation.z=a;wheel.add(spoke);}
  }
  wheel.children[0].onBeforeRender=()=>{wheel.rotation.z=-performance.now()/1000*.35;};
  group.add(wheel);
  const roofY=my+2.7;
  kit.add(box(m.w+.8,.12,m.d*0.62,2,{swap:true}),kit.tex('thatched-roof'),{pos:[m.x,roofY+.55,m.z-.8],rot:[.45,0,0]});
  kit.add(box(m.w+.8,.12,m.d*0.62,2,{swap:true}),kit.tex('thatched-roof'),{pos:[m.x,roofY+.55,m.z+.8],rot:[-.45,0,0]});
  // storage jars, firewood, baskets and drying persimmons at the farmhouses
  const j=P(VILLAGE,'jars')[0],jy=G(j.x,j.z);
  for(const [dx,s] of [[-.6,1],[.1,.8],[.7,.9]]){
    const pts=[];for(let k=0;k<=10;k++){const t=k/10;pts.push(new THREE.Vector2(.05+.32*s*Math.sin(Math.PI*(.15+t*.7)),t*.8*s));}
    kit.add(roundUV(new THREE.LatheGeometry(pts,18),.6,.3),kit.tex('glazed-pottery'),{pos:[j.x+dx,jy,j.z]});
  }
  const fw=P(VILLAGE,'firewood')[0],fy=G(fw.x,fw.z);
  kit.add(box(fw.w-.2,1.4,.02,.8),kit.tex('firewood-ends'),{pos:[fw.x,fy+.7,fw.z-fw.d/2+.05]});
  kit.add(box(fw.w-.2,1.4,fw.d-.1,.8),kit.tex('log-pile-bark',{variant:'stack'}),{pos:[fw.x,fy+.7,fw.z+.02]});
  kit.add(box(fw.w+.3,.06,fw.d+.5,1,{swap:true}),kit.tex('kokera-shingle'),{pos:[fw.x,fy+1.6,fw.z],rot:[.2,0,0]});
  for(const hs of P(VILLAGE,'house')){
    const hy=G(hs.x,hs.z),fx=hs.x-hs.w/2-.1;
    for(let k=0;k<4;k++)kit.add(box(.04,.9,.3,.8),kit.tex('persimmon-string',{side:THREE.DoubleSide}),{pos:[fx-.75,hy+2.35,hs.z-2.6+k*.35]});
    kit.beam([fx-.75,hy+2.82,hs.z-2.9],[fx-.75,hy+2.82,hs.z-1.4],.03,wood,1,6);
    for(const [dz,s] of [[1.9,1],[2.5,.8]])kit.add(roundUV(new THREE.CylinderGeometry(.24*s,.17*s,.22*s,14,1,true),.4,.2),kit.tex('woven-basket',{side:THREE.DoubleSide}),{pos:[fx-.35,hy+.72,hs.z+dz]});
  }
  // scarecrow at the paddy edge
  const sc=P(VILLAGE,'scarecrow')[0],sy=G(sc.x,sc.z);
  kit.beam([sc.x,sy,sc.z],[sc.x,sy+1.9,sc.z],.04,wood,1,6);
  kit.beam([sc.x,sy+1.45,sc.z-.65],[sc.x,sy+1.45,sc.z+.65],.035,wood,1,6);
  kit.add(box(.22,.7,1.0,.6),kit.tex('patched-cloth'),{pos:[sc.x,sy+1.25,sc.z]});
  kit.add(planarUV(new THREE.SphereGeometry(.17,12,8),.4),kit.tex('straw-hay',{variant:'head'}),{pos:[sc.x,sy+1.78,sc.z]});
  kit.add(roundUV(new THREE.ConeGeometry(.36,.22,14),.4,.36),kit.tex('straw-hay',{variant:'hat'}),{pos:[sc.x,sy+1.98,sc.z]});
  // rowboat pulled up on the bank and a net drying on poles
  const bt=P(VILLAGE,'boat')[0],by=G(bt.x,bt.z);
  const hull=new THREE.Group();
  const paint=kit.tex('rowboat-paint',{side:THREE.DoubleSide});
  for(const s of [-1,1])kit.add(box(3.4,.45,.05,1),paint,{pos:[bt.x,by+.32,bt.z+s*.55],rot:[s*.25,0,0]});
  kit.add(box(3.2,.05,1.0,1),paint,{pos:[bt.x,by+.1,bt.z]});
  kit.add(box(.06,.45,1.15,1),paint,{pos:[bt.x-1.68,by+.32,bt.z]});
  for(const dx of [-.6,.5])kit.add(box(.22,.05,1.05,1),kit.tex('pier-planks'),{pos:[bt.x+dx,by+.42,bt.z]});
  kit.beam([bt.x-.2,by+.45,bt.z-.3],[bt.x+1.5,by+.2,bt.z-1.3],.03,wood,1,6);
  void hull;
  const n=P(VILLAGE,'net')[0],ny=G(n.x,n.z);
  for(const dx of [-1.5,1.5])kit.beam([n.x+dx,ny,n.z],[n.x+dx,ny+2.0,n.z],.05,wood,1,6);
  kit.beam([n.x-1.6,ny+1.95,n.z],[n.x+1.6,ny+1.95,n.z],.03,wood,1,6);
  const net=new THREE.PlaneGeometry(3.0,1.7,12,6),np=net.attributes.position;
  for(let i=0;i<np.count;i++)np.setZ(i,Math.sin(np.getX(i)*1.4)*.08+(1-(np.getY(i)+.85)/1.7)*.05);
  net.computeVertexNormals();
  kit.add(net,kit.tex('fishing-net',{variant:'mesh',alpha:.35,side:THREE.DoubleSide}),{pos:[n.x,ny+1.05,n.z]});
}

function camp(kit,group,R){
  const alu=kit.tex('brushed-stainless'),wood=kit.tex('timber-beam');
  for(const c of P(PLATEAU,'camp-chair')){
    const y=G(c.x,c.z),fire=P(PLATEAU,'campfire')[0],a=Math.atan2(fire.x-c.x,fire.z-c.z);
    const {at,q}=turn(c.x,y,c.z,a);
    kit.add(box(.48,.05,.42,.5),kit.tex('camp-chair'),{pos:at(0,.4,0),quat:q});
    kit.add(box(.48,.5,.04,.5),kit.tex('camp-chair'),{pos:at(0,.68,-.24),quat:q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.15,0,0)))});
    for(const dx of [-.22,.22])for(const dz of [-.18,.18])kit.beam(at(dx,0,dz),at(dx*.9,.4,-dz*.6),.012,alu,.3,5);
  }
  const co=P(PLATEAU,'cooler')[0],cy=G(co.x,co.z);
  kit.add(box(.65,.42,.42,.6),kit.tex('cooler-box'),{pos:[co.x,cy+.21,co.z],rot:[0,.3,0]});
  kit.add(box(.67,.06,.44,.6),kit.tex('cooler-box',{variant:'lid'}),{pos:[co.x,cy+.45,co.z],rot:[0,.3,0]});
  const tl=P(PLATEAU,'telescope')[0],ty=G(tl.x,tl.z);
  for(let k=0;k<3;k++){const a=k*2.1;kit.beam([tl.x+Math.cos(a)*.35,ty,tl.z+Math.sin(a)*.35],[tl.x,ty+1.25,tl.z],.018,alu,.3,5);}
  kit.add(cyl(.09,1.05,.4,{seg:16}),kit.tex('telescope-white'),{pos:[tl.x-.2,ty+1.45,tl.z+.25],rot:[.9,-.6,0,'YXZ']});
  for(const s of P(PLATEAU,'trail-sign')){
    const y=G(s.x,s.z);
    kit.beam([s.x,y,s.z],[s.x,y+1.6,s.z],.06,wood,1,8);
    kit.add(new THREE.PlaneGeometry(.75,.75),kit.tex('trail-sign',{side:THREE.DoubleSide}),{pos:[s.x,y+1.3,s.z-.07],rot:[0,Math.PI+.4,0]});
  }
  const lg=P(PLATEAU,'logs')[0],ly=G(lg.x,lg.z);
  for(let row=0;row<3;row++)for(let k=0;k<4-row;k++)kit.add(cyl(.16,1.8,1,{seg:10}),kit.tex('log-pile-bark'),{pos:[lg.x,ly+.16+row*.29,lg.z-.48+k*.33+row*.16],rot:[0,0,Math.PI/2]});
  for(const s of [-.92,.92])kit.add(new THREE.CircleGeometry(.16,10),kit.tex('firewood-ends'),{pos:[lg.x+s,ly+.32,lg.z],rot:[0,s>0?Math.PI/2:-Math.PI/2,0]});
  // weather station: louvred screen and an anemometer mast
  const w=P(PLATEAU,'weather')[0],wy=G(w.x,w.z),louvre=kit.tex('stevenson-louvre');
  for(const dx of [-.3,.3])for(const dz of [-.25,.25])kit.beam([w.x-.6+dx,wy,w.z+dz],[w.x-.6+dx,wy+1.1,w.z+dz],.03,louvre,.6,6);
  kit.add(box(.8,.7,.65,.6),louvre,{pos:[w.x-.6,wy+1.45,w.z]});
  kit.add(box(.9,.06,.75,.6),kit.tex('white-composite'),{pos:[w.x-.6,wy+1.83,w.z]});
  kit.beam([w.x+.8,wy,w.z],[w.x+.8,wy+4.5,w.z],.04,alu,.5,8);
  for(let k=0;k<3;k++){const a=k*2.1;kit.beam([w.x+.8,wy+4.5,w.z],[w.x+.8+Math.cos(a)*.35,wy+4.5,w.z+Math.sin(a)*.35],.012,alu,.3,5);kit.add(planarUV(new THREE.SphereGeometry(.07,8,6,0,Math.PI*2,0,Math.PI/2),.3),kit.tex('telescope-white'),{pos:[w.x+.8+Math.cos(a)*.35,wy+4.5,w.z+Math.sin(a)*.35],rot:[0,0,Math.PI/2]});}
  // utility vehicle and cable reels by the substation
  const u=P(PLATEAU,'utility-car')[0],uy=G(u.x,u.z),olive=kit.tex('utility-olive'),tire=kit.tex('tire-rubber');
  kit.add(box(3.2,.6,1.5,1),olive,{pos:[u.x,uy+.65,u.z]});
  kit.add(box(1.2,.9,1.45,1),olive,{pos:[u.x+.85,uy+1.4,u.z]});
  kit.add(box(.04,.55,1.25,1),kit.tex('car-glass'),{pos:[u.x+1.46,uy+1.5,u.z]});
  for(const dx of [-1.1,1.1])for(const dz of [-.72,.72])kit.add(roundUV(new THREE.CylinderGeometry(.3,.3,.22,14),.6,.3),tire,{pos:[u.x+dx,uy+.3,u.z+dz],rot:[Math.PI/2,0,0]});
  for(let k=0;k<3;k++)kit.add(box(.5,.4,.6,.5),kit.tex('toolbox-red'),{pos:[u.x-.9+k*.55,uy+1.15,u.z],rot:[0,(R()-.5)*.3,0]});
  const r=P(PLATEAU,'reels')[0],rry=G(r.x,r.z);
  for(const dx of [-.6,.6]){
    for(const dz of [-.28,.28])kit.add(new THREE.CircleGeometry(.6,24),kit.tex('cable-reel',{side:THREE.DoubleSide}),{pos:[r.x+dx,rry+.6,r.z+dz]});
    kit.add(cyl(.42,.54,1,{seg:20}),kit.tex('cable-bundle'),{pos:[r.x+dx,rry+.6,r.z],rot:[Math.PI/2,0,0]});
  }
  // danger signs on the substation fence
  const s=P(PLATEAU,'substation')[0],sy=G(s.x,s.z);
  for(const [x,z,a] of [[s.x-4,s.z-s.d/2-.06,Math.PI],[s.x+4,s.z-s.d/2-.06,Math.PI],[s.x-s.w/2-.06,s.z,-Math.PI/2],[s.x+s.w/2+.06,s.z,Math.PI/2]])
    kit.add(new THREE.PlaneGeometry(.45,.45),kit.tex('danger-sign'),{pos:[x,sy+1.5,z],rot:[0,a,0]});
}

// ================= underground and rooms =================
export function buildUndergroundProps(kit,group){
  const R=rng(41);
  caveLab(kit,R);
  rooms(kit,group,R);
}

function caveLab(kit,R){
  const steel=kit.plain('steel-dark');
  const tb=P(CAVERN,'toolboxes')[0];
  for(const [dx,s] of [[-.32,1],[.32,.85]]){kit.add(box(.55*s,.3*s,.28,.5),kit.tex('toolbox-red'),{pos:[tb.x+dx,.15*s,tb.z],rot:[0,(R()-.5)*.4,0]});}
  kit.add(box(.5,.24,.26,.5),kit.tex('toolbox-red'),{pos:[tb.x-.3,.42,tb.z]});
  const dr=P(CAVERN,'drums-yellow')[0];
  for(const [dx,dz] of [[-.45,-.2],[.35,-.25],[0,.3]]){
    kit.add(cyl(.29,.88,1,{seg:20}),kit.tex('drum-yellow'),{pos:[dr.x+dx,.44,dr.z+dz]});
    kit.add(cyl(.3,.03,1,{seg:20}),steel,{pos:[dr.x+dx,.895,dr.z+dz]});
  }
  kit.add(box(1.5,.12,1.0,1),kit.tex('pallet-wood'),{pos:[dr.x,.02,dr.z]});
  const bt=P(CAVERN,'battery')[0];
  kit.add(box(.8,1.6,1.5,1),kit.tex('rack-powder'),{pos:[bt.x,.8,bt.z]});
  kit.add(box(.02,1.4,1.35,1),kit.tex('battery-cells'),{pos:[bt.x-.41,.8,bt.z]});
  kit.beam([bt.x,1.6,bt.z-.5],[5.0,1.2,bt.z-.4],.04,kit.tex('cable-bundle'),.6,6);
  const pr=P(CAVERN,'parts-rack')[0];
  kit.add(box(1.7,1.8,.45,1),kit.tex('rack-powder'),{pos:[pr.x,.9,pr.z+.05]});
  kit.add(box(1.6,1.6,.02,1),kit.tex('parts-bins'),{pos:[pr.x,.95,pr.z-.19]});
  // field lab bench: glassware shelf, microscope and core boxes
  const lb=P(CAVERN,'lab-bench')[0];
  kit.add(box(2.4,.05,.8,1),kit.tex('desk-laminate'),{pos:[lb.x,.9,lb.z]});
  for(const dx of [-1.1,1.1])for(const dz of [-.33,.33])kit.add(box(.05,.88,.05,1),steel,{pos:[lb.x+dx,.44,lb.z+dz]});
  kit.add(box(2.3,.9,.3,1),kit.tex('rack-powder'),{pos:[lb.x,1.4,lb.z+.28]});
  kit.add(new THREE.PlaneGeometry(1.1,.75),kit.tex('lab-glassware'),{pos:[lb.x-.55,1.42,lb.z+.12],rot:[0,Math.PI,0]});
  kit.add(new THREE.PlaneGeometry(1.0,.7),kit.tex('core-samples'),{pos:[lb.x+.6,.935,lb.z-.05],rot:[-Math.PI/2,0,0]});
  microscope(kit,lb.x-.6,.925,lb.z-.12,Math.PI);
  kit.add(box(2.6,.06,1.3,1.2),kit.tex('green-roof'),{pos:[lb.x,2.45,lb.z],rot:[.08,0,0]});
  for(const dx of [-1.2,1.2])for(const dz of [-.55,.55])kit.beam([lb.x+dx,0,lb.z+dz],[lb.x+dx,2.42,lb.z+dz],.03,kit.tex('galvanized-spangle'),.6,6);
  // the long header pipe gets foil insulation; a breaker panel on the hut
  kit.add(cyl(.13,17,1,{seg:14}),kit.tex('pipe-insulation'),{pos:[-4.35,2.9,108.6],rot:[0,0,Math.PI/2]});
  kit.add(box(.12,.9,.6,1),kit.tex('rack-powder'),{pos:[HUT.x1-.06,1.6,103.6]});
  kit.add(new THREE.PlaneGeometry(.55,.8),kit.tex('breaker-panel'),{pos:[HUT.x1-.125,1.6,103.6],rot:[0,-Math.PI/2,0]});
  // room 13: core samples and a microscope on the side table
  const u=HUT.upper,t=P(CONTROL_ROOM,'table')[0];
  kit.add(new THREE.PlaneGeometry(.5,.35),kit.tex('core-samples'),{pos:[t.x+.2,u+.765,t.z+.1],rot:[-Math.PI/2,0,0]});
  microscope(kit,t.x-.3,u+.76,t.z+.05,Math.PI);
}
function microscope(kit,x,y,z,angle){
  const m=kit.tex('microscope-enamel'),{at,q}=turn(x,y,z,angle);
  kit.add(box(.18,.04,.24,.3),m,{pos:at(0,.02,0),quat:q});
  kit.add(box(.05,.26,.06,.3),m,{pos:at(0,.15,-.08),quat:q});
  kit.add(box(.12,.02,.12,.3),m,{pos:at(0,.12,.02),quat:q});
  kit.add(cyl(.025,.16,.3,{seg:10}),m,{pos:at(0,.29,0),quat:q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.5,0,0)))});
}

function rooms(kit,group,R){
  // 和室: tea bowls, paulownia chest, bonsai on the shelf, ikebana in the alcove
  const ch=P(WASHITSU,'chabudai')[0];
  for(const a of [.4,2.0,3.6]){
    const pts=[];for(let k=0;k<=6;k++){const t=k/6;pts.push(new THREE.Vector2(.02+.06*Math.sin(t*Math.PI*.5),t*.07));}
    kit.add(roundUV(new THREE.LatheGeometry(pts,14),.3,.06),kit.tex('raku-ceramic',{side:THREE.DoubleSide}),{pos:[ch.x+Math.cos(a)*.3,.35,ch.z+Math.sin(a)*.3]});
  }
  const ts=P(WASHITSU,'tansu')[0],kiri=kit.tex('paulownia');
  kit.add(box(.5,1.2,1.4,1),kiri,{pos:[ts.x,.6,ts.z]});
  for(let k=0;k<4;k++)kit.add(box(.02,.26,1.3,1),kiri,{pos:[ts.x+.26,.17+k*.29,ts.z]});
  const tok=P(WASHITSU,'tokonoma')[0];
  blob(kit,'ikebana-flowers',[tok.x+1.0,.68,tok.z+.1],[.24,.2,.2],3,{meters:.5});
  const sh=P(WASHITSU,'shelves')[0];
  kit.add(box(.3,.06,.2,.3),kit.tex('glazed-pottery'),{pos:[sh.x+.4,1.27,sh.z]});
  blob(kit,'bonsai-foliage',[sh.x+.4,1.4,sh.z],[.24,.1,.16],5,{meters:.4});
  kit.beam([sh.x+.4,1.28,sh.z],[sh.x+.33,1.38,sh.z+.02],.02,kit.tex('tree-bark'),.3,5);
  // 洋室: upright piano, globe, mantel clock, oil painting above the fireplace
  const pn=P(YOSHITSU,'piano')[0],lacquer=kit.tex('urushi-lacquer');
  kit.add(box(1.4,1.2,.55,1),lacquer,{pos:[pn.x,.6,pn.z-.02]});
  kit.add(box(1.4,.06,.32,1),lacquer,{pos:[pn.x,.78,pn.z+.4]});
  kit.add(scaleUV(new THREE.PlaneGeometry(1.3,.16),1,1),kit.tex('piano-keys'),{pos:[pn.x,.75,pn.z+.36],rot:[-Math.PI/2,0,Math.PI]});
  kit.add(box(.4,.45,.35,.6),kit.tex('upholstery'),{pos:[pn.x,.22,pn.z+.85]});
  const gl=P(YOSHITSU,'globe')[0];
  kit.add(cyl(.18,.03,.4,{seg:16}),kit.tex('brass-antique'),{pos:[gl.x,.015,gl.z]});
  kit.beam([gl.x,0,gl.z],[gl.x,.75,gl.z],.02,kit.tex('brass-antique'),.4,6);
  kit.add(new THREE.SphereGeometry(.26,24,16),kit.tex('antique-globe'),{pos:[gl.x,.98,gl.z],rot:[.4,0,.2]});
  kit.add(roundUV(new THREE.TorusGeometry(.29,.012,6,32),.4,.01),kit.tex('brass-antique'),{pos:[gl.x,.98,gl.z],rot:[0,.6,0]});
  const fp=P(YOSHITSU,'fireplace')[0],wall=SUITES['17'].z2;
  kit.add(box(1.2,.9,.04,1),kit.tex('walnut-veneer'),{pos:[fp.x,1.85,wall-.03]});
  kit.add(new THREE.PlaneGeometry(1.05,.75),kit.tex('oil-painting'),{pos:[fp.x,1.85,wall-.055],rot:[0,Math.PI,0]});
  kit.add(box(.3,.36,.14,.4),kit.tex('walnut-veneer'),{pos:[fp.x+.8,1.51,wall-.25]});
  kit.add(new THREE.CircleGeometry(.11,24),kit.tex('clock-face'),{pos:[fp.x+.8,1.55,wall-.325],rot:[0,Math.PI,0]});
  // 会議室: laptops on the table, wall clock
  const t=P(MEETING,'table')[0];
  for(const [dx,dz,a] of [[-.45,-.9,Math.PI/2],[.45,.2,-Math.PI/2],[-.45,1.0,Math.PI/2],[.45,-1.4,-Math.PI/2]]){
    const {at,q}=turn(t.x+dx,.765,t.z+dz,a);
    kit.add(box(.34,.015,.24,.3),kit.tex('brushed-stainless'),{pos:at(0,.008,0),quat:q});
    kit.add(box(.34,.22,.01,.3),kit.tex('brushed-stainless'),{pos:at(0,.115,-.13),quat:q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.25,0,0)))});
    kit.add(new THREE.PlaneGeometry(.31,.19),kit.tex('laptop-screen'),{pos:at(0,.118,-.122),quat:q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.25,0,0)))});
  }
  kit.add(new THREE.CircleGeometry(.2,28),kit.tex('clock-face'),{pos:[SUITE_X.x1+.03,2.2,104.0],rot:[0,Math.PI/2,0]});
  void group;void R;
}
