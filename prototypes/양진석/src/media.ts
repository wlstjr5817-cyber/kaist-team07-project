import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
export async function persistentPhoto(uri:string){const ext=uri.split('.').pop()?.split('?')[0]||'jpg';const path=FileSystem.documentDirectory+'photo-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;await FileSystem.copyAsync({from:uri,to:path});return path;}
export async function audioData(uri:string){return FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64});}
export async function removeMedia(uris:string[]){for(const uri of uris)if(uri.startsWith(FileSystem.documentDirectory!))await FileSystem.deleteAsync(uri,{idempotent:true});}
export async function exportFile(data:unknown){const path=FileSystem.cacheDirectory+'malhaedum-export.json';await FileSystem.writeAsStringAsync(path,JSON.stringify(data,null,2));await Sharing.shareAsync(path,{mimeType:'application/json'});}
