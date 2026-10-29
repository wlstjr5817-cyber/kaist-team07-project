import {DiarySession} from './core.mjs';
import {VoiceRecorder} from './recorder.mjs';
import * as storage from './storage.mjs';
const $=id=>document.getElementById(id),testing=new URLSearchParams(location.search).has('test');
let session=null,rows=[],currentId=null,starting=false,stopping=false,saving=false,diaryId=null;
const notice=text=>{$('notice').textContent=text;$('notice').hidden=!text;};
const node=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
function injected(id){if(testing&&$(id).checked){$(id).checked=false;throw Error('검사를 위해 요청 실패를 재현했어요. 확보된 글은 그대로예요.');}}
async function request(path,body){
  const isJson=!(body instanceof FormData);const response=await fetch(path,{method:'POST',headers:{'x-malro-request':'transcribe-v1',...(isJson?{'Content-Type':'application/json'}:{})},body:isJson?JSON.stringify(body):body,signal:AbortSignal.timeout(90_000)});
  let data;try{data=await response.json();}catch{throw Error('서버 응답을 읽지 못했어요. 연결 상태와 로그인을 확인해주세요.');}
  if(!response.ok)throw Error(data.error||'처리에 실패했어요. 다시 시도해주세요.');return data;
}
const recorder=new VoiceRecorder({onTick:seconds=>{$('clock').innerHTML=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} <span>/ 03:00</span>`;},onNotice:notice,onStop:(blob,reason)=>{
  stopping=false;
  if(reason==='limit')notice('3분이 되어 이번 구간을 멈췄어요. 이어서 녹음하면 같은 일기에 붙여드려요.');
  else if(reason==='interrupted')notice('화면 이동이나 마이크 중단으로 녹음을 멈췄어요. 확보된 부분을 확인하고 이어서 말해주세요.');
  if(blob?.size)session.enqueue(currentId,blob);else session.fail(currentId,'녹음된 음성이 없어요. 이 구간을 다시 녹음해주세요.');
  render();
}});
function show(page){for(const id of ['home','compose','detail'])$(id).hidden=id!==page;window.scrollTo(0,0);}
function locked(){return starting||stopping||recorder.active||saving||session&&['waiting','polishing'].includes(session.stage);}
function render(){
  if(!session)return;
  const recording=recorder.active,busy=locked(),editing=['polishing','edit'].includes(session.stage);
  $('date').textContent=session.date;$('recording-panel').hidden=editing;$('editor-panel').hidden=!editing;
  $('heading').textContent=editing?'당신의 말로 남긴 오늘.':'오늘의 이야기를 들려주세요.';
  $('guide').textContent=editing?'내 생각이 잘 담겼는지 읽고, 필요한 부분만 고쳐주세요.':'짧게 말해도 괜찮아요. 한 번에 3분씩, 원하는 만큼 이어서.';
  $('record').textContent=recording?'이 구간 멈추기':starting?'마이크 여는 중…':stopping?'녹음 마치는 중…':session.segments.length?'이어서 녹음':'녹음 시작';
  $('record').disabled=starting||stopping||session.stage!=='record';
  $('indicator').classList.toggle('active',recording);
  $('capture-status').textContent=recording?'녹음 중 · 떠오르는 대로 말해주세요':session.pending?`${session.pending}개 구간을 글로 옮기고 있어요`:session.segments.length?'이어서 말하거나 초안을 확인하세요':'준비되면 눌러주세요';
  $('finish').disabled=busy||!session.segments.length;
  $('finish').textContent=session.stage==='waiting'?'음성 인식이 끝나기를 기다리는 중…':'녹음 마치고 초안 확인';
  $('leave').disabled=busy||session.pending>0;
  $('continue').disabled=busy||session.pending>0;
  $('segments').replaceChildren();
  session.segments.forEach((s,i)=>{const card=node('div','','segment');const head=node('div','','segment-head');head.append(node('strong',`구간 ${i+1}`),node('span',({recording:'녹음 중',pending:'변환 대기·처리 중',ready:'변환 완료',error:'확인 필요'})[s.status]));card.append(head,node('p',s.text|| (s.status==='error'?'이 구간은 변환된 내용이 없습니다.':'받아쓴 내용이 여기에 나타나요.')));if(s.error)card.append(node('p',s.error+(s.text?' 이전에 변환된 글은 유지했어요.':''),'error'));
    const again=node('button','이 구간 다시 녹음','secondary');again.disabled=busy||session.stage!=='record'||['pending','recording'].includes(s.status);again.setAttribute('aria-label',`구간 ${i+1} 다시 녹음`);again.onclick=()=>start(s.id);card.append(again);$('segments').append(card);});
  if(editing){$('draft').value=session.draft;$('draft').disabled=session.stage==='polishing'||saving;$('raw').textContent=session.raw();$('processing').textContent=session.stage==='polishing'?'내 말투를 살리며 문장을 정리하고 있어요…':session.polishError?`문장 정리를 완료하지 못했어요. ${session.polishError} 아래 글을 직접 고쳐 저장하거나 다시 정리할 수 있어요.`:'초안을 확인해주세요. 저장은 직접 눌렀을 때만 이루어져요.';}
  $('retry').disabled=busy||!session.draft.trim();$('save').disabled=busy||session.stage!=='edit'||!session.draft.trim();$('save').textContent=saving?'저장 중…':'일기 저장';
}
async function start(replaceId){
  if(locked()||!session||session.stage!=='record')return;starting=true;notice('');$('decision').hidden=true;render();
  try{await recorder.start();currentId=session.reserve(replaceId);}
  catch(e){notice(e.name==='NotAllowedError'?'마이크 권한을 허용해주세요. 브라우저의 사이트 설정에서 마이크를 켤 수 있어요.':e.message||'마이크를 열지 못했어요.');}
  finally{starting=false;render();}
}
$('new').onclick=()=>{
  diaryId=crypto.randomUUID();session=new DiarySession({onChange:render,transcribe:async(blob,id)=>{injected('fail-transcribe');const form=new FormData();form.set('file',blob,'segment.'+(blob.type.includes('mp4')?'m4a':'webm'));form.set('entryId',id);return(await request('/api/transcribe',form)).text;},polish:async text=>{injected('fail-polish');return(await request('/api/polish',{text})).text;}});
  notice('');$('decision').hidden=true;$('clock').innerHTML='00:00 <span>/ 03:00</span>';show('compose');render();
};
$('record').onclick=()=>{if(recorder.active){stopping=true;recorder.stop();render();}else void start();};
async function finish(allowErrors=false){if(locked())return;notice('');try{const result=await session.finish(allowErrors);$('decision').hidden=!result.needsDecision;if(result.needsDecision)$('decision').scrollIntoView({block:'center'});}catch(e){notice(e.message);}render();}
$('finish').onclick=()=>finish();$('continue').onclick=()=>finish(true);
$('draft').oninput=()=>{session.draft=$('draft').value;$('save').disabled=!session.draft.trim();$('retry').disabled=!session.draft.trim();};
$('retry').onclick=()=>{if(!locked()&&session.draft.trim())void session.clean();};
$('save').onclick=async()=>{
  if(locked()||!session.draft.trim())return;saving=true;notice('');render();
  try{injected('fail-save');const row=await storage.save({id:diaryId,date:session.date,text:session.draft});rows=[row,...rows.filter(r=>r.id!==row.id)];session=null;renderList();show('home');notice('일기를 저장했어요.');}
  catch(e){notice('기기에 저장하지 못했어요. 작성한 글은 그대로 있으니 저장 공간을 확인하고 다시 눌러주세요.');}
  finally{saving=false;render();}
};
$('leave').onclick=()=>{if(locked()||session.pending)return;if(session.segments.length&&!confirm('아직 저장하지 않은 글이 있어요. 이 일기를 나갈까요?'))return;session=null;notice('');show('home');};
$('back').onclick=()=>show('home');
function renderList(){
  $('count').textContent=`${rows.length}개의 기록`;$('entries').replaceChildren();
  if(!rows.length){$('entries').append(node('div','아직 남겨 둔 하루가 없어요.\n첫 이야기를 가볍게 시작해보세요.','empty'));return;}
  for(const r of rows){const button=node('button','','entry');button.append(node('time',r.date),node('strong',r.text.slice(0,28)+(r.text.length>28?'…':'')),node('p',r.text));button.onclick=()=>{$('detail-date').textContent=r.date;$('detail-title').textContent='나의 하루';$('detail-text').textContent=r.text;notice('');show('detail');};$('entries').append(button);}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder.active){stopping=true;recorder.stop('interrupted');render();}});
window.addEventListener('beforeunload',e=>{if(session&&(session.segments.length||recorder.active)){e.preventDefault();e.returnValue='';}});
$('testing').hidden=!testing;
$('fixture').onclick=async()=>{if(!testing||locked()||session?.stage!=='record'){notice('새 일기를 열고 녹음 단계에서 검사해주세요.');return;}try{const response=await fetch('/hw6/qa-test.wav');if(!response.ok)throw Error('합성 음성 예제를 읽지 못했어요.');const id=session.reserve();session.enqueue(id,await response.blob());notice('합성 음성 검사 구간을 추가했어요. 처리 결과를 확인해주세요.');}catch(e){notice(e.message);}};
try{rows=await storage.list();renderList();}catch{notice('기기 저장소를 열지 못했어요. 브라우저의 저장 공간과 설정을 확인해주세요.');}
// The previous app shell is managed by its existing service worker. Keep it current.
if('serviceWorker'in navigator)navigator.serviceWorker.getRegistration('/').then(r=>r?.update()).catch(()=>{});
