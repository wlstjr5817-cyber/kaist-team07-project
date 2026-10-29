import {effectiveText,polishText,splitSentences} from './quality.mjs';
const local=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function dateWindow(query,now=new Date()){
 const [y,m,d]=local(now).split('-').map(Number);const at=(yy,mm,dd)=>new Date(Date.UTC(yy,mm-1,dd)-9*3600000);const q=query.replace(/지난 주/g,'지난주').replace(/이번 주/g,'이번주');
 let start=null,end=null,label='전체 기간',term='',invalid=false;
 const absolute=q.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?/u);const season=q.match(/(작년|올해|재작년|\d{4}년)\s*(봄|여름|가을|겨울)/u);const recent=q.match(/최근\s*(\d{1,2})\s*(개월|주|일)/u);
 if(absolute){const yy=absolute[1]?+absolute[1]:/재작년/.test(q)?y-2:/작년/.test(q)?y-1:y,mm=+absolute[2],dd=absolute[3]?+absolute[3]:1;term=absolute[0];invalid=mm<1||mm>12||dd<1||dd>new Date(Date.UTC(yy,mm,0)).getUTCDate();if(!invalid){start=at(yy,mm,dd);end=absolute[3]?at(yy,mm,dd+1):at(yy,mm+1,1);label=yy+'년 '+mm+'월'+(absolute[3]?' '+dd+'일':'');}}
 else if(season){const yy=season[1]==='작년'?y-1:season[1]==='재작년'?y-2:season[1]==='올해'?y:parseInt(season[1]);const mm={봄:3,여름:6,가을:9,겨울:12}[season[2]];start=at(yy,mm,1);end=at(yy,mm+3,1);term=season[0];label=term;}
 else if(recent){const n=+recent[1];term=recent[0];invalid=n<1;if(!invalid){end=at(y,m,d+1);start=recent[2]==='개월'?at(y,m-n,Math.min(d,new Date(Date.UTC(y,m-n,0)).getUTCDate())):at(y,m,d-(recent[2]==='주'?7*n:n)+1);label=term;}}
 else if(/지난\s?달/.test(q)){start=at(y,m-1,1);end=at(y,m,1);term=q.match(/지난\s?달/)[0];label='지난달';}
 else if(/이번\s?달/.test(q)){start=at(y,m,1);end=at(y,m+1,1);term=q.match(/이번\s?달/)[0];label='이번 달';}
 else if(/지난주|이번주/.test(q)){const weekday=(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7;const last=q.includes('지난주');start=at(y,m,d-weekday-(last?7:0));end=new Date(+start+7*86400000);label=term=last?'지난주':'이번주';}
 else if(/그저께|어제|오늘/.test(q)){term=q.match(/그저께|어제|오늘/)[0];const offset=term==='그저께'?2:term==='어제'?1:0;start=at(y,m,d-offset);end=at(y,m,d-offset+1);label=term;}
 else if(/재작년|작년|올해|\d{4}년/.test(q)){term=q.match(/재작년|작년|올해|\d{4}년/)[0];const yy=term==='작년'?y-1:term==='재작년'?y-2:term==='올해'?y:parseInt(term);start=at(yy,1,1);end=at(yy+1,1,1);label=term;}
 return {start,end,label,term,invalid};
}
const moods=[
 ['즐거','행복','기쁘','기뻤','신나','웃었','즐겁','좋았','기분 좋','설레','설렜'],
 ['뿌듯','자신감','해냈','성취','잘했','잘해서','칭찬'],
 ['속상','슬프','울었','눈물','서운','외로','우울'],
 ['불안','긴장','걱정','초조','떨렸','떨려'],
 ['복잡','뒤처','미묘','묘했','축하하면서','한편'],
 ['편안','차분','평온','쉬었','여유','안정','휴식'],
 ['힘들','피곤','지쳤','지치','버거','스트레스']];
