export const FRAME_RATES = {high:60, balanced:45, light:30};

export function createFrameClock(){
  let previous=null, deadline=null, period=0;
  return {
    reset(){
      previous=deadline=null;
    },
    tick(now,rate,force=false){
      const interval=1000/rate;
      const dt=previous===null?0:Math.min(.085,Math.max(0,now-previous)/1000);
      previous=now;
      if(interval!==period||deadline===null||force||now-deadline>interval*2){
        deadline=now;
        period=interval;
      }
      const draw=now+.9>=deadline;
      if(draw)deadline+=interval;
      return {dt,draw};
    },
  };
}

export function createResolutionControl(rate,minimum){
  const target=1000/rate;
  let step=1, started=null, last=null, frames=0, healthy=0;
  function reset(){
    started=last=null;
    frames=healthy=0;
  }
  return {
    get scale(){return step;},
    reset,
    observe(now){
      if(last===null||now-last>750){
        reset();
        started=last=now;
        return false;
      }
      last=now;
      frames++;
      if(now-started<1600)return false;
      const frameTime=(now-started)/frames;
      let next=step;
      if(frameTime>target*1.17){
        next=Math.max(minimum,step-.10);
        healthy=0;
      }else if(frameTime<=target*1.055){
        if(++healthy>=3){
          next=Math.min(1,step+.08);
          healthy=0;
        }
      }else{
        healthy=0;
      }
      started=now;
      frames=0;
      next=Math.round(next*100)/100;
      if(next===step)return false;
      step=next;
      return true;
    }
  };
}
