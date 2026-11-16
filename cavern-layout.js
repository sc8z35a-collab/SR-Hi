// Layout of the zones beyond the central test hall (room 11):
//   12 地底空洞ステーション  – a natural cavern reached through a tunnel
//   13 観測棟2階 管制室      – the upper floor of the hut inside the cavern (second level)
//   14 地底湖               – a lake chamber with a research pier
// Shared by the collision/zone code (expansion.js, layout.js) and the 3D builder (cavern.js).

export const CAVE = {cx:0, cz:102, rx:18, rz:16, ry:14};
export const LAKE = {cx:0, cz:131, rx:14, rz:12, ry:10};
// Tunnel cross-section: vertical walls up to `wall`, arched crown at `crown`.
export const TUNNEL = {half:2.0, wall:2.6, crown:3.45, z1:81.7, z2:86.9};
export const PASSAGE = {half:2.0, wall:2.6, crown:3.45, z1:117.2, z2:120.1};
export const DOOR12 = {x:0, z:81.25, axis:'z', width:2.9, height:3.0};
// The part of room 11's back wall that is hidden to open the doorway.
export const CUT = {min:[-1.56, 0.015, 80.9], max:[1.56, 3.06, 81.75]};

// Two-storey observation hut. The upper floor is room 13 and is reached by the outside stair.
export const HUT = {x1:4.5, x2:11.5, z1:103, z2:107.6, upper:3.4, ceiling:6.1, eave:6.3, ridge:7.4};
export const STAIR = {x1:5.2, x2:11.9, z1:101.6, z2:103.05, top:9.5};
export const DOOR13 = {x:10.3, z:103.1, axis:'z', width:1.1, height:2.2, y:HUT.upper};

export const SHORE = 127.8;

// Living quarters east of the cavern, reached by a rock tunnel along +x:
//   15 居住区画 (hall), 16 和室, 17 洋室, 18 会議室.
export const EAST_TUNNEL = {half:1.4, wall:2.4, crown:3.0, x1:15.4, x2:22.0, z:96};
export const HALL15 = {x1:22.1, x2:25.9, z1:84.1, z2:107.9, height:3.2};
export const SUITE_X = {x1:26.1, x2:31.6};
export const SUITES = {
  '16':{z1:84.1, z2:91.9, door:88, height:2.7},
  '17':{z1:92.1, z2:99.9, door:96, height:3.0},
  '18':{z1:100.1, z2:107.9, door:104, height:2.9},
};
export const PIER = {x1:-0.9, x2:0.9, z1:126.6, z2:134.2, head:{x1:-2.2, x2:2.2, z1:134.2, z2:137.4}, deck:0.12};

// Inclined shaft from the quarters' hall up to the surface yard (zone 19).
import {INCLINE, YARD, inclineFloor, groundHeight, onBridge, bridgeHeight, outdoorWalkable, OUTDOOR_ROOMS, OUTDOOR_FIXTURES} from './outdoor-layout.js';
export {INCLINE, YARD, inclineFloor};

const inRect = (r, x, z, inset = 0) => x >= r.x1 + inset && x <= r.x2 - inset && z >= r.z1 + inset && z <= r.z2 - inset;
const inEllipse = (e, x, z, margin) => ((x - e.cx) / (e.rx - margin)) ** 2 + ((z - e.cz) / (e.rz - margin)) ** 2 <= 1;
const rect = (x1, z1, x2, z2) => ({x1, z1, x2, z2, contains: (x, z) => x >= x1 && x <= x2 && z >= z1 && z <= z2});

/** Height of the walking surface at (x, z); 0 everywhere except the stair, the hut's upper floor and the pier. */
export function floorHeight(x, z) {
  if (z < 81) return 0;
  if (z >= INCLINE.z1 && z <= INCLINE.z2 + .6 && Math.abs(x - INCLINE.x) <= INCLINE.half) return inclineFloor(z);
  if (z > INCLINE.z2) return onBridge(x, z) ? bridgeHeight(x, z) : groundHeight(x, z);
  if (inRect(STAIR, x, z)) return Math.min(1, Math.max(0, (x - STAIR.x1) / (STAIR.top - STAIR.x1))) * HUT.upper;
  if (inRect(HUT, x, z)) return HUT.upper;
  if (z > SHORE - 0.8 && (inRect(PIER, x, z) || inRect(PIER.head, x, z))) return PIER.deck;
  return 0;
}

