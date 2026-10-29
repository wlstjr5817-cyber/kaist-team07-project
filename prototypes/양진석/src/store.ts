import * as db from './db';
import {parseBackup,missingRecords} from './backup.mjs';
import type {Entry} from './types';
let queue=Promise.resolve();
function serial<T>(fn:()=>Promise<T>):Promise<T>{const next=queue.then(fn);queue=next.then(()=>{},()=>{});return next;}
export function list(){return serial(async()=>((await db.all()) as Entry[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
export function get(id:string){return serial(()=>db.get(id) as Promise<Entry|undefined>);}
export function save(entry:Entry){return serial(async()=>{await db.write(entry);return entry;});}
export function update(id:string,fn:(entry:Entry)=>Entry|null){return serial(async()=>{const current=await db.get(id) as Entry|undefined;if(!current)return null;const changed=fn(current);if(changed)await db.write(changed);return changed;});}
export function drop(id:string){return serial(()=>db.remove(id));}

export function restoreBackup(input:unknown){return serial(async()=>{const incoming=parseBackup(input);const existing=await db.all();const added=missingRecords(existing,incoming);await db.writeBatch(added);return {added:added.length,skipped:incoming.length-added.length,entries:[...existing,...added] as Entry[]};});}
