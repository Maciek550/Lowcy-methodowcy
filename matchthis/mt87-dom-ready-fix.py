#!/usr/bin/env python3
"""MT87: eliminate production-only race: signup CSRF input is parsed after asynchronous app bootstrap.
Do not change signup payload, identity checks, other roles or server data.
"""
from pathlib import Path
import hashlib
base=Path("matchthis")
p=base/"MatchThis_MT-87_OGLADACZ.html"
old_sha="d325e33d7d3b598457c53e52439c9993c876f21ab2cd4d385fedac78ad21d01a"
new_sha="c79479c2af9af94f795474d8ce0407730d6a0b7f3d6cc36c546737cd0315a596"
assert hashlib.sha256(p.read_bytes()).hexdigest()==old_sha,"MT87 viewer base changed"
s=p.read_text("utf-8")
a=" const reg=document.getElementById('mt87-register-csrf');if(reg&&j.registrationCsrf)reg.value=j.registrationCsrf;"
b=" if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));\n"+a
assert s.count(a)==1
s=s.replace(a,b,1)
p.write_text(s,"utf-8")
assert hashlib.sha256(p.read_bytes()).hexdigest()==new_sha
deploy=base/"deploy-mt87-small2.sh"
d=deploy.read_text("utf-8")
assert d.count(old_sha)>=2
d=d.replace(old_sha,new_sha)
# Only the upload precheck may accept the immediately prior SHA-staged viewer.
# The installed site's checksum MUST be the new SHA.
stage_line='test "$(sha256sum "$stage/MatchThis_MT-87_OGLADACZ.html"|awk \'{print $1}\')" = '+new_sha
assert d.count(stage_line)==1,("staging SHA check changed",d.count(stage_line))
d=d.replace(stage_line,
  'stage_viewer_sha="$(sha256sum "$stage/MatchThis_MT-87_OGLADACZ.html"|awk \'{print $1}\')"\n'
  'test "$stage_viewer_sha" = '+new_sha+' || test "$stage_viewer_sha" = '+old_sha,1)
deploy.write_text(d,"utf-8")
print("MT87_RACE_FIXED_AFTER_DOM_READY_SHA_VERIFIED",new_sha)
