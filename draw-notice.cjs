'use strict';
/* V240 – one compact format for each competitor's published T1/T2 draw. */
function drawSpot(value){
  if(!value||typeof value!=='object')return '';
  const sector=String(value.sector??'').trim().toLocaleUpperCase('pl-PL');
  const stand=Number(value.stand);
  if(!sector||!Number.isInteger(stand)||stand<=0)return '';
  return sector+' '+stand;
}
function drawNoticeText(t1,t2){
  const a=drawSpot(t1),b=drawSpot(t2);
  return [
    a?'TURA 1 – '+a:null,
    b?'TURA 2 – '+b:null,
    'Powodzenia! 🎣'
  ].filter(Boolean).join('\n');
}
const DRAW_NOTICE_TITLE='NOWE LOSOWANIE NA DZIŚ';
module.exports={drawSpot,drawNoticeText,DRAW_NOTICE_TITLE};