const prop = (type, x, z, w, d) => ({type, x, z, w, d});

export const CAVERN = {
  code:'12', name:'地底空洞ステーション', view:'cavern', short:'空洞', side:0,
  x1:-18.5, x2:18.5, z1:81.25, z2:118.5,
  entry:DOOR12, terminal:[2.9, 90.4],
  data:[['空洞容積','約 4,100 m³'],['観測棟','稼働中'],['発光鉱物','3 群落'],['ボーリング深度','312 m']],
  floors:[
    rect(-1.72, 81.25, 1.72, 89.2),
    {contains:(x, z) => inEllipse(CAVE, x, z, 2.3)},
    rect(-1.72, 115.0, 1.72, 121.8),
    {contains:(x, z) => inRect(STAIR, x, z)},
  ],
  props:[
    // hut walls (collide from both sides; the upper floor is only reachable by the stair)
    prop('wall', 4.6, 105.3, .2, 4.6), prop('wall', 11.4, 105.3, .2, 4.6), prop('wall', 8.0, 107.5, 7.0, .2),
    prop('wall', 7.125, 103.1, 5.25, .2), prop('wall', 11.175, 103.1, .65, .2),
    // stair rails
    prop('rail', 8.55, 101.55, 6.7, .1), prop('rail', 11.95, 102.3, .1, 1.5), prop('rail', 11.7, 103.05, .4, .1),
    // equipment
    prop('generator', 4.6, 92.6, 2.6, 1.5),
    prop('rig', -7.5, 97.5, 4.2, 4.2), prop('conveyor', -10.2, 94.6, 1.0, 1.0), prop('conveyor', -11.6, 93.2, 1.0, 1.0),
    prop('heap', -13.3, 91.4, 3.4, 3.4),
    prop('cart', -1.1, 94.8, 1.2, 1.8), prop('buffer', -1.1, 98.3, 1.4, .4),
    prop('tank', -12.0, 106.5, 2.4, 2.4), prop('tank', -8.6, 110.6, 2.4, 2.4), prop('tank', -13.0, 102.3, 2.4, 2.4),
    prop('crates', -5.5, 112.0, 2.4, 1.3), prop('tarp', -2.2, 112.6, 2.6, 1.7),
    prop('mast', -4.4, 90.6, .4, .4), prop('mast', 3.8, 98.5, .4, .4), prop('mast', -2.6, 106.2, .4, .4), prop('mast', 2.6, 112.4, .4, .4),
    prop('pipe-post', -8, 108.6, .3, .3), prop('pipe-post', -4, 108.6, .3, .3), prop('pipe-post', 0, 108.6, .3, .3), prop('pipe-post', 3, 108.6, .3, .3),
    prop('toolboxes', -4.9, 99.7, 1.2, .6), prop('drums-yellow', -9.6, 104.2, 1.6, 1.0), prop('battery', 6.9, 93.2, .9, 1.6),
    prop('parts-rack', -8.4, 112.7, 1.8, .6), prop('lab-bench', 1.2, 103.6, 2.6, .9),
    prop('crystal', -14.6, 100.5, 2.2, 2.2), prop('painting', -15.1, 95.6, 1.0, 2.6), prop('crystal', 6.6, 89.6, 1.6, 1.6), prop('crystal', 12.3, 111.4, 2.0, 2.0),
    prop('stalagmite', -15.2, 95.5, 1.2, 1.2), prop('stalagmite', 8.0, 114.6, 1.0, 1.0),
    prop('stalagmite', -9.5, 114.2, 1.0, 1.0), prop('stalagmite', 15.0, 104.0, 1.2, 1.2), prop('stalagmite', -14.8, 108.0, 1.2, 1.2),
    // details (details.js): ventilation fan and duct post, gas cylinders, scaffold, tool board, hard-hat shelf
    prop('vent-fan', -2.6, 92.0, 1.0, .8), prop('duct-post', -4.9, 94.3, .3, .3), prop('gas-rack', 7.6, 95.6, 1.4, .6),
    prop('scaffold', 13.0, 98.0, 2.0, 1.2), prop('pegboard', -4.9, 100.45, 1.6, .2), prop('hardhats', -3.0, 89.9, 1.2, .4),
  ],
};

