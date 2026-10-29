let opened:Promise<IDBDatabase>;
function db(){return opened??=new Promise((resolve,reject)=>{const name=new URLSearchParams(location.search).has('selftest')?'malhaedum-qa-v1':'malhaedum-v1';const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('records',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function all(){const d=await db();return new Promise<any[]>((res,rej)=>{const r=d.transaction('records').objectStore('records').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
export async function get(id:string){const d=await db();return new Promise<any>((res,rej)=>{const r=d.transaction('records').objectStore('records').get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
export async function write(value:any){const d=await db();return new Promise<void>((res,rej)=>{const tx=d.transaction('records','readwrite');tx.objectStore('records').put(value);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});}
export async function remove(key:string){const d=await db();return new Promise<void>((res,rej)=>{const tx=d.transaction('records','readwrite');tx.objectStore('records').delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}

export async function writeBatch(values:any[]){const d=await db();return new Promise<void>((res,rej)=>{const tx=d.transaction('records','readwrite');for(const value of values)tx.objectStore('records').put(value);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});}
