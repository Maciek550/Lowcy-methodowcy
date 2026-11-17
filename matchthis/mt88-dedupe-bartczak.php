<?php
declare(strict_types=1);
/* One-time MatchThis MT88 merge of BARTCZAK JAN records, exact-ID only.
   Preserve all scores, stations, tours, accounts and original state backup. */
$mode=$argv[1]??'';
if(!in_array($mode,['check','apply'],true))throw new RuntimeException('Usage: php mt88-dedupe.php check|apply');
$web=getenv('HOME').'/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html';
$priv=$web.'/.mt41-private';
$stage=getenv('HOME').'/matchthis-independent/mt88-bartczak-20261117';
$backup=$stage.'/before-identity-dedup.json';
$from='mt2026-person-barczak-jan';$to='mt2025-sensas-dec06-person-26';
if(!is_dir($stage)||is_link($stage)||!is_file($web.'/mt73-store.php'))throw new RuntimeException('Wrong MatchThis installation');
if(!str_contains(file_get_contents($web.'/index.html'),'<title>MatchThis MT-88</title>'))throw new RuntimeException('Wrong frontend version');
require_once $web.'/mt73-store.php';
$lock=$priv.'/mt73.lock';
if(is_link($lock)||!is_file($lock))throw new RuntimeException('Invalid central lock');
$f=fopen($lock,'c');
if(!$f||!flock($f,LOCK_EX))throw new RuntimeException('Cannot lock');
try {
 $before=mt73_read();$data=$before['data'];mt73_validate($data);
 $players=$data['players'];$idxFrom=[];$idxTo=[];
 foreach($players as $i=>$p){if(($p['id']??null)===$from)$idxFrom[]=$i;if(($p['id']??null)===$to)$idxTo[]=$i;}
 if(count($idxFrom)!==1||count($idxTo)!==1)throw new RuntimeException('Exactly two known player records required');
 foreach([$players[$idxFrom[0]],$players[$idxTo[0]]] as $p){
  if(($p['firstName']??null)!=='JAN'||($p['lastName']??null)!=='BARTCZAK'||($p['archived']??null)!==false||($p['club']??'')!==''||($p['aliases']??[])!==['BARTCZAK JAN'])throw new RuntimeException('Player identity differs');
 }
 foreach(scandir($priv) as $name){
  if(in_array($name,['.','..','state-mt73.json','mt73.lock'],true))continue;
  $p=$priv.'/'.$name;if(!is_file($p))continue;
  if(!preg_match('/\.(json|php|sqlite|db)$/i',$name))continue;
  if(filesize($p)>12000000)throw new RuntimeException('Uninspected private file');
  if(str_contains(file_get_contents($p),$from))throw new RuntimeException('Secondary ID linked in separate account file: '.$name);
 }
 $counts=[$from=>0,$to=>0];$beforeRows=[];
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$key)foreach($data[$group] as $i=>$entity)foreach(($entity[$key]??[]) as $j=>$tour){
  $seen=[];foreach(($tour['results']??[]) as $k=>$r){
   $id=$r['competitorId']??null;
   if(isset($counts[$id])){$counts[$id]++;if(($r['competitorName']??'')!=='BARTCZAK JAN')throw new RuntimeException('Result spelling mismatch');$seen[$id]=true;}
   $beforeRows[$group.'/'.$i.'/'.$j.'/'.$k]=$r;
  }
  if(isset($seen[$from],$seen[$to]))throw new RuntimeException('Both identities in one round');
 }
 if($counts!==[$from=>8,$to=>17])throw new RuntimeException('Unexpected result count: '.json_encode($counts));
 $next=$data;$substitutions=0;
 array_walk_recursive($next,function(&$v)use($from,$to,&$substitutions){if(is_string($v)&&$v===$from){$v=$to;$substitutions++;}});
 if($substitutions!==11)throw new RuntimeException('Unknown reference count: '.$substitutions);
 array_splice($next['players'],$idxFrom[0],1);
 mt73_validate($next);
 if(count($next['players'])!==count($players)-1)throw new RuntimeException('Player not removed');
 if(count(array_filter($next['players'],fn($p)=>$p['id']===$to))!==1)throw new RuntimeException('Canonical ID duplicated');
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$key)foreach($next[$group] as $i=>$entity){
  $ids=$entity['entrantIds']??[];if(count($ids)!==count(array_unique($ids)))throw new RuntimeException('Duplicate in entrantIds');
  foreach(($entity[$key]??[]) as $j=>$tour)foreach(($tour['results']??[]) as $k=>$row){
   $prior=$beforeRows[$group.'/'.$i.'/'.$j.'/'.$k]??null;
   if(!is_array($prior))throw new RuntimeException('Lost round row');
   if(($prior['competitorId']??null)===$from)$prior['competitorId']=$to;
   if($row!==$prior)throw new RuntimeException('Results/weights changed unexpectedly');
  }
 }
 echo 'MT88_DEDUPE_PREFLIGHT_PASS old_results=8 canonical_results=17 references=11 revision='.$before['revision']."\n";
 if($mode==='check')exit(0);
 if(file_exists($backup)||is_link($backup))throw new RuntimeException('One-time backup already exists');
 $raw=file_get_contents(mt73_path());
 $fh=fopen($backup,'x');if(!$fh)throw new RuntimeException('Backup failed');
 chmod($backup,0600);
 if(fwrite($fh,$raw)!==strlen($raw)){fclose($fh);throw new RuntimeException('Incomplete backup');}
 fflush($fh);fclose($fh);
 if(file_get_contents($backup)!==$raw)throw new RuntimeException('Backup readback failed');
 $before['data']=$next;$before['revision']++;$before['updatedAt']=gmdate('c');
 mt73_atomic(mt73_path(),mt73_json($before));
 $read=mt73_read();
 if($read!==$before)throw new RuntimeException('State readback mismatch');
 if(count($read['data']['players'])!==count($players)-1)throw new RuntimeException('Player count mismatch');
 $dangling=0;
 array_walk_recursive($read['data'],function($v)use($from,&$dangling){if(is_string($v)&&$v===$from)$dangling++;});
 if($dangling!==0)throw new RuntimeException('Old player ID still referenced');
 echo 'MT88_BARTCZAK_ONE_RECORD_25_RESULTS_READBACK_PASS players='.count($read['data']['players']).' revision='.$read['revision']."\n";
} finally {flock($f,LOCK_UN);fclose($f);}