export const CONTROL_ROOM = {
  code:'13', name:'観測棟2階 管制室', view:'control-2f', short:'管制', side:0, nested:true,
  x1:HUT.x1, x2:HUT.x2, z1:HUT.z1, z2:HUT.z2,
  entry:DOOR13, terminal:[8.2, 104.5], terminalY:HUT.upper,
  data:[['階層','地上2階'],['地震計','3 成分記録中'],['岩盤ひずみ','0.04 µε/日'],['空洞監視カメラ','6 台']],
  floors:[rect(HUT.x1, HUT.z1, HUT.x2, HUT.z2)],
  props:[
    prop('desk', 5.2, 105.3, .95, 3.0), prop('racks', 10.93, 105.65, .7, 2.8),
    prop('lockers', 9.0, 103.45, 1.2, .5), prop('table', 8.0, 106.75, .9, .6),
  ],
};

export const LAKE_ROOM = {
  code:'14', name:'地底湖', view:'lake', short:'地底湖', side:0,
  x1:-14.5, x2:14.5, z1:118.5, z2:143.5,
  entry:{x:0, z:118.5, axis:'z', width:3.4, height:3.4, door:false}, terminal:[-1.9, 124.8],
  data:[['水温','11.2 °C'],['水深','最大 18 m'],['湖面変動','±0 mm'],['桟橋','係留中 1 艇']],
  floors:[
    {contains:(x, z) => z < SHORE && inEllipse(LAKE, x, z, 2.3)},
    rect(-0.65, 126.0, 0.65, 134.4),
    rect(-1.95, 134.2, 1.95, 137.15),
  ],
  props:[
    prop('pump', 6.6, 124.4, 2.2, 1.6), prop('fence', 6.8, 126.6, 4.4, .1),
    prop('drum', 8.8, 123.6, .7, .7), prop('drum', 9.5, 124.6, .7, .7), prop('drum', 8.6, 125.3, .7, .7),
    prop('sandbags', -6.5, 127.2, 6.0, .6), prop('log', -8.2, 123.4, 3.3, .6),
    prop('boulder', -11.0, 125.2, 2.6, 2.4), prop('boulder', 10.9, 122.6, 2.2, 2.0), prop('boulder', -4.6, 122.0, 1.5, 1.4),
    prop('salt', 3.6, 122.4, 1.8, 1.6), prop('ore', -2.6, 123.4, 1.2, 1.2),
  ],
};

const suiteDoor = code => ({x:26, z:SUITES[code].door, axis:'x', width:1.2, height:2.1});
const suiteFloors = code => [
  rect(SUITE_X.x1+.25, SUITES[code].z1+.25, SUITE_X.x2-.25, SUITES[code].z2-.25),
  rect(25.6, SUITES[code].door-.35, 26.4, SUITES[code].door+.35),
];

