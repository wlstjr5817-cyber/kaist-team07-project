import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const digest=value=>createHash('sha256').update(value).digest();
const matches=(a,b)=>timingSafeEqual(digest(a),digest(b));
const loginPage=(error='')=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>말로일기 · 아이폰 테스트</title><style>body{margin:0;background:#f6f5ef;color:#263e35;font:16px/1.7 system-ui,sans-serif;padding:36px 22px}main{max-width:420px;margin:7vh auto}h1{font-size:36px;letter-spacing:-2px}p{color:#687866}label{display:block;margin-top:30px;font-weight:600}input,button{box-sizing:border-box;width:100%;font:inherit;border-radius:12px;padding:15px;margin-top:10px}input{border:1px solid #ccd6c3;background:#fffdf8}button{background:#365c48;color:white;border:0;cursor:pointer}small{display:block;color:#78847b;margin-top:25px}.error{color:#b85948}</style></head><body><main><h1>말로일기.</h1><p>작은 순간을, 오래 기억하기.<br>아이폰 테스트 공간에 들어오세요.</p><form method="POST" action="/__phone/login"><label for="password">접속 암호</label><input id="password" name="password" type="password" required maxlength="128" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="채팅에 안내된 암호"><button type="submit">테스트 시작하기</button><p class="error">${error}</p></form><small>기록과 사진은 이 브라우저에 저장됩니다.<br>음성 전사 시 녹음이 Cloudflare HTTPS 중계를 거쳐 이 PC로 전송되어 처리됩니다. 개인 기록으로 사용하기 전, 가벼운 테스트 문장으로 확인해주세요.<br>접속은 12시간 이내에 만료되며 PC가 켜져 있어야 합니다.</small></main></body></html>`;

export function createPhoneGateway({password,expiresAt,upstream='http://127.0.0.1:8787'}){
 if(typeof password!=='string'||password.length<12)throw new Error('At least 12 password characters required');
 const session=randomBytes(32).toString('hex');const failures=new Map();let activeTranscriptions=0;
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','microphone=(self), camera=()');
  const send=(code,data,type='text/plain; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type});res.end(data);};
  if(Date.now()>=expiresAt)return send(410,'테스트 접속이 만료됐어요. PC에서 새 접속을 준비해주세요.');
  const url=new URL(req.url,'http://localhost');
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){console.warn('Origin rejected',JSON.stringify({origin:req.headers.origin,host:req.headers.host}));return send(403,'Origin denied');}}catch{console.warn('Invalid origin rejected',JSON.stringify({origin:req.headers.origin,host:req.headers.host}));return send(403,'Origin denied');}}
  const valid=matches((req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('malhaedum_phone='))?.slice(16)||'',session);
  try{
   if(req.method==='GET'&&url.pathname==='/__phone')return send(200,loginPage(),'text/html; charset=utf-8');
   if(req.method==='POST'&&url.pathname==='/__phone/login'){
    const client=String(req.headers['cf-connecting-ip']||req.socket.remoteAddress);const bucket=failures.get(client)||{count:0,until:Date.now()+600000};
    if(Date.now()>bucket.until){bucket.count=0;bucket.until=Date.now()+600000;}
    if(bucket.count>=5)return send(429,loginPage('입력이 여러 번 실패했어요. 10분 뒤 다시 시도해주세요.'),'text/html; charset=utf-8');
    let data='';for await(const chunk of req){data+=chunk;if(data.length>2048)return send(413,'Too large');}
    const given=new URLSearchParams(data).get('password')||'';
    if(!matches(given,password)){bucket.count++;if(failures.size>1000)failures.clear();failures.set(client,bucket);return send(401,loginPage('접속 암호를 다시 확인해주세요.'),'text/html; charset=utf-8');}
    failures.delete(client);res.setHeader('Set-Cookie',`malhaedum_phone=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0,Math.floor((expiresAt-Date.now())/1000))}`);res.writeHead(303,{Location:'/'});return res.end();
   }
   if(!valid){if(url.pathname.startsWith('/api/'))return send(401,JSON.stringify({error:'접속 암호가 필요하거나 만료됐어요. 페이지를 새로 열어주세요.'}),'application/json');res.writeHead(303,{Location:'/__phone'});return res.end();}
   if(!['GET','HEAD','POST'].includes(req.method))return send(405,'Method not allowed');
   if(req.method==='POST'&&!['/api/transcribe','/api/search'].includes(url.pathname))return send(404,'Not found');
   const isSpeech=req.method==='POST'&&url.pathname==='/api/transcribe';
   if(isSpeech&&activeTranscriptions>=1)return send(429,JSON.stringify({error:'앞선 음성을 처리 중이에요. 잠시 후 다시 시도해주세요.'}),'application/json');
   let payload; if(req.method==='POST'){
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,'JSON required');
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>20_000_000)return send(413,'Too large');chunks.push(chunk);}payload=Buffer.concat(chunks);
   }
   if(isSpeech)activeTranscriptions++;
   try{
    const response=await fetch(upstream+url.pathname+url.search,{method:req.method,headers:payload?{'Content-Type':'application/json'}:{},body:payload,signal:AbortSignal.timeout(185000),redirect:'error'});
    const bytes=Buffer.from(await response.arrayBuffer());res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/octet-stream'});res.end(bytes);
   }finally{if(isSpeech)activeTranscriptions--;}
  }catch{send(503,JSON.stringify({error:'PC 서버에 연결하지 못했어요. 저장된 원본은 브라우저에 남아 있어요.'}),'application/json');}
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const config=JSON.parse(await readFile(process.env.PHONE_ACCESS_FILE,'utf8'));
 createPhoneGateway(config).listen(8789,'127.0.0.1',()=>console.log('Password-protected phone gateway: 127.0.0.1:8789'));
}
