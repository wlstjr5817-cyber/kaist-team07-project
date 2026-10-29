import {preparePwa} from './prepare-pwa.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const next=path.join(root,'dist-next'),live=path.join(root,'dist');
await preparePwa(root);
await fs.access(path.join(next,'index.html'));
async function copy(folder){for(const item of await fs.readdir(folder,{withFileTypes:true})){const source=path.join(folder,item.name);const relative=path.relative(next,source);if(relative==='index.html')continue;const target=path.resolve(live,relative);if(!target.startsWith(live+path.sep))throw new Error('Invalid target');if(item.isDirectory()){await fs.mkdir(target,{recursive:true});await copy(source);}else{await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);}}}
await fs.mkdir(live,{recursive:true});await copy(next);
const html=(await fs.readFile(path.join(next,'index.html'),'utf8')).replace('lang="en"','lang="ko"');
await fs.writeFile(path.join(live,'index.next.html'),html);
await fs.rename(path.join(live,'index.next.html'),path.join(live,'index.html'));
console.log('Updated web assets; index published last. Existing records are unchanged.');
