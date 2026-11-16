import {HALL,ROOMS,START,VIEWPOINTS,advanceDoors,inDoorway,isBlocked,makeDoors,nearbyTarget,zoneAt} from './layout.js';
import {ACCESS} from './expansion.js';
import {FRAME_RATES,createFrameClock,createResolutionControl} from './pacing.js';

const el=id=>document.getElementById(id);
const app=el('app'), canvas=el('canvas'), intro=el('intro'), gallery=el('gallery'), hud=el('hud');
const start=el('start'), lookArea=el('look'), moveArea=el('move'), joystick=el('joystick'), interact=el('interact');
const modalPanels={settings:el('settings-panel'),terminal:el('terminal-panel'),record:el('record-panel')};
const orientation=matchMedia('(orientation: portrait)');
const levelNotes={
  high:'最大 920p。床の反射と影を細かく描画します。',
  balanced:'最大 620p。負荷に合わせて解像度を自動調整します。',
  light:'最大 400p。素材の凹凸と反射を簡略化します。'
};

function stored(key,fallback){
  try{return localStorage.getItem('strata-b4.'+key)??fallback;}catch{return fallback;}
}
function store(key,value){
  try{localStorage.setItem('strata-b4.'+key,value);}catch{}
}
let quality=stored('quality','balanced');
let sound=stored('sound','on')==='on';
let mode='intro', modal=null, loading=false, walkRequested=false, viewportNeedsRefresh=true, resumeFocus=null;
let engine=null, played=false, viewIndex=0, imageRequest=0, currentZone=HALL, activeAction=null, lastPrompt='';
let animationToken=0, toastToken=0, lamp=false;
const images=new Map();
const clock=createFrameClock();
let resolution;
const inspected=readInspected();
const doors=makeDoors();
const extensionDoor=doors.find(door=>door.room===ACCESS);
let loadingExtension=false;
const player={...START,roll:0,bob:0,distance:0,vx:0,vz:0};
const view={yaw:START.yaw,pitch:START.pitch};
const move={id:null,x:0,y:0,startX:0,startY:0};
const look={id:null,x:0,y:0};
const audio=createAudio();

function showToast(words) {
  clearTimeout(toastToken);
  const tag=el('toast');
  tag.textContent=words;tag.hidden=false;
  toastToken=setTimeout(()=>{tag.hidden=true;},3000);
}

async function fullscreen(showError=false){
  const full=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const installed=navigator.standalone||matchMedia('(display-mode: fullscreen)').matches;
  if(!full()&&!installed){
    try{
      if(app.requestFullscreen)await app.requestFullscreen({navigationUI:'hide'});
      else if(app.webkitRequestFullscreen)await app.webkitRequestFullscreen();
      else if(document.documentElement.webkitRequestFullscreen)await document.documentElement.webkitRequestFullscreen();
      else if(showError)showToast('ブラウザの表示領域いっぱいに表示しています');
    }catch{
      if(showError)showToast('ブラウザの表示領域いっぱいに表示しています');
    }
  }
  if(full())try{await screen.orientation?.lock?.('landscape');}catch{}
  requestResize();
}

function showMode(next){
  mode=next;
  intro.hidden=mode!=='intro';
  canvas.hidden=mode!=='walk';
  hud.hidden=mode!=='walk';
  lookArea.hidden=mode!=='walk'||Boolean(modal);
  gallery.hidden=mode!=='gallery';
  if(mode!=='walk')resetInput();
  audio.set(mode==='walk'&&!modal&&!orientation.matches&&!document.hidden&&sound);
  requestFrame();
}

