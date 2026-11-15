import {ACCESS,EXPANSION_ROOMS,WING_FLOORS,WING_HALL,wingWalls,within} from './expansion.js';

export const ORIGINAL_ROOMS = [
  {code:'01',name:'分析ラボ',view:'refit-lab',short:'ラボ',side:1,wall:2.75,edge:13.40,north:-14.70,south:-3.10,door:-5.55,terminal:[4.81,-7.13],
    data:[['分光器','待機中'],['測定ブース','2 基'],['室温','21.8 °C'],['換気','正常']]},
  {code:'02',name:'監視室',view:'refit-control',short:'監視',side:-1,wall:-2.75,edge:-10.10,north:-14.70,south:-3.80,door:-8.30,terminal:[-4.67,-7.76],
    data:[['施設回線','接続済み'],['監視チャンネル','8 系統'],['入退室記録','稼働中'],['照明回路','正常']]},
  {code:'03',name:'試料保管庫',view:'refit-archive',short:'保管',side:1,wall:2.75,edge:12.70,north:-30.70,south:-17.10,door:-20,terminal:[4.89,-21.59],
    data:[['保管庫温度','−78.4 °C'],['保管中の試料','24 点'],['冷却回路','正常'],['予備電源','接続済み']]},
  {code:'04',name:'機械室',view:'refit-plant',short:'機械',side:-1,wall:-2.75,edge:-10.70,north:-30.70,south:-17.20,door:-23.70,terminal:[-4.65,-24.78],
    data:[['換気ファン','2 基稼働中'],['冷却水圧','0.34 MPa'],['送風系統','正常'],['予備ポンプ','待機中']]},
  {code:'05',name:'岩盤観測室',view:'refit-geology',short:'岩盤',side:0,wall:0,edge:4.97,north:-41.67,south:-34.52,door:-34.52,terminal:[-2.51,-38.97],
    data:[['観測対象','地下岩盤'],['岩盤変位','0.2 mm'],['浸出水量','0.8 L/分'],['警報','平常']]}
];
export const HALL={code:'HALL',name:'連絡通路',view:'refit-hall',short:'通路'};
export const START={x:.12,z:.48,yaw:Math.PI-.038,pitch:-.026};
export const ROOMS=[...ORIGINAL_ROOMS,...EXPANSION_ROOMS];
export const VIEWPOINTS=[HALL,...ORIGINAL_ROOMS,WING_HALL,...EXPANSION_ROOMS];

const rect=(x1,z1,x2,z2)=>({x1,z1,x2,z2,disabled:false});
const centered=(x,z,w,d)=>rect(x-w/2,z-d/2,x+w/2,z+d/2);
const permanent=[];
const add=(x,z,w,d)=>permanent.push(centered(x,z,w,d));

for(const s of [-1,1]){
  const rooms=ORIGINAL_ROOMS.filter(r=>r.side===s).reverse();
  const solidSpans=[[-34.52,rooms[0].north],[rooms[0].south,rooms[1].north],[rooms[1].south,4.04]];
  for(const [a,b] of solidSpans)add(s*2.825,(a+b)/2,.28,b-a);
  for(const r of rooms){
    for(const [a,b] of [[r.north,r.door-.86],[r.door+.86,r.south]])add(r.wall,(a+b)/2,.30,b-a);
    add(r.edge,(r.north+r.south)/2,.31,r.south-r.north+.30);
    const left=Math.min(r.wall,r.edge),right=Math.max(r.wall,r.edge);
    for(const z of [r.north,r.south])add((left+right)/2,z,right-left+.30,.32);
  }
}
for(const s of [-1,1]){
  add(s*3.025,-34.52,4.33,.37);
  add(s*4.97,-39.1,.38,9.3);
}
add(0,-41.67,9.65,.30);
for(const [x,z,w,d] of [
  [-2.16,-2.94,.36,.78],[2.28,-14.93,.36,.78],[-2.26,-31.33,.36,.78],
  [-2.20,3.36,.30,.30],[2.20,3.36,.30,.30],
  [6.64,-10.6,2.65,1.18],[10.86,-10.74,2.65,1.18],[9.1,-4.84,2.65,1.18],
  [6.47,-9.48,.36,.36],[10.81,-9.55,.36,.36],[9.03,-3.98,.36,.36],
  [4.24,-13.56,.80,.74],[5.17,-13.56,.80,.74],[6.10,-13.56,.80,.74],
  [11.05,-13.72,3.34,.98],[12.18,-6.96,.92,.65],
  [-8.65,-13.53,.95,.91],[-7.68,-13.53,.95,.91],[-6.71,-13.53,.95,.91],
  [-7.94,-10.95,2.27,.94],[-5.44,-10.95,2.27,.94],[-7.94,-9.97,.36,.36],[-5.44,-9.97,.36,.36],
  [-8,-5.17,2.92,.82],[-9.35,-6.58,.71,.64],
  [10.12,-19.04,3.16,1.18],[12.01,-21.12,.92,.65],
  [-7.98,-26.56,2.35,1.38],[-7.98,-28.67,2.35,1.38],[-6.87,-18.10,1.72,.62],[-8.81,-18.10,1.72,.62],
  [-10.17,-22.10,.66,1.27],[-5.80,-28.92,.95,.91],[-4.62,-28.92,.95,.91],[-9.47,-21.56,1.12,1.77],
  [2.77,-37.61,2.75,1.01],
])add(x,z,w,d);
for(const x of [7.61,10.66])for(const z of [-27.14,-24.50])add(x,z,1.39,1.38);
for(const x of [4.78,6.31,7.84,9.37,10.90])add(x,-29.89,1.36,.92);
for(const r of ROOMS)add(...r.terminal,.59,.51);
for(const {axis,at,low,high} of wingWalls()){
  const middle=(low+high)/2,length=high-low;
  if(axis==='x')add(at,middle,.32,length+.025);
  else add(middle,at,length+.025,.32);
}
for(const room of EXPANSION_ROOMS)for(const prop of room.props)add(prop.x,prop.z,prop.w,prop.d);
add(-3.091,13.42,.16,.49);
add(3.091,29.01,.16,.49);

