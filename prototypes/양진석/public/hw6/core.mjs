export const SEGMENT_MS = 180_000;
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function splitText(text, max = 8000) {
  const parts=[]; let rest=text;
  while(rest.length>max){let cut=rest.lastIndexOf('\n',max);if(cut<max/2)cut=rest.lastIndexOf(' ',max);if(cut<max/2)cut=max;if(/[\uD800-\uDBFF]/.test(rest[cut-1]))cut--;parts.push(rest.slice(0,cut));rest=rest.slice(cut);}
  if(rest)parts.push(rest);return parts;
}
export class DiarySession {
  constructor({transcribe,polish,onChange=()=>{},date=localDay()}) {
    Object.assign(this,{transcribe,polish,onChange,date,segments:[],draft:'',stage:'record',queue:Promise.resolve(),pending:0,polishError:''});
  }
  emit(){this.onChange();}
  reserve(replaceId){
    if(this.stage!=='record')throw Error('초안을 확인하는 중에는 녹음할 수 없어요.');
    let segment=replaceId?this.segments.find(s=>s.id===replaceId):null;
    if(replaceId&&!segment)throw Error('구간을 찾지 못했어요.');
    if(segment&&['recording','pending'].includes(segment.status))throw Error('이 구간을 처리 중이에요.');
    if(!segment){segment={id:crypto.randomUUID(),text:'',status:'recording',error:''};this.segments.push(segment);}
    segment.status='recording';segment.error='';this.emit();return segment.id;
  }
  fail(id,message){const s=this.segments.find(s=>s.id===id);s.status='error';s.error=message;this.emit();}
  enqueue(id,blob){
    const s=this.segments.find(s=>s.id===id);s.status='pending';this.pending++;this.emit();
    // Serialized requests preserve recording order and respect the existing API concurrency guard.
    const job=this.queue.then(async()=>{
      try{const text=await this.transcribe(blob,id);if(!text?.trim())throw Error('말소리를 찾지 못했어요. 다시 녹음해주세요.');s.text=text.trim();s.status='ready';s.error='';}
      catch(e){s.status='error';s.error=e.message||'음성 인식에 실패했어요.';}
      finally{blob=null;this.pending--;this.emit();}
    });this.queue=job;return job;
  }
  raw(){return this.segments.map(s=>s.text).filter(Boolean).join('\n\n');}
  async finish(allowErrors=false){
    if(this.segments.some(s=>s.status==='recording'))throw Error('녹음을 먼저 멈춰주세요.');
    this.stage='waiting';this.emit();await this.queue;
    if(this.segments.some(s=>s.status==='error')&&!allowErrors){this.stage='record';this.emit();return {needsDecision:true};}
    this.draft=this.raw();
    if(!this.draft.trim()){this.stage='record';this.emit();throw Error('변환된 글이 없어요. 다시 녹음해주세요.');}
    await this.clean();return {needsDecision:false};
  }
  async clean(){
    const original=this.draft;this.stage='polishing';this.polishError='';this.emit();
    try{const parts=[];for(const part of splitText(original)){const result=await this.polish(part);if(!result?.trim())throw Error('빈 정리 결과를 받았어요.');parts.push(result.trim());}this.draft=parts.join('\n\n');}
    catch(e){this.draft=original;this.polishError=e.message||'문장 정리에 실패했어요.';}
    finally{this.stage='edit';this.emit();}
  }
}
