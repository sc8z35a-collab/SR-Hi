// The open-air world above the facility: shaft, mine yard (19) and the wider valley (20-23).
// Pure math (no three.js) so the collision code can use it as well as the 3D builder.

export const Y = 14;
// Inclined shaft from the living quarters' hall up to the mine yard.
export const INCLINE = {half:1.6, wall:2.5, crown:3.1, x:24, z1:108.0, z2:160.0, rise:Y};
export const inclineFloor = z => Math.min(1, Math.max(0, (z - INCLINE.z1) / (INCLINE.z2 - INCLINE.z1))) * INCLINE.rise;
export const YARD = {x1:8, x2:40, z1:160.3, z2:194, y:Y};
export const WORLD = {x1:-62, x2:128, z1:160.3, z2:338};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash2 = (x, z) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm2 = (x, z) => noise2(x, z) * .55 + noise2(x * 2.03 + 17, z * 2.03) * .3 + noise2(x * 4.1, z * 4.1 + 9) * .15;
export const rng = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export const inRect = (r, x, z, pad = 0) => x >= r.x1 - pad && x <= r.x2 + pad && z >= r.z1 - pad && z <= r.z2 + pad;
const outside = (r, x, z) => Math.hypot(Math.max(r.x1 - x, x - r.x2, 0), Math.max(r.z1 - z, z - r.z2, 0));

// ---- features ----
export const STREAM = {x:4.2, y:Y - .3, z1:161, z2:270};
export const RIVER = {z:x => 282 + 4 * Math.sin(x * .05 + .4), half:5, bank:10.5, water:Y - 3.2, bed:Y - 4.6, x1:-50};
export const BRIDGE = {x1:40.6, x2:47.4, z1:RIVER.z(44) - 10.8, z2:RIVER.z(44) + 10.8, y:Y + .6};
export const FOOTBRIDGE = {x1:-15.3, x2:-12.7, z1:RIVER.z(-14) - 8.2, z2:RIVER.z(-14) + 8.2, y:Y + .3};
export const ROADS = [
  {x1:21, x2:27, z1:194, z2:211},
  {x1:-14, x2:126, z1:205, z2:211},
  {x1:41, x2:47, z1:211, z2:338},
];
export const HQ = {x1:4, x2:36, z1:240, z2:258, height:13.2};
export const PLAZA = {x1:6, x2:34, z1:213, z2:240};
export const PARKING = {x1:50, x2:64, z1:214, z2:250};
export const HELIPAD = {x:-11, z:245, size:14};
export const PADDIES = [
  {x1:5, x2:36, z1:298, z2:311, y:Y + .8},
  {x1:5, x2:36, z1:314, z2:327, y:Y + 1.8},
  {x1:-30, x2:1, z1:300, z2:313, y:Y + 1.2},
  {x1:-30, x2:1, z1:316, z2:329, y:Y + 2.2},
];
export const TEMPLE = {x1:-50, x2:-32, z1:318, z2:336, y:Y + 5};
const PADS = [
  {x1:YARD.x1 - .6, x2:YARD.x2 + .6, z1:YARD.z1, z2:YARD.z2 + .6, y:Y, m:.6},
  {x1:-22, x2:66, z1:194.6, z2:262, y:Y, m:7},
  {x1:66, x2:124, z1:196, z2:260, y:Y + .6, m:7},
  {x1:48.5, x2:76, z1:297, z2:332, y:Y + 1.6, m:5},
  {x1:-34, x2:38, z1:296, z2:331, y:Y + 1.4, m:7},
  {...TEMPLE, m:9},
];
const roadHeight = z => z < 262 ? Y : z < BRIDGE.z1 ? Y + (z - 262) / (BRIDGE.z1 - 262) * .6 : z <= BRIDGE.z2 ? BRIDGE.y : Y + .6 + Math.min(1, (z - BRIDGE.z2) / 40) * 1.2;

