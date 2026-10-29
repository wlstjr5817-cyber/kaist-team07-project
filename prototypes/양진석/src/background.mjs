import {qualityPatch} from './quality.mjs';
import {automaticTitle,canApply,cleanText,revised} from './domain.mjs';

// Persistence and UI publication finish before any speech/title work is scheduled.
export async function saveFirst(entry,{save,publish,enqueue,schedule=fn=>setTimeout(fn,0)}){
 const saved=await save(entry);publish(saved);schedule(()=>enqueue(saved));return saved;
}

export function createBackgroundProcessor({store,transcribe,enrich=/** @type {null | ((entry:any)=>Promise<any>)} */(null),onEntry=(_entry)=>{},onError=(_error)=>{},schedule=fn=>setTimeout(fn,0),requireRequest=false}){
 let ready=false,running=false;const queue=new Map();const active=new Set();
 const publish=e=>{if(e)onEntry(e);return e;};
 async function enrichLater(entry){
  if(!entry||!enrich||!entry.aiRequested||entry.edited||!entry.text||entry.aiStatus==='ready'||entry.aiStatus==='error')return;
  const version=entry.version;
  const started=publish(await store.update(entry.id,e=>canApply(e,version)?{...e,aiStatus:'processing'}:null));if(!started)return;
  try{const result=await enrich(entry);publish(await store.update(entry.id,e=>canApply(e,version)?{...e,polishedText:result.text,polishSourceText:e.text,aiSourceText:e.text,aiStatus:'ready',aiError:undefined,...(e.titleSource!=='manual'?{title:result.title,titleSource:'auto',titleStatus:'ready'}:{})}:null));}
  catch(error){publish(await store.update(entry.id,e=>canApply(e,version)?{...e,aiStatus:'error',aiError:error.message||'AI 정리를 완료하지 못했어요.'}:null));}
 }
 function titleLater(entry){
  if(!qualityPatch(entry))return;
  const version=entry.version,sourceText=entry.text;
  schedule(async()=>{try{
   publish(await store.update(entry.id,current=>{
    if(current.version!==version||current.text!==sourceText)return null;
    const patch=qualityPatch(current);return patch?{...current,...patch}:null;
   }));
  }catch(error){onError(error);}});
 }
 async function drain(){
  if(running||!ready)return;running=true;
  try{while(queue.size&&ready){
   const [id,force]=queue.entries().next().value;queue.delete(id);active.add(id);
   let entry;
   try{
    entry=await store.get(id);if(!entry||entry.demo||entry.edited)continue;
    if(entry.text&&!force){await enrichLater(entry);continue;}
    if(!entry.audioUri||(requireRequest&&!entry.transcriptionRequested&&!force))continue;
    const version=entry.version;
    const started=await store.update(id,e=>canApply(e,version)?{...e,status:'processing',error:undefined}:null);if(!started)continue;publish(started);
    const response=await transcribe(entry);const text=cleanText(response.text||'');if(!text)throw new Error('말소리를 찾지 못했어요. 원본을 듣거나 글로 수정해주세요.');
    const finished=publish(await store.update(id,e=>canApply(e,version)?revised(e,{text,rawText:e.rawText||response.text,status:'ready',error:undefined,aiStatus:undefined,aiSourceText:undefined,titleStatus:e.titleSource==='manual'?'ready':'pending'}):null));titleLater(finished);await enrichLater(finished);
   }catch(error){if(entry)publish(await store.update(id,e=>canApply(e,entry.version)?{...e,status:'error',error:error.message||'글로 옮기지 못했어요. 다시 시도할 수 있어요.'}:null));else onError(error);}
   finally{active.delete(id);}
  }}catch(error){onError(error);}finally{running=false;}
 }
 return {
  enqueue(entry,force=false){if(!entry)return;titleLater(entry);const needsAi=enrich&&entry.aiRequested&&entry.text&&!['ready','error'].includes(entry.aiStatus);if(!entry.demo&&!entry.edited&&(needsAi||(entry.audioUri&&(!requireRequest||entry.transcriptionRequested||force)&&(force||(!entry.text&&entry.status!=='error'))))&&!active.has(entry.id)){queue.set(entry.id,force);void drain();}},
  setReady(value){ready=value;if(ready)void drain();},
  titleLater,
 };
}
