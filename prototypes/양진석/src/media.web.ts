export async function persistentPhoto(uri:string){const blob=await(await fetch(uri)).blob();return new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result as string);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});}
export async function audioData(uri:string){if(uri.startsWith('data:'))return uri.split(',')[1];return (await persistentPhoto(uri)).split(',')[1];}
export async function removeMedia(_uris:string[]){}
export async function exportFile(data:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='말로일기-기록.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