function showGallery(index=0,fromButton=false){
  walkRequested=false;
  if(fromButton)void fullscreen(true);
  showMode('gallery');
  void requestGalleryView(index);
}
function galleryImage(index){
  if(!images.has(index)){
    const item=VIEWPOINTS[index];
    const image=new Image();
    image.alt=item.name+'の3Dレンダリング';
    image.src='./views/'+item.view+'.webp';
    const ready=image.decode().then(()=>image).catch(error=>{
      images.delete(index);
      throw error;
    });
    images.set(index,ready);
  }
  return images.get(index);
}
async function requestGalleryView(index){
  viewIndex=(index+VIEWPOINTS.length)%VIEWPOINTS.length;
  const key=++imageRequest;
  const item=VIEWPOINTS[viewIndex];
  const status=el('gallery-status');
  status.textContent='見学画像を読み込み中';
  status.hidden=false;
  try{
    const image=await galleryImage(viewIndex);
    if(key!==imageRequest||mode!=='gallery')return;
    image.id='gallery-image';
    const current=el('gallery-image');
    if(image!==current)current.replaceWith(image);
    el('gallery-code').textContent='RENDER / '+item.code;
    el('gallery-name').textContent=item.name;
    const choices=el('gallery-choices');
    for(const [i,button] of Array.from(choices.children).entries()){
      button.setAttribute('aria-pressed',String(i===viewIndex));
    }
    const selected=choices.children[viewIndex];
    choices.scrollLeft=selected.offsetLeft-(choices.clientWidth-selected.offsetWidth)/2;
    status.hidden=true;
    if(!navigator.connection?.saveData){
      void galleryImage((viewIndex+1)%VIEWPOINTS.length).catch(()=>{});
    }
  }catch{
    if(key!==imageRequest||mode!=='gallery')return;
    status.textContent='画像を読み込めませんでした。区画を選び直してください。';
  }
}

function enterWalk(){
  if(!played)resetPlayer();
  engine.setQuality(quality);
  engine.setRenderScale(resolution.scale);
  engine.setLight(lamp);
  if(!orientation.matches)engine.draw(player,performance.now()*.001);
  played=true;
  el('gallery-retry').hidden=true;
  invalidateFrame();
  viewportNeedsRefresh=true;
  showMode('walk');
}
async function startWalk(){
  if(orientation.matches||loading)return;
  if(engine&&!engine.available()){
    showToast('3D描画の復帰を待っています');
    return;
  }
  void fullscreen(true);
  if(sound)audio.prepare();
  walkRequested=true;
  loading=true;
  start.disabled=true;
  try{
    if(!engine){
      showMode('intro');
      el('start-label').textContent='3Dデータを準備中';
      const {loadWalkthrough}=await import('./render.js');
      const progress=fraction=>{
        el('start-label').textContent='3Dデータを読み込み中 '+Math.min(100,Math.round(fraction*100))+'%';
      };
      engine=await loadWalkthrough(canvas,doors,progress);
      if(player.z>=ACCESS.z||extensionDoor.open)await engine.loadExpansion(progress,{urgent:50});
    }
    if(!engine.available())throw new Error('WebGL context lost while loading');
    if(walkRequested)enterWalk();
    preloadExpansion();
  }catch(error){
    if(walkRequested)recoverWalk(error);
  }finally{
    loading=false;
    start.disabled=false;
    if(engine?.available())el('start-label').textContent=played?'全画面で探索に戻る':'全画面で探索';
  }
}
/**
 * Load the wing and everything beyond it in the background while the player explores the
 * corridor, a little each frame (see render.js), so the door opens without a pause. If it fails
 * the door loads it again when pressed.
 */
function preloadExpansion(){
  const renderer=engine;
  if(!renderer||renderer.hasExpansion())return;
  setTimeout(()=>{
    if(renderer!==engine||renderer.hasExpansion())return;
    // keep the door button's progress current while the player stands at the door
    renderer.loadExpansion(()=>{if(activeAction===extensionDoor&&!loadingExtension)setAction(extensionDoor);})
      .catch(error=>console.warn('STRATA B4 expansion preload:',error))
      .finally(()=>{if(activeAction===extensionDoor&&!loadingExtension)setAction(extensionDoor);});
  },250);
}
function recoverWalk(error){
  console.warn('STRATA B4 3D renderer:',error);
  el('start-label').textContent='3Dを再試行';
  if(engine&&!engine.available()){
    activateRenderFallback('3D描画が中断されました。復帰するまで画像で見学できます。',true);
    return;
  }
  engine?.dispose();
  engine=null;
  activateRenderFallback(error.code==='webgl-unavailable'
    ?'このブラウザではWebGL 2を利用できません。画像で見学できます。'
    :'3D描画を開始できませんでした。探索を再試行できます。');
}
function activateRenderFallback(message,waitForContext=false){
  el('gallery-retry').textContent='3Dを再試行';
  el('gallery-retry').hidden=false;
  el('gallery-retry').disabled=waitForContext;
  configureModal(null);
  showGallery(Math.max(0,VIEWPOINTS.indexOf(currentZone)));
  showToast(message);
}