function natural(x, z) {
  let h = Y + 2 + (fbm2(x * .03, z * .03) - .5) * 8;
  h += 18 * sstep(-38, -58, x);
  h += 14 * sstep(318, 346, z) * (.6 + .4 * fbm2(x * .05, 3));
  h += 12 * Math.exp(-((x - 108) ** 2 + (z - 178) ** 2) / (2 * 13 ** 2));
  h += 10 * sstep(122, 142, x);
  return h;
}

/** Height of the outdoor ground at (x, z). */
export function groundHeight(x, z) {
  if (z < YARD.z1) {
    const n = fbm2(x * .07, z * .07 + 3) - .5;
    return Y + Math.min(8, (YARD.z1 - z) * 1.6) + n * 1.6 * sstep(0, 3, YARD.z1 - z);
  }
  let h = natural(x, z);
  for (const p of PADS) {
    const d = outside(p, x, z);
    if (d < p.m) h += (p.y - h) * (1 - sstep(0, p.m, d));
  }
  const road = ROADS[2], rd = outside(road, x, z);
  if (z > 258 && rd < 4) h += (roadHeight(z) - h) * (1 - sstep(.5, 4, rd));
  for (const p of PADDIES) {
    const d = outside(p, x, z);
    if (d < 2.5) h += (p.y - .15 - h) * (1 - sstep(0, 2.5, d));
  }
  if (x > RIVER.x1 - 1) {
    const dz = Math.abs(z - RIVER.z(x)), edge = sstep(RIVER.x1 - 1, RIVER.x1 + 2, x);
    if (dz < RIVER.bank) h += (RIVER.bed - h) * (1 - sstep(RIVER.half - 1.5, RIVER.bank, dz)) * edge;
  }
  const s = Math.abs(x - STREAM.x);
  if (s < 2.6 && z > STREAM.z1 && z < STREAM.z2) h = Math.min(h, STREAM.y - .15 + (s / 2.6) ** 2 * 1.1);
  return h;
}

export const onBridge = (x, z) => inRect(BRIDGE, x, z) || inRect(FOOTBRIDGE, x, z);
export const bridgeHeight = (x, z) => inRect(BRIDGE, x, z) ? BRIDGE.y : FOOTBRIDGE.y;

/** Walkable outdoor ground: inside the world, not in water and not too steep. */
export function outdoorWalkable(x, z) {
  if (x < WORLD.x1 + 2 || x > WORLD.x2 - 2 || z < YARD.z1 + .1 || z > WORLD.z2 - 2) return false;
  if (onBridge(x, z)) return Math.abs(x - (inRect(BRIDGE, x, z) ? 44 : -14)) < (inRect(BRIDGE, x, z) ? 3.0 : .95);
  if (x > RIVER.x1 - 3 && Math.abs(z - RIVER.z(x)) < RIVER.half + 1.6) return false;
  if (Math.abs(x - STREAM.x) < 1.2 && z > STREAM.z1 && z < STREAM.z2) return false;
  if (PADDIES.some(p => inRect(p, x, z, -.2))) return false;
  const e = .7;
  const gx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e), gz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
  return Math.hypot(gx, gz) < .78;
}

