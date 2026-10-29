export const supported=false;
export function newRecordingTranscription(){return true;}
export function setNewRecordingTranscription(_enabled:boolean){}
export async function retainStorage(){return false;}
export async function storageInfo(){return {persistent:false,offlineReady:false,installed:false};}
export async function pickBackup():Promise<unknown|null>{throw new Error('백업 가져오기는 웹 앱에서 사용할 수 있어요.');}

export function openVoiceDiary(){return false;}
export function requestedEntry():string|null{return null;}
export async function migrateDiaryLibrary(){return 0;}
