#!/usr/bin/env python3
"""Non-production MT83 fixture: ten entrants, approved A1-A10, unweighed 0 g.
HTTP roundtrip persists real POSTed JSON to test-only file for reload assertions.
"""
import json,os,sys,threading,urllib.parse,copy
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
ROOT=Path(sys.argv[1]).resolve()
VERSION=os.environ.get('MT_TEST_VERSION','84')
STATEFILE=Path(sys.argv[2]).resolve()
STATE=json.loads(Path(__file__).with_name('mt84-fixture.json').read_text())
INITIAL_STATE=copy.deepcopy(STATE)
LOCK=threading.RLock()
class App(BaseHTTPRequestHandler):
 def log_message(self,*_):pass
 def send(self,code,body,mime='application/json'):
  data=body.encode('utf-8') if isinstance(body,str) else body
  self.send_response(code);self.send_header('Content-Type',mime)
  self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)))
  self.end_headers();self.wfile.write(data)
 def do_GET(self):
  url=urllib.parse.urlparse(self.path)
  if url.path in ('/','/index.html'):
   return self.send(200,(ROOT/f'MatchThis_MT-{VERSION}_OGLADACZ.html').read_bytes(),'text/html; charset=utf-8')
  if url.path in ('/panel.php','/admin.html'):
   return self.send(200,(ROOT/f'MatchThis_MT-{VERSION}.html').read_bytes(),'text/html; charset=utf-8')
  if url.path in ('/judge.html',):
   return self.send(200,(ROOT/f'MatchThis_MT-{VERSION}_SEDZIA.html').read_bytes(),'text/html; charset=utf-8')
  if url.path=='/mt73-state.php':
   with LOCK:
    response={'ok':True,'revision':STATE['revision'],'data':STATE['data']} if 'public' in urllib.parse.parse_qs(url.query) else {'ok':True,'role':'admin','csrf':'fixture','state':STATE}
    return self.send(200,json.dumps(response,ensure_ascii=False))
  if url.path=='/mt60-draws.php':return self.send(200,'{"draws":[]}')
  if url.path.endswith('.png'):return self.send(404,'{}')
  return self.send(404,'{"error":"not found"}')
 def do_POST(self):
  if urllib.parse.urlparse(self.path).path=='/mt83-reset':
   with LOCK:
    STATE.clear();STATE.update(copy.deepcopy(INITIAL_STATE))
    STATEFILE.write_text(json.dumps(STATE,ensure_ascii=False))
    return self.send(200,'{"ok":true}')
  if urllib.parse.urlparse(self.path).path!='/mt73-state.php':return self.send(404,'{}')
  payload=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
  if payload.get('op')!='save':return self.send(400,'{"error":"only save supported"}')
  with LOCK:
   if payload.get('revision')!=STATE['revision']:return self.send(409,'{"error":"revision conflict"}')
   if not isinstance(payload.get('data',{}).get('events'),list):return self.send(400,'{"error":"bad events"}')
   STATE['data']=payload['data'];STATE['revision']+=1
   STATEFILE.write_text(json.dumps(STATE,ensure_ascii=False))
   return self.send(200,json.dumps({'ok':True,'state':STATE},ensure_ascii=False))
if __name__=='__main__':
 print('MT83_TEST_FIXTURE_ON_127_0_0_1',flush=True)
 ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('MT_TEST_PORT','8785'))),App).serve_forever()
