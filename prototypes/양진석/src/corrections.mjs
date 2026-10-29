import {effectiveText,TITLE_LIMIT,coreTitle} from './quality.mjs';
export function normalizeWords(value){return [...new Set((Array.isArray(value)?value:String(value||'').split(/[,\n]/)).filter(v=>typeof v==='string').map(v=>v.trim()).filter(v=>v&&Array.from(v).length<=40&&!/[<>\r\n]/.test(v)))].slice(0,40);}
export function replacementPreview(entry,pairs){
 if(!Array.isArray(pairs)||!pairs.length||pairs.length>12)throw new Error('바꿀 단어를 확인해주세요.');
 const valid=pairs.map(p=>({from:typeof p.from==='string'?p.from.trim():'',to:typeof p.to==='string'?p.to.trim():''}));
 if(valid.some(p=>!p.from||!p.to||p.from===p.to||p.from.length>100||p.to.length>100))throw new Error('바꾸기 전·후 단어를 정확히 적어주세요.');
 if(new Set(valid.map(p=>p.from)).size!==valid.length)throw new Error('같은 단어의 변경 요청이 겹쳐요.');
 const source=effectiveText(entry),title=entry.title||'';
 const ordered=[...valid].sort((a,b)=>b.from.length-a.from.length);
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const re=new RegExp(ordered.map(p=>escape(p.from)).join('|'),'gu');
 const replace=s=>s.replace(re,m=>valid.find(p=>p.from===m).to);
 const text=replace(source);let nextTitle=replace(title);
 if(text===source&&nextTitle===title)throw new Error('현재 일기에서 바꿀 단어를 찾지 못했어요.');
 if(Array.from(nextTitle).length>TITLE_LIMIT)nextTitle=coreTitle(nextTitle);
 return {id:entry.id,version:entry.version,source,titleBefore:title,text,title:nextTitle,pairs:valid};
}
const contentFields=['text','title','titleSource','titleStatus','titleAlgorithm','edited','polishedText','polishSourceText','qualityVersion','aiSourceText','aiStatus'];
export function applyCorrection(current,preview){
 if(!current||current.id!==preview.id||current.version!==preview.version||effectiveText(current)!==preview.source||current.title!==preview.titleBefore)throw new Error('일기가 바뀌었어요. 수정 내용을 다시 확인해주세요.');
 const before=Object.fromEntries(contentFields.map(k=>[k,current[k]]));
 return {...current,text:preview.text,title:preview.title,edited:true,polishedText:undefined,polishSourceText:undefined,aiStatus:undefined,aiSourceText:undefined,status:'ready',titleStatus:'ready',titleSource:'manual',version:current.version+1,undoCorrection:{before,appliedVersion:current.version+1,appliedText:preview.text,appliedTitle:preview.title}};
}
export function undoCorrection(current){
 const undo=current?.undoCorrection;
 if(!undo||current.version!==undo.appliedVersion||current.text!==undo.appliedText||current.title!==undo.appliedTitle)throw new Error('이후에 일기를 수정해서 이전 변경을 되돌릴 수 없어요.');
 return {...current,...undo.before,version:current.version+1,undoCorrection:undefined};
}