export const LIVING = {
  code:'15', name:'居住区画', view:'quarters', short:'居住', side:0,
  x1:18.5, x2:26, z1:84, z2:108,
  entry:{x:EAST_TUNNEL.x2, z:EAST_TUNNEL.z, axis:'x', width:2.4, height:2.5, door:false}, terminal:[22.75, 93.6],
  data:[['居室','3 室'],['換気','24 時間運転'],['給湯','使用可能'],['在室者','0 名']],
  floors:[
    rect(13.8, EAST_TUNNEL.z-1.15, 22.4, EAST_TUNNEL.z+1.15),
    rect(HALL15.x1+.25, HALL15.z1+.25, HALL15.x2-.25, HALL15.z2-.25),
  ],
  props:[prop('shoe-cabinet', 25.6, 85.9, .55, 1.7), prop('bench', 22.4, 102.0, .5, 1.9), prop('plant', 22.55, 98.4, .6, .6), prop('vending', 22.5, 89.6, .8, 1.05)],
};
export const WASHITSU = {
  code:'16', name:'和室', view:'washitsu', short:'和室', side:0,
  x1:26, x2:31.8, z1:84, z2:92,
  entry:suiteDoor('16'), terminal:[26.75, 85.0],
  data:[['畳','16 枚'],['床の間','掛軸 1 幅'],['室温','22.0 °C'],['湿度','52 %']],
  floors:suiteFloors('16'),
  props:[prop('tansu', 26.42, 89.8, .55, 1.5), prop('tokonoma', 30.1, 91.4, 3.0, 1.0), prop('shelves', 27.35, 91.4, 2.5, 1.0), prop('chabudai', 28.8, 87.8, 1.15, 1.15), prop('andon', 31.1, 84.6, .45, .45),
    prop('byobu', 28.8, 84.5, 2.9, .45), prop('futon', 26.55, 86.4, .65, .9)],
};
export const YOSHITSU = {
  code:'17', name:'洋室', view:'yoshitsu', short:'洋室', side:0,
  x1:26, x2:31.8, z1:92, z2:100,
  entry:suiteDoor('17'), terminal:[26.75, 93.0],
  data:[['暖炉','点火中'],['蔵書','312 冊'],['室温','23.4 °C'],['照明','シャンデリア']],
  floors:suiteFloors('17'),
  props:[prop('fireplace', 29.0, 99.55, 2.3, .75), prop('sofa', 29.0, 97.0, 2.5, 1.0), prop('armchair', 27.2, 98.3, .95, .95),
    prop('armchair', 30.85, 98.3, .95, .95), prop('coffee-table', 29.0, 98.45, 1.0, .55), prop('bookshelf', 31.35, 94.2, .45, 1.9), prop('floor-lamp', 26.6, 99.3, .4, .4),
    prop('piano', 30.85, 92.5, 1.4, .65), prop('globe', 31.1, 96.1, .6, .6), prop('wine-rack', 26.3, 97.6, .4, 1.0)],
};
export const MEETING = {
  code:'18', name:'会議室', view:'meeting', short:'会議', side:0,
  x1:26, x2:31.8, z1:100, z2:108,
  entry:suiteDoor('18'), terminal:[26.75, 101.0],
  data:[['定員','8 名'],['投影装置','待機中'],['予約','本日 2 件'],['回線','接続済み']],
  floors:suiteFloors('18'),
  props:[prop('table', 29.0, 104.0, 1.6, 4.4), prop('plant', 31.15, 107.45, .7, .7),
    ...[102.4, 103.5, 104.6, 105.7].flatMap(z => [prop('chair', 27.75, z, .5, .5), prop('chair', 30.25, z, .5, .5)])],
};

// 24 大浴場: a hot-spring bathhouse south of the living corridor, entered through its south wall
export const ONSEN = {x1:24.4, x2:38.4, z1:70.0, z2:84.0, height:3.0, partition:78.3, door:27.2, entry:25.0};
export const ONSEN_ROOM = {
  code:'24', name:'大浴場', view:'onsen', short:'大浴場', side:0,
  x1:ONSEN.x1, x2:ONSEN.x2, z1:ONSEN.z1, z2:ONSEN.z2,
  entry:{x:ONSEN.entry, z:ONSEN.z2, axis:'z', width:1.2, height:2.1, door:false}, terminal:[31.5, 79.35],
  data:[['源泉温度','42.6 °C'],['泉質','硫黄泉'],['湯の入れ替え','毎朝 6:00'],['利用者','0 名']],
  floors:[
    rect(ONSEN.x1+.25, ONSEN.z1+.25, ONSEN.x2-.25, ONSEN.partition-.15),
    rect(ONSEN.x1+.25, ONSEN.partition+.15, ONSEN.x2-.25, ONSEN.z2-.25),
    rect(ONSEN.door-.6, ONSEN.partition-.4, ONSEN.door+.6, ONSEN.partition+.4),
    rect(ONSEN.entry-.6, ONSEN.z2-.5, ONSEN.entry+.6, ONSEN.z2+.45),
  ],
  props:[
    prop('wall', 25.5, ONSEN.partition, 2.2, .2), prop('wall', 33.1, ONSEN.partition, 10.6, .2),
    // bath: wash stations, hinoki bath, cold bath, glass screen, rock bath, gravel garden
    prop('wash', 24.95, 74.0, 1.1, 6.2), prop('inner-bath', 29.8, 72.8, 4.4, 3.6), prop('cold-bath', 31.5, 77.3, 1.8, 1.35),
    prop('glass', 33.3, 72.4, .1, 4.8), prop('rock-bath', 35.9, 72.9, 4.4, 4.6), prop('garden', 36.3, 77.35, 4.0, 1.5),
    // dressing room and rest area
    prop('lockers', 24.63, 80.95, .5, 3.9), prop('basket-shelf', 29.4, 78.75, 2.8, .55), prop('washstand', 28.7, 83.72, 4.2, .6),
    prop('massage-chair', 32.0, 83.3, .8, 1.0), prop('milk-vending', 33.4, 83.6, 1.0, .75), prop('bench', 33.5, 78.8, 3.0, .45),
    prop('tatami-platform', 36.4, 82.1, 3.6, 3.6),
  ],
};

