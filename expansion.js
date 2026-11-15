import {CAVERN_ROOMS,DOOR12} from './cavern-layout.js';

export const WING_HALL = { code:'WING', name:'増設棟 連絡通路', view:'equipped-wing', short:'増設棟' };
export const ACCESS = { code:'ACCESS', name:'増設棟', x:0, z:4.02, axis:'z', width:2.76, height:3.18 };
export const THROAT = { x1:-2.85, x2:2.85, z1:4.02, z2:8 };
export const WING_SPINE = { x1:-3.32, x2:3.32, z1:8, z2:62.55 };

const prop=(type,x,z,w,d)=>({type,x,z,w,d});
export const EXPANSION_ROOMS = [
  {
    code:'06', name:'生体研究室', view:'biology', short:'生体', side:1,
    x1:3.32, x2:20.82, z1:8.35, z2:24.0,
    entry:{x:3.32,z:15.85,axis:'x',width:2.36,height:2.83}, terminal:[5.36,18.31],
    data:[['培養ラック','6 基'],['培地温度','22.6 °C'],['陰圧区画','正常'],['試料記録','更新済み']],
    props:[
      prop('growth',8.3,11.5,3.1,1.22),prop('growth',12.6,11.5,3.1,1.22),prop('growth',16.9,11.5,3.1,1.22),
      prop('growth',8.3,21.3,3.1,1.22),prop('growth',12.6,21.3,3.1,1.22),prop('growth',16.9,21.3,3.1,1.22),
      prop('culture',13.85,16.6,4.9,1.63),prop('sterilizer',19.2,16.35,1.54,3.8),
    ],
  },
  {
    code:'07', name:'工作・資材ヤード', view:'fabrication', short:'工作', side:-1,
    x1:-20.85, x2:-3.32, z1:9.8, z2:27.05,
    entry:{x:-3.32,z:15.15,axis:'x',width:2.48,height:2.9}, terminal:[-5.34,17.73],
    data:[['工作台','2 基'],['ホイスト','待機中'],['交換部品','46 点'],['局所排気','作動中']],
    props:[
      prop('shelf',-17.8,12.15,4.22,1.18),prop('shelf',-11.85,12.15,4.22,1.18),
      prop('shelf',-17.8,24.5,4.22,1.18),prop('shelf',-11.85,24.5,4.22,1.18),
      prop('workbench',-14.95,16.72,5.5,1.42),prop('workbench',-14.95,20.11,5.5,1.42),
      prop('toolcase',-6.35,23.8,2.3,1.56),prop('stillage',-18.9,18.55,1.3,2.2),
    ],
  },
  {
    code:'08', name:'低温設備室', view:'cryogenics', short:'低温', side:1,
    x1:3.32, x2:22.3, z1:26.1, z2:44.6,
    entry:{x:3.32,z:32.90,axis:'x',width:2.52,height:2.9}, terminal:[5.55,36.12],
    data:[['冷却回路','4 系統'],['液体窒素','供給中'],['タンク内温度','−168.3 °C'],['断熱監視','正常']],
    props:[
      prop('cryo',8.7,29.3,3.18,2.38),prop('cryo',13.98,29.3,3.18,2.38),prop('cryo',19.15,29.3,3.18,2.38),
      prop('cryo',8.7,41.7,3.18,2.38),prop('cryo',13.98,41.7,3.18,2.38),prop('cryo',19.15,41.7,3.18,2.38),
      prop('compressor',18.25,35.62,4.26,2.36),prop('pump',11.17,36.71,2.6,1.50),
    ],
  },
  {
    code:'09', name:'水文・岩盤試験区画', view:'equipped-hydrology', short:'水文', side:-1,
    x1:-23.4, x2:-3.32, z1:29.20, z2:49.25,
    entry:{x:-3.32,z:37.5,axis:'x',width:2.50,height:2.95}, terminal:[-5.42,40.37],
    data:[['採水溝','循環中'],['流量','13.8 L/分'],['試験孔','8 本'],['水位','基準内']],
    props:[
      prop('rockbank',-20.1,39.23,5.35,18.16),prop('sample',-11.65,32.58,4.4,1.42),
      prop('sample',-11.65,45.4,4.4,1.42),prop('pump',-8.15,40.3,2.6,1.47),
      prop('filter',-8.3,46.95,2.83,1.53),
    ],
  },
  {
    code:'10', name:'通信・計算室', view:'compute', short:'通信', side:1,
    x1:3.32, x2:24, z1:46.80, z2:61.80,
    entry:{x:3.32,z:53.4,axis:'x',width:2.48,height:2.88}, terminal:[5.49,56.34],
    data:[['通信ノード','16 基'],['保守回線','オンライン'],['床下送風','作動中'],['予備電池','満充電']],
    props:[
      prop('server',9.4,50.02,1.52,3.37),prop('server',13.03,50.02,1.52,3.37),
      prop('server',16.66,50.02,1.52,3.37),prop('server',20.29,50.02,1.52,3.37),
      prop('server',9.4,58.25,1.52,3.37),prop('server',13.03,58.25,1.52,3.37),
      prop('server',16.66,58.25,1.52,3.37),prop('server',20.29,58.25,1.52,3.37),
      prop('console',21.53,54.18,3.52,1.46),prop('switchgear',6.5,48.1,2.02,1.42),
    ],
  },
  {
    code:'11', name:'中央試験ホール', view:'core', short:'中央', side:0,
    x1:-12.6, x2:12.6, z1:62.55, z2:81.25,
    entry:{x:0,z:62.55,axis:'z',width:3.16,height:3.38}, terminal:[3.24,65.24],
    data:[['真空試験槽','待機中'],['恒温ジャケット','平常'],['加振架台','停止中'],['点検','実施可能']],
    props:[
      prop('reactor',0,73.32,10.5,7.05),prop('compressor',-8.8,73.45,3.10,2.81),
      prop('compressor',8.8,73.45,3.10,2.81),prop('switchgear',-7.8,78.44,3.75,1.90),
      prop('switchgear',7.8,78.44,3.75,1.90),prop('console',-5.2,66.85,3.4,1.48),
    ],
  },
  ...CAVERN_ROOMS,
];

