<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
require __DIR__.'/mt73-store.php';
function reply73(int $code,array $body): never {http_response_code($code);echo mt73_json($body);exit;}
try{
 $method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='GET'&&($_GET['public']??'')==='1'){$s=mt73_read();reply73(200,['revision'=>$s['revision'],'data'=>mt73_public($s['data'])]);}
 require __DIR__.'/.mt41-private/mt41-auth.php';mt41_session_start();$a=mt41_authenticated();
 if(!$a)reply73(401,['error'=>'Zaloguj się ponownie.']);
 if($method==='GET')reply73(200,['state'=>mt73_read(),'csrf'=>mt41_csrf(),'role'=>$a['role']]);
 if($method!=='POST')reply73(405,['error'=>'Niedozwolona metoda']);
 if(($_SERVER['HTTP_ORIGIN']??'')!==''&&($_SERVER['HTTP_ORIGIN']??'')!=='https://'.($_SERVER['HTTP_HOST']??''))reply73(403,['error'=>'Niedozwolone źródło']);
 if(!hash_equals(mt41_csrf(),(string)($_SERVER['HTTP_X_MT_CSRF']??'')))reply73(403,['error'=>'Brak autoryzacji zapisu']);
 if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))reply73(415,['error'=>'Oczekiwano JSON']);
 $raw=file_get_contents('php://input',false,null,0,16000001);if(strlen($raw)>16000000)reply73(413,['error'=>'Za duża baza']);
 $input=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($input))reply73(400,['error'=>'Nieprawidłowe dane']);
 reply73(200,mt73_update($input,$a));
}catch(DomainException $e){reply73(409,['error'=>'Te same dane zmieniono na innym urządzeniu. Twoja wersja jest zachowana na serwerze. Odśwież i porównaj zmiany.']);}
catch(InvalidArgumentException|JsonException $e){reply73(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('MatchThis state: '.get_class($e));reply73(503,['error'=>'Zapis na serwerze niedostępny. Nie zamykaj karty; ponów zapis.']);}
