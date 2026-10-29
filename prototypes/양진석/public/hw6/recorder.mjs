import {SEGMENT_MS} from './core.mjs';
export class VoiceRecorder {
  constructor({onStop,onTick,onNotice}){Object.assign(this,{onStop,onTick,onNotice,active:false,starting:false,ctx:null});}
  async unlockSound(){
    try{this.ctx??=new(window.AudioContext||window.webkitAudioContext)();await this.ctx.resume();}catch{this.onNotice('종료음을 켜지 못했어요. 화면 안내를 함께 확인해주세요.');}
  }
  beep(){try{const c=this.ctx;if(!c||c.state!=='running')return;const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.setValueAtTime(.16,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.5);o.start();o.stop(c.currentTime+.5);}catch{}}
  async start(){
    if(this.active||this.starting)throw Error('이미 녹음을 시작하고 있어요.');this.starting=true;
    let stream;
    try{
      await this.unlockSound();
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('마이크를 사용할 수 없어요. HTTPS 주소를 최신 Safari 또는 Chrome에서 열어주세요.');
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(document.hidden){stream.getTracks().forEach(t=>t.stop());throw Error('앱 화면을 연 상태에서 다시 녹음해주세요.');}
      const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      this.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);this.chunks=[];this.reason='manual';this.stopped=false;
      this.recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data);};
      this.recorder.onerror=()=>{this.reason='error';this.stop('error');};
      this.recorder.onstop=()=>this.complete();
      for(const track of stream.getTracks())track.onended=()=>this.stop('interrupted');
      this.recorder.start(250);this.active=true;this.started=Date.now();this.onTick(0);
      this.timer=setInterval(()=>{const ms=Date.now()-this.started;this.onTick(Math.min(180,Math.floor(ms/1000)));if(ms>=SEGMENT_MS)this.stop('limit');},200);
      this.limit=setTimeout(()=>this.stop('limit'),SEGMENT_MS);
    }catch(e){stream?.getTracks().forEach(t=>t.stop());throw e;}finally{this.starting=false;}
  }
  stop(reason='manual'){
    if(!this.active)return;this.active=false;this.reason=reason;clearInterval(this.timer);clearTimeout(this.limit);
    if(reason==='limit')this.beep();
    if(this.recorder.state!=='inactive')this.recorder.stop();else this.complete();
  }
  complete(){
    if(this.stopped)return;this.stopped=true;this.active=false;clearInterval(this.timer);clearTimeout(this.limit);
    const rec=this.recorder;rec.stream.getTracks().forEach(t=>{t.onended=null;t.stop();});
    const blob=this.reason==='error'?null:new Blob(this.chunks,{type:rec.mimeType.split(';')[0]});this.chunks=[];
    rec.ondataavailable=rec.onstop=rec.onerror=null;this.recorder=null;this.onStop(blob,this.reason);
  }
}