export function zoneAt(x,z) {
  if(z>=ACCESS.z)return EXPANSION_ROOMS.find(room=>within(room,x,z))??WING_HALL;
  return ORIGINAL_ROOMS.find(r=>r.side
    ? x*r.side>2.85 && z>r.north && z<r.south && x*r.side<r.edge*r.side
    : z<-34.77 && z>r.north && Math.abs(x)<r.edge)??HALL;
}
export function makeDoors(){
  function make(room,{axis,x,z,width},existing=false){
    return {
      kind:'door',room,axis,x,z,width,open:false,travel:0,
      leafOffset:existing ? .433 : width/4,leafTravel:existing ? .865 : width/2,
      blocker:axis==='x'?centered(x,z,.30,width):centered(x,z,width,.30),
    };
  }
  return [
    ...ORIGINAL_ROOMS.map(room=>make(room,{x:room.wall,z:room.door,axis:room.side?'x':'z',width:1.74},true)),
    make(ACCESS,ACCESS),
    ...EXPANSION_ROOMS.map(room=>make(room,room.entry)),
  ];
}
export function doorProgress(door){
  return door.travel**2*(3-2*door.travel);
}
export function isBlocked(x,z,doors) {
  if(z>4.10){
    if(!WING_FLOORS.some(bounds=>within(bounds,x,z)))return true;
  }else if(x < -10.77 || x > 13.53 || z < -42.22)return true;
  const r=.255;
  function overlaps(box) {
    if(box.disabled || x<box.x1-r || x>box.x2+r || z<box.z1-r || z>box.z2+r)return false;
    const dx=x-Math.max(box.x1,Math.min(box.x2,x));
    const dz=z-Math.max(box.z1,Math.min(box.z2,z));
    return dx*dx+dz*dz<r*r;
  }
  return permanent.some(overlaps)||doors.some(door=>overlaps(door.blocker));
}
export function inDoorway(door,x,z){
  const a=Math.abs(door.x-x),b=Math.abs(door.z-z);
  return door.axis==='x'?a<.67&&b<door.width/2+.25:b<.67&&a<door.width/2+.25;
}
export function advanceDoors(doors,dt,x,z) {
  for(const door of doors){
    if(!door.open&&door.travel>.2&&inDoorway(door,x,z))door.open=true;
    const target=Number(door.open);
    door.travel+=Math.sign(target-door.travel)*Math.min(Math.abs(target-door.travel),dt*1.5);
    door.blocker.disabled=doorProgress(door)>.86;
  }
}
const terminals=ROOMS.map(room=>({kind:'terminal',room,x:room.terminal[0],z:room.terminal[1]}));
export function nearbyTarget(player,doors) {
  const directionX=-Math.sin(player.yaw),directionZ=-Math.cos(player.yaw);
  const room=zoneAt(player.x,player.z);
  let next=null, score=Infinity;
  function consider(action,limit,minAlignment){
    const x=action.x-player.x,z=action.z-player.z,length=Math.hypot(x,z);
    if(length>limit)return;
    const alignment=(directionX*x+directionZ*z)/Math.max(.001,length);
    if(length>.63&&alignment<minAlignment)return;
    const distance=length+(1-alignment)*.38;
    if(distance<score){next=action;score=distance;}
  }
  for(const door of doors)consider(door,1.98,-.10);
  for(const terminal of terminals)if(room===terminal.room)consider(terminal,1.65,.05);
  return next;
}
