import {useEffect,useRef,useState} from 'react';
export function useCapture(){
 const [recording,setRecording]=useState(false);const ref=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);const startTime=useRef(0);const cleanup=useRef<(()=>void)|null>(null);const fixture=useRef(false);
 useEffect(()=>()=>{const recorder=ref.current;if(recorder){recorder.onstop=null;recorder.onerror=null;recorder.ondataavailable=null;if(recorder.state!=='inactive')recorder.stop();recorder.stream.getTracks().forEach(t=>t.stop());}cleanup.current?.();},[]);
 function begin(stream:MediaStream){
  try{if(typeof MediaRecorder==='undefined')throw new Error('이 브라우저는 음성 녹음을 지원하지 않아요. 최신 Safari에서 열어주세요.');
   const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunks.current=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data);};ref.current=recorder;recorder.start(250);startTime.current=Date.now();setRecording(true);
  }catch(error){stream.getTracks().forEach(t=>t.stop());cleanup.current?.();throw error;}
 }
 async function start(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('마이크를 사용할 수 없어요. 아이폰에서는 HTTPS 테스트 주소를 Safari에서 열어주세요.');
  fixture.current=false;cleanup.current=null;begin(await navigator.mediaDevices.getUserMedia({audio:true}));
 }
 async function startFixture(){
  if(!new URLSearchParams(location.search).has('selftest'))throw new Error('개발 검증 모드에서만 사용할 수 있어요.');
  const context=new AudioContext();const source=context.createBufferSource();const destination=context.createMediaStreamDestination();
  cleanup.current=()=>{try{source.stop();}catch{}void context.close();};
  try{await context.resume();source.buffer=await context.decodeAudioData(await(await fetch('/qa-test.wav')).arrayBuffer());source.connect(destination);fixture.current=true;begin(destination.stream);source.start();}catch(e){cleanup.current?.();throw e;}
 }
 async function stop(){const recorder=ref.current;if(!recorder||recorder.state==='inactive')throw new Error('녹음이 중단됐어요. 다시 녹음해주세요.');
  return new Promise<{audioUri:string;audioMime:string;duration:number;title?:string}>((resolve,reject)=>{
   recorder.onerror=()=>{recorder.stream.getTracks().forEach(t=>t.stop());setRecording(false);cleanup.current?.();reject(new Error('녹음 파일을 완성하지 못했어요. 다시 시도해주세요.'));};
   recorder.onstop=()=>{recorder.stream.getTracks().forEach(t=>t.stop());setRecording(false);cleanup.current?.();const mime=recorder.mimeType.split(';')[0];const blob=new Blob(chunks.current,{type:mime});
    if(!blob.size)return reject(new Error('녹음 내용이 비어 있어요. 다시 시도해주세요.'));
    const reader=new FileReader();reader.onload=()=>resolve({audioUri:reader.result as string,audioMime:mime,duration:Math.max(1,Math.round((Date.now()-startTime.current)/1000)),...(fixture.current?{title:'[자동 검증] 합성 음성'}:{})});reader.onerror=()=>reject(new Error('녹음 파일을 읽지 못했어요.'));reader.readAsDataURL(blob);
   };recorder.stop();
  });
 }
 return {recording,start,stop,startFixture};
}
