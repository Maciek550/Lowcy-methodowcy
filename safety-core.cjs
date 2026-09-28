'use strict';
// Pure preflight checks; never mutate competition layouts or player accounts.
function standState({bank1,bank2,disabledStands=[],participants=0}) {
  const lower=Number(bank1),upper=Number(bank2),people=Number(participants);
  const physical=lower+upper,issues=[];
  if(!Number.isInteger(lower)||lower<0||!Number.isInteger(upper)||upper<0||physical<1)
    issues.push('Nieprawidłowy fizyczny układ brzegów.');
  if(!Number.isInteger(people)||people<1)issues.push('Brak zawodników na liście głównej.');
  const raw=Array.isArray(disabledStands)?disabledStands:[];
  const normalized=[...new Set(raw.map(Number))].sort((a,b)=>a-b);
  if(normalized.length!==raw.length||normalized.some(x=>!Number.isInteger(x)||x<1||x>physical))
    issues.push('Wyłączenia zawierają powtórzenie lub numer poza łowiskiem.');
  const available=physical-normalized.length;
  if(available!==people)issues.push('Do losowania: '+people+' zawodników, dostępnych stanowisk: '+available+'.');
  return {bank1:lower,bank2:upper,physical,disabled:normalized,disabledCount:normalized.length,available,participants:people,ready:issues.length===0,issues};
}
function absencePreview({bank1,bank2,disabledStands=[],participants,stand}){
  const state=standState({bank1,bank2,disabledStands,participants});
  const n=Number(stand),issues=[];
  if(!Number.isInteger(n)||n<1||n>state.physical)issues.push('Wybierz numer stanowiska z fizycznej mapy.');
  if(state.disabled.includes(n))issues.push('To stanowisko jest już wyłączone.');
  if(state.participants<2)issues.push('Nie można wypisać ostatniego zawodnika.');
  const afterPlayers=state.participants-1,afterAvailable=state.available-1;
  if(afterPlayers!==afterAvailable)issues.push('Po zmianie pozostanie '+afterPlayers+' zawodników i '+afterAvailable+' dostępnych stanowisk. Najpierw skoryguj wcześniejszą różnicę.');
  return {...state,excludedStand:n,afterPlayers,afterAvailable,ready:issues.length===0&&state.physical>0,issues};
}
function resultsPreflight({activeUserIds=[],draws=[],results=[],items=[],round=1}){
  const active=[...new Set(activeUserIds.map(Number))].filter(Number.isInteger);
  const dr=new Set(draws.filter(r=>Number(r.round)===Number(round)).map(r=>Number(r.user_id)));
  const rs=new Map(results.filter(r=>Number(r.round)===Number(round)).map(r=>[Number(r.user_id),r]));
  const itemIds=new Set(items.filter(r=>Number(r.round)===Number(round)).map(r=>Number(r.user_id)));
  return {
    participants:active.length,
    withoutDraw:active.filter(id=>!dr.has(id)),
    withoutResult:active.filter(id=>!rs.has(id)&&!itemIds.has(id)),
    zeroResults:active.filter(id=>rs.has(id)&&Number(rs.get(id).weight||0)===0),
    // Pending offline entries live on judges' devices, not in server data.
    offlineJudgeEntriesVerified:false
  };
}
module.exports={standState,absencePreview,resultsPreflight};
