import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
export async function preparePwa(root){
 const dir=path.join(root,'dist-next');let html=await fs.readFile(path.join(dir,'index.html'),'utf8');
 const meta='<meta name="theme-color" content="#245D3C"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="말로일기"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><script defer src="/pwa-register.js"></script>';
 html=html.replace('</head>',meta+'</head>');await fs.writeFile(path.join(dir,'index.html'),html);
 const files=[];async function walk(d){for(const f of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())await walk(p);else if(!f.name.endsWith('.map')&&!['sw.js','metadata.json'].includes(f.name))files.push('/'+path.relative(dir,p).replaceAll('\\','/'));}}await walk(dir);
 const hash=createHash('sha256');for(const file of files.sort())hash.update(await fs.readFile(path.join(dir,file.slice(1))));const version=hash.digest('hex').slice(0,14);
 await fs.writeFile(path.join(dir,'sw.js'),`const CACHE='malro-shell-${version}';const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const file of FILES){const r=await fetch(file,{cache:'reload',credentials:'same-origin'});if(!r.ok||r.redirected)throw new Error('App shell unavailable');await cache.put(file,r);}await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('malro-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const req=event.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/__phone')||u.pathname.startsWith('/signin')||u.pathname.startsWith('/signout')||u.pathname==='/callback')return;
if(req.mode==='navigate'&&(u.pathname==='/'||u.pathname==='/index.html')){event.respondWith((async()=>{try{return await fetch(req);}catch{const shell=await(await caches.open(CACHE)).match('/index.html');return shell||Response.error();}})());return;}
if(u.pathname.startsWith('/hw6/')){event.respondWith((async()=>{try{return await fetch(req);}catch{return await(await caches.open(CACHE)).match(u.pathname)||Response.error();}})());return;}
if(FILES.includes(u.pathname))event.respondWith((async()=>{const cached=await(await caches.open(CACHE)).match(u.pathname);return cached||fetch(req);})());});`);
 console.log('PWA app shell:',files.length,'files; version',version);
}
