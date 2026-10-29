import test from 'node:test';import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
test('only final text persists across reopening, test records are isolated, failed commits reject',async t=>{
 const oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),oldDB=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 Object.defineProperty(globalThis,'location',{configurable:true,writable:true,value:{search:'?test=1'}});
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});
 t.after(()=>{for(const [name,d]of [['location',oldLocation],['indexedDB',oldDB]])if(d)Object.defineProperty(globalThis,name,d);else delete globalThis[name];});
 const first=await import('../public/hw6/storage.mjs?first');
 await first.save({id:'one',date:'2026-10-29',text:'내가 고친 진석이라는 이름',audio:new Blob(['must not persist'])});
 const reopened=await import('../public/hw6/storage.mjs?reopened');const rows=await reopened.list();
 assert.equal(rows.length,1);assert.equal(rows[0].text,'내가 고친 진석이라는 이름');assert.deepEqual(Object.keys(rows[0]).sort(),['createdAt','date','id','text']);
 await assert.rejects(first.save({id:'empty',date:'2026-10-29',text:'   '}),/빈 일기/);
 const original=IDBObjectStore.prototype.put;
 const failing=t.mock.method(IDBObjectStore.prototype,'put',function(...args){const result=original.apply(this,args);this.transaction.abort();return result;});
 await assert.rejects(first.save({id:'aborted',date:'2026-10-29',text:'실패 기록'}));failing.mock.restore();
 assert.deepEqual((await first.list()).map(r=>r.id),['one']);
 globalThis.location={search:''};const personal=await import('../public/hw6/storage.mjs?personal');assert.deepEqual(await personal.list(),[]);
});
