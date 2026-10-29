// Share the existing photo/search library. This module never stores audio.
export function createLibrary({indexedDB=globalThis.indexedDB,testing=false,now=()=>new Date()}={}){
 const connections=new Map();let migration;
 const libraryName=testing?'malhaedum-qa-v1':'malhaedum-v1';
 const previousName=testing?'malro-text-diary-qa-v1':'malro-text-diary-v1';
 function open(name,store){if(!connections.has(name))connections.set(name,new Promise((resolve,reject)=>{
  const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store,{keyPath:'id'});};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>{connections.delete(name);reject(r.error);};r.onblocked=()=>{connections.delete(name);reject(Error('다른 일기 탭을 닫고 다시 열어주세요.'));};
 }));return connections.get(name);}
 async function all(name,store){const d=await open(name,store);return new Promise((resolve,reject)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function put(name,store,value,onlyMissing=false){const d=await open(name,store);return new Promise((resolve,reject)=>{
  const tx=d.transaction(store,'readwrite'),s=tx.objectStore(store);
  if(onlyMissing){const r=s.get(value.id);r.onsuccess=()=>{if(!r.result)s.put(value);};}else s.put(value);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('저장하지 못했어요.'));tx.onabort=()=>reject(tx.error||Error('저장이 취소되었어요.'));
 });}
 function record({id,date,text,createdAt}){
  if(typeof text!=='string'||!text.trim())throw Error('빈 일기는 저장할 수 없어요.');
  if(typeof id!=='string'||!id)throw Error('일기를 식별하지 못했어요.');
  const created=createdAt&&Number.isFinite(Date.parse(createdAt))?createdAt:now().toISOString();
  const value=text.trim();return {id:id.startsWith('hw6:')?id:`hw6:${id}`,createdAt:created,date,text:value,rawText:value,title:Array.from(value.split('\n')[0]).slice(0,25).join(''),titleSource:'manual',titleStatus:'ready',status:'ready',photos:[],duration:0,edited:true,version:1,demo:false,aiRequested:false,transcriptionRequested:false,hw6:true};
 }
 async function migrate(){if(migration)return migration;migration=(async()=>{let count=0;for(const old of await all(previousName,'diaries')){if(old.libraryMigration===1)continue;await put(libraryName,'records',record(old),true);await put(previousName,'diaries',{...old,libraryMigration:1});count++;}return count;})().catch(e=>{migration=null;throw e;});return migration;}
 async function save(input){const value=record(input);await put(libraryName,'records',value);return value;}
 async function list(){await migrate();return(await all(libraryName,'records')).filter(r=>r.hw6).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 return {save,list,migrate};
}