function readInspected(){
  try{
    const values=JSON.parse(stored('inspection','[]'));
    return new Set(ROOMS.filter(room=>Array.isArray(values)&&values.includes(room.code)).map(room=>room.code));
  }catch{
    return new Set();
  }
}
function refreshRecord(){
  el('record-count').textContent='点検 '+inspected.size+'/'+ROOMS.length;
  el('record-status').textContent=inspected.size===ROOMS.length
    ?'全区画の点検が完了しました。'
    :'各区画の端末を開いて点検します。';
  el('record-rooms').replaceChildren(...ROOMS.map(room=>{
    const row=document.createElement('li'), code=document.createElement('b');
    const name=document.createElement('span'), status=document.createElement('small');
    const checked=inspected.has(room.code);
    row.dataset.checked=String(checked);
    code.textContent=room.code;
    name.textContent=room.name;
    status.textContent=checked?'確認済み':'未確認';
    row.append(code,name,status);
    return row;
  }));
}
function markInspected(room){
  if(inspected.has(room.code))return;
  inspected.add(room.code);
  store('inspection',JSON.stringify([...inspected]));
  refreshRecord();
  if(inspected.size===ROOMS.length)showToast(ROOMS.length+'区画すべての点検が完了しました');
}

function resetPlayer(){
  Object.assign(player,START,{roll:0,bob:0,distance:0,vx:0,vz:0});
  Object.assign(view,{yaw:START.yaw,pitch:START.pitch});
  resetInput();
  updateZone(HALL);
  setAction(null);
  invalidateFrame();
}

function resetInput(){
  for(const [pointer,area] of [[move,moveArea],[look,lookArea]]){
    if(pointer.id!==null&&area.hasPointerCapture(pointer.id))area.releasePointerCapture(pointer.id);
    pointer.id=null;
  }
  move.x=move.y=0;
  player.vx=player.vz=0;
  moveArea.classList.remove('active');
  for(const name of ['--jx','--jy','--kx','--ky'])joystick.style.removeProperty(name);
}

function configureModal(name){
  if(name===modal)return;
  modal=name;
  resetInput();
  invalidateFrame();
  for(const key in modalPanels)modalPanels[key].hidden=key!==name;
  lookArea.hidden=Boolean(name)||mode!=='walk';
  hud.inert=Boolean(name);
  if(name)el(name+'-close')?.focus({preventScroll:true});
  else if(resumeFocus&&!hud.hidden){
    resumeFocus.focus({preventScroll:true});
    resumeFocus=null;
  }
  audio.set(mode==='walk'&&!modal&&!orientation.matches&&!document.hidden&&sound);
  requestFrame();
}

function setQuality(name,persist=true){
  quality=Object.hasOwn(levelNotes,name)?name:'balanced';
  document.querySelectorAll('[data-quality]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.quality===quality));
  });
  el('quality-note').textContent=levelNotes[quality];
  if(persist)store('quality',quality);
  resolution=createResolutionControl(FRAME_RATES[quality],quality==='light'?.80:.65);
  engine?.setQuality(quality);
  engine?.setRenderScale(resolution.scale);
  invalidateFrame();
}

function setSound(enabled){
  sound=enabled;
  el('sound').setAttribute('aria-pressed',String(sound));
  el('sound').textContent=sound?'オン':'オフ';
  store('sound',sound?'on':'off');
  audio.set(mode==='walk'&&!modal&&!orientation.matches&&!document.hidden&&sound);
}
function toggleLight(){
  lamp=!lamp;
  engine?.setLight(lamp);
  el('light').setAttribute('aria-label',lamp?'ライトを消灯':'ライトを点灯');
  el('light').setAttribute('aria-pressed',String(lamp));
}

