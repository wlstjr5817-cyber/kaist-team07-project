import {spawn} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workspace=path.resolve(root,'../..');
const localPython=path.join(workspace,'work/malhaedum-venv/Scripts/python.exe');
const portablePython=path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
const python=process.env.PYTHON||([portablePython,localPython].find(existsSync));
if(!existsSync(path.join(root,'dist/index.html'))){console.error('먼저 npm run build를 실행해주세요.');process.exit(1);}
const children=[];
async function available(url){try{return (await fetch(url,{signal:AbortSignal.timeout(2000)})).ok;}catch{return false;}}
if(await available('http://127.0.0.1:8787/api/status')){console.log('이미 실행 중입니다: http://localhost:8787');process.exit(0);}
if(!(await available('http://127.0.0.1:8788'))&&python){
 const cache=process.env.MODEL_CACHE||(existsSync(localPython)?path.join(workspace,'work/models'):path.join(root,'.models'));mkdirSync(cache,{recursive:true});
 children.push(spawn(python,['server/speech.py'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,MODEL_CACHE:cache,HF_HUB_DISABLE_SYMLINKS_WARNING:'1'}}));
}else if(!python)console.log('로컬 음성 엔진 미설치: 녹음 저장과 글 기록, 기본 검색은 사용 가능합니다. README.txt를 참고하세요.');
children.push(spawn(process.execPath,['--env-file-if-exists=.env','server/server.mjs'],{cwd:root,stdio:'inherit',windowsHide:true}));
for(const child of children)child.on('error',e=>console.error(e.message));
function stop(){for(const child of children)child.kill();process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