export const SURFACE = {
  code:'19', name:'地上 坑口ヤード', view:'surface', short:'地上', side:0,
  x1:-62, x2:60, z1:108.1, z2:196,
  entry:{x:INCLINE.x, z:INCLINE.z2, axis:'z', width:3.2, height:3.1, door:false}, terminal:[26.6, 162.4], terminalY:YARD.y,
  // the shaft keeps a tunnel-like ambient light; the open yard is bright
  fill:(x, z) => z < INCLINE.z2 - .5 && Math.abs(x - INCLINE.x) < 4 ? [.74, .72, .68] : [1.25, 1.24, 1.18],
  data:[['標高','地上 +38 m'],['天候','晴れ時々くもり'],['気温','14.2 °C'],['風速','2.1 m/s']],
  floors:[
    rect(INCLINE.x-.95, 107.4, INCLINE.x+.95, 108.6),
    rect(INCLINE.x-1.35, 108.4, INCLINE.x+1.35, 160.6),
    rect(YARD.x1+.4, YARD.z1+.1, YARD.x2-.4, YARD.z2-.4),
    {contains:outdoorWalkable},
  ],
  props:[
    prop('gabions', 14.5, 160.85, 11, .9), prop('gabions', 33.5, 160.85, 11, .9),
    prop('office', 14, 183, 8.2, 6.2), prop('pond', 13, 177.75, 4.3, 2.8), prop('postbox', 17.4, 178.4, .5, .5),
    prop('lantern', 10.6, 177.6, .55, .55), prop('lantern', 15.4, 176.5, .55, .55),
    prop('warehouse', 35, 171, 8.2, 10.2), prop('forklift', 28.4, 168.8, 1.3, 2.4), prop('pallets', 28.9, 173.6, 1.5, 1.3),
    prop('barrels', 28.8, 176.6, 1.8, 1.1), prop('tires', 38.4, 178.4, 1.3, 1.3), prop('hoist-house', 34, 179.8, 5.2, 3.2),
    prop('headframe', 34, 186.2, 4.6, 4.6), prop('locomotive', 19.5, 170, 1.7, 3.6), prop('guardhouse', 17.5, 191.5, 3.2, 3.2),
    prop('pole', 20.4, 186, .4, .4), prop('pole', 27.6, 178, .4, .4), prop('cones', 30.4, 192.8, 2.6, .5),
    prop('fence', YARD.x1-.1, 177.2, .3, 34.4), prop('fence', YARD.x2+.1, 177.2, .3, 34.4),
    prop('wall', 14.55, YARD.z2+.2, 13.3, .45), prop('wall', 33.45, YARD.z2+.2, 13.3, .45),
    prop('torii-post', 36.9, 188.9, .35, .35), prop('torii-post', 38.7, 188.9, .35, .35),
    prop('lantern', 36.4, 190.3, .55, .55), prop('lantern', 39.2, 190.3, .55, .55),
    prop('hokora', 37.8, 192.6, 1.7, 1.5), prop('ema', 39.45, 191.4, .3, 1.3),
    prop('tree', 10.2, 165.4, .7, .7), prop('tree', 10.4, 173.0, .7, .7), prop('tree', 38.6, 182.4, .7, .7),
    // details (details.js): stacked containers, cement, wrapped pallet, portable toilet, ore heap, barriers
    prop('containers', 35.5, 163.3, 6.1, 2.44), prop('cement', 29.0, 171.3, 1.2, 1.0), prop('wrapped-pallet', 26.6, 176.6, 1.1, 1.1),
    prop('toilet', 10.2, 190.0, 1.2, 1.2), prop('ore-heap', 28.6, 187.4, 3.0, 2.4), prop('barriers', 28.0, 190.5, .5, 2.4),
  ],
};