function updateZone(room){
  if(room===currentZone)return;
  currentZone=room;
  el('room-code').textContent=/^\d+$/.test(room.code)?'ZONE '+room.code:room.code;
  el('room-name').textContent=room.name;
}
function setAction(action){
  activeAction=action;
  const pending=action===extensionDoor&&loadingExtension;
  const percent=Math.round((engine?.expansionProgress()??0)*100)+'%';
  const preparing=action===extensionDoor&&engine&&!engine.hasExpansion();
  const label=action?(action.kind==='terminal'?'端末を見る':action.open?'扉を閉める':pending?'増設棟を読み込み中 '+percent:preparing?'増設棟を開ける（準備中 '+percent+'）':action===extensionDoor?'増設棟を開ける':'扉を開ける'):'';
  interact.disabled=pending;
  if(label===lastPrompt)return;
  lastPrompt=label;
  interact.hidden=!label;
  interact.querySelector('span').textContent=label;
}
async function act(){
  const item=activeAction;
  if(!item||modal)return;
  if(item.kind==='door'){
    if(item.open&&inDoorway(item,player.x,player.z)){
      showToast('扉から離れると閉められます');
      return;
    }
    if(item===extensionDoor&&!engine.hasExpansion()){
      if(loadingExtension)return;
      loadingExtension=true;
      setAction(item);
      const renderer=engine;
      try{
        await renderer.loadExpansion(()=>{if(activeAction===item)setAction(item);},{urgent:30});
        if(renderer!==engine||mode!=='walk'||activeAction!==item)return;
      }catch(error){
        console.warn('STRATA B4 expansion:',error);
        showToast('増設棟を読み込めませんでした。扉から再試行できます。');
        return;
      }finally{
        loadingExtension=false;
        setAction(activeAction);
      }
    }
    item.open=!item.open;
    audio.door(item.open);
    setAction(item);
  }else{
    const room=item.room;
    markInspected(room);
    el('terminal-code').textContent='B4 / '+room.code;
    el('terminal-title').textContent=room.name;
    el('terminal-readout').replaceChildren(...room.data.map(([key,value])=>{
      const row=document.createElement('div'), term=document.createElement('dt'), desc=document.createElement('dd');
      term.textContent=key;desc.textContent=value;row.append(term,desc);
      return row;
    }));
    resumeFocus=interact;
    configureModal('terminal');
  }
}

function movePlayer(dt){
  const speed=2.55, side=move.x, forward=-move.y;
  const xSpeed=(side*Math.cos(player.yaw)-forward*Math.sin(player.yaw))*speed;
  const zSpeed=(-forward*Math.cos(player.yaw)-side*Math.sin(player.yaw))*speed;
  const ease=1-Math.exp(-dt*14);
  player.vx+=(xSpeed-player.vx)*ease;
  player.vz+=(zSpeed-player.vz)*ease;
  const x=player.x+player.vx*dt,z=player.z+player.vz*dt;
  const originX=player.x,originZ=player.z;
  if(!isBlocked(x,player.z,doors))player.x=x;
  if(!isBlocked(player.x,z,doors))player.z=z;
  const distance=Math.hypot(player.x-originX,player.z-originZ);
  const strength=Math.min(1,distance/Math.max(.001,speed*dt));
  const oldStep=Math.floor(player.distance/.59);
  player.distance+=distance;
  if(Math.floor(player.distance/.59)!==oldStep&&strength>.31)audio.footstep();
  player.bob+=((Math.sin(player.distance*10.6)*strength*.022)-player.bob)*ease;
  player.roll=Math.sin(player.distance*5.3)*strength*.006;
}