// ---- trees, placed once and shared by the collision code and the 3D builder ----
const keepClear = [
  {x1:YARD.x1 - 1.5, x2:YARD.x2 + 1.5, z1:YARD.z1, z2:YARD.z2 + 1.5},
  {x1:-20, x2:64, z1:198, z2:262}, {x1:64, x2:124, z1:196, z2:262},
  {x1:48, x2:77, z1:296, z2:333}, {x1:-34, x2:38, z1:296, z2:331}, TEMPLE,
  {x1:98, x2:118, z1:170, z2:188}, {x1:86, x2:99, z1:176, z2:190},
];
export const TREES = (() => {
  // Groves and clearings from low-frequency noise; trees keep their distance from each other,
  // stay off roads, paths, water and steep rock, and species follow the local landscape.
  const R = rng(2024), list = [], cell = 3.4, grid = new Map();
  const key = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  const near = (x, z, d) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const t of grid.get(`${Math.floor(x / 4) + i},${Math.floor(z / 4) + j}`) ?? []) if (Math.hypot(t.x - x, t.z - z) < d) return true;
    }
    return false;
  };
  const paths = [[[92, 200], [108, 178.5]], [[-30, 313.8], [1, 313.8]], [[2.6, 298], [2.6, 329]], [[-41, 300], [-41, 320]]];
  const onPath = (x, z) => paths.some(([[ax, az], [bx, bz]]) => {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t) < 2.6;
  });
  const add = t => { list.push(t); const k = key(t.x, t.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); };
  for (const [x, z] of [[8.5, 219], [8.5, 233], [31.5, 219], [31.5, 233], [47.8, 312], [64, 326], [-36, 322], [-44, 322]])
    add({x, z, kind:'sakura', s:.85});
  for (let gx = WORLD.x1 + 1; gx < WORLD.x2 + 10; gx += cell) for (let gz = 162; gz < WORLD.z2 + 10; gz += cell) {
    const x = gx + R() * cell, z = gz + R() * cell, roll = R();
    const forest = sstep(.42, .62, fbm2(x * .022 + 40, z * .022));
    if (R() > .12 + forest * .8) continue;
    if (keepClear.some(r => inRect(r, x, z)) || ROADS.some(r => inRect(r, x, z, 3.5)) || PADDIES.some(p => inRect(p, x, z, 2.2))) continue;
    if (onPath(x, z) || onBridge(x, z) || (Math.abs(x - STREAM.x) < 3 && z < STREAM.z2)) continue;
    const dz = x > RIVER.x1 - 3 ? Math.abs(z - RIVER.z(x)) : 99;
    if (dz < RIVER.half + 2.8) continue;
    const e = 1, slope = Math.hypot(groundHeight(x + e, z) - groundHeight(x - e, z), groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
    if (slope > .85) continue;
    if (near(x, z, 3.0 + R() * 1.5)) continue;
    const mix = fbm2(x * .05 + 9, z * .05);
    let kind;
    if (dz < 13) kind = roll < .55 ? 'birch' : roll < .8 ? 'momiji' : 'cedar';
    else if (Math.hypot(x - 108, z - 178) < 32 || Math.hypot(x + 41, z - 327) < 20 || slope > .55) kind = roll < .7 ? 'pine' : 'momiji';
    else if (z > 290 && x > -30 && x < 80) kind = mix > .55 ? 'momiji' : roll < .3 ? 'sakura' : 'cedar';
    else kind = mix > .6 ? (roll < .6 ? 'momiji' : 'pine') : mix < .4 ? 'cedar' : roll < .5 ? 'cedar' : 'pine';
    add({x, z, kind, s:.75 + R() * .55 + forest * .15});
  }
  return list;
})();

// ---- zones 20-23 (collision boxes for buildings and tree trunks) ----
const prop = (type, x, z, w, d) => ({type, x, z, w, d});
const at = (x, z) => groundHeight(x, z);

