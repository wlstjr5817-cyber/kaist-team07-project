let opened;
function db(){return opened??=new Promise((resolve,reject)=>{
  const r=indexedDB.open(new URLSearchParams(location.search).has('test')?'malro-text-diary-qa-v1':'malro-text-diary-v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('diaries',{keyPath:'id'});
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>{opened=null;reject(r.error);};
  r.onblocked=()=>{opened=null;reject(Error('다른 탭을 닫고 다시 시도해주세요.'));};
});}
export async function list(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('diaries').objectStore('diaries').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));r.onerror=()=>reject(r.error);});}
export async function save({id,date,text}){
  if(!text.trim())throw Error('빈 일기는 저장할 수 없어요.');
  const record={id,date,text:text.trim(),createdAt:new Date().toISOString()};
  const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('diaries','readwrite');tx.objectStore('diaries').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return record;
}
