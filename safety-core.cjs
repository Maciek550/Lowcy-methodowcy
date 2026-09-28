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

/**
 * When the final exclusion is cleared after resetting a draw, return to the
 * current roster-sized physical map. While any exclusion remains, preserve
 * every physical stand number and bank boundary (including T2 bank identity).
 */
function planStandRestoration({bank1,bank2,mapMode='TWO_OPPOSITE',previousDisabled=[],nextDisabled=[],activeCount=0,limitPlaces=0}) {
  const old1=Math.max(0,Number(bank1||0)),old2=Math.max(0,Number(bank2||0));
  const wasExcluded=Array.isArray(previousDisabled)&&previousDisabled.length>0;
  const stillExcluded=Array.isArray(nextDisabled)&&nextDisabled.length>0;
  if(!wasExcluded||stillExcluded)return {bank1:old1,bank2:old2,resetLayout:false,resynced:false};
  const players=Math.max(0,Number(activeCount||0)),limit=Math.max(0,Number(limitPlaces||0));
  const target=Math.max(1,players||limit||(old1+old2));
  const new1=mapMode==='ONE_BANK'?target:Math.ceil(target/2);
  const new2=mapMode==='ONE_BANK'?0:Math.floor(target/2);
  return {bank1:new1,bank2:new2,resetLayout:new1!==old1||new2!==old2,resynced:true};
}

module.exports={standState,absencePreview,resultsPreflight,planStandRestoration};
