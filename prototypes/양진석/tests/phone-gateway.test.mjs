import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createPhoneGateway} from '../server/phone-gateway.mjs';
test('phone access requires a password; cookies are secure; cross-origin and expiry blocked',async()=>{
 let upstreamHits=0;const upstream=http.createServer((req,res)=>{upstreamHits++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ready:true}));});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const gateway=createPhoneGateway({password:'test-password-1234',expiresAt:Date.now()+600000,upstream:`http://127.0.0.1:${upstream.address().port}`});await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${gateway.address().port}`;
 try{
  const first=await fetch(base,{redirect:'manual'});assert.equal(first.status,303);assert.equal(first.headers.get('location'),'/__phone');
  assert.equal((await fetch(base+'/api/status')).status,401);assert.equal(upstreamHits,0);
  assert.equal((await fetch(base+'/api/status',{headers:{Origin:'https://foreign.example'}})).status,403);
  const loginPage=await fetch(base+'/__phone');assert.equal(loginPage.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
  const login=async password=>fetch(base+'/__phone/login',{method:'POST',headers:{Origin:base},body:new URLSearchParams({password}),redirect:'manual'});
  assert.equal((await login('wrong')).status,401);
  const success=await login('test-password-1234');assert.equal(success.status,303);const setCookie=success.headers.get('set-cookie');assert.match(setCookie,/HttpOnly; Secure; SameSite=Strict/);
  const authenticated=await fetch(base+'/api/status',{headers:{Cookie:setCookie.split(';')[0]}});assert.equal(authenticated.status,200);assert.equal((await authenticated.json()).ready,true);assert.equal(upstreamHits,1);
  assert.equal((await fetch(base+'/api/status',{headers:{Cookie:'malhaedum_phone=fake'}})).status,401);
  for(let i=0;i<5;i++)assert.equal((await login('wrong')).status,401);
  assert.equal((await login('test-password-1234')).status,429);
 }finally{gateway.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>gateway.close(r)),new Promise(r=>upstream.close(r))]);}
 const expired=createPhoneGateway({password:'test-password-1234',expiresAt:Date.now()-1});await new Promise(r=>expired.listen(0,'127.0.0.1',r));
 try{assert.equal((await fetch(`http://127.0.0.1:${expired.address().port}`)).status,410);}finally{expired.closeAllConnections();await new Promise(r=>expired.close(r));}
});