// Walkable areas of the wing. Rooms with `floors` (the cavern zones) supply their own shapes.
export const WING_FLOORS=[THROAT,WING_SPINE,...EXPANSION_ROOMS.flatMap(room=>room.floors??[room])];

export function within(bounds,x,z){
  if(bounds.contains)return bounds.contains(x,z);
  return x>=bounds.x1&&x<=bounds.x2&&z>=bounds.z1&&z<=bounds.z2;
}

export function wingWalls(){
  const segments=[];
  function run(axis,at,low,high,holes=[]){
    for(const hole of holes){
      const center=axis==='x'?hole.z:hole.x;
      segments.push({axis,at,low,high:center-hole.width/2});
      low=center+hole.width/2;
    }
    segments.push({axis,at,low,high});
  }
  for(const side of [-1,1]){
    run('x',side*2.85,THROAT.z1,THROAT.z2);
    run('z',THROAT.z2,Math.min(side*2.85,side*3.32),Math.max(side*2.85,side*3.32));
    const rooms=EXPANSION_ROOMS.filter(room=>room.side===side);
    run('x',side*3.32,WING_SPINE.z1,WING_SPINE.z2,rooms.map(room=>room.entry));
    for(const room of rooms){
      const outside=side===1?room.x2:room.x1;
      run('x',outside,room.z1,room.z2);
      run('z',room.z1,room.x1,room.x2);
      run('z',room.z2,room.x1,room.x2);
    }
  }
  run('z',ACCESS.z,THROAT.x1,THROAT.x2,[ACCESS]);
  const vault=EXPANSION_ROOMS.find(room=>room.code==='11');
  run('z',vault.z1,vault.x1,vault.x2,[vault.entry]);
  run('z',vault.z2,vault.x1,vault.x2,[DOOR12]);
  run('x',vault.x1,vault.z1,vault.z2);
  run('x',vault.x2,vault.z1,vault.z2);
  return segments;
}

export function distanceToBounds(bounds,x,z){
  return Math.hypot(Math.max(bounds.x1-x,x-bounds.x2,0),Math.max(bounds.z1-z,z-bounds.z2,0));
}