function invalidateFrame(){
  clock.reset();
  resolution?.reset();
}
function triggerOrientation(){
  resetInput();
  invalidateFrame();
  requestResize();
  audio.set(mode==='walk'&&!modal&&!orientation.matches&&!document.hidden&&sound);
}
function requestResize(){
  viewportNeedsRefresh=true;
  requestFrame();
}
function requestFrame(){
  if(animationToken||mode!=='walk'||orientation.matches||document.hidden)return;
  animationToken=requestAnimationFrame(frame);
}
function frame(now){
  animationToken=0;
  if(mode!=='walk'||!engine||orientation.matches||document.hidden)return;
  const {dt,draw}=clock.tick(now,modal?12:FRAME_RATES[quality],viewportNeedsRefresh);
  if(!modal&&dt>0){
    const ease=1-Math.exp(-dt*32);
    let turn=view.yaw-player.yaw;
    if(turn>Math.PI)turn-=Math.PI*2;
    if(turn<-Math.PI)turn+=Math.PI*2;
    player.yaw=(player.yaw+turn*ease+Math.PI*3)%(Math.PI*2)-Math.PI;
    player.pitch+=(view.pitch-player.pitch)*ease;
    const steps=Math.ceil(dt*60);
    for(let i=0;i<steps;i++){
      advanceDoors(doors,dt/steps,player.x,player.z);
      movePlayer(dt/steps);
    }
    updateZone(zoneAt(player.x,player.z));
    setAction(nearbyTarget(player,doors));
  }
  if(draw){
    if(viewportNeedsRefresh){
      engine.resize();
      viewportNeedsRefresh=false;
    }
    if(!modal&&resolution.observe(now))engine.setRenderScale(resolution.scale);
    try{engine.draw(player,now*.001);}catch(error){
      recoverWalk(error);
      return;
    }
  }
  requestFrame();
}
function bindControls(){
  moveArea.addEventListener('pointerdown',event=>{
    if(move.id!==null||modal||event.button!==0)return;
    event.preventDefault();
    const rect=joystick.getBoundingClientRect();
    move.id=event.pointerId;move.startX=event.clientX;move.startY=event.clientY;
    moveArea.setPointerCapture(event.pointerId);
    moveArea.classList.add('active');
    joystick.style.setProperty('--jx',event.clientX-(rect.x+rect.width/2)+'px');
    joystick.style.setProperty('--jy',event.clientY-(rect.y+rect.height/2)+'px');
  });
  moveArea.addEventListener('pointermove',event=>{
    if(event.pointerId!==move.id)return;
    const maxRadius=joystick.offsetWidth*.38;
    const dx=event.clientX-move.startX,dy=event.clientY-move.startY;
    const length=Math.hypot(dx,dy);
    const scale=Math.min(1,maxRadius/Math.max(.001,length));
    const throwRatio=Math.max(0,(Math.min(length/maxRadius,1)-.09)/.91);
    move.x=dx/Math.max(.001,length)*throwRatio;
    move.y=dy/Math.max(.001,length)*throwRatio;
    joystick.style.setProperty('--kx',dx*scale*.86+'px');
    joystick.style.setProperty('--ky',dy*scale*.86+'px');
  });
  lookArea.addEventListener('pointerdown',event=>{
    if(look.id!==null||modal||event.button!==0)return;
    event.preventDefault();
    Object.assign(look,{id:event.pointerId,x:event.clientX,y:event.clientY});
    lookArea.setPointerCapture(event.pointerId);
  });
  lookArea.addEventListener('pointermove',event=>{
    if(event.pointerId!==look.id)return;
    const sensitivity=.0051;
    const offset=view.yaw-(event.clientX-look.x)*sensitivity;
    view.yaw=((offset+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
    view.pitch=Math.max(-1.13,Math.min(1.13,view.pitch-(event.clientY-look.y)*sensitivity));
    look.x=event.clientX;look.y=event.clientY;
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
    moveArea.addEventListener(event,e=>{
      if(e.pointerId!==move.id)return;
      Object.assign(move,{id:null,x:0,y:0});
      moveArea.classList.remove('active');
      for(const prop of ['--jx','--jy','--kx','--ky'])joystick.style.removeProperty(prop);
    });
    lookArea.addEventListener(event,e=>{if(e.pointerId===look.id)look.id=null;});
  }
  app.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    if(mode==='walk')activateRenderFallback('3D描画が中断されました。復帰するまで画像で見学できます。',true);
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    el('gallery-retry').disabled=false;
    el('gallery-retry').textContent=played?'探索に戻る':'3Dを再試行';
    if(mode==='gallery'&&played)showToast('3D描画が復帰しました');
  });
  orientation.addEventListener('change',triggerOrientation);
  document.addEventListener('visibilitychange',triggerOrientation);
  window.addEventListener('resize',requestResize,{passive:true});
  document.addEventListener('fullscreenchange',requestResize);
  window.visualViewport?.addEventListener('resize',requestResize,{passive:true});

  start.addEventListener('click',startWalk);
  el('gallery-intro').addEventListener('click',()=>showGallery(0,true));
  el('gallery-close').addEventListener('click',()=>showMode('intro'));
  el('gallery-retry').addEventListener('click',startWalk);
  el('gallery-prev').addEventListener('click',()=>requestGalleryView(viewIndex-1));
  el('gallery-next').addEventListener('click',()=>requestGalleryView(viewIndex+1));
  el('gallery-full').addEventListener('click',()=>fullscreen(true));
  el('full').addEventListener('click',()=>fullscreen(true));
  el('light').addEventListener('click',toggleLight);
  el('settings').addEventListener('click',()=>{
    resumeFocus=el('settings');
    configureModal('settings');
  });
  el('record').addEventListener('click',()=>{
    resumeFocus=el('record');
    configureModal('record');
  });
  for(const id of ['settings-close','terminal-close','record-close','resume']){
    el(id).addEventListener('click',()=>configureModal(null));
  }
  el('reset').addEventListener('click',()=>{
    resetPlayer();configureModal(null);
    showToast('連絡通路の入口に戻りました');
  });
  el('sound').addEventListener('click',()=>{if(!sound)audio.prepare();setSound(!sound);});
  interact.addEventListener('click',act);
  document.querySelectorAll('[data-quality]').forEach(button=>button.addEventListener('click',()=>setQuality(button.dataset.quality)));
  document.addEventListener('keydown',event=>{
    if(!modal)return;
    if(event.key==='Escape'){
      configureModal(null);
      return;
    }
    if(event.key!=='Tab')return;
    const buttons=[...modalPanels[modal].querySelectorAll('button:not([disabled])')];
    const first=buttons[0],last=buttons.at(-1),active=document.activeElement;
    if((event.shiftKey&&active===first)||(!event.shiftKey&&active===last)){
      event.preventDefault();
      (event.shiftKey?last:first).focus();
    }
  });
  VIEWPOINTS.forEach((description,index)=>{
    const button=document.createElement('button');
    button.type='button';button.textContent=description.short;
    button.setAttribute('aria-label',description.name);
    button.addEventListener('click',()=>requestGalleryView(index));
    el('gallery-choices').append(button);
  });
}

function createAudio(){
  let context,master,ambient,stepNoise,enabled=false;
  function noiseBuffer(duration){
    const length=Math.floor(context.sampleRate*duration);
    const buffer=context.createBuffer(1,length,context.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
    return buffer;
  }
  function prepare(){
    if(!context){
      const Audio=window.AudioContext??window.webkitAudioContext;
      if(!Audio)return;
      try{context=new Audio();}catch{return;}
      master=context.createGain();master.gain.value=.43;master.connect(context.destination);
      ambient=context.createGain();ambient.gain.value=0;ambient.connect(master);
      for(const [frequency,volume] of [[51,.033],[102,.010],[153,.003]]){
        const gear=context.createOscillator(),level=context.createGain();
        gear.frequency.value=frequency;level.gain.value=volume;gear.connect(level).connect(ambient);gear.start();
      }
      const air=context.createBufferSource(), filter=context.createBiquadFilter(), volume=context.createGain();
      air.buffer=noiseBuffer(2.5);air.loop=true;
      filter.type='lowpass';filter.frequency.value=490;
      volume.gain.value=.027;
      air.connect(filter).connect(volume).connect(ambient);air.start();
      stepNoise=noiseBuffer(.153);
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
  }
  function set(active){
    enabled=active&&Boolean(context);
    if(context)ambient.gain.setTargetAtTime(enabled ? .78 : 0,context.currentTime,.19);
  }
  function footstep(){
    if(!enabled)return;
    const source=context.createBufferSource(), filter=context.createBiquadFilter(), volume=context.createGain();
    const now=context.currentTime;
    source.buffer=stepNoise;source.playbackRate.value=.91+Math.random()*.19;
    filter.type='lowpass';filter.frequency.value=416+Math.random()*145;
    volume.gain.setValueAtTime(.1,now);volume.gain.exponentialRampToValueAtTime(.001,now+.14);
    source.connect(filter).connect(volume).connect(master);source.start();
  }
  function door(open){
    if(!enabled)return;
    const motor=context.createOscillator(),volume=context.createGain();
    const now=context.currentTime;
    motor.type='triangle';motor.frequency.setValueAtTime(open?69:102,now);
    motor.frequency.exponentialRampToValueAtTime(open?105:53,now+.56);
    volume.gain.setValueAtTime(.001,now);volume.gain.exponentialRampToValueAtTime(.048,now+.13);
    volume.gain.exponentialRampToValueAtTime(.001,now+.69);
    motor.connect(volume).connect(master);motor.start();motor.stop(now+.71);
  }
  return {prepare,set,footstep,door};
}

setQuality(quality,false);
setSound(sound);
refreshRecord();
bindControls();
