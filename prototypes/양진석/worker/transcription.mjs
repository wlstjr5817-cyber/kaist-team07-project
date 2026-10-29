import {languageTask} from './language.mjs';
// Server-only. This module never stores recordings, transcripts or API keys.
const MAX_BYTES=12_000_000;
const formats={'audio/mp4':'m4a','audio/x-m4a':'m4a','audio/webm':'webm','audio/wav':'wav','audio/x-wav':'wav'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const failure=(status,error)=>json({error},status);
async function limitedBody(request){
 const length=Number(request.headers.get('content-length'));
 if(length>MAX_BYTES)throw new Error('size');
 if(!request.body)throw new Error('empty');
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw new Error('size');}chunks.push(value);}}
 finally{reader.releaseLock();}
 return new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
}
function validAudio(bytes,type){
 if(bytes.length<12)return false;
 if(type.includes('mp4')||type.includes('m4a'))return String.fromCharCode(...bytes.slice(4,8))==='ftyp';
 if(type.includes('webm'))return [0x1a,0x45,0xdf,0xa3].every((b,i)=>bytes[i]===b);
 return String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WAVE';
}
export function createTranscriptionApi({fetcher=(...args)=>fetch(...args),timeoutMs=75_000,now=()=>Date.now()}={}){
 // Limits simultaneous requests on each worker instance. It is not a billing cap.
 const active=new Set();
 return async function api(request,env){
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/'))return null;
  // Identity is injected by the existing owner-private Sites gateway.
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return failure(401,'로그인이 필요해요. 앱을 다시 열어주세요.');
  if(path==='/api/status'&&request.method==='GET')return json({speech:{ready:!!env.OPENAI_API_KEY,provider:'openai',configured:!!env.OPENAI_API_KEY},ai:!!env.OPENAI_API_KEY,version:'0.7-hw6'});
  if(['/api/polish','/api/corrections','/api/search'].includes(path)){
   if(request.method!=='POST')return failure(405,'지원하지 않는 요청이에요.');
   if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('x-malro-request')!=='transcribe-v1')return failure(403,'앱 안에서 다시 시도해주세요.');
   if(!env.OPENAI_API_KEY)return failure(503,'AI 서버가 연결되지 않았어요.');
   if(active.has(user))return failure(429,'이전 요청을 처리 중이에요. 잠시 후 다시 시도해주세요.');
   active.add(user);
   try{
    if(!request.headers.get('content-type')?.includes('application/json'))return failure(415,'요청 형식을 확인해주세요.');
    const reader=request.body?.getReader();if(!reader)return failure(400,'요청 내용이 없어요.');
    let size=0;const chunks=[];try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>100000){await reader.cancel();return failure(413,'요청이 너무 길어요.');}chunks.push(value);}}finally{reader.releaseLock();}
    let input;try{input=JSON.parse(await new Blob(chunks).text());if(!input||typeof input!=='object')throw Error();}catch{return failure(400,'요청 내용을 확인해주세요.');}
    return json(await languageTask(path,input,env,fetcher,Math.min(timeoutMs,45000)));
   }catch(e){return failure(502,e.name==='TimeoutError'?'AI 처리가 지연됐어요. 확보된 글은 그대로 있어요.':e.message?.startsWith('AI')||e.message?.includes('확인')||e.message?.includes('이내')?e.message:'AI 처리에 실패했어요. 확보된 글은 그대로 있어요.');}
   finally{active.delete(user);}
  }
  if(path!=='/api/transcribe')return failure(404,'지원하지 않는 요청이에요.');
  if(request.method!=='POST')return failure(405,'녹음 파일을 보내주세요.');
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('x-malro-request')!=='transcribe-v1')return failure(403,'앱 안에서 다시 시도해주세요.');
  if(!env.OPENAI_API_KEY)return failure(503,'자동 전사 서버에 API 키가 아직 등록되지 않았어요. 확보된 글을 확인하고 다시 녹음해주세요.');
  if(active.has(user))return failure(429,'이전 음성을 변환 중이에요. 완료된 뒤 다시 시도해주세요.');
  if(!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get('content-type')||''))return failure(415,'녹음 파일 형식을 확인해주세요.');
  active.add(user);
  try{
   let form;try{form=await limitedBody(request);}catch(e){return failure(e.message==='size'?413:400,e.message==='size'?'녹음 파일이 너무 커요. 3분 이내로 나눠 녹음해주세요.':'녹음 파일을 읽지 못했어요. 이 구간을 다시 녹음해주세요.');}
   const file=form.get('file'),entryId=form.get('entryId');
   if(typeof entryId!=='string'||!entryId||entryId.length>160||!(file instanceof Blob)||!file.size)return failure(400,'녹음 파일이 없거나 비어 있어요.');
   const mime=file.type.split(';')[0];
   if(!formats[mime]||!validAudio(new Uint8Array(await file.slice(0,16).arrayBuffer()),mime))return failure(415,'지원하지 않는 녹음 형식이에요.');
   const upstream=new FormData();upstream.set('model',env.OPENAI_TRANSCRIBE_MODEL||'gpt-transcribe');upstream.set('response_format','json');upstream.set('file',file,`diary.${formats[mime]}`);
   let keywords=[];try{keywords=JSON.parse(form.get('keywords')||'[]');}catch{return failure(400,'단어장 형식을 확인해주세요.');}
   if(!Array.isArray(keywords)||keywords.length>40||keywords.some(w=>typeof w!=='string'||!w.trim()||w.length>80||/[<>\r\n]/.test(w)))return failure(400,'단어장 형식을 확인해주세요.');
   if((env.OPENAI_TRANSCRIBE_MODEL||'gpt-transcribe')==='gpt-transcribe'){
    upstream.append('languages[]','ko');for(const word of keywords)upstream.append('keywords[]',word);
    upstream.set('prompt',form.get('purpose')==='correction'?'한국어 일기의 오인식된 단어를 다른 단어로 바꾸도록 요청하는 짧은 수정 명령.':'일상 경험과 감정을 기록하는 한국어 개인 일기.');
   }
   const started=now();let response;
   try{response=await fetcher('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:upstream,signal:AbortSignal.timeout(timeoutMs)});}
   catch(e){return failure(504,'전사 연결이 끊겼거나 시간이 오래 걸렸어요. 확보된 글은 그대로 있어요. 다시 녹음하거나 이어서 말해주세요.');}
   if(!response.ok){
    if(response.status===401||response.status===403)return failure(503,'전사 서버의 API 키 또는 모델 접근 권한을 확인해야 해요.');
    if(response.status===429)return failure(429,'전사 서비스의 사용 한도나 결제 설정을 확인해주세요. 확보된 글은 그대로 있어요.');
    return failure(502,'전사 서비스가 요청을 완료하지 못했어요. 확보된 글은 그대로 있어요.');
   }
   let result;try{result=await response.json();}catch{return failure(502,'전사 응답을 읽지 못했어요. 이 구간을 다시 녹음해주세요.');}
   if(typeof result.text!=='string'||!result.text.trim())return failure(422,'말소리를 찾지 못했어요. 이 구간을 다시 녹음해주세요.');
   if(result.text.length>200_000)return failure(502,'전사 결과가 너무 길어요. 녹음을 나눠 다시 시도해주세요.');
   return json({text:result.text,transcriptionMs:Math.max(0,now()-started)});
  }finally{active.delete(user);}
 };
}
