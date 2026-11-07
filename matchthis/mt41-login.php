<?php
declare(strict_types=1);
require __DIR__.'/.mt41-private/mt41-auth.php';
mt41_session_start();
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);exit;}
$username=trim((string)($_POST['username']??''));
$password=(string)($_POST['password']??'');
if(strlen($username)>48||strlen($password)>200||$username===''||$password===''){http_response_code(400);exit;}
try{$record=mt41_read_users()[$username]??null;}
catch(Throwable $e){error_log('MatchThis auth storage unavailable');http_response_code(503);exit('Logowanie chwilowo niedostępne');}
if(!$record||!password_verify($password,$record['hash'])){
 usleep(250000);header('Location: /?login_error=1',true,303);exit;
}
mt41_begin_login($username,$record);
header('Location: /panel.php',true,303);exit;
