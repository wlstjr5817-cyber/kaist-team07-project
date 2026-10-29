// Local development only. Hosted production uses the existing Sites identity gateway.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTranscriptionApi} from './worker/transcription.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||8792),api=createTranscriptionApi();
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav'};
http.createServer(async(req,res)=>{
  try{
    if(req.headers.host!==`localhost:${port}`&&req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);return res.end('Local development only');}
    const url=new URL(req.url,`http://${req.headers.host}`);let response;
    if(url.pathname==='/archive'){response=Response.redirect('https://malro-diary.jinseokyang.chatgpt.site/archive',302);}
    else if(url.pathname.startsWith('/api/')){const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);headers.set('oai-authenticated-user-id','local-development');const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});response=await api(request,process.env);}
    else{let p=url.pathname==='/'?'/hw6/index.html':url.pathname;const names=['index.html','app.mjs','core.mjs','recorder.mjs','storage.mjs','style.css','qa-test.wav'];const name=p.startsWith('/hw6/')?p.slice(5):'';if(!names.includes(name)){res.writeHead(404);return res.end('Not found');}response=new Response(await fs.readFile(path.join(root,'public','hw6',name)),{headers:{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-store'}});}
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Request failed');}
}).listen(port,'127.0.0.1',()=>console.log(`말로일기 HW6: http://localhost:${port}/`));
