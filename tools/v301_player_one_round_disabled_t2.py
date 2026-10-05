from pathlib import Path

app_path=Path('app.js')
server_path=Path('server.cjs')
app=app_path.read_text(encoding='utf-8')
server=server_path.read_text(encoding='utf-8')

# Version bump.
app=app.replace("const CLIENT_VERSION='300';const CLIENT_VERSION_NAME='V300_ROUND_CHOICE_CONTRAST';", "const CLIENT_VERSION='301';const CLIENT_VERSION_NAME='V301_ONE_ROUND_DISABLED_T2';", 1)
server=server.replace("const APP_VERSION = '300';", "const APP_VERSION = '301';", 1)
server=server.replace("const APP_VERSION_NAME = 'V300_ROUND_CHOICE_CONTRAST';", "const APP_VERSION_NAME = 'V301_ONE_ROUND_DISABLED_T2';", 1)

old_mobile = '''  const b=(panel,label,cls='')=>'<button type="button" class="'+cls+' '+(p===panel?'active':'')+'" onclick="showPlayerMobilePanel(\\''+panel+'\\',event)">'+label+'</button>';
  return '<div class="playerMobileDashboard">'
    +'<div class="playerDrawStickySlot"><div class="card playerDrawHeaderCard playerUnifiedNav">'
    +'<div class="playerPrimaryNav">'
      +b('draw1',(oneRound?'Losowanie':'Losowanie<br>Tura 1')+playerDrawStar(d,1),'drawTile')
      +(oneRound?'':b('draw2','Losowanie<br>Tura 2'+playerDrawStar(d,2),'drawTile'))
      +b('t1',(oneRound?'Wyniki':'Wyniki<br>Tura 1')+playerResultStar(d,1),'resultTile')
      +(oneRound?'':b('t2','Wyniki<br>Tura 2'+playerResultStar(d,2),'resultTile'))
      +'<div class="playerPrimaryStack">'+b('general','GENERAL','resultTile generalTile')+b('stats','STATYSTYKI','resultTile statsTile')+'</div>'
    +'</div>'
    +'<div class="playerMapNav playerQuickInfoNav '+(early?'withEarlyList':'withoutEarlyList')+'">'+b('info','INFO','infoTile')+b('map1',oneRound?'MAPA':'MAPA T1','mapTile')+(oneRound?'':b('map2','MAPA T2','mapTile'))+(early?b('list','LISTA <span class="playerEarlyListCount">'+(d.activeEntries||[]).length+'</span>','earlyListTile'):'')+'</div>'''
new_mobile = '''  const b=(panel,label,cls='',disabled=false)=>'<button type="button" class="'+cls+' '+(disabled?'disabledRoundTile ':'')+(p===panel&&!disabled?'active':'')+'" '+(disabled?'disabled aria-disabled="true" title="Niedostępne w zawodach 1-turowych" style="background:#59656e!important;color:#d6dce0!important;border-color:#7d8991!important;filter:grayscale(1);cursor:not-allowed;opacity:.72"':'onclick="showPlayerMobilePanel(\\''+panel+'\\',event)"')+'>'+label+(disabled?'<small style="display:block;font-size:9px;line-height:1.1;margin-top:3px;font-weight:800">NIEDOSTĘPNE</small>':'')+'</button>';
  return '<div class="playerMobileDashboard">'
    +'<div class="playerDrawStickySlot"><div class="card playerDrawHeaderCard playerUnifiedNav">'
    +'<div class="playerPrimaryNav">'
      +b('draw1','Losowanie<br>Tura 1'+playerDrawStar(d,1),'drawTile')
      +b('draw2','Losowanie<br>Tura 2','drawTile',oneRound)
      +b('t1','Wyniki<br>Tura 1'+playerResultStar(d,1),'resultTile')
      +b('t2','Wyniki<br>Tura 2','resultTile',oneRound)
      +'<div class="playerPrimaryStack">'+b('general','GENERAL','resultTile generalTile')+b('stats','STATYSTYKI','resultTile statsTile')+'</div>'
    +'</div>'
    +'<div class="playerMapNav playerQuickInfoNav '+(early?'withEarlyList':'withoutEarlyList')+'">'+b('info','INFO','infoTile')+b('map1','MAPA T1','mapTile')+b('map2','MAPA T2','mapTile',oneRound)+(early?b('list','LISTA <span class="playerEarlyListCount">'+(d.activeEntries||[]).length+'</span>','earlyListTile'):'')+'</div>'''
if old_mobile not in app:
    raise SystemExit('V301: mobile navigation anchor not found')
app=app.replace(old_mobile,new_mobile,1)

