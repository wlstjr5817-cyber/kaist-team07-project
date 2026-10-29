import {coreTitle} from './quality.mjs';
export {dateWindow,searchEntries} from './recall.mjs';
export const TIMEZONE = 'Asia/Seoul';
export function id() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function cleanText(text) { return text.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim(); }
export function localDate(value) { return new Intl.DateTimeFormat('sv-SE',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
export function dateLabel(value) { return new Intl.DateTimeFormat('ko-KR',{timeZone:TIMEZONE,month:'long',day:'numeric',weekday:'short'}).format(new Date(value)); }
export function timeLabel(value) { return new Intl.DateTimeFormat('ko-KR',{timeZone:TIMEZONE,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value)); }
export function fallbackTitle(value){const date=new Date(value);const month=new Intl.DateTimeFormat('ko-KR',{timeZone:TIMEZONE,month:'long',day:'numeric'}).format(date);const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,hour:'2-digit',hourCycle:'h23'}).format(date));return `${month} ${hour<6?'새벽':hour<12?'아침':hour<18?'오후':'저녁'} 일기`;}
export function automaticTitle(text){return coreTitle(text);}
export function groupEntries(entries){const groups=new Map();for(const entry of [...entries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))){const key=localDate(entry.createdAt);if(!groups.has(key))groups.set(key,{key,date:entry.createdAt,data:[]});groups.get(key).data.push(entry);}return [...groups.values()];}
export function makeEntry(text='',extra={}) {const createdAt=extra.createdAt||new Date().toISOString();return {id:id(),createdAt,text:cleanText(text),rawText:text,title:fallbackTitle(createdAt),titleSource:'date',titleStatus:'pending',status:text?'ready':'recorded',photos:[],duration:0,edited:false,version:1,demo:false,...extra}; }
export function revised(entry,patch) { return {...entry,...patch,version:entry.version+1}; }
export function canApply(current,version) { return !!current && current.version===version && !current.edited; }
const samples=[
 ['호주에서 바다를 보며','호주 여행 중 본다이 비치에 앉아 있었어. 파도 소리를 듣는데 아무것도 안 해도 좋았어. 오래 기억하고 싶은 오후야.'],
 ['발표가 끝난 뒤','발표가 끝났어. 시작 전에는 많이 떨렸는데 질문에도 잘 대답했어. 내가 해냈다는 게 뿌듯해.'],
 ['축하하면서도','친구 취업 소식을 들었어. 정말 축하하면서도 나만 뒤처진 느낌이야. 기쁜데 마음이 복잡해.'],
 ['조용한 산책','저녁에 동네를 한 바퀴 걸었어. 바람이 시원하고 마음이 조금 편안해졌어.'],
 ['다시 만난 친구','친구와 별 얘기 안 했는데도 계속 웃었어. 오랜만에 정말 즐거웠던 시간이야.'],
 ['잠깐 쉬어가기','오늘은 생각보다 피곤해. 해야 할 일은 남았지만 일찍 쉬고 싶어.'],
 ['여행을 꿈꾸며','호주 여행을 가고 싶어. 아직 예약하지 않았지만 사진만 봐도 설레.'],
 ['작은 성취','밀린 과제를 하나 끝냈어. 완벽하지 않아도 끝냈다는 게 뿌듯해.'],
 ['비가 오던 날','비 오는 소리가 좋아서 창가에 앉아 있었어. 차분하고 평온한 기분이야.'],
 ['조금 걱정되는 밤','내일 면접이 걱정돼. 준비는 했는데 자꾸 부족한 부분만 생각나.'],
 ['시드니의 아침','호주 시드니에서 일찍 일어나 커피를 마셨어. 햇빛이 따뜻해서 기분 좋았어.'],
 ['엄마와 통화','엄마 목소리를 들으니까 마음이 편안했어. 별일 없다고 했지만 조금 보고 싶었어.'],
 ['수업에서','교수님이 내 아이디어에 좋은 질문을 해주셨어. 더 생각해볼 방향이 생겨서 신나.'],
 ['예상과 다른 하루','계획한 일이 잘 안 풀려서 속상해. 오늘은 해결책보다 그냥 쉬는 게 필요해.'],
 ['좋아하는 노래','길에서 좋아하는 노래가 나왔어. 따라 부르다 보니 기분이 좋아졌어.'],
 ['늦은 점심','혼자 천천히 점심을 먹었어. 오늘은 이런 여유가 좋았어.'],
 ['작은 선물','친구가 내 취향을 기억하고 선물을 줬어. 생각해줬다는 게 기쁘고 고마워.'],
 ['운동 끝','가볍게 운동하고 나니까 뿌듯해. 시작하기 전보다 몸도 마음도 개운해.'],
 ['말하지 못한 것','회의에서 내 생각을 말하지 못했어. 다음에는 한 문장이라도 말해보고 싶어.'],
 ['연락을 기다리며','답장이 늦어서 괜히 신경 쓰여. 바쁜 걸 알면서도 조금 서운해.'],
 ['호주 여행 마지막 날','호주 여행이 끝나서 아쉬워. 바다에서 친구랑 웃었던 시간이 가장 행복했어.'],
 ['주말 아침','알람 없이 일어나서 행복해. 오늘은 아무 약속 없이 쉬어야지.'],
 ['실수를 하고','작은 실수인데 계속 떠올라. 조금 긴장했고 내일 다시 확인하려고 해.'],
 ['도서관에서','책을 읽다가 마음에 드는 문장을 찾았어. 잠깐 멈춰 생각하는 시간이 좋았어.'],
 ['퇴근길','오늘 일이 많아서 지쳤어. 집에 가면 따뜻한 물로 씻고 쉬고 싶어.'],
 ['새로운 시작','새 프로젝트를 시작했어. 설레기도 하고 막막하기도 해.'],
 ['뜻밖의 칭찬','동료가 내가 정리한 자료가 도움이 됐다고 했어. 내 일을 알아줘서 뿌듯했어.'],
 ['혼자 있는 저녁','오늘은 조금 외로워. 누군가랑 별 의미 없는 얘기라도 하고 싶어.'],
 ['다 같이 저녁','오랜만에 가족이 모여 저녁을 먹었어. 웃으면서 먹으니 정말 즐거웠어.'],
 ['오늘의 마음','정리 안 되는 생각이 많았는데 말로 꺼내니 조금 가벼워. 지금 이 느낌을 남겨두고 싶어.'],
];
export function demoEntries(now=new Date()) {const [y,m,d]=localDate(now).split('-').map(Number);return samples.map(([title,text],i)=>makeEntry(text,{id:`demo-${i}`,title,titleSource:'manual',titleStatus:'ready',demo:true,createdAt:new Date(Date.UTC(y,m-1,d-(i<6?i:28+i),9,20)).toISOString()}));}
