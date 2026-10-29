import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEntry,cleanText,canApply,revised,dateWindow,searchEntries,demoEntries} from '../src/domain.mjs';
const now=new Date('2026-10-27T10:00:00+09:00');
const samples=demoEntries(now);
test('cleanup preserves uncertainty and mixed emotions without inventing prose',()=>{
 const raw='  친구가 취업해서  기쁜데\n나만 뒤처진 것 같기도 해.  ';
 const e=makeEntry(raw);assert.equal(e.rawText,raw);assert.equal(e.text,'친구가 취업해서 기쁜데\n나만 뒤처진 것 같기도 해.');
 assert.equal(cleanText('좋지 않았어.'),'좋지 않았어.');
});
test('late transcription cannot resurrect a deleted entry or overwrite edits',()=>{
 const e=makeEntry();assert.equal(canApply(null,e.version),false);assert.equal(canApply(revised(e,{text:'직접 수정',edited:true}),e.version),false);assert.equal(canApply(e,1),true);
});
test('last month boundaries use Korean calendar, including year change',()=>{
 const w=dateWindow('지난달',new Date('2026-01-01T00:30:00+09:00'));
 assert.equal(w.start.toISOString(),'2025-11-30T15:00:00.000Z');assert.equal(w.end.toISOString(),'2025-12-31T15:00:00.000Z');
});
test('last week is the previous Monday through Sunday, not a rolling week',()=>{
 const w=dateWindow('지난주',now);assert.equal(w.start.toISOString(),'2026-10-18T15:00:00.000Z');assert.equal(w.end.toISOString(),'2026-10-25T15:00:00.000Z');
});
test('same-day search includes Korean midnight and excludes next midnight',()=>{
 const es=['2026-10-26T14:59:59Z','2026-10-26T15:00:00Z','2026-10-27T14:59:59Z','2026-10-27T15:00:00Z'].map((createdAt,i)=>makeEntry('오늘의 일',{id:String(i),createdAt}));
 assert.deepEqual(searchEntries(es,'오늘',now).items.map(e=>e.id),['2','1']);
});
const cases=[
 ['지난달 즐거웠던 순간',['demo-10','demo-20'],['demo-0']],
 ['지난달에 내가 즐거웠던 순간이 언제였지?',['demo-10'],['demo-0']],
 ['호주 여행 때 기록',['demo-0','demo-20'],['demo-6']],
 ['발표 끝나고 뿌듯했던 날',['demo-1'],['demo-7']],
 ['친구',['demo-2','demo-4'],['demo-1']],
 ['면접',['demo-9'],['demo-0']],
 ['걱정',['demo-9','demo-22'],['demo-0']],
 ['편안',['demo-3','demo-11'],['demo-24']],
 ['서운',['demo-19'],['demo-0']],
 ['피곤',['demo-5','demo-24'],['demo-0']],
 ['복잡',['demo-2'],['demo-0']],
 ['운동',['demo-17'],['demo-1']],
 ['칭찬',['demo-26'],['demo-19']],
 ['시드니',['demo-10'],['demo-0']],
 ['엄마',['demo-11'],['demo-4']],
 ['도서관',['demo-23'],['demo-0']],
 ['책',['demo-23'],['demo-9']],
 ['공룡 우주여행',[],samples.map(e=>e.id)],
 ['오늘',['demo-0'],['demo-1']],
 ['어제',['demo-1'],['demo-0']],
];
for(const [q,include,exclude] of cases)test(`basic recall: ${q}`,()=>{const ids=searchEntries(samples,q,now).items.map(e=>e.id);for(const id of include)assert.ok(ids.includes(id),`missing ${id}`);for(const id of exclude.flat())assert.ok(!ids.includes(id),`unexpected ${id}`);});
