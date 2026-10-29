import {createLibrary} from '../public/hw6/library.mjs';
export const supported=true;
export function newRecordingTranscription(){try{return localStorage.getItem('malro-transcribe-new')!=='off';}catch{return true;}}
export function setNewRecordingTranscription(enabled:boolean){try{localStorage.setItem('malro-transcribe-new',enabled?'on':'off');}catch{}}
export function installed(){return window.matchMedia('(display-mode: standalone)').matches||!!(navigator as any).standalone;}
export async function retainStorage(){return navigator.storage?.persist?await navigator.storage.persist():false;}
export async function storageInfo(){const persistent=await navigator.storage?.persisted?.()||false;const offlineReady=!!(navigator.serviceWorker?.controller);return {persistent,offlineReady,installed:installed()};}
export async function pickBackup():Promise<unknown|null>{return new Promise((resolve,reject)=>{const el=document.createElement('input');el.type='file';el.accept='.json,application/json';el.style.display='none';document.body.append(el);const clean=()=>el.remove();el.oncancel=()=>{clean();resolve(null);};el.onchange=async()=>{try{const f=el.files?.[0];if(!f){resolve(null);return;}if(f.size>150_000_000)throw new Error('150MB 이하의 백업 파일을 선택해주세요.');resolve(JSON.parse(await f.text()));}catch(e){reject(e);}finally{clean();}};el.click();});}

export function openVoiceDiary(){location.assign('/hw6/index.html?compose=1'+(new URLSearchParams(location.search).has('selftest')?'&test=1':''));return true;}
export function requestedEntry(){return new URLSearchParams(location.search).get('entry');}
export function migrateDiaryLibrary(){return createLibrary({indexedDB,testing:new URLSearchParams(location.search).has('selftest')}).migrate();}
