// Local QA only: identity is simulated here, never in the production Worker.
import http from 'node:http';import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const port=Number(process.env.PORT||8791);
const server=http.createServer(async(req,res)=>{
 try{const url=`http://localhost:${port}${req.url}`;const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
 headers.set('oai-authenticated-user-id','local-qa-only');
 const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
 // Deliberately no API key or fake ready status: this tests the missing-key UI.
 const response=await worker.fetch(request,{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Local preview failed');}
});server.listen(port,'127.0.0.1',()=>console.log(`Cloud app QA: http://localhost:${port}/?selftest=1 (no API key)`));
