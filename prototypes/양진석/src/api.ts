import {Platform} from 'react-native';
import {audioData} from './media';
import type {Entry} from './types';
import {words} from './preferences';
import {effectiveText} from './quality.mjs';
import {searchEntries} from './recall.mjs';
export const selfTest=Platform.OS==='web'&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('selftest');
// Web uses its own HTTPS origin so iPhones never request their own localhost.
export const API=Platform.OS==='web'?'':(process.env.EXPO_PUBLIC_API_URL||'http://127.0.0.1:8787');
async function request(path:string,body?:unknown,timeoutMs=180000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(API+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'처리하지 못했어요. 원본은 기기에 남아 있어요.');return result;}finally{clearTimeout(timer);}}
export async function health(){return request('/api/status',undefined,5000);}
export async function transcribe(entry:Entry,purpose='diary'){
 if(Platform.OS!=='web')return request('/api/transcribe',{audio:await audioData(entry.audioUri!),mime:entry.audioMime});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90_000);
 try{
  const audio=await(await fetch(entry.audioUri!)).blob();const mime=(entry.audioMime||audio.type).split(';')[0];
  const form=new FormData();form.append('entryId',entry.id);form.append('file',audio,`diary.${mime.includes('webm')?'webm':mime.includes('wav')?'wav':'m4a'}`);
  form.append('keywords',JSON.stringify(words()));form.append('purpose',purpose);
  const response=await fetch('/api/transcribe',{method:'POST',headers:{'X-Malro-Request':'transcribe-v1'},body:form,signal:controller.signal});
  let data;try{data=await response.json();}catch{throw new Error('전사 서버에 연결하지 못했어요. 원본은 그대로 있어요.');}
  if(!response.ok)throw new Error(data.error||'전사를 완료하지 못했어요. 원본으로 다시 시도해주세요.');
  return data;
 }catch(e:any){if(e.name==='AbortError'||e.name==='TypeError')throw new Error('전사 연결이 끊겼어요. 원본은 보관되어 있으니 앱을 열어 다시 시도해주세요.');throw e;}
 finally{clearTimeout(timer);}
}
async function aiRequest(path:string,body:unknown){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),50000);try{const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json','X-Malro-Request':'transcribe-v1'},body:JSON.stringify(body),signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'AI 처리에 실패했어요.');return result;}finally{clearTimeout(timer);}}
export async function polish(entry:Entry){return aiRequest('/api/polish',{text:effectiveText(entry)});}
export async function correction(command:string,entry:Entry){return aiRequest('/api/corrections',{command,text:effectiveText(entry),title:entry.title});}
export async function ask(query:string,entries:Entry[]){const local=searchEntries(entries,query);const candidates=local.items.slice(0,8);if(!candidates.length)return {ids:[],answer:'기기 검색에서 관련 후보를 찾지 못했어요. 날짜나 기억나는 단어를 더해보세요.'};return aiRequest('/api/search',{query,entries:candidates.map((e:Entry)=>({id:e.id,text:effectiveText(e).slice(0,2500),createdAt:e.createdAt}))});}
