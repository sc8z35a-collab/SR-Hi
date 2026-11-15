import * as THREE from './vendor/three.module.js';
import {HALL,zoneAt} from './layout.js';
import {WING_HALL,THROAT} from './expansion.js';

const BOUNDS=[-24.4,-42.9,49.2,124.8];
const FILLS={
  HALL:[.79,.84,.88],
  WING:[.83,.87,.92],
  '01':[.86,.89,.91],
  '02':[.72,.81,.84],
  '03':[.68,.79,.83],
  '04':[.76,.68,.59],
  '05':[.72,.66,.61],
  '06':[.86,.96,.91],
  '07':[.93,.82,.70],
  '08':[.76,.87,1.01],
  '09':[.79,.76,.62],
  '10':[.76,.86,.96],
  '11':[.89,.85,.80],
};

function roomBoundaryDistance(room,x,z){
  if(room===HALL)return Math.abs(Math.abs(x)-2.75);
  if(room===WING_HALL)return Math.abs(Math.abs(x)-(z<THROAT.z2?2.85:3.32));
  if(room.entry)return Math.min(x-room.x1,room.x2-x,z-room.z1,room.z2-z);
  return room.side ? Math.abs(x-room.wall) : Math.abs(z-room.door);
}

export function createLightingData(fixtures){
  const sources=fixtures.map(fixture=>({
    ...fixture,
    room:zoneAt(fixture.x,fixture.z),
    tint:new THREE.Color(fixture.color).toArray()
  }));
  const [left,back,spanX,spanZ]=BOUNDS;
  const width=160, height=408;
  const rgba=new Uint8Array(width*height*4);
  for(let row=0;row<height;row++){
    const z=back+(row+.5)/height*spanZ;
    const localSources=sources.filter(source=>Math.abs(z-source.z)<source.range);
    for(let column=0;column<width;column++){
      const x=left+(column+.5)/width*spanX;
      const room=zoneAt(x,z);
      const color=FILLS[room.code].slice();
      const edge=roomBoundaryDistance(room,x,z);
      const bounce=.06*Math.exp(-edge*1.1);
      for(const source of localSources){
        const distanceSq=(x-source.x)**2+(z-source.z)**2+(source.y-.88)**2;
        const outer=distanceSq/(source.range*source.range);
        if(outer>=1)continue;
        const transmittance=source.room===room?1:.20;
        const power=transmittance*Math.min(.23,source.intensity*.075/(2.8+distanceSq))*(1-outer)**2;
        for(let i=0;i<3;i++)color[i]+=power*(.62+.38*source.tint[i]);
      }
      const output=(row*width+column)*4;
      for(let i=0;i<3;i++)rgba[output+i]=Math.round(255*Math.min(1,(color[i]-bounce)/1.37));
      rgba[output+3]=255;
    }
  }
  const texture=new THREE.DataTexture(rgba,width,height);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  return {texture,sources};
}

export function applyIndoorLighting(material,texture){
  const rect=new THREE.Vector4(...BOUNDS);
  material.onBeforeCompile=shader=>{
    shader.uniforms.facilityLight={value:texture};
    shader.uniforms.facilityRect={value:rect};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec2 facilityXZ;')
      .replace('#include <project_vertex>',[
        '#include <project_vertex>',
        'facilityXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'
      ].join('\n'));
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',[
        '#include <common>',
        'varying vec2 facilityXZ;',
        'uniform sampler2D facilityLight;',
        'uniform vec4 facilityRect;'
      ].join('\n'))
      .replace('#include <lights_fragment_maps>',[
        '#include <lights_fragment_maps>',
        'vec2 facilityUV = (facilityXZ - facilityRect.xy) / facilityRect.zw;',
        'vec3 facilityFill = texture2D(facilityLight, facilityUV).rgb * 1.37;',
        'irradiance *= facilityFill;',
        'iblIrradiance *= mix(vec3(1.0), facilityFill, 0.70);'
      ].join('\n'));
  };
  material.customProgramCacheKey=()=> 'strata-indoor-ambient-v1';
}

export function createFixtureController(scene,sources){
  const pool=Array.from({length:8},()=>({
    light:new THREE.PointLight(0xffffff,0,9,2), fixture:null, factor:0
  }));
  scene.add(...pool.map(entry=>entry.light));
  let ranked;
  const wanted=new Set();
  let activeCount=0, previousTime=null, nextRank=0;
  function setSources(fixtures){
    ranked=fixtures.map(fixture=>({fixture,score:0}));
    setCount(activeCount);
  }
  function setCount(count){
    activeCount=count;
    nextRank=0;
    previousTime=null;
    for(const [i,entry] of pool.entries()){
      entry.light.visible=i<count;
      entry.fixture=null;
      entry.factor=0;
      entry.light.intensity=0;
    }
  }
  function update(x,z,time){
    if(time>=nextRank||previousTime===null){
      const room=zoneAt(x,z);
      for(const entry of ranked){
        const f=entry.fixture;
        const mismatch=f.room!==room;
        entry.score=(x-f.x)**2+(z-f.z-.38)**2
          +(f.intensity<13?7:0)+(mismatch?6:0);
      }
      ranked.sort((a,b)=>a.score-b.score);
      wanted.clear();
      for(let i=0;i<activeCount-1&&i<ranked.length;i++)wanted.add(ranked[i].fixture);
      nextRank=time+.12;
    }
    const first=previousTime===null;
    const dt=first?0:Math.min(.10,Math.max(0,time-previousTime));
    const step=dt*4.5;
    previousTime=time;
    const assigned=new Set();
    for(let i=0;i<activeCount;i++){
      const entry=pool[i];
      if(!entry.fixture)continue;
      if(wanted.has(entry.fixture)){
        entry.factor=Math.min(1,entry.factor+step);
        assigned.add(entry.fixture);
      }else{
        entry.factor=Math.max(0,entry.factor-step);
        if(entry.factor===0)entry.fixture=null;
      }
    }
    for(const fixture of wanted){
      if(assigned.has(fixture))continue;
      const entry=pool.find((item,i)=>i<activeCount&&!item.fixture);
      if(!entry)break;
      entry.fixture=fixture;
      entry.factor=first?1:0;
      entry.light.position.set(fixture.x,fixture.y,fixture.z);
      entry.light.color.setHex(fixture.color);
      entry.light.distance=fixture.range;
    }
    for(let i=0;i<activeCount;i++){
      const {fixture,factor,light}=pool[i];
      light.intensity=fixture?fixture.intensity*1.10*factor:0;
    }
    return ranked;
  }
  setSources(sources);
  return {setCount,setSources,update};
}
