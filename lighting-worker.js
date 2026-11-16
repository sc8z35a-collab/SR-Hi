// Computes the light map (lighting.js) off the main thread. Started by createLightingDataInWorker.
import {computeLightingPixels} from './lighting.js';

self.onmessage=({data})=>{
  try{
    const {rgba,width,height}=computeLightingPixels(data.fixtures);
    self.postMessage({rgba,width,height},[rgba.buffer]);
  }catch(error){
    self.postMessage({error:String(error)});
  }
};
