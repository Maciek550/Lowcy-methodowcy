from pathlib import Path
import runpy
p=Path('tools/v298_patch.py')
t=p.read_text(encoding='utf-8')
start=t.index('create_old="""')
end=t.index("s=rep(s,create_old,create_new,'create competition roundCount')")
block='''create_old="""    let presenceReminderNote;
    try { presenceReminderNote=presenceReminders.normalizeOrganizerNote(b.presenceReminderNote); }
    catch(e) { return sendJson(res,400,{ok:false,error:e.message}); }
    const { rows } = await pool.query(
      `insert into competitions(title,fishery,competition_date,meeting_time,limit_places,status,notes,regulations,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open,presence_reminder_note)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
      [title, fishery, b.competitionDate || null, (/^\\\\d{2}:\\\\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || 'OPEN', String(b.notes||''), String(b.regulations||''), user.id, mapMode, bank1, bank2, sectors, b.signupOpen !== false, presenceReminderNote]
    );"""
create_new="""    let presenceReminderNote;
    try { presenceReminderNote=presenceReminders.normalizeOrganizerNote(b.presenceReminderNote); }
    catch(e) { return sendJson(res,400,{ok:false,error:e.message}); }
    const roundCount=Number(b.roundCount)===1?1:2;
    const { rows } = await pool.query(
      `insert into competitions(title,fishery,competition_date,meeting_time,limit_places,status,notes,regulations,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open,presence_reminder_note,round_count)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`,
      [title, fishery, b.competitionDate || null, (/^\\\\d{2}:\\\\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || 'OPEN', String(b.notes||''), String(b.regulations||''), user.id, mapMode, bank1, bank2, sectors, b.signupOpen !== false, presenceReminderNote, roundCount]
    );"""
'''
t=t[:start]+block+t[end:]
p.write_text(t,encoding='utf-8')
runpy.run_path(str(p),run_name='__main__')