const topics=[['산책','한 바퀴 걸','한바퀴 걸','걸었','걸으','걷기'],['호주','시드니','본다이','멜버른'],['여행','다녀왔','다녀온'],['취업','입사','합격'],['운동','헬스','러닝','조깅']];
const negation=/(?:지\s*않|지\s*못|진\s*않|지는\s*않|하지\s*않|하지\s*못|하지는\s*않|하지는\s*못|하지\s*않|하지\s*못|하지도\s*않|은?\s*아니|이?\s*아니|없었|없어)/u;
function polarityAt(text,index,length){const before=text.slice(Math.max(0,index-4),index);const after=text.slice(index+length,index+length+12);return /(?:안|못)\s*$/.test(before)||negation.test(after.split(/[.!?\n,]|지만|한편/)[0])?-1:1;}
function moodPresent(body,words,wanted){return words.some(word=>{let pos=body.indexOf(word);while(pos>=0){if(polarityAt(body,pos,word.length)===wanted)return true;pos=body.indexOf(word,pos+word.length);}return false;});}
function tokens(query,window){let q=query.toLowerCase().replace(/지난 주/g,'지난주').replace(/이번 주/g,'이번주').replace(window.term,' ');
 q=q.replace(/여행했던/g,' 여행 ').replace(/갔을\s*때|갔던|다녀온|다녀왔던/g,' ')
 .replace(/찾아\s*줘|찾아주세요|찾아봐|보여\s*줘|보여주세요|알려\s*줘|언제였지|어땠는지|어땠어|어떻게|기록|일기|순간|내용|언제|내가|나는|그때|때의|때를|대해|끝나고|했던|했을|있었|있을|재작년|작년|올해/g,' ')
 .replace(/[?!.,“”"']/g,' ');
 return q.split(/\s+/).map(w=>w.replace(/(에서는|으로는|이랑|에서|으로|하고|했던|때는|에는|부터|까지|에|을|를|은|는|이|가|와|과)$/u,'')).filter(w=>w&&!['때','날','것','해','나','내','좀','줘','쓴','썼던','적은','기억','에','쯤','중','한','후','전','했던'].includes(w));}
/** @returns {{items:any[],label:string,evidence:Record<string,{excerpt:string,reason:string}>,audioOnlyCount:number}} */
export function searchEntries(entries,query,now=new Date()){
 const q=String(query||'').trim(),window=dateWindow(q,now);if(!q||window.invalid)return {items:[],label:window.invalid?'날짜를 확인해주세요':window.label,evidence:{},audioOnlyCount:0};
 const moodGroups=moods.filter(words=>words.some(w=>q.includes(w))).map(words=>{const word=words.find(w=>q.includes(w));return {words,polarity:polarityAt(q,q.indexOf(word),word.length)};});
 let terms=tokens(q,window).filter(w=>!moods.some(words=>words.some(word=>w.includes(word)))&&!/^(않|못|안|아니)/.test(w));
 const topicGroups=[];terms=terms.filter(w=>{const group=topics.find(g=>g.some(word=>w.includes(word)));if(group){if(group[0]==='호주'&&!w.includes('호주'))return true;if(!topicGroups.includes(group))topicGroups.push(group);return false;}return true;});
 const scope=entries.filter(e=>!window.start||(+new Date(e.createdAt)>=+window.start&&+new Date(e.createdAt)<+window.end));const evidence={};
 const results=scope.map(entry=>{const actual=polishText(effectiveText(entry)||entry.rawText||'').toLowerCase();const body=((entry.title||'')+' '+actual).toLowerCase();
 const visited=splitSentences(actual).some(sentence=>/다녀왔|여행 중|여행이 끝|갔|에서.*(?:봤|했|먹|마셨|앉)/.test(sentence)&&!/(?:안|못)\s*갔|가지\s*않|간\s*적.*없|못\s*다녀/.test(sentence));
 const onlyPlan=/가고 싶|갈 예정|갈 계획|아직 예약하지|가려[고는]/.test(actual)&&!visited;
 const tripPast=/갔을|갔던|다녀온|다녀왔던|여행.*때/.test(q);
 const matches=terms.every(w=>body.includes(w))&&topicGroups.every(g=>g.some(word=>body.includes(word)))&&moodGroups.every(g=>moodPresent(actual,g.words,g.polarity))&&!(tripPast&&onlyPlan);
 const hasCriteria=terms.length+topicGroups.length+moodGroups.length>0||!!window.start;
 const matchedWords=[...terms,...topicGroups.flatMap(g=>g.filter(w=>body.includes(w))),...moodGroups.flatMap(g=>g.words.filter(w=>actual.includes(w)))];
 const sentence=splitSentences(effectiveText(entry)||entry.rawText||'').map(s=>({s,score:matchedWords.filter(w=>s.toLowerCase().includes(w)).length})).sort((a,b)=>b.score-a.score)[0];
 evidence[entry.id]={excerpt:sentence?.s||'본문 없이 저장된 음성이에요.',reason:[window.start?window.label:null,topicGroups.length?'관련 표현 일치':null,moodGroups.length?'감정 표현 확인':null,terms.length?'단어 일치':null].filter(Boolean).join(' · ')};
 return {entry,match:matches&&hasCriteria,score:terms.length*3+topicGroups.length*2+moodGroups.length*2+(sentence?.score||0)};
 }).filter(r=>r.match).sort((a,b)=>b.score-a.score||+new Date(b.entry.createdAt)-+new Date(a.entry.createdAt));
 return {items:results.map(r=>r.entry),label:window.label,evidence,audioOnlyCount:scope.filter(e=>e.audioUri&&!e.text&&!e.rawText).length};
}
