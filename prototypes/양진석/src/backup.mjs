const fail=()=>{throw new Error('말로일기 백업 형식이 아니거나 손상된 파일이에요. 기존 일기는 변경하지 않았어요.');};
const string=(v,max)=>typeof v==='string'&&v.length<=max;
const media=(v,type)=>string(v,30_000_000)&&new RegExp(`^data:${type}/[a-zA-Z0-9.+-]+(?:;[^,]*)?;base64,[A-Za-z0-9+/=\\r\\n]*$`).test(v);
export function parseBackup(input){
 if(!input||![1,2,3].includes(input.version)||!Array.isArray(input.entries)||input.entries.length>10000)fail();
 const seen=new Set();return input.entries.map(e=>{
  if(!e||!string(e.id,160)||!e.id||seen.has(e.id)||!string(e.createdAt,80)||!Number.isFinite(Date.parse(e.createdAt))||!string(e.text,200000)||!Array.isArray(e.photos)||e.photos.length>100)fail();seen.add(e.id);
  if(e.audioUri&&!media(e.audioUri,'audio'))fail();
  const photos=e.photos.map(p=>{if(!p||!string(p.id,160)||!media(p.uri,'image')||/^data:image\/svg/i.test(p.uri))fail();return {id:p.id,uri:p.uri};});
  return {...(e.aiStatus==='ready'&&string(e.aiSourceText,200000)?{aiStatus:'ready',aiSourceText:e.aiSourceText}:{}),...(string(e.polishedText,200000)&&string(e.polishSourceText,200000)?{polishedText:e.polishedText,polishSourceText:e.polishSourceText,qualityVersion:[1,2].includes(e.qualityVersion)?e.qualityVersion:undefined}:{}),titleAlgorithm:[1,2].includes(e.titleAlgorithm)?e.titleAlgorithm:undefined,previousAutoTitle:string(e.previousAutoTitle,500)?e.previousAutoTitle:undefined,id:e.id,createdAt:new Date(e.createdAt).toISOString(),text:e.text,rawText:string(e.rawText,200000)?e.rawText:e.text,title:string(e.title,500)?e.title:undefined,titleSource:['date','auto','manual'].includes(e.titleSource)?e.titleSource:undefined,titleStatus:e.titleStatus==='pending'?'pending':'ready',status:e.text?'ready':e.audioUri?'recorded':'ready',photos,audioUri:e.audioUri||undefined,audioMime:string(e.audioMime,100)?e.audioMime:undefined,duration:Number.isFinite(e.duration)?Math.max(0,e.duration):0,edited:!!e.edited,version:Number.isSafeInteger(e.version)?e.version:1,demo:false};
 });
}
export function missingRecords(existing,incoming){const ids=new Set(existing.map(e=>e.id));return incoming.filter(e=>!ids.has(e.id));}
