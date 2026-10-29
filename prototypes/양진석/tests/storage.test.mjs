import test from 'node:test';import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createLibrary} from '../public/hw6/library.mjs';
import {searchEntries} from '../src/recall.mjs';
async function access(factory,name,store,action){const d=await new Promise((resolve,reject)=>{const r=factory.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore(store,{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return new Promise((resolve,reject)=>{const tx=d.transaction(store,'readwrite');const result=action(tx.objectStore(store));tx.oncomplete=()=>{d.close();resolve(result?.result);};tx.onabort=()=>reject(tx.error);});}
test('P0 text is searchable in original library with added photos, without audio',async()=>{
 const indexedDB=new IDBFactory(),library=createLibrary({indexedDB});
 const saved=await library.save({id:'one',date:'2026-10-29',text:'진석과 은행나무 사진을 찍었다.',audio:new Blob(['not saved'])});
 const reopened=await createLibrary({indexedDB}).list();assert.equal(reopened[0].id,'hw6:one');assert.equal(reopened[0].text,saved.text);assert.equal(saved.edited,true);assert.equal(saved.aiRequested,false);assert.equal('audio'in saved,false);assert.equal('audioUri'in saved,false);
 const photo={id:'photo',uri:'data:image/png;base64,test'};await access(indexedDB,'malhaedum-v1','records',s=>s.put({...saved,photos:[photo]}));
 const results=searchEntries(await library.list(),'은행나무');assert.equal(results.items[0].id,saved.id);assert.deepEqual(results.items[0].photos,[photo]);
 assert.deepEqual(await createLibrary({indexedDB,testing:true}).list(),[]);
});
test('migration preserves photos/audio and edits, without duplicates or resurrected deletions',async()=>{
 const indexedDB=new IDBFactory(),library=createLibrary({indexedDB});
 await access(indexedDB,'malro-text-diary-v1','diaries',s=>s.put({id:'old',date:'2026-10-29',text:'이전 글'}));
 const existing={id:'hw6:old',text:'수정한 글',photos:[{id:'p',uri:'photo'}],audioUri:'old-audio'};
 await access(indexedDB,'malhaedum-v1','records',s=>s.put(existing));
 assert.equal(await library.migrate(),1);assert.deepEqual(await access(indexedDB,'malhaedum-v1','records',s=>s.get(existing.id)),existing);
 assert.equal((await access(indexedDB,'malro-text-diary-v1','diaries',s=>s.get('old'))).libraryMigration,1);
 await access(indexedDB,'malhaedum-v1','records',s=>s.delete(existing.id));
 assert.equal(await createLibrary({indexedDB}).migrate(),0);assert.deepEqual(await access(indexedDB,'malhaedum-v1','records',s=>s.getAll()),[]);
});
test('previous P0 text migrates once; blank and aborted writes reject',async t=>{
 const indexedDB=new IDBFactory(),library=createLibrary({indexedDB});
 await access(indexedDB,'malro-text-diary-v1','diaries',s=>s.put({id:'previous',date:'2026-10-29',createdAt:'2026-10-29T02:00:00.000Z',text:'앞서 저장한 일기'}));
 const rows=await library.list();assert.equal(rows.length,1);assert.equal(rows[0].text,'앞서 저장한 일기');assert.equal((await createLibrary({indexedDB}).list()).length,1);
 await assert.rejects(library.save({id:'empty',text:' '}),/빈 일기/);
 const original=IDBObjectStore.prototype.put;const failing=t.mock.method(IDBObjectStore.prototype,'put',function(...args){const result=original.apply(this,args);this.transaction.abort();return result;});
 await assert.rejects(library.save({id:'failed',text:'실패한 저장'}));failing.mock.restore();assert.equal((await library.list()).length,1);
});
