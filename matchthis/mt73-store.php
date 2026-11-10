<?php
declare(strict_types=1);
// Private state lives under the existing deny-all directory and is included in daily backups.
function mt73_path(): string { return __DIR__.'/.mt41-private/state-mt73.json'; }
function mt73_json(mixed $x): string { return json_encode($x,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); }
function mt73_read(): array {
 $p=mt73_path();if(is_link($p)||!is_file($p))throw new RuntimeException('Magazyn danych niedostępny');
 $s=json_decode(file_get_contents($p),true,512,JSON_THROW_ON_ERROR);
 if(!is_array($s)||!isset($s['revision'],$s['data']))throw new RuntimeException('Nieprawidłowy magazyn');return $s;
}
function mt73_atomic(string $p,string $bytes): void {
 if(is_link($p))throw new RuntimeException('Nieprawidłowa ścieżka');
 $t=$p.'.tmp-'.bin2hex(random_bytes(8));
 try {if(file_put_contents($t,$bytes,LOCK_EX)!==strlen($bytes))throw new RuntimeException('Niepełny zapis');chmod($t,0600);if(!rename($t,$p))throw new RuntimeException('Nie udało się zatwierdzić zapisu');}
 finally{if(is_file($t))unlink($t);}
}
function mt73_validate(array $db): void {
 foreach(['players','events','cycles'] as $key){
  if(!isset($db[$key])||!is_array($db[$key])||!array_is_list($db[$key]))throw new InvalidArgumentException('Nieprawidłowa baza: '.$key);
  $ids=[];foreach($db[$key] as $v){if(!is_array($v)||!isset($v['id'])||!is_string($v['id'])||isset($ids[$v['id']]))throw new InvalidArgumentException('Brak lub powtórzony identyfikator');$ids[$v['id']]=true;}
 }
}
// Recursive three-way merge: unchanged fields retain concurrent server updates.
// Array length/order changes are atomic; conflicting changes are never overwritten.
function mt73_merge(mixed $base,mixed $next,mixed $current,string $path=''): mixed {
 if($base===$next)return $current;
 if($base===$current||$next===$current)return $next;
 if(is_array($base)&&is_array($next)&&is_array($current)){
  $lists=array_is_list($base)||array_is_list($next)||array_is_list($current);
  if($lists&&(count($base)!==count($next)||count($base)!==count($current)))throw new DomainException('Konflikt zmian: '.$path);
  if($lists){foreach($base as $i=>$v){if(is_array($v)&&isset($v['id'])&&(($next[$i]['id']??null)!==$v['id']||($current[$i]['id']??null)!==$v['id']))throw new DomainException('Konflikt kolejności: '.$path);}}
  $out=$current;
  foreach(array_unique(array_merge(array_keys($base),array_keys($next))) as $k){
   $b=array_key_exists($k,$base);$n=array_key_exists($k,$next);$c=array_key_exists($k,$current);
   if(!$b){if($c&&$next[$k]!==$current[$k])throw new DomainException('Konflikt nowego pola: '.$path);$out[$k]=$next[$k];}
   elseif(!$n){if($c&&$current[$k]!==$base[$k])throw new DomainException('Konflikt usunięcia: '.$path);unset($out[$k]);}
   elseif(!$c){if($next[$k]!==$base[$k])throw new DomainException('Konflikt usuniętego pola: '.$path);}
   else $out[$k]=mt73_merge($base[$k],$next[$k],$current[$k],$path.'/'.$k);
  }return $out;
 }
 throw new DomainException('Konflikt zmian: '.$path);
}
function mt73_judge_check(array $old,array $new): void {
 $copy=$new;
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$rounds){
  foreach($old[$group] as $i=>$event){foreach(($event[$rounds]??[]) as $j=>$round){
   foreach(($round['results']??[]) as $k=>$row){
    $value=$new[$group][$i][$rounds][$j]['results'][$k]['weightG']??null;
    $previous=$row['weightG']??null;
    if($value!==$previous){
     if(($round['status']??'')==='FINAL'||!is_int($value)||$value<0||$value>1000000)throw new InvalidArgumentException('Sędzia nie może zmienić tej wagi');
     if(array_key_exists('weightG',$row))$copy[$group][$i][$rounds][$j]['results'][$k]['weightG']=$row['weightG'];
     else unset($copy[$group][$i][$rounds][$j]['results'][$k]['weightG']);
    }
   }
  }}
 }
 if($copy!==$old)throw new InvalidArgumentException('Sędzia może zapisywać wyłącznie wagi otwartych tur');
}
function mt73_archive(array $data,string $kind,string $user): string {
 $dir=__DIR__.'/.mt41-private/mt73-history';if(is_link($dir))throw new RuntimeException('Nieprawidłowe archiwum');
 if(!is_dir($dir)&&!mkdir($dir,0700))throw new RuntimeException('Nie można utworzyć archiwum');
 $id=gmdate('Ymd-His').'-'.bin2hex(random_bytes(6));
 mt73_atomic($dir.'/'.$id.'.json',mt73_json(['kind'=>$kind,'user'=>$user,'createdAt'=>gmdate('c'),'data'=>$data]));return $id;
}
function mt73_update(array $input,array $account): array {
 $lockPath=__DIR__.'/.mt41-private/mt73.lock';if(is_link($lockPath))throw new RuntimeException('Nieprawidłowa blokada');
 $f=fopen($lockPath,'c');if(!$f)throw new RuntimeException('Brak blokady');chmod($lockPath,0600);
 try{
  if(!flock($f,LOCK_EX))throw new RuntimeException('Brak blokady');
  $s=mt73_read();$op=$input['op']??'save';
  if($op==='legacy'){
   if($account['role']!=='admin')throw new InvalidArgumentException('Migracja wymaga administratora');
   mt73_validate($input['data']??[]);
   $id=mt73_archive($input['data'],'legacy-browser',$account['username']);
   if(isset($input['original'])&&is_array($input['original']))mt73_archive($input['original'],'legacy-original',$account['username']);
   // First administrator browser may import its previously local data once.
   if(!empty($s['seeded'])&&$s['revision']===1){
    mt73_archive($s,'before-first-browser-import',$account['username']);
    $s['data']=$input['data'];$s['revision']++;$s['seeded']=false;$s['updatedAt']=gmdate('c');
    mt73_atomic(mt73_path(),mt73_json($s));
    return ['state'=>$s,'imported'=>true,'archiveId'=>$id];
   }
   return ['state'=>$s,'imported'=>false,'archiveId'=>$id];
  }
  if($op!=='save')throw new InvalidArgumentException('Nieznana operacja');
  $base=$input['base']??null;$next=$input['data']??null;
  if(!is_array($base)||!is_array($next))throw new InvalidArgumentException('Brak danych');
  mt73_validate($base);mt73_validate($next);
  try{$merged=mt73_merge($base,$next,$s['data']);}
  catch(DomainException $e){mt73_archive($next,'conflict-'.$account['role'],$account['username']);throw $e;}
  mt73_validate($merged);
  if($account['role']==='judge')mt73_judge_check($s['data'],$merged);
  elseif($account['role']!=='admin')throw new InvalidArgumentException('Brak uprawnień');
  if($merged!==$s['data']){
   mt73_archive($s,'before-save',$account['username']);
   $s['data']=$merged;$s['revision']++;$s['seeded']=false;$s['updatedAt']=gmdate('c');
   mt73_atomic(mt73_path(),mt73_json($s));
  }return ['state'=>$s];
 }finally{flock($f,LOCK_UN);fclose($f);}
}
// Only published results and explicitly whitelisted display fields leave the private store.
function mt73_public(array $db): array {
 $out=['events'=>[],'cycles'=>[],'players'=>[]];$playerIds=[];
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$roundKey){
  foreach($db[$group] as $e){
   if(in_array($e['visibility']??'',['private','test','PRIVATE','TEST'],true))continue;
   $clean=[];foreach(['id','name','date','year','kind','archived','source','sourceUrl','location','venue','cycleId','zeroMode','scoring','bestOf','countBest','description','countedTours','expectedTours','linkedFinalId','officialDataEdited','officialRows','sourceIssues'] as $k)if(isset($e[$k]))$clean[$k]=$e[$k];
   $clean[$roundKey]=[];
   foreach($e[$roundKey]??[] as $t){
    $r=[];foreach(['id','name','date','status','sectorCount','sectors','sourceOfficial','zeroMode'] as $k)if(isset($t[$k]))$r[$k]=$t[$k];
    $r['results']=[];
    if(($t['status']??'')==='FINAL')foreach($t['results']??[] as $v){
     $row=[];foreach(['competitorId','competitorName','peg','sector','weightG','officialPlace','nameNeedsReview'] as $k)if(array_key_exists($k,$v))$row[$k]=$v[$k];
     $r['results'][]=$row;$playerIds[$v['competitorId']??'']=true;
    }
    $clean[$roundKey][]=$r;
   }$out[$group][]=$clean;
  }
 }
 foreach($db['players'] as $p){
  $q=[];foreach(['id','firstName','lastName','aliases','archived','isReservation','nameNeedsReview'] as $k)if(isset($p[$k]))$q[$k]=$p[$k];$out['players'][]=$q;
 }return $out;
}
