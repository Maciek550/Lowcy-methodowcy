from pathlib import Path

app_path=Path('app.js')
server_path=Path('server.cjs')
app=app_path.read_text(encoding='utf-8')
server=server_path.read_text(encoding='utf-8')

# V301 correction: keep disabled grey T2 tiles in one-round competitions,
# but remove the extra visible "NIEDOSTĘPNE" caption from the tile itself.
# The disabled attribute + grey styling + defensive code guard remain unchanged.
old="+label+(disabled?'<small style=\"display:block;font-size:9px;line-height:1.1;margin-top:3px;font-weight:800\">NIEDOSTĘPNE</small>':'')+'</button>'"
new="+label+'</button>'"
count=app.count(old)
if count != 2:
    raise SystemExit(f'V301 correction: expected 2 disabled-tile captions, got {count}')
app=app.replace(old,new,2)

# Keep the functional safeguards intact.
if "const CLIENT_VERSION='301';const CLIENT_VERSION_NAME='V301_ONE_ROUND_DISABLED_T2';" not in app:
    raise SystemExit('V301 correction: client version marker missing')
if "const APP_VERSION = '301';" not in server:
    raise SystemExit('V301 correction: server version marker missing')
if "disabledRoundTile" not in app:
    raise SystemExit('V301 correction: disabled tile styling missing')
if "['draw2','map2','t2'].includes(panel)" not in app:
    raise SystemExit('V301 correction: defensive T2 guard missing')
if '>NIEDOSTĘPNE</small>' in app:
    raise SystemExit('V301 correction: visible unavailable caption still present')

app_path.write_text(app,encoding='utf-8')
server_path.write_text(server,encoding='utf-8')
