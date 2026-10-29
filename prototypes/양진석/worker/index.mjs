import {createTranscriptionApi} from './transcription.mjs';
export function createWorker(assets,{fetcher,timeoutMs}={}){
 const api=createTranscriptionApi({fetcher,timeoutMs});
 return {async fetch(request,env={}){
  const response=await api(request,env);if(response)return response;
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const path=new URL(request.url).pathname;
  const asset=assets[path==='/'||path==='/archive'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404});
  const headers={'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':path.includes('/_expo/')?'private, max-age=31536000, immutable':'no-cache'};
  // Sites controls visitor authentication. No secret is embedded in these assets.
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers});
 }};
}
