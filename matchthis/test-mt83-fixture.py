#!/usr/bin/env python3
"""Non-production MT83 fixture: ten entrants, approved A1-A10, unweighed 0 g.
HTTP roundtrip persists real POSTed JSON to test-only file for reload assertions.
"""
import json,os,sys,threading,urllib.parse
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
ROOT=Path(sys.argv[1]).resolve()
STATEFILE=Path(sys.argv[2]).resolve()
PLAYERS=[{'id':f'p{i:02d}','firstName':f'JAN{i:02d}','lastName':f'TEST{i:02d}','archived':False,'isReservation':False,'aliases':[]} for i in range(1,11)]
ENTRIES=[{'competitorId':p['id'],'competitorName':p['lastName']+' '+p['firstName'],
          'peg':i,'sector':'A','weightG':None} for i,p in enumerate(PLAYERS,1)]
TOUR={'id':'round1','name':'TURA 1','date':'2026-12-10','status':'DRAFT',
      'sourceOfficial':False,'drawPublished':True,'mt55Entries':ENTRIES,
      'mt55SectorPlan':{'pegs':list(range(1,11)),'sectors':1,'sizes':[10]},
      'results':[],'sectorCount':1}
EVENT={'id':'test-event','name':'TEST ZERO PZW','year':2026,'date':'2026-12-10',
       'kind':'EVENT','type':'event','rounds':[TOUR],
       'entrantIds':[p['id'] for p in PLAYERS],
       'mt63ConfirmedIds':[p['id'] for p in PLAYERS]}
STATE={'revision':1,'data':{'players':PLAYERS,'events':[EVENT],'cycles':[]}}
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
   return self.send(200,(ROOT/'MatchThis_MT-83_OGLADACZ.html').read_bytes(),'text/html; charset=utf-8')
  if url.path in ('/panel.php','/admin.html'):
   return self.send(200,(ROOT/'MatchThis_MT-83.html').read_bytes(),'text/html; charset=utf-8')
  if url.path in ('/judge.html',):
   return self.send(200,(ROOT/'MatchThis_MT-83_SEDZIA.html').read_bytes(),'text/html; charset=utf-8')
  if url.path=='/mt73-state.php':
   with LOCK:
    response={'ok':True,'revision':STATE['revision'],'data':STATE['data']} if 'public' in urllib.parse.parse_qs(url.query) else {'ok':True,'role':'admin','csrf':'fixture','state':STATE}
    return self.send(200,json.dumps(response,ensure_ascii=False))
  if url.path=='/mt60-draws.php':return self.send(200,'{"draws":[]}')
  if url.path.endswith('.png'):return self.send(404,'{}')
  return self.send(404,'{"error":"not found"}')
 def do_POST(self):
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
 ThreadingHTTPServer(('127.0.0.1',8783),App).serve_forever()
