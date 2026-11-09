<?php
declare(strict_types=1);
// MatchThis MT-60: only deliberately published station assignments are public.
// Passwords, results, history and draft draws are never serialized here.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Access-Control-Allow-Origin: https://matchthis.lowcymethodowcy.smallhost.pl');
function mt60_reply(int $status,array $body): never {
 http_response_code($status);
 echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 exit;
}
function mt60_rows_file(): string {
 $private=__DIR__.'/.mt41-private';
 if(!is_dir($private)||is_link($private))mt60_reply(503,['error'=>'Przechowywanie publikacji niedostępne']);
 $file=$private.'/mt60-published-draws.json';
 if(is_link($file))mt60_reply(503,['error'=>'Niedozwolony plik publikacji']);
 return $file;
}
function mt60_read_public(): array {
 $file=mt60_rows_file();
 if(!is_file($file))return [];
 $size=filesize($file);if($size===false||$size>1048576)mt60_reply(503,['error'=>'Publikacja jest za duża']);
 $json=file_get_contents($file);
 if($json===false)mt60_reply(503,['error'=>'Publikacja chwilowo niedostępna']);
 $rows=json_decode($json,true);
 if(!is_array($rows)||!array_is_list($rows))mt60_reply(503,['error'=>'Nieprawidłowe dane publikacji']);
 return $rows;
}
function mt60_check_text(mixed $value,int $max): string {
 if(!is_string($value)||strlen($value)<1||strlen($value)>$max||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value))mt60_reply(400,['error'=>'Nieprawidłowa wartość tekstowa']);
 return $value;
}
$method=$_SERVER['REQUEST_METHOD']??'GET';
if($method==='GET'&&(!isset($_GET['token'])||$_GET['token']!=='1')){
 mt60_reply(200,['draws'=>mt60_read_public()]);
}
if($method!=='GET'&&$method!=='POST'){
 header('Allow: GET, POST');mt60_reply(405,['error'=>'Niedozwolona metoda']);
}
require __DIR__.'/.mt41-private/mt41-auth.php';
mt41_session_start();
$account=mt41_authenticated();
if(!$account||$account['role']!=='admin')mt60_reply(403,['error'=>'Tylko administrator publikuje losowanie']);
if($method==='GET')mt60_reply(200,['csrf'=>mt41_csrf()]);
$origin=(string)($_SERVER['HTTP_ORIGIN']??'');
if($origin!==''&&$origin!=='https://matchthis.lowcymethodowcy.smallhost.pl')mt60_reply(403,['error'=>'Niedozwolone źródło']);
if(!hash_equals(mt41_csrf(),(string)($_SERVER['HTTP_X_MT_CSRF']??'')))mt60_reply(403,['error'=>'Brak autoryzacji publikacji']);
$contentType=strtolower((string)($_SERVER['CONTENT_TYPE']??''));
if(!str_starts_with($contentType,'application/json'))mt60_reply(415,['error'=>'Oczekiwano JSON']);
$raw=file_get_contents('php://input');
if($raw===false||strlen($raw)>100000||$raw==='')mt60_reply(413,['error'=>'Przekroczono limit publikacji']);
$input=json_decode($raw,true);
if(!is_array($input))mt60_reply(400,['error'=>'Nieprawidłowy JSON']);
$action=$input['action']??'';
if(!in_array($action,['publish','hide'],true))mt60_reply(400,['error'=>'Nieznana operacja']);
$eventId=mt60_check_text($input['eventId']??null,140);
if(!preg_match('/^[a-zA-Z0-9._:-]+$/D',$eventId))mt60_reply(400,['error'=>'Nieprawidłowy identyfikator zawodów']);
$round=$input['roundIndex']??null;
if(!is_int($round)||$round<0||$round>10)mt60_reply(400,['error'=>'Nieprawidłowa tura']);
$payload=null;
if($action==='publish'){
 $date=mt60_check_text($input['date']??null,10);
 if(!preg_match('/^20\d{2}-\d{2}-\d{2}$/D',$date))mt60_reply(400,['error'=>'Nieprawidłowa data']);
 $name=mt60_check_text($input['eventName']??null,200);
 $tour=mt60_check_text($input['tourName']??null,120);
 $rows=$input['rows']??null;
 if(!is_array($rows)||!array_is_list($rows)||count($rows)<1||count($rows)>160)mt60_reply(400,['error'=>'Liczba zawodników poza limitem']);
 $uniqueIds=[];$uniquePegs=[];$clean=[];
 foreach($rows as $row){
  if(!is_array($row))mt60_reply(400,['error'=>'Nieprawidłowy wpis']);
  $id=mt60_check_text($row['competitorId']??null,140);
  $player=mt60_check_text($row['competitorName']??null,150);
  $sector=mt60_check_text($row['sector']??null,3);
  $peg=$row['peg']??null;
  if(!is_int($peg)||$peg<1||$peg>10000||!preg_match('/^[A-Z]{1,3}$/D',$sector))mt60_reply(400,['error'=>'Nieprawidłowe stanowisko lub sektor']);
  if(isset($uniqueIds[$id])||isset($uniquePegs[$peg]))mt60_reply(400,['error'=>'Powtórzony zawodnik lub stanowisko']);
  $uniqueIds[$id]=true;$uniquePegs[$peg]=true;
  $clean[]=['competitorId'=>$id,'competitorName'=>$player,'peg'=>$peg,'sector'=>$sector];
 }
 $payload=['eventId'=>$eventId,'roundIndex'=>$round,'eventName'=>$name,'tourName'=>$tour,'date'=>$date,'rows'=>$clean];
}
$file=mt60_rows_file();
$lockFile=dirname($file).'/mt60-published-draws.lock';
if(is_link($lockFile))mt60_reply(503,['error'=>'Niedozwolona blokada']);
$lock=fopen($lockFile,'c');
if(!$lock)mt60_reply(503,['error'=>'Brak blokady']);
try{
 if(!flock($lock,LOCK_EX))mt60_reply(503,['error'=>'Nie można zablokować publikacji']);
 $items=mt60_read_public();
 $items=array_values(array_filter($items,static function($item)use($eventId,$round):bool {
  return !is_array($item)||($item['eventId']??'')!==$eventId||($item['roundIndex']??-1)!==$round;
 }));
 if($payload!==null)$items[]=$payload;
 if(count($items)>120)mt60_reply(413,['error'=>'Za dużo opublikowanych losowań']);
 $serialized=json_encode($items,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 if(strlen($serialized)>1000000)mt60_reply(413,['error'=>'Brak miejsca na publikacje']);
 $temp=dirname($file).'/.mt60-next-'.bin2hex(random_bytes(8));
 try {
  $written=file_put_contents($temp,$serialized,LOCK_EX);
  if($written!==strlen($serialized))mt60_reply(503,['error'=>'Nie udało się zapisać całości']);
  chmod($temp,0600);
  if(!rename($temp,$file))mt60_reply(503,['error'=>'Błąd publikacji']);
 }finally{if(is_file($temp))unlink($temp);}
 mt60_reply(200,['ok'=>true,'published'=>$payload!==null]);
}finally{flock($lock,LOCK_UN);fclose($lock);}
