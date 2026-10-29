import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as tick} from 'node:timers/promises';
import {automaticTitle,fallbackTitle,groupEntries,makeEntry,revised} from '../src/domain.mjs';
import {createBackgroundProcessor,saveFirst} from '../src/background.mjs';
const date='2026-10-27T12:00:00Z';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function memory(){const records=new Map();return {records,async get(id){return records.get(id);},async save(e){records.set(e.id,e);return e;},async update(id,fn){const current=records.get(id);if(!current)return null;const next=fn(current);if(next)records.set(id,next);return next;}};}
test('saveFirst publishes committed original before starting any slow speech or title job',async()=>{
 const store=memory(),tasks=[],events=[],speech=deferred();
 const worker=createBackgroundProcessor({store,schedule:fn=>tasks.push(fn),transcribe:async()=>{events.push('speech');return speech.promise;},onEntry:e=>events.push(e.status)});worker.setReady(true);
 const entry=makeEntry('',{createdAt:date,audioUri:'data:audio/mp4;base64,b3JpZ2luYWw='});
 await saveFirst(entry,{save:async e=>{await store.save(e);events.push('committed');return e;},publish:()=>events.push('visible'),enqueue:e=>worker.enqueue(e),schedule:fn=>tasks.push(fn)});
 assert.deepEqual(events,['committed','visible']);assert.equal((await store.get(entry.id)).title,'10월 27일 저녁 일기');
 tasks.shift()();await tick();assert.deepEqual(events,['committed','visible','processing','speech']);
 const another=makeEntry('두 번째 일기도 바로 저장해');await store.save(another);assert.equal(store.records.size,2);
 speech.resolve({text:'오늘 친구랑 산책해서 기분이 좋았어. 호주 여행이 생각났어.'});await tick();
 assert.equal((await store.get(entry.id)).status,'ready');assert.equal((await store.get(entry.id)).titleSource,'date');
 for(const task of tasks.splice(0))await task();
 const done=await store.get(entry.id);assert.equal(done.title,'오늘 친구랑 산책해서 기분이 좋았어');assert.equal(done.titleSource,'auto');assert.equal(done.audioUri,entry.audioUri);
});
test('failed original save does not publish success or enqueue any processing',async()=>{
 let touched=false;await assert.rejects(saveFirst(makeEntry(),{save:async()=>{throw new Error('QuotaExceededError');},publish:()=>{touched=true;},enqueue:()=>{touched=true;}}));assert.equal(touched,false);
});
test('offline queue preserves original, then resumes when speech service becomes ready',async()=>{
 const store=memory();let calls=0;const worker=createBackgroundProcessor({store,transcribe:async()=>{calls++;return {text:'운동하고 집에 왔어.'};}});
 const e=makeEntry('',{audioUri:'original'});await store.save(e);worker.enqueue(e);await tick();assert.equal(calls,0);assert.equal((await store.get(e.id)).status,'recorded');
 worker.setReady(true);await tick();assert.equal(calls,1);assert.equal((await store.get(e.id)).text,'운동하고 집에 왔어.');
});
test('transcription failure keeps audio and exposes retry state',async()=>{
 const store=memory();const e=makeEntry('',{audioUri:'original'});await store.save(e);const worker=createBackgroundProcessor({store,transcribe:async()=>{throw new Error('network unavailable');}});worker.setReady(true);worker.enqueue(e);await tick();assert.equal((await store.get(e.id)).audioUri,'original');assert.equal((await store.get(e.id)).status,'error');
});
test('a late transcript never overwrites a manually edited body or recreates a deletion',async()=>{
 for(const change of ['edit','delete']){const store=memory(),speech=deferred();const e=makeEntry('',{audioUri:'original'});await store.save(e);const worker=createBackgroundProcessor({store,transcribe:()=>speech.promise});worker.setReady(true);worker.enqueue(e);await tick();
  if(change==='edit')await store.update(e.id,current=>revised(current,{text:'내가 직접 쓴 문장',edited:true,status:'ready'}));else store.records.delete(e.id);
  speech.resolve({text:'뒤늦게 도착한 옛 전사'});await tick();assert.equal((await store.get(e.id))?.text,change==='edit'?'내가 직접 쓴 문장':undefined);
 }
});
test('manual title survives both transcription and delayed title jobs',async()=>{
 const store=memory(),speech=deferred(),tasks=[];const e=makeEntry('',{audioUri:'original'});await store.save(e);const worker=createBackgroundProcessor({store,transcribe:()=>speech.promise,schedule:fn=>tasks.push(fn)});worker.setReady(true);worker.enqueue(e);await tick();
 await store.update(e.id,c=>({...c,title:'내가 정한 제목',titleSource:'manual',titleStatus:'ready'}));speech.resolve({text:'호주 여행에서 바다를 봤어.'});await tick();for(const fn of tasks.splice(0))await fn();assert.equal((await store.get(e.id)).title,'내가 정한 제목');assert.match((await store.get(e.id)).text,/호주/);
 const typed=makeEntry('자동 제목을 붙일 문장');await store.save(typed);worker.enqueue(typed);await store.update(typed.id,c=>({...c,title:'수동 제목',titleSource:'manual'}));for(const fn of tasks.splice(0))await fn();assert.equal((await store.get(typed.id)).title,'수동 제목');
});
test('older title job cannot replace the title for newer body text',async()=>{
 const store=memory(),tasks=[];const e=makeEntry('어제의 이야기');await store.save(e);const worker=createBackgroundProcessor({store,transcribe:async()=>({text:''}),schedule:fn=>tasks.push(fn)});worker.enqueue(e);
 const changed=await store.update(e.id,c=>revised(c,{text:'수정한 오늘의 이야기',edited:true}));worker.enqueue(changed);for(const fn of tasks.splice(0))await fn();assert.equal((await store.get(e.id)).title,'수정한 오늘의 이야기');
});
test('speech jobs are serialized while independent saves remain available',async()=>{
 const store=memory(),first=deferred();let calls=0,active=0,max=0;const worker=createBackgroundProcessor({store,transcribe:async()=>{calls++;active++;max=Math.max(active,max);if(calls===1)await first.promise;active--;return {text:'완료된 전사'};}});worker.setReady(true);
 const a=makeEntry('',{audioUri:'a'}),b=makeEntry('',{audioUri:'b'});await store.save(a);worker.enqueue(a);await tick();await store.save(b);worker.enqueue(b);await tick();assert.equal(calls,1);assert.equal(store.records.size,2);first.resolve();await tick();await tick();assert.equal(calls,2);assert.equal(max,1);
});
test('automatic titles preserve negative and mixed feelings and never add absent facts',()=>{
 assert.equal(automaticTitle('기쁘지 않았어.'),'기쁘지 않았어');
 assert.equal(automaticTitle('친구 취업은 기쁘지만 나는 조금 속상해.'),'친구 취업은 기쁘지만 나는 조금 속상해');
 assert.equal(automaticTitle('3.5km를 걸었어. 피곤해.'),'3.5km를 걸었어');
 assert.equal(automaticTitle('음, 오늘 책을 읽었어.'),'오늘 책을 읽었어');
 const long='아주 긴 문장을 여러 단어로 길게 쓰고 있지만 끝까지 정리하지 못한 생각도 그대로 적어두려고 해';const title=automaticTitle(long);assert.ok(title.endsWith('…'));assert.ok(Array.from(title).length<=25);assert.ok(long.includes(title.replaceAll('…','')));
});
test('timeline groups by Korean calendar date and sorts days and entries newest first',()=>{
 const entries=[makeEntry('a',{id:'a',createdAt:'2026-10-26T14:59:00Z'}),makeEntry('b',{id:'b',createdAt:'2026-10-26T15:01:00Z'}),makeEntry('c',{id:'c',createdAt:'2026-10-26T15:02:00Z'})];
 const groups=groupEntries(entries);assert.deepEqual(groups.map(g=>g.key),['2026-10-27','2026-10-26']);assert.deepEqual(groups[0].data.map(e=>e.id),['c','b']);assert.equal(fallbackTitle('2026-10-26T15:01:00Z'),'10월 27일 새벽 일기');
});
