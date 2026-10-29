import test from 'node:test';import assert from 'node:assert/strict';
import {VoiceRecorder} from '../public/hw6/recorder.mjs';
test('3-minute limit stops just the segment, sounds once, releases mic and audio buffers',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:0});
 let stopped=0,beeps=0,result;
 const track={onended:null,stop(){stopped++;}};
 const stream={getTracks:()=>[track]};
 class MockRecorder{static isTypeSupported(){return true;}constructor(s){this.stream=s;this.mimeType='audio/mp4';this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}}
 const original=new Map();function global(name,value){original.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,value});}
 t.after(()=>{for(const [name,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 class Sound{state='running';async resume(){}createOscillator(){return{frequency:{value:0},connect(){},start(){beeps++;},stop(){}};}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}}
 global('window',{AudioContext:Sound});global('document',{hidden:false});global('MediaRecorder',MockRecorder);
 global('navigator',{mediaDevices:{getUserMedia:async()=>stream}});
 const r=new VoiceRecorder({onStop:(blob,reason)=>result={blob,reason},onTick(){},onNotice(){}});
 await r.start();t.mock.timers.tick(179999);assert.equal(r.active,true);assert.equal(result,undefined);t.mock.timers.tick(1);assert.equal(r.active,false);assert.equal(result.reason,'limit');assert.equal(result.blob.size,5);assert.equal(beeps,1);assert.equal(stopped,1);assert.deepEqual(r.chunks,[]);assert.equal(r.recorder,null);r.stop();assert.equal(beeps,1);
 await r.start();assert.equal(r.active,true);r.stop('manual');assert.equal(result.reason,'manual');assert.equal(beeps,1);
});
