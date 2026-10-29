import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as tick} from 'node:timers/promises';
import {replacementPreview,applyCorrection,undoCorrection,normalizeWords} from '../src/corrections.mjs';
import {makeEntry,revised} from '../src/domain.mjs';
import {effectiveText,qualityPatch} from '../src/quality.mjs';
import {createBackgroundProcessor} from '../src/background.mjs';
import {createTranscriptionApi} from '../worker/transcription.mjs';
import {parseBackup} from '../src/backup.mjs';
import {searchEntries} from '../src/recall.mjs';
const entry=()=>makeEntry('정인이랑 친구원에 갔어.',{title:'정인과 친구원',audioUri:'original-audio',rawText:'최초 원문',photos:[{id:'photo',uri:'original-photo'}]});
test('explicit word edits update body/title, preserve raw audio/photos, and undo survives serialization',()=>{
 const e=entry(),p=replacementPreview(e,[{from:'정인',to:'정윤'},{from:'친구원',to:'식물원'}]);
 const changed=applyCorrection(e,p);assert.equal(changed.text,'정윤이랑 식물원에 갔어.');assert.equal(changed.title,'정윤과 식물원');assert.equal(changed.rawText,e.rawText);assert.equal(changed.audioUri,e.audioUri);assert.deepEqual(changed.photos,e.photos);
 const undo=undoCorrection(JSON.parse(JSON.stringify(changed)));assert.equal(undo.text,e.text);assert.equal(undo.title,e.title);assert.equal(undo.rawText,e.rawText);
});
test('word replacement is simultaneous, literal and does not execute regex',()=>{
 const e=makeEntry('A B a.b aXb');const p=replacementPreview(e,[{from:'A',to:'B'},{from:'B',to:'C'},{from:'a.b',to:'정윤'}]);assert.equal(p.text,'B C 정윤 aXb');
});
test('stale preview, later manual edits and deleted diary cannot be overwritten',()=>{
 const e=entry(),p=replacementPreview(e,[{from:'정인',to:'정윤'}]);assert.throws(()=>applyCorrection(revised(e,{text:'new'}),p));assert.throws(()=>applyCorrection(null,p));
 assert.throws(()=>undoCorrection(revised(applyCorrection(e,p),{text:'later'})));
});
test('ambiguous empty or absent replacements are rejected; titles remain under 25 characters',()=>{
 const e=entry();for(const pairs of [[],[{from:'없음',to:'다른'}],[{from:'정인',to:''}],[{from:'정인',to:'정인'}]])assert.throws(()=>replacementPreview(e,pairs));
 assert.ok(Array.from(replacementPreview(e,[{from:'정인',to:'아주 긴 이름을 가진 사람과 함께 기분 좋게 이야기하는 친구'}]).title).length<=25);
});
test('personal vocabulary is bounded and rejects markup or multiline tokens',()=>{
 assert.deepEqual(normalizeWords('정윤, 식물원, 정윤'),['정윤','식물원']);assert.deepEqual(normalizeWords(['<bad>','a\nb','정윤']),['정윤']);assert.equal(normalizeWords(Array.from({length:50},(_,i)=>'단어'+i)).length,40);
});
const origin='https://diary.example',env={OPENAI_API_KEY:'only-test-key'};
function req(path,body,headers={}){return new Request(origin+path,{method:'POST',headers:{'content-type':'application/json',origin,'x-malro-request':'transcribe-v1','oai-authenticated-user-id':'owner',...headers},body:JSON.stringify(body)});}
function provider(result){return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]});}
test('text endpoint uses Luna without reasoning or provider storage and one structured call',async()=>{
 let calls=0;const api=createTranscriptionApi({fetcher:async(url,opt)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const b=JSON.parse(opt.body);assert.equal(b.model,'gpt-6-luna');assert.equal(b.reasoning.effort,'none');assert.equal(b.store,false);assert.equal(b.text.format.strict,true);return provider({text:'정윤과 갔어.',title:'정윤과 산책'});}});
 const r=await api(req('/api/polish',{text:'정윤과 갔어'}),env);assert.equal(r.status,200);assert.equal(calls,1);
});
test('text endpoints reject anonymous and cross-origin requests and oversized bodies',async()=>{
 let calls=0;const api=createTranscriptionApi({fetcher:async()=>{calls++;return provider({});}});
 for(const h of [{'oai-authenticated-user-id':''},{origin:'https://other.example'},{'x-malro-request':''}])assert.ok([401,403].includes((await api(req('/api/polish',{text:'hello'},h),env)).status));
 assert.equal((await api(req('/api/polish',{text:'a'.repeat(100001)}),env)).status,413);assert.equal(calls,0);
});
test('hallucinated replacements, overlong title and incomplete response do not become successful writes',async()=>{
 let api=createTranscriptionApi({fetcher:async()=>provider({replacements:[{from:'없는 단어',to:'정윤'}]})});assert.equal((await api(req('/api/corrections',{text:'정인',title:'제목',command:'정인 바꿔'}),env)).status,502);
 api=createTranscriptionApi({fetcher:async()=>provider({text:'본문',title:'가'.repeat(26)})});assert.equal((await api(req('/api/polish',{text:'본문'}),env)).status,502);
 api=createTranscriptionApi({fetcher:async()=>Response.json({status:'incomplete',output:[]})});assert.equal((await api(req('/api/polish',{text:'본문'}),env)).status,502);
});
test('search never returns ids outside supplied candidates',async()=>{
 const api=createTranscriptionApi({fetcher:async()=>provider({ids:['a','fake','a'],answer:'a 일기'})});const r=await api(req('/api/search',{query:'산책',entries:[{id:'a',text:'산책했다'}]}),env);assert.deepEqual((await r.json()).ids,['a']);
});
test('transcription includes only validated Korean and personal vocabulary hints',async()=>{
 const api=createTranscriptionApi({fetcher:async(url,opt)=>{assert.deepEqual(opt.body.getAll('languages[]'),['ko']);assert.deepEqual(opt.body.getAll('keywords[]'),['정윤']);return Response.json({text:'정윤'});}});
 const form=new FormData();form.set('entryId','e');form.set('keywords','["정윤"]');form.set('file',new Blob([new Uint8Array([0,0,0,20,102,116,121,112,0,0,0,0])],{type:'audio/mp4'}),'e.m4a');
 const r=new Request(origin+'/api/transcribe',{method:'POST',headers:{origin,'x-malro-request':'transcribe-v1','oai-authenticated-user-id':'owner'},body:form});assert.equal((await api(r,env)).status,200);
});
function memory(e){let row=e;return {get:async()=>row,update:async(_id,fn)=>{if(!row)return null;const changed=fn(row);if(changed)row=changed;return changed;},current:()=>row,replace:e=>{row=e;}};}
test('transcript is persisted before slow AI, then manual edits win',async()=>{
 const e=makeEntry('',{audioUri:'audio',aiRequested:true,transcriptionRequested:true}),db=memory(e);let resolve,started;const signal=new Promise(r=>started=r);const wait=new Promise(r=>resolve=r);
 const bg=createBackgroundProcessor({store:db,requireRequest:true,transcribe:async()=>({text:'정인 산책'}),enrich:async()=>{started();return wait;}});bg.setReady(true);bg.enqueue(e);await signal;assert.equal(db.current().text,'정인 산책');assert.equal(db.current().status,'ready');
 db.replace(revised(db.current(),{text:'정윤 식물원',edited:true}));resolve({text:'AI late',title:'late'});await tick();assert.equal(db.current().text,'정윤 식물원');assert.notEqual(db.current().title,'late');
});
test('legacy text is never auto uploaded, and saved AI result is not repeatedly charged',async()=>{
 let calls=0;const old=makeEntry('old'),db=memory(old);const bg=createBackgroundProcessor({store:db,transcribe:async()=>({text:''}),enrich:async()=>{calls++;return {text:'정리',title:'제목'};}});bg.setReady(true);bg.enqueue(old);await tick();assert.equal(calls,0);
 db.replace({...old,aiRequested:true});bg.enqueue(db.current());await tick();assert.equal(calls,1);bg.enqueue(db.current());await tick();assert.equal(calls,1);assert.equal(qualityPatch(db.current()),null);
});
test('AI failure retains transcript and manual title; original raw text survives retranscription',async()=>{
 const e=makeEntry('old',{rawText:'first',audioUri:'audio',aiRequested:true,title:'내 제목',titleSource:'manual'}),db=memory(e);const bg=createBackgroundProcessor({store:db,transcribe:async()=>({text:'new transcript'}),enrich:async()=>{throw Error('AI unavailable');}});bg.setReady(true);bg.enqueue(e,true);await tick();assert.equal(db.current().text,'new transcript');assert.equal(db.current().rawText,'first');assert.equal(db.current().title,'내 제목');assert.equal(db.current().aiStatus,'error');
});
test('backup keeps AI text/title but never opts restored old records into uploads',()=>{
 const e=makeEntry('raw',{polishedText:'AI text',polishSourceText:'raw',aiSourceText:'raw',aiStatus:'ready',aiRequested:true,transcriptionRequested:true});const [restored]=parseBackup({version:3,entries:[e]});assert.equal(effectiveText(restored),'AI text');assert.equal(qualityPatch(restored),null);assert.equal(restored.aiRequested,undefined);assert.equal(restored.transcriptionRequested,undefined);
});
test('past visit search does not require travel vocabulary or exclude a visit followed by future wishes',()=>{
 const visited=makeEntry('오늘 정윤이랑 식물원에 갔는데 사람이 많았어. 꽃을 보니 기분이 좋았어. 다음에 다시 가고 싶어.',{id:'visited'});
 const plan=makeEntry('정윤이랑 식물원에 가고 싶어. 아직 안 갔어.',{id:'plan'});
 const result=searchEntries([visited,plan],'정윤이랑 식물원 갔던 일기');assert.deepEqual(result.items.map(e=>e.id),['visited']);
});
