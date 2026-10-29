"""Local-only Korean transcription. No audio or transcripts are logged or retained."""
import os, json, base64, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from faster_whisper import WhisperModel

model = None
model_error = None
lock = threading.Lock()
def load():
    global model, model_error
    try:
        model = WhisperModel(os.environ.get('WHISPER_MODEL', 'base'), device='cpu', compute_type='int8', download_root=os.environ.get('MODEL_CACHE', './work/models'), cpu_threads=4)
        print('Korean speech model ready', flush=True)
    except Exception as e:
        model_error = type(e).__name__
        print('Speech model could not load: '+model_error, flush=True)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def send_json(self, code, payload):
        data=json.dumps(payload,ensure_ascii=False).encode('utf-8')
        self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        self.send_json(200, {'ready':model is not None,'error':model_error})
    def do_POST(self):
        if self.path!='/transcribe': return self.send_json(404, {'error':'not found'})
        if model is None: return self.send_json(503, {'error':'음성 모델 준비 중이에요. 녹음은 보관되어 있으니 잠시 후 다시 시도해주세요.'})
        size=int(self.headers.get('Content-Length','0'))
        if size>20_000_000: return self.send_json(413,{'error':'데모에서는 3분 이내의 짧은 녹음을 사용해주세요.'})
        path=None
        try:
            payload=json.loads(self.rfile.read(size));audio=base64.b64decode(payload['audio'],validate=True)
            with tempfile.NamedTemporaryFile(suffix='.audio',delete=False) as f: f.write(audio);path=f.name
            with lock:
                segments,_=model.transcribe(path,language='ko',beam_size=5,vad_filter=True,condition_on_previous_text=False)
                text=' '.join(s.text.strip() for s in segments).strip()
            if not text: return self.send_json(422,{'error':'말소리를 찾지 못했어요. 원본을 듣거나 직접 글을 입력할 수 있어요.'})
            self.send_json(200,{'text':text,'provider':'local-faster-whisper'})
        except Exception:
            self.send_json(500,{'error':'음성을 변환하지 못했어요. 원본은 기기에 남아 있어요.'})
        finally:
            if path and os.path.isfile(path):os.remove(path)

if __name__=='__main__':
    threading.Thread(target=load,daemon=True).start()
    print('Speech service: 127.0.0.1:8788',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8788),Handler).serve_forever()
