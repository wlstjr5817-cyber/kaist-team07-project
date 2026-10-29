import * as SQLite from 'expo-sqlite';
let opened:ReturnType<typeof SQLite.openDatabaseAsync>;
async function db(){if(!opened)opened=SQLite.openDatabaseAsync('malhaedum.db');const d=await opened;await d.execAsync('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL)');return d;}
export async function all(){return (await(await db()).getAllAsync<{payload:string}>('SELECT payload FROM records')).map(r=>JSON.parse(r.payload));}
export async function get(id:string){const row=await(await db()).getFirstAsync<{payload:string}>('SELECT payload FROM records WHERE id=?',id);return row?JSON.parse(row.payload):undefined;}
export async function write(value:any){await(await db()).runAsync('INSERT OR REPLACE INTO records (id,payload) VALUES (?,?)',value.id,JSON.stringify(value));}
export async function remove(key:string){await(await db()).runAsync('DELETE FROM records WHERE id=?',key);}

export async function writeBatch(values:any[]){const d=await db();await d.withTransactionAsync(async()=>{for(const value of values)await d.runAsync('INSERT OR REPLACE INTO records (id,payload) VALUES (?,?)',value.id,JSON.stringify(value));});}
