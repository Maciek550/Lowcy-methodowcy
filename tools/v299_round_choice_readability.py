from pathlib import Path

server_path = Path('server.cjs')
app_path = Path('app.js')
server = server_path.read_text(encoding='utf-8')
app = app_path.read_text(encoding='utf-8')

server = server.replace("const APP_VERSION = '298';", "const APP_VERSION = '299';", 1)
server = server.replace("const APP_VERSION_NAME = 'V298_ONE_TWO_ROUNDS';", "const APP_VERSION_NAME = 'V299_ROUND_CHOICE_READABILITY';", 1)
app = app.replace("const CLIENT_VERSION='298';const CLIENT_VERSION_NAME='V298_ONE_TWO_ROUNDS';", "const CLIENT_VERSION='299';const CLIENT_VERSION_NAME='V299_ROUND_CHOICE_READABILITY';", 1)

old = '''<div class=\"competitionRoundChoice\" role=\"radiogroup\" aria-label=\"Liczba tur\"><label class=\"checkline\"><input type=\"radio\" name=\"cRoundCount\" value=\"1\"> <b>Zawody 1-turowe</b></label><label class=\"checkline\"><input type=\"radio\" name=\"cRoundCount\" value=\"2\" checked> <b>Zawody 2-turowe</b></label></div>'''
new = '''<div class=\"competitionRoundChoice\" role=\"radiogroup\" aria-label=\"Liczba tur\" style=\"display:grid;gap:10px;margin:12px 0 18px\"><label class=\"checkline\" style=\"display:grid;grid-template-columns:28px 1fr;align-items:start;gap:8px;padding:10px 12px;cursor:pointer\"><input type=\"radio\" name=\"cRoundCount\" value=\"1\" style=\"width:20px;height:20px;margin-top:2px\"><span><b style=\"display:block;font-size:18px;line-height:1.25\">Zawody 1-turowe</b><span style=\"display:block;font-size:15px;line-height:1.4;margin-top:3px\">Jedno losowanie, jedna tura wyników. Klasyfikacja końcowa powstaje po Turze 1.</span></span></label><label class=\"checkline\" style=\"display:grid;grid-template-columns:28px 1fr;align-items:start;gap:8px;padding:10px 12px;cursor:pointer\"><input type=\"radio\" name=\"cRoundCount\" value=\"2\" checked style=\"width:20px;height:20px;margin-top:2px\"><span><b style=\"display:block;font-size:18px;line-height:1.25\">Zawody 2-turowe</b><span style=\"display:block;font-size:15px;line-height:1.4;margin-top:3px\">Dwa losowania i dwie tury wyników. Klasyfikacja końcowa powstaje z Tury 1 i Tury 2.</span></span></label></div>'''

if old not in server:
    raise SystemExit('V299: round choice HTML anchor not found')
server = server.replace(old, new, 1)

server_path.write_text(server, encoding='utf-8')
app_path.write_text(app, encoding='utf-8')
