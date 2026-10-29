// Small, deterministic on-device rules. This is not a generative language model.
export const QUALITY_VERSION=2;
export const TITLE_LIMIT=25;
const compact=s=>String(s||'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
const corrections=[['친그랑','친구랑'],['친그와','친구와'],['갓는대','갔는데'],['갔는대','갔는데'],['조앗서','좋았어'],['좋앗어','좋았어'],['햇는데','했는데'],['햇어','했어'],['됬어','됐어'],['됬다','됐다'],['됬는데','됐는데'],['할수','할 수'],['될수','될 수'],['알수','알 수'],['할께','할게'],['갈께','갈게']];
export function polishText(raw){
 let text=compact(raw);if(!text)return '';
 for(const [from,to] of corrections)text=text.replace(new RegExp(`(^|[\\s,.!?])${from}(?=$|[\\s,.!?])`,'gu'),(_,before)=>before+to);
 text=text.replace(/(^|\n)(?:(?:음|어|그러니까)[,，]?\s+)+/gu,'$1');
 text=text.replace(/(했어|갔어|왔어|봤어|걸었어|먹었어|좋았어|좋았어요|했어요|왔어요|있었어|없었어|됐어|싶어|않았어|못했어|기뻤어|슬펐어|설렜어)\s+(?=[가-힣A-Za-z0-9])/gu,'$1. ');
 if(!/[.!?。！？…]$/.test(text))text+='.';
 return text;
}
export function effectiveText(entry){return !entry.edited&&entry.polishSourceText===entry.text&&typeof entry.polishedText==='string'?entry.polishedText:entry.text||'';}
export function splitSentences(text){return compact(text).split(/(?<=[!?。！？])\s*|\.(?=\s|$)|\n+/u).map(x=>x.trim().replace(/[.!?。！？]+$/u,'')).filter(Boolean);}
const event=/최종\s*합격|합격|불합격|취업|퇴사|입사|졸업|결혼|이별|헤어|생일|수술|입원|퇴원|이사|여행|발표|면접|시험|프로젝트|완성|마무리|선물|칭찬|실수|갈등|다툼|화해|공연|우승|실패|성공|산책|운동|통화|재회/gu;
const negative=/않|못했|못한|못하|아니|없|불합격|실패/;
export function coreTitle(text){
 const sentences=splitSentences(polishText(text));if(!sentences.length)return '';
 const ranked=sentences.map((sentence,index)=>({sentence,index,score:(sentence.match(event)||[]).length*5+(/가장|특히|기억에|잊지|중요|바라던|드디어|오랫동안|오래 기다/.test(sentence)?4:0)+(/기뻤|뿌듯|속상|슬펐|행복|불안|걱정|즐거|즐겁|외로|설렜/.test(sentence)?2:0)-(/일어나서|밥을 먹고|버스를 타고/.test(sentence)?2:0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 let selected=ranked[0].sentence.replace(/^(?:음[,，]?\s+|어[,，]?\s+|그러니까\s+)/u,'');
 if(Array.from(selected).length<=TITLE_LIMIT)return selected;
 // Remove only discourse/time prefixes; dates stay in the diary's date header.
 selected=selected.replace(/^(?:(?:오늘|어제|아침에|점심에|저녁에|밤에|그러고 나서|그리고|그런데|나는|내가)\s+)+/u,'');
 if(Array.from(selected).length<=TITLE_LIMIT)return selected;
 // A received message/gift is itself the event; retain the noun phrase, not a dangling adverb.
 if(!negative.test(selected))selected=selected.replace(/(소식|연락|선물|칭찬|제안|기회)(?:을|를)\s*(?:받아|받았|들어|들었).*$/u,'$1');
 if(Array.from(selected).length<=TITLE_LIMIT)return selected;
 const parts=selected.split(/(?<=했는데|갔는데|먹었는데|끝나고|마치고)\s+/u);
 if(parts.length>1){const best=parts.map(s=>({s,n:(s.match(event)||[]).length})).sort((a,b)=>b.n-a.n)[0];if(best.n)selected=best.s;}
 // Keep negation rather than turning a negative event into an affirmative heading.
 if(negative.test(selected)&&Array.from(selected).length>TITLE_LIMIT){const neg=selected.search(negative);const chars=Array.from(selected);const pos=Array.from(selected.slice(0,neg)).length;const start=Math.max(0,pos-12);const segment=chars.slice(start,start+23).join('');return (start?'…':'')+segment+(start+23<chars.length?'…':'');}
 const chars=Array.from(selected);if(chars.length<=TITLE_LIMIT)return selected;
 const match=[...selected.matchAll(event)][0];
 if(match&&match.index>18){const start=Math.max(0,selected.lastIndexOf(' ',match.index-1)+1);selected=selected.slice(start);}
 const prefix=Array.from(selected).slice(0,24).join('');const boundary=prefix.lastIndexOf(' ');
 return (boundary>=13?prefix.slice(0,boundary):prefix)+'…';
}
export function qualityPatch(entry){
 if(!entry?.text||entry.demo)return null;
 if(entry.aiSourceText===entry.text&&entry.aiStatus==='ready')return null;
 const polishNeeded=!entry.edited&&(entry.qualityVersion!==QUALITY_VERSION||entry.polishSourceText!==entry.text);
 const titleNeeded=entry.titleSource!=='manual'&&(entry.titleSource==='auto'||entry.titleSource==='date'||!entry.title)&&(entry.titleAlgorithm!==QUALITY_VERSION||entry.titleStatus==='pending');
 if(!polishNeeded&&!titleNeeded)return null;
 const patch={};const text=entry.edited?entry.text:polishText(entry.text);
 if(polishNeeded)Object.assign(patch,{polishedText:text,polishSourceText:entry.text,qualityVersion:QUALITY_VERSION});
 if(titleNeeded)Object.assign(patch,{title:coreTitle(text),titleSource:'auto',titleStatus:'ready',titleAlgorithm:QUALITY_VERSION,...(entry.title&&!entry.previousAutoTitle?{previousAutoTitle:entry.title}:{})});
 return patch;
}
