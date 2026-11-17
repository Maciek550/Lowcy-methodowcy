<?php
declare(strict_types=1);
// One-time, narrowly scoped correction of BARCZAK JAN to BARTCZAK JAN.
// Reuses the central MatchThis lock, history and atomic-store helpers.
// Does not change account IDs, passwords, user records or scoring.
$web=getenv('HOME').'/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html';
$stage=getenv('HOME').'/matchthis-independent/mt88-bartczak-20261117';
if(!is_dir($web) || !is_dir($stage))throw new RuntimeException('Wrong site or stage');
require_once $web.'/mt73-store.php';
$lock=$web.'/.mt41-private/mt73.lock';
if(is_link($lock))throw new RuntimeException('Symlink lock forbidden');
$f=fopen($lock,'c');
if(!$f||!flock($f,LOCK_EX))throw new RuntimeException('Failed to lock state');
try{
 $current=mt73_read();
 mt73_validate($current['data']);
 $original=mt73_json($current);
 $backup=$stage.'/before-state-mt73.json';
 if(is_file($backup))throw new RuntimeException('Backup exists; no repeat deployment');
 if(file_put_contents($backup,$original,LOCK_EX)!==strlen($original))throw new RuntimeException('Backup failed');
 chmod($backup,0600);
 $stats=['lastName'=>0,'strings'=>0];
 function fix_bartczak(array &$node,array &$stats):void {
  if(isset($node['firstName'],$node['lastName']) &&
     preg_match('/^\s*JAN\s*$/iu',(string)$node['firstName']) &&
     preg_match('/^\s*BARCZAK\s*$/iu',(string)$node['lastName'])){
       $node['lastName']='BARTCZAK';$stats['lastName']++;
  }
  foreach($node as $k=>&$v){
   if(is_array($v)){fix_bartczak($v,$stats);}
   elseif(is_string($v) && preg_match('/^\s*BARCZAK\s+JAN\s*$/iu',$v)){
    $v='BARTCZAK JAN';$stats['strings']++;
   }
  }
  unset($v);
 }
 fix_bartczak($current['data'],$stats);
 mt73_validate($current['data']);
 $after=mt73_json($current);
 if($stats['lastName']+$stats['strings']>0){
  $current['revision']++;
  $current['updatedAt']=gmdate('c');
  $current['seeded']=false;
  mt73_atomic(mt73_path(),mt73_json($current));
 }
 $readback=mt73_read();
 if($readback!==$current)throw new RuntimeException('Readback mismatch');
 $payload=mt73_json($readback['data']);
 if(preg_match('/"BARCZAK JAN"/iu',$payload))throw new RuntimeException('Bad spelling survived');
 if(!str_contains($payload,'BARTCZAK JAN'))throw new RuntimeException('Missing corrected name');
 echo 'MT88_DATA_PATCH_PASS lastName='.$stats['lastName'].' fullName='.$stats['strings'].' revision='.$readback['revision']."\n";
}finally{flock($f,LOCK_UN);fclose($f);}
