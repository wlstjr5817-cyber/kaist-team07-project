import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as tick} from 'node:timers/promises';
import {createTranscriptionApi} from '../worker/transcription.mjs';
import {createWorker} from '../worker/index.mjs';
import {createBackgroundProcessor,saveFirst} from '../src/background.mjs';
import {makeEntry} from '../src/domain.mjs';
const origin='https://diary.example';
const key='unit-test-only-key';
const env={OPENAI_API_KEY:key};
const mp4=new Uint8Array([0,0,0,20,102,116,121,112,77,52,65,32,0,0,0,0]);
function request({path='/api/transcribe',method='POST',user='owner',originHeader=origin,marker='transcribe-v1',file=new Blob([mp4],{type:'audio/mp4'}),id='test-entry'}={}){
 const headers=new Headers();if(user)headers.set('oai-authenticated-user-id',user);if(method==='POST'){if(originHeader)headers.set('origin',originHeader);if(marker)headers.set('x-malro-request',marker);}
 const form=new FormData();form.set('entryId',id);if(file)form.set('file',file,'recording.m4a');
 return new Request(origin+path,{method,headers,...(method==='POST'?{body:form}:{})});
}
const text=async response=>(await response.json()).text;
test('status never discloses secrets and refuses an unauthenticated caller',async()=>{
 const api=createTranscriptionApi();assert.equal((await api(request({path:'/api/status',method:'GET',user:''}),env)).status,401);
 const response=await api(request({path:'/api/status',method:'GET'}),env);const body=await response.text();assert.equal(JSON.parse(body).speech.ready,true);assert.ok(!body.includes(key));assert.equal(response.headers.get('cache-control'),'no-store');
 const missing=await api(request({path:'/api/status',method:'GET'}),{});assert.equal((await missing.json()).speech.ready,false);
});
test('missing key returns immediately without sending audio anywhere',async()=>{
 let calls=0;const api=createTranscriptionApi({fetcher:()=>{calls++;throw Error();}});assert.equal((await api(request(),{})).status,503);assert.equal(calls,0);
});
test('cross-site, missing origin, missing marker and anonymous requests cannot spend credits',async()=>{
 let calls=0;const api=createTranscriptionApi({fetcher:()=>{calls++;throw Error();}});
 for(const config of [{originHeader:'https://foreign.example'},{originHeader:''},{marker:''},{user:''}])assert.ok([401,403].includes((await api(request(config),env)).status));assert.equal(calls,0);
});
test('unsupported method, malformed body, missing file and forged audio are rejected',async()=>{
 const api=createTranscriptionApi({fetcher:()=>{throw Error('must not reach provider');}});
 assert.equal((await api(request({method:'GET'}),env)).status,405);
 assert.equal((await api(request({file:null}),env)).status,400);
 assert.equal((await api(request({file:new Blob(['<script>not an audio file</script>'],{type:'audio/mp4'})}),env)).status,415);
 const bad=request();bad.headers.set('content-type','application/json');assert.equal((await api(bad,env)).status,415);
});
test('oversized streaming body is rejected before provider upload',async()=>{
 const api=createTranscriptionApi({fetcher:()=>{throw Error('must not reach provider');}});
 const headers=request().headers;const oversized=new Request(origin+'/api/transcribe',{method:'POST',headers,body:new Uint8Array(12_000_001)});assert.equal((await api(oversized,env)).status,413);
});
test('uploads the actual audio to the fixed provider URL with server-only authentication',async()=>{
 const api=createTranscriptionApi({fetcher:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(options.headers.Authorization,'Bearer '+key);
  assert.equal(options.body.get('model'),'gpt-transcribe');assert.equal(options.body.get('file').name,'diary.m4a');assert.deepEqual(new Uint8Array(await options.body.get('file').arrayBuffer()),mp4);
  return Response.json({text:'호주 바다를 보며 기분이 좋았어.'});
 }});
 const result=await api(request(),env);assert.equal(result.status,200);assert.equal(await text(result),'호주 바다를 보며 기분이 좋았어.');
});
test('upstream authentication and billing errors are actionable without leaking provider messages or keys',async()=>{
 for(const [provider,status] of [[401,503],[403,503],[429,429],[500,502]]){
  const api=createTranscriptionApi({fetcher:async()=>new Response(key,{status:provider})});const response=await api(request(),env);assert.equal(response.status,status);assert.ok(!(await response.text()).includes(key));
 }
});
test('malformed and empty transcripts never become a successful diary body',async()=>{
 for(const result of ['not-json',JSON.stringify({text:''}),JSON.stringify({text:'x'.repeat(200_001)})]){
  const api=createTranscriptionApi({fetcher:async()=>new Response(result)});assert.ok([422,502].includes((await api(request(),env)).status));
 }
});
test('network timeout is bounded and leaves retry messaging',async()=>{
 const api=createTranscriptionApi({timeoutMs:20,fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))});
 const keepAlive=setTimeout(()=>{},200);try{assert.equal((await api(request(),env)).status,504);}finally{clearTimeout(keepAlive);}
});
test('concurrent same-user upload is rejected and the slot is released after failure',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);let calls=0;
 const api=createTranscriptionApi({fetcher:async()=>{calls++;await pending;return new Response('failed',{status:500});}});
 const first=api(request(),env);await tick();assert.equal((await api(request(),env)).status,429);release();await first;
 assert.equal((await api(request(),env)).status,502);assert.equal(calls,2);
});
test('Worker serves packaged app and real SVG UI bundle without exposing source or enabling CORS',async()=>{
 const worker=createWorker({'/hw6/index.html':{type:'text/html',base64:btoa('<html>diary</html>')},'/index.html':{type:'text/html',base64:btoa('<html>archive</html>')}});
 const page=await worker.fetch(new Request(origin+'/'),{});assert.equal(await page.text(),'<html>archive</html>');
 assert.equal(await(await worker.fetch(new Request(origin+'/archive'),{})).text(),'<html>archive</html>');
 assert.equal((await worker.fetch(new Request(origin+'/worker/transcription.mjs'),{})).status,404);
 assert.equal((await worker.fetch(request({user:''}),env)).headers.get('access-control-allow-origin'),null);
 assert.equal(await(await worker.fetch(new Request(origin+'/',{method:'HEAD'}),{})).text(),'');
});
test('cloud queue never automatically uploads old recordings; an explicit request opts in',async()=>{
 const rows=new Map();const store={async get(id){return rows.get(id);},async update(id,fn){const e=rows.get(id);if(!e)return null;const v=fn(e);if(v)rows.set(id,v);return v;}};
 const old=makeEntry('',{audioUri:'old-recording'});rows.set(old.id,old);let calls=0;
 const worker=createBackgroundProcessor({store,requireRequest:true,transcribe:async()=>{calls++;return {text:'예전 기록을 글로 옮겼어.'};}});worker.setReady(true);worker.enqueue(old);await tick();assert.equal(calls,0);
 worker.enqueue(old,true);await tick();assert.equal(calls,1);assert.equal(rows.get(old.id).audioUri,'old-recording');
});
test('save → server transcription → local title completes while original and later edits stay safe',async()=>{
 const rows=new Map(),events=[],tasks=[];let release,uploaded,completed;const pending=new Promise(resolve=>release=resolve),uploadStarted=new Promise(resolve=>uploaded=resolve),finished=new Promise(resolve=>completed=resolve);
 const store={async get(id){return rows.get(id);},async save(e){rows.set(e.id,e);events.push('committed');return e;},async update(id,fn){const e=rows.get(id);if(!e)return null;const v=fn(e);if(v)rows.set(id,v);return v;}};
 const api=createTranscriptionApi({fetcher:async()=>{events.push('upload');uploaded();await pending;return Response.json({text:'오늘은 평범했어. 저녁에 바라던 회사의 최종 합격 연락을 받아 정말 기뻤어.'});}});
 const worker=createBackgroundProcessor({store,requireRequest:true,onEntry:e=>{if(e.status==='ready')completed();},schedule:fn=>tasks.push(fn),transcribe:async()=>{const response=await api(request(),env);assert.equal(response.status,200);return response.json();}});worker.setReady(true);
 const entry=makeEntry('',{audioUri:'original',transcriptionRequested:true});await saveFirst(entry,{save:store.save,publish:()=>events.push('visible'),enqueue:e=>worker.enqueue(e),schedule:fn=>tasks.push(fn)});
 assert.deepEqual(events,['committed','visible']);tasks.shift()();await uploadStarted;assert.deepEqual(events,['committed','visible','upload']);
 release();await finished;await tick();for(const task of tasks.splice(0))await task();const done=rows.get(entry.id);assert.equal(done.status,'ready');assert.equal(done.audioUri,'original');assert.match(done.rawText,/최종 합격/);assert.ok(Array.from(done.title).length<=25);assert.match(done.title,/합격/);
});
