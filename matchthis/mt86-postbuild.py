#!/usr/bin/env python3
"""MT86: allow browser form submission to new player login and logout endpoints."""
from pathlib import Path
p=Path('matchthis/MatchThis_MT-86_OGLADACZ.html')
s=p.read_text('utf8')
old="if(e.target.id==='mtLoginForm'||e.target.id==='mtLogoutForm')return;"
new="if(e.target.id==='mtLoginForm'||e.target.id==='mtLogoutForm'||e.target.id==='mt86-player-form'||e.target.id==='mt86-player-logout-form')return;"
assert s.count(old)==1,('existing form guard changed',s.count(old))
s=s.replace(old,new,1)
old='<form action="/player-logout.php" method="post" style="margin:0;display:inline">'
new='<form id="mt86-player-logout-form" action="/player-logout.php" method="post" style="margin:0;display:inline">'
assert s.count(old)==1
s=s.replace(old,new,1)
# Legacy button CSS overrides the native HTML hidden attribute; enforce actual visual hiding.
old='</style>\\n</head>\\n<body data-version="MT-86"'
new='</style>\\n<style>#mtLoginOpen[hidden],#mt86-player-tools[hidden]{display:none!important}</style>\\n</head>\\n<body data-version="MT-86"'
assert s.count(old)==1
s=s.replace(old,new,1)
p.write_text(s,'utf8')
print('MT86_PLAYER_FORM_DISPATCH_FIXED')