export const CAVERN_ROOMS = [CAVERN, CONTROL_ROOM, LAKE_ROOM, LIVING, WASHITSU, YOSHITSU, MEETING, ONSEN_ROOM, SURFACE, ...OUTDOOR_ROOMS];

// Light sources for the shared lighting texture and the dynamic point-light pool.
export const CAVERN_FIXTURES = [
  ...OUTDOOR_FIXTURES,
  {x:0, y:3.15, z:83.6, color:0xffd9a0, intensity:28, range:8},
  {x:0, y:3.15, z:86.4, color:0xffd9a0, intensity:24, range:8},
  {x:-4.4, y:5.9, z:90.6, color:0xfff1d6, intensity:60, range:16},
  {x:3.8, y:5.9, z:98.5, color:0xfff1d6, intensity:60, range:16},
  {x:-2.6, y:5.9, z:106.2, color:0xfff1d6, intensity:55, range:16},
  {x:2.6, y:5.9, z:112.4, color:0xfff1d6, intensity:50, range:14},
  {x:4.25, y:2.9, z:105.35, color:0xffcf8a, intensity:20, range:7},
  {x:-13.6, y:1.4, z:100.5, color:0x5fe6ff, intensity:18, range:9},
  {x:11.6, y:1.4, z:111.0, color:0x5fe6ff, intensity:16, range:8},
  {x:6.3, y:1.2, z:90.0, color:0x5fe6ff, intensity:12, range:6},
  {x:6.3, y:5.95, z:105.3, color:0xf2f6ff, intensity:22, range:7},
  {x:9.7, y:5.95, z:105.3, color:0xf2f6ff, intensity:22, range:7},
  {x:0, y:3.15, z:118.6, color:0xffd9a0, intensity:24, range:8},
  {x:-0.95, y:2.75, z:130.0, color:0xffe2b0, intensity:26, range:10},
  {x:0.95, y:2.75, z:134.0, color:0xffe2b0, intensity:24, range:10},
  {x:6.5, y:3.3, z:123.9, color:0xfff1d6, intensity:30, range:11},
  {x:-12.2, y:1.5, z:129.4, color:0xb070ff, intensity:16, range:8},
  {x:-8.2, y:0.8, z:123.4, color:0x8dff6a, intensity:10, range:6},
  {x:18.7, y:2.85, z:96, color:0xffd9a0, intensity:20, range:7},
  {x:24.0, y:3.1, z:88, color:0xf4f1ea, intensity:22, range:8},
  {x:24.0, y:3.1, z:96, color:0xf4f1ea, intensity:22, range:8},
  {x:24.0, y:3.1, z:104, color:0xf4f1ea, intensity:22, range:8},
  {x:28.8, y:2.55, z:88.0, color:0xffe0b8, intensity:20, range:7},
  {x:29.0, y:2.75, z:96.0, color:0xffe2b8, intensity:22, range:8},
  {x:29.0, y:0.6, z:99.2, color:0xff8a3c, intensity:14, range:5},
  {x:29.0, y:2.75, z:102.6, color:0xeef4ff, intensity:20, range:7},
  {x:29.0, y:2.75, z:105.6, color:0xeef4ff, intensity:20, range:7},
  {x:28.5, y:2.85, z:73.5, color:0xffe2b8, intensity:24, range:8},
  {x:31.5, y:2.85, z:76.8, color:0xffe2b8, intensity:14, range:6},
  {x:36.0, y:2.7, z:73.0, color:0xffd29a, intensity:20, range:7},
  {x:27.6, y:2.85, z:81.2, color:0xfff0d8, intensity:22, range:8},
  {x:35.0, y:2.85, z:81.2, color:0xffe8c8, intensity:22, range:8},
  {x:24, y:2.9, z:112, color:0xffd9a0, intensity:20, range:8},
  {x:24, y:2.9+INCLINE.rise*.25, z:121, color:0xffd9a0, intensity:20, range:8},
  {x:24, y:2.9+INCLINE.rise*.5, z:134, color:0xffd9a0, intensity:20, range:8},
  {x:24, y:2.9+INCLINE.rise*.75, z:147, color:0xffd9a0, intensity:20, range:8},
];
