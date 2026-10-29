import {normalizeWords} from './corrections.mjs';
const prefix=typeof location!=='undefined'&&new URLSearchParams(location.search).has('selftest')?'malro-qa-':'malro-';
function read(key:string){try{return localStorage.getItem(prefix+key);}catch{return null;}}
function write(key:string,value:string){try{localStorage.setItem(prefix+key,value);}catch{throw new Error('설정을 저장하지 못했어요. 저장 공간을 확인해주세요.');}}
export function words():string[]{try{return normalizeWords(JSON.parse(read('words')||'[]'));}catch{return [];}}
export function saveWords(value:string|string[]){const result=normalizeWords(value);write('words',JSON.stringify(result));return result;}
export function autoPolish(){return read('auto-polish')!=='off';}
export function setAutoPolish(value:boolean){write('auto-polish',value?'on':'off');}
