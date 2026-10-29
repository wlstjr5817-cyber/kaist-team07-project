import test from 'node:test';import assert from 'node:assert/strict';
import {createTranscriptionApi} from '../worker/transcription.mjs';
import {languageTask} from '../worker/language.mjs';
const req=(path,body,headers={})=>new Request('https://diary.test'+path,{method:'POST',headers:{'origin':'https://diary.test','x-malro-request':'transcribe-v1','oai-authenticated-user-id':'test',...headers},body});
test('hosted API rejects unauthenticated callers and absent secrets',async()=>{const api=createTranscriptionApi();assert.equal((await api(new Request('https://diary.test/api/status'),{})).status,401);assert.equal((await api(req('/api/polish','{}',{'Content-Type':'application/json'}),{})).status,503);});
test('cleanup preserves required style constraints and sends store false',async()=>{
 let sent;const result=await languageTask('/api/polish',{text:'음… 진석이랑 밥 먹었어.'},{OPENAI_API_KEY:'test-only'},async(url,options)=>{sent=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/responses');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({text:'진석이랑 밥 먹었어.',title:'진석과 밥'})}]}]});},1000);
 assert.equal(sent.store,false);assert.equal(sent.model,'gpt-6-luna');assert.match(sent.instructions,/말끝/);assert.match(sent.instructions,/머뭇거림/);assert.match(sent.instructions,/교훈/);assert.equal(result.text,'진석이랑 밥 먹었어.');
});
test('failed or incomplete AI response is an error, not success',async()=>{await assert.rejects(languageTask('/api/polish',{text:'내 하루'},{OPENAI_API_KEY:'test-only'},async()=>Response.json({status:'incomplete'}),1000),/완료되지/);});
test('transcription calls actual audio endpoint with Korean hint',async()=>{
 let sent;const api=createTranscriptionApi({fetcher:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');sent=options.body;return Response.json({text:'오늘은 좋았어.'});}});const form=new FormData();form.set('entryId','segment-1');form.set('file',new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3,...Array(20).fill(0)])],{type:'audio/webm'}),'diary.webm');const response=await api(req('/api/transcribe',form),{OPENAI_API_KEY:'test-only'});assert.equal(response.status,200);assert.equal(sent.get('model'),'gpt-transcribe');assert.equal(sent.get('languages[]'),'ko');assert.equal((await response.json()).text,'오늘은 좋았어.');
});
test('transcription failure does not promise audio was saved',async()=>{const api=createTranscriptionApi();const f=new FormData();const r=await api(req('/api/transcribe',f),{});assert.doesNotMatch((await r.json()).error,/원본.*저장|원본.*보관/);});
