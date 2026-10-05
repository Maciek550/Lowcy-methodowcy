from pathlib import Path

server_path=Path('server.cjs')
app_path=Path('app.js')
server=server_path.read_text(encoding='utf-8')
app=app_path.read_text(encoding='utf-8')

server=server.replace("const APP_VERSION = '299';","const APP_VERSION = '300';",1)
server=server.replace("const APP_VERSION_NAME = 'V299_ROUND_CHOICE_READABILITY';","const APP_VERSION_NAME = 'V300_ROUND_CHOICE_CONTRAST';",1)
app=app.replace("const CLIENT_VERSION='299';const CLIENT_VERSION_NAME='V299_ROUND_CHOICE_READABILITY';","const CLIENT_VERSION='300';const CLIENT_VERSION_NAME='V300_ROUND_CHOICE_CONTRAST';",1)

server=server.replace('style=\\"display:grid;grid-template-columns:28px 1fr;align-items:start;gap:8px;padding:10px 12px;cursor:pointer\\"','style=\\"display:grid;grid-template-columns:34px 1fr;align-items:start;gap:10px;padding:14px 16px;cursor:pointer;background:#153247;border:1px solid #3e6074;border-radius:12px;color:#f7fbff\\"')
server=server.replace('style=\\"width:20px;height:20px;margin-top:2px\\"','style=\\"width:23px;height:23px;margin-top:2px;accent-color:#2f8cff\\"')
server=server.replace('style=\\"display:block;font-size:18px;line-height:1.25\\"','style=\\"display:block;font-size:20px;line-height:1.25;color:#ffffff;font-weight:800\\"')
server=server.replace('style=\\"display:block;font-size:15px;line-height:1.4;margin-top:3px\\"','style=\\"display:block;font-size:16px;line-height:1.45;margin-top:5px;color:#d7e7f2;font-weight:600\\"')

if "V300_ROUND_CHOICE_CONTRAST" not in server or "color:#ffffff" not in server or "color:#d7e7f2" not in server:
    raise SystemExit('V300: contrast patch validation failed')

server_path.write_text(server,encoding='utf-8')
app_path.write_text(app,encoding='utf-8')