export const HQ_ZONE = {
  code:'20', name:'研究所本館・正面広場', view:'hq', short:'本館', side:0,
  x1:WORLD.x1, x2:66, z1:196, z2:262, outdoor:true,
  entry:{x:24, z:196, axis:'z', width:6, height:4, door:false}, terminal:[31.4, 214.6], terminalY:at(31.4, 214.6),
  data:[['本館','地上3階・地下4層'],['来訪者','受付終了'],['ヘリポート','使用可能'],['駐車場','8 / 24 台']],
  floors:[],
  props:[
    prop('hq', (HQ.x1 + HQ.x2) / 2, (HQ.z1 + HQ.z2) / 2, HQ.x2 - HQ.x1 + .4, HQ.z2 - HQ.z1 + .4),
    prop('fountain', 20, 226, 6.6, 6.6), prop('monolith', 9.2, 215.2, 2.6, .7), prop('bamboo', 42, 198.5, 10.4, 7.8),
    prop('bikes', 6.9, 227.8, 1.6, 4.6), prop('bins', 12, 226, 1.4, .6), prop('bins', 28, 226, 1.4, .6),
    prop('flowerbed', 14, 214, 6, .9), prop('flowerbed', 26, 214, 6, .9), prop('info-map', 21.8, 213.3, 1.6, .4),
    prop('cafe', 11.6, 218.4, 2.0, 2.0), prop('cafe', 15.4, 218.4, 2.0, 2.0),
    prop('ev', 50.5, 218.5, .5, .45), prop('ev', 50.5, 221.6, .5, .45), prop('hedge', 49.3, 237, .9, 26),
    prop('flagpole', 11, 236.2, .3, .3), prop('flagpole', 13.2, 236.2, .3, .3), prop('flagpole', 15.4, 236.2, .3, .3),
    prop('canopy-column', 14.6, 234.6, .45, .45), prop('canopy-column', 25.4, 234.6, .45, .45),
    prop('planter', 9.6, 238.6, 7.2, 1.1), prop('planter', 30.4, 238.6, 7.2, 1.1),
    prop('bench', 12, 223, 1.9, .6), prop('bench', 28, 223, 1.9, .6), prop('bench', 12, 229, 1.9, .6), prop('bench', 28, 229, 1.9, .6),
    ...[0, 1, 2, 3].flatMap(i => [prop('car', 53.2, 218.5 + i * 3.1, 4.6, 2.0), prop('car', 60.8, 230.5 + i * 3.1, 4.6, 2.0)]),
    ...[-6, 10, 40, 58, 80, 100, 118].map(x => prop('streetlight', x, 212.4, .3, .3)),
    ...[222, 240, 258, 280, 300, 320].map(z => prop('streetlight', 48.6, z, .3, .3)),
  ],
};
export const RIVER_ZONE = {
  code:'21', name:'渓谷と鉄橋', view:'river', short:'渓谷', side:0,
  x1:WORLD.x1, x2:WORLD.x2, z1:262, z2:298, outdoor:true,
  entry:{x:44, z:262, axis:'z', width:6, height:4, door:false}, terminal:[49.6, 268.5], terminalY:at(49.6, 268.5),
  data:[['川の水位','平常 0.42 m'],['水温','9.8 °C'],['鉄橋','異常なし'],['滝の落差','約 15 m']],
  floors:[],
  props:[prop('boulder', 30, RIVER.z(30) - 7.6, 2.4, 1.8), prop('boulder', 60, RIVER.z(60) + 7.8, 2.2, 1.8), prop('boulder', -30, RIVER.z(-30) - 7.4, 2.6, 2.0)],
};
export const VILLAGE = {
  code:'22', name:'里山の集落', view:'village', short:'集落', side:0,
  x1:WORLD.x1, x2:WORLD.x2, z1:298, z2:WORLD.z2, outdoor:true,
  entry:{x:44, z:298, axis:'z', width:6, height:4, door:false}, terminal:[49.4, 304.6], terminalY:at(49.4, 304.6),
  data:[['世帯','2 戸'],['水田','4 枚'],['寺の鐘','正午に鳴動'],['路線バス','1 日 3 便']],
  floors:[],
  props:[
    prop('house', 57, 305.5, 10.4, 7.4), prop('house', 65, 319.5, 10.4, 7.4), prop('kura', 53.5, 318.5, 5.4, 4.4),
    prop('hazagake', 20, 296.6, 12, .5), prop('hazagake', -15, 298.6, 10, .5), prop('bus-stop', 50.2, 300.2, 1.8, 3.4),
    prop('jizo', 39.2, 303.6, .6, .6), prop('jizo', 39.2, 304.6, .6, .6), prop('jizo', 39.2, 305.6, .6, .6),
    prop('bell-tower', -45, 328.5, 4.6, 4.6), prop('temple', -37, 332.3, 8.4, 5.9),
    prop('torii-post', -42.3, 319.4, .5, .5), prop('torii-post', -39.7, 319.4, .5, .5),
    prop('lantern', -43.2, 323, .55, .55), prop('lantern', -38.8, 323, .55, .55),
    prop('mill', 27.6, 294.2, 4.4, 3.6), prop('jars', 54.5, 310.1, 2.0, .9), prop('firewood', 65, 315.3, 4.6, .9),
    prop('scarecrow', 37.4, 300.6, .6, .6), prop('boat', -6, RIVER.z(-6) + 7.4, 3.6, 1.4), prop('net', -1, RIVER.z(-1) + 8.6, 3.2, .4),
  ],
};
export const PLATEAU = {
  code:'23', name:'東の台地', view:'plateau', short:'台地', side:0,
  x1:60, x2:WORLD.x2, z1:108, z2:262, outdoor:true,
  entry:{x:66, z:208, axis:'x', width:6, height:4, door:false}, terminal:[87.6, 212.6], terminalY:at(87.6, 212.6),
  data:[['変電所','受電中 66 kV'],['太陽光','出力 312 kW'],['レーダー','回転中'],['排気塔','3 基 運転中']],
  floors:[],
  props:[
    prop('substation', 77, 222, 18.4, 16.4),
    ...[216, 221, 226, 231].map(z => prop('solar', 106, z, 32.4, 2.0)),
    prop('water-tower', 74, 244, 6.4, 6.4), prop('radar', 100, 250, 7.4, 7.4),
    prop('dish', 113.6, 247.6, 4.2, 4.2), prop('dish', 120, 255.6, 4.2, 4.2),
    prop('stack', 68, 252, 2.8, 2.8), prop('stack', 74, 256, 2.8, 2.8), prop('stack', 80, 252, 2.8, 2.8),
    prop('lookout', 108, 178, 4.6, 4.6), prop('picnic', 102.5, 184.5, 2.2, 1.8), prop('picnic', 114, 172.5, 2.2, 1.8),
    prop('tent', 92, 181, 2.6, 2.6), prop('tent', 95.6, 185.6, 2.6, 2.6), prop('campfire', 91.2, 186.4, 1.3, 1.3),
    ...[0.6, 2.2, 3.8, 5.2].map(a => prop('camp-chair', 91.2 + Math.cos(a) * 1.75, 186.4 + Math.sin(a) * 1.75, .6, .6)),
    prop('cooler', 93.9, 183.0, .7, .5), prop('telescope', 104.6, 181.8, .7, .7), prop('trail-sign', 92.6, 201.4, .4, .4),
    prop('trail-sign', 100.4, 187.6, .4, .4), prop('logs', 88.4, 183.2, 2.0, .9), prop('weather', 88.6, 246.2, 2.6, 1.2),
    prop('utility-car', 77, 233.4, 3.6, 1.8), prop('reels', 70.4, 232.6, 2.4, 1.2),
  ],
};
for (const t of TREES) HQ_ZONE.props.push(prop('tree', t.x, t.z, .55 * t.s, .55 * t.s));
export const OUTDOOR_ROOMS = [HQ_ZONE, RIVER_ZONE, VILLAGE, PLATEAU];

// Point lights of the outdoor world (the daylight itself is a directional sun added while outdoors).
export const OUTDOOR_FIXTURES = [
  {x:20, y:Y + 3.9, z:236.5, color:0xfff0d6, intensity:24, range:9},
  {x:91.2, y:groundHeight(91.2, 186.4) + .8, z:186.4, color:0xff8a3c, intensity:14, range:6},
  {x:-37, y:groundHeight(-37, 332.3) + 3, z:330.2, color:0xff6a3c, intensity:14, range:7},
  {x:50.2, y:groundHeight(50.2, 300.2) + 2.3, z:300.2, color:0xeef4ff, intensity:12, range:5},
];