old_desktop = '''  const b=(panel,label,cls='')=>'<button type="button" class="'+cls+' '+(p===panel?'active':'')+'" onclick="showPlayerDesktopPanel(\\''+panel+'\\',event)">'+label+'</button>';
  return '<div class="playerDesktopDashboardV56 playerDesktopDashboardV55">'
    +'<div class="playerDesktopStickySlot"><div class="card playerDesktopUnifiedNav">'
    +'<div class="playerDesktopPrimaryNav">'
      +b('draw1',(oneRound?'Losowanie':'Losowanie<br>Tura 1')+playerDrawStar(d,1),'drawTile')
      +(oneRound?'':b('draw2','Losowanie<br>Tura 2'+playerDrawStar(d,2),'drawTile'))
      +b('t1',(oneRound?'Wyniki':'Wyniki<br>Tura 1')+playerResultStar(d,1),'resultTile')
      +(oneRound?'':b('t2','Wyniki<br>Tura 2'+playerResultStar(d,2),'resultTile'))
      +'<div class="playerPrimaryStack">'+b('general','GENERAL','resultTile generalTile')+b('stats','STATYSTYKI','resultTile statsTile')+'</div>'
    +'</div>'
    +'<div class="playerDesktopSubNav playerDesktopMapsOnly playerQuickInfoNav '+(early?'withEarlyList':'withoutEarlyList')+'">'+b('info','INFO','infoTile')+b('map1',oneRound?'MAPA':'MAPA T1','mapTile')+(oneRound?'':b('map2','MAPA T2','mapTile'))+(early?b('list','LISTA <span class="playerEarlyListCount">'+(d.activeEntries||[]).length+'</span>','earlyListTile'):'')+'</div>'''
new_desktop = '''  const b=(panel,label,cls='',disabled=false)=>'<button type="button" class="'+cls+' '+(disabled?'disabledRoundTile ':'')+(p===panel&&!disabled?'active':'')+'" '+(disabled?'disabled aria-disabled="true" title="Niedostępne w zawodach 1-turowych" style="background:#59656e!important;color:#d6dce0!important;border-color:#7d8991!important;filter:grayscale(1);cursor:not-allowed;opacity:.72"':'onclick="showPlayerDesktopPanel(\\''+panel+'\\',event)"')+'>'+label+(disabled?'<small style="display:block;font-size:9px;line-height:1.1;margin-top:3px;font-weight:800">NIEDOSTĘPNE</small>':'')+'</button>';
  return '<div class="playerDesktopDashboardV56 playerDesktopDashboardV55">'
    +'<div class="playerDesktopStickySlot"><div class="card playerDesktopUnifiedNav">'
    +'<div class="playerDesktopPrimaryNav">'
      +b('draw1','Losowanie<br>Tura 1'+playerDrawStar(d,1),'drawTile')
      +b('draw2','Losowanie<br>Tura 2','drawTile',oneRound)
      +b('t1','Wyniki<br>Tura 1'+playerResultStar(d,1),'resultTile')
      +b('t2','Wyniki<br>Tura 2','resultTile',oneRound)
      +'<div class="playerPrimaryStack">'+b('general','GENERAL','resultTile generalTile')+b('stats','STATYSTYKI','resultTile statsTile')+'</div>'
    +'</div>'
    +'<div class="playerDesktopSubNav playerDesktopMapsOnly playerQuickInfoNav '+(early?'withEarlyList':'withoutEarlyList')+'">'+b('info','INFO','infoTile')+b('map1','MAPA T1','mapTile')+b('map2','MAPA T2','mapTile',oneRound)+(early?b('list','LISTA <span class="playerEarlyListCount">'+(d.activeEntries||[]).length+'</span>','earlyListTile'):'')+'</div>'''
if old_desktop not in app:
    raise SystemExit('V301: desktop navigation anchor not found')
app=app.replace(old_desktop,new_desktop,1)

# Defensive block: T2 panels cannot be opened programmatically for one-round events.
needle_mobile = "  const allowed=['info','draw1','draw2','map1','map2','t1','t2','general','stats','list'];\n  if(panel==='list'&&!playerEarlyListAvailable(CURRENT_DETAIL?.competition))return;"
replace_mobile = "  const allowed=['info','draw1','draw2','map1','map2','t1','t2','general','stats','list'];\n  if(Number(CURRENT_DETAIL?.competition?.round_count||2)===1&&['draw2','map2','t2'].includes(panel))return;\n  if(panel==='list'&&!playerEarlyListAvailable(CURRENT_DETAIL?.competition))return;"
count=app.count(needle_mobile)
if count != 2:
    raise SystemExit(f'V301: expected 2 player panel guards, got {count}')
app=app.replace(needle_mobile,replace_mobile,2)

if "V301_ONE_ROUND_DISABLED_T2" not in app or "disabledRoundTile" not in app or "['draw2','map2','t2'].includes(panel)" not in app:
    raise SystemExit('V301: validation failed')

app_path.write_text(app,encoding='utf-8')
server_path.write_text(server,encoding='utf-8')
