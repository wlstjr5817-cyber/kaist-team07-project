import test from 'node:test';import assert from 'node:assert/strict';
import {DiarySession,splitText,localDay,SEGMENT_MS} from '../public/hw6/core.mjs';
const blob=()=>new Blob(['audio']);
test('short recordings, append order and explicit finalization',async()=>{
 let n=0;const s=new DiarySession({transcribe:async()=>`구간 ${++n}`,polish:async t=>t});
 const a=s.reserve();await s.enqueue(a,blob());assert.equal(s.stage,'record');const b=s.reserve();await s.enqueue(b,blob());assert.equal(s.segments.length,2);await s.finish();assert.equal(s.draft,'구간 1\n\n구간 2');assert.equal(s.stage,'edit');
});
test('replacement failure keeps previous text and requests a decision',async()=>{
 let fail=false;const s=new DiarySession({transcribe:async()=>{if(fail)throw Error('offline');return '내 생각';},polish:async t=>t});
 const a=s.reserve();await s.enqueue(a,blob());fail=true;s.reserve(a);await s.enqueue(a,blob());assert.equal(s.raw(),'내 생각');assert.equal(s.segments.length,1);assert.deepEqual(await s.finish(),{needsDecision:true});assert.equal(s.stage,'record');await s.finish(true);assert.equal(s.draft,'내 생각');
});
test('successful replacement replaces only selected segment',async()=>{
 const texts=['첫 글','두번째 글','수정 첫 글'];const s=new DiarySession({transcribe:async()=>texts.shift(),polish:async t=>t});for(let i=0;i<2;i++){const id=s.reserve();await s.enqueue(id,blob());}s.reserve(s.segments[0].id);await s.enqueue(s.segments[0].id,blob());assert.equal(s.raw(),'수정 첫 글\n\n두번째 글');
});
test('transcription queue waits and never reorders on finish',async()=>{
 let release,calls=0;const wait=new Promise(r=>release=r);const s=new DiarySession({transcribe:async()=>{const i=++calls;if(i===1)await wait;return String(i);},polish:async t=>t});const a=s.reserve();s.enqueue(a,blob());const b=s.reserve();s.enqueue(b,blob());await Promise.resolve();assert.equal(calls,1);const finished=s.finish();assert.equal(s.stage,'waiting');release();await finished;assert.equal(s.draft,'1\n\n2');assert.equal(s.pending,0);
});
test('empty recognition cannot fabricate diary',async()=>{const s=new DiarySession({transcribe:async()=>'',polish:async()=>assert.fail('must not call')});const a=s.reserve();await s.enqueue(a,blob());assert.equal(s.segments[0].status,'error');await assert.rejects(s.finish(true),/변환된 글/);});
test('failed cleanup keeps whole original even when an earlier chunk succeeded',async()=>{
 let calls=0;const s=new DiarySession({transcribe:async()=>'',polish:async()=>{if(++calls===2)throw Error('timeout');return 'changed';}});s.draft='가'.repeat(17000);const original=s.draft;await s.clean();assert.equal(s.draft,original);assert.equal(s.stage,'edit');assert.equal(s.polishError,'timeout');
});
test('retry uses current user edits rather than old transcript',async()=>{const s=new DiarySession({transcribe:async()=>'',polish:async t=>t+'!'});s.draft='이름은 진석';await s.clean();assert.equal(s.draft,'이름은 진석!');});
test('large text has no omission, emoji is not split',()=>{const input=('가나 🙂 다라\n').repeat(5000);const parts=splitText(input);assert.equal(parts.join(''),input);assert.ok(parts.every(p=>p.length<=8000));assert.ok(parts.every(p=>!/[\uD800-\uDBFF]$/.test(p)));});
test('three minutes applies to a segment and local date uses local fields',()=>{assert.equal(SEGMENT_MS,180000);assert.equal(localDay(new Date(2026,9,29,23,59)),'2026-10-29');});
