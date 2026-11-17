<?php
declare(strict_types=1);
/* MT89 one-time merge PEIL ANNA. Central state only; no accounts/auth, round scores
   or other sports records. The old spelling PEL remains in archival aliases/sourceName. */
$mode=$argv[1]??'';
if(!in_array($mode,['check','apply','verify'],true))throw new RuntimeException('Usage: check|apply|verify');
$web=getenv('HOME').'/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html';
$private=$web.'/.mt41-private';
$stage=getenv('HOME').'/matchthis-independent/mt89-peil-20261117-r2';
$from='mt2026-person-peil-anna';
$to='mt2025-float_king_2025-person-60';
$backup=$stage.'/before-peil-identity-merge.json';
$drawBackup=$stage.'/before-peil-published-draws.json';
$drawFile=$private.'/mt60-published-draws.json';
foreach([$web,$private,$stage] as $p)if(!is_dir($p)||is_link($p))throw new RuntimeException('Unsafe directory');
require_once $web.'/mt73-store.php';
$lock=$private.'/mt73.lock';
if(is_link($lock)||!is_file($lock))throw new RuntimeException('Unsafe central lock');
$f=fopen($lock,'c');if(!$f||!flock($f,LOCK_EX))throw new RuntimeException('Lock failed');
function peil_count(mixed $x,string $id):int{
 if(is_array($x)){$n=0;foreach($x as $v)$n+=peil_count($v,$id);return $n;}
 return (int)(is_string($x)&&$x===$id);
}
function peil_key_count(mixed $x,string $id):int{
 if(!is_array($x))return 0;
 $n=0;foreach($x as $k=>$v){if(is_string($k)&&$k===$id)$n++;$n+=peil_key_count($v,$id);}return $n;
}
function peil_replace(mixed $x,string $from,string $to):mixed{
 if(!is_array($x))return is_string($x)&&$x===$from?$to:$x;
 $out=[];
 foreach($x as $key=>$v){
  $nextKey=is_string($key)&&$key===$from?$to:$key;
  if($nextKey!==$key&&array_key_exists($nextKey,$x))throw new RuntimeException('ID key collision');
  $out[$nextKey]=peil_replace($v,$from,$to);
 }
 return $out;
}
function peil_rows(array $data,array $ids):array{
 $out=[];$collisions=[];
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$rkey)
  foreach($data[$group] as $i=>$event)foreach(($event[$rkey]??[]) as $j=>$tour){
   $both=[];
   foreach(($tour['results']??[]) as $k=>$r){
    $id=$r['competitorId']??null;
    $out[$group.'/'.$i.'/'.$j.'/'.$k]=$r;
    if(in_array($id,$ids,true))$both[$id]=true;
   }
   if(count($both)>1)$collisions[]=$group.'/'.$i.'/'.$j;
  }
 if($collisions)throw new RuntimeException('Both IDs compete in same tour');
 return $out;
}
$drawLock=$private.'/mt60-published-draws.lock';
if(is_link($drawLock)||is_link($drawFile)||!is_file($drawFile))throw new RuntimeException('Unsafe published draws path');
$g=fopen($drawLock,'c');if(!$g||!flock($g,LOCK_EX))throw new RuntimeException('Cannot lock published draws');
try{
 $draws=json_decode(file_get_contents($drawFile),true,512,JSON_THROW_ON_ERROR);
 if(!is_array($draws)||!array_is_list($draws))throw new RuntimeException('Invalid draw list');
 $original=mt73_read();$db=$original['data'];mt73_validate($db);
 if($mode==='verify'){
  $p=array_values(array_filter($db['players'],fn($x)=>($x['firstName']??'')==='ANNA'&&($x['lastName']??'')==='PEIL'));
  if(count($p)!==1||$p[0]['id']!==$to||peil_count($db,$from)!==0||peil_key_count($db,$from)!==0||peil_count($draws,$from)!==0)throw new RuntimeException('Post-merge player/draw identity check failed');
  $r=peil_rows($db,[$to]);$results=array_values(array_filter($r,fn($x)=>($x['competitorId']??null)===$to));
  if(count($results)!==18)throw new RuntimeException('Post-merge results not 18');
  foreach($results as $row)if(($row['competitorName']??null)!=='PEIL ANNA')throw new RuntimeException('Post-merge spelling not unified');
  if(peil_count($draws,$to)!==2)throw new RuntimeException('Post-merge published draw references missing');
  echo 'MT89_PEIL_VERIFIED one_player=1 results=18 draw_refs=2 revision='.$original['revision']."\n";exit;
 }
 $ps=[];foreach($db['players'] as $i=>$p)if(in_array($p['id']??'',[$to,$from],true))$ps[$p['id']]=$i;
 if(count($ps)!==2)throw new RuntimeException('Exactly two known IDs required');
 foreach([$to,$from] as $id){
  $p=$db['players'][$ps[$id]];
  if(($p['firstName']??'')!=='ANNA'||($p['lastName']??'')!=='PEIL'||!empty($p['archived']))throw new RuntimeException('Player attributes differ');
 }
 if(!in_array('PEL ANNA',$db['players'][$ps[$to]]['aliases']??[],true)||
    !in_array('PEIL ANNA',$db['players'][$ps[$to]]['aliases']??[],true))throw new RuntimeException('Historical aliases missing');
 foreach(scandir($private) as $file){
  if(in_array($file,['.','..','mt73.lock','state-mt73.json','mt60-published-draws.json'],true))continue;
  $p=$private.'/'.$file;
  if(!is_file($p)||!preg_match('/\.(json|php|sqlite|db)$/i',$file))continue;
  if(filesize($p)>12000000)throw new RuntimeException('Uninspected other state');
  if(str_contains(file_get_contents($p),$from))throw new RuntimeException('ID used outside central store: '.$file);
 }
 if(peil_count($db,$from)!==12||peil_count($db,$to)!==17||peil_key_count($db,$from)!==1)throw new RuntimeException('State reference counts changed');
 if(peil_count($draws,$from)!==2||peil_count($draws,$to)!==0)throw new RuntimeException('Published draw reference counts changed');
 $rows=peil_rows($db,[$from,$to]);$nOld=0;$nNew=0;
 foreach($rows as $r){
  $id=$r['competitorId']??'';
  if($id===$from||$id===$to){
   if(!in_array($r['competitorName']??'', ['PEL ANNA','PEIL ANNA'],true))throw new RuntimeException('Unexpected competitor name');
   if($id===$from)$nNew++;else $nOld++;
  }
 }
 if($nNew!==6||$nOld!==12)throw new RuntimeException('Result counts changed '.$nOld.'/'.$nNew);
 $next=peil_replace($db,$from,$to);
 $nextDraws=peil_replace($draws,$from,$to);
 if(peil_count($nextDraws,$from)!==0||peil_count($nextDraws,$to)!==2)throw new RuntimeException('Published draws not merged');
 foreach($draws as $i=>$draw){
  if(!isset($draw['rows'])||!is_array($draw['rows']))throw new RuntimeException('Invalid draw rows');
  foreach($draw['rows'] as $j=>$row){
   $target=$row;
   if(($target['competitorId']??'')===$from)$target['competitorId']=$to;
   if($target!==$nextDraws[$i]['rows'][$j])throw new RuntimeException('Unexpected published draw change');
  }
 }
 array_splice($next['players'],$ps[$from],1);
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$key){
  foreach($next[$group] as &$event){
   if(!isset($event[$key])||!is_array($event[$key]))continue;
   foreach($event[$key] as &$tour){
    if(!isset($tour['results'])||!is_array($tour['results']))continue;
    foreach($tour['results'] as &$result){
     if(($result['competitorId']??'')===$to&&($result['competitorName']??'')==='PEL ANNA')
      $result['competitorName']='PEIL ANNA';
    }
    unset($result);
   }
   unset($tour);
  }
  unset($event);
 }
 mt73_validate($next);
 if(peil_count($next,$from)!==0||peil_key_count($next,$from)!==0)throw new RuntimeException('Old identity still referenced');
 if(count($next['players'])!==count($db['players'])-1)throw new RuntimeException('Wrong player count');
 $nextRows=peil_rows($next,[$to]);
 if(count($nextRows)!==count($rows))throw new RuntimeException('Row count changed');
 $matches=0;
 foreach($rows as $key=>$r){
  $new=$nextRows[$key];$compare=$r;
  if(($compare['competitorId']??'')===$from)$compare['competitorId']=$to;
  if(($compare['competitorId']??'')===$to&&($compare['competitorName']??'')==='PEL ANNA')$compare['competitorName']='PEIL ANNA';
  if($compare!==$new)throw new RuntimeException('Unrequested result modification at '.$key);
  if(($new['competitorId']??'')===$to)$matches++;
 }
 if($matches!==18)throw new RuntimeException('Wrong combined results count');
 foreach(['events','cycles'] as $group)foreach($next[$group] as $e){
  $ids=$e['entrantIds']??[];
  if(count($ids)!==count(array_unique($ids)))throw new RuntimeException('Duplicate event entrants');
 }
 echo 'MT89_PEIL_PREFLIGHT_OK state_refs=12 state_keys=1 draw_refs=2 results=12+6 players='.count($db['players']).' revision='.$original['revision']."\n";
 if($mode==='check')exit;
 if(file_exists($backup)||is_link($backup)||file_exists($drawBackup)||is_link($drawBackup))throw new RuntimeException('Refuse repeated merge');
 $bytes=file_get_contents(mt73_path());$drawBytes=file_get_contents($drawFile);
 foreach([[$backup,$bytes],[$drawBackup,$drawBytes]] as [$dst,$content]){
  $h=fopen($dst,'x');if(!$h)throw new RuntimeException('Backup unavailable');
  chmod($dst,0600);
  if(fwrite($h,$content)!==strlen($content)){fclose($h);throw new RuntimeException('Backup incomplete');}
  fflush($h);fclose($h);
  if(file_get_contents($dst)!==$content)throw new RuntimeException('Backup mismatch');
 }
 $original['data']=$next;$original['revision']++;$original['updatedAt']=gmdate('c');
 $stateSaved=false;$drawSaved=false;
 try{
  mt73_atomic(mt73_path(),mt73_json($original));$stateSaved=true;
  mt73_atomic($drawFile,mt73_json($nextDraws));$drawSaved=true;
  if(mt73_read()!==$original||json_decode(file_get_contents($drawFile),true,512,JSON_THROW_ON_ERROR)!==$nextDraws)
   throw new RuntimeException('Server state or draw readback mismatch');
 }catch(Throwable $e){
  if($stateSaved)mt73_atomic(mt73_path(),$bytes);
  if($drawSaved)mt73_atomic($drawFile,$drawBytes);
  throw $e;
 }
 echo 'MT89_PEIL_SAVED_AND_RELOADED one_player=1 results=18 draw_refs=2 revision='.$original['revision']."\n";
}finally{flock($g,LOCK_UN);fclose($g);flock($f,LOCK_UN);fclose($f);}
