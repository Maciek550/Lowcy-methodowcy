<?php
declare(strict_types=1);
/* MT89 one-time merge PEIL ANNA. Central state only; no accounts/auth, round scores
   or other sports records. The old spelling PEL remains in archival aliases/sourceName. */
$mode=$argv[1]??'';
if(!in_array($mode,['check','apply','verify'],true))throw new RuntimeException('Usage: check|apply|verify');
$web=getenv('HOME').'/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html';
$private=$web.'/.mt41-private';
$stage=getenv('HOME').'/matchthis-independent/mt89-peil-20261117';
$from='mt2026-person-peil-anna';
$to='mt2025-float_king_2025-person-60';
$backup=$stage.'/before-peil-identity-merge.json';
foreach([$web,$private,$stage] as $p)if(!is_dir($p)||is_link($p))throw new RuntimeException('Unsafe directory');
require_once $web.'/mt73-store.php';
$lock=$private.'/mt73.lock';
if(is_link($lock)||!is_file($lock))throw new RuntimeException('Unsafe central lock');
$f=fopen($lock,'c');if(!$f||!flock($f,LOCK_EX))throw new RuntimeException('Lock failed');
function peil_count(mixed $x,string $id):int{
 if(is_array($x)){$n=0;foreach($x as $v)$n+=peil_count($v,$id);return $n;}
 return (int)(is_string($x)&&$x===$id);
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
try{
 $original=mt73_read();$db=$original['data'];mt73_validate($db);
 if($mode==='verify'){
  $p=array_values(array_filter($db['players'],fn($x)=>($x['firstName']??'')==='ANNA'&&($x['lastName']??'')==='PEIL'));
  if(count($p)!==1||$p[0]['id']!==$to||peil_count($db,$from)!==0)throw new RuntimeException('Post-merge player identity check failed');
  $r=peil_rows($db,[$to]);$results=array_values(array_filter($r,fn($x)=>($x['competitorId']??null)===$to));
  if(count($results)!==18)throw new RuntimeException('Post-merge results not 18');
  foreach($results as $row)if(($row['competitorName']??null)!=='PEIL ANNA')throw new RuntimeException('Post-merge spelling not unified');
  echo 'MT89_PEIL_VERIFIED one_player=1 results=18 revision='.$original['revision']."\n";exit;
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
  if(in_array($file,['.','..','mt73.lock','state-mt73.json'],true))continue;
  $p=$private.'/'.$file;
  if(!is_file($p)||!preg_match('/\.(json|php|sqlite|db)$/i',$file))continue;
  if(filesize($p)>12000000)throw new RuntimeException('Uninspected other state');
  if(str_contains(file_get_contents($p),$from))throw new RuntimeException('ID used outside central store: '.$file);
 }
 if(peil_count($db,$from)!==7||peil_count($db,$to)!==13)throw new RuntimeException('Reference counts changed');
 $rows=peil_rows($db,[$from,$to]);$nOld=0;$nNew=0;
 foreach($rows as $r){
  $id=$r['competitorId']??'';
  if($id===$from||$id===$to){
   if(!in_array($r['competitorName']??'', ['PEL ANNA','PEIL ANNA'],true))throw new RuntimeException('Unexpected competitor name');
   if($id===$from)$nNew++;else $nOld++;
  }
 }
 if($nNew!==6||$nOld!==12)throw new RuntimeException('Result counts changed '.$nOld.'/'.$nNew);
 $next=$db;
 array_walk_recursive($next,function(&$v)use($from,$to){if(is_string($v)&&$v===$from)$v=$to;});
 array_splice($next['players'],$ps[$from],1);
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$key)
  foreach($next[$group] as &$event)foreach($event[$key]??[] as &$tour)
   foreach($tour['results']??[] as &$result)
    if(($result['competitorId']??'')===$to&&($result['competitorName']??'')==='PEL ANNA')
     $result['competitorName']='PEIL ANNA';
 unset($event,$tour,$result);
 mt73_validate($next);
 if(peil_count($next,$from)!==0)throw new RuntimeException('Old identity still referenced');
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
 echo 'MT89_PEIL_PREFLIGHT_OK refs=7 results=12+6 players='.count($db['players']).' revision='.$original['revision']."\n";
 if($mode==='check')exit;
 if(file_exists($backup)||is_link($backup))throw new RuntimeException('Refuse repeated merge');
 $bytes=file_get_contents(mt73_path());$h=fopen($backup,'x');
 if(!$h)throw new RuntimeException('Backup unavailable');
 chmod($backup,0600);
 if(fwrite($h,$bytes)!==strlen($bytes)){fclose($h);throw new RuntimeException('Backup incomplete');}
 fflush($h);fclose($h);
 if(file_get_contents($backup)!==$bytes)throw new RuntimeException('Backup mismatch');
 $original['data']=$next;$original['revision']++;$original['updatedAt']=gmdate('c');
 mt73_atomic(mt73_path(),mt73_json($original));
 if(mt73_read()!==$original)throw new RuntimeException('Server readback mismatch');
 echo 'MT89_PEIL_SAVED_AND_RELOADED one_player=1 results=18 revision='.$original['revision']."\n";
}finally{flock($f,LOCK_UN);fclose($f);}
