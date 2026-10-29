import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePwa} from './prepare-pwa.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expo=spawnSync(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'export','--platform','web','--max-workers','2','--output-dir','dist-next'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,EXPO_NO_TELEMETRY:'1'}});
if(expo.status!==0)process.exit(expo.status||1);
await preparePwa(root);
const dir=path.join(root,'dist-next');const assets={};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.ico':'image/x-icon','.wav':'audio/wav','.svg':'image/svg+xml'};
async function walk(folder){for(const f of await fs.readdir(folder,{withFileTypes:true})){const p=path.join(folder,f.name);if(f.isDirectory())await walk(p);else if(!f.name.endsWith('.map')&&f.name!=='metadata.json')assets['/'+path.relative(dir,p).replaceAll('\\','/')]={type:mime[path.extname(p)]||'application/octet-stream',base64:(await fs.readFile(p)).toString('base64')};}}
await walk(dir);
const language=await fs.readFile(path.join(root,'worker/language.mjs'),'utf8');
const api=(await fs.readFile(path.join(root,'worker/transcription.mjs'),'utf8')).replace("import {languageTask} from './language.mjs';",'');
const worker=(await fs.readFile(path.join(root,'worker/index.mjs'),'utf8')).replace("import {createTranscriptionApi} from './transcription.mjs';",'');
const hosting=JSON.parse(await fs.readFile(path.join(root,'.openai/hosting.json'),'utf8'));if(hosting.static)throw new Error('Cloud build needs a Worker manifest');
const output=path.resolve(root,'dist');if(output!==path.join(root,'dist')||!output.startsWith(root+path.sep))throw new Error('Unsafe build directory');
// dist is generated output only. Browser records live in IndexedDB, not here.
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(path.join(output,'server'),{recursive:true});await fs.mkdir(path.join(output,'.openai'),{recursive:true});
await fs.writeFile(path.join(output,'server/index.js'),language+'\n'+api+'\n'+worker+'\nexport default createWorker('+JSON.stringify(assets)+');\n');
await fs.writeFile(path.join(output,'.openai/hosting.json'),JSON.stringify(hosting)+'\n');
console.log('Built standalone cloud worker with',Object.keys(assets).length,'embedded app assets; no API key in build output.');
